/**
 * Constants specific to the popup UI.
 * These are used by components and hooks within the popup.
 */

/** Motivational quotes shown in the DailyQuote component.
 *  Carefully curated for ADHD users — encouraging without being overwhelming. */
export const MOTIVATIONAL_QUOTES: readonly string[] = [
  'Your brain is wired for creativity. Channel it. ✨',
  'Progress, not perfection. Every tab counts. 🎯',
  'You are more than your distractions. 💙',
  'One thing at a time. You\'ve got this. 🌟',
  'Small steps lead to big wins. 🏆',
  'Focus is a skill, and you\'re building it. 💪',
  'Your attention is valuable. Protect it. 🛡️',
  'Today\'s effort is tomorrow\'s success. 🌱',
  'Be kind to your brain. It\'s doing its best. 🧠',
  'Deep breath. You\'re doing great. 🌊',
  'The best time to focus was yesterday. The second best time is now. ⏰',
  'Your future self will thank you for this. 🙏',
  'Every minute of focus is a victory. 🎉',
  'It\'s okay to start small. Just start. 🚀',
  'You don\'t have to be perfect to be amazing. 🌈',
] as const;

/** Session icon options for users to choose from */
export const SESSION_ICONS: readonly string[] = [
  '📋', '💼', '📚', '🎯', '🔬', '🎨', '💻', '🛒',
  '🏠', '✈️', '🎵', '🧪', '📝', '🌐', '💡', '🔧',
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
