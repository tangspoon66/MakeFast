"""SMTP email helpers for admin-managed notifications."""

import logging
import smtplib
from email.message import EmailMessage
from typing import Optional

from .service_config import load_service_config

logger = logging.getLogger(__name__)


def _email_config(config: Optional[dict] = None) -> dict:
    return (config or load_service_config()).get("email", {})


def send_email(to_email: str, subject: str, body: str, config: Optional[dict] = None) -> tuple[bool, str]:
    email = _email_config(config)
    if not email.get("enabled"):
        return False, "邮件服务未启用"
    if not to_email:
        return False, "收件邮箱为空"

    host = str(email.get("smtp_host") or "").strip()
    port = int(email.get("smtp_port") or 465)
    username = str(email.get("username") or "").strip()
    password = str(email.get("password") or "")
    from_email = str(email.get("from_email") or username).strip()
    from_name = str(email.get("from_name") or "MakeFast").strip()
    use_ssl = bool(email.get("use_ssl", True))
    use_tls = bool(email.get("use_tls", False))

    if not host or not from_email:
        return False, "邮件服务配置不完整"

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message.set_content(body)

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=15) as server:
                if username or password:
                    server.login(username, password)
                server.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                if use_tls:
                    server.starttls()
                if username or password:
                    server.login(username, password)
                server.send_message(message)
        return True, "邮件发送成功"
    except Exception as exc:
        logger.warning("Failed to send email notification: %s", exc)
        return False, f"邮件发送失败：{exc}"


def test_email_connection(config: dict) -> tuple[bool, str]:
    email = dict(config or {})
    if not email.get("enabled"):
        return True, "邮件服务未启用，配置已跳过连接测试"
    host = str(email.get("smtp_host") or "").strip()
    port = int(email.get("smtp_port") or 465)
    username = str(email.get("username") or "").strip()
    password = str(email.get("password") or "")
    use_ssl = bool(email.get("use_ssl", True))
    use_tls = bool(email.get("use_tls", False))
    if not host:
        return False, "请填写 SMTP 主机"
    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=15) as server:
                if username or password:
                    server.login(username, password)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                if use_tls:
                    server.starttls()
                if username or password:
                    server.login(username, password)
        return True, "邮件服务连接成功"
    except Exception as exc:
        return False, f"邮件服务连接失败：{exc}"
