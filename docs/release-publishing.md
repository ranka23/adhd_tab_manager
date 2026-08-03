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
forever. These steps match the **current Google Cloud console UI** (the
"Google Auth Platform" sidebar).

> ✅ Done already: **Chrome Web Store API enabled** —
> **APIs & Services → Library** → search **Chrome Web Store API** → **Enable**.

### 4a. Configure the OAuth consent screen (Google Auth Platform → Audience)

1. In the project at https://console.cloud.google.com/, open the left sidebar →
   **Google Auth Platform** (top-level item; replaces the old "OAuth consent
   screen").
2. Click the **Audience** tab → **Get started** (if first time).
3. **User type: External** → **Create**.
4. Fill:
   - **App name:** `ADHD Tab Manager`
   - **User support email:** your email
   - (Scopes can stay as-is; the `chromewebstore` scope is added implicitly
     when the client is used. No sensitive scopes → **no verification**.)
5. **Developer contact information:** your email → **Save and continue**.
6. **Publishing status** (top of the Audience page):
   - For a **long-lived** refresh token (so CI never breaks), switch to
     **In production** → **Confirm**.
   - If you leave it **Testing**, refresh tokens expire **after 7 days** and
     you must add your Google account under **Test users** (the account that
     approves the token step in 4c) — tokens then need re-generating weekly.
     In production this is not needed.

### 4b. Create the OAuth client (Google Auth Platform → Clients)

1. Left sidebar → **Google Auth Platform → Clients** → **Create client**.
2. **Application type:** `Desktop app` (under *Desktop*).
3. **Name:** `adhd-tab-manager-ci` → **Create**.
4. Copy the **Client ID** and **Client secret** (secret is shown once — if you
   lose it, edit the client → **Download JSON** contains both).
   These become `CWS_CLIENT_ID` and `CWS_CLIENT_SECRET`.

### 4c. Generate a refresh token (one-time, needs your Google account)

```sh
# 1) open this in a browser, sign in (with the account from 4a), approve:
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

If the consent page says *"Google hasn't verified this app"*, click
**Advanced → Continue** — normal for an unverified but harmless client.

**Troubleshooting — `Error 403: access_denied` / "has not completed the Google
verification process… only be accessed by developer-approved testers"**:
this means the consent screen is still in **Testing** status. You do **not**
need Google verification (the `chromewebstore` scope is non-sensitive).
Either:
- **Publish to production** (recommended): Google Auth Platform → Audience →
  **Publishing status** → **Publish app** → confirm. Re-run the URL; the 403 is
  gone and the refresh token never expires.
- Or add the approving Google account as a **Test user** (Audience →
  **Test users** → **Add users**) — but then the refresh token expires after
  7 days and must be re-generated weekly.

### 4d. Get the item id (Chrome Web Store dashboard, one manual upload)

1. Go to https://chrome.google.com/webstore/devconsole/ → **Add new item** →
   upload the chrome zip (`artifacts/release/zips/adhd-tab-manager-chrome-1.0.0.zip`).
2. The item page URL contains `…/edit/<32-char-id>` — that 32-char id is
   your `CWS_ITEM_ID`. (It never changes across version uploads.)
3. Set the **listing text + screenshots once** (copy from
   `docs/STORE-LISTING.md` + `docs/screenshots/`) and the **privacy policy
   URL**: `https://github.com/ranka23/adhd_tab_manager/blob/main/docs/PRIVACY-POLICY.md`
   (full copy in `docs/store-privacy-practices.md` §4).

### 4e. Add the secrets to GitHub

**GitHub → repo → Settings → Secrets and variables → Actions → New
repository secret** (add each of these):

| Secret | Value |
|---|---|
| `CWS_CLIENT_ID` | OAuth client id from 4b |
| `CWS_CLIENT_SECRET` | OAuth client secret from 4b |
| `CWS_REFRESH_TOKEN` | refresh token from 4c |
| `CWS_ITEM_ID` | 32-char extension id from 4d |

When all four exist, the `publish-chrome` job in `.github/workflows/release.yml`
activates automatically (it runs `if: secrets.CWS_CLIENT_ID != ''`).

### 4f. Local dry-run (optional, before trusting CI)

```sh
CWS_CLIENT_ID=... CWS_CLIENT_SECRET=... CWS_REFRESH_TOKEN=... \
CWS_ITEM_ID=... node scripts/release/publish-chrome.mjs
```

---

## 5. Edge (manual, no API)

Edge Add-ons has **no public publish API** — every submission is manual via
Partner Center. The **Edge zip is byte-identical to the Chrome zip** (Edge
accepts Chrome MV3 builds), so you never rebuild anything.

### 5a. First-time developer registration (free, ~10 minutes)

1. Go to **https://partner.microsoft.com/dashboard/microsoftedge/**
2. Sign in with a **Microsoft account** (any — e.g. your `@outlook.com` or a
   work account; you can also create one from this page).
3. Accept the developer agreement → complete the registration form
   (developer name + email as they'll appear publicly).
4. Verify your email when prompted. Some accounts are also asked for a phone
   verification — this is a one-time Partner Center check, not an app review.

### 5b. Create the submission

1. In the dashboard, click **Create new → Extension**.
2. **Upload the package**: drag `adhd-tab-manager-edge-1.0.0.zip` (from
   `artifacts/release/zips/` or the GitHub Release).
3. Wait for the package validation to finish (a few seconds — it checks the
   MV3 manifest). If it shows errors, the zip is wrong — don't proceed.

### 5c. Listing details (copy from `docs/STORE-LISTING.md`)

| Field | Value |
|---|---|
| **Name** | `ADHD Tab Manager` |
| **Short description** | `Declutter your browser and stay focused. Save sessions, block distractions, and track focus with a Pomodoro timer.` |
| **Long description** | Paste from `docs/STORE-LISTING.md` → *Full description* |
| **Category** | Productivity (or Utility) |
| **Privacy policy URL** | `https://github.com/ranka23/adhd_tab_manager/blob/main/docs/PRIVACY-POLICY.md` |
| **Website** | `https://github.com/ranka23/adhd_tab_manager` |
| **Support URL** | `https://github.com/ranka23/adhd_tab_manager/issues` |

### 5d. Screenshots (required)

Upload from `docs/screenshots/` (same set as Chrome):
- `home-light-1280x800.png`, `home-dark-640x400.png`,
  `tabs-multiwindow-1280x800.png`, `sessions-640x400.png`,
  `timer-running-640x400.png`, `blocked-sites-640x400.png`,
  `sidepanel-1280x800.png` (and `sidepanel-400x700.png` if wanted).

### 5e. Markets, age rating & submit

1. **Markets**: pick *All markets* (or a subset).
2. **Age rating**: complete the questionnaire (no data collection → minimal).
3. Certify the declarations checkboxes, then **Submit for review**.

Edge review typically takes **1–7 business days**. Once live, keep the version
in sync with Chrome: bump `package.json` → tag → CI regenerates both zips and
you re-upload the new edge zip manually (there is no API for this).

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
