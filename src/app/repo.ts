/**
 * Link to the project repository, or `null` when none should be shown.
 *
 * Set at build time with `VITE_DS_REPO_URL`. Unset means "don't link", so a
 * build of a still-private repository never advertises its URL; the Pages
 * workflow only passes the URL once the repository is public.
 */
export function parseRepoUrl(raw: string | undefined): string | null {
  const url = raw?.trim();
  return url && /^https:\/\/\S+$/.test(url) ? url : null;
}

export const REPO_URL = parseRepoUrl(import.meta.env.VITE_DS_REPO_URL);
