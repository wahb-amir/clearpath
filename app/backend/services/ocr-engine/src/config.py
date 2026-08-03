# config.py
import os
from pydantic import Field, HttpUrl, RedisDsn
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
    REDIS_PASSWORD: str | None = Field(default=None)
    REDIS_DB: int = Field(default=0, ge=0)

    # Supabase Configuration
    SUPABASE_URL: HttpUrl
    SUPABASE_KEY: str = Field(
        ...,
        env="SUPABASE_SERVICE_ROLE_KEY",
        min_length=1,
        description="Service role key for Supabase administrative access",
    )

    # BullMQ Configuration
    BULLMQ_QUEUE_NAME: str = Field(
        default="clearpath-ai-analysis",
        env=["BULLMQ_QUEUE_NAME", "CLEARPATH_ANALYSIS_QUEUE_NAME"],
    )
    BULLMQ_JOB_NAME: str | None = Field(
        default=None,
        env=["BULLMQ_JOB_NAME", "extract-layout-and-ocr"],
    )
    BULLMQ_CONCURRENCY: int = Field(default=2, ge=1)

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