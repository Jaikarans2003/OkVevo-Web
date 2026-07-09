"""Service entrypoint (thin wrapper over ``create_app``)."""

from __future__ import annotations

import uvicorn

from .bootstrap import create_app

app = create_app()


def main() -> None:
    cfg = app.state.config
    uvicorn.run(app, host="0.0.0.0", port=cfg.port, log_config=None)


if __name__ == "__main__":
    main()
