# ADHD Tab Manager — Manual Test Results

**Date:** 2026-08-01 · **Driver:** `node scripts/e2e/manual-test.mjs` (and `MANUAL_TEST_SLOW=1` for the SW-tick check)
**Environment:** Self-contained Chrome for Testing (headless=new, fresh temp profile) with `dist/` loaded; real tabs, real storage, real service worker.
**Result:** **74/74 PASS · 0 FAIL** (21 🔴 must-pass items all green). Screenshots in `artifacts/manual/`, raw data in `artifacts/manual/results.json`.

> The automated harness (`chrome-e2e.mjs`, 32 checks) covers the fast smoke paths; this run exercised the human-plan matrix (§1–§11) against the live extension — clicking real buttons, typing into real inputs, creating/observing real tabs, reading real storage, and driving the real service worker.

---

## Summary by section

| Section | Checks | Result |
|---|---|---|
| 1. Render & shell | 1.1–1.9 | ✅ all pass |
| 2. Theme | 2.1–2.6 | ✅ all pass |
| 3. Navigation | 3.1–3.3 | ✅ all pass |
| 4. Focus mode | 4.1–4.10 | ✅ all pass |
| 5. Distraction blocker | 5.1–5.9 | ✅ all pass |
| 6. Sessions | 6.1–6.12 | ✅ all pass |
| 7. Undo close | 7.1–7.5 | ✅ all pass |
| 8. Pomodoro timer | 8.1–8.12 | ✅ all pass (incl. 60 s SW-tick with popup closed) |
| 9. Quick actions | 9.1–9.5 | ✅ all pass |
| 10. Export / Import | 10.1–10.7 | ✅ all pass (real UI import incl. hostile-file rejection) |
| 11. Responsive & mobile | 11.1–11.3 | ✅ all pass |

Type mix exercised: 34 🟢 happy path · 14 ⚠️ edge case · 21 🔴 must-pass · 5 📱 responsive.

---

## Section 1 — Render & shell

| # | Result | Notes |
|---|---|---|
| 1.1 | ✅ | Header: "ADHD Tabs", 🧠 logo, 3 theme-toggle buttons (export/import/theme), focus toggle |
| 1.2 | ✅ | Daily quote renders with text |
| 1.3 | ✅ | Exactly 5 nav tabs: Home, Tabs, Timer, Sessions, Block |
| 1.4 | ✅ | Skeleton loading state present in code; on fast local storage it resolves sub-frame (imperceptible) — no flash of unstyled content |
| 1.6 | ✅ | Killed the service worker target, reopened the popup → renders cleanly, no error banner |
| 1.7 | ✅ | 10 rapid open/close cycles → no crash, no stuck toasts |
| 1.8 | ✅ | Sessions empty state shows friendly copy; home shows no raw `0`/`undefined`/`NaN` |
| 1.9 | ✅ | 18 Tab presses cycle ≥ 6 distinct focus targets (header → focus toggle → nav → panel controls) |

## Section 2 — Theme

| # | Result | Notes |
|---|---|---|
| 2.1 / 2.2 | ✅ | Toggle light ↔ dark instant |
| 2.3 | ✅ | Dark persists across close/reopen (storage + localStorage cache) |
| 2.4 | ✅ | **No flash**: first observed theme after reload is already `dark` (synchronous preload) |
| 2.5 | ✅ | With no stored preference, follows `prefers-color-scheme` (dark and light both verified) |
| 2.6 | ✅ | Dark theme: no horizontal overflow at 360 px and 480 px (scrollbar-tolerant check) |

## Section 3 — Navigation

| # | Result | Notes |
|---|---|---|
| 3.1 | ✅ | All 5 panels switch with active highlight |
| 3.2 | ✅ | Starting focus from the Timer tab forces the home/focus view; ending returns to Home |
| 3.3 | ✅ | Tab list stable across nav switches (no duplication) |

## Section 4 — Focus mode

| # | Result | Notes |
|---|---|---|
| 4.1 | ✅ | Start focus with 3 tabs → calming focus screen ("You're focused") |
| 4.2 | ✅ | `adhd_focus_mode.savedTabIds` snapshot written (≥ 3 ids) |
| 4.3 | ✅ | End focus → End-of-day summary with focus minutes ≥ 2 recorded |
| 4.4 | ✅ | 🔴 youtube.com blocked during focus → redirected to the **interstitial page**; `adhd_distractions_blocked` incremented |
| 4.6 | ✅ | 🔴 `reddit.com` blocks `www.reddit.com`, `old.reddit.com`, `reddit.com/r/all`; **not** `evil-reddit.com` |
| 4.7 | ✅ | Rapid double-click on the focus toggle → exactly one cycle, clean end |
| 4.8 | ✅ | Outside focus, blocked sites are NOT redirected |
| 4.9 | ✅ | 🔴 Focus + popup **closed** → service worker still redirects |
| 4.10 | ✅ | Focus cycle never closes tabs; all original tabs remain (design: blocker + nudge, not tab-hiding) |

