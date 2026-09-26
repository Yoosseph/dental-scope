/** Interface languages. English is the default; Swedish and German are full translations. */
export type Lang = 'en' | 'sv' | 'de';

export const LANGS: readonly Lang[] = ['en', 'sv', 'de'];
export const DEFAULT_LANG: Lang = 'en';

/** Each language's name in its own language (for the switcher). */
export const LANG_NATIVE: Record<Lang, string> = { en: 'English', sv: 'Svenska', de: 'Deutsch' };

export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'sv' || v === 'de';
