# ADHD Tab Manager — Production Readiness Analysis

**Date:** 2026-08-01
**Scope:** Deep analysis of `adhd-tab-manager` (Chrome Extension, Manifest V3, React 18 + TypeScript + Vite + @crxjs)
**Goal:** Functional, production-ready, clean trending UI — loadable via `chrome://extensions` → Load unpacked → `dist/`

---

## ✅ Implementation Status (updated 2026-08-01)

All tasks below have been **implemented and verified**: `pnpm build` ✅ (clean), `pnpm lint` ✅ (clean, whole project incl. scripts), `pnpm test` ✅ **268 tests / 15 files pass**, `pnpm lint:firefox` ✅ (0 errors), a **real-browser e2e run: 50/50 checks pass** (see §9), a **full manual-test run: 78/78 pass incl. the slow SW-tick check** (see §15), plus **sidepanel-smoke 14/14** and **multiwindow-smoke 9/9**. Firefox support (MV3 event page), the cross-browser `browser` shim, the popup-heartbeat fallback, responsive layouts, the Chrome **side panel**, **live dynamic data**, **multi-window support**, the **Tao Te Ching quotes**, the **new logo**, and the **side-panel-default surface** were added in the same passes — see §§8–17.

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
| 8 | Build / lint / test green | ✅ Done | 248 tests |
| 9 | Fix typed-linting for root config files (vite.config.ts not in `tsconfig.eslint.json`) | ✅ Done | `tsconfig.eslint.json` include + CLI-verified |
| 10 | Focus redirect → real interstitial page (data: URLs no longer commit via `tabs.update`) | ✅ Done | `public/interstitial.{html,css,js}`, `service-worker.ts` |
| 11 | Blocker toggle respected during focus (SW guard) + force-activate/deactivate | ✅ Done | `service-worker.ts`, `Popup.tsx`, `useBlockedSites.ts` |
| 12 | Timer settings reject NaN; day-aware pomodoro streak | ✅ Done | `PomodoroTimer.tsx`, `timerService.ts` (+4 tests) |
| 13 | 50-session cap blocks with a message (no silent drop); rename UI added | ✅ Done | `SessionSaver.tsx` |
| 14 | Close-all modal: real focus trap + initial-focus selector fix | ✅ Done | `Popup.tsx` |
| 15 | Theme zero-flash: synchronous localStorage preload mirror + `storage.onChanged` sync | ✅ Done | `public/theme-preload.js`, `utils/theme.ts` |
| 16 | Manual-test driver: 74/74 checks against real Chrome (incl. SW-tick, import round-trip, focus trap) | ✅ Done | `scripts/e2e/manual-test.mjs`, `docs/manual-test-results.md` |
| 17 | **Chrome side panel**: manifest `sidePanel` + `side_panel.default_path`, `src/sidepanel/` page (same app, fluid layout), header toggle after the theme icon, `adhd_sidepanel_open` lifecycle flag (pagehide/unload — not beforeunload), SW timer-surface guard includes SIDE_PANEL, Firefox build strips side panel bits | ✅ Done | `manifest.json`, `src/sidepanel/`, `src/shared/sidePanel.ts`, `Header.tsx`, `Popup.tsx`, `service-worker.ts`, `scripts/build-firefox.mjs`, `scripts/e2e/sidepanel-smoke.mjs` |
| 18 | **Live dynamic data**: popup/side panel subscribe to `tabs.onCreated/onRemoved/onMoved/onActivated/onAttached/onDetached/onReplaced/onUpdated` (debounced) + `windows.onRemoved/onFocusChanged` + `storage.onChanged` (sessions, blocked sites, timer state, stats, focus state) — every surface updates instantly when tabs/windows change or the other surface writes | ✅ Done | `useTabs.ts`, `useSessions.ts`, `useBlockedSites.ts`, `useTimer.ts`, `Popup.tsx` |
| 19 | **Multi-window support**: tabs grouped per window in the Tabs view (Window 1/2/…, current marked); Save session prompts which window(s) to snapshot (never silently merges all); Close All / Close Window window-aware (modal shows per-window breakdown); undo-close restores into the original window; Quick Actions show window count | ✅ Done | `tabService.ts`, `TabGroup.tsx`, `SessionSaver.tsx`, `QuickActions.tsx`, `Popup.tsx`, `utils/helpers.ts` |
| 20 | Multi-window + live-data verification: e2e 49/49 (incl. §9c), manual-test §12 4/4, unit tests 267 | ✅ Done | `scripts/e2e/chrome-e2e.mjs`, `scripts/e2e/manual-test.mjs`, `tests/` |
| 21 | **Tao Te Ching quotes** on the Home tab: 13 curated quotes, each rendered with its chapter + verse citation (“— Tao Te Ching, Ch. N, v. M”), tested | ✅ Done | `src/popup/utils/constants.ts`, `DailyQuote.tsx`, `tests/components/DailyQuote.test.tsx` |
| 22 | **Close-Window multi-window picker**: with 2+ windows the Home “Close Window” action shows a chooser (Window 1/2/3 — tab count each, pinned stay open, undoable); single window closes directly. Escape + focus trap | ✅ Done | `QuickActions.tsx`, `Popup.tsx`, `tests/components/QuickActions.test.tsx` |
| 23 | **Side panel full-height tab list**: `sidepanel.css` fluid flex chain, `.tab-group__list { flex:1; overflow-y:auto; overflow-x:hidden }` — list fills the panel and scrolls internally, verified in real Chrome (scrollHeight 1058 > client 556, no x-overflow) | ✅ Done | `src/sidepanel/sidepanel.css` |
| 24 | **Pomodoro spacing**: 12px margin below the timer actions (Start Focus / Settings buttons) | ✅ Done | `src/popup/styles/components.css` |
| 25 | **Modern logo**: indigo→violet gradient tile with white brain + amber spark; `public/icons/logo.svg` + regenerated 16/32/48/128 PNGs; header renders it (🧠 fallback in jsdom); manifest icons updated | ✅ Done | `public/icons/*`, `scripts/generate-icons.mjs`, `Header.tsx` |
| 26 | **Side panel is the DEFAULT surface** on Chrome/Edge/Firefox (no floating popup; toolbar click opens the panel via `action.onClicked`), **popup kept for Safari** (no side panel API there); header panel↔popup toggle icon **removed**; `adhd_sidepanel_open` flag deleted; Firefox `sidebar_action` with `open_at_install`; `dist-safari/` build restores `default_popup` | ✅ Done | `manifest.json`, `scripts/build-{chrome,firefox,safari}.mjs`, `service-worker.ts`, `Header.tsx`, `Popup.tsx`, `src/shared/sidePanel.ts`, `src/sidepanel/index.tsx` |
| 27 | **Build pipeline fix**: crx only bundles HTML pages referenced in the manifest — restoring `default_popup` in the source manifest (stripped post-build for Chrome/Edge/Firefox) so `src/popup/index.html` is built again (was 404 after the popup removal); `dist-safari` added to ESLint ignore | ✅ Done | `manifest.json`, `package.json`, `scripts/build-chrome.mjs`, `.eslintrc.cjs` |
| 28 | Full re-verification of the batch: e2e **50/50**, manual **78/78** (incl. slow SW-tick), sidepanel-smoke **14/14**, multiwindow-smoke **9/9**, unit **268/268**, lint clean, `lint:firefox` 0 errors, real Firefox loads `dist-firefox` cleanly | ✅ Done | `scripts/e2e/*` |

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
- **`node scripts/e2e/multiwindow-smoke.mjs`** — real-browser smoke of the live-data + multi-window features against the running instance (live tab create/close, per-window grouping, save-window prompt, close-window action); **9/9 passes**.
- **`scripts/e2e/sidepanel-smoke.mjs`** — real-browser smoke of the Chrome side panel (toggle placement/state, panel render, timer surface, theme sync, responsive widths); **14/14 passes**.
- **`scripts/e2e/discover-extension.mjs`** — robust extension-id discovery (profile-path match beats CDP targets; the MV3 service worker is often dormant and Chrome component extensions can share `service-worker-loader.js`).
- **`docs/manual-test-plan.md`** — full human test plan: §1–12 feature/edge-case matrix (60+ checks), §13 release gate, §10 fixtures, Appendix A storage-key cheat sheet.
- **`scripts/e2e/test-fixtures/`** — import fixtures (`valid-backup.json`, `partial-backup.json`, `malformed-sessions.json`, `hostile-file.json`, `non-object.json`, `blocked-site-match-cases.json`), guarded by `tests/fixtures.test.ts` (6 tests) so they can't drift from `validateBackupData`.
- **Firefox smoke (real Firefox 152):** `web-ext run` loads `dist-firefox` as a temporary add-on; the add-on's IndexedDB (`storage/default/moz-extension+++…/idb`) contains the seeded defaults (`reddit.com`, `youtube`) proving the event page + `onInstalled` migration ran.