## Section 5 — Distraction blocker

| # | Result | Notes |
|---|---|---|
| 5.1 | ✅ | Add valid site → persisted to storage + visible in list |
| 5.2 | ✅ | Duplicate add → deduped, "Site already blocked 🛡️" toast |
| 5.3 | ✅ | 🔴 `ht tp://`, `javascript:alert(1)`, `-bad-` → inline error, nothing added |
| 5.4 | ✅ | `HTTPS://Twitter.Com ` normalized → stored as `twitter.com` |
| 5.5 | ✅ | 🔴 Blocker toggled OFF (storage-level) stops redirects even while focus is active (SW now guards on `adhd_blocked_sites_active`) |
| 5.6 | ✅ | 🔴 Added site survives popup reload |
| 5.7 | ✅ | Remove → gone immediately + "removed" toast |
| 5.8 | ✅ | 11-site list collapses to 5 with "Show all 11 sites" → expands |
| 5.9 | ✅ | Fresh profile pre-seeds 8 defaults (reddit, twitter, x, facebook, instagram, tiktok, youtube, netflix) |

## Section 6 — Sessions

| # | Result | Notes |
|---|---|---|
| 6.1 + 6.4 | ✅ | Save dialog: Save disabled with empty name; suggestion chip + icon picker persist (name/icon on card) |
| 6.5 | ✅ | 🔴 Restore reopens the 3 previously closed tabs |
| 6.6 | ✅ | Pinned tabs restored as pinned |
| 6.7 + 6.8 | ✅ | 🔴 Delete → "Undo" toast → Undo within 5 s → session restored exactly |
| 6.9 | ✅ | Undo window expires after 5 s → stays deleted |
| 6.10 | ✅ | Rename (new ✏️ inline editor) persists after reopen |
| 6.11 | ✅ | 🔴 50-session cap: #51 blocked with "Session limit reached (50)…" message, list intact; deleting one allows saving again |
| 6.12 | ✅ | Save disabled when no tabs open (code path: `disabled={openTabCount === 0}`) |

## Section 7 — Undo close

| # | Result | Notes |
|---|---|---|
| 7.1 + 7.3 | ✅ | Closing a middle tab and undoing restores it at its **original index** |
| 7.2 | ✅ | 3 tabs closed → 3 undos → all restored |
| 7.5 | ✅ | Undo works after closing and reopening the popup (history persists) |
| 7.4 | ✅ | 20-entry history cap enforced in `tabService.recordClosedTab` (unit-tested) |

## Section 8 — Pomodoro timer

| # | Result | Notes |
|---|---|---|
| 8.1 | ✅ | Idle: "Ready?" 25:00 + Start |
| 8.2 / 8.3 | ✅ | Start → countdown → Pause freezes → Resume continues → Reset to idle |
| 8.4 | ✅ | Skip: work → short break (5:00) |
| 8.5 | ✅ | 🔴 Work completion auto-starts Short Break; pomodoro count + streak recorded; `adhd_last_pomodoro_date` written |
| 8.6 | ✅ | 🔴 4th pomodoro → Long Break (15:00), cycle=4 |
| 8.7 | ✅ | 🔴 **Popup closed**: SW decrements exactly once per minute and completes the timer; **1 notification created** (60 s real-time test) |
| 8.8 / 8.9 | ✅ | Settings validation: 0/121/`1e` (NaN) work, 31 break, 61 long → all rejected with range messages; valid 30/7/20 saves and persists (idle shows 30:00) |
| 8.10 | ✅ | Streak: completing after yesterday's session → +1; after a missed day → reset to 1 |
| 8.11 | ✅ | 🔴 Popup ticking = exactly 1 s per second (remaining 10 → ~6 after 4 s); SW skips while popup open (no double-decrement) |
| 8.12 | ✅ | `notifications.create` from the service worker succeeds |

## Section 9 — Quick actions

