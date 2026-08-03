# ADHD Tab Manager — Store Listing (canonical, committed)

The single source of truth for store submission copy. CI (`release.yml`) uses the
machine-readable `docs/store-listing.json`; this file is the human-readable
version with exact screenshot mapping.

> **Canonical copy.** The local release package under `artifacts/release/` is
> git-ignored; when it drifts, this file wins.

**Name:** `ADHD Tab Manager`

**Short description (≤ 132 chars, Chrome/Edge):**
```
Declutter your browser and stay focused. Save sessions, block distractions,
and track focus with a Pomodoro timer.
```
(96 chars)

**Firefox summary (≤ 250 chars):**
```
A tab manager designed for ADHD brains — save and restore tab sessions,
block distracting sites during focus mode, and track focus with a Pomodoro
timer. Works in the side panel on Chrome, Edge and Firefox.
```

**Keywords (Chrome/Edge):** `adhd, focus, pomodoro, tab manager, productivity, distraction blocker, sessions`

## Full description (long — Chrome Web Store / Edge)

> Markdown is supported on Chrome and Edge; AMO uses plain text (the
> plain-text version is in `docs/store-listing.json` → `description`).

**ADHD Tab Manager** is a tab manager designed for ADHD brains — minimal
clutter, one action at a time, and dopamine-friendly feedback. It opens in the
**browser side panel** (Chrome, Edge and Firefox), so your tabs stay
reachable without losing your place. On Safari it runs as a classic popup.

### 🧠 Home
- Live list of every open tab, **grouped by window** — see exactly what's
  open in Window 1, Window 2, and beyond, each with its own tab count.
- Close a single window or all windows with one click (pinned tabs are kept).
- Undo-close restores closed tabs at their **original index**, up to 20 deep.
- A daily **Tao Te Ching** quote — Chapter and verse included.

### 🎯 Focus Mode
- One click hides every open tab behind a calm focus screen.
- **Block distracting sites** (YouTube, Reddit, Instagram…) while focus is on;
  blocked sites redirect to a local interstitial — no remote calls.
- Wildcard-friendly blocking: block `reddit.com` and `old.reddit.com`,
  `www.reddit.com` and `reddit.com/r/anything` are all covered, while
  `evil-reddit.com` is not.
- End focus and get a summary of minutes focused and distractions blocked.

### 💾 Sessions
- Save the tabs of **one window, a chosen set of windows, or all windows**
  as a named session with an icon.
- Restore sessions instantly — pinned tabs come back pinned, in order.
- 50-session cap with a clear message; delete with **undo** (5-second window).

### ⏱️ Pomodoro Timer
- 25/5/15 classic pomodoro with skip, reset, pause/resume.
- Works with the popup/panel **closed** — the background worker drives it and
  fires a notification when a session completes.
- Custom work (1–120 min), short (1–30) and long (1–60) break ranges.
- Daily streak counter that rewards consistency.

### 🧹 Quick Actions
- "Close all tabs" with a confirmation modal, focus trap and Escape to cancel.
- Every close is undoable.

### 🔁 Export / Import
- One-click JSON backup (sessions, blocked sites, timer settings).
- Import validates aggressively — malformed, hostile or non-object files are
  rejected atomically; your data is never touched by a bad file.

### 🎨 Design
- Clean, rounded, ADHD-friendly UI with light and dark themes (system-aware,
  zero flash), keyboard navigation, and full responsive support from 360px
  mobile widths to wide desktop panels.

### 💜 Open Source & Donations
- 100% free and open source (MIT) — the code lives on GitHub.
- Donate with crypto (ETH/USDC/USDT + SOL) via the in-app Donate card.
- Request a feature or report a bug straight from the Home tab.

**Privacy:** ADHD Tab Manager collects **no data**. Everything runs locally in
your browser — no accounts, no analytics, no tracking, no remote servers.
The focus blocker intercepts sites locally; nothing ever leaves your device.

**Privacy policy URL (Chrome/Edge submission):**
`https://github.com/ranka23/adhd_tab_manager/blob/main/docs/PRIVACY-POLICY.md`
(full policy committed at `docs/PRIVACY-POLICY.md`; for Firefox/AMO, add the
same URL to the add-on's Privacy Policy field on the AMO edit page).

## 🖼️ Screenshot mapping (upload in this order)

Screenshots live in `docs/screenshots/` (committed so CI releases can attach them).

| # | File | Caption (Chrome/Edge) | AMO caption |
|---|---|---|---|
| 1 | `docs/screenshots/home-light-1280x800.png` | Home — live tabs, multi-window view, daily quote | Home tab with multi-window tab list |
| 2 | `docs/screenshots/home-dark-640x400.png` | Dark theme — the same Home tab at night | Dark theme |
| 3 | `docs/screenshots/tabs-multiwindow-1280x800.png` | Tabs grouped by window | Open tabs grouped by window |
| 4 | `docs/screenshots/sessions-640x400.png` | Saved sessions with icons | Saved sessions |
| 5 | `docs/screenshots/timer-running-640x400.png` | Pomodoro timer running | Pomodoro timer running |
| 6 | `docs/screenshots/blocked-sites-640x400.png` | Distraction blocker list | Distraction blocker |
| 7 | `docs/screenshots/sidepanel-1280x800.png` | The side panel — default surface on Chrome/Edge/Firefox | Side panel view |
| 8 | `docs/screenshots/sidepanel-400x700.png` | Side panel portrait | — |

Promo tiles (Chrome Web Store): `docs/screenshots/promo-small-440x280.png`
(required), `docs/screenshots/promo-marquee-920x680.png`,
`docs/screenshots/promo-1400x560.png` (optional).

Store icon: `public/icons/icon128.png` (128×128, also inside every zip).
