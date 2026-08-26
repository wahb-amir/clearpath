import { Redis, type RedisOptions } from "ioredis";
import { resolvedRedis } from "../config/env";

// `resolvedRedis` is either `{ url: string }` (REDIS_URL / Upstash case) or
// `{ host, port, password, db }` (granular fallback). Split the `url` out:
// ioredis's `RedisOptions` type has NO `url` field. Passing `{ url: "..." }`
// as the single constructor argument silently ignores it (verified: the
// client falls back to its own default `host: "localhost", port: 6379`)
// instead of throwing, so this was a silent misconfiguration rather than a
// crash. Every Node-side Redis client (queue producer, worker consumer,
// pub/sub) was, in practice, trying to reach a Redis on the container's own
// localhost -- which doesn't exist on a HF Space -- instead of the real
// Upstash/Redis Cloud instance in REDIS_URL. The URL must be passed as the
// FIRST POSITIONAL ARGUMENT (a string), which is the only form ioredis
// actually parses with `parseURL()`.
const { url: connectionUrl, ...hostOptions } = resolvedRedis as {
  url?: string;
} & Partial<RedisOptions>;

const sharedOptions: RedisOptions = {
  ...hostOptions,
  // Required by BullMQ – null means BullMQ manages retries itself.
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  // Don't let ioredis crash the process on startup if Redis is
  // unreachable. HF Spaces do not run a local Redis instance; the
  // connection will reconnect once the secrets are configured and
  // Upstash/Redis Cloud is reachable.
  // `lazyConnect: true` is safe here: the Queue/Worker constructors
  // register handlers and start the connection themselves – they don't
  // issue commands at module load. With lazy connect, a missing Redis
  // secret means the client sits dormant until the first command, at
  // which point the unhandledRejection guard in the entry point logs
  // the error instead of killing the process.
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 200, 5000),
  reconnectOnError: () => true,
};

function makeClient(): Redis {
  return connectionUrl
    ? new Redis(connectionUrl, sharedOptions)
    : new Redis(sharedOptions);
}

/** Shared connection for BullMQ Queue (producer side / dispatcher). */
export function createQueueConnection(): Redis {
  return makeClient();
}

/** Connection for BullMQ Worker (consumer side). */
export function createWorkerConnection(): Redis {
  return makeClient();
}

/** Connection used to PUBLISH pipeline notifications (worker side). */
export function createPublisherConnection(): Redis {
  return makeClient();
}

/**
 * Connection used to SUBSCRIBE to pipeline notifications (SSE side).
 * Each SSE connection should create its own subscriber and dispose it
 * on client disconnect.
 */
export function createSubscriberConnection(): Redis {
  return makeClient();
}

export const PIPELINE_NOTIFY_CHANNEL_PREFIX = "doc-pipeline:";

export function channelForDocument(documentId: string): string {
  return `${PIPELINE_NOTIFY_CHANNEL_PREFIX}${documentId}`;
}