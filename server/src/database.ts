import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg, { type PoolClient, type QueryResultRow } from 'pg';
import { configuration } from './config.js';

@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool: pg.Pool;
  constructor() {
    const connectionString = configuration().database;
    if (!connectionString) throw new Error('DATABASE_URL is required');
    this.pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  }
  query<T extends QueryResultRow = any>(sql: string, values: unknown[] = []) {
    return this.pool.query<T>(sql, values);
  }
  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  async onModuleDestroy() { await this.pool.end(); }
}
