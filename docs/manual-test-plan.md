# ADHD Tab Manager — Manual Test Plan

**Target builds:** `dist/` (Chromium MV3, service worker + side panel) and `dist-firefox/` (Firefox MV3, event page)
**Automated baseline:** `node scripts/e2e/chrome-e2e.mjs` → 49/49 checks (see `adhd-prod-todo.md` §9).
**This plan covers what a human must verify by hand** — the flows that need real tabs, real windows, real time, or a human eye.

> **Status (2026-08-03):** **FULLY VERIFIED — see `docs/manual-test-results.md` (77/77 executed PASS, 1 slow-skip, via `scripts/e2e/manual-test.mjs`, self-contained CfT on :9334; +60 s SW-tick check with `MANUAL_TEST_SLOW=1`).** The persistent interactive env (`start-test-env.mjs` on :9222, MCP servers in `.zed/mcp.json`) remains for human/MCP-driven sessions. Sections 1–12 are machine-verified; Section 13 (Firefox) and the toolbar/notification/file-picker items still need a human.

> Legend: 🟢 = happy path · ⚠️ = edge case · 🔴 = must-pass before release · 📱 = responsive/mobile check

---

## 0. Environment setup (one-time)

### Build
```sh
pnpm install
pnpm build:all          # dist/ (Chrome) + dist-firefox/ (Firefox)
```

### Chrome (real browser, interactive)
1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** → select `dist/`.
4. Pin the extension to the toolbar (puzzle icon → 📌).

> Branded Chrome ignores `--load-extension` (v137+). For automated runs use **Chrome for Testing**:
> `"/tmp/cft/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" --load-extension=dist --user-data-dir=<tmp>`.

### Firefox (real browser, interactive)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** → select `dist-firefox/manifest.json`.

### MCP-driven testing (Chrome DevTools MCP)
`.zed/mcp.json` configures `chrome-devtools-mcp`, which attaches to a Chrome instance
over CDP. Launch Chrome for Testing with the extension preloaded and a debug port:

```sh
node scripts/e2e/start-test-env.mjs   # launches CfT + extension on :9222, persists profile
```

Then ask the assistant (or drive manually) to open `chrome-extension://<id>/src/popup/index.html`.

### Test data
Reset the extension to a known state before a run: `chrome://extensions` → the extension →
**Service worker** console → `chrome.storage.local.clear()` (or `chrome.storage.local.set({...})`
to seed data).

Fixtures for import tests live in `scripts/e2e/test-fixtures/` (see §8).

---

## 1. Render & shell

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 1.1 | Header | Open popup | "ADHD Tabs" title, logo icon, theme toggle visible | 🟢 |
| 1.2 | Quote | Open popup | Daily quote renders (no flash/blank) | 🟢 |
| 1.3 | Nav tabs | Open popup | Exactly 5 tabs: Home, Focus, Sessions, Timer, Blocked Sites | 🟢 |
| 1.4 | First-load skeleton | Open popup on a cold profile | Skeleton loaders appear, then content | 🟢 |
| 1.5 | Console health | Open popup, DevTools → Console | No errors, no uncaught exceptions | 🟢 |
| 1.6 | Error boundary | Kill service worker (`chrome://extensions` → service worker → stop), open popup | Graceful error banner or recovery, not a white screen | ⚠️ |
| 1.7 | Rapid open/close | Open/close popup 10× fast | No crash, no duplicate toasts, no stuck state | ⚠️ |
| 1.8 | 🔴 Empty state | Fresh profile, no tabs/sessions | All views show friendly empty states (no raw "0"/"undefined") | 🔴 |
| 1.9 | Keyboard nav | Tab / Shift+Tab through popup | Focus ring visible on all interactive elements | ⚠️ |

---

## 2. Theme

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 2.1 | Toggle → dark | Click theme toggle | UI switches to dark instantly (no flash of light) | 🟢 |
| 2.2 | Toggle → light | Click again | Switches back | 🟢 |
| 2.3 | 🔴 Persistence | Set dark, close popup, reopen | Still dark | 🔴 |
| 2.4 | Pre-render flash | Set dark, reload popup | No light flash between load and paint | 🔴 |
| 2.5 | OS default | Clear `adhd_theme`, set OS to dark | Popup follows OS dark | 🟢 |
| 2.6 | 📱 Responsive in both | Repeat at 360px/480px | No overflow, readable contrast in both themes | 📱 |

