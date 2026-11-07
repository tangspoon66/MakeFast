"""S3-compatible object storage adapter."""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class ObjectStorageConfig:
    enabled: bool
    bucket: str = ""
    endpoint_url: str = ""
    region: str = "auto"
    access_key_id: str = ""
    secret_access_key: str = ""
    public_base_url: str = ""
    prefix: str = ""

    @classmethod
    def from_env(cls) -> "ObjectStorageConfig":
        enabled = os.getenv("OBJECT_STORAGE_ENABLED", "false").lower() == "true"
        return cls(
            enabled=enabled,
            bucket=os.getenv("OBJECT_STORAGE_BUCKET", ""),
            endpoint_url=os.getenv("OBJECT_STORAGE_ENDPOINT", ""),
            region=os.getenv("OBJECT_STORAGE_REGION", "auto"),
            access_key_id=os.getenv("OBJECT_STORAGE_ACCESS_KEY_ID", ""),
            secret_access_key=os.getenv("OBJECT_STORAGE_SECRET_ACCESS_KEY", ""),
            public_base_url=os.getenv("OBJECT_STORAGE_PUBLIC_BASE_URL", "").rstrip("/"),
            prefix=os.getenv("OBJECT_STORAGE_PREFIX", "").strip("/"),
        )

    def validate(self) -> None:
        if not self.enabled:
            return
        missing = [
            name for name, value in {
                "OBJECT_STORAGE_BUCKET": self.bucket,
                "OBJECT_STORAGE_ENDPOINT": self.endpoint_url,
                "OBJECT_STORAGE_ACCESS_KEY_ID": self.access_key_id,
                "OBJECT_STORAGE_SECRET_ACCESS_KEY": self.secret_access_key,
            }.items()
            if not value
        ]
        if missing:
            raise ValueError(f"对象存储配置缺失: {', '.join(missing)}")


class ObjectStorage:
    """Thin wrapper around S3-compatible object storage."""

    def __init__(self, config: Optional[ObjectStorageConfig] = None):
        self.config = config or ObjectStorageConfig.from_env()
        self.config.validate()
        self._client = None

    @property
    def enabled(self) -> bool:
        return self.config.enabled

    def _key(self, key: str) -> str:
        clean_key = key.strip("/")
        if ".." in clean_key.split("/"):
            raise ValueError("对象存储 key 不合法")
        return f"{self.config.prefix}/{clean_key}" if self.config.prefix else clean_key

    def _get_client(self):
        if self._client is None:
            import boto3
            self._client = boto3.client(
                "s3",
                endpoint_url=self.config.endpoint_url,
                region_name=self.config.region,
                aws_access_key_id=self.config.access_key_id,
                aws_secret_access_key=self.config.secret_access_key,
            )
        return self._client

    def upload_file(self, local_path: Path, key: str, content_type: Optional[str] = None) -> str:
        if not self.enabled:
            raise RuntimeError("对象存储未启用")
        object_key = self._key(key)
        extra_args = {"ContentType": content_type} if content_type else None
        if extra_args:
            self._get_client().upload_file(str(local_path), self.config.bucket, object_key, ExtraArgs=extra_args)
        else:
            self._get_client().upload_file(str(local_path), self.config.bucket, object_key)
        return self.public_url(object_key)

    def public_url(self, key: str) -> str:
        object_key = key.strip("/")
        if self.config.public_base_url:
            return f"{self.config.public_base_url}/{object_key}"
        return f"{self.config.endpoint_url.rstrip('/')}/{self.config.bucket}/{object_key}"


object_storage = ObjectStorage()
