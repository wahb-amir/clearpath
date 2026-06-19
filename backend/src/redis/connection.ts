import { Redis, type RedisOptions } from "ioredis";
import { env } from "../config/env";

/**
 * Redis configuration & connection factories.
 *
 * BullMQ requires `maxRetriesPerRequest: null` on its connections.
 * We keep separate connections for:
 *  - queue (producers / dispatcher)
 *  - worker (BullMQ worker - consumes jobs)
 *  - pubsub publisher (worker -> SSE notifications)
 *  - pubsub subscriber (SSE endpoint -> per-connection subscriber)
 *
 * ioredis connections are not safe to share between pub/sub mode and
 * normal command mode, so we always create dedicated connections.
 */

const baseOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB ?? 0,
  // Required by BullMQ
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
};

/** Shared connection for BullMQ Queue (producer side / dispatcher). */
export function createQueueConnection(): Redis {
  return new Redis(baseOptions);
}

/** Connection for BullMQ Worker (consumer side). */
export function createWorkerConnection(): Redis {
  return new Redis(baseOptions);
}

/** Connection used to PUBLISH pipeline notifications (worker side). */
export function createPublisherConnection(): Redis {
  return new Redis(baseOptions);
}

/**
 * Connection used to SUBSCRIBE to pipeline notifications (SSE side).
 * Each SSE connection should create its own subscriber and dispose it
 * on client disconnect.
 */
export function createSubscriberConnection(): Redis {
  return new Redis(baseOptions);
}

export const PIPELINE_NOTIFY_CHANNEL_PREFIX = "doc-pipeline:";

export function channelForDocument(documentId: string): string {
  return `${PIPELINE_NOTIFY_CHANNEL_PREFIX}${documentId}`;
}
