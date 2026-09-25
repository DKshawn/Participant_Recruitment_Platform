import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Database } from './database.js';
import { configuration } from './config.js';

export async function seed(db:Database) {
  if(configuration().production || !configuration().devAuth) throw new Error('Seed is restricted to local development with ALLOW_DEV_AUTH=true');
  return db.transaction(async client => {
    const users:Record<string,string>={};
    for (const [subject,role,name] of [['student','student','测试参与者'],['researcher','researcher','测试研究者']]) {
      const row=(await client.query(`INSERT INTO users(id,issuer,subject,email,name,role) VALUES($1,'local-development',$2,$3,$4,$5)
        ON CONFLICT(issuer,subject) DO UPDATE SET subject=EXCLUDED.subject RETURNING id`,[randomUUID(),subject,`${subject}@example.invalid`,JSON.stringify({zh:name,en:subject==='student'?'Test participant':'Test researcher',ja:subject==='student'?'テスト参加者':'テスト研究者'}),role])).rows[0];
      users[subject]=row.id;
    }
    const exp=(await client.query(`INSERT INTO experiments(id,owner_id,code,title,description,location_type,location_detail,reward_points,duration_minutes,min_reputation_required,capacity)
      VALUES($1,$2,'LOCAL-DEMO-001',$3,$4,'online','https://example.org/study',2000,30,0,20)
      ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING id`,[randomUUID(),users.researcher,JSON.stringify({zh:'本地后端演示实验',en:'Local backend demo study',ja:'ローカル実験デモ'}),JSON.stringify({zh:'报名后由研究者确认完成，积分会真实写入本地数据库。',en:'Enroll and let the researcher complete the study to credit your local wallet.',ja:'参加後、研究者が完了を確認するとポイントが記録されます。'})])).rows[0];
    return {student:users.student!,researcher:users.researcher!,experiment:exp.id as string};
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const db=new Database();
  try {console.log(await seed(db));} finally {await db.onModuleDestroy();}
}
