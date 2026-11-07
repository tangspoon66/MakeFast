"""Seed / reset a LOCAL admin-console account (development only).

Usage:
  cd backend && python3 scripts/seed_console_admin.py <username>              # 生成随机密码，只打印一次
  cd backend && python3 scripts/seed_console_admin.py <username> --password-stdin   # 从标准输入读密码
  MF_ADMIN_PASSWORD=... python3 scripts/seed_console_admin.py <username>       # 从环境变量读密码

No default password is shipped. Re-running resets the password (role=admin, enabled).
"""
import argparse
import os
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from passlib.context import CryptContext  # noqa: E402

from app.admin_console.store import console_store  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description="创建或重置本地管理员后台账号")
    ap.add_argument("username")
    ap.add_argument("--password-stdin", action="store_true", help="从标准输入读取密码")
    args = ap.parse_args()

    generated = False
    if args.password_stdin:
        password = sys.stdin.readline().rstrip("\n")
    elif os.environ.get("MF_ADMIN_PASSWORD"):
        password = os.environ["MF_ADMIN_PASSWORD"]
    else:
        password = secrets.token_urlsafe(14)
        generated = True
    if len(password) < 10:
        print("密码至少 10 个字符", file=sys.stderr)
        return 2

    h = CryptContext(schemes=["bcrypt"], deprecated="auto").hash(password)
    if console_store.get_user(args.username):
        console_store.update_user(args.username, password_hash=h, role="admin", disabled=False)
        print(f"reset admin-console user '{args.username}' (role=admin)")
    else:
        console_store.create_user(args.username, h, "admin", "本地管理员")
        print(f"created admin-console user '{args.username}' (role=admin)")
    if generated:
        print(f"generated password (shown once, store it safely): {password}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
