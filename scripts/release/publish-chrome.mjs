#!/usr/bin/env node
/**
 * Publishes the Chrome zip to the Chrome Web Store via the official CWS API.
 *
 * Usage (env vars; run from the GitHub Actions release workflow or locally):
 *   CWS_CLIENT_ID=... CWS_CLIENT_SECRET=... CWS_REFRESH_TOKEN=... \
 *   CWS_ITEM_ID=... node scripts/release/publish-chrome.mjs [path-to-zip]
 *
 * Required secrets (GitHub → repo → Settings → Secrets and variables → Actions):
 *   CWS_CLIENT_ID       — OAuth2 client id (Google Cloud → APIs & Services → Credentials)
 *   CWS_CLIENT_SECRET   — OAuth2 client secret (same app)
 *   CWS_REFRESH_TOKEN   — OAuth2 refresh token (see docs/release-publishing.md §1)
 *   CWS_ITEM_ID         — the extension id from the Chrome Web Store dashboard
 *                         (needed after the FIRST manual upload; CI never changes it)
 *
 * The zip argument defaults to artifacts/release/zips/adhd-tab-manager-chrome-*.zip
 *
 * NOTE: The CWS API can upload the package and publish it, but listing metadata
 * (description, screenshots, category…) has NO public API — set it once in the
 * dashboard and every CI version bump keeps it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const {
  CWS_CLIENT_ID: clientId,
  CWS_CLIENT_SECRET: clientSecret,
  CWS_REFRESH_TOKEN: refreshToken,
  CWS_ITEM_ID: itemId,
} = process.env;

if (!clientId || !clientSecret || !refreshToken || !itemId) {
  console.error(
    '[publish-chrome] Missing env vars. Need CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_ITEM_ID.'
  );
  process.exit(1);
}

let zipPath = process.argv[2];
if (!zipPath) {
  const zips = readdirSync(join(ROOT, 'artifacts', 'release', 'zips')).filter((f) =>
    /^adhd-tab-manager-chrome-.*\.zip$/.test(f)
  );
  if (zips.length === 0) {
    console.error('[publish-chrome] No chrome zip found; run scripts/release/create-zips.mjs first.');
    process.exit(1);
  }
  zipPath = join(ROOT, 'artifacts', 'release', 'zips', zips[0]);
}
zipPath = resolve(zipPath);

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    console.error('[publish-chrome] Token refresh failed:', JSON.stringify(json));
    process.exit(1);
  }
  return json.access_token;
}

async function upload(accessToken) {
  const body = readFileSync(zipPath);
  const res = await fetch(
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${itemId}?uploadType=media`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Type': 'application/zip',
        'Content-Length': String(body.length),
      },
      body,
    }
  );
  const json = await res.json();
  if (!res.ok || !json.uploadState || json.uploadState !== 'SUCCESS') {
    console.error('[publish-chrome] Upload failed:', JSON.stringify(json));
    process.exit(1);
  }
  console.log(`[publish-chrome] ✅ Uploaded ${zipPath} (${body.length} bytes)`);
}

async function publish(accessToken) {
  const res = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${itemId}/publish`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target: 'default' }),
    }
  );
  const json = await res.json();
  if (!res.ok || json.status && json.status.length === 0) {
    console.error('[publish-chrome] Publish failed:', JSON.stringify(json));
    process.exit(1);
  }
  console.log(
    `[publish-chrome] ✅ Published: ${Array.isArray(json.status) ? json.status.join(', ') : JSON.stringify(json)}`
  );
}

const token = await getAccessToken();
await upload(token);
await publish(token);
console.log('[publish-chrome] Done.');
