import express from "express";
import cors from "cors";
import helmet from "helmet";
import httpClient, { AxiosError } from "axios";
import { NodeSSH } from "node-ssh";
import fileUpload from "express-fileupload";
import { Status } from "./types";

const sshClient = new NodeSSH();

const PORT = 1235;
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(
  fileUpload({
    debug: true,
  })
);

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

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
          console.error({ e, get: queryUrl });
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
  console.log({ body: req.body, x: req.files });
  res.status(201).send("success");
});

app.use(router);
