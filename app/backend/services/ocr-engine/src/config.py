# config.py
import os
from pydantic import AliasChoices, Field, HttpUrl, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application Settings Schema and Environment Validator."""

    # Threading Limits (coerced to int, with defaults)
    OMP_NUM_THREADS: int = Field(default=2, ge=1)
    OPENBLAS_NUM_THREADS: int = Field(default=2, ge=1)
    MKL_NUM_THREADS: int = Field(default=2, ge=1)

    # Redis Configuration
    REDIS_URL: RedisDsn | None = Field(default=None)
    REDIS_HOST: str = Field(default="127.0.0.1")
    REDIS_PORT: int = Field(default=6379, ge=1)
    REDIS_USERNAME: str = Field(default="app")
    REDIS_PASSWORD: str | None = Field(default=None)
    REDIS_DB: int = Field(default=0, ge=0)
    REDIS_TLS: bool = Field(default=True)

    # Supabase Configuration
    # Optional so the OCR worker can boot on a HF Space before the user
    # has configured Supabase secrets (matches the Node env.ts pattern).
    # Routes / jobs that actually need Supabase will surface a clear error
    # at request time instead of crashing the process at startup.
    SUPABASE_URL: HttpUrl | None = Field(default=None)
    # Accepts BOTH the Node-side env name (`SUPABASE_SECRET_KEY`) and the
    # historical name (`SUPABASE_SERVICE_ROLE_KEY`). The first non-empty
    # value wins, so this works whether the secret is set under either name.
    SUPABASE_KEY: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SUPABASE_SECRET_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
        ),
        min_length=1,
        description="Service role / secret key for Supabase administrative access",
    )

    # BullMQ Configuration
    # ISOLATED queue - must match the Node backend's OCR_QUEUE_NAME
    # (default "document-ocr"). This service is the ONLY consumer of
    # this queue; the Node worker never connects to it, so there's no
    # possibility of the two runtimes claiming each other's jobs.
    BULLMQ_QUEUE_NAME: str = Field(
        default="document-ocr",
        env=["BULLMQ_QUEUE_NAME", "OCR_QUEUE_NAME"],
    )
    BULLMQ_JOB_NAME: str = Field(
        default="extract-layout-and-ocr",
        env="BULLMQ_JOB_NAME",
    )
    BULLMQ_CONCURRENCY: int = Field(default=2, ge=1)
    # Seconds the BullMQ worker waits between BRPOP-style polls after the
    # queue empties. The library default is 5s, which costs ~17K Redis
    # commands/day purely from idle polling when nothing is in the queue.
    # 30s cuts that to ~2.9K/day with no perceptible pickup latency for a
    # user-initiated document-analysis pipeline (each OCR job itself takes
    # tens of seconds). Tune via env without redeploying code.
    BULLMQ_DRAIN_DELAY_SECONDS: int = Field(default=30, ge=1)

    # Storage buckets
    RAW_BUCKET: str = Field(
        default="documents",
        description="Bucket the Node backend uploads original files to.",
    )
    PARSED_BUCKET: str = Field(
        default="parsed-documents",
        description="Bucket this service uploads Docling markdown output to.",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def apply_thread_limits(self) -> None:
        """Sets OS environment variables for low-level C libraries (NumPy, SciPy, PyTorch)."""
        os.environ["OMP_NUM_THREADS"] = str(self.OMP_NUM_THREADS)
        os.environ["OPENBLAS_NUM_THREADS"] = str(self.OPENBLAS_NUM_THREADS)
        os.environ["MKL_NUM_THREADS"] = str(self.MKL_NUM_THREADS)


# Load settings and apply thread rules on startup
settings = Settings()
settings.apply_thread_limits()
