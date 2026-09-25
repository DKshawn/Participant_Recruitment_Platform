export function configuration() {
  const production = process.env.NODE_ENV === 'production';
  const devAuth = process.env.ALLOW_DEV_AUTH === 'true';
  if (production && devAuth) throw new Error('ALLOW_DEV_AUTH must be false in production');
  const frontend = new URL(process.env.FRONTEND_URL || 'http://localhost:5173/Participant_Recruitment_Platform/');
  const api = new URL(process.env.PUBLIC_API_URL || 'http://localhost:5173/api');
  const host = process.env.HOST || '127.0.0.1';
  const loopback = (value: string) => ['localhost','127.0.0.1','[::1]','::1'].includes(value);
  if (devAuth && (!['development','test'].includes(process.env.NODE_ENV || 'development') || !loopback(host) || !loopback(frontend.hostname) || !loopback(api.hostname))) {
    throw new Error('Development login requires local URLs and a loopback listener');
  }
  if (api.pathname.replace(/\/$/, '') !== '/api' || api.origin !== frontend.origin) throw new Error('API must be served at /api on the frontend origin');
  if (production && (frontend.protocol !== 'https:' || api.protocol !== 'https:')) {
    throw new Error('Production requires HTTPS URLs');
  }
  if (frontend.hash || frontend.search || api.hash || api.search) throw new Error('Configured URLs must not have query or fragment');
  return {
    production, devAuth,
    frontend: frontend.href.replace(/\/?$/, '/'),
    origin: frontend.origin,
    api: api.href.replace(/\/$/, ''),
    secure: production || process.env.COOKIE_SECURE === 'true',
    database: process.env.DATABASE_URL || '',
    host,
    port: Number(process.env.PORT || 3001),
  };
}
