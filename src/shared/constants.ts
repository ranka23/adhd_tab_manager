/**
 * Shared constants used across the extension (background worker, popup, services).
 * Centralizing these ensures consistency and makes changes easier.
 */

/** Storage keys for chrome.storage.local */
export const STORAGE_KEYS = {
  /** Key for saved tab sessions */
  SESSIONS: 'adhd_sessions',
  /** Key for the blocked sites list */
  BLOCKED_SITES: 'adhd_blocked_sites',
  /** Key for blocked sites active state */
  BLOCKED_SITES_ACTIVE: 'adhd_blocked_sites_active',
  /** Key for current focus mode state */
  FOCUS_MODE: 'adhd_focus_mode',
  /** Key for tabs saved before focus mode (for restoration) */
  FOCUS_SAVED_TABS: 'adhd_focus_saved_tabs',
  /** Key for the Pomodoro timer settings */
  TIMER_SETTINGS: 'adhd_timer_settings',
  /** Key for today's pomodoro count */
  TODAY_POMODOROS: 'adhd_today_pomodoros',
  /** Key for the current streak count */
  POMODORO_STREAK: 'adhd_pomodoro_streak',
  /** Key for auto-saved tabs (session saver) */
  AUTO_SAVED_TABS: 'adhd_auto_saved_tabs',
  /** Key for last auto-save timestamp */
  LAST_AUTO_SAVE: 'adhd_last_auto_save',
  /** Key for distractions blocked count */
  DISTRACTIONS_BLOCKED: 'adhd_distractions_blocked',
  /** Key for total focus minutes today */
  FOCUS_MINUTES_TODAY: 'adhd_focus_minutes_today',
  /** Key for the current active timer state */
  ACTIVE_TIMER: 'adhd_active_timer',
  /** Key for closed tabs history (undo-close) */
  CLOSED_TABS: 'adhd_closed_tabs',
} as const;

/** Default Pomodoro timer durations in minutes */
export const DEFAULT_TIMER = {
  WORK_MINUTES: 25,
  SHORT_BREAK_MINUTES: 5,
  LONG_BREAK_MINUTES: 15,
  /** Number of pomodoros before a long break */
  POMODOROS_BEFORE_LONG_BREAK: 4,
} as const;

/** Alarm names for chrome.alarms API */
export const ALARM_NAMES = {
  /** Alarm for auto-saving tabs every 5 minutes */
  AUTO_SAVE: 'adhd_auto_save',
  /** Alarm for the Pomodoro timer tick (every minute) */
  POMODORO_TICK: 'adhd_pomodoro_tick',
} as const;

/** Default blocked sites that are commonly distracting for ADHD users */
export const DEFAULT_BLOCKED_SITES: string[] = [
  'reddit.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'netflix.com',
];

/** Time in milliseconds between timer ticks */
export const TIMER_TICK_INTERVAL_MS = 1000;

/** Auto-save interval in minutes */
export const AUTO_SAVE_INTERVAL_MINUTES = 5;

/** Maximum number of closed tabs to keep in history for undo */
export const MAX_CLOSED_TABS_HISTORY = 20;

/** Maximum number of sessions to keep */
export const MAX_SESSIONS = 50;
