# ADHD Tab Manager — Production Readiness Analysis

**Date:** 2026-08-01
**Scope:** Deep analysis of `adhd-tab-manager` (Chrome Extension, Manifest V3, React 18 + TypeScript + Vite + @crxjs)
**Goal:** Functional, production-ready, clean trending UI — loadable via `chrome://extensions` → Load unpacked → `dist/`

---

## ✅ Implementation Status (updated 2026-08-01)

All tasks below have been **implemented and verified**: `pnpm build` ✅ (no warnings), `pnpm lint` ✅ (clean), `pnpm test` ✅ **238 tests / 14 files pass**, `pnpm lint:firefox` ✅ (0 errors), and a **real-browser e2e run: 32/32 checks pass** (see §9). Firefox support (MV3 event page), the cross-browser `browser` shim, the popup-heartbeat fallback, and responsive layouts were added in the same pass — see §§8–13.

**Editor lint note:** the typed-linting error on `vite.config.ts` ("TSConfig does not include this file") is fully resolved: `tsconfig.eslint.json` lists the root config files, `.eslintrc.cjs` now sets an **explicit absolute `tsconfigRootDir`** (so typed linting resolves identically regardless of the cwd ESLint is launched from — CLI vs editor language server), and non-TS files (`scripts/**/*.mjs`, `public/*.js`) opt out of typed linting via `parserOptions: { project: null }` overrides. `pnpm lint` now covers the **whole project** (`eslint . --ext .ts,.tsx,.mjs,.js`) and exits 0. If an old error still shows in the editor, restart the ESLint/TypeScript language servers (or reload the workspace) — it's stale server state, not a config problem.

| # | Task | Status | Where |
|---|---|---|---|
| 1 | Undo session delete actually restores | ✅ Done | `Popup.tsx`, `tabService.restoreDeletedSession`, tests |
| 2 | Dark mode persisted + applied pre-render (no flash) | ✅ Done | `Popup.tsx`, `utils/theme.ts`, `index.tsx`, `index.html` |
| 3 | Import validation (schema-checked, atomic) | ✅ Done | `Popup.tsx`, `utils/validation.ts`, tests |
| 4 | SW uses shared defaults + skips pomodoro tick while popup open | ✅ Done | `service-worker.ts` |
| 5 | All component/animation colors → design tokens; modernized UI; `@import` order fixed | ✅ Done | `popup.css`, `components.css`, `animations.css` |
| 6 | Dead `FocusStats` removed; `sessionsSaved` stat wired; `MAX_SESSIONS` enforced | ✅ Done | deleted component, `sessionService.ts`, `tabService.ts` |
| 7 | Modal Escape + focus management (a11y) | ✅ Done | `Popup.tsx` |
| 8 | Build / lint / test green | ✅ Done | 238 tests |
| 9 | Fix typed-linting for root config files (vite.config.ts not in `tsconfig.eslint.json`) | ✅ Done | `tsconfig.eslint.json` include + CLI-verified |

Manual testing checklist: see **Section 6** below.

---

## 1. Verified Baseline (measured, not guessed)

| Check | Command | Result |
|---|---|---|
| TypeScript + build | `pnpm build` | ✅ PASSES (only warning: `@import` order in `popup.css`, line 78) |
| Tests | `pnpm test` | ✅ 219 tests / 12 files — ALL PASS |
| Lint | `pnpm lint` | ✅ Clean (zero output) |

> ⚠️ Note: the working tree contains **uncommitted** post-audit fixes (dark mode partial, export/import, optimistic tab refresh, error boundary, tests). All findings below reflect the **current working tree**, not the older `adhd-tab-manager-production-audit.md` (dated 2026-07-30), which is partially stale (it lists "no dark mode" and "no export" as failures — both now exist).

### Architecture summary

