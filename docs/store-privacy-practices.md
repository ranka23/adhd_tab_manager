# ADHD Tab Manager — Chrome Web Store Privacy Practices (paste-ready)

Answers for the **Privacy practices** tab on the Chrome Web Store item edit
page (`chrome.google.com/webstore/devconsole/…/edit/privacy`). These match the
extension exactly — verified against `dist/manifest.json` (v1.0.0):

```json
"permissions": ["tabs", "storage", "alarms", "notifications", "sidePanel"]
```

No `host_permissions`, no `content_scripts`, no remote code, no servers, no
analytics, no third-party network calls. All code is bundled in the package;
all data lives in `chrome.storage.local` on the user's device.

---

## 1. Single purpose

> **ADHD Tab Manager helps users regain focus and control browser clutter by
> managing their own open tabs — listing tabs per window, saving/restoring tab
> sessions, blocking distracting sites during focus mode, and running a
> Pomodoro timer — entirely on the user's device, with no data collected or
> transmitted.**

(Also usable as the "single purpose" answer in the listing + the declaration
during review.)

---

## 2. Permission justifications (paste each into its field)

**alarms**
> The `alarms` permission powers the Pomodoro timer and focus-mode countdown
> in the background service worker. Alarms keep the countdown accurate and let
> a phase complete and fire its notification even when the extension's side
> panel or popup is closed. Only local scheduling; no data is accessed or
> transmitted.

**notifications**
> The `notifications` permission shows a single system notification when a
> Pomodoro work or break phase completes while the UI is closed, so the user
> knows to start the next phase. Notifications are generated locally and never
> include user data.

**remote code**
> The extension does not use remote code. All scripts are bundled in the
> package at build time (Vite), execute locally, and never load or evaluate
> content from the internet. There is no `eval`, no CDN, and no dynamic script
> loading.

**sidePanel**
> The side panel is the extension's default surface. The `sidePanel` permission
> lets the toolbar click open the persistent side panel instead of a floating
> popup, so the user can manage their tabs without losing their place. No data
> is collected or transmitted.

**storage**
> The `storage` permission saves the user's data locally in the browser
> (`chrome.storage.local`): saved tab sessions, the blocked-sites list, focus
> and timer state, theme preference, and daily usage stats. Nothing is
> uploaded — all data stays on the user's device and can be exported or
> cleared by the user at any time.

**tabs**
> The `tabs` permission reads the user's own open tab titles and URLs to
> render the live tab list grouped by window, save and restore tab sessions,
> close/restore tabs (including undo-close), and hide tabs during Focus Mode.
> It also opens links the user clicks (e.g. the GitHub issues page). Tab data
> is used only in the user's own browser to manage their own tabs and is never
> transmitted.

---

## 3. Data usage certification

**Does your product collect or transmit user data?**
> **No.** ADHD Tab Manager collects no user data. There are no servers, no
> accounts, no analytics, no advertising, and no third-party libraries that
> transmit data. Every feature operates entirely on the user's device using
> `chrome.storage.local`; the focus blocker intercepts sites locally; nothing
> ever leaves the device.

**Certification checkbox** (developer programme policies):
> ✅ Check "I certify that my data usage complies with the developer programme
> policies." — it does: no data is collected, so no policy on data handling is
> implicated.

---

## Why each permission exists (feature → permission map)

| Feature | Permission |
|---|---|
| Live per-window tab list, sessions save/restore, close/restore, undo-close, focus-mode tab hiding, opening GitHub links | `tabs` |
| Persisting sessions, blocker list, timer/focus state, theme, stats | `storage` |
| Pomodoro + focus countdown running in the background with the UI closed | `alarms` |
| System notification when a timer phase completes with the UI closed | `notifications` |
| Side panel as the default surface opened by the toolbar click | `sidePanel` |

**Privacy promise (from the README):** "ADHD Tab Manager collects no data.
Everything runs locally in your browser — no accounts, no analytics, no
tracking, no remote servers."

---

## 4. Privacy policy URL (required field on the CWS edit page)

Chrome requires a **privacy policy URL** in the listing. Use the committed,
rendered policy on GitHub (no extra hosting needed):

```
https://github.com/ranka23/adhd_tab_manager/blob/main/docs/PRIVACY-POLICY.md
```

The full policy lives at `docs/PRIVACY-POLICY.md` in the repository.
