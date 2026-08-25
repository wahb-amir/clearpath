import { Redis, type RedisOptions } from "ioredis";
import { resolvedRedis } from "../config/env";



const baseOptions: RedisOptions = {
  ...(resolvedRedis as any),
  // Required by BullMQ – null means BullMQ manages retries itself.
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  // Don't let ioredis crash the process on startup if Redis is
  // unreachable. HF Spaces do not run a local Redis instance; the
  // connection will reconnect once the secrets are configured and
  // Upstash/Redis Cloud is reachable.
  // NOTE: `lazyConnect: true` is intentionally OFF here. BullMQ calls
  // `client.connect()` internally the moment a Queue/Worker is created,
  // so a lazy client would just be forcibly woken up – and any pending
  // command issued before that connect completed (e.g. from module
  // load) would fail with "Connection is closed.".
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 200, 5000),
  reconnectOnError: () => true,
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