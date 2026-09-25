import { BadRequestException, Body, Controller, Get, Headers, Inject, Injectable, NotFoundException, ConflictException, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Database } from './database.js';
import { SessionGuard, researcher, student, publicUser, type AuthRequest, type UserRow } from './auth.js';
import { CreateExperimentDto, RatingDto, RedemptionDto, AddSessionsDto, EnrollDto } from './dto.js';
import { validateSessions } from './schedule.js';
import type { PoolClient } from 'pg';

function experiment(row: any, isResearcher: boolean) {
  return {
    id: row.id, code: row.code, title: row.title, description: row.description,
    required_items: row.required_items, tags: row.tags, tagsLocales: row.tags_locales,
    location_type: row.location_type, location_detail: row.location_detail,
    reward_points: row.reward_points, duration_minutes: row.duration_minutes,
    slots: { total: row.capacity, filled: Number(row.filled || 0) }, status: row.status,
    sessions: row.sessions || [],
    ...(isResearcher ? { min_reputation_required: row.min_reputation_required } : {}),
  };
}
const participation = (r: any) => ({ id:r.id, experimentId:r.experiment_id, experimentTitle:r.title, experimentName:r.title.zh || r.title.en || r.title.ja, reward:r.reward_points, status:r.status==='completed'?'已完成':'已报名', enrolledAt:r.created_at, completedAt:r.completed_at,
  session: r.session_id ? { id:r.session_id, starts_at:r.starts_at, ends_at:r.ends_at } : null });
