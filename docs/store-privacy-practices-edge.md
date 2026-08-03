# ADHD Tab Manager — Edge Add-ons Privacy Justifications (paste-ready)

Answers for the **Microsoft Edge Add-ons** submission form (permission
justifications, limit 1000 characters each). These match the extension exactly
— verified against `dist/manifest.json` (v1.0.0):

```json
"permissions": ["tabs", "storage", "alarms", "notifications", "sidePanel"]
```

No `host_permissions`, no `content_scripts`, no remote code, no servers, no
analytics, no third-party network calls. All code is bundled in the package;
all data lives in the browser's local extension storage on the user's device.

---

## tabs (≤ 1000 chars)

> The tabs permission powers the core tab-management features of ADHD Tab
> Manager entirely on the user's device. It reads the titles and URLs of the
> user's own open tabs to render the live tab list grouped by window on the
> Home screen, save and restore tab sessions, close tabs (including
> undo-close, which reopens a closed tab at its original position), and hide
> tabs behind a focus screen during Focus Mode. It is also used to open links
> the user deliberately clicks, such as the project's GitHub page or Issues
> tracker. Tab data is read and used only inside the user's own browser to
> manage their own tabs; it is never transmitted anywhere, never stored beyond
> the local extension storage the user controls, and never used for any other
> purpose.

## storage (≤ 1000 chars)

> The storage permission saves the user's settings and data locally in the
> browser's own extension storage (chrome.storage.local): saved tab sessions,
> the blocked-sites list and its on/off state, focus-mode state and tab
> snapshots, Pomodoro timer state and settings, the light/dark theme
> preference, and daily usage statistics. Everything is stored only on the
> user's device. Nothing is uploaded to any server, and the user can export
> their data to a JSON file, clear it, or delete the extension at any time. No
> personal or browsing data is collected, shared, or transmitted.

## alarms (≤ 1000 chars)

> The alarms permission keeps the Pomodoro timer and Focus Mode countdown
> accurate in the background. Browser service workers shut down when inactive,
> so the extension uses a repeating alarm to wake the background worker and
> tick the countdown once per minute. This lets a work or break phase complete
> and trigger its local notification even when the side panel or popup is
> closed. Alarms are scheduled and processed entirely on the user's device;
> they carry no data and nothing is transmitted.

## notifications (≤ 1000 chars)

> The notifications permission displays a single system notification when a
> Pomodoro work or break phase finishes while the side panel or popup is
> closed, so the user knows it is time to start the next phase or take a
> break. Notifications are generated locally on the user's device, contain
> only a short phase name and duration message, never include user data, and
> are not used for marketing or any other purpose.

## sidePanel (≤ 1000 chars)

> The side panel is the extension's default surface in Edge. The sidePanel
> permission lets the extension register a dedicated side panel page and open
> it from the toolbar icon, so the user can see and manage their tabs without
> losing their place in the current page. This is purely a UI-surface
> permission: the side panel renders the same local, on-device content as the
> popup, and no data is collected or transmitted.

---

## Single purpose (if asked in the Edge form)

> ADHD Tab Manager helps users regain focus and control browser clutter by
> managing their own open tabs — listing tabs per window, saving and restoring
> tab sessions, blocking distracting sites during focus mode, and running a
> Pomodoro timer — entirely on the user's device, with no data collected or
> transmitted.

## Privacy policy URL (required)

`https://github.com/ranka23/adhd_tab_manager/blob/main/docs/PRIVACY-POLICY.md`
