/**
 * Theme utilities — manage the popup's light/dark theme.
 * Persists the preference to chrome.storage.local so it survives popup
 * close/reopen, and applies it to the DOM before React mounts to avoid
 * a flash of the wrong theme.
 */

import { STORAGE_KEYS } from '../../shared/constants';
import { browser } from '../../shared/browser';

/** Supported theme values */
export type Theme = 'light' | 'dark';

/** Validates that a stored value is a supported theme */
export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Returns the user's OS-level color scheme preference */
export function getSystemTheme(): Theme {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

/** Applies a theme to the document (sets data-theme on <html>) */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/** Reads the theme currently applied to the document */
export function getAppliedTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Reads the persisted theme preference, or null if never set */
export async function getStoredTheme(): Promise<Theme | null> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.THEME);
    const stored = result[STORAGE_KEYS.THEME];
    return isTheme(stored) ? stored : null;
  } catch (err) {
    console.error('theme: Failed to read stored theme:', err);
    return null;
  }
}

/** Persists the theme preference to storage */
export async function saveTheme(theme: Theme): Promise<void> {
  try {
    await browser.storage.local.set({ [STORAGE_KEYS.THEME]: theme });
  } catch (err) {
    console.error('theme: Failed to save theme:', err);
  }
}

/**
 * Resolves the effective theme (stored preference, falling back to the
 * system preference), applies it to the document, and returns it.
 * Safe to call before React mounts.
 */
export async function initTheme(): Promise<Theme> {
  const stored = await getStoredTheme();
  const theme = stored ?? getSystemTheme();
  applyTheme(theme);
  return theme;
}
