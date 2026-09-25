import { BadRequestException, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Inject, Injectable, NotFoundException, Param, Post, Query, Req, Res, UnauthorizedException, UseGuards, Body } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { IsIn } from 'class-validator';
import * as oidc from 'openid-client';
import { Database } from './database.js';
import { configuration } from './config.js';

export type UserRow = { id: string; issuer: string; subject: string; email: string | null; name: Record<string,string>; role: 'student' | 'researcher'; reputation: number; balance: number; total_reward: number; created_at: Date };
export type AuthRequest = Request & { user: UserRow };
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const publicUser = (user: UserRow) => ({ id: user.id, role: user.role, name: user.name, email: user.email, joinedAt: user.created_at, totalReward: user.total_reward });
const SESSION = 'actmind_session';
const OAUTH_STATE = 'actmind_oauth';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthService {
  private clients = new Map<string, Promise<oidc.Configuration>>();
  constructor(@Inject(Database) private readonly db: Database) {}
  providers() {
    const google = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    const microsoft = Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && uuid.test(process.env.MICROSOFT_TENANT_ID || ''));
    return { google, microsoft, school: microsoft && process.env.SCHOOL_TENANT_ID === process.env.MICROSOFT_TENANT_ID, development: configuration().devAuth };
  }
  async client(provider: string) {
    if (!['google','microsoft'].includes(provider) || !this.providers()[provider as 'google'|'microsoft']) throw new NotFoundException('Login provider is not configured');
    let pending = this.clients.get(provider);
    if (!pending) {
      const prefix = provider.toUpperCase();
      const issuer = provider === 'google' ? 'https://accounts.google.com' : `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/v2.0`;
      pending = oidc.discovery(new URL(issuer), process.env[`${prefix}_CLIENT_ID`]!, process.env[`${prefix}_CLIENT_SECRET`]!).then(client => {
        oidc.enableNonRepudiationChecks(client);
        return client;
      });
      this.clients.set(provider, pending);
      pending.catch(() => this.clients.delete(provider));
    }
    return pending;
  }
  cookieOptions() { return { httpOnly: true, secure: configuration().secure, sameSite: 'lax' as const, path: '/api' }; }
  async session(req: Request) {
    const token = req.cookies?.[SESSION];
    if (typeof token !== 'string' || token.length > 100) throw new UnauthorizedException();
    const row = (await this.db.query<UserRow>('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()', [hash(token)])).rows[0];
    if (!row) throw new UnauthorizedException();
    return row;
  }
  async issue(user: UserRow, req: Request, res: Response) {
    const token = randomBytes(32).toString('base64url');
    await this.db.transaction(async client => {
      if (typeof req.cookies?.[SESSION] === 'string') await client.query('DELETE FROM sessions WHERE token_hash=$1', [hash(req.cookies[SESSION])]);
      await client.query('DELETE FROM sessions WHERE expires_at<=now()');
      await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')", [hash(token), user.id]);
    });
    res.cookie(SESSION, token, { ...this.cookieOptions(), maxAge: 8 * 60 * 60 * 1000 });
    return publicUser(user);
  }
  async identity(issuer: string, subject: string, email: string | null, name: string) {
    // Identity is bound to the verified issuer + subject, never to an email match.
    return (await this.db.query<UserRow>(`INSERT INTO users(id,issuer,subject,email,name) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(issuer,subject) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name RETURNING *`,
      [randomUUID(), issuer, subject, email, JSON.stringify({ zh: name, en: name, ja: name })])).rows[0];
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.user = await this.auth.session(req);
    return true;
  }
}

