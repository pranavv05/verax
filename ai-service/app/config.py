import os


def _as_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.database_url = os.getenv("DATABASE_URL", "").strip()
        self.aws_region = os.getenv("AWS_REGION", "ap-south-1").strip()
        self.aws_s3_bucket = os.getenv("AWS_S3_BUCKET", "").strip()
        self.aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID", "").strip() or None
        self.aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip() or None
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o").strip()
        self.ai_write_back_enabled = _as_bool(os.getenv("AI_WRITE_BACK_ENABLED", "true"), True)
        self.ai_service_port = int(os.getenv("AI_SERVICE_PORT", "8001"))
        self.tesseract_cmd = os.getenv("TESSERACT_CMD", "").strip() or None
        self.textract_timeout_seconds = int(os.getenv("TEXTRACT_TIMEOUT_SECONDS", "60"))
        self.llm_timeout_seconds = int(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
        self.max_pdf_pages_for_fallback = int(os.getenv("MAX_PDF_PAGES_FOR_FALLBACK", "3"))

    def validate(self) -> None:
        required = {
            "DATABASE_URL": self.database_url,
            "AWS_S3_BUCKET": self.aws_s3_bucket,
            "OPENAI_API_KEY": self.openai_api_key
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            joined = ", ".join(missing)
            raise ValueError(f"Missing required environment variables: {joined}")


settings = Settings()
