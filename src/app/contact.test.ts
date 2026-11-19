import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FROM, KINDS, LIMITS, buildEmail, createRateLimiter, escapeHtml, handle, senderOf, validate, type ContactEnv } from '../../api/contact';
import { CONTACT_KINDS, CONTACT_LIMITS, sendContact, type ContactPayload } from './contact';
import { CONTACT_TEXT } from '../i18n/contact';
import { LANGS } from '../i18n/lang';

const ENV: ContactEnv = { RESEND_API_KEY: 're_test', CONTACT_TO_EMAIL: 'owner@example.com', CONTACT_FROM_EMAIL: 'feedback@dental-scope.com' };
const BODY = { kind: 'issue', name: 'Anna', email: 'anna@example.com', message: 'The label on tooth 36 overlaps.', page: 'https://dental-scope.com/tooth/36/', selection: 'tooth-36', lang: 'sv', website: '' };

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://dental-scope.com/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'dental-scope.com', origin: 'https://dental-scope.com', 'x-forwarded-for': '1.2.3.4', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const okFetch = () => vi.fn<typeof fetch>(() => Promise.resolve(new Response('{"id":"x"}', { status: 200 })));
const deps = (over: Partial<Parameters<typeof handle>[1]> = {}) => ({ env: ENV, fetch: okFetch(), allow: () => true, ...over });

describe('client and server agree', () => {
  it('uses the same limits and kinds', () => {
    expect(CONTACT_LIMITS).toEqual(LIMITS);
    expect([...CONTACT_KINDS]).toEqual([...KINDS]);
  });
  it('has feedback text in every interface language', () => {
    for (const lang of LANGS) {
      const text = CONTACT_TEXT[lang];
      for (const [key, value] of Object.entries(text)) {
        if (typeof value === 'string') expect(value.trim(), `${lang}.${key}`).not.toBe('');
      }
      for (const kind of CONTACT_KINDS) expect(text.kinds[kind].trim()).not.toBe('');
    }
  });
});

describe('validate', () => {
  it('accepts a normal message and keeps its lines', () => {
    const r = validate({ ...BODY, message: 'Line one\nline two is here' });
    expect(r).toMatchObject({ ok: true, spam: false, value: { kind: 'issue', message: 'Line one\nline two is here', lang: 'sv' } });
  });
  it('allows an anonymous message without email', () => {
    expect(validate({ ...BODY, name: '', email: '' }).ok).toBe(true);
  });
  it('rejects bad fields', () => {
    expect(validate({ ...BODY, kind: 'spam' })).toEqual({ ok: false, field: 'kind' });
    expect(validate({ ...BODY, email: 'not-an-email' })).toEqual({ ok: false, field: 'email' });
    expect(validate({ ...BODY, message: 'short' })).toEqual({ ok: false, field: 'message' });
    expect(validate({ ...BODY, message: 'x'.repeat(LIMITS.message + 1) })).toEqual({ ok: false, field: 'message' });
    expect(validate({ ...BODY, name: 'x'.repeat(LIMITS.name + 1) })).toEqual({ ok: false, field: 'name' });
    expect(validate(null)).toEqual({ ok: false, field: 'body' });
  });
  it('flags a filled honeypot and falls back to English for unknown languages', () => {
    expect(validate({ ...BODY, website: 'http://spam' })).toMatchObject({ ok: true, spam: true });
    expect(validate({ ...BODY, lang: 'xx' })).toMatchObject({ ok: true, value: { lang: 'en' } });
  });
});

describe('buildEmail', () => {
  const input = () => { const r = validate(BODY); if (!r.ok) throw new Error('fixture'); return r.value; };
  it('labels every email as Dental Scope', () => {
    const email = buildEmail(input(), { ...ENV, CONTACT_TO_EMAIL: 'owner@example.com' });
    expect(email.from).toBe('Dental Scope <feedback@dental-scope.com>');
    expect(email.subject).toMatch(/^\[Dental Scope\] Issue from Anna: /);
    expect(email.to).toEqual(['owner@example.com']);
    expect(email.reply_to).toBe('anna@example.com');
    expect(email.tags).toContainEqual({ name: 'source', value: 'dental-scope' });
    expect(email.text).toContain('tooth-36');
  });
  it('escapes HTML and keeps the subject on one line', () => {
    const r = validate({ ...BODY, name: 'Eve\r\nBcc: x@y.z', email: '', message: '<script>alert(1)</script> hello' });
    if (!r.ok) throw new Error('fixture');
    const email = buildEmail(r.value, { CONTACT_TO_EMAIL: 'owner@example.com' });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email).not.toHaveProperty('reply_to');
    expect(email.from).toBe(DEFAULT_FROM);
  });
  it('keeps a sender that already has a display name', () => {
    expect(senderOf('Dental Scope Feedback <hi@dental-scope.com>')).toBe('Dental Scope Feedback <hi@dental-scope.com>');
    expect(senderOf('  ')).toBe(DEFAULT_FROM);
    expect(escapeHtml(`"&'`)).toBe('&quot;&amp;&#39;');
  });
});

