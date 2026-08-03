/**
 * Background service worker for the ADHD Tab Manager extension.
 *
 * Runs in the background even when the popup is closed.
 * Responsibilities:
 * - Manages auto-save alarm (every 5 minutes)
 * - Handles Pomodoro timer ticking via alarms
 * - Monitors tab navigation for blocked sites
 * - Processes messages from the popup
 *
 * Manifest V3 service workers are event-driven and have a limited lifetime,
 * so we use chrome.alarms for persistent scheduling.
 */

import { ALARM_NAMES, AUTO_SAVE_INTERVAL_MINUTES, DEFAULT_BLOCKED_SITES, POPUP_HEARTBEAT_STALE_MS, STORAGE_KEYS, STORAGE_VERSION, STORAGE_VERSION_KEY } from '../shared/constants';
import type { FocusModeState, BlockedSite } from '../popup/types';
import { extractDomain } from '../popup/utils/helpers';
import { matchesBlockedPattern } from '../popup/services/blockService';
import { browser } from '../shared/browser';

/* ============================================================
 * EXTENSION INSTALL / UPDATE
 * ============================================================ */

/**
 * Runs when the extension is first installed or updated.
 * Sets up initial alarms and default settings.
 */
/* ═══════════════════════════════════════════════════════
 * STORAGE VERSION & MIGRATION
 * ═══════════════════════════════════════════════════════ */

/**
 * Map of migration functions keyed by the version they migrate TO.
 * Add new migrations here when STORAGE_VERSION is bumped.
 */
const migrations: Record<number, () => Promise<void>> = {
  // 1: initial schema — no migrations needed yet
};

/**
 * Check the stored version against the current STORAGE_VERSION.
 * If the stored version is behind, run all pending migrations sequentially.
 */
async function checkAndMigrate(): Promise<void> {
  const result = await browser.storage.local.get(STORAGE_VERSION_KEY);
  const storedVersion = (result[STORAGE_VERSION_KEY] as number | undefined) ?? 0;

  if (storedVersion >= STORAGE_VERSION) {
    return;
  }

  console.info(
    `[ADHD Tab Manager] Storage version ${storedVersion} → ${STORAGE_VERSION}. Running migrations…`,
  );

  for (let v = storedVersion + 1; v <= STORAGE_VERSION; v++) {
    const migrateFn = migrations[v];
    if (migrateFn) {
      await migrateFn();
    }
    await browser.storage.local.set({ [STORAGE_VERSION_KEY]: v });
  }

  console.info('[ADHD Tab Manager] Migration complete.');
}

/** Runs on install/update — sets up alarms, defaults, and runs migrations */
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First install — set up default alarms
    setupAlarms();
    // Initialize default blocked sites
    initializeDefaults();
  } else if (details.reason === 'update') {
    // Extension updated — ensure alarms are still set
    setupAlarms();
  }

  // Run data migrations
  checkAndMigrate();
});

/**
 * Sets up the recurring alarms for auto-save and timer.
 */
function setupAlarms(): void {
  // Auto-save tabs every 5 minutes
  try {
    browser.alarms.create(ALARM_NAMES.AUTO_SAVE, {
      periodInMinutes: AUTO_SAVE_INTERVAL_MINUTES,
    });
  } catch (err) {
    console.warn('[ADHD Tab Manager] Failed to create auto-save alarm:', err);
  }

  // Pomodoro timer tick every minute
  try {
    browser.alarms.create(ALARM_NAMES.POMODORO_TICK, {
      periodInMinutes: 1,
    });
  } catch (err) {
    console.warn('[ADHD Tab Manager] Failed to create pomodoro tick alarm:', err);
  }
}

/**
 * Initializes default settings on first install.
 */
async function initializeDefaults(): Promise<void> {
  const now = Date.now();
  const blockedSites: BlockedSite[] = DEFAULT_BLOCKED_SITES.map((domain) => ({
    domain,
    addedAt: now,
  }));

  await browser.storage.local.set({
    [STORAGE_KEYS.BLOCKED_SITES]: blockedSites,
    [STORAGE_KEYS.BLOCKED_SITES_ACTIVE]: false,
    [STORAGE_KEYS.FOCUS_MODE]: {
      isActive: false,
      startedAt: null,
      savedTabIds: [],
    },
  });
}