---

## 3. Navigation

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 3.1 | Switch tabs | Click each of the 5 nav tabs | Corresponding panel renders; active tab highlighted | 🟢 |
| 3.2 | Focus forces Home | Start focus mode, navigate to Timer, then toggle focus | View switches to Home (focus active) | ⚠️ |
| 3.3 | State preserved | Switch away from Home and back | Open-tab list refreshed, not duplicated | 🟢 |

---

## 4. Focus mode

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 4.1 | Start | Have ≥3 tabs open → toggle focus ON | Focus view active; tabs hidden behind "focus" state | 🟢 |
| 4.2 | Snapshot | Check `chrome.storage.local.get('adhd_focus_saved_tabs')` | Saved tab IDs recorded | 🟢 |
| 4.3 | End → summary | Toggle OFF after ~1 min | Summary shows focus minutes > 0 | 🟢 |
| 4.4 | Blocked redirect | Add `youtube.com`, start focus, open `https://www.youtube.com` | Redirected to the interstitial extension page (`interstitial.html?blocked=…`) with a message | 🔴 |
| 4.5 | Counter | After 4.4, check stats | `adhd_distractions_blocked` incremented | 🟢 |
| 4.6 | www/subdomain/wildcard | Block `reddit.com`; test `www.reddit.com`, `old.reddit.com`, `reddit.com/r/x`, `evil-reddit.com` | First three blocked, last NOT blocked | 🔴 |
| 4.7 | Double-click race | Double-click the focus toggle rapidly | Only one toggle cycle (state ends consistent) | ⚠️ |
| 4.8 | Non-focus browsing | Without focus mode, open a blocked site | NOT redirected (blocker only active in focus) | 🟢 |
| 4.9 | Focus while popup closed | Start focus, close popup, browse to blocked site | Still blocked (service worker redirects) | 🔴 |
| 4.10 | End restores tabs | Start focus with 3 tabs, open 2 new tabs, end focus | Original 3 tabs restored/revealed | ⚠️ |

---

## 5. Distraction blocker (list management)

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 5.1 | Add valid | Type `instagram.com`, press Enter | Appears in list immediately | 🟢 |
| 5.2 | Add duplicate | Add `instagram.com` twice | Second add rejected or deduped with feedback | ⚠️ |
| 5.3 | Invalid input | Enter `ht tp://`, ``, `javascript:alert(1)`, `-bad-` | Inline error; nothing added | 🔴 |
| 5.4 | Normalization | Enter `HTTPS://Twitter.Com ` | Stored as `twitter.com` | 🟢 |
| 5.5 | Blocker off stops redirects | With focus active, ensure `adhd_blocked_sites_active` is `false` (the toggle itself is only reachable outside focus — the focus screen hides the nav) | No redirect — the SW guards on the blocker flag | 🟢 |
| 5.6 | Persistence | Add site, close/reopen popup | Site still listed | 🔴 |
| 5.7 | Remove | Remove a site | Gone immediately; toast confirms | 🟢 |
| 5.8 | Long list | Add 8+ sites | List scrolls/collapses with "Show all" control | 📱 |
| 5.9 | Defaults on fresh profile | Fresh install | Default distraction list pre-seeded (e.g. reddit.com, youtube.com…) | 🟢 |

---

