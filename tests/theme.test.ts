/**
 * Tests for the theme utilities.
 * Covers persistence, system-preference fallback, and DOM application.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearStorage } from './setup';
import {
  getSystemTheme,
  applyTheme,
  getAppliedTheme,
  getStoredTheme,
  saveTheme,
  initTheme,
  isTheme,
} from '../src/popup/utils/theme';

describe('Theme utils', () => {
  beforeEach(async () => {
    await clearStorage();
    // Reset the document theme between tests
    delete document.documentElement.dataset.theme;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isTheme', () => {
    it('accepts only light and dark', () => {
      expect(isTheme('light')).toBe(true);
      expect(isTheme('dark')).toBe(true);
      expect(isTheme('blue')).toBe(false);
      expect(isTheme(undefined)).toBe(false);
    });
  });

  describe('getSystemTheme', () => {
    it('returns light when matchMedia is unavailable', () => {
      vi.stubGlobal('matchMedia', undefined);
      expect(getSystemTheme()).toBe('light');
    });

    it('returns dark when the OS prefers dark', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn() }),
      );
      expect(getSystemTheme()).toBe('dark');
    });
  });

  describe('applyTheme / getAppliedTheme', () => {
    it('applies and reads the theme on the document element', () => {
      applyTheme('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(getAppliedTheme()).toBe('dark');

      applyTheme('light');
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(getAppliedTheme()).toBe('light');
    });
  });

  describe('saveTheme / getStoredTheme', () => {
    it('persists and reads the theme preference', async () => {
      expect(await getStoredTheme()).toBeNull();

      await saveTheme('dark');
      expect(await getStoredTheme()).toBe('dark');

      await saveTheme('light');
      expect(await getStoredTheme()).toBe('light');
    });
  });

  describe('initTheme', () => {
    it('uses the stored preference when present', async () => {
      await saveTheme('dark');

      const theme = await initTheme();

      expect(theme).toBe('dark');
      expect(getAppliedTheme()).toBe('dark');
    });

    it('falls back to the system preference when nothing is stored', async () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() }),
      );

      const theme = await initTheme();

      expect(theme).toBe('light');
      expect(getAppliedTheme()).toBe('light');
    });
  });
});
