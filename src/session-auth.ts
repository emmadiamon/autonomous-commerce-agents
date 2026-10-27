import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
export const SESSION_COOKIE = 'commerce_session';

type Session = { csrfToken: string; expiresAt: number };
type Attempts = { count: number; windowStart: number };

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function createSessionAuth(adminPassword: string, now = () => Date.now()) {
  if (adminPassword.length < 12) throw new Error('DASHBOARD_ADMIN_PASSWORD must be at least 12 characters');
  const adminDigest = digest(adminPassword);
  const sessions = new Map<string, Session>();
  const attempts = new Map<string, Attempts>();

  function getSession(sessionId: string | undefined): Session | null {
    if (!sessionId) return null;
    const session = sessions.get(sessionId);
    if (!session) return null;
    if (session.expiresAt <= now()) {
      sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  return {
    login(password: unknown, clientId: string): { sessionId: string; csrfToken: string } | null {
      const key = clientId.slice(0, 120);
      const prior = attempts.get(key);
      const state = prior && now() - prior.windowStart < WINDOW_MS
        ? prior : { count: 0, windowStart: now() };
      if (state.count >= MAX_FAILED_ATTEMPTS) return null;
      const candidate = typeof password === 'string' ? digest(password) : Buffer.alloc(32);
      if (!timingSafeEqual(candidate, adminDigest)) {
        state.count++;
        attempts.set(key, state);
        return null;
      }
      attempts.delete(key);
      const sessionId = randomBytes(32).toString('hex');
      const csrfToken = randomBytes(32).toString('hex');
      sessions.set(sessionId, { csrfToken, expiresAt: now() + SESSION_TTL_MS });
      return { sessionId, csrfToken };
    },
    session: getSession,
    validCsrf(sessionId: string | undefined, supplied: string | undefined): boolean {
      const session = getSession(sessionId);
      if (!session || typeof supplied !== 'string' || supplied.length !== 64) return false;
      return timingSafeEqual(Buffer.from(supplied), Buffer.from(session.csrfToken));
    },
    logout(sessionId: string | undefined) {
      if (sessionId) sessions.delete(sessionId);
    },
  };
}

export function readSessionCookie(cookie: string | undefined): string | undefined {
  return cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
}