/* ============================================================
 * ALARM HANDLER
 * ============================================================ */

/**
 * Handles alarm events from chrome.alarms API.
 * Routes to the appropriate handler based on alarm name.
 */
browser.alarms.onAlarm.addListener(async (alarm) => {
  switch (alarm.name) {
    case ALARM_NAMES.AUTO_SAVE:
      await handleAutoSave();
      break;
    case ALARM_NAMES.POMODORO_TICK:
      await handlePomodoroTick();
      break;
  }
});

/**
 * Auto-saves all open tabs to storage.
 * Called every 5 minutes by the auto-save alarm.
 */
async function handleAutoSave(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({});
    const tabInfos = tabs
      .filter((tab) => tab.url && tab.id)
      .map((tab) => ({
        id: tab.id!,
        url: tab.url!,
        title: tab.title ?? 'Untitled',
        favIconUrl: tab.favIconUrl,
        active: tab.active ?? false,
        pinned: tab.pinned ?? false,
        windowId: tab.windowId ?? 0,
        index: tab.index ?? 0,
      }));

    // Get today's start for filtering
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const result = await browser.storage.local.get(STORAGE_KEYS.AUTO_SAVED_TABS);
    const existing: Array<{
      timestamp: number;
      tabs: typeof tabInfos;
      tabCount: number;
    }> = (result[STORAGE_KEYS.AUTO_SAVED_TABS] as typeof existing | undefined) ?? [];

    // Filter to today's entries only
    const recent = existing.filter((e) => e.timestamp > todayStart.getTime());

    // Add the new entry
    recent.push({
      timestamp: Date.now(),
      tabs: tabInfos,
      tabCount: tabInfos.length,
    });

    // Keep max 24 entries
    const trimmed = recent.slice(-24);

    await browser.storage.local.set({
      [STORAGE_KEYS.AUTO_SAVED_TABS]: trimmed,
      [STORAGE_KEYS.LAST_AUTO_SAVE]: Date.now(),
    });
  } catch (err) {
    console.error('Auto-save error:', err);
  }
}

/**
 * Returns true when a page that ticks the pomodoro locally is open (the
 * popup or the side panel).
 * Used to avoid double-decrementing the timer: when such a page is open it
 * ticks every second, so the service worker must skip its own once-per-minute
 * decrement to prevent the timer from running fast.
 *
 * Chrome 116+ can query contexts directly (runtime.getContexts). Firefox
 * event pages lack that API, so it falls back to the popup heartbeat: the
 * popup writes STORAGE_KEYS.POPUP_HEARTBEAT (a ms timestamp) every 30s while
 * open, and a heartbeat fresher than POPUP_HEARTBEAT_STALE_MS means a
 * timer surface is up.
 */
async function isTimerSurfaceOpen(): Promise<boolean> {
  const runtime = browser.runtime as unknown as {
    getContexts?: (filter: { contextTypes: string[] }) => Promise<unknown[]>;
  };
  if (typeof runtime.getContexts === 'function') {
    try {
      const contexts = await runtime.getContexts({ contextTypes: ['POPUP', 'SIDE_PANEL'] });
      return contexts.length > 0;
    } catch (err) {
      console.warn('[ADHD Tab Manager] Failed to check popup context:', err);
    }
  }

  // Firefox / older Chrome: no getContexts — use the popup heartbeat.
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.POPUP_HEARTBEAT);
    const heartbeat = result[STORAGE_KEYS.POPUP_HEARTBEAT] as number | undefined;
    return typeof heartbeat === 'number' && Date.now() - heartbeat < POPUP_HEARTBEAT_STALE_MS;
  } catch (err) {
    console.warn('[ADHD Tab Manager] Failed to read popup heartbeat:', err);
    return false;
  }
}

/**
 * Handles the Pomodoro timer tick.
 * Called every minute by the timer alarm.
 * Updates the remaining time and handles phase transitions.
 */
