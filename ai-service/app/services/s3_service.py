import os

import boto3
from botocore.config import Config


class S3Service:
    def __init__(self) -> None:
        from app.config import settings

        kwargs: dict = {
            "region_name": settings.aws_region,
            "config": Config(read_timeout=60, connect_timeout=10)
        }
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            kwargs["aws_access_key_id"] = settings.aws_access_key_id
            kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        self._client = boto3.client("s3", **kwargs)

    def download_file_bytes(self, s3_key: str) -> bytes:
        from app.config import settings

        if settings.local_storage and settings.local_storage_path:
            file_path = os.path.join(settings.local_storage_path, s3_key)
            if os.path.exists(file_path):
                with open(file_path, "rb") as file_handle:
                    return file_handle.read()
            raise FileNotFoundError(f"Local file not found: {file_path}")

        response = self._client.get_object(Bucket=settings.aws_s3_bucket, Key=s3_key)
        return response["Body"].read()

    def upload_text_object(
        self, s3_key: str, body: str, content_type: str = "application/xml"
    ) -> None:
        from app.config import settings

        if settings.local_storage and settings.local_storage_path:
            file_path = os.path.join(settings.local_storage_path, s3_key)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as file_handle:
                file_handle.write(body)
            return

        self._client.put_object(
            Bucket=settings.aws_s3_bucket,
            Key=s3_key,
            Body=body,
            ContentType=content_type
        )
