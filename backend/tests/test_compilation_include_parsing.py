from app.compilation_service import CompilationService


class FakeLibraryManager:
    def is_header_available(self, header_name: str) -> bool:
        return False


def make_service() -> CompilationService:
    service = CompilationService.__new__(CompilationService)
    service.library_manager = FakeLibraryManager()
    return service


def test_parse_includes_ignores_c_standard_headers():
    service = make_service()

    libs = service._parse_includes(
        """
        #include <stdio.h>
        #include <stdlib.h>
        #include <string.h>
        #include <stdint.h>
        """
    )

    assert libs == []


def test_parse_includes_ignores_esp_system_headers():
    service = make_service()

    libs = service._parse_includes(
        """
        #include <freertos/FreeRTOS.h>
        #include <freertos/task.h>
        #include <driver/gpio.h>
        #include <esp_system.h>
        """
    )

    assert libs == []


def test_parse_includes_keeps_external_libraries_once():
    service = make_service()

    libs = service._parse_includes(
        """
        #include <PubSubClient.h>
        #include <PubSubClient.h>
        #include <ArduinoJson.h>
        """
    )

    assert libs == ["PubSubClient", "ArduinoJson"]
