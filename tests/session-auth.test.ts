import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createSessionAuth, readSessionCookie } from '../src/session-auth.js';
import { createSecureServer } from '../src/secure-server.js';

describe('Phase 7 sessions', () => {
  it('rejects short config passwords and invalid credentials', () => {
    expect(() => createSessionAuth('short')).toThrow('at least 12');
    const auth = createSessionAuth('demo-passphrase-long');
    expect(auth.login('wrong', '127.0.0.1')).toBeNull();
    const valid = auth.login('demo-passphrase-long', '127.0.0.1');
    expect(valid?.sessionId).toHaveLength(64);
    expect(auth.validCsrf(valid?.sessionId, valid?.csrfToken)).toBe(true);
    expect(auth.validCsrf(valid?.sessionId, 'wrong')).toBe(false);
    auth.logout(valid?.sessionId);
    expect(auth.session(valid?.sessionId)).toBeNull();
  });

  it('expires sessions and throttles failed logins', () => {
    let time = 0;
    const auth = createSessionAuth('demo-passphrase-long', () => time);
    for (let i = 0; i < 5; i++) expect(auth.login('nope', 'client')).toBeNull();
    expect(auth.login('demo-passphrase-long', 'client')).toBeNull();
    time += 15 * 60 * 1000 + 1;
    const valid = auth.login('demo-passphrase-long', 'client');
    expect(valid).not.toBeNull();
    time += 8 * 60 * 60 * 1000 + 1;
    expect(auth.session(valid?.sessionId)).toBeNull();
  });

  it('reads only the expected session cookie', () => {
    expect(readSessionCookie('foo=x; commerce_session=abc123; bar=y')).toBe('abc123');
    expect(readSessionCookie('unrelated=hello')).toBeUndefined();
  });
});

describe('Protected HTTP boundary', () => {
  const openServers: Array<ReturnType<typeof createSecureServer>> = [];
  afterEach(async () => {
    await Promise.all(openServers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  });

  it('blocks anonymous GraphQL and CSRF-less requests, allows valid login and logout', async () => {
    let graphCalls = 0;
    const auth = createSessionAuth('demo-passphrase-long');
    const server = createSecureServer((_req, res) => { graphCalls++; res.writeHead(200); res.end('graphql-ok'); }, auth);
    openServers.push(server);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const root = 'http://127.0.0.1:' + port;

    const anonymous = await fetch(root + '/graphql', { method: 'POST' });
    expect(anonymous.status).toBe(401);
    const dashboard = await fetch(root + '/dashboard', { redirect: 'manual' });
    expect(dashboard.status).toBe(302);
    expect(dashboard.headers.get('location')).toBe('/login');

    const logged = await fetch(root + '/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'demo-passphrase-long' }),
    });
    expect(logged.status).toBe(200);
    const cookie = logged.headers.get('set-cookie')?.split(';')[0];
    expect(cookie).toMatch(/^commerce_session=/);
    expect(logged.headers.get('set-cookie')).toContain('HttpOnly');

    const session = await fetch(root + '/auth/session', { headers: { cookie: cookie! } });
    expect(session.status).toBe(200);
    const { csrfToken } = await session.json() as { csrfToken: string };
    const refused = await fetch(root + '/graphql', { method: 'POST', headers: { cookie: cookie! } });
    expect(refused.status).toBe(403);
    const passed = await fetch(root + '/graphql', {
      method: 'POST', headers: { cookie: cookie!, 'x-csrf-token': csrfToken },
    });
    expect(passed.status).toBe(200);
    expect(await passed.text()).toBe('graphql-ok');
    expect(graphCalls).toBe(1);

    const logout = await fetch(root + '/auth/logout', {
      method: 'POST', headers: { cookie: cookie!, 'x-csrf-token': csrfToken },
    });
    expect(logout.status).toBe(200);
    const denied = await fetch(root + '/auth/session', { headers: { cookie: cookie! } });
    expect(denied.status).toBe(401);
  });
});
