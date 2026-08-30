from typing import Any

from config import settings


class NotMyJobError(Exception):
    """Raised when this worker dequeues a job name it doesn't own.

    This queue is shared with the Node backend's worker (see
    `workers/run.ts`); both sides are competing consumers. Raising
    (instead of quietly returning a 'skipped' result) keeps the job in
    a retryable state in BullMQ so its actual owner gets a chance to
    claim it, rather than the job being marked complete with no work
    done.
    """


def get_bullmq_queue_name() -> str:
    return settings.BULLMQ_QUEUE_NAME


def get_bullmq_job_name() -> str:
    return settings.BULLMQ_JOB_NAME


import socket

from urllib.parse import urlparse

def get_redis_connection_config() -> dict[str, Any]:
    host = settings.REDIS_HOST
    port = settings.REDIS_PORT
    password = settings.REDIS_PASSWORD
    is_tls = settings.REDIS_TLS

    if settings.REDIS_URL:
        parsed = urlparse(str(settings.REDIS_URL))
        host = parsed.hostname or host
        port = parsed.port or port
        password = parsed.password or password
        if parsed.scheme == "rediss":
            is_tls = True

    config: dict[str, Any] = {
        "host": host,
        "port": port,
        "username": settings.REDIS_USERNAME,
        "password": password,
        "db": settings.REDIS_DB,
        "socket_type": socket.AF_INET,
    }

    if is_tls:
        config["ssl"] = True
        config["ssl_cert_reqs"] = "none"

    return config


def get_worker_options() -> dict[str, Any]:
    return {
        "connection": get_redis_connection_config(),
        "concurrency": settings.BULLMQ_CONCURRENCY,
        # Seconds between idle polls. See Settings.BULLMQ_DRAIN_DELAY_SECONDS
        # for the rationale (default 30 vs library default 5).
        "drainDelay": settings.BULLMQ_DRAIN_DELAY_SECONDS,
    }


def assert_should_process_job(job_name: str | None, expected_job_name: str) -> None:
    """Raises NotMyJobError if this job doesn't belong to this worker."""
    if job_name != expected_job_name:
        raise NotMyJobError(
            f"job name '{job_name}' does not match this worker's job name "
            f"'{expected_job_name}' - leaving it for its owner"
        )
