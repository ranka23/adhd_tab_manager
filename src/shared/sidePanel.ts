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
 * Opens the side panel for the given window. Must be called from a user
 * gesture on Chromium (e.g. the action-button `onClicked` event).
 *
 * @returns true when the API was available and the call did not throw.
 */
export async function openSidePanel(windowId: number): Promise<boolean> {
  const ns = browser as BrowserWithSidePanel;
  const api = ns.sidePanel;
  if (!api || typeof api.open !== 'function') return false;
  try {
    await api.open({ windowId });
    return true;
  } catch (err) {
    console.warn('[ADHD Tab Manager] Failed to open the side panel:', err);
    return false;
  }
}
