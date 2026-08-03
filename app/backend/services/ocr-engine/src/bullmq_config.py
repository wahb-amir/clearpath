from typing import Any

from config import settings


def get_bullmq_queue_name() -> str:
    return settings.BULLMQ_QUEUE_NAME


def get_bullmq_job_name() -> str | None:
    return settings.BULLMQ_JOB_NAME


def get_redis_connection_config() -> str | dict[str, Any]:
    if settings.REDIS_URL:
        return str(settings.REDIS_URL)

    return {
        "host": settings.REDIS_HOST,
        "port": settings.REDIS_PORT,
        "password": settings.REDIS_PASSWORD,
        "db": settings.REDIS_DB,
        "maxRetriesPerRequest": None,
    }


def get_worker_options() -> dict[str, Any]:
    return {
        "connection": get_redis_connection_config(),
        "concurrency": settings.BULLMQ_CONCURRENCY,
    }


def should_process_job(job_name: str | None, expected_job_name: str | None) -> bool:
    if not expected_job_name:
        return True
    return job_name == expected_job_name
