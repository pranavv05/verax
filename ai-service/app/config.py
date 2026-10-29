import os
from dotenv import load_dotenv
load_dotenv()

def _as_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.database_url = os.getenv("DATABASE_URL", "").strip()
        # See backend/src/config/env.js's APP_DATABASE_URL comment: RLS only
        # isolates tenants when the connecting role isn't a Postgres
        # superuser. Prefer a least-privilege role (the `ca_app` role from
        # backend migration 20260825000000) for this service's writes too.
        self.app_database_url = os.getenv("APP_DATABASE_URL", "").strip() or self.database_url
        self.local_storage = _as_bool(os.getenv("LOCAL_STORAGE", "false"))
        self.local_storage_path = os.getenv("LOCAL_STORAGE_PATH", "").strip()
        self.aws_region = os.getenv("AWS_REGION", "ap-south-1").strip()
        self.aws_s3_bucket = os.getenv("AWS_S3_BUCKET", "").strip()
        self.aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID", "").strip() or None
        self.aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip() or None
        self.groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
        # Groq retires models without much notice (llama-3.1-70b, then
        # llama-3.3-70b-versatile), so the model is always overridable.
        self.groq_model = os.getenv("GROQ_MODEL", "").strip() or "openai/gpt-oss-120b"
        self.ai_service_api_key = os.getenv("AI_SERVICE_API_KEY", "").strip()
        self.ai_write_back_enabled = _as_bool(os.getenv("AI_WRITE_BACK_ENABLED", "true"), True)
        self.ai_service_port = int(os.getenv("AI_SERVICE_PORT", "8001"))
        self.tesseract_cmd = os.getenv("TESSERACT_CMD", "").strip() or None
        self.llm_timeout_seconds = int(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
        self.ocr_timeout_seconds = int(os.getenv("OCR_TIMEOUT_SECONDS", "120"))
        self.ocr_seconds_per_page = int(os.getenv("OCR_SECONDS_PER_PAGE", "10"))
        self.max_pdf_pages_for_fallback = int(os.getenv("MAX_PDF_PAGES_FOR_FALLBACK", "3"))
        self.max_tool_upload_mb = int(os.getenv("MAX_TOOL_UPLOAD_MB", "25"))

    def validate(self) -> None:
        # DATABASE_URL is always required — persistence_service writes extraction
        # results back to Postgres regardless of which file storage backend is used.
        required = {
            "DATABASE_URL": self.database_url,
            "GROQ_API_KEY": self.groq_api_key,
            "AI_SERVICE_API_KEY": self.ai_service_api_key,
        }
        if not self.local_storage:
            required["AWS_S3_BUCKET"] = self.aws_s3_bucket

        missing = [name for name, value in required.items() if not value]
        if missing:
            joined = ", ".join(missing)
            raise ValueError(f"Missing required environment variables: {joined}")


def groq_model_kwargs() -> dict:
    """Model name plus any model-specific options for chat.completions.create.

    gpt-oss models reason before answering; at the default effort they can spend
    the whole max_tokens budget reasoning and never emit the JSON.
    """
    kwargs: dict = {"model": settings.groq_model}
    if settings.groq_model.startswith("openai/gpt-oss"):
        kwargs["extra_body"] = {"reasoning_effort": "low"}
    return kwargs


settings = Settings()
