import React, { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "react-query";
import { useDebounce, useLocalStorage } from "./utils";
import {
  Card,
  DataTable,
  Page,
  Badge,
  TextField,
  Select,
  Stack,
  DropZone,
  Button,
  Icon,
  Spinner,
  Tooltip,
  BadgeProps,
} from "@shopify/polaris";
import { append, update, remove } from "ramda";
import { InputType, Status } from "../types";
import { DeleteMinor, InfoMinor } from "@shopify/polaris-icons";
import { match } from "ts-pattern";

const Status = ({ format, ipAddress, port }: InputType) => {
  const queryUrl = `${format}://${ipAddress}${port ? `:${port}` : ""}`;
  // debounce the query url so typing doesn't constantly trigger queries
  const throttledQueryUrl = useDebounce(queryUrl, 300);
  const enableStatusCheck = !!format && !!ipAddress;
  const status = useQuery<Status>(
    ["input-stats", { queryUrl: throttledQueryUrl }],
    async () => {
      const result = await fetch(
        `/api/status?queryUrl=${encodeURIComponent(throttledQueryUrl)}`
      );
      return result.json();
    },
    {
      refetchInterval: 60000,
      enabled: enableStatusCheck,
      staleTime: 60000,
    }
  );
  if (!enableStatusCheck) {
    return <Badge status="info">idle</Badge>;
  }
  if (status.isLoading || !status.data) {
    return <Spinner size="small" accessibilityLabel="Status loading" />;
  }
  const badgeStatus = match(status.data)
    .with({ status: "reachable" }, () => "success" as const)
    .otherwise(() => "critical" as const);
  const content = <Badge status={badgeStatus}>{status.data.status}</Badge>;
  return "reason" in status.data ? (
    <Tooltip content={status.data.reason}>{content}</Tooltip>
  ) : (
    content
  );
};

function TextDataField<T extends object>({
  row,
  field,
  rowIndex,
  setContents,
}: {
  row: T;
  field: keyof T;
  rowIndex: number;
  setContents: React.Dispatch<React.SetStateAction<T[]>>;
}) {
  return (
    <TextField
      label={field}
      value={row[field]?.toString()}
      labelHidden
      onChange={(text) => {
        setContents(
          update(rowIndex, {
            ...row,
            [field]: text,
          } as T)
        );
      }}
      autoComplete="off"
    />
  );
}

function FormatDataField<T extends object>({
  row,
  field,
  rowIndex,
  setContents,
}: {
  row: T;
  field: keyof T;
  rowIndex: number;
  setContents: React.Dispatch<React.SetStateAction<T[]>>;
}) {
  return (
    <Select
      label={field}
      options={["http", "https", "ssh"]}
      value={row[field].toString()}
      labelHidden
      onChange={(text) => {
        setContents(
          update(rowIndex, {
            ...row,
            [field]: text,
          } as T)
        );
      }}
    />
  );
}

export const App = () => {
  const [fileContents, setFileContents] = useLocalStorage<InputType[]>(
    "file-contents",
    [
      {
        name: "XYZ",
        format: "https",
        ipAddress: "google.com",
      },
    ]
  );

  const parseExcel = useMutation(async (fileToParse: File) => {
    // TODO: parse excel file to pull out names/format/port/etc
    // POSSIBLE: persist to lcalstorage
    const formData = new FormData();
    formData.append("file", fileToParse);
    const result = await fetch(`/api/parse`, {
      method: "POST",
      body: formData,
    });
    const tempFormat: InputType[] = [,];
    return tempFormat;
  });

  const rows = useMemo(() => {
    return fileContents.map((c, index) => [
      <TextDataField
        row={c}
        field="name"
        rowIndex={index}
        setContents={setFileContents}
      />,
      <TextDataField
        row={c}
        field="ipAddress"
        rowIndex={index}
        setContents={setFileContents}
      />,
      <FormatDataField
        row={c}
        field="format"
        rowIndex={index}
        setContents={setFileContents}
      />,
      <TextDataField
        row={c}
        field="port"
        rowIndex={index}
        setContents={setFileContents}
      />,
      <Status {...c} />,
      <Button
        destructive
        icon={<Icon source={DeleteMinor} />}
        onClick={() => setFileContents(remove(index, 1))}
      />,
    ]);
  }, [fileContents]);
  const handleDropZoneDrop = useCallback(
    (_dropFiles, acceptedFiles, _rejectedFiles) =>
      parseExcel.mutate(acceptedFiles[0]),
    []
  );

  return (
    <Page title="Tine">
      <Card
        primaryFooterAction={{
          content: "Add",
          onAction: () =>
            setFileContents(
              append<InputType>({
                format: "https",
              })
            ),
        }}
      >
        <DataTable
          verticalAlign="middle"
          headings={[
            "Name",
            "IP Address",
            "Format",
            "Special port",
            "Status",
            "",
          ]}
          rows={rows}
          columnContentTypes={[
            "text",
            "text",
            "text",
            "numeric",
            "text",
            "text",
          ]}
        />
      </Card>
      <DropZone
        onDrop={handleDropZoneDrop}
        accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        allowMultiple={false}
      >
        <DropZone.FileUpload
          actionTitle="Load config"
          actionHint="Loaded config will erase current network config."
        />
      </DropZone>
    </Page>
  );
};
