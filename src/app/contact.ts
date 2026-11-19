/**
 * Client side of the feedback form. Posts to the `/api/contact` Vercel
 * function (`api/contact.ts`), which emails the maintainer through Resend.
 * Builds without that function (forks, `npm run preview`, other static hosts)
 * get `unavailable`, and the dialog points to GitHub issues instead.
 */
import { REPO_URL } from './repo';

/** Must match LIMITS in api/contact.ts (checked by contact.test.ts). */
export const CONTACT_LIMITS = { name: 100, email: 200, message: 5000, page: 500, selection: 120, minMessage: 10 } as const;
export const CONTACT_KINDS = ['issue', 'idea', 'other'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export type ContactPayload = {
  kind: ContactKind;
  name: string;
  email: string;
  message: string;
  page: string;
  selection: string;
  lang: string;
  /** honeypot: hidden from people, filled in by naive bots */
  website: string;
};

export type ContactResult = 'sent' | 'unavailable' | 'invalid' | 'rate_limited' | 'failed';

export const CONTACT_ENDPOINT = `${import.meta.env.BASE_URL}api/contact`;

export const ISSUES_URL = `${REPO_URL.replace(/\/+$/, '')}/issues/new`;

/** Send a message; never throws. */
export async function sendContact(payload: ContactPayload, fetchImpl: typeof fetch = fetch, endpoint = CONTACT_ENDPOINT): Promise<ContactResult> {
  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return 'failed';
  }
  if (res.ok) {
    // a static host may answer 200 with the app shell; only the function replies with JSON {ok:true}
    const body = (await res.json().catch(() => null)) as { ok?: unknown } | null;
    return body?.ok === true ? 'sent' : 'unavailable';
  }
  if (res.status === 400) return 'invalid';
  if (res.status === 429) return 'rate_limited';
  if ([404, 405, 501, 503].includes(res.status)) return 'unavailable';
  return 'failed';
}
