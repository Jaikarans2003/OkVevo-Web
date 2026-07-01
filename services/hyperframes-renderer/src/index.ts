import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { logStartupDiagnostics } from "./diagnostics.js";

const app = createApp();

void logStartupDiagnostics().then((diag) => {
  if (!diag.ready) {
    logger.warn("Service started in degraded mode — one or more dependencies failed checks");
  }
});

app.listen(config.port, "0.0.0.0", () => {
  logger.info({ port: config.port, workRoot: config.workRoot }, "HyperFrames renderer listening");
});
