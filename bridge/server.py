#!/usr/bin/env python3
"""
HeightmapGen Bridge — локальный HTTP-сервер.

Принимает POST с base64-закодированными PNG-картами и конфигом из веб-приложения,
складывает PNG во временную папку и пишет MAXScript в очередь, которую
обрабатывает MaxBridge.ms внутри 3ds Max.

Запуск:
    python server.py [--port 7878] [--host 127.0.0.1]

Эндпоинты:
    GET  /ping    — { "status": "ok", "version": "..." }
    POST /apply   — JSON-payload (см. ниже), возвращает { "session": "...", ... }

POST /apply payload:
    {
      "maps": {
        "height16":  "data:image/png;base64,...",   # обязательно для displacement
        "height8":   "data:image/png;base64,...",   # опционально
        "normal":    "data:image/png;base64,...",
        "ao":        "data:image/png;base64,...",
        "roughness": "data:image/png;base64,...",
        "mask":      "data:image/png;base64,..."
      },
      "config": {
        "displacementScale": 1.5,                  # сила Displace модификатора
        "tessellate": 2,                           # итерации Tessellate (0-4)
        "addUVW": true,                            # добавлять ли UVWMap shrinkwrap
        "applyMaterial": true,                     # PhysicalMaterial с bump/roughness
        "materialName": "HeightmapGen"
      }
    }
"""
from __future__ import annotations

import argparse
import base64
import datetime
import http.server
import json
import logging
import os
import sys
import tempfile
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

VERSION = "1.0.0"
DEFAULT_PORT = 7878

ROOT = Path(tempfile.gettempdir()) / "HeightmapGen"
QUEUE_DIR = ROOT / "queue"
ASSETS_DIR = ROOT / "assets"

# Путь к шаблону apply.ms — рядом с этим скриптом
TEMPLATE_PATH = Path(__file__).resolve().parent / "apply_template.ms"


def _ms_path(p: Path) -> str:
    """Превратить путь в форму, безопасную для MAXScript-строки.

    MAXScript принимает forward-slashes на Windows, что избавляет от \\-эскейпинга.
    """
    return str(p).replace("\\", "/")


def build_apply_script(session_dir: Path, config: dict) -> str:
    """Сгенерировать MAXScript для применения карт к выделенному объекту."""
    base = _ms_path(session_dir)
    disp_scale = float(config.get("displacementScale", 1.5))
    tess_iters = int(config.get("tessellate", 2))
    add_uvw = bool(config.get("addUVW", True))
    apply_material = bool(config.get("applyMaterial", True))
    mat_name = str(config.get("materialName", "HeightmapGen"))
    # Для лога:
    ts = datetime.datetime.now().isoformat(timespec="seconds")

    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    return (
        template
        .replace("{{TIMESTAMP}}", ts)
        .replace("{{BASE}}", base)
        .replace("{{DISP_SCALE}}", f"{disp_scale}")
        .replace("{{TESS_ITERS}}", str(tess_iters))
        .replace("{{ADD_UVW}}", "true" if add_uvw else "false")
        .replace("{{APPLY_MATERIAL}}", "true" if apply_material else "false")
        .replace("{{MAT_NAME}}", mat_name)
    )


class BridgeHandler(http.server.BaseHTTPRequestHandler):
    server_version = f"HeightmapGenBridge/{VERSION}"

    # ---- CORS ----
    def _set_cors(self) -> None:
        # Разрешаем GitHub Pages и локальный dev-сервер.
        origin = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")

    def do_OPTIONS(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler interface)
        self.send_response(204)
        self._set_cors()
        self.end_headers()

    # ---- GET /ping ----
    def do_GET(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        if url.path == "/ping":
            self._json(200, {"status": "ok", "version": VERSION})
        else:
            self._json(404, {"error": "not found"})

    # ---- POST /apply ----
    def do_POST(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        if url.path != "/apply":
            self._json(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 200 * 1024 * 1024:
            self._json(400, {"error": "invalid length"})
            return
        body = self.rfile.read(length)
        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError as e:
            self._json(400, {"error": f"invalid json: {e}"})
            return

        maps = payload.get("maps") or {}
        if not isinstance(maps, dict) or not maps:
            self._json(400, {"error": "no maps"})
            return

        # Папка ассетов сессии
        session_id = uuid.uuid4().hex[:8]
        session_dir = ASSETS_DIR / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        for name, data_url in maps.items():
            if not isinstance(data_url, str) or "," not in data_url:
                self._json(400, {"error": f"bad map {name}: expected data URL"})
                return
            try:
                _, b64 = data_url.split(",", 1)
                data = base64.b64decode(b64)
            except Exception as e:  # noqa: BLE001
                self._json(400, {"error": f"bad base64 for {name}: {e}"})
                return
            (session_dir / f"{name}.png").write_bytes(data)

        config = payload.get("config") or {}
        ms_script = build_apply_script(session_dir, config)

        # Пишем атомарно: сначала .ms, потом .trigger (watcher слушает .trigger).
        QUEUE_DIR.mkdir(parents=True, exist_ok=True)
        stem = f"{int(time.time() * 1000)}_{session_id}"
        ms_path = QUEUE_DIR / f"{stem}.ms"
        trigger_path = QUEUE_DIR / f"{stem}.trigger"
        ms_path.write_text(ms_script, encoding="utf-8")
        trigger_path.write_text("go", encoding="utf-8")

        logging.info("queued session=%s assets=%s", session_id, session_dir)
        self._json(200, {
            "status": "queued",
            "session": session_id,
            "assets": _ms_path(session_dir),
            "ms": _ms_path(ms_path),
        })

    # ---- helpers ----
    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._set_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        logging.info("%s — %s", self.address_string(), fmt % args)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    logging.info("HeightmapGen Bridge v%s", VERSION)
    logging.info("listening on http://%s:%s", args.host, args.port)
    logging.info("queue:  %s", QUEUE_DIR)
    logging.info("assets: %s", ASSETS_DIR)

    if not TEMPLATE_PATH.exists():
        logging.error("template not found at %s", TEMPLATE_PATH)
        return 1

    srv = http.server.HTTPServer((args.host, args.port), BridgeHandler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        logging.info("stopping")
    finally:
        srv.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
