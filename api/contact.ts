/**
 * Feedback form endpoint (Vercel function at /api/contact).
 *
 * The browser posts a JSON message; this function forwards it by email through
 * the Resend API. The repository is public, so nothing secret lives here: the
 * API key and the addresses come from environment variables set in the Vercel
 * project (see README, "Feedback form"). Without them the endpoint answers
 * 503 `not_configured` and the dialog offers a GitHub issue instead, so forks,
 * local previews and other hosts keep working.
 *
 * This file is self-contained on purpose: Vercel compiles each function on its
 * own, so it does not import from `src/`. `src/app/contact.test.ts` checks
 * that the limits below match the client's.
 */

export const LIMITS = { name: 100, email: 200, message: 5000, page: 500, selection: 120, minMessage: 10 } as const;
export const KINDS = ['issue', 'idea', 'other'] as const;
export type Kind = (typeof KINDS)[number];
export const LANGS = ['en', 'sv', 'de', 'es', 'la'] as const;

export type ContactInput = {
  kind: Kind;
  name: string;
  email: string;
  message: string;
  page: string;
  selection: string;
  lang: string;
};

export type ContactEnv = {
  RESEND_API_KEY?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
};

/** Sender used until CONTACT_FROM_EMAIL is set; Resend's shared test domain only delivers to the Resend account's own address. */
export const DEFAULT_FROM = 'Dental Scope <onboarding@resend.dev>';
const MAX_BODY_BYTES = 20_000;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

type Validation = { ok: true; value: ContactInput; spam: boolean } | { ok: false; field: string };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
/** Replace control characters with spaces; in the message, newlines and tabs stay. */
function clean(v: string, keepLines = false): string {
  let out = '';
  for (const ch of v) {
    const code = ch.charCodeAt(0);
    const control = code < 32 || code === 127;
    out += !control || (keepLines && (ch === '\n' || ch === '\t')) ? ch : keepLines && ch === '\r' ? '' : ' ';
  }
  return out;
}

/** Check and normalise a posted message. A filled honeypot field marks it as spam. */
export function validate(body: unknown): Validation {
  if (!body || typeof body !== 'object') return { ok: false, field: 'body' };
  const b = body as Record<string, unknown>;
  const kind = str(b.kind) as Kind;
  if (!KINDS.includes(kind)) return { ok: false, field: 'kind' };
  const name = clean(str(b.name));
  if (name.length > LIMITS.name) return { ok: false, field: 'name' };
  const email = str(b.email);
  if (email && (email.length > LIMITS.email || !EMAIL.test(email))) return { ok: false, field: 'email' };
  const message = clean(str(b.message), true);
  if (message.length < LIMITS.minMessage || message.length > LIMITS.message) return { ok: false, field: 'message' };
  const page = clean(str(b.page)).slice(0, LIMITS.page);
  const selection = clean(str(b.selection)).slice(0, LIMITS.selection);
  const lang = (LANGS as readonly string[]).includes(str(b.lang)) ? str(b.lang) : 'en';
  const spam = str(b.website) !== '';
  return { ok: true, spam, value: { kind, name, email, message, page, selection, lang } };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const KIND_LABEL: Record<Kind, string> = { issue: 'Issue', idea: 'Idea', other: 'Message' };

/** A bare address becomes "Dental Scope <address>" so every email from this site is labelled. */
export function senderOf(raw: string | undefined): string {
  const from = raw?.trim();
  if (!from) return DEFAULT_FROM;
  return from.includes('<') ? from : `Dental Scope <${from}>`;
}

/** The Resend API payload for one message. */
export function buildEmail(input: ContactInput, env: Required<Pick<ContactEnv, 'CONTACT_TO_EMAIL'>> & ContactEnv) {
  const who = input.name || input.email || 'anonymous visitor';
  const preview = input.message.replace(/\s+/g, ' ').slice(0, 60);
  const subject = `[Dental Scope] ${KIND_LABEL[input.kind]} from ${who}: ${preview}${input.message.length > 60 ? '…' : ''}`;
  const rows: [string, string][] = [
    ['Type', KIND_LABEL[input.kind]],
    ['Name', input.name || '—'],
    ['Email', input.email || '— (no reply address given)'],
    ['Page', input.page || '—'],
    ['Selected', input.selection || '—'],
    ['Language', input.lang],
  ];
  const text = [
    'New message from the Dental Scope feedback form',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    input.message,
  ].join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a">
<p style="margin:0 0 12px;font-weight:600">New message from the Dental Scope feedback form</p>
<table style="border-collapse:collapse;margin:0 0 16px">${rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#666">${k}</td><td style="padding:2px 0">${escapeHtml(v)}</td></tr>`).join('')}</table>
<div style="white-space:pre-wrap;border-left:3px solid #2a3bd1;padding:4px 0 4px 12px">${escapeHtml(input.message)}</div>
</div>`;
  return {
    from: senderOf(env.CONTACT_FROM_EMAIL),
    to: [env.CONTACT_TO_EMAIL],
    subject: subject.replace(/[\r\n]+/g, ' '),
    text,
    html,
    ...(input.email ? { reply_to: input.email } : {}),
    tags: [{ name: 'source', value: 'dental-scope' }, { name: 'kind', value: input.kind }],
  };
}

/** Small per-instance limiter: a burst guard, not a quota (instances do not share memory). */
export function createRateLimiter(max = 5, windowMs = 10 * 60_000) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) { hits.set(key, recent); return false; }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

type Deps = { env: ContactEnv; fetch: typeof fetch; allow: (key: string) => boolean };

/** Request handler with its dependencies passed in (tests call this directly). */
export async function handle(request: Request, deps: Deps): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const { RESEND_API_KEY, CONTACT_TO_EMAIL } = deps.env;
  if (!RESEND_API_KEY?.trim() || !CONTACT_TO_EMAIL?.trim()) return json(503, { error: 'not_configured' });

  // only accept posts from the page itself
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin && host) {
    try { if (new URL(origin).host !== host) return json(403, { error: 'forbidden' }); } catch { return json(403, { error: 'forbidden' }); }
  }
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json(415, { error: 'unsupported_media_type' });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'too_large' });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'invalid', field: 'body' }); }

  const result = validate(body);
  if (!result.ok) return json(400, { error: 'invalid', field: result.field });
  // pretend success so bots do not learn about the honeypot
  if (result.spam) return json(200, { ok: true });

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';
  if (!deps.allow(ip)) return json(429, { error: 'rate_limited' });

  const email = buildEmail(result.value, { ...deps.env, CONTACT_TO_EMAIL: CONTACT_TO_EMAIL.trim() });
  try {
    const res = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${RESEND_API_KEY.trim()}`, 'content-type': 'application/json' },
      body: JSON.stringify(email),
    });
    if (!res.ok) {
      console.error('contact: Resend responded', res.status, await res.text().catch(() => ''));
      return json(502, { error: 'send_failed' });
    }
  } catch (error) {
    console.error('contact: Resend request failed', error);
    return json(502, { error: 'send_failed' });
  }
  return json(200, { ok: true });
}

const allow = createRateLimiter();

export function POST(request: Request): Promise<Response> {
  return handle(request, { env: process.env, fetch, allow });
}