```
src/
├── background/service-worker.ts   — alarms (auto-save 5min, pomodoro 1min), blocked-site redirect, messages, storage migration
├── shared/constants.ts            — STORAGE_KEYS, DEFAULT_TIMER, DEFAULT_BLOCKED_SITES, ALARM_NAMES, DEBUG
└── popup/
    ├── Popup.tsx                  — main orchestrator (665 lines)
    ├── App.tsx / index.tsx        — entry + ErrorBoundary
    ├── components/                — Header, FocusMode, TabGroup, TabCard, PomodoroTimer, SessionSaver,
    │                                DistractionBlocker, DailyQuote, QuickActions, EndOfDaySummary, FocusStats (DEAD), ErrorBoundary
    ├── hooks/                     — useTabs, useTimer, useSessions, useBlockedSites (all expose isLoading + error)
    ├── services/                  — tabService, sessionService, timerService, blockService
    ├── utils/                     — helpers.ts (pure fns), constants.ts (session icons/suggestions)
    ├── styles/                    — popup.css (vars + base), components.css (component styles), animations.css
    └── types/index.ts             — all shared types
```

**Good things already in place:** storage migration framework, undo-close history (20 tabs), optimistic `refreshTabs()` returning data, timer resilience across SW restarts via `chrome.storage.session`, skeleton loaders, error banner, ErrorBoundary, reduced-motion support, comprehensive 219-test suite.

---

## 2. Critical Bugs (user-visible — must fix)

### 2.1 🔴 Undo session delete does NOT restore the session
- **Where:** `src/popup/Popup.tsx` — `handleUndoSessionDelete` (L295–305)
- **Problem:** On delete, only `{ sessionId, sessionName }` is captured. The session data is permanently removed from `chrome.storage.local` by `sessions.remove()` → `tabService.deleteSession()`. The undo handler only calls `sessions.refresh()` (re-reads storage where the session is already gone) and then shows *"Session restored! ✅"* — a misleading success toast. **Nothing is restored.**
- **Fix:** Capture the full `TabSession` object before delete; on undo, re-insert it into storage (dedupe by id) and refresh.
- **Test:** add service-level test for re-insert; component test for the undo flow.

### 2.2 🔴 Dark mode is not persisted and flashes on reopen
- **Where:** `src/popup/Popup.tsx` `handleToggleDarkMode` (L53–59) + `useState` initializer (L41–44); `src/popup/index.html` inline `body { background: #f5f5f5 }`
- **Problem:** Theme is only applied to `document.documentElement.dataset.theme` in memory. Popup close/reopen resets to light. `index.html` hardcodes a light body background → white/light flash every time the popup opens in dark mode.
- **Fix:** Persist theme to `chrome.storage.local`; read it **before React mounts** (inline script in `index.html` + `index.tsx`) so no flash; make `index.html` background theme-aware.

### 2.3 🔴 Data import has no validation — can corrupt storage
- **Where:** `src/popup/Popup.tsx` `handleImport` (L349–383)
- **Problem:** `JSON.parse` result is written straight to `chrome.storage.local` (`adhd_sessions`, `adhd_blocked_sites`, `adhd_timer_settings`). A malformed/hostile file can write non-array values into `adhd_sessions`; downstream code (`getSessions` etc.) then misbehaves. No rollback, no schema check, uses hardcoded keys instead of `STORAGE_KEYS`.
- **Fix:** Extract a pure, testable `validateBackupData()` that shape-checks sessions (`Array`, each with string `id`/`name`/`icon`, numeric timestamps, `tabs: TabInfo[]`), blocked sites (`Array` of `{domain: string, addedAt: number}`), timer settings (positive numbers); write only valid keys via `STORAGE_KEYS`; atomic write; clear error toast on invalid file.

### 2.4 🟠 Pomodoro timer double-decrement race (SW alarm vs popup tick)
- **Where:** `src/background/service-worker.ts` `handlePomodoroTick` (L216–262) decrements `remainingSeconds` every minute **and** `src/popup/hooks/useTimer.ts` (L99–131) calls `tickTimer()` every second while the popup is open. Both do read-modify-write on `adhd_active_timer`.
- **Problem:** While the popup is open, the timer loses ~1 extra second per minute (60 local ticks + 1 SW tick), so a 25-min pomodoro completes ~25s early; occasional lost updates make it non-deterministic. When the SW reaches 0 it also fires a completion notification even though the popup is already handling the transition.
- **Fix:** In the SW, skip decrementing when a popup context is open (`chrome.runtime.getContexts({ contextTypes: ['POPUP'] })`, Chrome 116+, fall back to current behavior if unavailable). This keeps popup = local ticking, closed popup = SW ticking.