## 6. Sessions

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 6.1 | Save | Open 2–3 tabs → "Save session" (single window: saves that window; 2+ windows: prompts which window(s) — see §12.4) | Session appears in list with name + icon | 🟢 |
| 6.2 | Suggestions | Focus the name field | Suggested names appear (e.g. "Work", "Study") | 🟢 |
| 6.3 | Icon picker | Save with different icons | Icon persists on the card | 🟢 |
| 6.4 | Empty disabled | No name entered | Save button disabled | ⚠️ |
| 6.5 | Restore | Close the 2–3 tabs, then "Restore" session | All tabs reopen | 🔴 |
| 6.6 | Restore pinned order | Session contains pinned tabs | Pinned restored pinned; order preserved | ⚠️ |
| 6.7 | Delete + undo | Delete a session | Card removed; toast "Undo" appears | 🔴 |
| 6.8 | Undo within 5s | Click "Undo" | Session comes back exactly as before | 🔴 |
| 6.9 | Undo after 5s | Wait >5s | Toast gone; session stays deleted | ⚠️ |
| 6.10 | Rename | ✏️ on a session card → inline input → Save | Persists after reopen | 🟢 |
| 6.11 | 🔴 50-session cap | Try to save #51 | Blocked with clear message; existing sessions intact | 🔴 |
| 6.12 | Save with zero tabs | "Save session" with no open tabs | Disabled or clear "no tabs" message | ⚠️ |

---

## 7. Undo close (tab history)

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 7.1 | Undo one | Close one tab (e.g. from Quick Actions or manual) → Undo | Tab restored at its original index | 🟢 |
| 7.2 | Undo many | Close 3 tabs → Undo | All 3 restored, order preserved | 🟢 |
| 7.3 | Index preservation | Close middle tab of 5 → Undo | Reopens in the middle, not the end | 🔴 |
| 7.4 | 20-entry cap | Close 25 tabs | Only last 20 restorable | ⚠️ |
| 7.5 | Undo after reopen | Close tab, close popup, reopen, undo | Still restorable | 🟢 |

---

## 8. Pomodoro timer

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 8.1 | Idle state | Open Timer view | Shows 25:00 (default), Start button | 🟢 |
| 8.2 | Start/pause/resume | Start → Pause → Resume | Time stops while paused, resumes from same value | 🟢 |
| 8.3 | Reset | Start, wait 10s, Reset | Back to 25:00, stopped | 🟢 |
| 8.4 | Skip | During work → Skip | Moves to short break | 🟢 |
| 8.5 | Work→break | Start work, wait for completion | Short break (5:00) auto-starts; chime + notification | 🔴 |
| 8.6 | Long break cycle | Complete 4 pomodoros | 4th → long break (15:00) | 🔴 |
| 8.7 | 🔴 Popup closed | Start timer, close popup, wait for completion | Notification fires; no double-decrement of the countdown | 🔴 |
| 8.8 | Settings validation | Set work minutes to 0, 121, `abc` | Rejected with inline errors (valid range 1–120) | ⚠️ |
| 8.9 | Break ranges | Short 1–30, Long 1–60 | Out-of-range rejected | ⚠️ |
| 8.10 | Streak | Complete 3 work sessions across days (fake dates via storage) | Streak counter increments; resets after a missed day | ⚠️ |
| 8.11 | Double-decrement race | With popup open, let a minute tick (or fake alarm) | Remaining time decreases by exactly 1 per minute | 🔴 |
| 8.12 | Notification permission | First completion | Permission requested once, remembered | 🟢 |

---

## 9. Quick actions

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 9.1 | Close all confirm | Click "Close all tabs" | Confirmation modal appears | 🟢 |
| 9.2 | Modal Esc | Press Escape in modal | Modal closes, nothing closed | 🟢 |
| 9.3 | Modal focus trap | Tab inside modal | Focus stays within modal until dismissed (implemented: Tab/Shift+Tab wrap) | ⚠️ |
| 9.4 | Confirm | Confirm close-all | All tabs close; undo available | 🔴 |
| 9.5 | Undo close-all | Click Undo | All tabs restored | 🔴 |

---

## 10. Export / Import

Fixtures in `scripts/e2e/test-fixtures/`:

