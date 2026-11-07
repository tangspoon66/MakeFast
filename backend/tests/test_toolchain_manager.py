from app.board_config import BoardConfig


def test_required_platforms_from_enabled_boards(monkeypatch):
    from app import toolchain_manager

    monkeypatch.setattr(
        toolchain_manager,
        "get_all_boards",
        lambda: [
            BoardConfig("esp32", "ESP32", "esp32:esp32:esp32", "", "esp32", True, 0x1000, "bin", "esp32"),
            BoardConfig("esp32c3", "ESP32-C3", "esp32:esp32:esp32c3:CDCOnBoot=cdc", "", "esp32", True, 0x0, "bin", "esp32-c3"),
            BoardConfig("d1", "D1", "esp8266:esp8266:d1_mini", "", "esp8266", True, 0x1000, "bin", "esp8266"),
            BoardConfig("uno", "Uno", "arduino:avr:uno", "", "arduino-avr", False, None, "hex", "avr"),
        ],
    )

    assert toolchain_manager.required_platforms() == [
        "arduino:avr",
        "esp32:esp32",
        "esp8266:esp8266",
    ]


def test_installed_platforms_parses_core_list(monkeypatch):
    from app import toolchain_manager

    class Result:
        returncode = 0
        stdout = """ID              Installed Latest Name
arduino:avr     1.8.8     1.8.8  Arduino AVR Boards
esp32:esp32     3.3.8     3.3.8  esp32
esp8266:esp8266 3.1.2     3.1.2  esp8266
"""
        stderr = ""

    monkeypatch.setattr(toolchain_manager, "_run", lambda *args, **kwargs: Result())

    assert toolchain_manager.installed_platforms() == {
        "arduino:avr",
        "esp32:esp32",
        "esp8266:esp8266",
    }
