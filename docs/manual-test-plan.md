# ADHD Tab Manager — Manual Test Plan

**Target builds:** `dist/` (Chromium MV3, service worker) and `dist-firefox/` (Firefox MV3, event page)
**Automated baseline:** `node scripts/e2e/chrome-e2e.mjs` → 32/32 checks (see `adhd-prod-todo.md` §9).
**This plan covers what a human must verify by hand** — the flows that need real tabs, real windows, real time, or a human eye.

> **Status (2026-08-01):** environment fully built and pre-verified — Chrome for Testing on `:9222` with `dist/` loaded (`scripts/e2e/start-test-env.mjs`, interactive smoke passes), Firefox 152 loads `dist-firefox/` and seeds storage, MCP servers configured in `.zed/mcp.json`, fixtures guarded by `tests/fixtures.test.ts`. Sections 1–11 items marked 🟢/🔴 that also appear in the e2e harness (32 checks) are already machine-verified; run the rest by hand.

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
| 4.4 | Blocked redirect | Add `youtube.com`, start focus, open `https://www.youtube.com` | Redirected to the interstitial (data: URL) with a message | 🔴 |
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
| 5.5 | Toggle blocker off | Toggle "Blocking" off | Blocked sites no longer redirect during focus | 🟢 |
| 5.6 | Persistence | Add site, close/reopen popup | Site still listed | 🔴 |
| 5.7 | Remove | Remove a site | Gone immediately; toast confirms | 🟢 |
| 5.8 | Long list | Add 8+ sites | List scrolls/collapses with "Show all" control | 📱 |
| 5.9 | Defaults on fresh profile | Fresh install | Default distraction list pre-seeded (e.g. reddit.com, youtube.com…) | 🟢 |

---

## 6. Sessions

| # | Test | Steps | Expected | Type |
|---|---|---|---|---|
| 6.1 | Save | Open 2–3 tabs → "Save session" | Session appears in list with name + icon | 🟢 |
| 6.2 | Suggestions | Focus the name field | Suggested names appear (e.g. "Work", "Study") | 🟢 |
| 6.3 | Icon picker | Save with different icons | Icon persists on the card | 🟢 |
| 6.4 | Empty disabled | No name entered | Save button disabled | ⚠️ |
| 6.5 | Restore | Close the 2–3 tabs, then "Restore" session | All tabs reopen | 🔴 |
| 6.6 | Restore pinned order | Session contains pinned tabs | Pinned restored pinned; order preserved | ⚠️ |
| 6.7 | Delete + undo | Delete a session | Card removed; toast "Undo" appears | 🔴 |
| 6.8 | Undo within 5s | Click "Undo" | Session comes back exactly as before | 🔴 |
| 6.9 | Undo after 5s | Wait >5s | Toast gone; session stays deleted | ⚠️ |
| 6.10 | Rename | Edit a session name | Persists after reopen | 🟢 |
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
| 9.3 | Modal focus trap | Tab inside modal | Focus stays within modal until dismissed | ⚠️ |
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

## 12. Firefox parity 🔴

Run the whole suite in Firefox (`about:debugging` → Load Temporary Add-on → `dist-firefox/manifest.json`).

| # | Test | Expected |
|---|---|---|
| 12.1 | Extension loads with no errors in Browser Console | Clean load |
| 12.2 | Popup renders (all 5 nav tabs) | Same as Chrome |
| 12.3 | Theme persists + no flash | Same as Chrome |
| 12.4 | Focus mode blocks sites | Redirect works |
| 12.5 | Pomodoro completes with popup closed | Notification + alarm works (event page, not SW) |
| 12.6 | Sessions save/restore/delete+undo | Same behavior as Chrome |
| 12.7 | Import/export | Same as Chrome |
| 12.8 | Responsive widths | No overflow |

---

## 13. Release gate checklist

Before tagging v1.0.0:

- [ ] `pnpm lint` → 0 problems
- [ ] `pnpm test` → all pass (238)
- [ ] `pnpm build:all` → clean
- [ ] `pnpm lint:firefox` → 0 errors
- [ ] `node scripts/e2e/chrome-e2e.mjs` → 32/32
- [ ] Sections 1–12 manually verified (at least 🔴 items)
- [ ] `git status` clean; version bumped; README updated
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
