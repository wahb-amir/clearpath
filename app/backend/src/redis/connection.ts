import { Redis, type RedisOptions } from "ioredis";
import { env, resolvedRedis } from "../config/env";

const sharedOptions: RedisOptions = {
  host: resolvedRedis.host,
  port: Number(resolvedRedis.port),
  family: 4,
  username: env.REDIS_USERNAME || "app",
  password: resolvedRedis.password || undefined,

  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,

  retryStrategy: (times) => Math.min(times * 200, 5000),
  reconnectOnError: () => true,

  tls: {
    rejectUnauthorized: false,
    servername: resolvedRedis.host,
  },
};

function makeClient(): Redis {
  return new Redis(sharedOptions);
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

/** Connection used to SUBSCRIBE to pipeline notifications. */
export function createSubscriberConnection(): Redis {
  return makeClient();
}

export const PIPELINE_NOTIFY_CHANNEL_PREFIX = "doc-pipeline:";

export function channelForDocument(documentId: string): string {
  return `${PIPELINE_NOTIFY_CHANNEL_PREFIX}${documentId}`;
}