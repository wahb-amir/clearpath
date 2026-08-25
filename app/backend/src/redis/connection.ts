import { Redis, type RedisOptions } from "ioredis";
import { resolvedRedis } from "../config/env";



const baseOptions: RedisOptions = {
  ...(resolvedRedis as any),
  // Required by BullMQ
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  // Don't spam the logs / exit on startup if Redis is unreachable
  // (HF Spaces do not run a local Redis instance).
  lazyConnect: true,
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