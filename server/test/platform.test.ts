import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, generateKeyPairSync, sign } from 'node:crypto';
import pg from 'pg';
import * as oidc from 'openid-client';
import { createApp } from '../src/app.js';
import { Database } from '../src/database.js';
import { migrate } from '../src/migrate.js';
import { seed } from '../src/seed.js';
import { AuthService, hash } from '../src/auth.js';
import { configuration } from '../src/config.js';

// All mutations live in a disposable schema, never the developer's public schema.
test('PostgreSQL API integration', async t => {
  const originalEnvironment = { ...process.env };
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, 'Set DATABASE_URL to the local test database');
  const schema = `actmind_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: databaseUrl });
  const isolatedUrl = new URL(databaseUrl);
  isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
  await admin.query(`CREATE SCHEMA "${schema}"`);
  Object.assign(process.env, {
    NODE_ENV: 'test', ALLOW_DEV_AUTH: 'true', HOST: '127.0.0.1',
    DATABASE_URL: isolatedUrl.href, FRONTEND_URL: 'http://localhost:5173/Participant_Recruitment_Platform/',
    PUBLIC_API_URL: 'http://localhost:5173/api', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
    MICROSOFT_CLIENT_ID: '', MICROSOFT_CLIENT_SECRET: '', COOKIE_SECURE: 'false',
  });
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  let db: Database | undefined;
  try {
    app = await createApp();
    db = app.get<Database>(Database);
    await migrate(db);
    await migrate(db);
    const fixtures = await seed(db);
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}/api`;
    type Options = { method?: string; cookie?: string; body?: unknown; key?: string; origin?: string };
    async function request(path: string, options: Options = {}) {
      const res = await fetch(base + path, {
        method: options.method || 'GET', redirect: 'manual',
        headers: { Origin: options.origin ?? 'http://localhost:5173', ...(options.cookie ? { Cookie: options.cookie } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.key ? { 'Idempotency-Key': options.key } : {}) },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });
      const raw = await res.text();
      let body: any;
      try { body = JSON.parse(raw) } catch { body = raw }
      return { status: res.status, body, cookie: res.headers.get('set-cookie')?.split(';')[0] || '', headers: res.headers };
    }
    const post = (path: string, cookie: string, body?: unknown, key?: string) => request(path, { method: 'POST', cookie, body, key });
    const stu = await post('/auth/dev', '', { role: 'student' });
    const res = await post('/auth/dev', '', { role: 'researcher' });
    assert.equal(stu.status, 201);
    assert.equal(res.status, 201);
    const student = stu.cookie, researcher = res.cookie;
    const createBody = { title: { en: 'Concurrency study', zh: '并发测试' }, description: { en: 'A study for integration tests.' }, location_type: 'offline', location_detail: 'Test room', reward_points: 2000, duration_minutes: 30, min_reputation_required: 0, capacity: 1 };
    async function sessionFor(role: string) {
      const id = randomUUID(), token = randomBytes(32).toString('base64url');
      await db!.query('INSERT INTO users(id,issuer,subject,name,role) VALUES($1,$2,$3,$4,$5)', [id, 'test', id, JSON.stringify({ en: 'Isolated test user' }), role]);
      await db!.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')", [hash(token), id]);
      return { id, cookie: `actmind_session=${token}` };
    }
    const otherStudent = await sessionFor('student');
    const otherResearcher = await sessionFor('researcher');

    await t.test('health, cookie session, CSRF, role and input checks', async () => {
      assert.equal((await request('/health')).status, 200);
      assert.equal((await request('/experiments')).status, 401);
      assert.match(stu.headers.get('set-cookie')!, /HttpOnly/i);
      assert.match(stu.headers.get('set-cookie')!, /SameSite=Lax/i);
      assert.equal((await request('/auth/dev', { method: 'POST', body: { role: 'student' }, origin: 'https://attacker.invalid' })).status, 403);
      assert.equal((await post('/experiments', student, createBody)).status, 403);
      assert.equal((await post('/auth/dev', '', { role: 'student', email: 'not-trusted@example.invalid' })).status, 400);
      assert.equal((await post('/experiments', researcher, { ...createBody, owner_id: otherResearcher.id })).status, 400);
      assert.equal((await post('/experiments', researcher, { ...createBody, reward_points: -1 })).status, 400);
      assert.equal((await post('/experiments', researcher, { ...createBody, title: [{ en: 'invalid array' }] })).status, 400);
      assert.equal((await post('/experiments', researcher, { ...createBody, title: { en: null } })).status, 400);
      assert.equal((await post('/experiments', researcher, { ...createBody, location_type: 'online', location_detail: 'javascript:alert(1)' })).status, 400);
      assert.equal((await request('/me/profile', { cookie: student })).body.reputation, undefined);
      assert.equal((await request('/subjects', { cookie: student })).status, 403);
      assert.equal((await request('/experiments', { cookie: student })).body[0].min_reputation_required, undefined);
    });

    let enrollmentId = '';
    await t.test('duplicate enrollments are idempotent and concurrent capacity is enforced', async () => {
      const enrolled = await Promise.all([post(`/experiments/${fixtures.experiment}/enroll`, student), post(`/experiments/${fixtures.experiment}/enroll`, student)]);
      assert.deepEqual(enrolled.map(r => r.status), [201, 201]);
      assert.equal(enrolled[0].body.id, enrolled[1].body.id);
      enrollmentId = enrolled[0].body.id;
      const created = await post('/experiments', researcher, createBody);
      assert.equal(created.status, 201);
      const attempts = await Promise.all([post(`/experiments/${created.body.id}/enroll`, student), post(`/experiments/${created.body.id}/enroll`, otherStudent.cookie)]);
      assert.deepEqual(attempts.map(r => r.status).sort(), [201, 409]);
      assert.equal((await db!.query('SELECT count(*)::int AS n FROM enrollments WHERE experiment_id=$1', [created.body.id])).rows[0].n, 1);
    });

    await t.test('researcher ownership and exactly-once completion credit', async () => {
      assert.equal((await request(`/experiments/${fixtures.experiment}/enrollments`, { cookie: otherResearcher.cookie })).status, 404);
      assert.equal((await post(`/enrollments/${enrollmentId}/complete`, otherResearcher.cookie)).status, 404);
      assert.equal((await post(`/enrollments/${enrollmentId}/complete`, student)).status, 403);
      const complete = await Promise.all([post(`/enrollments/${enrollmentId}/complete`, researcher), post(`/enrollments/${enrollmentId}/complete`, researcher)]);
      assert.deepEqual(complete.map(r => r.status), [201, 201]);
      const wallet = (await request('/wallet', { cookie: student })).body;
      assert.equal(wallet.balance, 2000);
      assert.equal(wallet.ledger.length, 1);
      assert.equal(wallet.ledger[0].amount, 2000);
      assert.equal((await request('/me/profile', { cookie: student })).body.totalReward, 2000);
    });

    await t.test('reputation changes are scoped, auditable, idempotent, and filter the student feed', async () => {
      const path = `/subjects/${fixtures.student}/reputation`;
      const key = randomUUID(), body = { delta: -20, reason: 'Test participation review' };
      assert.equal((await post(path, otherResearcher.cookie, body, randomUUID())).status, 404);
      assert.equal((await post(path, researcher, body)).status, 400);
      const rated = await Promise.all([post(path, researcher, body, key), post(path, researcher, body, key)]);
      for (const result of rated) assert.deepEqual(result.body, { before: 100, after: 80 });
      assert.equal((await post(path, researcher, { ...body, delta: -10 }, key)).status, 409);
      assert.equal((await db!.query('SELECT count(*)::int AS n FROM reputation_logs WHERE request_key=$1', [key])).rows[0].n, 1);
      const hidden = await post('/experiments', researcher, { ...createBody, min_reputation_required: 90 });
      assert.equal(hidden.status, 201);
      assert.equal((await request('/experiments', { cookie: student })).body.some((e: any) => e.id === hidden.body.id), false);
      assert.equal((await post(`/experiments/${hidden.body.id}/enroll`, student)).status, 404);
      const subjects = (await request('/subjects', { cookie: researcher })).body;
      assert.equal(subjects.find((u: any) => u.id === fixtures.student).reputation, 80);
      assert.ok(subjects.every((u: any) => u.email === undefined));
      assert.equal((await request('/subjects', { cookie: otherResearcher.cookie })).body.length, 0);
    });

    await t.test('redemption cannot overdraw, reserves once, and remains pending', async () => {
      assert.equal((await post('/wallet/redemptions', student, { amount: 1050 }, randomUUID())).status, 400);
      const keys = [randomUUID(), randomUUID()];
      const attempts = await Promise.all(keys.map(key => post('/wallet/redemptions', student, { amount: 1500 }, key)));
      assert.deepEqual(attempts.map(r => r.status).sort(), [201, 409]);
      // Retry only the successful key: it must return the same reservation without another debit.
      const winner = attempts.findIndex(result => result.status === 201);
      assert.deepEqual((await post('/wallet/redemptions', student, { amount: 1500 }, keys[winner])).body, attempts[winner].body);
      assert.equal((await post('/wallet/redemptions', student, { amount: 1000 }, keys[winner])).status, 409);
      const wallet = (await request('/wallet', { cookie: student })).body;
      assert.equal(wallet.balance, 500);
      assert.equal(wallet.history.length, 1);
      assert.equal(wallet.history[0].status, 'pending');
      assert.equal(wallet.payoutsEnabled, false);
      assert.equal(wallet.ledger.reduce((sum: number, r: any) => sum + r.amount, 0), wallet.balance);
      assert.equal((await request('/wallet', { cookie: researcher })).status, 403);
    });

    await t.test('closing recruitment prevents new enrollment and enforces ownership', async () => {
      assert.equal((await post(`/experiments/${fixtures.experiment}/close`, otherResearcher.cookie)).status, 404);
      assert.equal((await post(`/experiments/${fixtures.experiment}/close`, researcher)).status, 201);
      assert.equal((await post(`/experiments/${fixtures.experiment}/enroll`, otherStudent.cookie)).status, 404);
    });

    await t.test('OIDC is disabled until configured, rejects invalid callbacks, and never links by email', async () => {
      const providers = (await request('/auth/providers')).body;
      assert.equal(providers.google, false);
      assert.equal(providers.microsoft, false);
      assert.equal((await request('/auth/login/google')).status, 404);
      const callback = await request('/auth/callback/google?state=untrusted&code=not-a-code');
      assert.equal(callback.status, 302);
      assert.match(callback.headers.get('location')!, /auth_error=login_failed$/);
      const auth = app!.get(AuthService);
      const first = await auth.identity('https://issuer-one.invalid', 'subject', 'same@example.invalid', 'Test');
      const second = await auth.identity('https://issuer-two.invalid', 'subject', 'same@example.invalid', 'Test');
      assert.notEqual(first.id, second.id);
      assert.equal(first.role, 'student');
      assert.equal((await auth.identity('https://issuer-one.invalid', 'subject', 'changed@example.invalid', 'New name')).id, first.id);
      process.env.ALLOW_DEV_AUTH = 'false';
      assert.equal((await post('/auth/dev', '', { role: 'student' })).status, 404);
      process.env.ALLOW_DEV_AUTH = 'true';
      process.env.NODE_ENV = 'production';
      assert.throws(configuration, /ALLOW_DEV_AUTH/);
      process.env.NODE_ENV = 'test';
      process.env.HOST = '0.0.0.0';
      assert.throws(configuration, /loopback/);
      process.env.HOST = '127.0.0.1';
    });

    await t.test('signed OIDC code flow validates PKCE, nonce, audience, expiry, signature, school tenant, and replay', async context => {
      const auth = app!.get(AuthService);
      const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
      const config = new oidc.Configuration({
        issuer: 'https://issuer.invalid', authorization_endpoint: 'https://issuer.invalid/authorize',
        token_endpoint: 'https://issuer.invalid/token', jwks_uri: 'https://issuer.invalid/jwks',
        id_token_signing_alg_values_supported: ['RS256'],
      }, 'local-test-client', 'local-test-only-secret');
      oidc.enableNonRepudiationChecks(config);
      let claims: Record<string, unknown> = {}, verifier = '', corruptSignature = false;
      config[oidc.customFetch] = async (url, options) => {
        if (String(url) === 'https://issuer.invalid/jwks') return Response.json({ keys: [jwk] });
        assert.equal(String(url), 'https://issuer.invalid/token');
        const form = new URLSearchParams(String(options?.body));
        assert.equal(form.get('code_verifier'), verifier);
        assert.equal(form.get('code'), 'local-test-code');
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
        const unsigned = `${header}.${payload}`;
        const signature = sign('RSA-SHA256', Buffer.from(unsigned), keys.privateKey);
        if (corruptSignature) signature[0] ^= 1;
        return Response.json({ token_type: 'Bearer', access_token: 'local-test-token', id_token: `${unsigned}.${signature.toString('base64url')}` });
      };
      context.mock.method(auth, 'client', async () => config);
      // Fixture transport is entirely in-process; no request is sent to an identity provider.
      async function flow(overrides: Record<string, unknown> = {}, audience = 'general', provider = 'google') {
        if (audience === 'school') context.mock.method(auth, 'providers', () => ({ google: true, microsoft: true, school: true, development: true }));
        const start = await request(`/auth/login/${provider}?audience=${audience}`);
        assert.equal(start.status, 302);
        const authorization = new URL(start.headers.get('location')!);
        assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
        const state = authorization.searchParams.get('state')!;
        const tx = (await db!.query('SELECT * FROM oauth_transactions WHERE state_hash=$1', [hash(state)])).rows[0];
        verifier = tx.verifier;
        assert.equal(authorization.searchParams.get('code_challenge'), await oidc.calculatePKCECodeChallenge(verifier));
        claims = { iss: 'https://issuer.invalid', sub: 'signed-test-user', aud: 'local-test-client', exp: Math.floor(Date.now()/1000)+300, iat: Math.floor(Date.now()/1000), nonce: tx.nonce, email: 'test@example.invalid', email_verified: true, name: 'Signed test user', ...overrides };
        const path = `/auth/callback/${provider}?state=${state}&code=local-test-code`;
        const response = await request(path, { cookie: start.cookie });
        return { response, path, cookie: start.cookie };
      }
      const success = await flow();
      assert.match(success.response.headers.get('location')!, /#\/student\/hall$/);
      assert.match(success.response.cookie, /^actmind_session=/);
      assert.equal((await request('/auth/me', { cookie: success.response.cookie })).body.role, 'student');
      assert.match((await request(success.path, { cookie: success.cookie })).headers.get('location')!, /auth_error=login_failed$/);
      for (const invalid of [{ nonce: 'wrong-nonce' }, { aud: 'wrong-client' }, { exp: 1 }, { iss: 'https://other-issuer.invalid' }, { email_verified: false }]) {
        assert.match((await flow(invalid)).response.headers.get('location')!, /auth_error=login_failed$/);
      }
      corruptSignature = true;
      assert.match((await flow()).response.headers.get('location')!, /auth_error=login_failed$/);
      corruptSignature = false;
      const previousTenant = process.env.SCHOOL_TENANT_ID, previousDomains = process.env.SCHOOL_EMAIL_DOMAINS;
      process.env.SCHOOL_TENANT_ID = 'expected-school-tenant';
      process.env.SCHOOL_EMAIL_DOMAINS = 'school.example.invalid';
      try {
        assert.match((await flow({ tid: 'wrong-tenant', email: 'student@school.example.invalid' }, 'school', 'microsoft')).response.headers.get('location')!, /auth_error=login_failed$/);
        assert.match((await flow({ tid: 'expected-school-tenant', email: 'student@outside.example.invalid' }, 'school', 'microsoft')).response.headers.get('location')!, /auth_error=login_failed$/);
        assert.match((await flow({ tid: 'expected-school-tenant', email: 'student@school.example.invalid' }, 'school', 'microsoft')).response.headers.get('location')!, /#\/student\/hall$/);
      } finally {
        if (previousTenant === undefined) delete process.env.SCHOOL_TENANT_ID; else process.env.SCHOOL_TENANT_ID = previousTenant;
        if (previousDomains === undefined) delete process.env.SCHOOL_EMAIL_DOMAINS; else process.env.SCHOOL_EMAIL_DOMAINS = previousDomains;
      }
    });

    await t.test('logout revokes the server session and expired sessions cannot be reused', async () => {
      assert.equal((await post('/auth/logout', student)).status, 201);
      assert.equal((await request('/auth/me', { cookie: student })).status, 401);
      await db!.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1", [otherStudent.id]);
      assert.equal((await request('/auth/me', { cookie: otherStudent.cookie })).status, 401);
    });
  } finally {
    if (app) await app.close();
    // schema is generated above, not supplied by environment or a user.
    assert.match(schema, /^actmind_test_[a-f0-9]{32}$/);
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
    for (const key of Object.keys(process.env)) if (!(key in originalEnvironment)) delete process.env[key];
    Object.assign(process.env, originalEnvironment);
  }
});
