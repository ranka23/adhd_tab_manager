#!/usr/bin/env node
/**
 * Updates the Firefox AMO listing text (summary + description + homepage) via
 * the official AMO v5 API. Used by the release workflow after web-ext sign.
 *
 * Usage (env vars):
 *   AMO_JWT_ISSUER=... AMO_JWT_SECRET=... \
 *   node scripts/release/update-amo-listing.mjs [addon-slug]
 *
 * Secrets (GitHub → repo → Settings → Secrets and variables → Actions):
 *   AMO_JWT_ISSUER  — API key  (addons.mozilla.org → Manage API Keys)
 *   AMO_JWT_SECRET  — API secret (same page)
 *   AMO_ADDON_SLUG  — the add-on's slug (defaults to "adhd-tab-manager")
 *
 * Copy comes from docs/store-listing.json (committed, single source of truth).
 * NOTE: AMO listing PATCH accepts text fields; screenshots are managed in the
 * AMO developer hub (no API for them).
 */
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { AMO_JWT_ISSUER: issuer, AMO_JWT_SECRET: secret, AMO_ADDON_SLUG: slugEnv } = process.env;
const slug = process.argv[2] || slugEnv || 'adhd-tab-manager';

if (!issuer || !secret) {
  console.error('[update-amo-listing] Missing AMO_JWT_ISSUER / AMO_JWT_SECRET.');
  process.exit(1);
}

const listing = JSON.parse(readFileSync(join(ROOT, 'docs', 'store-listing.json'), 'utf8'));

function jwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: issuer, jti: randomUUID(), iat: now, exp: now + 60 })
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

const res = await fetch(`https://addons.mozilla.org/api/v5/addons/addon/${slug}/`, {
  method: 'PATCH',
  headers: {
    Authorization: `JWT ${jwt()}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    summary: { 'en-US': listing.firefoxSummary },
    description: { 'en-US': listing.description },
    homepage: { 'en-US': 'https://github.com/ranka23/adhd_tab_manager' },
    support_url: { 'en-US': 'https://github.com/ranka23/adhd_tab_manager/issues' },
  }),
});

const json = await res.json();
if (!res.ok) {
  console.error(`[update-amo-listing] PATCH failed (${res.status}):`, JSON.stringify(json).slice(0, 800));
  process.exit(1);
}
console.log(`[update-amo-listing] ✅ ${slug}: summary + description + links updated.`);
