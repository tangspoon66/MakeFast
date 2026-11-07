#!/usr/bin/env bash
# 一键启动本地开发：后端 :8000 + 前端 :5173（Ctrl+C 一起停止）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="${PYTHON:-python3}"
cd "$ROOT/backend"
"$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "${BACKEND_PORT:-8000}" --reload &
BACK=$!
trap 'kill $BACK 2>/dev/null || true' EXIT INT TERM
cd "$ROOT/frontend"
[ -d node_modules ] || npm install
npm run dev -- --host 127.0.0.1 --port "${FRONTEND_PORT:-5173}"