describe('handle', () => {
  it('sends through Resend with the API key', async () => {
    const send = okFetch();
    const res = await handle(post(BODY), deps({ fetch: send }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [url, init] = send.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer re_test');
    expect(JSON.parse(init?.body as string)).toMatchObject({ from: 'Dental Scope <feedback@dental-scope.com>', to: ['owner@example.com'] });
  });
  it('is unavailable without a key or recipient, so forks fall back to GitHub issues', async () => {
    for (const env of [{}, { RESEND_API_KEY: 're_test' }, { CONTACT_TO_EMAIL: 'owner@example.com' }]) {
      const d = deps({ env });
      const res = await handle(post(BODY), d);
      expect(res.status).toBe(503);
      expect(d.fetch).not.toHaveBeenCalled();
    }
  });
  it('rejects other methods, origins, content types and oversized bodies', async () => {
    expect((await handle(new Request('https://dental-scope.com/api/contact'), deps())).status).toBe(405);
    expect((await handle(post(BODY, { origin: 'https://evil.example' }), deps())).status).toBe(403);
    expect((await handle(post(BODY, { 'content-type': 'text/plain' }), deps())).status).toBe(415);
    expect((await handle(post({ ...BODY, message: 'x'.repeat(30_000) }), deps())).status).toBe(413);
    expect((await handle(post('{not json'), deps())).status).toBe(400);
  });
  it('answers 400 for invalid input and silently drops honeypot posts', async () => {
    expect((await handle(post({ ...BODY, message: 'hi' }), deps())).status).toBe(400);
    const d = deps();
    const res = await handle(post({ ...BODY, website: 'spam' }), d);
    expect(res.status).toBe(200);
    expect(d.fetch).not.toHaveBeenCalled();
  });
  it('rate limits and reports Resend failures', async () => {
    expect((await handle(post(BODY), deps({ allow: () => false }))).status).toBe(429);
    const failing = vi.fn<typeof fetch>(() => Promise.resolve(new Response('bad', { status: 422 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await handle(post(BODY), deps({ fetch: failing }))).status).toBe(502);
    const throwing = vi.fn<typeof fetch>(() => Promise.reject(new Error('offline')));
    expect((await handle(post(BODY), deps({ fetch: throwing }))).status).toBe(502);
  });
});

describe('createRateLimiter', () => {
  it('allows a burst, then blocks until the window passes', () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow('a', 0)).toBe(true);
    expect(allow('a', 10)).toBe(true);
    expect(allow('a', 20)).toBe(false);
    expect(allow('b', 20)).toBe(true);
    expect(allow('a', 1500)).toBe(true);
  });
});

describe('sendContact', () => {
  const payload: ContactPayload = { ...BODY, kind: 'issue' };
  const reply = (status: number, body: string, type = 'application/json') => vi.fn<typeof fetch>(() => Promise.resolve(new Response(body, { status, headers: { 'content-type': type } })));
  it('maps responses to results', async () => {
    expect(await sendContact(payload, reply(200, '{"ok":true}'), '/api/contact')).toBe('sent');
    expect(await sendContact(payload, reply(400, '{}'), '/api/contact')).toBe('invalid');
    expect(await sendContact(payload, reply(429, '{}'), '/api/contact')).toBe('rate_limited');
    expect(await sendContact(payload, reply(503, '{}'), '/api/contact')).toBe('unavailable');
    expect(await sendContact(payload, reply(404, 'Not found', 'text/html'), '/api/contact')).toBe('unavailable');
    expect(await sendContact(payload, reply(502, '{}'), '/api/contact')).toBe('failed');
    expect(await sendContact(payload, vi.fn<typeof fetch>(() => Promise.reject(new Error('offline'))), '/api/contact')).toBe('failed');
  });
  it('treats a static host answering with the app shell as unavailable', async () => {
    expect(await sendContact(payload, reply(200, '<!doctype html>', 'text/html'), '/api/contact')).toBe('unavailable');
  });
});