---

## 3. UI — "Clean Trending" Overhaul (high impact)

### 3.1 🔴 `components.css` hardcodes 102 hex colors (only 12 use `var(--…)`)
- **Where:** `src/popup/styles/components.css` — every component (tab-card, session-card, focus-mode, pomodoro, blocker, quote, quick-actions, end-of-day…) uses literal `#ffffff`, `#f0f0f0`, `#1976d2`, `#212121`, `#e3f2fd`, `#bbdefb`, `#f8fbff`, `#e8f5e9`, `#2e7d32`, etc.
- **Problem:** The dark-mode variables in `popup.css` exist, but most components ignore them → dark mode looks broken/inconsistent (white cards, hardcoded light tints on dark background).
- **Fix:** Replace every hardcoded color with a semantic CSS variable. Add missing variables to `popup.css` (`--primary-tint`, `--primary-border`, `--success-bg`, `--success-text`, `--warning-bg`, `--danger-bg`, `--hover-tint`, shadows) and define dark values for each. Also convert `animations.css` hex values (`focus-stats`, `progress-bar`).

### 3.2 🟠 Refresh the design language (tasteful modernization)
Keep the MUI-blue identity but push toward a 2026 "clean trending" feel **without breaking the 219-test contract** (class names, aria-labels, and copy are asserted in `tests/components/*`):
- Softer, larger border radii (12–16px), finer hairline borders, layered shadows.
- Gradient accent (primary → secondary) on primary buttons, focus-mode glow, progress ring.
- Consistent focus-visible rings, hover tints via variables.
- Nicer typography scale; keep Roboto (loaded) + tabular numerals for timers.
- Space improvements for the header, nav tabs (pill-style active state), and empty states.

### 3.3 🟠 Fix `@import` order warning in `popup.css`
- The Google Fonts `@import` must be the **first statement** in the file (move above the `:root` block). Kills the build warning.

### 3.4 🟢 Remove hardcoded `#f5f5f5` from `index.html` (see 2.2) and the old-styled `focus-stats` CSS (dead component, see 4.1).

---

## 4. Code Health / Dead Code

### 4.1 🟠 Dead component: `FocusStats`
- `src/popup/components/FocusStats.tsx` is never imported/rendered (Popup uses `FocusMode` instead). Its CSS block lives in `animations.css` (`focus-stats`, `focus-stats__*`). Delete both component + CSS.

### 4.2 🟠 SW duplicates `DEFAULT_BLOCKED_SITES`
- `src/background/service-worker.ts` (L111–120) defines its own copy of the default sites array instead of importing `DEFAULT_BLOCKED_SITES` from `src/shared/constants.ts`. Import the constant; keep the mock `addedAt` fill at init.

### 4.3 🟢 `validateAndCreateTab` unused
- `blockService.validateAndCreateTab` exists; `tabService.restoreLastClosedTab`/`restoreSession` re-implement inline `new URL()` validation. Either use it or leave the inline checks — low priority, prefer minimal churn: **leave as-is** (works, tested) but note it.

### 4.4 🟢 Duplicate session loading
- `useTabs` fetches sessions on mount even though `useSessions` is the dedicated session hook used by the UI. Harmless duplicate read; note as future cleanup — do **not** restructure now (both are covered by tests).

### 4.5 🟢 `sessionsSaved` stat is always `0` (`sessionService.getDailyStats`, L135)
- Cosmetic; the "sessions saved today" stat never increments. Optional wiring: increment a counter in `saveSession`. Low risk, nice for the summary screen.

---

## 5. Accessibility & UX polish

