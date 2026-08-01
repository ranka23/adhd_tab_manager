/**
 * Block service — manages the distraction blocker feature.
 * Handles the blocked sites list, checking if sites are blocked,
 * and tracking blocked distraction attempts.
 *
 * URL Matching Rules:
 * - Exact domain match: "reddit.com" matches "https://www.reddit.com/r/all"
 * - Wildcard prefix: "*.reddit.com" matches "old.reddit.com", "www.reddit.com"
 * - Subdomain matching: "reddit.com" also matches "old.reddit.com", "www.reddit.com"
 * - Protocol and path are ignored: only hostname is compared
 * - Port numbers are included in hostname comparison
 * - The "www." prefix is normalized (removed before comparison)
 */

import type { BlockedSite } from '../types';
import { STORAGE_KEYS, DEFAULT_BLOCKED_SITES } from '../../shared/constants';
import { extractDomain } from '../utils/helpers';
import { browser } from '../../shared/browser';

/**
 * Gets the list of all blocked sites.
 * Initializes with default distracting sites on first use.
 * Handles storage corruption by resetting to defaults.
 */
export async function getBlockedSites(): Promise<BlockedSite[]> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.BLOCKED_SITES);
    let sites: BlockedSite[] =
      (result[STORAGE_KEYS.BLOCKED_SITES] as BlockedSite[] | undefined) ?? [];

    // Validate data integrity — if malformed, reset to defaults
    if (!Array.isArray(sites)) {
      console.error('blockService: Corrupted blocked sites data detected, resetting to defaults');
      sites = [];
      // Clear the corrupted key
      await browser.storage.local.remove(STORAGE_KEYS.BLOCKED_SITES);
    }

    // Initialize with defaults if this is the first time
    if (sites.length === 0) {
      const now = Date.now();
      sites = DEFAULT_BLOCKED_SITES.map((domain) => ({
        domain,
        addedAt: now,
      }));
      await browser.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: sites });
    }

    return sites;
  } catch (err) {
    // Handle JSON.parse or any other unexpected errors
    console.error('blockService: Error reading blocked sites, resetting to defaults:', err);
    await browser.storage.local.remove(STORAGE_KEYS.BLOCKED_SITES).catch(() => {});
    const now = Date.now();
    const resetSites = DEFAULT_BLOCKED_SITES.map((domain) => ({
      domain,
      addedAt: now,
    }));
    await browser.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: resetSites }).catch(() => {});
    return resetSites;
  }
}

/**
 * Adds a site to the blocked list.
 * Normalizes the domain by removing "www." prefix and protocol.
 */
export async function addBlockedSite(domain: string): Promise<BlockedSite> {
  const normalizedDomain = extractDomain(domain);
  const sites = await getBlockedSites();

  // Don't add duplicates
  const exists = sites.some((s) => s.domain === normalizedDomain);
  if (exists) {
    return sites.find((s) => s.domain === normalizedDomain)!;
  }

  const newSite: BlockedSite = {
    domain: normalizedDomain,
    addedAt: Date.now(),
  };

  sites.push(newSite);
  await browser.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: sites }).catch((err) => {
    console.error('blockService: Failed to save blocked site:', err);
  });
  return newSite;
}

/**
 * Removes a site from the blocked list.
 */
export async function removeBlockedSite(domain: string): Promise<boolean> {
  const sites = await getBlockedSites();
  const normalizedDomain = extractDomain(domain);
  const filtered = sites.filter((s) => s.domain !== normalizedDomain);

  if (filtered.length === sites.length) return false;

  await browser.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: filtered }).catch((err) => {
    console.error('blockService: Failed to remove blocked site:', err);
  });
  return true;
}

/**
 * Checks if a URL matches a blocked site pattern.
 *
 * Supports wildcard patterns like "*.example.com" which match
 * any subdomain of example.com.
 *
 * @param hostname - The hostname to check (e.g., "old.reddit.com")
 * @param blockedDomain - The blocked domain pattern (e.g., "reddit.com" or "*.reddit.com")
 * @returns True if the hostname matches the blocked pattern
 */
export function matchesBlockedPattern(hostname: string, blockedDomain: string): boolean {
  const normalizedHost = hostname.replace(/^www\./, '').toLowerCase();
  const normalizedPattern = blockedDomain.replace(/^www\./, '').toLowerCase();

  // Exact match
  if (normalizedHost === normalizedPattern) return true;

  // Wildcard pattern: "*.example.com" matches any subdomain
  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(2); // remove "*."
    if (normalizedHost === suffix) return true;
    if (normalizedHost.endsWith('.' + suffix)) return true;
    return false;
  }

  // Subdomain match: "reddit.com" matches "old.reddit.com", "www.reddit.com"
  if (normalizedHost.endsWith('.' + normalizedPattern)) return true;

  return false;
}

/**
 * Checks if a URL is on the blocked list.
 * Uses proper hostname matching with wildcard support.
 */
export async function isSiteBlocked(url: string): Promise<boolean> {
  const hostname = extractDomain(url); // This gives us the hostname without www.
  const sites = await getBlockedSites();
  return sites.some((s) => matchesBlockedPattern(hostname, s.domain));
}

/**
 * Gets whether the blocker is currently active (focus mode is on).
 */
export async function isBlockerActive(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.BLOCKED_SITES_ACTIVE);
    return (result[STORAGE_KEYS.BLOCKED_SITES_ACTIVE] as boolean | undefined) ?? false;
  } catch (err) {
    console.error('blockService: Error checking blocker active state:', err);
    return false;
  }
}

/**
 * Enables the blocker (called when focus mode starts).
 */
export async function activateBlocker(): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES_ACTIVE]: true }).catch((err) => {
    console.error('blockService: Failed to activate blocker:', err);
  });
}

/**
 * Disables the blocker (called when focus mode ends).
 */
export async function deactivateBlocker(): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES_ACTIVE]: false }).catch((err) => {
    console.error('blockService: Failed to deactivate blocker:', err);
  });
}

/**
 * Checks if a URL should be blocked (is on the list AND blocker is active).
 */
export async function shouldBlockUrl(url: string): Promise<boolean> {
  const [active, blocked] = await Promise.all([isBlockerActive(), isSiteBlocked(url)]);
  return active && blocked;
}

/**
 * Validates a URL and creates a tab, with proper error handling.
 * Returns a result object indicating success or failure.
 */
export async function validateAndCreateTab(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    /* Validate the URL */
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { success: false, error: 'Invalid URL — cannot open' };
    }

    await browser.tabs.create({ url: parsed.href });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid URL — cannot open';
    return { success: false, error: message };
  }
}
