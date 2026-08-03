# Testing Chrome Extensions with MCP Servers — An Exhaustive Guide for AI Agents

> **Audience:** AI coding agents (Claude, Zed, Cursor, VS Code Copilot, etc.) that need to
> manually test Chrome extensions in a real browser.
> **Worked example:** the `adhd-tab-manager` extension in this repo. Everything here is
> generic enough to apply to any Manifest V3 Chrome extension — swap paths/names as needed.

---

## Table of Contents

1. [Why MCP? Why not just a test framework?](#1-why-mcp-why-not-just-a-test-framework)
2. [Prerequisites](#2-prerequisites)
3. [Chrome for Testing — and why branded Chrome won't work](#3-chrome-for-testing)
4. [The three integration patterns](#4-the-three-integration-patterns)
5. [Configuring the MCP server per client](#5-configuring-the-mcp-server-per-client)
6. [Critical chrome-devtools-mcp flags](#6-critical-chrome-devtools-mcp-flags)
7. [Launching a persistent test environment](#7-launching-a-persistent-test-environment)
8. [The #1 gotcha: discovering the extension ID](#8-the-1-gotcha-discovering-the-extension-id)
9. [Driving the extension popup over CDP](#9-driving-the-extension-popup-over-cdp)
10. [Driving the Chrome side panel over CDP](#10-driving-the-chrome-side-panel-over-cdp)
11. [Pitfalls & edge cases](#11-pitfalls--edge-cases)
12. [Getting-started checklist (copy-paste)](#12-getting-started-checklist)
13. [Testing the ADHD Tab Manager (worked example)](#13-testing-the-adhd-tab-manager-worked-example)
14. [Appendix: raw CDP without an MCP server](#14-appendix-raw-cdp-without-an-mcp-server)

---

## 1. Why MCP? Why not just a test framework?

**MCP (Model Context Protocol)** is a standard that lets AI agents expose tools to themselves.
The `chrome-devtools-mcp` server turns a real Chrome instance into a tool surface the agent can
drive: open tabs, click elements, type text, read the DOM, take screenshots, evaluate JS, and
inspect network/console activity.

**Why agents need it for extension testing:**

- **Unit/component tests can't cover the extension runtime.** MV3 service workers, `chrome.*`
  APIs, popup lifecycle, storage, and the tab-management behavior only exist in a real browser.
- **Agents can't "see" a browser** without a protocol. CDP (Chrome DevTools Protocol) is that
  protocol; MCP packages it as tools the agent already knows how to call.
- **Manual QA is reproducible.** A persistent test environment (below) means the same loaded
  extension can be driven the same way on every run, and screenshots/DOM state can be captured
  as evidence.
- **You don't have to write a test harness per feature.** The agent reads the DOM, clicks, and
  asserts interactively — like a human tester, but scriptable.

> **What MCP is NOT:** it is not a unit-test runner, and it does not replace `vitest`/`jest`.
> Use it for *manual/integration testing in a real browser* — the layer CI frameworks can't
> reach for extensions.

---

## 2. Prerequisites

| Requirement | Why | Verify |
|---|---|---|
| Node.js ≥ 18 (20/22/24 recommended) | `chrome-devtools-mcp`, `npx`, extension build tooling | `node --version` |
| `npx` (ships with Node) | Runs `chrome-devtools-mcp@latest` without a global install | `npx --version` |
| `pnpm` or `npm` | Building the extension (`dist/`) | `pnpm --version` |
| **Chrome for Testing (CfT)** | The ONLY Chrome build that honors `--load-extension` (see §3) | path to the binary |
| The extension built to `dist/` | `--load-extension=<abs path to dist>` loads an *unpacked* extension | `pnpm build:all` |

The repo ships everything else you need:

- `.zed/mcp.json` — pre-configured MCP servers (attach + launch)
- `scripts/e2e/start-test-env.mjs` — persistent CfT with the extension loaded
- `scripts/e2e/discover-extension.mjs` — robust extension-ID discovery
- `scripts/e2e/interactive-smoke.mjs` — raw-CDP smoke you can read as an example
- `scripts/e2e/chrome-e2e.mjs` — full CDP e2e suite (32 checks) with its own CfT instance
- `docs/manual-test-plan.md` — 60+ use-case/edge-case matrix

---

## 3. Chrome for Testing

**Branded Chrome (stable/canary/beta) silently ignores `--load-extension`** ("not allowed in
Google Chrome" — intentional). This is the single most common reason agents fail to load
extensions via automation.

**Chrome for Testing** (`https://googlechromelabs.github.io/chrome-for-testing/`) is a Chrome
build made for automation. It honors `--load-extension`, `--remote-debugging-port`,
`--user-data-dir`, and other flags Puppeteer/Playwright-style automation needs.

- Download the **matching-major-version CfT** you want to test against.
- On this machine (macOS x86_64), the binary is:
  `/tmp/cft/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- The repo parameterizes it: `start-test-env.mjs` reads `CFT_CHROME` env var, falling back to
  the path above. **On other machines/OSes, set `CFT_CHROME` to your CfT binary.**

**Firefox note (this repo also ships a Firefox build):** `dist-firefox/` is built with
`pnpm build:all` and validated with `pnpm lint:firefox` (web-ext). Load it via
`about:debugging → Load Temporary Add-on → dist-firefox/manifest.json`, or
`pnpm exec web-ext run --source-dir dist-firefox`. Firefox has no CDP port; the guide focuses on
Chrome, but the same popup page (`moz-extension://<id>/src/popup/index.html`) can be opened as a
tab after loading.

---

## 4. The three integration patterns

### Pattern A — Attach to an already-running instance (`--browserUrl`) ✅ recommended

Chrome is launched *once* (by you or a script) with the extension loaded; the MCP server simply
attaches over CDP. Fastest iteration, preserves state, survives server restarts.

```bash
# 1. Launch Chrome for Testing with the extension (script does all of this):
node scripts/e2e/start-test-env.mjs

# 2. Point the MCP server at it:
npx chrome-devtools-mcp@latest --browserUrl http://127.0.0.1:9222
```

### Pattern B — Let the MCP server launch Chrome (`--executablePath`) 

The server spawns Chrome itself. Good for one-shot runs; state does not persist between runs
unless you fix `--userDataDir`.

```bash
npx chrome-devtools-mcp@latest \
  --executablePath "/tmp/cft/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
  --userDataDir "/abs/path/to/.e2e-profile" \
  --chromeArg="--load-extension=/abs/path/to/dist" \
  --ignoreDefaultChromeArg=--disable-extensions
```

> ⚠️ Without `--ignoreDefaultChromeArg=--disable-extensions`, **nothing loads**: Puppeteer-based
> launchers disable extensions by default. See §6.

### Pattern C — Playwright MCP

`@playwright/mcp` is an alternative surface (browser tools, accessibility snapshots). The flags
differ (e.g. `--executable-path`, `--browser chromium`, `--isolated=false`, `--user-data-dir`).
It is a reasonable choice when you already live in Playwright, but `chrome-devtools-mcp` is
better suited to extension work because it exposes CDP directly (service-worker targets,
`chrome-extension://` URLs, `Runtime.evaluate`).

---

## 5. Configuring the MCP server per client

### Zed (this repo's `.zed/mcp.json` — the canonical example)

```json
{
  "mcp": {
    "chrome-devtools-mcp-attach": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--browserUrl", "http://127.0.0.1:9222"],
      "env": {}
    },
    "chrome-devtools-mcp-launch": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--executablePath",
        "/tmp/cft/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "--userDataDir",
        "/abs/path/to/repo/.e2e-profile",
        "--chromeArg=--load-extension=/abs/path/to/repo/dist",
        "--ignoreDefaultChromeArg=--disable-extensions"
      ],
      "env": {}
    }
  }
}
```

**Workflow in Zed:** run `node scripts/e2e/start-test-env.mjs` once → restart Zed (or reload the
window) so the attach server connects → start chatting. The agent can then list pages, open the
popup URL, click, and screenshot.

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--browserUrl",
        "http://127.0.0.1:9222"
      ]
    }
  }
}
```

### VS Code (`.vscode/mcp.json` or workspace settings)

```json
{
  "servers": {
    "chrome-devtools": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--browserUrl", "http://127.0.0.1:9222"]
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--browserUrl", "http://127.0.0.1:9222"]
    }
  }
}
```

> **Rule of thumb:** prefer the *attach* pattern in every client config. One Chrome instance,
> many clients. Change `--browserUrl` if you run the env on another port.

---

## 6. Critical chrome-devtools-mcp flags

| Flag | Purpose | Extension testing |
|---|---|---|
| `--browserUrl http://127.0.0.1:<port>` | Attach to a running Chrome | ✅ always for Pattern A |
| `--executablePath <path>` | Chrome binary to launch | Must point at **Chrome for Testing** |
| `--userDataDir <dir>` | Profile dir; keeps extension + logins | Use a **repo-local, git-ignored dir** so state survives |
| `--chromeArg=--load-extension=<abs dist>` | Load unpacked extension | Repeatable flag; one per extension |
| `--ignoreDefaultChromeArg=--disable-extensions` | **Undo** Puppeteer's default `--disable-extensions` | **Without this the extension never loads** |
| `--viewport 390x844` | Emulate a phone viewport | Test "responsive/mobile" popup layouts |
| `--screenshotFormat jpeg` | Screenshots as JPEG (smaller) | Nice-to-have for evidence capture |
| `--isolated false` | Reuse the profile dir across launches | Keep extension installed between runs |

Combine flags, e.g. the repo's "launch" server in `.zed/mcp.json` (§5) shows the full extension
set. Use `npx chrome-devtools-mcp@latest --help` to see everything available in your version.

---

## 7. Launching a persistent test environment

The repo's `scripts/e2e/start-test-env.mjs` encapsulates the manual steps:

```bash
node scripts/e2e/start-test-env.mjs            # start (background, persists)
node scripts/e2e/start-test-env.mjs --foreground
node scripts/e2e/start-test-env.mjs --status
node scripts/e2e/start-test-env.mjs --stop
```

What it does (and what you'd do by hand for another extension):

1. **Build check** — requires `dist/` to exist (`pnpm build:all`).
2. **Spawn CfT** with:
   ```
   --remote-debugging-port=9222
   --user-data-dir=<repo>/.e2e-profile
   --load-extension=<repo>/dist
   --no-first-run --no-default-browser-check
   about:blank
   ```
   The profile directory is the secret to *persistence*: the extension stays installed and its
   storage survives restarts, so manual test state (added tabs, focus mode, etc.) carries over.
3. **Wait for the CDP endpoint** (`/json/version`) — Chrome is up.
4. **Discover the extension ID** (see §8) and print the popup URL.
5. Print the attach command for the MCP server.

**Ports:** the e2e harness (`chrome-e2e.mjs`) uses its own ephemeral instance on port **9333**;
the interactive/MCP environment uses **9222**. Don't run both at once against the same profile.

---

## 8. The #1 gotcha: discovering the extension ID

You need `chrome-extension://<id>/...` URLs to open the popup. Naive approaches fail:

1. **`/json/list` often won't list the service worker.** MV3 service workers are *dormant* by
   default — they only wake when triggered (popup opened, alarm fired, event dispatched). A
   freshly launched instance shows no `service_worker` target at all.
2. **Chrome's own components look identical.** The built-in `hangout_services` component uses
   `service-worker-loader.js` — the exact filename `@crxjs/vite-plugin` emits for MV3. Grabbing
   "the first service worker whose URL contains `service-worker-loader.js`" can return
   **the wrong extension**.

**The authoritative source is the profile itself:**
`<profile>/Default/Secure Preferences` → `extensions.settings` → find the record whose `path`
resolves to your `dist/` directory. That id is correct even when the worker is asleep and no
page has been opened.

The repo's `scripts/e2e/discover-extension.mjs` implements the reliable order:

1. **Profile match** (`Secure Preferences`/`Preferences`, `extensions.settings[].path === dist`)
   — primary, works always.
2. **Popup page target** (`/json/list` entry whose URL includes `/src/popup/index.html`) — works
   once the popup has been opened.
3. **Our own service worker** — last resort only, because of the hangout_services collision.

```js
import { discoverExtensionId } from './scripts/e2e/discover-extension.mjs';
const id = await discoverExtensionId(9222, resolve('dist'));
// → "mnlpgnpemkgbdbhkanffjmonhakgofbg" etc.
```

> Copy this file into any other extension repo — only the "our background filename" predicate
> (step 3) may need adjusting.

---

## 9. Driving the extension popup over CDP

MV3 popups are ordinary extension pages, so you open them as **tabs** and drive them like any
page. The agent's tool loop (with chrome-devtools-mcp) looks like:

1. **Open the popup** — `navigate` to `chrome-extension://<id>/src/popup/index.html`.
   (Popups must be opened as a tab; `chrome-extension://` URLs are not navigable from the
   address-bar UI but CDP navigates them fine.)
2. **Wait for render** — poll the DOM for your root/selector; React mounts async.
3. **Inspect** — snapshot the page (a11y tree), query DOM via `Runtime.evaluate`.
4. **Interact** — click/type on elements; extension logic runs against real `chrome.*` APIs.
5. **Verify side effects** — evaluate `chrome.storage.local.get(...)` to assert state changed
   (e.g. the repo's popup writes `adhd_popup_heartbeat` with a timestamp on every open).
6. **Screenshot** — capture before/after as evidence.

For other extensions, find the popup path in your `manifest.json` (`action.default_popup`).
The built output keeps the `src/...` layout for @crxjs projects, but vanilla projects may emit
`popup/index.html` — check the built `dist/` and use whatever path exists.

---

## 10. Driving the Chrome side panel over CDP

MV3 side panels (Chrome 114+, `"side_panel"` in the manifest + the `sidePanel` permission) are
**real extension pages** — same rules as popups, plus a few panel-specific gotchas:

### 10.1 The panel page

`side_panel.default_path` (e.g. `src/sidepanel/index.html`) is a normal extension page. You can
open it **as a tab** and drive it exactly like the popup (§9). This is the reliable way to test
rendering/behavior in headless Chrome:

```
navigate to chrome-extension://<id>/src/sidepanel/index.html
snapshot → expect the same app shell as the popup (header, nav tabs, …)
```

### 10.2 Opening the *real* panel

`chrome.sidePanel.open({ windowId })` **requires a user gesture** — a scripted `el.click()` via a
plain `Runtime.evaluate` will fail with "sidePanel.open() may only be called in response to a user
action". Two ways to get a genuine gesture:

1. **MCP click tool** — it dispatches real input events at the OS/CDP level, which counts.
2. **Raw CDP** — pass `userGesture: true` to `Runtime.evaluate` (this repo's e2e harness does
   exactly this: `{ expression, awaitPromise: true, returnByValue: true, userGesture: true }`).

Worked flow (this repo):

```
1. Open the popup as a tab.
2. Snapshot → click the side-panel icon (aria-label "Open in side panel").
3. Wait: chrome.storage.local.get('adhd_sidepanel_open') === true
   (the panel page publishes this flag on mount — Chrome has no "is the panel open" query API).
4. Assert the header icon flipped to .side-panel-toggle--active.
```

### 10.3 Gotchas

- **No query API** for open/close state — the page must self-report (storage flag / message).
- **No `close()`** in most Chrome versions — clicking the toggle when open is a no-op
  (brings the panel to front). Treat it as open-only in tests.
- **Headless works** — the panel page mounts in `--headless=new` (verified: this repo's e2e
  opens the real panel and the storage flag flips).
- **Firefox / Safari have no side panel API** — the toggle is hidden there, and the Firefox
  build strips the manifest key. Don't test panel flows in Firefox.
- **Double-decrement guard** — if the panel ticks the pomodoro locally (this one does), the
  service worker must treat `SIDE_PANEL` contexts like `POPUP` contexts and skip its own
  per-minute tick (`runtime.getContexts({ contextTypes: ['POPUP', 'SIDE_PANEL'] })`).

---

## 11. Pitfalls & edge cases

| # | Pitfall | Symptom | Fix |
|---|---|---|---|
| 1 | Branded Chrome + `--load-extension` | Extension never appears | Use **Chrome for Testing** only |
| 2 | Missing `--ignoreDefaultChromeArg=--disable-extensions` | Launcher starts Chrome but extension isn't there | Add the flag (Puppeteer disables extensions by default) |
| 3 | MV3 SW dormancy | No `service_worker` target in `/json/list` | Use profile `Secure Preferences` for the ID (§8); wake the SW by opening the popup |
| 4 | Grabbing the wrong SW (`hangout_services`) | "The extension" is actually Chrome's component | Match the profile `path` or popup page URL, not the SW filename |
| 5 | `--user-data-dir` reused by two instances | Chrome error: profile in use / instance exits | One profile per instance; stop the other (`start-test-env.mjs --stop`) |
| 6 | File-chooser dialogs | CDP `Page.setInterceptFileChooserDialog` can't be scripted for extension uploads | Design the test to avoid native file pickers (fixtures already in repo storage) |
| 7 | MV3 CSP | Inline `<script>`/`eval` refused in extension pages | No inline scripts; the repo bundles JS files only |
| 8 | Stale `dist/` | Testing old behavior | Rebuild first: `pnpm build:all` |
| 9 | Port conflicts | CDP endpoint refuses / wrong browser | 9222 = MCP env, 9333 = e2e harness; don't overlap |
| 10 | Extension state pollution across test runs | "Fresh user" scenarios fail | Use a *separate* profile for clean runs, or clear `chrome.storage.local` via CDP between scenarios |

---

## 12. Getting-started checklist

For a brand-new agent joining this repo:

```bash
# 0. Prereqs
node --version            # ≥ 18
pnpm --version

# 1. Build the extension (Chrome + Firefox)
cd adhd-tab-manager
pnpm install
pnpm build:all

# 2. Launch the persistent test environment (CfT + extension on CDP :9222)
node scripts/e2e/start-test-env.mjs        # prints the extension id + popup URL

# 3. (Zed users) restart Zed so the preconfigured MCP attach server connects
#    .zed/mcp.json → chrome-devtools-mcp-attach → --browserUrl http://127.0.0.1:9222

# 4. Sanity: run the raw-CDP interactive smoke (no MCP needed)
node scripts/e2e/interactive-smoke.mjs     # ✅ INTERACTIVE SMOKE PASS

# 5. Start driving via the MCP tools:
#    - list pages / take snapshot of the popup tab
#    - or navigate a new tab to chrome-extension://<id>/src/popup/index.html
#    - click nav tabs, toggle focus mode, add a tab, screenshot

# 6. Full e2e suite (separate ephemeral instance on :9333)
node scripts/e2e/chrome-e2e.mjs            # 32/32 checks

# 7. Tear down
node scripts/e2e/start-test-env.mjs --stop
```

**If the MCP attach server has no pages:** the environment isn't running — run step 2 and check
`node scripts/e2e/start-test-env.mjs --status`. If the extension isn't found, the #1 cause is
step 1 (stale/missing `dist/`) followed by §10 pitfalls 1–2.

---

## 13. Testing the ADHD Tab Manager (worked example)

- **Popup URL:** `chrome-extension://<id>/src/popup/index.html`
- **What to exercise:** header/branding, 5 nav tabs, daily quote, focus toggle, add-tab form,
  tab list rendering, overflow behaviour (popup width), storage heartbeat
  (`adhd_popup_heartbeat`), persistence across popup closes.
- **Full matrix:** `docs/manual-test-plan.md` — 60+ use cases and edge cases, each mapped to
  steps and expected outcomes.
- **Responsive/mobile:** the popup is built mobile-first; emulate a narrow viewport
  (`--viewport 390x844` or CDP `Emulation.setDeviceMetricsOverride`) and assert no horizontal
  overflow (`document.body.scrollWidth <= document.documentElement.clientWidth`).

---

## 14. Appendix: raw CDP without an MCP server

If no MCP client is available, the agent can drive Chrome directly over the WebSocket exposed by
`--remote-debugging-port` (Node ≥ 22 has a global `WebSocket`/`fetch`). Read
`scripts/e2e/interactive-smoke.mjs` for a complete worked example — the core loop:

```js
// 1. Get the browser WebSocket URL
const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);

// 2. Open the popup as a tab and attach a session
const { targetId } = await send('Target.createTarget', {
  url: `chrome-extension://${EXT_ID}/src/popup/index.html`,
});
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);

// 3. Evaluate in the page
const { result } = await send(
  'Runtime.evaluate',
  { expression: `document.querySelector('.header-text')?.textContent`, returnByValue: true },
  sessionId,
);
```

`send()` is a small JSON-RPC wrapper (id/params/sessionId → promise); the smoke script shows the
full implementation. Screenshots: `Page.captureScreenshot` (PNG base64) with a `Page.enable`
session.

---

*Last updated: 2026-08-01 · Repo: adhd-tab-manager (main). Companion docs:
[`docs/manual-test-plan.md`](./manual-test-plan.md), `.zed/mcp.json`, `scripts/e2e/`.*