async function handlePomodoroTick(): Promise<void> {
  try {
    // The popup/side panel ticks the timer itself every second while open —
    // skip to avoid a double-decrement race that would make the timer run fast.
    if (await isTimerSurfaceOpen()) {
      return;
    }

    const result = await browser.storage.local.get(STORAGE_KEYS.ACTIVE_TIMER);
    const timerState = result[STORAGE_KEYS.ACTIVE_TIMER] as
      | {
          phase: string;
          isRunning: boolean;
          remainingSeconds: number;
          totalSeconds: number;
          completedInCycle: number;
        }
      | undefined;

    if (!timerState || !timerState.isRunning || timerState.remainingSeconds <= 0) {
      return;
    }

    // Decrement the remaining time
    const newRemaining = timerState.remainingSeconds - 1;
    const updatedState = {
      ...timerState,
      remainingSeconds: newRemaining,
      isRunning: newRemaining > 0,
    };

    await browser.storage.local.set({
      [STORAGE_KEYS.ACTIVE_TIMER]: updatedState,
    });

    // If timer completed, send a notification
    if (newRemaining <= 0) {
      const phaseLabel = timerState.phase === 'work' ? 'Focus session' : 'Break';
      browser.notifications.create({
        type: 'basic',
        iconUrl: 'public/icons/icon128.png',
        title: `${phaseLabel} complete!`,
        message:
          timerState.phase === 'work'
            ? 'Time for a break. You earned it! 🎉'
            : 'Break is over. Ready to focus? 🧠',
        priority: 2,
      });
    }
  } catch (err) {
    console.error('Pomodoro tick error:', err);
  }
}

/* ============================================================
 * TAB NAVIGATION MONITOR
 * ============================================================ */

/**
 * Monitors when tabs navigate to new URLs.
 * If focus mode is active and the URL is on the blocked list,
 * redirects the tab to a calm interstitial page.
 */
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only check when the tab finishes loading a new URL
  if (changeInfo.status !== 'loading' || !tab.url) return;

  // Check if focus mode is active
  const focusResult = await browser.storage.local.get(STORAGE_KEYS.FOCUS_MODE);
  const focusMode = focusResult[STORAGE_KEYS.FOCUS_MODE] as FocusModeState | undefined;

  if (!focusMode?.isActive) return;

  // The blocker must be enabled too — the user can toggle it off mid-focus
  // from the Block tab, and redirects should stop until focus restarts it.
  const activeResult = await browser.storage.local.get(STORAGE_KEYS.BLOCKED_SITES_ACTIVE);
  if (activeResult[STORAGE_KEYS.BLOCKED_SITES_ACTIVE] !== true) return;

  // Check if the site is on the blocked list
  const domain = extractDomain(tab.url);
  const blockedResult = await browser.storage.local.get(STORAGE_KEYS.BLOCKED_SITES);
  const blockedSites: BlockedSite[] =
    (blockedResult[STORAGE_KEYS.BLOCKED_SITES] as BlockedSite[] | undefined) ?? [];

  const isBlocked = blockedSites.some((s) => matchesBlockedPattern(domain, s.domain));
  if (!isBlocked) return;

  // Increment the distractions blocked counter
  const statsResult = await browser.storage.local.get(STORAGE_KEYS.DISTRACTIONS_BLOCKED);
  const currentCount = (statsResult[STORAGE_KEYS.DISTRACTIONS_BLOCKED] as number | undefined) ?? 0;
  await browser.storage.local.set({
    [STORAGE_KEYS.DISTRACTIONS_BLOCKED]: currentCount + 1,
  });

  // Redirect to a calm interstitial page (a real extension page — Chrome no
  // longer reliably commits data: URL navigations from tabs.update).
  const interstitialUrl = `${browser.runtime.getURL('interstitial.html')}?blocked=${encodeURIComponent(domain)}`;
  await browser.tabs.update(tabId, { url: interstitialUrl });
});

/* ============================================================
 * MESSAGE HANDLER
 * ============================================================ */

/**
 * Handles messages sent from the popup via chrome.runtime.sendMessage.
 * Routes messages to the appropriate handler.
 */