export function researcher(user: UserRow) { if (user.role !== 'researcher') throw new ForbiddenException('Researcher access required'); }
export function student(user: UserRow) { if (user.role !== 'student') throw new ForbiddenException('Student access required'); }
class DevLoginDto { @IsIn(['student','researcher']) role!: 'student'|'researcher'; }

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(Database) private readonly db: Database) {}
  @Get('providers') providers() { return this.auth.providers(); }
  @Get('me') @UseGuards(SessionGuard) me(@Req() req: AuthRequest) { return publicUser(req.user); }

  @Post('dev')
  async dev(@Body() body: DevLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!configuration().devAuth || !['development','test'].includes(process.env.NODE_ENV || 'development')) throw new NotFoundException();
    const user = (await this.db.query<UserRow>('SELECT * FROM users WHERE issuer=$1 AND subject=$2', ['local-development', body.role])).rows[0];
    if (!user) throw new BadRequestException('Run npm run db:seed first');
    return this.auth.issue(user, req, res);
  }

  @Post('logout') @UseGuards(SessionGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.db.query('DELETE FROM sessions WHERE token_hash=$1', [hash(req.cookies[SESSION])]);
    res.clearCookie(SESSION, this.auth.cookieOptions());
    return { ok: true };
  }

  @Get('login/:provider')
  async login(@Param('provider') provider: string, @Query('audience') audience = 'general', @Res() res: Response) {
    if (!['general','school'].includes(audience)) throw new BadRequestException('Invalid audience');
    if (audience === 'school' && (provider !== 'microsoft' || !this.auth.providers().school)) throw new NotFoundException('School login is not configured');
    const client = await this.auth.client(provider);
    const state = oidc.randomState();
    const verifier = oidc.randomPKCECodeVerifier();
    const nonce = oidc.randomNonce();
    await this.db.query('DELETE FROM oauth_transactions WHERE expires_at<=now()');
    await this.db.query("INSERT INTO oauth_transactions VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')", [hash(state), provider, audience, verifier, nonce]);
    res.cookie(OAUTH_STATE, state, { ...this.auth.cookieOptions(), maxAge: 600000 });
    const url = oidc.buildAuthorizationUrl(client, {
      redirect_uri: `${configuration().api}/auth/callback/${provider}`,
      scope: 'openid profile email', state, nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256',
    });
    res.redirect(url.href);
  }

  @Get('callback/:provider')
  async callback(@Param('provider') provider: string, @Req() req: Request, @Res() res: Response) {
    const frontend = configuration().frontend;
    try {
      const state = req.query.state;
      const cookie = req.cookies?.[OAUTH_STATE];
      if (typeof state !== 'string' || typeof cookie !== 'string' || state.length > 256 || state.length !== cookie.length || !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))) throw new Error('Invalid OAuth state');
      const tx = (await this.db.query('DELETE FROM oauth_transactions WHERE state_hash=$1 AND expires_at>now() RETURNING *', [hash(state)])).rows[0];
      if (!tx || tx.provider !== provider) throw new Error('Expired OAuth transaction');
      const current = new URL(`${configuration().api}/auth/callback/${provider}`);
      current.search = new URL(req.originalUrl, configuration().api).search;
      const tokens = await oidc.authorizationCodeGrant(await this.auth.client(provider), current, { pkceCodeVerifier: tx.verifier, expectedState: state, expectedNonce: tx.nonce, idTokenExpected: true });
      const claims = tokens.claims();
      if (!claims?.sub || !claims.iss) throw new Error('Missing identity');
      if (provider === 'google' && claims.email_verified !== true) throw new Error('Unverified email');
      const email = typeof claims.email === 'string' ? claims.email : typeof claims.preferred_username === 'string' ? claims.preferred_username : null;
      if (tx.audience === 'school') {
        const domains = (process.env.SCHOOL_EMAIL_DOMAINS || '').split(',').map(d => d.trim().toLowerCase());
        if (claims.tid !== process.env.SCHOOL_TENANT_ID || !email || !domains.includes(email.split('@')[1]?.toLowerCase())) throw new Error('School identity required');
      }
      const user = await this.auth.identity(claims.iss, claims.sub, email, typeof claims.name === 'string' ? claims.name.slice(0,200) : 'Participant');
      await this.auth.issue(user, req, res);
      res.clearCookie(OAUTH_STATE, this.auth.cookieOptions());
      res.redirect(`${frontend}#/${user.role === 'researcher' ? 'researcher/publish' : 'student/hall'}`);
    } catch {
      // Never put authorization codes, tokens, email addresses, or provider errors in URLs/logs.
      res.clearCookie(OAUTH_STATE, this.auth.cookieOptions());
      res.redirect(`${frontend}#/?auth_error=login_failed`);
    }
  }
}
