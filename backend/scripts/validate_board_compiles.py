#!/usr/bin/env python3
"""Compile a minimal sketch for every enabled board configuration."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.board_config import get_all_boards
from app.toolchain_manager import build_arduino_env, ensure_required_platforms

SKETCH = """void setup() {
  Serial.begin(115200);
}

void loop() {
  delay(1000);
}
"""


def compile_board(board, timeout: int) -> tuple[bool, str]:
    temp_root = Path(tempfile.mkdtemp(prefix=f"board-{board.board_id}-"))
    try:
        sketch_dir = temp_root / "sketch"
        sketch_dir.mkdir(parents=True)
        (sketch_dir / "sketch.ino").write_text(SKETCH, encoding="utf-8")
        cmd = [
            "arduino-cli",
            "compile",
            "--fqbn",
            board.fqbn,
            "--output-dir",
            str(sketch_dir / "build"),
            str(sketch_dir),
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=build_arduino_env(),
        )
        output = "\n".join(part for part in [result.stdout, result.stderr] if part).strip()
        return result.returncode == 0, output
    except subprocess.TimeoutExpired as exc:
        return False, f"Timed out after {timeout}s\n{exc.stderr or ''}"
    finally:
        shutil.rmtree(temp_root, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--skip-ensure", action="store_true")
    parser.add_argument("--board-id", action="append", dest="board_ids")
    args = parser.parse_args()

    if not args.skip_ensure:
        ensure_required_platforms()

    boards = get_all_boards()
    if args.board_ids:
        wanted = set(args.board_ids)
        boards = [board for board in boards if board.board_id in wanted]

    failures = []
    for board in boards:
        ok, output = compile_board(board, args.timeout)
        status = "PASS" if ok else "FAIL"
        print(f"{status}\t{board.board_id}\t{board.name}\t{board.fqbn}", flush=True)
        if not ok:
            failures.append((board, output))
            tail = "\n".join(output.splitlines()[-20:])
            print(tail, flush=True)

    if failures:
        print(f"\n{len(failures)} board compile checks failed.", file=sys.stderr)
        return 1

    print(f"\nAll {len(boards)} board compile checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