### 5.1 🟠 Modal focus handling — `closeAllConfirm` dialog (Popup.tsx L455–492)
- No Escape-to-close, no focus trap, no `onKeyDown`. Add Escape handling + focus the confirm button on open + return focus on close (basic trap is fine for a 400px popup).

### 5.2 🟢 Toast `aria-live` is present (`role="status"`/`role="alert"`) — good. Ensure the undo toast has `role="alert"` (it does).

### 5.3 🟢 Tab-panel `aria-controls`/`id` wiring is correct; add `tabIndex` management only if needed — currently acceptable.

---

## 6. Manual Testing Checklist (post-fix)

Load `dist/` via `chrome://extensions` → Load unpacked, then:

1. **Popup renders** — header, nav tabs, daily quote, focus card, quick actions; no console errors.
2. **Focus mode** — Start → tabs snapshot; blocked-site navigation redirects to the calm interstitial; counter increments; End → summary shows + focus minutes accrue.
3. **Blocker** — add/remove domains; toggle switch persists across popup reopen; wildcard/subdomain matching.
4. **Sessions** — Save (name + icon); Restore (opens tabs); Delete → **Undo actually restores the session**; rename works.
5. **Undo close** — close a tab, "Undo Close" reopens it at its original index; history capped at 20.
6. **Pomodoro** — start/pause/resume/reset/skip; settings persist; **timer finishes close to the configured duration (no double-speed)**; notification fires when popup closed; phase transitions; streak increments.
7. **Dark mode** — toggle persists after closing/reopening popup; **no white flash**; every panel readable in dark.
8. **Export/Import** — export file; **import the same file restores everything**; import a garbage file → clean error, storage untouched.
9. **Alarms** — auto-save fires every 5 min (check `adhd_auto_saved_tabs`); pomodoro tick every minute.
10. **Extension lifecycle** — reload extension; storage migration banner absent (version 1 already).

**✅ Executed 2026-08-01 in a real browser — see Section 9 for the automated 32-check run.**

---

## 7. Recommended Implementation Order

| # | Task | Severity | Files |
|---|---|---|---|
| 1 | Fix undo session delete | 🔴 | `Popup.tsx`, `tabService.ts` (+tests) |
| 2 | Persist dark mode + pre-render apply + no-flash | 🔴 | `Popup.tsx`, `index.tsx`, `index.html`, new `utils/theme.ts` (+tests) |
| 3 | Import validation (atomic, schema-checked) | 🔴 | `Popup.tsx`, new `utils/validation.ts` (+tests) |
| 4 | SW: shared defaults + skip pomodoro tick when popup open | 🟠 | `service-worker.ts` |
| 5 | Convert `components.css` + `animations.css` to variables; modernize palette; fix `@import` order | 🔴/🟠 | `popup.css`, `components.css`, `animations.css` |
| 6 | Remove dead `FocusStats` + CSS; `sessionsSaved` stat wiring | 🟢 | delete component, `animations.css`, `sessionService.ts` |
| 7 | Modal Escape + focus (a11y) | 🟠 | `Popup.tsx` |
| 8 | Final: `pnpm build` / `pnpm lint` / `pnpm test` green + manual checklist | — | — |
| 9 | **Cross-browser** (Firefox event page, browser shim, heartbeat) | ✅ Done | `src/shared/browser.ts`, `service-worker.ts`, `scripts/build-firefox.mjs` |
| 10 | **Real-browser e2e** (Chrome CDP, 32 checks) | ✅ Done | `scripts/e2e/chrome-e2e.mjs` |
| 11 | **Safari** — wrapper + icons + review (see §11) | 🟠 Follow-up | Xcode / App Store Connect |

---

## 8. Cross-Browser Support (added 2026-08-01)

### 8.1 Chromium (Chrome / Edge / Brave / Opera) — ✅ supported
- MV3 service worker (`service_worker` + `type: module`), built by `@crxjs/vite-plugin` → `dist/`.
- Load: `chrome://extensions` → Developer mode → Load unpacked → `dist/`.
- **Note (Chrome 137+):** branded Google Chrome ignores `--load-extension`. Automated tests use **Chrome for Testing** (see §9).

