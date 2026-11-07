import subprocess

import pytest

from app.library_manager import LibraryDownloadError, LibraryManager


def test_parse_installed_libraries_json_preserves_spaces():
    output = """
    {
      "installed_libraries": [
        {"library": {"name": "DHT sensor library", "version": "1.4.6"}},
        {"library": {"name": "Adafruit GFX Library", "version": "1.12.6"}}
      ]
    }
    """

    libs = LibraryManager._parse_installed_libraries_json(output)

    assert libs["DHT sensor library"] == "1.4.6"
    assert libs["Adafruit GFX Library"] == "1.12.6"


def test_parse_installed_libraries_text_preserves_spaces():
    output = """
Name                 Installed Available Location
DHT sensor library   1.4.6     1.4.6     user
Adafruit GFX Library 1.12.6    1.12.6    user
    """

    libs = LibraryManager._parse_installed_libraries_text(output)

    assert libs["DHT sensor library"] == "1.4.6"
    assert libs["Adafruit GFX Library"] == "1.12.6"


def test_download_library_requires_post_install_verification(tmp_path, monkeypatch):
    manager = LibraryManager(cache_dir=str(tmp_path))
    manager._installed_libs_cache = {}

    monkeypatch.setattr(manager, "is_cached", lambda _name: False)
    monkeypatch.setattr(manager, "get_installed_library", lambda _name: None)

    def fake_run(*_args, **_kwargs):
        return subprocess.CompletedProcess(_args, 0, stdout="Installed", stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(LibraryDownloadError):
        manager.download_library("DHT sensor library")
