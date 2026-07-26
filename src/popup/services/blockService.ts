/**
 * Block service — manages the distraction blocker feature.
 * Handles the blocked sites list, checking if sites are blocked,
 * and tracking blocked distraction attempts.
 */

import type { BlockedSite } from '../types';
import { STORAGE_KEYS, DEFAULT_BLOCKED_SITES } from '../../shared/constants';
import { extractDomain } from '../utils/helpers';

/**
 * Gets the list of all blocked sites.
 * Initializes with default distracting sites on first use.
 */
export async function getBlockedSites(): Promise<BlockedSite[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.BLOCKED_SITES);
  let sites: BlockedSite[] =
    (result[STORAGE_KEYS.BLOCKED_SITES] as BlockedSite[] | undefined) ?? [];

  // Initialize with defaults if this is the first time
  if (sites.length === 0) {
    const now = Date.now();
    sites = DEFAULT_BLOCKED_SITES.map((domain) => ({
      domain,
      addedAt: now,
    }));
    await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: sites });
  }

  return sites;
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
  await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: sites });
  return newSite;
}

/**
 * Removes a site from the blocked list.
 */
export async function removeBlockedSite(domain: string): Promise<boolean> {
  const sites = await getBlockedSites();
  const filtered = sites.filter((s) => s.domain !== domain);

  if (filtered.length === sites.length) return false;

  await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: filtered });
  return true;
}

/**
 * Checks if a URL is on the blocked list.
 * Uses domain matching to check.
 */
export async function isSiteBlocked(url: string): Promise<boolean> {
  const domain = extractDomain(url);
  const sites = await getBlockedSites();
  return sites.some((s) => s.domain === domain);
}

/**
 * Gets whether the blocker is currently active (focus mode is on).
 */
export async function isBlockerActive(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.BLOCKED_SITES_ACTIVE);
  return (result[STORAGE_KEYS.BLOCKED_SITES_ACTIVE] as boolean | undefined) ?? false;
}

/**
 * Enables the blocker (called when focus mode starts).
 */
export async function activateBlocker(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES_ACTIVE]: true });
}

/**
 * Disables the blocker (called when focus mode ends).
 */
export async function deactivateBlocker(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES_ACTIVE]: false });
}

/**
 * Checks if a URL should be blocked (is on the list AND blocker is active).
 */
export async function shouldBlockUrl(url: string): Promise<boolean> {
  const [active, blocked] = await Promise.all([isBlockerActive(), isSiteBlocked(url)]);
  return active && blocked;
}
