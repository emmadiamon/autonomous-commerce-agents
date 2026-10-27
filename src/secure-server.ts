import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import type { createSessionAuth } from './session-auth.js';
import { readSessionCookie, SESSION_COOKIE } from './session-auth.js';

type Auth = ReturnType<typeof createSessionAuth>;
type Handler = (req: IncomingMessage, res: ServerResponse) => unknown;
const MAX_LOGIN_BYTES = 2048;
const files: Record<string, { file: string; type: string; public?: boolean }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/dashboard': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/dashboard.css': { file: 'styles.css', type: 'text/css; charset=utf-8', public: true },
  '/dashboard.js': { file: 'dashboard.js', type: 'text/javascript; charset=utf-8', public: true },
  '/login': { file: 'login.html', type: 'text/html; charset=utf-8', public: true },
  '/login.js': { file: 'login.js', type: 'text/javascript; charset=utf-8', public: true },
};
function securityHeaders(res: ServerResponse) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('content-security-policy', "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'");
}
function json(res: ServerResponse, status: number, value: object) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}
async function readLoginBody(req: IncomingMessage): Promise<unknown> {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('JSON required');
  let input = '';
  for await (const chunk of req) {
    input += chunk.toString();
    if (input.length > MAX_LOGIN_BYTES) throw new Error('Login payload too large');
  }
  return JSON.parse(input) as unknown;
}
function secureTransport(req: IncomingMessage) {
  return req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
}
export function createSecureServer(yoga: Handler, auth: Auth) {
  return createServer((req, res) => {
    securityHeaders(res);
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const sessionId = readSessionCookie(req.headers.cookie);
    const session = auth.session(sessionId);
    if (path === '/auth/login' && req.method === 'POST') {
      void (async () => {
        try {
          const payload = await readLoginBody(req);
          const password = payload && typeof payload === 'object' && 'password' in payload ? payload.password : undefined;
          const result = auth.login(password, req.socket.remoteAddress ?? 'unknown');
          if (!result) { json(res, 401, { error: 'Invalid credentials or too many attempts' }); return; }
          const cookie = `${SESSION_COOKIE}=${result.sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureTransport(req) ? '; Secure' : ''}`;
          res.setHeader('set-cookie', cookie);
          json(res, 200, { ok: true });
        } catch { json(res, 400, { error: 'Invalid login request' }); }
      })();
      return;
    }
    if (path === '/auth/session' && req.method === 'GET') {
      if (!session) { json(res, 401, { authenticated: false }); return; }
      json(res, 200, { authenticated: true, actor: 'demo-admin', csrfToken: session.csrfToken });
      return;
    }
    if (path === '/auth/logout' && req.method === 'POST') {
      if (!session || !auth.validCsrf(sessionId, req.headers['x-csrf-token'] as string | undefined)) {
        json(res, 403, { error: 'Forbidden' }); return;
      }
      auth.logout(sessionId);
      res.setHeader('set-cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureTransport(req) ? '; Secure' : ''}`);
      json(res, 200, { ok: true });
      return;
    }
    const asset = req.method === 'GET' ? files[path] : undefined;
    if (asset) {
      if (!asset.public && !session) {
        res.writeHead(302, { location: '/login' }); res.end(); return;
      }
      void readFile(new URL('../dashboard/' + asset.file, import.meta.url)).then(data => {
        res.writeHead(200, { 'content-type': asset.type });
        res.end(data);
      }).catch(() => json(res, 500, { error: 'Asset unavailable' }));
      return;
    }
    if (path !== '/graphql') { json(res, 404, { error: 'Not found' }); return; }
    if (!session) { json(res, 401, { error: 'Authentication required' }); return; }
    if (req.method === 'POST' && !auth.validCsrf(sessionId, req.headers['x-csrf-token'] as string | undefined)) {
      json(res, 403, { error: 'CSRF token required' }); return;
    }
    void yoga(req, res);
  });
}
