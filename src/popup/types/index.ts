/**
 * Type definitions for the ADHD Tab Manager extension.
 * All types are centralized here for consistency across the codebase.
 */

/** Represents a single Chrome tab with the info we care about */
export interface TabInfo {
  /** Chrome tab ID */
  id: number;
  /** Tab URL */
  url: string;
  /** Tab title */
  title: string;
  /** Favicon URL */
  favIconUrl: string | undefined;
  /** Whether the tab is active (selected) */
  active: boolean;
  /** Whether the tab is pinned */
  pinned: boolean;
  /** Chrome window ID the tab belongs to */
  windowId: number;
  /** Index of the tab in its window */
  index: number;
}

/** A saved session containing multiple tabs */
export interface TabSession {
  /** Unique identifier for the session */
  id: string;
  /** User-friendly name for the session */
  name: string;
  /** Timestamp when the session was created */
  createdAt: number;
  /** Timestamp when the session was last updated */
  updatedAt: number;
  /** The tabs saved in this session */
  tabs: TabInfo[];
  /** Optional emoji icon for the session */
  icon: string;
}

/** Focus mode state */
export interface FocusModeState {
  /** Whether focus mode is currently active */
  isActive: boolean;
  /** Timestamp when focus mode was started */
  startedAt: number | null;
  /** Tabs that were open when focus mode started (for restoration) */
  savedTabIds: number[];
}

/** Pomodoro timer state */
export interface TimerState {
  /** Current phase of the timer */
  phase: TimerPhase;
  /** Whether the timer is currently running */
  isRunning: boolean;
  /** Remaining seconds in the current phase */
  remainingSeconds: number;
  /** Total seconds for the current phase (for progress calculation) */
  totalSeconds: number;
  /** Number of pomodoros completed in the current cycle */
  completedInCycle: number;
  /** Timestamp when the timer was last started */
  startedAt: number | null;
  /** Timestamp when the timer was paused */
  pausedAt: number | null;
}

/** Timer phases */
export type TimerPhase = 'work' | 'shortBreak' | 'longBreak' | 'idle';

/** Timer settings (user-customizable) */
export interface TimerSettings {
  /** Duration of work phase in minutes */
  workMinutes: number;
  /** Duration of short break in minutes */
  shortBreakMinutes: number;
  /** Duration of long break in minutes */
  longBreakMinutes: number;
  /** Number of pomodoros before a long break */
  pomodorosBeforeLongBreak: number;
}

/** A site in the blocked sites list */
export interface BlockedSite {
  /** Domain to block (e.g., "reddit.com") */
  domain: string;
  /** When this site was added to the block list */
  addedAt: number;
}

/** Daily stats for the motivation/summary feature */
export interface DailyStats {
  /** Total minutes spent in focus mode today */
  focusMinutes: number;
  /** Number of pomodoros completed today */
  pomodorosCompleted: number;
  /** Number of distractions blocked today */
  distractionsBlocked: number;
  /** Number of sessions saved today */
  sessionsSaved: number;
  /** Current pomodoro streak */
  currentStreak: number;
}

/** Message types for communication between popup and background worker */
export type MessageType =
  | 'START_FOCUS'
  | 'END_FOCUS'
  | 'GET_FOCUS_STATE'
  | 'GET_TABS'
  | 'CLOSE_TAB'
  | 'RESTORE_TAB'
  | 'BLOCKED_SITE_ACCESSED'
  | 'TIMER_TICK'
  | 'TIMER_COMPLETE'
  | 'AUTO_SAVE'
  | 'INCREMENT_DISTRACTIONS'
  | 'GET_DAILY_STATS';

/** Message sent between popup and background worker */
export interface ExtensionMessage {
  type: MessageType;
  payload?: Record<string, unknown>;
}

/** Response from background worker */
export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** The shape of data stored for a closed tab (for undo functionality) */
export interface ClosedTabRecord {
  /** The tab info before it was closed */
  tab: TabInfo;
  /** Timestamp when the tab was closed */
  closedAt: number;
  /** Index position where the tab was (for restoring to same position) */
  originalIndex: number;
}

/** All data stored in chrome.storage.local */
export interface StorageData {
  [key: string]: unknown;
}
