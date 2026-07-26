/**
 * Test setup file — configures the testing environment.
 * Sets up jsdom for DOM testing and mocks Chrome extension APIs.
 */

import { vi } from 'vitest';

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

/**
 * Mock chrome.tabs API.
 * Provides basic tab query, create, remove, and update functionality.
 */
const chromeTabs = {
  query: vi.fn(async () => []),
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
};

/**
 * Mock chrome.alarms API.
 */
const chromeAlarms = {
  create: vi.fn(),
  clear: vi.fn(),
  onAlarm: {
    addListener: vi.fn(),
  },
};

/**
 * Mock chrome.notifications API.
 */
const chromeNotifications = {
  create: vi.fn(),
};

/**
 * Mock chrome.runtime API.
 */
const chromeRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
  },
};

// Set up the global chrome mock
globalThis.chrome = {
  storage: {
    local: chromeStorageLocal,
  },
  tabs: chromeTabs,
  alarms: chromeAlarms,
  notifications: chromeNotifications,
  runtime: chromeRuntime,
} as unknown as typeof chrome;

/**
 * Helper to clear all storage between tests.
 */
export async function clearStorage(): Promise<void> {
  await chromeStorageLocal.clear();
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
  tabs: chromeTabs,
  alarms: chromeAlarms,
  notifications: chromeNotifications,
  runtime: chromeRuntime,
};