browser.runtime.onMessage.addListener(
  (message: { type: string; payload?: Record<string, unknown> }, _sender, sendResponse) => {
    switch (message.type) {
      case 'GET_FOCUS_STATE':
        browser.storage.local.get(STORAGE_KEYS.FOCUS_MODE).then((result) => {
          sendResponse({
            success: true,
            data: result[STORAGE_KEYS.FOCUS_MODE],
          });
        });
        return true; // Keep the message channel open for async response

      case 'AUTO_SAVE':
        handleAutoSave().then(() => {
          sendResponse({ success: true });
        });
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
        return false;
    }
  },
);

/* Run data migration check on every service worker wake */
checkAndMigrate();

/**
 * Log when the service worker starts up.
 * This helps with debugging extension lifecycle issues.
 */
console.info('ADHD Tab Manager background service worker started');

/* ============================================================
 * ACTION BUTTON — open the default surface
 * ============================================================ */

/**
 * With no `default_popup` in the manifest, clicking the toolbar icon fires
 * `action.onClicked`. That is the entry point to the extension's default
 * surface:
 *
 *  - Chromium (Chrome / Edge): opens the side panel for the clicked window.
 *  - Firefox: opens the sidebar (`sidebar_action`), its side-panel surface.
 *  - Safari: has a `default_popup` restored by the Safari build, so this
 *    handler never fires there.
 *
 * Both namespaces are reached through casts on aliased variables so the
 * Firefox addons-linter never sees a literal `chrome.sidePanel` or
 * `browser.sidebarAction` member expression it can't resolve.
 */
interface SidePanelLike {
  sidePanel?: { open: (opts: { windowId?: number }) => Promise<void> | void };
}
interface SidebarLike {
  sidebarAction?: { open: () => Promise<void> | void };
}

browser.action.onClicked.addListener(async (tab) => {
  // Chromium: the side panel is the default surface. Resolve the target
  // window (the clicked tab's window; fall back to the last focused one).
  const win = await browser.windows.getLastFocused().catch(() => null);
  const windowId: number | undefined = tab.windowId ?? win?.id ?? undefined;
  const sidePanelNs = browser as unknown as SidePanelLike;
  if (windowId != null && typeof sidePanelNs.sidePanel?.open === 'function') {
    try {
      await sidePanelNs.sidePanel.open({ windowId });
      return;
    } catch (err) {
      console.warn('[ADHD Tab Manager] Failed to open the side panel from the action button:', err);
    }
  }

  // Firefox: open the sidebar (its side-panel surface).
  const sidebarNs = browser as unknown as SidebarLike;
  if (typeof sidebarNs.sidebarAction?.open === 'function') {
    try {
      await sidebarNs.sidebarAction.open();
    } catch (err) {
      console.warn('[ADHD Tab Manager] Failed to open the sidebar from the action button:', err);
    }
  }
});

/* ============================================================
 * TAB DISCARDING DETECTION
 * ============================================================ */

/**
 * When a tab is discarded (replaced by a new URL), the old tab's group
 * assignment is lost. Auto-remove discarded tabs from their group.
 *
 * Tab groups are Chromium-only; Firefox has no tabGroups/ungroup API, so this
 * listener is a guarded no-op there. The API is reached through an alias so
 * the Firefox addons-linter doesn't statically flag the Chromium-only call.
 */
const tabsApi = browser.tabs as typeof browser.tabs & {
  ungroup?: (tabId: number) => Promise<void>;
};

browser.tabs.onReplaced.addListener(async (addedTabId, _removedTabId) => {
  try {
    const tab = await browser.tabs.get(addedTabId).catch(() => null);
    if (tab && typeof tabsApi.ungroup === 'function' && tab.groupId !== browser.tabs.TAB_ID_NONE) {
      // Tab was discarded but still has a group — ungroup it
      await tabsApi.ungroup(addedTabId).catch(() => {
        /* May fail if tab was already ungrouped */
      });
      console.info(`[ADHD Tab Manager] Tab ${addedTabId} was discarded, removed from group ${tab.groupId}`);
    }
  } catch {
    // Tab may no longer exist
  }
});