| File | Purpose |
|---|---|
| `valid-backup.json` | Full round-trip export→import |
| `malformed-sessions.json` | Sessions with missing fields → must be rejected atomically |
| `hostile-file.json` | `__proto__`, `constructor` keys, huge nesting → rejected, no storage writes |
| `partial-backup.json` | Only `blockedSites` + `timerSettings` → accepted, merged |
| `non-object.json` | `[1,2,3]` / `"hello"` / `42` → rejected with clear message |

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 10.1 | Export | Export → file downloads with `adhd-tab-manager-backup-*.json` | File valid JSON | 🟢 |
| 10.2 | Round-trip | Export, wipe storage, import same file | Identical state restored | 🔴 |
| 10.3 | Partial import | Import `partial-backup.json` | Only supplied sections change; others untouched | 🟢 |
| 10.4 | Malformed | Import `malformed-sessions.json` | Error message; existing data unchanged (atomic) | 🔴 |
| 10.5 | Hostile | Import `hostile-file.json` | Rejected; no `__proto__` pollution; storage intact | 🔴 |
| 10.6 | Wrong type | Import `non-object.json` | Clear "not a valid backup" error | 🟢 |
| 10.7 | Cancel | Open file dialog, cancel | No change, no error | 🟢 |

---

## 11. Responsive & mobile 📱

| Width | Check |
|---|---|
| 360px (mobile) | No horizontal scrollbar; nav tabs fit; touch targets ≥ 40px |
| 400px (default popup) | No overflow; content comfortable |
| 480px | Header wraps gracefully; no clipped buttons |
| 800px (tab open) | Content centers/max-width; cards don't stretch awkwardly |

Also verify: zoom 200% still usable; keyboard-only navigation works; `prefers-reduced-motion` respected (animations reduced).

---

## 12. Multi-window & live data 🔴

**Live data:** the popup/side panel subscribe to the Chrome tab & window event streams (`tabs.onCreated/onRemoved/onUpdated/…`, `windows.onRemoved/onFocusChanged`) and to `storage.onChanged`, so every surface updates **automatically** — close a tab in the browser and the count drops, open a second window and the Tabs view splits into per-window sections, start a focus session in the side panel and the popup reflects it instantly. No manual refresh anywhere.

**Multi-window:** tabs are grouped by the window they belong to; **Save session prompts which window(s) to snapshot** (never silently merges every window); Close All / Close Window / close-tab actions are window-aware; undo-close restores into the original window.

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 12.1 | Live tab create | With popup open, open a new tab in the browser (Cmd+T → type URL) | Tabs view count + card appear without reopening the popup | 🔴 |
| 12.2 | Live tab close | Close that tab from the tab strip | Count drops back; card disappears | 🔴 |
| 12.3 | Live second window | Cmd+N to open a new window with a tab | Tabs view splits into “Window 1” / “Window 2” sections; current window marked with a dot | 🔴 |
| 12.4 | Save prompt | Open 2 windows → Sessions → Save Tabs | Dialog asks “Save tabs from which windows?” with a checkbox per window; current window pre-selected | 🔴 |
| 12.5 | Save one window only | Uncheck Window 1, keep Window 2, name + save | Saved session contains ONLY Window 2's tabs | 🔴 |
| 12.6 | Save multiple windows | Check Window 1 + Window 2 together | One session containing both windows' tabs (explicit selection only) | ⚠️ |
| 12.7 | Save disabled w/o selection | Uncheck all windows | Save button disabled | ⚠️ |
| 12.8 | Close Window | Tabs view → “✕ Close” on a window section | Confirm modal names that window; only its non-pinned tabs close; other window untouched | 🔴 |
| 12.9 | Close All breakdown | 2 windows open → Home → Close All (confirm) | Modal lists per-window counts; all non-pinned tabs across both windows close; undo restores them into their original windows | 🔴 |
| 12.10 | Undo-close window fidelity | Close a tab in window 2, undo | Tab reopens in window 2, not the current window | ⚠️ |
| 12.11 | Quick actions windows count | 2+ windows open, Home view | Info card shows “N windows” | 🟢 |
| 12.12 | Popup ↔ side panel sync | With both open, close a tab / save a session in one | The other surface updates instantly (storage + tab listeners) | 🔴 |
| 12.13 | Timer sync | Popup + side panel both open, start pomodoro | Timer decrements exactly 1/s total (popup owns the tick; panel mirrors — no double speed) | 🔴 |

