export type InputType = {
  name?: string;
  format: "https" | "http" | "ssh";
  ipAddress?: string;
  port?: number;
};

export type Status =
  | {
      status: "reachable";
      reason?: string;
      additionalData?: any;
    }
  | {
      status: "unreachable";
      reason: string;
      additionalData?: any;
    }
  | {
      status: "actively_blocked";
    };
