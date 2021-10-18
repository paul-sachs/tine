import express from "express";
import cors from "cors";
import helmet from "helmet";
import httpClient, { AxiosError } from "axios";
import { NodeSSH } from "node-ssh";
import fileUpload from "express-fileupload";
import { InputType, Status } from "./types";
import fallback from "express-history-api-fallback";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import ExcelJS from "exceljs";
import { Readable } from "stream";

const sshClient = new NodeSSH();

const args = process.argv.slice(2);
const PORT = args?.[0] ?? 1235;
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(fileUpload());

const router = express.Router();

router.get("/status", async (req, res) => {
  try {
    const { queryUrl } = req.query;
    const reply = (status: Status) => {
      res.json(status);
    };
    if (typeof queryUrl !== "string") {
      return res.status(400).send("Missing queryUrl");
    }
    const url = new URL(queryUrl);
    // TODO choose ssh or https
    if (url.protocol.startsWith("http")) {
      try {
        const result = await httpClient.get(queryUrl, {
          // disable json parsing
          transformResponse: (t) => t,
        });

        if (result.status === 200) {
          return reply({
            status: "reachable",
          });
        }
      } catch (e) {
        const error = e as AxiosError;
        console.log("http", { e });

        // TODO: probably some additional handling here for edge cases you want to handle.
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          return reply({
            status: error.response.status === 401 ? "reachable" : "unreachable",
            reason: error.response.statusText,
            additionalData: error.response.data,
          });
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          return reply({
            status: "unreachable",
            reason: error.toString(),
          });
        } else {
          throw error;
        }
      }
    } else if (url.protocol === "ssh:") {
      try {
        const connection = await sshClient.connect({
          host: url.hostname,
          port: url.port !== undefined ? parseInt(url.port, 10) : 22,
          username: "admin",
          password: "test",
          readyTimeout: 10000,
        });
        connection.dispose();
        // assume if no error throws then we're good.
        return reply({
          status: "reachable",
        });
      } catch (e) {
        // TODO: figure out if it's an auth issue, which means it's reachable but not
        // authenticated.
        if (e.level === "client-authentication") {
          return reply({
            status: "reachable",
          });
        }
        return reply({
          status: "unreachable",
          reason: e.toString(),
        });
      }
    } else {
      return reply({
        status: "unreachable",
        reason: "not_implemented",
      });
    }
  } catch (e) {
    res.status(500).send(e.message);
  }
});

router.post("/parse", async (req, res) => {
  const file = req.files.file;
  if (Array.isArray(file)) {
    return res
      .status(400)
      .send("Multiple files uploaded but only one file is allowed at a time");
  }
  if (!file) {
    return res.status(400).send("No files specified");
  }
  const supportedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ];
  if (!supportedMimeTypes.includes(file.mimetype)) {
    return res.status(400).send(`File format ${file.mimetype} not supported.`);
  }
  const workbook = new ExcelJS.Workbook();
  let worksheet: ExcelJS.Worksheet | null = null;
  if (
    file.mimetype ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    await workbook.xlsx.load(file.data);
    if (workbook.worksheets.length !== 1) {
      return res.status(400).send("File must contain exactly 1 worksheet");
    }
    worksheet = workbook.worksheets[0];
  } else {
    worksheet = await workbook.csv.read(Readable.from(file.data.toString()));
  }
  let result: InputType[] = [];
  // skip first row, assume headers
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
    const row = worksheet.getRow(rowIndex);
    if (!row) {
      break;
    }
    result.push({
      name: row.getCell(1).toString(),
      ipAddress: row.getCell(2).toString(),
      format: row.getCell(3).toString() as any,
      port: row.getCell(4).toString() as any,
    });
  }

  res.status(201).json(result);
});

app.use(router);

if ((process as any).pkg !== undefined) {
  // Configure a proxy and static hosting and fallback
  // to emulate the parcel dev server.
  // Note: assets won't work until packaged
  const root = path.join(__dirname, `assets`);
  app.use(express.static(root));

  app.use(
    createProxyMiddleware("/api", {
      target: `http://localhost:${PORT}/`,
      pathRewrite: {
        "^/api": "",
      },
    })
  );
  // Fallback MUST be last middleware, otherwise it'll wipe out any following routes
  app.use(
    fallback("index.html", {
      root,
    })
  );
}

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
