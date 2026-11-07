"""
Board Configuration - Single Source of Truth

Centralized configuration for all supported development boards.
Built-in boards are hardcoded defaults. Admin can override or delete any board
via admin_boards.json (overrides + deleted list).
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict
from datetime import datetime, timezone
import json
import os as _os


@dataclass(frozen=True)
class BoardConfig:
    """Single board configuration entry"""
    board_id: str           # e.g., "arduino-uno", "esp32s3"
    name: str               # Display name, e.g., "Arduino Uno R3"
    fqbn: str               # Arduino CLI Fully Qualified Board Name
    description: str        # Chinese description
    platform: str           # "esp32", "esp8266", "arduino-avr"
    flashable: bool         # Can be flashed via Web Serial API
    bootloader_addr: Optional[int]  # Bootloader flash address (None for AVR)
    output_format: str      # "bin" for ESP, "hex" for AVR
    chip_family: str        # Grouping key: "esp32", "esp8266", "avr"
    upload_protocol: str = "esptool"  # "esptool", "stk500v1", "stk500v2", "avr109", "none"
    upload_speed: int = 115200
    reset_method: str = "dtr-rts"     # "dtr-rts", "touch-1200bps", "none"
    created_at: Optional[str] = None  # ISO format timestamp


def _board_to_dict(b: BoardConfig) -> dict:
    return {
        "board_id": b.board_id, "name": b.name, "fqbn": b.fqbn,
        "description": b.description, "platform": b.platform,
        "flashable": b.flashable, "bootloader_addr": b.bootloader_addr,
        "output_format": b.output_format, "chip_family": b.chip_family,
        "upload_protocol": b.upload_protocol, "upload_speed": b.upload_speed,
        "reset_method": b.reset_method,
        "created_at": b.created_at,
    }


def _normalise_board_dict(data: dict) -> dict:
    """Fill upload defaults for older admin board records."""
    item = dict(data)
    platform = item.get("platform", "")
    board_id = item.get("board_id", "")
    fqbn = item.get("fqbn", "")

    if "upload_protocol" not in item or not item.get("upload_protocol"):
        if platform in {"esp32", "esp8266"}:
            item["upload_protocol"] = "esptool"
        elif platform == "arduino-avr":
            if "mega" in board_id or fqbn.endswith(":mega"):
                item["upload_protocol"] = "stk500v2"
            elif "leonardo" in board_id or "micro" in board_id or fqbn.endswith(":leonardo") or fqbn.endswith(":micro"):
                item["upload_protocol"] = "avr109"
            else:
                item["upload_protocol"] = "stk500v1"
        else:
            item["upload_protocol"] = "none"

    if "upload_speed" not in item or not item.get("upload_speed"):
        if item["upload_protocol"] == "avr109":
            item["upload_speed"] = 57600
        elif item["upload_protocol"] == "stk500v2":
            item["upload_speed"] = 115200
        elif item["upload_protocol"] == "stk500v1" and ("nano" in board_id or fqbn.endswith(":nano")):
            item["upload_speed"] = 115200
        else:
            item["upload_speed"] = 115200

    if "reset_method" not in item or not item.get("reset_method"):
        if item.get("upload_protocol") == "avr109":
            item["reset_method"] = "touch-1200bps"
        else:
            item["reset_method"] = "dtr-rts" if item.get("upload_protocol") != "none" else "none"

    return item


# ─── Built-in Defaults ───────────────────────────────────────────────

ALL_BOARDS: List[BoardConfig] = [
    # ===== ESP32 系列（原始双核）===== 1-4
    BoardConfig(board_id="esp32", name="ESP32 Dev Module", fqbn="esp32:esp32:esp32", description="通用 ESP32 开发板（推荐）", platform="esp32", flashable=True, bootloader_addr=0x1000, output_format="bin", chip_family="esp32"),
    BoardConfig(board_id="esp32doit-devkit-v1", name="DOIT ESP32 DevKit v1", fqbn="esp32:esp32:esp32doit-devkit-v1", description="DOIT ESP32 DevKit v1", platform="esp32", flashable=True, bootloader_addr=0x1000, output_format="bin", chip_family="esp32"),
    BoardConfig(board_id="nodemcu-32s", name="NodeMCU-32S", fqbn="esp32:esp32:nodemcu-32s", description="NodeMCU-32S 开发板", platform="esp32", flashable=True, bootloader_addr=0x1000, output_format="bin", chip_family="esp32"),
    BoardConfig(board_id="esp32wrover", name="ESP32 Wrover Module", fqbn="esp32:esp32:esp32wrover", description="ESP32 Wrover（带 PSRAM）", platform="esp32", flashable=True, bootloader_addr=0x1000, output_format="bin", chip_family="esp32"),

    # ===== ESP32-S2 系列（单核）===== 5
    BoardConfig(board_id="esp32s2", name="ESP32-S2 Dev Module", fqbn="esp32:esp32:esp32s2:CDCOnBoot=cdc", description="ESP32-S2 开发模块（单核，USB OTG）", platform="esp32", flashable=True, bootloader_addr=0x1000, output_format="bin", chip_family="esp32-s2"),

    # ===== ESP32-S3 系列（双核，AI）===== 6-7
    BoardConfig(board_id="esp32s3", name="ESP32-S3 Dev Module", fqbn="esp32:esp32:esp32s3:CDCOnBoot=cdc", description="ESP32-S3 开发模块（双核，AI 加速）", platform="esp32", flashable=True, bootloader_addr=0x0, output_format="bin", chip_family="esp32-s3"),
    BoardConfig(board_id="esp32s3camlcd", name="ESP32-S3 CAM LCD", fqbn="esp32:esp32:esp32s3camlcd", description="ESP32-S3 CAM LCD 开发板", platform="esp32", flashable=True, bootloader_addr=0x0, output_format="bin", chip_family="esp32-s3"),

    # ===== ESP32-C3 系列（RISC-V）===== 8
    BoardConfig(board_id="esp32c3", name="ESP32-C3 Dev Module", fqbn="esp32:esp32:esp32c3:CDCOnBoot=cdc", description="ESP32-C3 开发模块（RISC-V 单核）", platform="esp32", flashable=True, bootloader_addr=0x0, output_format="bin", chip_family="esp32-c3"),

    # ===== ESP32-C6 系列（WiFi 6）===== 9
    BoardConfig(board_id="esp32c6", name="ESP32-C6 Dev Module", fqbn="esp32:esp32:esp32c6:CDCOnBoot=cdc", description="ESP32-C6 开发模块（WiFi 6 支持）", platform="esp32", flashable=True, bootloader_addr=0x0, output_format="bin", chip_family="esp32-c6"),

    # ===== ESP32-H2 系列（Zigbee/Thread）===== 10
    BoardConfig(board_id="esp32h2", name="ESP32-H2 Dev Module", fqbn="esp32:esp32:esp32h2:CDCOnBoot=cdc", description="ESP32-H2 开发模块（Zigbee/Thread）", platform="esp32", flashable=True, bootloader_addr=0x0, output_format="bin", chip_family="esp32-h2"),

    # ===== ESP8266 系列 ===== 11-14
    BoardConfig(board_id="esp8266-generic", name="ESP8266 Generic Module", fqbn="esp8266:esp8266:generic", description="通用 ESP8266 模块", platform="esp8266", flashable=True, bootloader_addr=0x1000, output_format="bin", chip_family="esp8266"),
    BoardConfig(board_id="esp8266-nodemcuv2", name="NodeMCU 1.0 (ESP-12E)", fqbn="esp8266:esp8266:nodemcuv2", description="NodeMCU 1.0 开发板", platform="esp8266", flashable=True, bootloader_addr=0x1000, output_format="bin", chip_family="esp8266"),
    BoardConfig(board_id="esp8266-d1-mini", name="WeMos D1 Mini", fqbn="esp8266:esp8266:d1_mini", description="WeMos D1 Mini 开发板", platform="esp8266", flashable=True, bootloader_addr=0x1000, output_format="bin", chip_family="esp8266"),
    BoardConfig(board_id="esp8266-d1-mini-pro", name="WeMos D1 Mini Pro", fqbn="esp8266:esp8266:d1_mini_pro", description="WeMos D1 Mini Pro 开发板", platform="esp8266", flashable=True, bootloader_addr=0x1000, output_format="bin", chip_family="esp8266"),

    # ===== Arduino AVR 系列 ===== 15-17
    BoardConfig(board_id="arduino-uno", name="Arduino Uno R3", fqbn="arduino:avr:uno", description="Arduino Uno R3 (ATmega328P, 16MHz, 2KB SRAM, 32KB Flash)", platform="arduino-avr", flashable=True, bootloader_addr=None, output_format="hex", chip_family="avr", upload_protocol="stk500v1", upload_speed=115200, reset_method="dtr-rts"),
    BoardConfig(board_id="arduino-mega", name="Arduino Mega 2560", fqbn="arduino:avr:mega", description="Arduino Mega 2560 (ATmega2560, 16MHz, 8KB SRAM, 256KB Flash)", platform="arduino-avr", flashable=True, bootloader_addr=None, output_format="hex", chip_family="avr", upload_protocol="stk500v2", upload_speed=115200, reset_method="dtr-rts"),
    BoardConfig(board_id="arduino-nano", name="Arduino Nano", fqbn="arduino:avr:nano", description="Arduino Nano (ATmega328P, 16MHz, 2KB SRAM, 32KB Flash)", platform="arduino-avr", flashable=True, bootloader_addr=None, output_format="hex", chip_family="avr", upload_protocol="stk500v1", upload_speed=115200, reset_method="dtr-rts"),
    BoardConfig(board_id="arduino-leonardo", name="Arduino Leonardo", fqbn="arduino:avr:leonardo", description="Arduino Leonardo (ATmega32u4, USB 原生串口)", platform="arduino-avr", flashable=True, bootloader_addr=None, output_format="hex", chip_family="avr", upload_protocol="avr109", upload_speed=57600, reset_method="touch-1200bps"),
    BoardConfig(board_id="arduino-micro", name="Arduino Micro", fqbn="arduino:avr:micro", description="Arduino Micro (ATmega32u4, USB 原生串口)", platform="arduino-avr", flashable=True, bootloader_addr=None, output_format="hex", chip_family="avr", upload_protocol="avr109", upload_speed=57600, reset_method="touch-1200bps"),
]

BUILTIN_BY_ID: Dict[str, BoardConfig] = {b.board_id: b for b in ALL_BOARDS}


# ─── Admin Overrides & Deletions ─────────────────────────────────────

_ADMIN_BOARDS_FILE = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "admin_boards.json")


def _load_admin_state() -> dict:
    """加载管理员对开发板的修改状态"""
    if not _os.path.exists(_ADMIN_BOARDS_FILE):
        return {"overrides": {}, "deleted": []}
    try:
        with open(_ADMIN_BOARDS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {"overrides": {}, "deleted": []}


def _save_admin_state(state: dict) -> None:
    with open(_ADMIN_BOARDS_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def get_all_boards() -> List[BoardConfig]:
    """获取合并后的所有开发板（内置 + 管理员修改 - 已删除）"""
    state = _load_admin_state()
    overrides: dict = state.get("overrides", {})
    deleted: list = state.get("deleted", [])
    custom_order: list = state.get("order", [])

    result = []
    seen_ids = set()

    # 先处理内置板：应用覆盖或跳过已删除
    for b in ALL_BOARDS:
        if b.board_id in deleted:
            continue
        if b.board_id in overrides:
            o = _normalise_board_dict(overrides[b.board_id])
            result.append(BoardConfig(**o))
        else:
            result.append(b)
        seen_ids.add(b.board_id)

    # 再追加管理员新增的板子（不在内置列表中的）
    for bid, o in overrides.items():
        if bid not in seen_ids:
            result.append(BoardConfig(**_normalise_board_dict(o)))
            seen_ids.add(bid)

    # 按自定义顺序排序（order 列表中的 id 按列表顺序排前面，不在列表中的排后面）
    if custom_order:
        order_map = {bid: idx for idx, bid in enumerate(custom_order)}
        result.sort(key=lambda b: order_map.get(b.board_id, 999999))

    return result


def save_board_order(ordered_ids: List[str]) -> None:
    """保存开发板的自定义排序"""
    state = _load_admin_state()
    # 验证所有 id 都是有效板子
    all_ids = {b.board_id for b in get_all_boards()}
    valid_ids = [bid for bid in ordered_ids if bid in all_ids]
    state["order"] = valid_ids
    _save_admin_state(state)


def get_boards_by_id() -> Dict[str, BoardConfig]:
    return {b.board_id: b for b in get_all_boards()}


def save_board(board: BoardConfig) -> None:
    """保存/覆盖一个开发板配置"""
    state = _load_admin_state()
    # 如果是新板子，添加创建时间
    board_dict = _board_to_dict(board)
    if board.board_id not in state.get("overrides", {}):
        board_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    else:
        # 保留原有的创建时间
        existing = state["overrides"][board.board_id]
        board_dict["created_at"] = existing.get("created_at") or datetime.now(timezone.utc).isoformat()
    state["overrides"][board.board_id] = board_dict
    # 如果之前在删除列表中，移除
    if board.board_id in state.get("deleted", []):
        state["deleted"].remove(board.board_id)
    _save_admin_state(state)


def delete_board(board_id: str) -> bool:
    """删除开发板（内置板加入已删除列表，自定义板从覆盖列表移除）"""
    state = _load_admin_state()
    is_builtin = board_id in BUILTIN_BY_ID

    if is_builtin:
        if board_id in state.get("deleted", []):
            return False
        state.setdefault("deleted", []).append(board_id)
        state["overrides"].pop(board_id, None)
    else:
        if board_id not in state.get("overrides", {}):
            return False
        state["overrides"].pop(board_id, None)
        if board_id in state.get("deleted", []):
            state["deleted"].remove(board_id)

    _save_admin_state(state)
    return True


def reset_board(board_id: str) -> bool:
    """将开发板恢复为内置默认配置（移除覆盖和删除标记）"""
    state = _load_admin_state()
    changed = False
    if board_id in state.get("overrides", {}):
        state["overrides"].pop(board_id, None)
        changed = True
    if board_id in state.get("deleted", []):
        state["deleted"].remove(board_id)
        changed = True
    if changed:
        _save_admin_state(state)
    return changed


def is_overridden(board_id: str) -> bool:
    """判断开发板是否被管理员修改过"""
    state = _load_admin_state()
    return board_id in state.get("overrides", {})


def is_builtin_board(board_id: str) -> bool:
    return board_id in BUILTIN_BY_ID
