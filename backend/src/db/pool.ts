import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from '../config/env';

/**
 * Raw `pg` pool used for everything requiring transactions, row locking
 * (SELECT ... FOR UPDATE), and LISTEN/NOTIFY.
 *
 * The Supabase JS client (lib/supabase.ts) remains in use for Storage
 * operations only — it cannot provide transactional guarantees.
 */
export const pgPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pgPool.on('error', (err : unknown) => {
  // Idle client errors should not crash the process
  // eslint-disable-next-line no-console
  console.error('[pg pool] unexpected error on idle client', err);
});

/**
 * Run a callback inside a transaction. Commits on success, rolls back
 * on any thrown error, and always releases the client back to the pool.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors - original error is what matters
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Convenience wrapper for simple, non-transactional queries against
 * the pool directly.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  const result = await pgPool.query<T>(text, params);
  return { rows: result.rows, rowCount: result.rowCount ?? 0 };
}