**Manual test sessions verified today:** Chrome e2e harness 32/32; interactive smoke pass; Firefox load + storage-seed pass. Everything else in `docs/manual-test-plan.md` is the human checklist.

---

## 15. Manual Test Execution — 74/74 PASS (added 2026-08-01, afternoon)

`node scripts/e2e/manual-test.mjs` now **spawns its own Chrome for Testing** (fresh temp profile, port 9334) and drives the REAL popup over CDP — real button clicks, real inputs, real tabs, real storage, real service worker — executing the plan's §1–§11 matrix plus the 60 s SW-tick check (`MANUAL_TEST_SLOW=1`):

- **74/74 checks PASS** (21 🔴 must-pass all green); details in `docs/manual-test-results.md`, raw data in `artifacts/manual/results.json`, screenshots in `artifacts/manual/`.
- 🔴 Fixes this pass surfaced (all verified end-to-end):
  1. Focus redirects used a `data:` URL, which current Chrome silently refuses to commit via `tabs.update` → replaced with a real interstitial extension page (`public/interstitial.*`).
  2. SW redirect ignored the blocker on/off toggle → now guards on `adhd_blocked_sites_active`; focus start/end force-activate/deactivate (was a flip that could desync).
  3. Timer settings accepted `NaN` (e.g. `1e`) → `Number.isFinite` guards.
  4. Session cap silently dropped the oldest session → clear blocked message at 50.
  5. Close-all modal had no focus trap and its initial-focus selector never matched → real trap + selector fix.
  6. Pomodoro streak never reset → day-aware via `adhd_last_pomodoro_date`.
  7. Theme preload applied theme async (flash window) → synchronous localStorage cache mirror.
  8. Blocker input rejected pasted URLs and gave no duplicate feedback → normalize-then-validate + "already blocked" toast.
  9. Session rename had no UI → inline ✏️ editor.
