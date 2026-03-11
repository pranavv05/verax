import boto3
from botocore.config import Config

from app.config import settings


class S3Service:
    def __init__(self) -> None:
        kwargs: dict = {
            "region_name": settings.aws_region,
            "config": Config(read_timeout=60, connect_timeout=10)
        }
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            kwargs["aws_access_key_id"] = settings.aws_access_key_id
            kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        self._client = boto3.client("s3", **kwargs)

    def download_file_bytes(self, s3_key: str) -> bytes:
        response = self._client.get_object(Bucket=settings.aws_s3_bucket, Key=s3_key)
        return response["Body"].read()
