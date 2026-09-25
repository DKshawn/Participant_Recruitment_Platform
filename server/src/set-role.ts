import { randomUUID } from 'node:crypto';
import { Database } from './database.js';
const [id,role]=process.argv.slice(2);
if(!/^[0-9a-f-]{36}$/i.test(id || '') || !['student','researcher'].includes(role)) throw new Error('Usage: npm run user:role -- <user UUID> student|researcher');
const db=new Database();
try {
  await db.transaction(async client => {
    const result=await client.query('UPDATE users SET role=$1 WHERE id=$2 RETURNING id',[role,id]);
    if(!result.rowCount) throw new Error('User not found');
    await client.query('DELETE FROM sessions WHERE user_id=$1',[id]);
    await client.query('INSERT INTO audit_logs(id,action,target_id,details) VALUES($1,$2,$3,$4)',[randomUUID(),'role.changed.by_operator',id,JSON.stringify({role})]);
  });
  console.log('Role updated; existing sessions revoked.');
} finally {await db.onModuleDestroy();}
