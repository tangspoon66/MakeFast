"""Arduino CLI toolchain checks used by build and runtime startup."""

from __future__ import annotations

import logging
import os
import subprocess
from pathlib import Path
from typing import Iterable

from .board_config import get_all_boards

logger = logging.getLogger(__name__)

ESP32_INDEX_URL = "https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json"
ESP8266_INDEX_URL = "https://arduino.esp8266.com/stable/package_esp8266com_index.json"

PLATFORM_INDEX_URLS = {
    "esp32:esp32": ESP32_INDEX_URL,
    "esp8266:esp8266": ESP8266_INDEX_URL,
}


def build_arduino_env() -> dict[str, str]:
    """Return an Arduino CLI environment that respects the runtime volume."""
    env = os.environ.copy()
    data_dir = env.get("ARDUINO_DATA_DIR", "/opt/libraries/arduino15")
    user_dir = env.get("ARDUINO_LIBRARIES_DIR", "/opt/libraries/arduino")
    config_dir = str(Path(data_dir) / "config")

    env["ARDUINO_DATA_DIR"] = data_dir
    env["ARDUINO_DIRECTORIES_DATA"] = data_dir
    env["ARDUINO_DIRECTORIES_USER"] = user_dir
    env.setdefault("ARDUINO_CLI_CONFIG_DIR", config_dir)
    env.setdefault("XDG_CONFIG_HOME", config_dir)

    Path(data_dir).mkdir(parents=True, exist_ok=True)
    Path(user_dir).mkdir(parents=True, exist_ok=True)
    Path(config_dir).mkdir(parents=True, exist_ok=True)
    return env


def required_platforms() -> list[str]:
    """Return Arduino core platforms required by currently enabled boards."""
    platforms = sorted({":".join(board.fqbn.split(":")[:2]) for board in get_all_boards()})
    return [platform for platform in platforms if platform.count(":") == 1]


def _run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    logger.info("Running Arduino toolchain command: %s", " ".join(cmd))
    return subprocess.run(
        cmd,
        check=check,
        capture_output=True,
        text=True,
        env=build_arduino_env(),
    )


def installed_platforms() -> set[str]:
    result = _run(["arduino-cli", "core", "list"], check=False)
    if result.returncode != 0:
        logger.warning("Unable to list Arduino cores: %s", result.stderr.strip())
        return set()

    installed: set[str] = set()
    for line in result.stdout.splitlines():
        first = line.split(maxsplit=1)[0] if line.strip() else ""
        if ":" in first and first != "ID":
            installed.add(first)
    return installed


def ensure_board_manager_indexes(platforms: Iterable[str]) -> None:
    """Ensure package index URLs are configured for third-party cores."""
    _run(["arduino-cli", "config", "init"], check=False)
    for platform in platforms:
        url = PLATFORM_INDEX_URLS.get(platform)
        if not url:
            continue
        _run(["arduino-cli", "config", "add", "board_manager.additional_urls", url], check=False)


def ensure_required_platforms() -> list[str]:
    """Install missing Arduino platforms for the boards exposed by the app."""
    if os.getenv("SKIP_TOOLCHAIN_ENSURE", "").lower() in {"1", "true", "yes"}:
        logger.info("Skipping Arduino toolchain ensure because SKIP_TOOLCHAIN_ENSURE is set")
        return []

    platforms = required_platforms()
    ensure_board_manager_indexes(platforms)

    installed = installed_platforms()
    missing = [platform for platform in platforms if platform not in installed]
    if not missing:
        logger.info("Arduino toolchain ready. Installed platforms: %s", ", ".join(sorted(installed)))
        return []

    logger.warning("Missing Arduino platforms: %s", ", ".join(missing))
    _run(["arduino-cli", "core", "update-index"])
    for platform in missing:
        _run(["arduino-cli", "core", "install", platform])

    logger.info("Installed missing Arduino platforms: %s", ", ".join(missing))
    return missing
