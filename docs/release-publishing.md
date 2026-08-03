# ADHD Tab Manager — Release & Store Publishing Guide

How the repo ships new versions: **push a git tag → GitHub Actions builds,
zips, creates a GitHub Release (with screenshots), and publishes to Chrome +
Firefox.** Edge and Safari zips are attached to the release for manual upload.

---

## 1. What happens on a tag push

`.github/workflows/release.yml` runs on any tag matching `v*`:

| Job | What it does |
|---|---|
| `package` | `pnpm build:all` + Safari post-process → `create-zips.mjs` makes the 4 store zips → `gh release create` attaches the zips **and all screenshots** to the GitHub Release (screenshots render as a gallery on the release page; the body embeds them too) |
| `publish-firefox` | runs **only if** the `AMO_JWT_ISSUER` secret exists → `web-ext sign` submits `dist-firefox/` to AMO (listed = public review), then `update-amo-listing.mjs` PATCHes the summary/description/links via the AMO API |
| `publish-chrome` | runs **only if** the `CWS_CLIENT_ID` secret exists → `publish-chrome.mjs` uploads the zip and publishes it via the Chrome Web Store API |

**To ship a release:**
```sh
git tag v1.0.0        # or v1.0.1, v1.1.0 …
git push origin v1.0.0
```

`.github/workflows/ci.yml` separately runs **lint + 280 tests + build + Firefox
add-on lint** on every push/PR to `main` — nothing ships broken.

---

## 2. What CI **can** and **cannot** do per store

| Store | CI uploads the zip | CI publishes | CI sets listing text | CI sets screenshots |
|---|---|---|---|---|
| **Chrome Web Store** | ✅ API | ✅ API (publish to default channel) | ❌ **no public API** — set once in the dashboard, kept on version bumps | ❌ dashboard only |
| **Firefox AMO** | ✅ `web-ext sign` | ✅ submits for review (listed) | ✅ **AMO v5 API** — `update-amo-listing.mjs` sets summary, description, homepage, support URL | ❌ developer hub only |
| **Edge Add-ons** | ❌ no public API — zip is on the GitHub Release; upload manually | ❌ | ❌ dashboard | ❌ dashboard |
| **Safari / App Store** | ❌ (on hold) | ❌ | ❌ | ❌ |

So: **description & details** → Firefox fully automatable, Chrome once (set in
the dashboard; CI keeps it across versions). Screenshots are attached to every
GitHub Release automatically and must be set once per store dashboard.

---

## 3. One-time setup — Firefox (10 minutes)

1. Sign in at **https://addons.mozilla.org/developers/** (you need an AMO
   account).
2. **Submit the first version manually**: "Submit a new add-on" → upload
   `artifacts/release/zips/adhd-tab-manager-firefox-1.0.0.zip` (or the zip from
   the GitHub Release) → complete the listing form (fields pre-filled in
   `docs/STORE-LISTING.md`). Wait for review/publish. **After the add-on
   exists, CI can submit version bumps.**
3. Grab your API credentials: **https://addons.mozilla.org/en-US/developers/addon/api/key/** →
   "Generate new credentials". You get a **JWT issuer** (the API key) and a
   **JWT secret** (shown once).
4. Note the add-on **slug** (the URL segment after `/addon/`, e.g.
   `adhd-tab-manager`).

Add GitHub secrets (repo → **Settings → Secrets and variables → Actions**):

| Secret | Value |
|---|---|
| `AMO_JWT_ISSUER` | your AMO API key |
| `AMO_JWT_SECRET` | your AMO API secret |
| `AMO_ADDON_SLUG` | the add-on slug (e.g. `adhd-tab-manager`) — enables the listing-text update step |

---

## 4. One-time setup — Chrome Web Store (30 minutes)

The CWS API uses Google OAuth2. You do this once; CI reuses the refresh token
forever.

1. **Google Cloud project** → https://console.cloud.google.com/ → create a
   project (or reuse one) → **APIs & Services → Library** → enable
   **Chrome Web Store API**.
