#!/usr/bin/env python3
"""Ensure runtime Arduino CLI platforms exist in the mounted data volume."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.toolchain_manager import ensure_required_platforms


if __name__ == "__main__":
    ensure_required_platforms()
