/**
 * Screen-size breakpoints shared by the UI and the engine. Keep in sync with the media
 * queries in styles/app.css (see the note at the top of its "mobile" section).
 */

/** Compact (phone) layout: bottom bar and sheets. Narrow screens, or short ones (a phone held sideways). */
export const COMPACT_QUERY = '(max-width: 767px), (max-height: 500px)';

/** Compact layout on a phone held sideways: sheets open at the side instead of from the bottom. */
export const COMPACT_LANDSCAPE_QUERY = '(max-height: 500px) and (orientation: landscape)';

export function isCompact(): boolean {
  return typeof matchMedia === 'function' && matchMedia(COMPACT_QUERY).matches;
}

export function isCompactLandscape(): boolean {
  return typeof matchMedia === 'function' && matchMedia(COMPACT_LANDSCAPE_QUERY).matches;
}