2. **OAuth consent screen**: External → fill app name, support email → add the
   test scope if asked.
3. **Credentials → Create credentials → OAuth client ID** → Application type
   **Desktop app** → note the **Client ID** and **Client secret**.
4. **Generate a refresh token** (one-time, needs your Google account):
   ```sh
   # 1) open this in a browser, sign in, approve:
   # https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=http://localhost&response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&access_type=offline&prompt=consent
   # 2) it redirects to http://localhost/?code=AUTH_CODE — copy AUTH_CODE:
   curl -s -X POST "https://oauth2.googleapis.com/token" \
     -d "client_id=CLIENT_ID" \
     -d "client_secret=CLIENT_SECRET" \
     -d "code=AUTH_CODE" \
     -d "grant_type=authorization_code" \
     -d "redirect_uri=http://localhost"
   # 3) the response contains "refresh_token": "..." — save it
   ```
5. **Upload the extension to the dashboard once manually** to get the item id:
   https://chrome.google.com/webstore/devconsole/ → **Add new item** → upload
   the chrome zip → the item page URL contains
   `…/edit/<32-char-id>` — that's your `CWS_ITEM_ID`. (Or call the API
   `POST /items` once, but the dashboard is easier.)
6. Set the **listing text + screenshots once** in the dashboard (copy from
   `docs/STORE-LISTING.md` + `docs/screenshots/`).
7. Set the **privacy policy URL** (required field on the item edit page) to:
   `https://github.com/ranka23/adhd_tab_manager/blob/main/docs/PRIVACY-POLICY.md`
   (full copy in `docs/store-privacy-practices.md` §4 — the policy is committed
   at `docs/PRIVACY-POLICY.md`).

Add GitHub secrets:

| Secret | Value |
|---|---|
| `CWS_CLIENT_ID` | OAuth client id |
| `CWS_CLIENT_SECRET` | OAuth client secret |
| `CWS_REFRESH_TOKEN` | refresh token from step 4 |
| `CWS_ITEM_ID` | 32-char extension id from step 5 |

---

## 5. Edge (manual, no API)

Edge Add-ons has **no public publish API**. After each tag push:
1. Grab `adhd-tab-manager-edge-1.0.0.zip` from the GitHub Release (or
   `artifacts/release/zips/`).
2. Upload at **https://partner.microsoft.com/dashboard/microsoftedge/**, set
   listing text from `docs/STORE-LISTING.md`, screenshots from
   `docs/screenshots/`.

---

## 6. Locally re-running the CI steps (without GitHub)

```sh
pnpm install
pnpm build:all && node scripts/build-safari.mjs
node scripts/release/create-zips.mjs 1.0.0        # → artifacts/release/zips/

# Firefox sign (dry-run with unlisted channel, no review):
pnpm exec web-ext sign --source-dir dist-firefox \
  --api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET" --channel unlisted

# Chrome publish (needs secrets in env):
CWS_CLIENT_ID=… CWS_CLIENT_SECRET=… CWS_REFRESH_TOKEN=… CWS_ITEM_ID=… \
  node scripts/release/publish-chrome.mjs

# AMO listing text update:
AMO_JWT_ISSUER=… AMO_JWT_SECRET=… node scripts/release/update-amo-listing.mjs adhd-tab-manager
```

---

## 7. Troubleshooting

- **`publish-chrome.mjs` "Upload failed"**: re-check the refresh token (regenerate
  with `prompt=consent` if it was issued without `access_type=offline`), and that
  the Chrome Web Store API is enabled in the same project the client id belongs to.
- **`web-ext sign` "this version already exists"**: bump `version` in
  `package.json` before tagging; AMO rejects a version it already has.
- **AMO rejects the id**: only UUID or `name@domain` validate — current id is
  `nikhil@onefamili.com` (set in `scripts/build-firefox.mjs`).
- **Release job fails on `gh release create`**: the tag already has a release —
  delete it (`gh release delete`) or use `--generate-notes` workflows carefully.
