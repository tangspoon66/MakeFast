#!/usr/bin/env bash
# 端到端冒烟：隔离的临时数据目录 + 不读 .env（不调用真实大模型）+ 随机管理员密码（不落盘）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="${PYTHON:-python3}"
export E2E_DATA="$(mktemp -d -t mf-e2e)"
export APP_DATA_PATH="$E2E_DATA" MAKEFAST_SKIP_DOTENV=1 FIRMWARE_STORAGE_PATH="$E2E_DATA/fw" TEMPLATE_STORAGE_PATH="$E2E_DATA/tpl"
export JWT_SECRET_KEY="$("$PY" -c 'import secrets;print(secrets.token_hex(32))')"
export E2E_ADMIN_USER=e2eadmin
export E2E_ADMIN_PASSWORD="$("$PY" -c 'import secrets;print(secrets.token_urlsafe(16))')"
cd "$ROOT/backend"
MF_ADMIN_PASSWORD="$E2E_ADMIN_PASSWORD" "$PY" scripts/seed_console_admin.py "$E2E_ADMIN_USER" >/dev/null
"$PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 >"$E2E_DATA/backend.log" 2>&1 &
BACK=$!
trap 'kill $BACK 2>/dev/null || true; rm -rf "$E2E_DATA"' EXIT INT TERM
for i in $(seq 1 60); do curl -sf http://127.0.0.1:8000/ >/dev/null 2>&1 && break; sleep 0.5; done
curl -sf http://127.0.0.1:8000/ >/dev/null || { echo "后端没起来："; tail -20 "$E2E_DATA/backend.log"; exit 1; }
cd "$ROOT/frontend"
npx playwright test "$@"
