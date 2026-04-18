import { QueryResult } from 'pg';
import pool from '@/lib/db';

export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result: QueryResult = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function dbQueryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await dbQuery<T>(sql, params);
  return rows[0] ?? null;
}

export async function dbTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
