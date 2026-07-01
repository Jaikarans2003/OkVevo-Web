import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { Logger } from "pino";

/**
 * Attach `req.log` (child logger) and emit one structured line per response.
 */
export function requestLoggerMiddleware(rootLogger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const reqId = randomUUID();
    const start = Date.now();
    const log = rootLogger.child({ reqId });
    (req as Request & { log: Logger }).log = log;

    res.on("finish", () => {
      const ms = Date.now() - start;
      const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
      log[level](
        {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          durationMs: ms,
        },
        "request",
      );
    });

    next();
  };
}
