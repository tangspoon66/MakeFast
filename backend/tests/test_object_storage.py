import pytest

from app.object_storage import ObjectStorage, ObjectStorageConfig


def test_object_storage_disabled_allows_empty_config():
    storage = ObjectStorage(ObjectStorageConfig(enabled=False))
    assert storage.enabled is False


def test_object_storage_enabled_requires_required_fields():
    with pytest.raises(ValueError) as exc:
        ObjectStorage(ObjectStorageConfig(enabled=True, bucket="bucket"))

    assert "OBJECT_STORAGE_ENDPOINT" in str(exc.value)


def test_object_storage_public_url_with_prefix():
    config = ObjectStorageConfig(
        enabled=True,
        bucket="bucket",
        endpoint_url="https://s3.example.com",
        access_key_id="key",
        secret_access_key="secret",
        public_base_url="https://assets.example.com",
        prefix="makefast",
    )
    storage = ObjectStorage(config)

    assert storage._key("courses/a.zip") == "makefast/courses/a.zip"
    assert storage.public_url("makefast/courses/a.zip") == "https://assets.example.com/makefast/courses/a.zip"


def test_object_storage_rejects_parent_path_segment():
    storage = ObjectStorage(
        ObjectStorageConfig(
            enabled=True,
            bucket="bucket",
            endpoint_url="https://s3.example.com",
            access_key_id="key",
            secret_access_key="secret",
        )
    )

    with pytest.raises(ValueError):
        storage._key("../secret")