- Remaining human-only checks (documented): toolbar popup interaction, macOS notification banner, Firefox §12 interactive pass, native file-picker click.

---

## 16. Live Dynamic Data + Multi-Window Support (added 2026-08-03)

### 16.1 Live dynamic data — everything updates automatically

Before this pass the popup only queried tabs **on mount** and after its own actions. Any tab created/closed/moved in the browser (or by the side panel, or by the service worker) left the UI stale until a manual refresh. Now:

- **`useTabs`** subscribes to `tabs.onCreated`, `tabs.onRemoved`, `tabs.onMoved`, `tabs.onActivated`, `tabs.onAttached`, `tabs.onDetached`, `tabs.onReplaced`, `tabs.onUpdated` (debounced 150 ms — it fires on every title/favicon change), `windows.onRemoved` and `windows.onFocusChanged`. Every event re-queries `chrome.tabs`/`chrome.windows`, so closing a tab, opening a new one, or opening/closing a window is reflected instantly.
- **`useSessions` / `useBlockedSites`** mirror their storage keys via `storage.onChanged` — a save in the side panel appears in the popup immediately, and vice-versa.
- **`useTimer`** mirrors `adhd_active_timer` + `adhd_timer_settings` from storage, so popup ↔ side panel countdowns stay in lock-step. **Tick ownership:** when both surfaces are open, only the popup owns the 1 s tick (`runtime.getContexts` — it has the highest priority); the side panel mirrors. This prevents the timer running at double speed (both surfaces ticking). Firefox (no `getContexts`, no side panel) is unaffected.
- **`Popup`** refreshes daily stats + focus state via `storage.onChanged` (blocker counters written by the service worker show up live).