function requestKey(key:string) {
  if(typeof key!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new BadRequestException('Idempotency-Key must be a UUID v4');
}

@Injectable()
export class PlatformService {
  constructor(@Inject(Database) private readonly db: Database) {}

  async listExperiments(user: UserRow) {
    const isResearcher = user.role === 'researcher';
    const rows = (await this.db.query(`SELECT e.*, (SELECT count(*) FROM enrollments n WHERE n.experiment_id=e.id) AS filled
      FROM experiments e WHERE ${isResearcher ? 'e.owner_id=$1' : "e.status='published' AND e.min_reputation_required <= (SELECT reputation FROM users WHERE id=$1)"}
      ORDER BY e.created_at DESC LIMIT 200`, [user.id])).rows;
    const sessions = (await this.db.query(`SELECT s.*, (SELECT count(*)::int FROM enrollments n WHERE n.session_id=s.id) AS filled
      FROM experiment_sessions s WHERE s.experiment_id=ANY($1::uuid[]) ORDER BY s.starts_at`, [rows.map(r => r.id)])).rows;
    return rows.map(r => experiment({ ...r, sessions: sessions.filter(s => s.experiment_id === r.id).map(({ experiment_id, ...session }) => session) }, isResearcher));
  }
  async create(user: UserRow, dto: CreateExperimentDto) {
    researcher(user);
    if (![dto.title, dto.description].every(v => v && Object.values(v).some(s => typeof s === 'string' && s.trim()))) throw new BadRequestException('Title and description need at least one language');
    if (Object.values(dto.title).some(v => typeof v === 'string' && v.length > 200)) throw new BadRequestException('Title too long');
    if (dto.location_type === 'online') {
      try { if (!['http:','https:'].includes(new URL(dto.location_detail).protocol)) throw new Error(); }
      catch { throw new BadRequestException('Online location must be an HTTP(S) URL'); }
    }
    validateSessions(dto.sessions, dto.duration_minutes, dto.capacity);
    return this.db.transaction(async client => {
    const id = randomUUID();
    const row = (await client.query(`INSERT INTO experiments(id,owner_id,code,title,description,required_items,tags,tags_locales,location_type,location_detail,reward_points,duration_minutes,min_reputation_required,capacity)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id,user.id,`EXP-${id.slice(0,8).toUpperCase()}`,JSON.stringify(dto.title),JSON.stringify(dto.description),JSON.stringify(dto.required_items),JSON.stringify(dto.tags),JSON.stringify(dto.tagsLocales),dto.location_type,dto.location_detail,dto.reward_points,dto.duration_minutes,dto.min_reputation_required,dto.capacity])).rows[0];
    const sessions = await this.insertSessions(client, id, dto.sessions);
    return experiment({ ...row, sessions }, true);
    });
  }
  private async insertSessions(client: PoolClient, id: string, sessions: AddSessionsDto['sessions']) {
    const rows = [];
    for (const session of sessions) {
      rows.push((await client.query(`INSERT INTO experiment_sessions(id,experiment_id,starts_at,ends_at,capacity) VALUES($1,$2,$3,$4,$5)
        RETURNING id,starts_at,ends_at,capacity,0 AS filled`, [randomUUID(),id,session.starts_at,session.ends_at,session.capacity])).rows[0]);
    }
    return rows.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
  }
  async addSessions(user: UserRow, id: string, dto: AddSessionsDto) {
    researcher(user);
    return this.db.transaction(async client => {
      const exp = (await client.query('SELECT * FROM experiments WHERE id=$1 AND owner_id=$2 FOR UPDATE', [id,user.id])).rows[0];
      if (!exp) throw new NotFoundException();
      if (exp.status !== 'published') throw new ConflictException('Recruitment is closed');
      const existing = (await client.query('SELECT starts_at,ends_at FROM experiment_sessions WHERE experiment_id=$1', [id])).rows;
      validateSessions(dto.sessions, exp.duration_minutes, exp.capacity, existing);
      return this.insertSessions(client, id, dto.sessions);
    });
  }
  async close(user: UserRow, id: string) {
    researcher(user);
    const result = await this.db.query("UPDATE experiments SET status='closed' WHERE id=$1 AND owner_id=$2 RETURNING id", [id,user.id]);
    if (!result.rowCount) throw new NotFoundException();
    return { ok:true };
  }
  async enroll(user: UserRow, id: string, dto: EnrollDto = {}) {
    student(user);
    return this.db.transaction(async client => {
      // All enrollment attempts for one experiment share this row lock.
      const exp = (await client.query('SELECT * FROM experiments WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!exp) throw new NotFoundException();
      const existing = (await client.query('SELECT id,session_id FROM enrollments WHERE experiment_id=$1 AND user_id=$2', [id,user.id])).rows[0];
      if (existing) {
        if ((existing.session_id || undefined) !== dto.session_id) throw new ConflictException('Already enrolled in a different session');
        return existing;
      }
      const current = (await client.query('SELECT reputation FROM users WHERE id=$1 FOR UPDATE', [user.id])).rows[0];
      if (exp.status !== 'published' || exp.min_reputation_required > current.reputation) throw new NotFoundException('Experiment unavailable');
      const count = Number((await client.query('SELECT count(*) AS count FROM enrollments WHERE experiment_id=$1', [id])).rows[0].count);
      if (count >= exp.capacity) throw new ConflictException('Experiment is full');
      const sessions = (await client.query('SELECT * FROM experiment_sessions WHERE experiment_id=$1', [id])).rows;
      if (sessions.length && !dto.session_id) throw new BadRequestException('Choose an experiment session');
      if (dto.session_id) {
        const session = sessions.find(s => s.id === dto.session_id);
        if (!session) throw new BadRequestException('Session does not belong to this experiment');
        if (session.starts_at.getTime() <= Date.now()) throw new ConflictException('Session has already started');
        const filled = (await client.query('SELECT count(*)::int AS count FROM enrollments WHERE session_id=$1', [dto.session_id])).rows[0].count;
        if (filled >= session.capacity) throw new ConflictException('Session is full');
      }
      return (await client.query('INSERT INTO enrollments(id,experiment_id,user_id,reward_points,session_id) VALUES($1,$2,$3,$4,$5) RETURNING id,session_id', [randomUUID(),id,user.id,exp.reward_points,dto.session_id || null])).rows[0];
    });
  }
  async profile(user: UserRow) {
    student(user);
    const current = (await this.db.query<UserRow>('SELECT * FROM users WHERE id=$1',[user.id])).rows[0];
    const rows = (await this.db.query('SELECT n.*,e.title,s.starts_at,s.ends_at FROM enrollments n JOIN experiments e ON e.id=n.experiment_id LEFT JOIN experiment_sessions s ON s.id=n.session_id WHERE n.user_id=$1 ORDER BY n.created_at DESC LIMIT 500', [user.id])).rows;
    return { ...publicUser(current), participations:rows.map(participation) };
  }
  async subjects(user: UserRow) {
    researcher(user);
    // Researchers can access only people who enrolled in their own studies.
    const users = (await this.db.query<UserRow>(`SELECT u.* FROM users u WHERE u.role='student' AND EXISTS
      (SELECT 1 FROM enrollments n JOIN experiments e ON n.experiment_id=e.id WHERE n.user_id=u.id AND e.owner_id=$1)
      ORDER BY u.created_at LIMIT 500`, [user.id])).rows;
    const rows = (await this.db.query('SELECT n.*,e.title,s.starts_at,s.ends_at FROM enrollments n JOIN experiments e ON e.id=n.experiment_id LEFT JOIN experiment_sessions s ON s.id=n.session_id WHERE e.owner_id=$1', [user.id])).rows;
    return users.map(u => ({ id:u.id,name:u.name,joinedAt:u.created_at,reputation:u.reputation,avgDuration:0,participations:rows.filter(n=>n.user_id===u.id).map(participation) }));
  }
  async rate(user: UserRow, id: string, dto: RatingDto, key: string) {
    researcher(user);
    requestKey(key);
    if (!dto.delta || dto.reason.trim().length < 5) throw new BadRequestException('Nonzero change and a reason are required');
    return this.db.transaction(async client => {
      const target = (await client.query("SELECT * FROM users WHERE id=$1 AND role='student' FOR UPDATE",[id])).rows[0];
      const allowed = (await client.query('SELECT 1 FROM enrollments n JOIN experiments e ON n.experiment_id=e.id WHERE n.user_id=$1 AND e.owner_id=$2 LIMIT 1',[id,user.id])).rowCount;
      if (!target || !allowed) throw new NotFoundException();
      const prior = (await client.query('SELECT * FROM reputation_logs WHERE operator_id=$1 AND request_key=$2',[user.id,key])).rows[0];
      if (prior) {
        if (prior.user_id!==id || prior.requested_delta!==dto.delta || prior.reason!==dto.reason.trim()) throw new ConflictException('Request key already used');
        return { before:prior.before_score, after:prior.after_score };
      }
      const after = Math.max(0,Math.min(100,target.reputation+dto.delta));
      await client.query('UPDATE users SET reputation=$1 WHERE id=$2',[after,id]);
      const log = randomUUID();
      await client.query('INSERT INTO reputation_logs(id,user_id,operator_id,request_key,requested_delta,delta,before_score,after_score,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[log,id,user.id,key,dto.delta,after-target.reputation,target.reputation,after,dto.reason.trim()]);
      await client.query('INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,$3,$4,$5)',[randomUUID(),user.id,'reputation.changed',id,JSON.stringify({logId:log})]);
      return { before:target.reputation, after };
    });
  }
  async enrollments(user: UserRow, id: string) {
    researcher(user);
    if (!(await this.db.query('SELECT id FROM experiments WHERE id=$1 AND owner_id=$2',[id,user.id])).rowCount) throw new NotFoundException();
    return (await this.db.query('SELECT n.id,n.user_id,n.status,n.reward_points,n.created_at,n.session_id,s.starts_at,s.ends_at,u.name FROM enrollments n JOIN users u ON n.user_id=u.id LEFT JOIN experiment_sessions s ON s.id=n.session_id WHERE n.experiment_id=$1 ORDER BY s.starts_at,n.created_at',[id])).rows;
  }
  async complete(user: UserRow, id: string) {
    researcher(user);
    return this.db.transaction(async client => {
      const row = (await client.query('SELECT n.*,e.owner_id FROM enrollments n JOIN experiments e ON e.id=n.experiment_id WHERE n.id=$1 FOR UPDATE OF n',[id])).rows[0];
      if (!row || row.owner_id!==user.id) throw new NotFoundException();
      if (row.status==='completed') return { ok:true };
      await client.query("UPDATE enrollments SET status='completed',completed_at=now() WHERE id=$1",[id]);
      await client.query('UPDATE users SET balance=balance+$1,total_reward=total_reward+$1 WHERE id=$2',[row.reward_points,row.user_id]);
      await client.query('INSERT INTO wallet_ledger(id,user_id,amount,kind,reference_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),row.user_id,row.reward_points,'experiment_reward',id]);
      await client.query('INSERT INTO audit_logs(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)',[randomUUID(),user.id,'enrollment.completed',id]);
      return { ok:true };
    });
  }
  async wallet(user: UserRow) {
    student(user);
    const current = (await this.db.query('SELECT balance FROM users WHERE id=$1',[user.id])).rows[0];
    const history = (await this.db.query('SELECT id,amount,status,created_at AS time FROM redemptions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',[user.id])).rows;
    const ledger = (await this.db.query('SELECT id,amount,kind,created_at FROM wallet_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',[user.id])).rows;
    return { balance:current.balance, history, ledger, payoutsEnabled:false };
  }
  async redeem(user: UserRow, amount: number, key: string) {
    student(user);
    requestKey(key);
    if (amount % 100) throw new BadRequestException('Use multiples of 100 points');
    return this.db.transaction(async client => {
      const current = (await client.query('SELECT balance FROM users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
      const prior = (await client.query('SELECT id,amount FROM redemptions WHERE user_id=$1 AND request_key=$2',[user.id,key])).rows[0];
      if (prior) {
        if (prior.amount!==amount) throw new ConflictException('Request key already used');
        return { id:prior.id, status:'pending' };
      }
      if (amount > current.balance) throw new ConflictException('Insufficient balance');
      const id=randomUUID();
      await client.query('UPDATE users SET balance=balance-$1 WHERE id=$2',[amount,user.id]);
      await client.query('INSERT INTO redemptions(id,user_id,request_key,amount) VALUES($1,$2,$3,$4)',[id,user.id,key,amount]);
      await client.query('INSERT INTO wallet_ledger(id,user_id,amount,kind,reference_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),user.id,-amount,'redemption_reserve',id]);
      return { id, status:'pending' };
    });
  }
}

@Controller() @UseGuards(SessionGuard)
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly service: PlatformService) {}
  @Get('experiments') list(@Req() req: AuthRequest) { return this.service.listExperiments(req.user); }
  @Post('experiments') create(@Req() req: AuthRequest, @Body() body:CreateExperimentDto) { return this.service.create(req.user,body); }
  @Post('experiments/:id/close') close(@Req() req:AuthRequest,@Param('id',new ParseUUIDPipe()) id:string) { return this.service.close(req.user,id); }
  @Post('experiments/:id/enroll') enroll(@Req() req:AuthRequest,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:EnrollDto) { return this.service.enroll(req.user,id,body); }
  @Post('experiments/:id/sessions') sessions(@Req() req:AuthRequest,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:AddSessionsDto) { return this.service.addSessions(req.user,id,body); }
  @Get('experiments/:id/enrollments') enrollments(@Req() req:AuthRequest,@Param('id',new ParseUUIDPipe()) id:string) { return this.service.enrollments(req.user,id); }
  @Post('enrollments/:id/complete') complete(@Req() req:AuthRequest,@Param('id',new ParseUUIDPipe()) id:string) { return this.service.complete(req.user,id); }
  @Get('me/profile') profile(@Req() req:AuthRequest) { return this.service.profile(req.user); }
  @Get('subjects') subjects(@Req() req:AuthRequest) { return this.service.subjects(req.user); }
  @Post('subjects/:id/reputation') rate(@Req() req:AuthRequest,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:RatingDto,@Headers('idempotency-key') key:string) { return this.service.rate(req.user,id,body,key); }
  @Get('wallet') wallet(@Req() req:AuthRequest) { return this.service.wallet(req.user); }
  @Post('wallet/redemptions') redeem(@Req() req:AuthRequest,@Body() body:RedemptionDto,@Headers('idempotency-key') key:string) { return this.service.redeem(req.user,body.amount,key); }
}
