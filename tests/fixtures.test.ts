/**
 * Tests for the manual-testing import fixtures (scripts/e2e/test-fixtures).
 * Keeps the fixtures honest: each one must behave exactly as documented in
 * docs/manual-test-plan.md §10, and the "hostile" file must never be able to
 * pollute Object.prototype, even when the validator is fed its raw contents.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateBackupData } from '../src/popup/utils/validation';

const FIXTURES = resolve(__dirname, '../scripts/e2e/test-fixtures');

/** Parses a fixture file. Intentionally a plain JSON.parse — the hostile
 * fixture's "__proto__" keys arrive as own properties, which is exactly how
 * a hostile import would present them. */
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf8'));

describe('import fixtures (manual-test-plan §10)', () => {
  beforeEach(() => {
    // Baseline: Object.prototype must never be polluted.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (Object.prototype as any).polluted;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (Object.prototype as any).isAdmin;
  });

  it('valid-backup.json round-trips with all sections', () => {
    const result = validateBackupData(loadFixture('valid-backup.json'));
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions?.[0]?.tabs).toHaveLength(2);
    expect(result.blockedSites).toHaveLength(3);
    expect(result.timerSettings?.workMinutes).toBe(25);
  });

  it('partial-backup.json imports only the provided sections', () => {
    const result = validateBackupData(loadFixture('partial-backup.json'));
    expect(result.sessions).toBeUndefined();
    expect(result.blockedSites).toEqual([
      { domain: 'tiktok.com', addedAt: 1754055000000 },
    ]);
    expect(result.timerSettings?.pomodorosBeforeLongBreak).toBe(3);
  });

  it('malformed-sessions.json is rejected atomically', () => {
    expect(() => validateBackupData(loadFixture('malformed-sessions.json'))).toThrow(
      /invalid sessions/i,
    );
  });

  it('non-object.json is rejected', () => {
    expect(() => validateBackupData(loadFixture('non-object.json'))).toThrow(
      /not a valid backup/i,
    );
  });

  it('hostile-file.json is rejected and does not pollute Object.prototype', () => {
    const hostile = loadFixture('hostile-file.json') as Record<string, unknown>;
    // The attack payloads must actually be present in the parsed input…
    expect('__proto__' in hostile).toBe(true);
    expect('constructor' in hostile).toBe(true);
    // …but validation must reject the malformed session inside.
    expect(() => validateBackupData(hostile)).toThrow(/invalid sessions/i);
    // And nothing may have leaked onto Object.prototype along the way.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).polluted).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).isAdmin).toBeUndefined();
  });

  it('blocked-site-match-cases.json stays in sync with the validator shape', () => {
    const cases = loadFixture('blocked-site-match-cases.json') as {
      blockedDomain: string;
      shouldBlock: string[];
      shouldNotBlock: string[];
    };
    expect(typeof cases.blockedDomain).toBe('string');
    expect(cases.shouldBlock.length).toBeGreaterThan(0);
    expect(cases.shouldNotBlock.length).toBeGreaterThan(0);
  });
});