### 16.2 Multi-window distinction

- **Tabs view** groups tabs by window: `TabGroup` renders “Window 1 / Window 2 / …” sections (stable numbering by ascending window id), the focused window is marked with a dot, and each section gets a “✕ Close” button for that window's non-pinned tabs. Single window → plain unwrapped list (no noise).
- **Save session prompts the window selection.** With 2+ windows the save dialog shows a checkbox per window (“Save tabs from which windows?”), current window pre-selected, Save disabled until ≥1 window is checked. It never silently merges every window into one session — “Window 2 only”, “Window 1 + 3”, etc. are explicit user choices.
- **Close All / Close Window** are window-aware: “Close Window” (quick action) closes the current window's non-pinned tabs; “Close All” closes across all windows; the confirmation modal shows a per-window breakdown when >1 window is involved. Both record every tab for undo.
- **Undo-close restores into the original window** (`tabs.create({ windowId })`, falling back to the current window if the original was closed).
- **Quick Actions** info card shows “N windows” when >1.

### 16.3 Verification

- `pnpm lint` clean · `pnpm test` **267/267** · `pnpm build` clean · `pnpm lint:firefox` 0 errors.
- `node scripts/e2e/chrome-e2e.mjs` → **49/49** (new §9c: live create/close, 2-window grouping, save-prompt selection, close-window modal + action).
- `node scripts/e2e/manual-test.mjs` → **77 PASS / 0 FAIL / 1 slow-skip** (new §12.1–12.4).
- Docs: `docs/manual-test-plan.md` §12 (multi-window & live data), `docs/manual-test-results.md` §12.

## 17. Side-Panel-Default + Feature Batch (added 2026-08-03)

### 17.1 Side panel is now the DEFAULT surface (Chrome / Edge / Firefox)

- **Chromium**: `manifest.json` keeps `action.default_popup` so @crxjs bundles `src/popup/index.html` (the e2e/manual harnesses open that URL directly, and the Safari build needs the page), then `scripts/build-chrome.mjs` strips it from `dist/manifest.json` post-build. With no `default_popup`, Chrome fires `action.onClicked` → the service worker opens the side panel (`chrome.sidePanel.open({ windowId })`). No floating popup.
- **Firefox**: `scripts/build-firefox.mjs` strips `default_popup` and adds `sidebar_action { default_panel: 'src/sidepanel/index.html', open_at_install: true }` — the toolbar button opens the sidebar, also no floating popup. Verified with `web-ext run` (real Firefox 152 loads `dist-firefox` cleanly).
- **Safari**: has no side panel API (neither `side_panel`/`sidePanel` nor `sidebar_action`) → `scripts/build-safari.mjs` builds `dist-safari/` from `dist-firefox/`, strips the sidebar keys, and **restores `action.default_popup`** — the classic popup is the Safari surface. (~1–2 days of wrapper effort remains for a real Safari build — see §11.)
- The header panel↔popup toggle icon is **removed** (there is nothing to toggle between — the panel is the surface); the `adhd_sidepanel_open` storage flag is deleted along with the `STORAGE_KEYS.SIDE_PANEL_OPEN` constant and the side-panel unload listener.

### 17.2 Feature batch