---

## 13. Firefox parity 🔴

Run the whole suite in Firefox (`about:debugging` → Load Temporary Add-on → `dist-firefox/manifest.json`). Firefox has no Chromium side-panel API — the default surface is the **sidebar** (`sidebar_action` with `open_at_install: true`): clicking the toolbar button opens the sidebar, no floating popup.

| # | Test | Expected |
|---|---|---|
| 13.1 | Extension loads with no errors in Browser Console | Clean load (verified: `web-ext run` installs `dist-firefox` with no errors) |
| 13.2 | Sidebar renders the app (all 5 nav tabs) | Toolbar click opens the sidebar (same app as Chrome's side panel) |
| 13.3 | Theme persists + no flash | Same as Chrome |
| 13.4 | Focus mode blocks sites | Redirect works |
| 13.5 | Pomodoro completes with popup closed | Notification + alarm works (event page, not SW) |
| 13.6 | Sessions save/restore/delete+undo | Same behavior as Chrome |
| 13.7 | Import/export | Same as Chrome |
| 13.8 | Responsive widths | No overflow |
| 13.9 | No floating popup | Manifest has no `action.default_popup`; only `sidebar_action` |
| 13.10 | Multi-window grouping + save prompt | Same as Chrome (§12) |

---

## 14. Side panel — DEFAULT surface (Chrome / Edge) 🟢

Chrome 114+ (`sidePanel` permission, `side_panel.default_path`). The toolbar button opens the side panel directly: the service worker calls
`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` at startup, so **Chrome itself** opens the panel natively on a toolbar click (with a fallback `action.onClicked` → `chrome.sidePanel.open` for older versions). There is **no floating popup** and **no header toggle icon**. Safari keeps the classic popup (see `scripts/build-safari.mjs` / `dist-safari`).

> 💡 **Toolbar click does nothing?** This is almost always a stale unpacked extension — Chrome caches the old action config when the manifest changed. **Remove the extension from `chrome://extensions` and “Load unpacked” it again** (or use a fresh profile). Verify with the SW console: `chrome.action.getPopup({})` → `""` and `chrome.sidePanel.getPanelBehavior()` → `{ openPanelOnActionClick: true }`.

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 14.1 | Toolbar click opens panel | Click the toolbar icon | Side panel opens on the right — NOT a popup; no `default_popup` in `dist/manifest.json` | 🟢 |
| 14.2 | No header toggle | Open the panel | Header has exactly: Export, Import, dark-mode buttons (no side-panel toggle icon) | 🟢 |
| 14.3 | Panel renders app | Side panel open | Header, quote, all 5 nav tabs render; same theme as popup (no flash) | 🟢 |
| 14.4 | Full-height tab list | Open Tabs view with 8+ tabs | List fills the panel height; scrolls internally (`overflow-y: auto`); no x-overflow | 📱 |
| 14.5 | Persistence | Use the panel for a while, switch tabs, come back | Panel stays open and state persists | 🟢 |
| 14.6 | Timer while panel open | Start pomodoro in panel, leave panel open, wait a minute | Countdown decreases by exactly 1/min (SW skips its tick — `runtime.getContexts` sees SIDE_PANEL) | 🔴 |
| 14.7 | Focus mode from panel | Start focus in the panel | Blocker active; navigating to a blocked site redirects | 🟢 |
| 14.8 | Session restore from panel | Save session in popup, restore in panel (and vice-versa) | Works both ways (shared storage) | 🟢 |
| 14.9 | Resizable | Drag the panel wider/narrower | App fills the panel; no horizontal scrollbar; content centers at very wide widths (≥720px cap) | 📱 |
| 14.10 | Narrow panel (320px) | Shrink panel to ~320px | No overflow; compact header still fits | 📱 |
| 14.11 | Theme sync | Toggle theme in the panel, check popup (and vice-versa) | Both surfaces show the same theme instantly | 🟢 |
| 14.12 | Toolbar-click regression | Fresh profile → click the toolbar icon | Panel opens natively; `sidePanel.getPanelBehavior()` → `openPanelOnActionClick: true`; `action.getPopup({})` → `""` | 🔴 |

---

## 15. Donations (Home tab) 💜

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 15.1 | Card placement | Open Home tab | “Support the Project” card is the **last** section, after Quick Actions | 🟢 |
| 15.2 | Open modal | Click “Buy me a coffee” | Modal opens: title, message, 4 amount chips ($1/$3/$5/$10), Donate CTA, GitHub footer link | 🟢 |
| 15.3 | Amount select | Click a chip | Chip highlights; CTA label updates (e.g. “Donate $10”) | 🟢 |
| 15.4 | Donate action | Select $10 → Donate | A new tab opens with the donation URL (`DONATION_URL` from `src/shared/constants.ts`, `?amount=10` for Ko-fi/BMC); modal closes | 🔴 |
| 15.5 | Cancel / Escape | Open modal → Cancel (or Esc) | Modal closes; focus returns to the card button; nothing opens | 🟢 |
| 15.6 | Overlay click | Open modal → click the dark overlay | Modal closes; clicking INSIDE the dialog does NOT close it | ⚠️ |
| 15.7 | Focus trap | Tab through the modal | Focus stays inside the dialog until dismissed | ⚠️ |
| 15.8 | Open-source link | Open modal → “View source on GitHub” | Opens `SOURCE_URL` in a new tab (`target=_blank`, `rel=noreferrer`) | 🟢 |
| 15.9 | Responsive | Repeat at 320px/400px | Card + modal fit; no overflow | 📱 |

---

## 16. Release gate checklist

Before tagging v1.0.0:

- [x] `pnpm lint` → 0 problems
- [x] `pnpm test` → all pass (274)
- [x] `pnpm build:all` → clean (dist/ + dist-firefox/)
- [x] `pnpm build:safari` → clean (dist-safari/, popup surface, no side panel)
- [x] `pnpm lint:firefox` → 0 errors
- [x] `node scripts/e2e/chrome-e2e.mjs` → 50/50
- [x] `node scripts/e2e/manual-test.mjs` → 78/78 (incl. `MANUAL_TEST_SLOW=1`)
- [x] `node scripts/e2e/sidepanel-smoke.mjs` → 15/15
- [x] `node scripts/e2e/multiwindow-smoke.mjs` → 9/9
- [x] Sections 1–12 machine-verified (all 🔴 items green)
- [ ] Section 13 Firefox sidebar + §14 side-panel default + §15 donations — human pass required
- [ ] **Pre-submission:** set real `DONATION_URL` / `SOURCE_URL` (`src/shared/constants.ts`) and the real AMO `gecko.id` (`dist-firefox/manifest.json`)
- [x] `git status` clean; version bumped; README updated
- [ ] (Optional) Tag `v1.0.0`

---

## Appendix A — Storage keys cheat sheet (for seeding/inspecting)

| Key | Contents |
|---|---|
| `adhd_sessions` | Saved sessions array (max 50) |
| `adhd_blocked_sites` / `adhd_blocked_sites_active` | Block list + on/off |
| `adhd_focus_mode` / `adhd_focus_saved_tabs` | Focus state + snapshot |
| `adhd_active_timer` | Pomodoro state (phase, remainingSeconds, …) |
| `adhd_closed_tabs` | Undo-close history (max 20) |
| `adhd_theme` | `'light' \| 'dark'` |
| `adhd_popup_heartbeat` | ms timestamp; SW uses it to detect an open popup (Firefox) |
| `adhd_timer_settings` | work/short/long minutes + pomodoros-before-long |
| `adhd_distractions_blocked`, `adhd_focus_minutes_today`, `adhd_sessions_saved_today`, `adhd_pomodoro_streak` | Daily stats |

## Appendix B — Known benign findings (do not chase)

- web-ext lint: `UNSAFE_VAR_ASSIGNMENT` / `innerHTML` warnings = react-dom internals; `MISSING_DATA_COLLECTION_PERMISSIONS` = benign (we collect no data).
- `.eslintrc.cjs` "File ignored by default" warning = ESLint never lints its own config; benign.
