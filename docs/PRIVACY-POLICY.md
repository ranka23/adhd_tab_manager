# Privacy Policy

**ADHD Tab Manager** — browser extension for Chrome, Edge, Firefox and Safari

**Effective date:** August 3, 2026

---

## The short version

**ADHD Tab Manager collects no personal data. It has no servers, no accounts,
no analytics, no advertising, and no tracking. Everything the extension does
happens locally on your device, and nothing ever leaves it.**

---

## 1. What data we collect

**None.** We do not collect, store, transmit, or share any personal
information, browsing history, or usage data — not even in aggregate.

Specifically, the extension does **not**:

- collect or transmit your browsing history or visited sites,
- send data to any remote server or third party,
- use analytics, crash reporters, or telemetry of any kind,
- create an account or require registration,
- show ads or use ad trackers,
- read, store, or transmit passwords, forms, or personal communications.

The focus-mode blocker intercepts distracting sites locally on your device; a
blocked site is redirected to a local interstitial page. No request or
information about the site is sent anywhere.

## 2. Local data stored on your device

All functionality is driven by data stored **only in your browser's local
extension storage** (`chrome.storage.local` on Chrome/Edge, and the equivalent
local storage on Firefox/Safari). This data stays on your device and includes:

| Data | Purpose |
|---|---|
| Saved tab sessions | So you can restore a named set of tabs later |
| Blocked-sites list + on/off state | To block distracting sites during Focus Mode |
| Focus mode state and saved-tab snapshot | To hide and restore tabs when focusing |
| Pomodoro timer state and settings | To keep your timer accurate in the background |
| Undo-close history (last 20 tabs) | To restore accidentally closed tabs |
| Theme preference (light/dark) | To remember your chosen theme |
| Daily stats (focus minutes, sessions saved, distractions blocked, streak) | To show your progress in the Home tab |

**Export / Import:** you can export your data to a JSON file at any time (Home
tab → Export) and import it back. Export files are stored wherever you choose;
the extension itself never transmits them.

**Deletion:** removing the extension from your browser deletes its local data.
You can also clear it at any time by opening the extension's service worker
console and running `chrome.storage.local.clear()`, or by deleting your local
data in your browser's extension settings. We have no copy of your data to
delete — we never see it.

## 3. Permissions and why we use them

| Permission | Why it is used (all actions are local to your browser) |
|---|---|
| `tabs` | To list your open tabs per window, save/restore tab sessions, close/restore tabs (incl. undo-close), and hide tabs during Focus Mode |
| `storage` | To save your sessions, blocker list, timer/focus state, theme and stats locally on your device |
| `alarms` | To keep the Pomodoro/focus countdown accurate in the background while the UI is closed |
| `notifications` | To show a local system notification when a timer phase completes |
| `sidePanel` | To open the extension in the browser side panel (the default surface) |

We request the minimum permissions required for these features, and none of
them are used to access or transmit your data.

## 4. Third-party services

None. The extension makes **no network requests** of any kind. Links you click
(e.g. to the project's GitHub page or issues) open in your browser like any
ordinary link — the extension does not follow them on your behalf.

**Donations:** the Donate section displays the project's public crypto wallet
addresses (Ethereum and Solana) and their QR codes, which are bundled as static
images inside the extension. The extension never handles funds, never signs
transactions, and never contacts a blockchain network. Any donation transaction
happens entirely in your own wallet software.

## 5. Children's privacy

Because the extension collects no data from anyone — including children under
13 (or under the applicable age in your region) — there is nothing to collect
or process. We do not knowingly solicit or gather data from children.

## 6. Data security

There is no data to secure on our side because there is no data on our side.
Your local data is protected by your browser's own extension-storage
mechanisms. We strongly recommend keeping your browser up to date.

## 7. Changes to this policy

If this policy ever changes, the updated version will be posted at this URL
with a new effective date. Since the extension collects no data, material
changes are unlikely; any update will reflect a change in the extension's
behavior only.

## 8. Contact

Questions about this policy or the extension can be raised publicly in the
project's issue tracker:

**https://github.com/ranka23/adhd_tab_manager/issues**

---

*This policy applies to ADHD Tab Manager on all supported browsers: Google
Chrome, Microsoft Edge, Mozilla Firefox and Apple Safari (when released).*
