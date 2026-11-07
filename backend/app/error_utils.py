"""
通用错误处理工具

提供统一的错误信息清理函数，防止内部异常细节泄露到客户端响应中。
"""

import logging

logger = logging.getLogger(__name__)


def sanitize_error(error: Exception, default_msg: str = "服务器内部错误") -> str:
    """清理错误信息，避免泄露内部细节（文件路径、模块名等）"""
    logger.error(f"Internal error: {error}")
    return default_msg
