import type { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      hfWorkspace?: {
        sessionId: string;
        sessionDir: string;
        projectRoot: string;
      };
    }
  }
}

export type { Request };
