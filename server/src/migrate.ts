import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Database } from './database.js';

export async function migrate(db: Database) {
  const dir = fileURLToPath(new URL('../../migrations/', import.meta.url));
  await db.transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(7182341)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const name of (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort()) {
      const sql = await readFile(`${dir}/${name}`, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const prior = (await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name])).rows[0];
      if (prior && prior.checksum !== checksum) throw new Error(`Previously applied migration changed: ${name}`);
      if (!prior) {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
      }
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = new Database();
  try { await migrate(db); console.log('Database migrations applied.'); }
  finally { await db.onModuleDestroy(); }
}
