#!/usr/bin/env node
/**
 * Submits a new version of the add-on to Firefox AMO (listed channel — public
 * review) via the official AMO v5 API.
 *
 * Why not `web-ext sign --channel listed`?
 *   web-ext sign uploads the add-on and then BLOCKS waiting for approval.
 *   Listed (public review) can take days, so the CI job times out after the
 *   default 15 minutes and fails — even though the upload succeeded.
 *   This script uploads the same way web-ext does internally (JWT auth + PUT
 *   of the built .zip to the version endpoint) and returns immediately with
 *   the review status.
 *
 * Prereqs (run from repo root after `pnpm build:all`):
 *   1. pnpm exec web-ext build --source-dir dist-firefox --artifacts-dir artifacts/amo --overwrite-dest
 *   2. node scripts/release/submit-amo.mjs
 *
 * Env vars (GitHub → repo → Settings → Secrets and variables → Actions):
 *   AMO_JWT_ISSUER  — API key  (addons.mozilla.org → Manage API Keys)
 *   AMO_JWT_SECRET  — API secret (same page)
 *   AMO_ADDON_SLUG  — the add-on's slug (defaults to "adhd-tab-manager")
 *
 * Exit codes:
 *   0 — submitted (201/202) or already exists (409); never a false failure
 *   1 — real upload failure (bad credentials, validation rejection, network)
 */
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { AMO_JWT_ISSUER: issuer, AMO_JWT_SECRET: secret, AMO_ADDON_SLUG: slugEnv } = process.env;
const slug = slugEnv || 'adhd-tab-manager';

if (!issuer || !secret) {
  console.error('[submit-amo] Missing AMO_JWT_ISSUER / AMO_JWT_SECRET.');
  process.exit(1);
}

const version = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')).version;

const artifactsDir = join(ROOT, 'artifacts', 'amo');
const zipName = readdirSync(artifactsDir).find((f) => f.endsWith('.zip'));
if (!zipName) {
  console.error(
    `[submit-amo] No .zip found in ${artifactsDir}. Run: pnpm exec web-ext build --source-dir dist-firefox --artifacts-dir artifacts/amo --overwrite-dest`,
  );
  process.exit(1);
}
const zipPath = join(artifactsDir, zipName);
const zipBytes = readFileSync(zipPath);

function jwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: issuer, jti: randomUUID(), iat: now, exp: now + 60 * 5 })
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

const url = `https://addons.mozilla.org/api/v5/addons/addon/${slug}/versions/${version}/`;
console.log(`[submit-amo] Uploading v${version} (${zipName}, ${zipBytes.length} bytes) → ${url}`);

const res = await fetch(url, {
  method: 'PUT',
  headers: {
    Authorization: `JWT ${jwt()}`,
    'Content-Type': 'application/octet-stream',
  },
  body: new Blob([zipBytes], { type: 'application/octet-stream' }),
});

const json = await res.json().catch(() => null);

if (res.status === 201 || res.status === 202) {
  console.log(
    `[submit-amo] ✅ v${version} submitted (HTTP ${res.status}). Status: ${
      json?.status ?? 'pending'
    } — review URL: ${json?.url ?? `https://addons.mozilla.org/en-US/developers/addon/${slug}/`}`,
  );
  process.exit(0);
}

if (res.status === 409) {
  console.log(`[submit-amo] ℹ️ v${version} already exists on AMO (HTTP 409) — nothing to do.`);
  process.exit(0);
}

console.error(
  `[submit-amo] ❌ Upload failed (HTTP ${res.status}):`,
  JSON.stringify(json).slice(0, 1000),
);
process.exit(1);
