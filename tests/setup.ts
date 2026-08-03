/**
 * Test setup file — configures the testing environment.
 * Sets up jsdom for DOM testing and mocks Chrome extension APIs.
 *
 * The tab/window/storage mocks expose `emit(...)` helpers so tests can
 * simulate live browser events (e.g. tabs.onCreated) and verify that the
 * hooks' live-data listeners react to them.
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';

/**
 * Creates a listener registry with addListener/removeListener and an `emit`
 * helper that fires all registered listeners (for simulating live events).
 */
function makeListeners<TArgs extends unknown[]>(): {
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  emit: (...args: TArgs) => void;
  count: () => number;
} {
  const listeners = new Set<(...args: TArgs) => void>();
  return {
    addListener: vi.fn((fn: (...args: TArgs) => void) => {
      listeners.add(fn);
    }),
    removeListener: vi.fn((fn: (...args: TArgs) => void) => {
      listeners.delete(fn);
    }),
    emit: (...args: TArgs): void => {
      for (const fn of [...listeners]) {
        fn(...args);
      }
    },
    /** Number of currently registered listeners */
    count: (): number => listeners.size,
  };
}

/**
 * Mock chrome.storage.local API.
 * Chrome extension APIs aren't available in the test environment,
 * so we create a simple in-memory implementation.
 */
const storage: Record<string, unknown> = {};

const chromeStorageLocal = {
  get: vi.fn(async (keys: string | string[]) => {
    const keyList = typeof keys === 'string' ? [keys] : keys;
    const result: Record<string, unknown> = {};
    for (const key of keyList) {
      if (key in storage) {
        result[key] = storage[key];
      }
    }
    return result;
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(storage, items);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    const keyList = typeof keys === 'string' ? [keys] : keys;
    for (const key of keyList) {
      delete storage[key];
    }
  }),
  clear: vi.fn(async () => {
    Object.keys(storage).forEach((key) => {
      delete storage[key];
    });
  }),
};

const chromeStorageOnChanged = makeListeners<[Record<string, unknown>, string]>();

/** In-memory store shared by local + session areas */
const sessionStorage: Record<string, unknown> = {};

/** Mock chrome.storage.session API (used for timer persistence). */
const chromeStorageSession = {
  get: vi.fn(async (keys?: string | string[] | null) => {
    if (keys == null) return { ...sessionStorage };
    const keyList = typeof keys === 'string' ? [keys] : keys;
    const result: Record<string, unknown> = {};
    for (const key of keyList) {
      if (key in sessionStorage) {
        result[key] = sessionStorage[key];
      }
    }
    return result;
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(sessionStorage, items);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    const keyList = typeof keys === 'string' ? [keys] : keys;
    for (const key of keyList) {
      delete sessionStorage[key];
    }
  }),
};

/**
 * Mock chrome.tabs API.
 * Provides basic tab query, create, remove, and update functionality,
 * plus live event emitters for onCreated/onRemoved/onUpdated/etc.
 */
const chromeTabs = {
  query: vi.fn<() => Promise<Array<{ id?: number | undefined; url?: string | undefined; title?: string | undefined; favIconUrl?: string | undefined; active?: boolean | undefined; pinned?: boolean | undefined; windowId?: number | undefined; index?: number | undefined }>>>(async () => []),
  create: vi.fn(async (options: { url?: string }) => ({
    id: Math.floor(Math.random() * 10000),
    url: options.url ?? '',
    title: 'New Tab',
  })),
  remove: vi.fn(async () => {}),
  update: vi.fn(async () => ({})),
  get: vi.fn(async (tabId: number) => ({
    id: tabId,
    url: 'https://example.com',
    title: 'Example',
    favIconUrl: undefined,
    active: false,
    pinned: false,
    windowId: 1,
    index: 0,
  })),
  onCreated: makeListeners<[unknown]>(),
  onRemoved: makeListeners<[number, unknown]>(),
  onMoved: makeListeners<[number, unknown]>(),
  onActivated: makeListeners<[unknown]>(),
  onAttached: makeListeners<[number, unknown]>(),
  onDetached: makeListeners<[number, unknown]>(),
  onReplaced: makeListeners<[number, number]>(),
  onUpdated: makeListeners<[number, unknown, unknown]>(),
};

/**
 * Mock chrome.windows API — used by useTabs for window metadata +
 * current-window tracking, and by the multi-window features (grouping,
 * save-session window prompt, close-window action).
 */
const chromeWindows = {
  getAll: vi.fn(async () => [
    { id: 1, focused: true, type: 'normal' },
  ]),
  getCurrent: vi.fn(async () => ({ id: 1, focused: true, type: 'normal' })),
  getLastFocused: vi.fn(async () => ({ id: 1, focused: true, type: 'normal' })),
  get: vi.fn(async () => ({ id: 1, focused: true, type: 'normal' })),
  create: vi.fn(async () => ({ id: 2, focused: true, type: 'normal' })),
  update: vi.fn(async () => ({})),
  remove: vi.fn(async () => {}),
  onRemoved: makeListeners<[number]>(),
  onFocusChanged: makeListeners<[number]>(),
};

/**
 * Mock chrome.alarms API.
 */
const chromeAlarms = {
  create: vi.fn(),
  clear: vi.fn(),
  onAlarm: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    emit: (): void => {},
  },
};

/**
 * Mock chrome.notifications API.
 */
const chromeNotifications = {
  create: vi.fn(),
  clear: vi.fn(),
};

/**
 * Mock chrome.runtime API.
 */
const chromeRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  /** Resolves bundled asset paths (used for donate QR images). */
  getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
};

// Create a typed chrome object and attach to globalThis
interface ChromeMock {
  storage: {
    local: typeof chromeStorageLocal;
    session: typeof chromeStorageSession;
    onChanged: typeof chromeStorageOnChanged;
  };
  tabs: typeof chromeTabs;
  windows: typeof chromeWindows;
  alarms: typeof chromeAlarms;
  notifications: typeof chromeNotifications;
  runtime: typeof chromeRuntime;
}

const mockChrome: ChromeMock = {
  storage: {
    local: chromeStorageLocal,
    session: chromeStorageSession,
    onChanged: chromeStorageOnChanged,
  },
  tabs: chromeTabs,
  windows: chromeWindows,
  alarms: chromeAlarms,
  notifications: chromeNotifications,
  runtime: chromeRuntime,
};

(globalThis as unknown as Record<string, unknown>).chrome = mockChrome;

/**
 * Helper to clear all storage between tests.
 */
export async function clearStorage(): Promise<void> {
  await chromeStorageLocal.clear();
  Object.keys(sessionStorage).forEach((key) => {
    delete sessionStorage[key];
  });
}

/**
 * Helper to seed storage with test data.
 */
export async function seedStorage(data: Record<string, unknown>): Promise<void> {
  await chromeStorageLocal.set(data);
}

/**
 * Export mocks for use in tests.
 */
export const mocks = {
  storage: chromeStorageLocal,
  session: chromeStorageSession,
  tabs: chromeTabs,
  windows: chromeWindows,
  alarms: chromeAlarms,
  notifications: chromeNotifications,
  runtime: chromeRuntime,
  storageOnChanged: chromeStorageOnChanged,
};