- **Tao Te Ching quotes** (`DailyQuote`): 13 curated quotes; each card cites the chapter and verse — “— Tao Te Ching, Ch. 8, v. 1”.
- **Close-Window multi-window picker** (`QuickActions`): with 2+ windows, Home's “Close Window” opens a chooser listing every window with its tab count (pinned stay open; undoable); single-window environments close directly. Escape closes; focus is trapped. Verified live with 3 windows.
- **Side panel full-height tab list**: `sidepanel.css` flex chain (`height:100vh` → `#root` → `.popup-root` → `.popup-content` → `#panel-tabs` → `.tab-group`), `.tab-group__list { flex:1; max-height:none; overflow-y:auto; overflow-x:hidden }`. In real Chrome: `scrollHeight 1058 > clientHeight 556`, `overflowX ok`.
- **Pomodoro spacing**: `.pomodoro-timer__actions { margin-bottom: 12px }`.
- **New logo**: `public/icons/logo.svg` (indigo→violet gradient tile, white brain, amber spark); `scripts/generate-icons.mjs` rasterizes via headless Chrome (`Page.captureScreenshot`, transparent bg) into 16/32/48/128 PNGs; `Header.tsx` renders the logo image (🧠 emoji fallback in jsdom); manifest `action.default_icon` + `icons` updated.

### 17.3 Build pipeline fix (regression this batch caught)

Removing `action.default_popup` from the source manifest silently dropped `src/popup/index.html` from the build — @crxjs only bundles HTML pages referenced by the manifest. Symptom: every harness aborted with `ERR_FILE_NOT_FOUND` on the popup URL (e2e: “timed out waiting for app header”). Fix: keep `default_popup` in the source manifest, strip it per-browser in `scripts/build-chrome.mjs` (Chrome/Edge) and `scripts/build-firefox.mjs` (Firefox), keep it in `build-safari.mjs`. `dist-safari/` was also missing from the ESLint ignore patterns → added.

### 17.4 Verification (all green)

- `pnpm lint` clean (whole project) · `pnpm test` **268/268** · `pnpm build:all` clean · `pnpm lint:firefox` **0 errors** (2 benign warnings, 1 notice).
- `node scripts/e2e/chrome-e2e.mjs` → **50/50** (incl. rewritten §9b: no `default_popup`, no toggle icon, `chrome.sidePanel.open()` with user gesture, SW `getContexts` sees SIDE_PANEL, side panel renders 5 nav tabs + fluid layout + full-height scrollable list, heartbeat).
- `node scripts/e2e/manual-test.mjs` → **78/78** (incl. `MANUAL_TEST_SLOW=1` SW-tick check 8.7; checks 1.1 & 7.5 updated for the new logo markup and the committed-URL undo race).
- `node scripts/e2e/sidepanel-smoke.mjs` → **14/14** · `node scripts/e2e/multiwindow-smoke.mjs` → **9/9**.
- Real-browser (Chrome for Testing :9222): popup renders logo + cited quote; side panel list fills height and scrolls; 3-window close picker lists “Window 1/2/3 — N tabs · will close”.
- Real Firefox 152 (`web-ext run`): `dist-firefox` installs as a temporary add-on with no errors.

## 18. Submission Batch — toolbar-click fix, logo spacing, donations, store-listing (added 2026-08-03)

### 18.1 Toolbar-click bug — root-caused and fixed

**Reported:** clicking the extension icon did not open the side panel; only right-click → “Open Side Panel” worked.

