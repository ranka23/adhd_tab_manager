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
  /** Key for the date (YYYY-MM-DD) of the last completed pomodoro — used to
   * compute a real day-based streak that resets after a missed day. */
  LAST_POMODORO_DATE: 'adhd_last_pomodoro_date',
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
  /** Key for the user's theme preference ('light' | 'dark') */
  THEME: 'adhd_theme',
  /** Key for the number of sessions saved today */
  SESSIONS_SAVED_TODAY: 'adhd_sessions_saved_today',
  /** Key for the popup heartbeat (ms timestamp). Lets the background page
   * detect an open popup on Firefox, which lacks runtime.getContexts. */
  POPUP_HEARTBEAT: 'adhd_popup_heartbeat',
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

/** How often the popup refreshes its heartbeat while open (ms) */
export const POPUP_HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * How old the popup heartbeat may be before the popup is considered closed (ms).
 * Must be comfortably larger than POPUP_HEARTBEAT_INTERVAL_MS to tolerate
 * throttled intervals, but small enough that a closed popup is detected
 * within one pomodoro minute-tick.
 */
export const POPUP_HEARTBEAT_STALE_MS = 45_000;

/** Auto-save interval in minutes */
export const AUTO_SAVE_INTERVAL_MINUTES = 5;

/** Maximum number of closed tabs to keep in history for undo */
export const MAX_CLOSED_TABS_HISTORY = 20;

/** Maximum number of sessions to keep */
export const MAX_SESSIONS = 50;

/* ═══════════════════════════════════════════════════════
 * DONATIONS & OPEN SOURCE
 * ═══════════════════════════════════════════════════════ */

/** Ethereum wallet address for donations (same as the SideRouter project). */
export const DONATION_ETH_ADDRESS = '0x907DB6Ad294bD6B9adAE4C2340d34883E32F121A';

/** Solana wallet address for donations (same as the SideRouter project). */
export const DONATION_SOL_ADDRESS = 'H9kw2HG3eik5uKYoULHuzohoY7gCi1Jfqk38ppn1Szyo';

/** Path (relative to the extension root) of the ETH wallet QR code image. */
export const DONATION_QR_ETH = 'donate/eth-address.jpg';

/** Path (relative to the extension root) of the SOL wallet QR code image. */
export const DONATION_QR_SOL = 'donate/sol-address.jpg';

/**
 * The open-source repository page shown in the donation modal footer.
 * ADHD Tab Manager is free and open source — donations help keep it alive.
 */
export const SOURCE_URL = 'https://github.com/ranka23/adhd-tab-manager';

/** GitHub Issues page — used by the "Request New Feature or Report a Bug" card. */
export const ISSUES_URL = `${SOURCE_URL}/issues`;

/* ═══════════════════════════════════════════════════════
 * DEBUG LOGGING & STORAGE VERSION
 * ═══════════════════════════════════════════════════════ */

/** Key used to store the storage schema version for migration */
export const STORAGE_VERSION_KEY = 'adhd_version' as const;

/** Current storage schema version — bump when making breaking changes */
export const STORAGE_VERSION = 1 as const;

/**
 * Debug logging flag. Set to true to enable verbose console logging
 * of storage writes, message sends, and API calls.
 * Toggle via ?debug=true URL param or localStorage.debugMode.
 */
export const DEBUG =
  (typeof window !== 'undefined' &&
    (window.location.search.includes('debug=true') ||
      localStorage.getItem('debugMode') === 'true')) ||
  false;

/**
 * Log arguments to console only when DEBUG is true.
 * Tags each log with the module name for easy filtering.
 */
export function debugLog(module: string, ...args: unknown[]): void {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(`[${module}]`, ...args);
  }
}
