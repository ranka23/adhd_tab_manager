/**
 * Backup validation — shape-checks exported JSON before it is written to
 * chrome.storage.local during import. Prevents a malformed or hostile file
 * from corrupting the extension's data.
 */

import type { BlockedSite, TabInfo, TabSession, TimerSettings } from '../types';

/** Sanitized, validated payload ready to be written to storage */
export interface ValidatedBackup {
  sessions?: TabSession[];
  blockedSites?: BlockedSite[];
  timerSettings?: TimerSettings;
}

/** True if the value is a finite, positive number */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** True if the value is a non-empty string */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Shape-checks a single TabInfo */
function isTabInfo(value: unknown): value is TabInfo {
  if (typeof value !== 'object' || value === null) return false;
  const tab = value as Record<string, unknown>;
  return (
    typeof tab.id === 'number' &&
    typeof tab.url === 'string' &&
    typeof tab.title === 'string' &&
    typeof tab.active === 'boolean' &&
    typeof tab.pinned === 'boolean' &&
    typeof tab.windowId === 'number' &&
    typeof tab.index === 'number'
  );
}

/** Shape-checks a single TabSession */
function isTabSession(value: unknown): value is TabSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Record<string, unknown>;
  return (
    isNonEmptyString(session.id) &&
    isNonEmptyString(session.name) &&
    isFiniteNumber(session.createdAt) &&
    isFiniteNumber(session.updatedAt) &&
    typeof session.icon === 'string' &&
    Array.isArray(session.tabs) &&
    session.tabs.every(isTabInfo)
  );
}

/** Shape-checks a single BlockedSite */
function isBlockedSite(value: unknown): value is BlockedSite {
  if (typeof value !== 'object' || value === null) return false;
  const site = value as Record<string, unknown>;
  return isNonEmptyString(site.domain) && isFiniteNumber(site.addedAt);
}

/** Shape-checks TimerSettings */
function isTimerSettings(value: unknown): value is TimerSettings {
  if (typeof value !== 'object' || value === null) return false;
  const settings = value as Record<string, unknown>;
  return (
    isFiniteNumber(settings.workMinutes) &&
    settings.workMinutes > 0 &&
    isFiniteNumber(settings.shortBreakMinutes) &&
    settings.shortBreakMinutes > 0 &&
    isFiniteNumber(settings.longBreakMinutes) &&
    settings.longBreakMinutes > 0 &&
    isFiniteNumber(settings.pomodorosBeforeLongBreak) &&
    settings.pomodorosBeforeLongBreak > 0
  );
}

/**
 * Validates a parsed backup object.
 * Returns a sanitized payload containing only the fields that passed
 * validation. Throws an Error with a human-readable reason when the data
 * is not a valid backup object or every provided section is malformed.
 *
 * @param data - The parsed JSON value from the import file
 * @returns Sanitized sections ready to write to storage
 */
export function validateBackupData(data: unknown): ValidatedBackup {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Not a valid backup file — expected a JSON object.');
  }

  const source = data as Record<string, unknown>;
  const result: ValidatedBackup = {};

  if (source.sessions !== undefined) {
    if (!Array.isArray(source.sessions) || !source.sessions.every(isTabSession)) {
      throw new Error('Backup contains invalid sessions — nothing was imported.');
    }
    result.sessions = source.sessions;
  }

  if (source.blockedSites !== undefined) {
    if (!Array.isArray(source.blockedSites) || !source.blockedSites.every(isBlockedSite)) {
      throw new Error('Backup contains invalid blocked sites — nothing was imported.');
    }
    result.blockedSites = source.blockedSites;
  }

  if (source.timerSettings !== undefined) {
    if (!isTimerSettings(source.timerSettings)) {
      throw new Error('Backup contains invalid timer settings — nothing was imported.');
    }
    result.timerSettings = source.timerSettings;
  }

  if (result.sessions === undefined && result.blockedSites === undefined && result.timerSettings === undefined) {
    throw new Error('Backup contains no recognizable data — nothing was imported.');
  }

  return result;
}