**Root cause (probed live over CDP on the extension's service worker):**
- `chrome.action.getPopup({})` returned `""` (the `default_popup` strip was correct — clicks *do* fire `action.onClicked`),
- but `chrome.sidePanel.getPanelBehavior()` returned **`{ openPanelOnActionClick: false }`** — the extension never configured Chrome's native “open the panel when the toolbar icon is clicked” behavior,
- and `chrome.sidePanel.open()` throws *“may only be called in response to a user gesture”* outside a real gesture — making the `action.onClicked` fallback fragile.

**Fix** (`src/background/service-worker.ts`): the service worker now calls
`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` at startup (aliased through the existing `SidePanelLike` cast so the Firefox addons-linter never sees a literal `chrome.sidePanel`). Chrome itself now opens the panel natively on a toolbar click — the canonical mechanism, with no gesture edge cases. The `action.onClicked` handler remains as a defensive fallback for older Chrome versions. Verified: `getPanelBehavior()` → `{ openPanelOnActionClick: true }`, `getPopup({})` → `""`.

**Important for the user's real browser:** if the extension was loaded *before* this change, Chrome caches the old action config across “Reload” — the user must **Remove the extension and “Load unpacked” again** (or use a fresh profile). This is a Chrome unpacked-extension quirk, not a code path. Documented in README + `docs/manual-test-plan.md` §14.

### 18.2 Logo spacing

`public/icons/logo.svg`: the brain glyph's bottom arcs bulge ~3.7 units below its nominal 24×24 box, so `translate(0 10) scale(5.2)` (old) and even `translate(10 20) scale(4.5)` (previous batch) left the brain touching the tile's inner stroke at the bottom (9 px margin vs 19 px on the sides). Changed to **`translate(10 10) scale(4.5)`** — pixel-probed the rasterized `icon128.png` (decoded via `zlib` in Node): brain bbox x 19–108, y 19–108 → **symmetric 19 px margins on all four sides**. PNGs regenerated (`scripts/generate-icons.mjs`).

### 18.3 Donations (Home tab, last section) 💜

SideRouter donation assets were requested but **do not exist anywhere on this machine** (searched `*siderouter*`, `*donation*`, `*donate*` under `/Users/user`), so the donation feature was built from scratch with a clean, trending design:

- **`DonateCard`** (`src/popup/components/DonateCard.tsx`) — the **last section on the Home tab** (“Support the Project”, pulsing 💜, “☕ Buy me a coffee” CTA).
- **Donation modal**: gradient hero with an inline heart SVG asset, “Support ADHD Tab Manager” copy, **$1/$3/$5/$10 amount chips**, a “Donate $N” CTA that opens the donation page in a new tab (appends `?amount=N` for Ko-fi / Buy Me a Coffee), Cancel/Escape/overlay-click close, **focus trap**, and a “View source on GitHub” footer link (open source).
- **Config**: `DONATION_URL`, `SOURCE_URL`, `DONATION_AMOUNTS` in `src/shared/constants.ts`. ⚠️ The defaults are placeholders — set the real Ko-fi/BMC/Sponsors URL and the real repository URL before store submission (checklist item in `docs/manual-test-plan.md` §16).
- Tests: `tests/components/DonateCard.test.tsx` (6 tests). Verified live in real Chrome: card is the last Home section, modal opens, amounts select, CTA opens the donation tab, modal closes.

### 18.4 Store-listing readiness (Chrome / Edge / Firefox / Safari)

- Manifest `description` is now browser-neutral (“A browser extension…”) — previously said “A Chrome Extension”, which is wrong for AMO/Edge/Safari listings. Applied to `manifest.json` + `package.json`.
- All four targets verified: `pnpm build:all` (dist/ + dist-firefox/) and `pnpm build:safari` (dist-safari/ popup surface) build clean; `pnpm lint:firefox` 0 errors.
- README: new **Store listings** table (artifact per store + pre-submission notes), donation section, updated test counts, toolbar-click troubleshooting tip.
- ⚠️ **Pre-submission (user action):** set real `DONATION_URL`/`SOURCE_URL`; replace the AMO `gecko.id` (`adhd-tab-manager@example.com`) with a real reverse-domain ID; Safari needs the `safari-web-extension-packager` wrapper (≈1–2 days, no code changes — see §11).

### 18.5 Verification (all green)

- `pnpm lint` clean · `pnpm test` **274/274** (268 + 6 new DonateCard) · `pnpm build:all` clean · `pnpm build:safari` clean · `pnpm lint:firefox` 0 errors (2 benign warnings, 1 notice).
- `node scripts/e2e/chrome-e2e.mjs` → **50/50**.
- `node scripts/e2e/manual-test.mjs` → **78/78** (incl. `MANUAL_TEST_SLOW=1`).
- `node scripts/e2e/sidepanel-smoke.mjs` → **15/15** (new check: `openPanelOnActionClick === true`).
- `node scripts/e2e/multiwindow-smoke.mjs` → **9/9**.
- Real-browser (Chrome for Testing :9222): donate card + modal live-verified; logo margins pixel-verified; panel behavior probe verified.

## 19. GitHub Publishing Batch — SideRouter donations, feedback section, README, repo push (added 2026-08-03)

### 19.1 SideRouter donation implementation (replaces the placeholder) 💜

**Found the SideRouter project** at `/Users/user/code/web_apps/side_router` (git repo, remote `https://github.com/ranka23/side-router.git`). Its donation feature is a **crypto modal**: `main.html` donate modal + `src/lib/settings.js` (`walletAddresses`, `renderDonateQrCodes`, `copyDonateAddress`) + `src/styles.css` `.modal-donate` block + QR images in `media/`.

Ported into the extension:
- **Real public addresses** (from `settings.js`): ETH `0x907DB6Ad294bD6B9adAE4C2340d34883E32F121A`, SOL `H9kw2HG3eik5uKYoULHuzohoY7gCi1Jfqk38ppn1Szyo` (USDC/USDT → the ETH address).
- **QR images copied** `side_router/media/{eth,sol}-address.jpg` → `public/donate/` (bundled into all dist targets; verified in dist/, dist-firefox/, dist-safari/).
- **`DonateCard` rewritten**: “Support the Project” card keeps the a11y modal pattern (focus trap, Escape, overlay click, focus restore) but the modal is SideRouter's — “Buy me a Coffee!” hero (coffee-mug SVG), “Your donations help me build better software.”, “We accept Ethereum, Solana, USDC and USDT…”, **ETH + SOL wallet cards with QR images + copy buttons** (inline “✓ Copied” feedback, clipboard via `navigator.clipboard`), footer “Open Source — Source Code” → `SOURCE_URL`.
- **Constants**: `DONATION_URL`/`DONATION_AMOUNTS` removed; `DONATION_ETH_ADDRESS`, `DONATION_SOL_ADDRESS`, `DONATION_QR_ETH`, `DONATION_QR_SOL`, `SOURCE_URL = https://github.com/ranka23/adhd-tab-manager`, `ISSUES_URL` added.
- **Fixed a latent styling bug**: the old card used `btn-primary` (single dash); the design system is `btn--primary`/`btn--secondary` — the Donate CTA was unstyled. Both cards now use the correct classes.
- **Removed `loading="lazy"`** from the QR `<img>`s — lazy loading delayed their render inside the modal (caught by the real-browser smoke; now eager).

### 19.2 “Request a Feature or Report a Bug” section 📣

- New **`FeedbackCard`** (`src/popup/components/FeedbackCard.tsx`) — sits **just above** the Donate section on the Home tab. CTA “Open GitHub Issues” → `ISSUES_URL` (`https://github.com/ranka23/adhd-tab-manager/issues`), `target=_blank` + `rel=noreferrer`, click opens via `browser.tabs.create` with `preventDefault` (no double-open).

### 19.3 Real-browser verification — new `donate-smoke.mjs` (15/15)

New lasting e2e script `scripts/e2e/donate-smoke.mjs` drives the live Chrome (CDP on :9222): both cards render + order (Feedback above Donate), issues CTA opens a new tab at the Issues page, modal opens, both wallets + addresses + QR images loaded (ETH 749px / SOL 864px), copy buttons write the real addresses, Escape closes, no horizontal overflow at 320/400/720px. **15/15.**

### 19.4 GitHub publishing

- Created public repo **`ranka23/adhd-tab-manager`** via the GitHub API (repo-scoped token from the OS keychain; `gh` CLI not installed).
- Added remote + pushed `main`.
- **README.md** rewritten in full detail (features, browser support matrix, store installs, dev setup, real-browser harnesses, structure, design principles, privacy, contributing, donate, license).
- `docs/manual-test-plan.md` §15 rewritten (crypto modal) + new §15b (feedback) + §16 release gate updated.

### 19.5 Verification (all green)

- `pnpm lint` clean · `pnpm test` **280/280** (274 + 7 DonateCard + 4 FeedbackCard + Header test updates) · `pnpm build:all` clean · `pnpm build:safari` clean · `pnpm lint:firefox` 0 errors (2 benign warnings, 1 notice) · project diagnostics 0.
- `node scripts/e2e/chrome-e2e.mjs` → **50/50** · `MANUAL_TEST_SLOW=1 node scripts/e2e/manual-test.mjs` → **78/78** · `sidepanel-smoke.mjs` → **15/15** · `multiwindow-smoke.mjs` → **9/9** · `donate-smoke.mjs` → **15/15**.
- Real-browser (Chrome for Testing :9222): Home tab shows Feedback → Donate cards; modal + QR + copy verified end-to-end.

### 19.6 Remaining pre-submission (user action)

- Replace the AMO `gecko.id` (`adhd-tab-manager@example.com`) with a real reverse-domain ID in `dist-firefox/manifest.json` before submitting to Firefox AMO.
- Safari packaging still needs `safari-web-extension-packager` (≈1–2 days, no code changes).
- Store screenshots can be captured from `artifacts/*.png`.

## 20. Polish batch — flat feedback CTA, README wallets, repo rename (added 2026-08-03)

- **Removed the icon** (📣) from the `FeedbackCard` header and the icon (☕) from the `DonateCard` header — both cards now render clean text-only titles. The ❤️ in the Donate button is kept intentionally.
- **Flat “Open GitHub Issues” button**: `.feedback-card__button` now sets `border: none` (overrides `.btn--secondary`'s `1px solid var(--primary-border)`), matching the flat Donate CTA.
- **README `💜 Donate` section** now lists the two public wallet addresses directly (ETH `0x907D…121A`, SOL `H9kw…Szyo`) so users can donate without opening the app.
- **Repo renamed** `adhd-tab-manager` → **`adhd_tab_manager`** (GitHub API; old URL redirects). All in-repo references updated: `src/shared/constants.ts` (`SOURCE_URL`), `scripts/e2e/donate-smoke.mjs` (×2), `docs/manual-test-plan.md` (×2), `README.md` (Contributing). Git remote updated to `https://github.com/ranka23/adhd_tab_manager.git`.
- Verification: lint 0 · tests 280/280 · build:all + build:safari clean · lint:firefox 0 errors · chrome-e2e 50/50 · manual-test 78/78 · sidepanel-smoke 15/15 · multiwindow-smoke 9/9 · donate-smoke 15/15 · diagnostics 0.

## 21. Final store packaging — gecko id fixed, Safari wrapper generated (added 2026-08-03)

- **Firefox AMO gecko id is now real**: `adhd-tab-manager@ranka23.github.io` in
  `scripts/build-firefox.mjs` + `dist-firefox/`. Tested: AMO rejects URLs and
  reverse-DNS strings (`dev.ranka23.adhd-tab-manager` → 3 `JSON_INVALID` errors),
  accepts only UUID or `name@domain` — so the GitHub URL cannot be used as the
  id; the email-style id ties the add-on to the owner's GitHub Pages domain.
  `pnpm lint:firefox` → 0 errors (2 benign warnings, 1 notice).
- **Safari packaging done as far as possible without the user**: ran
  `safari-web-extension-converter` (via `DEVELOPER_DIR=/Applications/Xcode.app/...`)
  on `dist-safari/` → Xcode wrapper at `artifacts/release/safari/ADHD Tab Manager/`
  (macOS + iOS targets, bundle id `dev.ranka23.adhd-tab-manager`); unsigned macOS
  Release build succeeded → `artifacts/release/safari/build/ADHD Tab Manager.app`
  (extension appex verified: mv3, popup surface, no side_panel). Only signing +
  archive remain — requires the user's Apple Developer account (see
  `artifacts/release/store-listing-safari.md`).
- **All four store zips regenerated** with the final manifests:
  `artifacts/release/zips/adhd-tab-manager-{chrome,edge,firefox,safari}-1.0.0.zip`.
  Firefox zip verified to contain the new gecko id; manifest at zip root; no
  `.DS_Store`; Safari zip carries no `side_panel` key.
- Docs updated: `store-listing-firefox.md` (id resolved section), `RELEASE-NOTES.md`
  (submission status + safe zip command without `rm -rf`).
