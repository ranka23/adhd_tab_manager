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

import { ALARM_NAMES, AUTO_SAVE_INTERVAL_MINUTES, STORAGE_KEYS } from '../shared/constants';
import type { FocusModeState, BlockedSite } from '../popup/types';
import { extractDomain } from '../popup/utils/helpers';

/* ============================================================
 * EXTENSION INSTALL / UPDATE
 * ============================================================ */

/**
 * Runs when the extension is first installed or updated.
 * Sets up initial alarms and default settings.
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First install — set up default alarms
    setupAlarms();
    // Initialize default blocked sites
    initializeDefaults();
  } else if (details.reason === 'update') {
    // Extension updated — ensure alarms are still set
    setupAlarms();
  }
});

/**
 * Sets up the recurring alarms for auto-save and timer.
 */
function setupAlarms(): void {
  // Auto-save tabs every 5 minutes
  chrome.alarms.create(ALARM_NAMES.AUTO_SAVE, {
    periodInMinutes: AUTO_SAVE_INTERVAL_MINUTES,
  });

  // Pomodoro timer tick every minute
  chrome.alarms.create(ALARM_NAMES.POMODORO_TICK, {
    periodInMinutes: 1,
  });
}

/**
 * Initializes default settings on first install.
 */
async function initializeDefaults(): Promise<void> {
  // Set up default blocked sites
  const DEFAULT_SITES = [
    'reddit.com',
    'twitter.com',
    'x.com',
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'netflix.com',
  ];

  const now = Date.now();
  const blockedSites: BlockedSite[] = DEFAULT_SITES.map((domain) => ({
    domain,
    addedAt: now,
  }));

  await chrome.storage.local.set({
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
chrome.alarms.onAlarm.addListener(async (alarm) => {
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
    const tabs = await chrome.tabs.query({});
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

    const result = await chrome.storage.local.get(STORAGE_KEYS.AUTO_SAVED_TABS);
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

    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTO_SAVED_TABS]: trimmed,
      [STORAGE_KEYS.LAST_AUTO_SAVE]: Date.now(),
    });
  } catch (err) {
    console.error('Auto-save error:', err);
  }
}

/**
 * Handles the Pomodoro timer tick.
 * Called every minute by the timer alarm.
 * Updates the remaining time and handles phase transitions.
 */
async function handlePomodoroTick(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_TIMER);
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

    await chrome.storage.local.set({
      [STORAGE_KEYS.ACTIVE_TIMER]: updatedState,
    });

    // If timer completed, send a notification
    if (newRemaining <= 0) {
      const phaseLabel = timerState.phase === 'work' ? 'Focus session' : 'Break';
      chrome.notifications.create({
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
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only check when the tab finishes loading a new URL
  if (changeInfo.status !== 'loading' || !tab.url) return;

  // Check if focus mode is active
  const focusResult = await chrome.storage.local.get(STORAGE_KEYS.FOCUS_MODE);
  const focusMode = focusResult[STORAGE_KEYS.FOCUS_MODE] as FocusModeState | undefined;

  if (!focusMode?.isActive) return;

  // Check if the site is on the blocked list
  const domain = extractDomain(tab.url);
  const blockedResult = await chrome.storage.local.get(STORAGE_KEYS.BLOCKED_SITES);
  const blockedSites: BlockedSite[] =
    (blockedResult[STORAGE_KEYS.BLOCKED_SITES] as BlockedSite[] | undefined) ?? [];

  const isBlocked = blockedSites.some((s) => s.domain === domain);
  if (!isBlocked) return;

  // Increment the distractions blocked counter
  const statsResult = await chrome.storage.local.get(STORAGE_KEYS.DISTRACTIONS_BLOCKED);
  const currentCount = (statsResult[STORAGE_KEYS.DISTRACTIONS_BLOCKED] as number | undefined) ?? 0;
  await chrome.storage.local.set({
    [STORAGE_KEYS.DISTRACTIONS_BLOCKED]: currentCount + 1,
  });

  // Redirect to a calm interstitial page
  // We use a data URL with a calming message
  const redirectHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #e3f2fd 0%, #f5f5f5 100%);
          color: #424242;
        }
        .container {
          text-align: center;
          max-width: 420px;
          padding: 40px;
        }
        .icon { font-size: 64px; margin-bottom: 24px; }
        h1 { font-size: 24px; font-weight: 600; margin-bottom: 12px; color: #1976d2; }
        p { font-size: 16px; color: #616161; margin-bottom: 8px; line-height: 1.6; }
        .domain { font-weight: 600; color: #212121; }
        .btn {
          display: inline-block;
          margin-top: 24px;
          padding: 12px 32px;
          border: none;
          border-radius: 24px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-primary {
          background: #1976d2;
          color: white;
        }
        .btn-primary:hover { background: #1565c0; }
        .btn-secondary {
          background: #e3f2fd;
          color: #1976d2;
          margin-left: 12px;
        }
        .btn-secondary:hover { background: #bbdefb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🧘</div>
        <h1>Pause and breathe</h1>
        <p>You were heading to <span class="domain">${domain}</span></p>
        <p>Is this intentional? You're in focus mode right now.</p>
        <button class="btn btn-primary" onclick="window.history.back()">
          Go Back
        </button>
        <button class="btn btn-secondary" onclick="window.close()">
          It's intentional
        </button>
      </div>
    </body>
    </html>
  `;

  // Encode the HTML as a data URL and redirect
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(redirectHtml)}`;
  await chrome.tabs.update(tabId, { url: dataUrl });
});

/* ============================================================
 * MESSAGE HANDLER
 * ============================================================ */

/**
 * Handles messages sent from the popup via chrome.runtime.sendMessage.
 * Routes messages to the appropriate handler.
 */
chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: Record<string, unknown> }, _sender, sendResponse) => {
    switch (message.type) {
      case 'GET_FOCUS_STATE':
        chrome.storage.local.get(STORAGE_KEYS.FOCUS_MODE).then((result) => {
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

/**
 * Log when the service worker starts up.
 * This helps with debugging extension lifecycle issues.
 */
console.info('ADHD Tab Manager background service worker started');
