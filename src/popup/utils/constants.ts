/**
 * Constants specific to the popup UI.
 * These are used by components and hooks within the popup.
 */

/**
 * Motivational quotes shown in the DailyQuote component — drawn from the
 * Tao Te Ching (道德經), the ancient Chinese classic of calm, effortless
 * action. Chosen for ADHD users: they encourage stillness, small steps,
 * and self-knowledge without pressure.
 *
 * `chapter` and `verse` follow the traditional (Wáng Bì) stanza divisions
 * of the Chinese text, which is the numbering most English translations
 * use. The wording is a modern, plain-English rendering of that stanza.
 */
export interface TaoQuote {
  /** Quote text (modern English rendering) */
  text: string;
  /** Chapter of the Tao Te Ching (1–81) */
  chapter: number;
  /** Verse (stanza) within the chapter */
  verse: number;
}

export const MOTIVATIONAL_QUOTES: readonly TaoQuote[] = [
  { text: 'The Tao that can be told is not the eternal Tao.', chapter: 1, verse: 1 },
  {
    text: 'The highest good is like water — it benefits all things without competing.',
    chapter: 8,
    verse: 1,
  },
  {
    text: 'The ancient masters were subtle, mysterious, and profoundly wise.',
    chapter: 15,
    verse: 1,
  },
  {
    text: 'Heaviness is the root of lightness; stillness is the master of restlessness.',
    chapter: 26,
    verse: 1,
  },
  {
    text: 'Knowing others is intelligence; knowing yourself is true wisdom.',
    chapter: 33,
    verse: 1,
  },
  {
    text: 'Mastering others is strength; mastering yourself is true power.',
    chapter: 33,
    verse: 2,
  },
  { text: 'The Tao does nothing, yet nothing is left undone.', chapter: 37, verse: 1 },
  {
    text: 'Without going outside your door, you can know the whole world.',
    chapter: 47,
    verse: 1,
  },
  { text: 'Those who know do not speak; those who speak do not know.', chapter: 56, verse: 1 },
  {
    text: "The world's great things are accomplished through small steps.",
    chapter: 63,
    verse: 6,
  },
  { text: 'A journey of a thousand miles begins beneath your feet.', chapter: 64, verse: 9 },
  {
    text: 'Be as careful at the end as at the beginning, and there will be no failure.',
    chapter: 64,
    verse: 15,
  },
  { text: 'Knowing that you do not know is the highest wisdom.', chapter: 71, verse: 1 },
] as const;

/** Session icon options for users to choose from */
export const SESSION_ICONS: readonly string[] = [
  '📋',
  '💼',
  '📚',
  '🎯',
  '🔬',
  '🎨',
  '💻',
  '🛒',
  '🏠',
  '✈️',
  '🎵',
  '🧪',
  '📝',
  '🌐',
  '💡',
  '🔧',
] as const;

/** Predefined session name suggestions */
export const SESSION_NAME_SUGGESTIONS: readonly string[] = [
  'Research Session',
  'Work Project',
  'Learning',
  'Shopping',
  'Reading',
  'Planning',
] as const;

/** Default blocked sites displayed in the DistractionBlocker */
export const DEFAULT_SUGGESTED_SITES: readonly string[] = [
  'reddit.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'netflix.com',
] as const;

/** Color palette inspired by Material Design / MUI */
export const COLORS = {
  /** Primary blue — calm and focused */
  primary: '#1976d2',
  primaryLight: '#64b5f6',
  primaryDark: '#1565c0',
  /** Secondary green — for success states and nature vibes */
  secondary: '#81c784',
  secondaryDark: '#66bb6a',
  /** Background colors — warm neutrals */
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceElevated: '#fafafa',
  /** Text colors */
  textPrimary: '#212121',
  textSecondary: '#757575',
  textHint: '#9e9e9e',
  /** State colors — all muted and calming, no harsh reds */
  success: '#81c784',
  warning: '#ffb74d',
  error: '#e57373',
  /** Focus mode colors — extra calming */
  focusBg: '#e3f2fd',
  focusBorder: '#bbdefb',
  /** Timer colors */
  timerWork: '#1976d2',
  timerBreak: '#81c784',
  timerLongBreak: '#ba68c8',
} as const;

/** Animation durations in milliseconds */
export const ANIMATIONS = {
  fast: 150,
  normal: 250,
  slow: 400,
  celebration: 800,
} as const;
