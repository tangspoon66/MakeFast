"""Compile queue configuration."""

import os


def get_compile_concurrency() -> int:
    return max(1, int(os.getenv("COMPILE_CONCURRENCY", "1")))


def get_compile_queue_timeout() -> float:
    return max(0.1, float(os.getenv("COMPILE_QUEUE_TIMEOUT_SECONDS", "2")))