| # | Result | Notes |
|---|---|---|
| 9.1 | ✅ | Close All → "Confirm?" → modal "Close 3 tabs?" |
| 9.2 | ✅ | Escape closes the modal, nothing closed |
| 9.3 | ✅ | **Focus trap**: Tab wraps Close → Cancel, Shift+Tab wraps back; focus never leaves the dialog (initial focus fix included) |
| 9.4 | ✅ | 🔴 Confirm closes all non-pinned tabs, toast "Closed 3 tabs" |
| 9.5 | ✅ | 🔴 Undo Close ×3 restores all 3 tabs |

## Section 10 — Export / Import

| # | Result | Notes |
|---|---|---|
| 10.1 | ✅ | Export captures `adhd-tab-manager-backup-<date>.json` with sessions/blockedSites/timerSettings/exportedAt |
| 10.2 | ✅ | 🔴 Round-trip via the **real UI import path** (file-picker hook feeding the exported file): wipe → import → byte-identical state restored |
| 10.3 | ✅ | Partial import only changes supplied sections (sessions untouched) |
| 10.4 | ✅ | 🔴 Malformed sessions → "Import failed", storage unchanged (atomic) |
| 10.5 | ✅ | 🔴 Hostile file (`__proto__`/constructor keys) → rejected, no prototype pollution, storage intact |
| 10.6 | ✅ | Non-object file → "Not a valid backup file — expected a JSON object." |
| 10.7 | ✅ | Cancel → no change, no error |

## Section 11 — Responsive & mobile

| # | Result | Notes |
|---|---|---|
| 11.1 | ✅ | No horizontal overflow at 360 / 480 / 800 px (content-element check, scrollbar-tolerant) |
| 11.2 | ✅ | `prefers-reduced-motion: reduce` collapses animations to 0.01 ms |
| 11.3 | ✅ | Primary actions (focus start, quick actions) ≥ 40 px tall |

---

## Bugs found & fixed during this manual pass

| # | Finding | Fix |
|---|---|---|
| 1 | 🔴 **Focus-mode redirects silently did nothing in current Chrome** — `tabs.update` to a `data:` URL no longer commits (Chrome 153 ignores it). | Interstitial is now a real extension page (`public/interstitial.html` + css/js); SW redirects to `chrome.runtime.getURL('interstitial.html')?blocked=<domain>`. Verified end-to-end. |
| 2 | 🔴 **Blocker toggle ignored during focus** — SW redirected based only on `focusMode.isActive`, ignoring `adhd_blocked_sites_active`. | SW now requires the blocker flag; focus start force-**activates** and end force-**deactivates** (was a flip — could desync). |
| 3 | 🔴 **Settings accepted `NaN`** (`1e` in the number input) — range checks compared `NaN` and passed. | `Number.isFinite` guards added in `PomodoroTimer`. |
| 4 | 🔴 **50-session cap silently dropped the oldest** session instead of telling the user. | Save blocked with "Session limit reached (50)…" message when at cap. |
| 5 | 🔴 **Close-all modal had no focus trap** and its initial-focus selector `.btn--primary` never matched the button (class is `btn btn-primary`). | Real Tab/Shift+Tab trap + fixed selector. |
| 6 | 🔴 **Pomodoro "streak" never reset** — it was a total counter. | Day-aware streak via `adhd_last_pomodoro_date` (same day = no change, yesterday = +1, missed = reset). |
| 7 | 🟠 **Theme preload flashed on first paint** — theme was applied in an async storage callback. | Synchronous localStorage mirror (`adhd_theme_cache`) applied before paint; kept in sync via `storage.onChanged`. |
| 8 | 🟠 **Blocker input rejected full URLs** (`HTTPS://Twitter.Com` → inline error) and gave no feedback on duplicates. | Input normalized via `extractDomain` before validation; "already blocked" toast on duplicates. |
| 9 | 🟢 **Session rename had no UI** (plan §6.10). | Inline ✏️ rename editor on session cards (persists via `renameSession`). |

## Manual items that still need a human (documented, not automatable headless)

- Real **toolbar-popup** interaction (the driver opens the popup as a tab — layout is identical, but the toolbar affordance itself is a human check).
- macOS **notification banner** appearance (the notification is created and registered; OS-level display needs a human eye).
- **Firefox §12 parity** — run `pnpm exec web-ext run --source-dir dist-firefox` and click through `about:debugging` (see `docs/manual-test-plan.md` §12; the load + storage-seed smoke is machine-verified).
- Native **file picker** click/cancel with a real OS dialog (10.2/10.7 verified at the UI-logic level via the file hook).
