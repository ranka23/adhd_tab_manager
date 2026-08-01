/**
 * Tests for backup validation (import safety).
 * Ensures malformed files are rejected before touching storage.
 */
import { describe, it, expect } from 'vitest';
import { validateBackupData } from '../src/popup/utils/validation';
import type { BlockedSite, TabInfo, TabSession, TimerSettings } from '../src/popup/types';

/** Builds a minimal valid TabInfo fixture */
const makeTab = (overrides: Partial<Pick<TabInfo, 'id' | 'url'>> = {}): TabInfo => ({
  id: overrides.id ?? 1,
  url: overrides.url ?? 'https://example.com',
  title: 'Example',
  favIconUrl: undefined,
  active: false,
  pinned: false,
  windowId: 1,
  index: 0,
});

/** Builds a minimal valid TabSession fixture */
const makeSession = (overrides: Partial<Pick<TabSession, 'id' | 'name'>> = {}): TabSession => ({
  id: overrides.id ?? 's1',
  name: overrides.name ?? 'Work',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  tabs: [makeTab()],
  icon: '📋',
});

/** Builds a minimal valid BlockedSite fixture */
const makeBlockedSite = (overrides: Partial<Pick<BlockedSite, 'domain'>> = {}): BlockedSite => ({
  domain: overrides.domain ?? 'reddit.com',
  addedAt: 1700000000000,
});

/** Minimal valid TimerSettings */
const makeTimerSettings = (): TimerSettings => ({
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  pomodorosBeforeLongBreak: 4,
});

describe('validateBackupData', () => {
  it('accepts a valid backup with all sections', () => {
    const result = validateBackupData({
      sessions: [makeSession()],
      blockedSites: [makeBlockedSite()],
      timerSettings: makeTimerSettings(),
      exportedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.blockedSites).toHaveLength(1);
    expect(result.timerSettings?.workMinutes).toBe(25);
  });

  it('accepts a backup with only some sections', () => {
    const result = validateBackupData({ sessions: [makeSession()] });

    expect(result.sessions).toHaveLength(1);
    expect(result.blockedSites).toBeUndefined();
    expect(result.timerSettings).toBeUndefined();
  });

  it('rejects non-object payloads', () => {
    expect(() => validateBackupData(null)).toThrow(/not a valid backup/i);
    expect(() => validateBackupData([])).toThrow(/not a valid backup/i);
    expect(() => validateBackupData('hello')).toThrow(/not a valid backup/i);
    expect(() => validateBackupData(42)).toThrow(/not a valid backup/i);
  });

  it('rejects backups with malformed sessions', () => {
    expect(() =>
      validateBackupData({
        sessions: [{ id: 's1', name: 'Work' }], // missing timestamps/tabs
      }),
    ).toThrow(/invalid sessions/i);
  });

  it('rejects sessions containing malformed tabs', () => {
    expect(() =>
      validateBackupData({
        sessions: [makeSession({ id: 's1' })].map((s) => ({
          ...s,
          tabs: [{ id: 'not-a-number', url: 123 }],
        })),
      }),
    ).toThrow(/invalid sessions/i);
  });

  it('rejects backups with malformed blocked sites', () => {
    expect(() =>
      validateBackupData({ blockedSites: [{ domain: 123 }] }),
    ).toThrow(/invalid blocked sites/i);
  });

  it('rejects backups with malformed timer settings', () => {
    expect(() =>
      validateBackupData({ timerSettings: { workMinutes: -5 } }),
    ).toThrow(/invalid timer settings/i);
  });

  it('rejects backups with no recognizable data', () => {
    expect(() => validateBackupData({ hello: 'world' })).toThrow(
      /no recognizable data/i,
    );
  });

  it('does not mutate the input object', () => {
    const input = { sessions: [makeSession()] };
    const snapshot = JSON.stringify(input);
    validateBackupData(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
