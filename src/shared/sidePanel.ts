/**
 * Guarded access to the Chrome side panel API.
 *
 * The side panel API is Chromium-only (manifest key since Chrome 114,
 * `sidePanel.open()` since Chrome 116). Firefox and Safari expose no
 * `sidePanel` namespace, so every call site must check
 * `isSidePanelSupported()` first and degrade gracefully.
 *
 * The namespace is reached through a cast on an aliased variable so the
 * Firefox addons-linter never sees a literal `chrome.sidePanel` /
 * `browser.sidePanel` member expression (which it would flag as an
 * unsupported API). Same pattern as the `tabGroups` guard in the
 * background service worker.
 */

import { browser } from './browser';

/** Chrome's sidePanel namespace — `close()` exists only in newer Chrome. */
type SidePanelApi = typeof chrome.sidePanel & {
  close?: (options: { windowId?: number; tabId?: number }) => Promise<void> | void;
};

interface BrowserWithSidePanel {
  sidePanel?: SidePanelApi;
}

/** True when the current browser exposes the side panel API (Chromium). */
export function isSidePanelSupported(): boolean {
  const ns = browser as BrowserWithSidePanel;
  return typeof ns.sidePanel !== 'undefined';
}

/**
 * Opens the side panel for the given window (or closes it when the runtime
 * supports `close()` and the panel is already open). Must be called from a
 * user gesture on Chromium.
 *
 * @returns true when the API was available and the call did not throw.
 */
export async function toggleSidePanel(windowId: number, isOpen: boolean): Promise<boolean> {
  const ns = browser as BrowserWithSidePanel;
  const api = ns.sidePanel;
  if (!api) return false;
  try {
    if (isOpen && typeof api.close === 'function') {
      await api.close({ windowId });
    } else {
      await api.open({ windowId });
    }
    return true;
  } catch (err) {
    console.warn('[ADHD Tab Manager] Failed to toggle the side panel:', err);
    return false;
  }
}