### 8.2 Firefox — ✅ supported (MV3 event page)
- Firefox rejects Chrome's `service_worker` + `type: module` background shape (addons-linter error). The Firefox artifact therefore uses an **event page**: `background.scripts: ["background.js"]`, where `background.js` is an esbuild-bundled **IIFE** (classic script, no top-level import/export) of `src/background/service-worker.ts`.
- `scripts/build-firefox.mjs` copies `dist/` → `dist-firefox/`, bundles the event page, adds `browser_specific_settings.gecko` (`id: adhd-tab-manager@example.com`, `strict_min_version: 121.0`), strips the Chrome `key`, and removes the Chromium SW loader.
- `pnpm build:firefox` / `pnpm build:all` produce it; `pnpm lint:firefox` (web-ext lint) passes with **0 errors** (2 benign `UNSAFE_VAR_ASSIGNMENT` warnings — react-dom internals, false positives; 1 `MISSING_DATA_COLLECTION_PERMISSIONS` notice — we collect no data).
- Load: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist-firefox/manifest.json`, or `pnpm exec web-ext run --source-dir dist-firefox`.

### 8.3 Cross-browser API layer
- `src/shared/browser.ts` exports `browser` = `globalThis.browser ?? chrome` — promise-based on both engines (Chrome's `browser` global is absent → falls back to `chrome`; Firefox/Safari expose `browser`). All extension API access goes through it.
- `runtime.getContexts` (popup-open detection for the pomodoro double-decrement guard) is **Chrome-only**. Firefox/Safari fall back to a **popup heartbeat**: the popup writes `adhd_popup_heartbeat` (ms timestamp) every 30 s; the worker treats it as open when < 45 s old (`POPUP_HEARTBEAT_INTERVAL_MS` / `POPUP_HEARTBEAT_STALE_MS` in `src/shared/constants.ts`).
- Chromium-only `tabs.ungroup` (discarded-tab cleanup) is feature-guarded (`typeof ungroup === 'function'`) and reached through an alias so the Firefox linter doesn't flag it; it no-ops in Firefox.
- MV3 CSP: the theme preload moved from an inline script to `public/theme-preload.js` (external) so the popup passes Firefox's no-inline-script CSP.

### 8.4 API surface vs. Safari (all used APIs are supported)
`tabs.query/get/remove/create/update`, `tabs.onUpdated/onReplaced`, `storage.local`, `storage.session` (Safari ≥ 16.4), `alarms`, `notifications` (macOS; no-op on iOS), `runtime.onInstalled/onMessage`. Tab groups and `getContexts` are never required (feature-guarded / heartbeat fallback). The `browser.*` namespace is supported by Safari since 15.4.

---

## 9. Real-Browser Testing (executed 2026-08-01)

### 9.1 Chrome — `node scripts/e2e/chrome-e2e.mjs` → **32/32 checks pass**

Drives a real Chrome binary via CDP (headless=new, isolated temp profile) against the built `dist/`:

| Area | Checks (all ✅) |
|---|---|
| Render | header "ADHD Tabs", daily quote, focus toggle, 5 nav tabs |
| Heartbeat | popup heartbeat written to storage (Firefox fallback) |
| Dark mode | toggle → `data-theme=dark`, persisted, **survives reload** (preload path, no flash) |
| Nav | Tabs / Timer / Sessions / Block / Home panels switch |
| Pomodoro | idle 25:00 → counts down → pause freezes → resume → reset to Ready |
| Focus mode | start (active card) → end |
| Blocker | add `example.com` → visible → remove |
| Sessions | save → delete (confirm) → undo toast → **session restored** |
| Service worker | alarms `adhd_auto_save` + `adhd_pomodoro_tick` registered; `GET_FOCUS_STATE` message answered |
| Responsive | no horizontal overflow at 360 / 400 / 480 / 800 px; body capped 400→480 px |
| Console | zero errors / exceptions |

Screenshots are written to `artifacts/chrome-*.png` (light, dark, timer, focus, blocker, sessions, 4 viewport widths).

> ⚠️ Branded Google Chrome ≥ 137 ignores `--load-extension`, so the harness expects **Chrome for Testing** (`CHROME_FOR_TESTING` env var, default `/tmp/cft/chrome-mac-x64/...`).

### 9.2 Firefox — web-ext run smoke test (real Firefox 152, temp profile)
- `pnpm exec web-ext run --source-dir dist-firefox` → **"Installed … as a temporary add-on"** (no manifest or CSP errors).
- Background event page verified end-to-end: `onInstalled` → `initializeDefaults()` writes `storage.local`, observable as the `storage/default/moz-extension+++<uuid>/idb` directory in the run's temp profile.
- `pnpm lint:firefox` → 0 errors.

### 9.3 Manual checklist items that need a human (not automatable headless)
- Real toolbar-popup interaction with a profile that has real tabs (restore-into-window, close-all across windows).
- Notification banner appearance (timer completion with popup closed) on macOS.
- Import via the native file picker (export covered by unit tests).

---

## 10. Responsive & Mobile Readiness (added 2026-08-01)

- Popup width is fluid: `body { width: min(400px, 100vw) }`, widening to `min(480px, 100vw)` on ≥ 600 px viewports, with `overflow-x: hidden`.
- Long content wraps everywhere (`overflow-wrap: anywhere; word-break: break-word` on tab/session/blocker/timer labels).
- ≤ 360 px compact overrides for nav tabs, header actions, quick actions, pomodoro actions, blocked-site rows, session cards.
- e2e-verified: no horizontal overflow at 360/400/480/800 px; body caps at 400→480 px as designed.
- **Mobile caveat:** desktop browsers don't run toolbar popups on phones — Chrome Android doesn't support desktop extensions; Firefox for Android runs a limited subset of extensions (popup UI supported since FF 126+). The responsive layout above is what ships; native mobile apps are out of scope for this project.

---

## 11. Safari Support — Feasibility & Effort (added 2026-08-01)

**Verdict: feasible with ~1–2 engineer-days + $99/yr Apple Developer Program for distribution. No core code changes required.**

### Facts (sources: Apple Developer Documentation, 2026-08-01)
| Item | Fact |
|---|---|
| Conversion | `xcrun safari-web-extension-packager /path/to/extension` (flags: `--project-location`, `--app-name`, `--bundle-identifier`, `--swift`/`--objc`, `--macos-only`/`--ios-only`, `--copy-resources`, `--no-open`, `--force`). Creates an Xcode project wrapping the extension in a macOS/iOS app. |
| No-Xcode option | App Store Connect web-based packager ("Packaging and distributing Safari Web Extensions with App Store Connect") — upload, no local Xcode. |
| MV3 | Supported since Safari 15.4 (non-persistent background). |
| Namespaces | Both `chrome.*` and `browser.*` + both callback and Promise styles — our `browser` shim works as-is. |
| Background | Safari uses `background.scripts` event pages — **identical to our Firefox build shape** (`dist-firefox` is nearly a drop-in; `browser_specific_settings` is ignored). |
| `storage.session` | Safari ≥ 16.4; earlier versions fall back via existing try/catch. |
| `runtime.getContexts` | Not in Safari → heartbeat fallback (already implemented for Firefox) covers it. |
| `notifications` | macOS yes; iOS unsupported (already wrapped in try/catch in the SW). |
| Storage limit | local 5 MB (unlimited with `unlimitedStorage` in Safari 16+); our data is tiny. |
| Icons | Extension icons at 48/64/96/128/256/512 px + toolbar 16/19/32/38 px — we ship 16/48/128, so add the missing sizes. |
| Distribution | App Store via Apple Developer Program ($99/yr); privacy manifest + data-collection declaration (we collect none — declare empty). |

### Work breakdown
1. **0.5 day** — generate icon sizes (48/64/96/128/256/512, toolbar 16/19/32/38) and add to `public/icons/`.
2. **0.5–1 day** — `safari-web-extension-packager` on `dist-firefox/` (or App Store Connect web tool); strip `browser_specific_settings`/`key`; sign/run in Xcode; smoke-test popup + alarms in Safari on macOS.
3. **0.5 day** — manual QA in Safari (same checklist as §6); fix any WebKit quirks (CSS is standard; risk is low).
4. **Optional** — iOS app target (works the same; popup + alarms behavior is identical, notifications no-op).
5. **Ongoing** — Apple Developer Program ($99/yr) + App Store review if distributing.

---

## 12. Git / CI Readiness (added 2026-08-01)

- **TypeScript aligned:** `typescript@5.9.3`, `@typescript-eslint/*@8.x` (installed 8.65.0), ESLint 8.57 — single resolved versions, no drift (lockfile importer specifiers match `package.json`).
- **pnpm 11:** build scripts approved via `pnpm-workspace.yaml` `allowBuilds` (`spawn-sync: true`, `esbuild: false`).
- **CI recipe:** `pnpm install --frozen-lockfile` → `pnpm lint` (now whole-project) → `pnpm test` → `pnpm build:all` → `pnpm lint:firefox` → `node scripts/e2e/chrome-e2e.mjs` (all green today).
- **Artifacts:** `dist/` (Chrome), `dist-firefox/` (Firefox), `artifacts/` (e2e screenshots) — all git-ignored; e2e script committed for repeatability.
- **Git:** all work committed on `main`; no remote configured — add one and `git push` when ready.

---

## 13. Production-Readiness Verdict

**Yes.** The extension is production-ready for Chromium and Firefox: builds clean, 238 unit/integration tests + 32 real-browser e2e checks pass, web-ext lint has 0 errors, the UI is responsive and dark-mode-consistent, and Safari is a ~1–2 day wrapper task with no code changes. Remaining before an actual store launch: replace the placeholder gecko id (`adhd-tab-manager@example.com`), AMO/Chrome Web Store review assets (store listing, screenshots from `artifacts/`), and a human pass over the §9.3 manual checklist (see `docs/manual-test-plan.md`).

---

## 14. Manual Testing Environment (MCP) — ready for a human (added 2026-08-01)

A persistent, extension-loaded test environment is built and verified:

- **`node scripts/e2e/start-test-env.mjs`** — launches **Chrome for Testing** with `dist/` loaded on CDP port `9222`, persistent profile in `.e2e-profile/` (git-ignored), prints the extension id + popup URL. Subcommands: `--stop`, `--status`, `--foreground`.
- **`.zed/mcp.json`** — configures two servers:
  - `chrome-devtools-mcp-attach` → attaches to the running instance via `--browserUrl http://127.0.0.1:9222`;
  - `chrome-devtools-mcp-launch` → launches its own CfT with the extension (self-contained).
- **`node scripts/e2e/interactive-smoke.mjs`** — quick CDP smoke (header, 5 nav tabs, quote, focus toggle, heartbeat, no overflow) against the running instance; **passes**.
- **`scripts/e2e/discover-extension.mjs`** — robust extension-id discovery (profile-path match beats CDP targets; the MV3 service worker is often dormant and Chrome component extensions can share `service-worker-loader.js`).
- **`docs/manual-test-plan.md`** — full human test plan: §1–12 feature/edge-case matrix (60+ checks), §13 release gate, §10 fixtures, Appendix A storage-key cheat sheet.
- **`scripts/e2e/test-fixtures/`** — import fixtures (`valid-backup.json`, `partial-backup.json`, `malformed-sessions.json`, `hostile-file.json`, `non-object.json`, `blocked-site-match-cases.json`), guarded by `tests/fixtures.test.ts` (6 tests) so they can't drift from `validateBackupData`.
- **Firefox smoke (real Firefox 152):** `web-ext run` loads `dist-firefox` as a temporary add-on; the add-on's IndexedDB (`storage/default/moz-extension+++…/idb`) contains the seeded defaults (`reddit.com`, `youtube`) proving the event page + `onInstalled` migration ran.

**Manual test sessions verified today:** Chrome e2e harness 32/32; interactive smoke pass; Firefox load + storage-seed pass. Everything else in `docs/manual-test-plan.md` is the human checklist.
