/**
 * Capture store-listing screenshots of the extension in a real browser.
 *
 * Drives Chrome for Testing (the persistent env on :9222 via
 * start-test-env.mjs) with genuine CDP input events, seeds realistic state
 * (sessions, blocked sites, a running pomodoro), and captures every main
 * view at the sizes the app stores require:
 *
 *   - 640×400 (Chrome Web Store / Edge accepted size)
 *   - 1280×800 (Firefox AMO / Edge recommended, CWS accepted)
 *   - side panel at 400px (its native width) and 1280×800
 *
 * Output: artifacts/release/screenshots/*.png  (git-ignored artifacts dir)
 *
 * Usage: node scripts/e2e/capture-store-screenshots.mjs  (env must be running)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverExtensionId } from './discover-extension.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const distDir = join(root, 'dist');
const outDir = join(root, 'artifacts', 'release', 'screenshots');
const PORT = process.env.CDP_PORT ?? '9222';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error('CDP websocket failed to open'));
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(`${msg.error.code}: ${msg.error.message}`)) : p.resolve(msg.result);
      }
    };
  }
  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

const evalIn = async (cdp, sid, expression, userGesture = false) => {
  const res = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture }, sid);
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
  return res.result?.value;
};
const waitFor = async (cdp, sid, expression, label, timeoutMs = 12000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (await evalIn(cdp, sid, expression)) return true; } catch {}
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${label}`);
};

async function setViewport(cdp, sid, width, height, dpr = 2) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false }, sid);
}

async function capture(cdp, sid, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sid);
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`  📸 ${name}.png`);
}

async function openPage(cdp, EXT_ID, url, width, height) {
  const { targetId } = await cdp.send('Target.createTarget', { url });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  await setViewport(cdp, sessionId, width, height);
  return { targetId, sessionId };
}

/* ----------------------------- main ----------------------------- */
mkdirSync(outDir, { recursive: true });

const EXT_ID = await discoverExtensionId(Number(PORT), distDir);
if (!EXT_ID) {
  console.error('✗ Could not discover the extension id. Is the test env running?');
  process.exit(1);
}
console.log(`\n=== Store screenshots (extension ${EXT_ID}) ===\n`);

const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const cdp = new Cdp(version.webSocketDebuggerUrl);

/* Clean slate */
{
  const { targetInfos } = await cdp.send('Target.getTargets');
  for (const t of targetInfos.filter((x) => x.type === 'page' && x.url.startsWith('chrome-extension://'))) {
    await cdp.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
  }
  await sleep(500);
}

/* Seed realistic state: sessions, blocked sites, light theme, running timer. */
const EXT_POPUP = `chrome-extension://${EXT_ID}/src/popup/index.html`;
const EXT_PANEL = `chrome-extension://${EXT_ID}/src/sidepanel/index.html`;

/* Seed via an extension page context (popup) — the SW may be asleep. */
{
  const { targetId, sessionId } = await openPage(cdp, EXT_ID, EXT_POPUP, 400, 400);
  try {
    await waitFor(cdp, sessionId, `!!document.querySelector('.app-header')`, 'popup for seeding');
  } catch (err) {
    const dump = await cdp.send('Runtime.evaluate', { expression: `document.body ? document.body.innerText.slice(0, 300) : 'NO BODY (readyState=' + document.readyState + ')'`, returnByValue: true }, sessionId).catch(() => ({ result: { value: 'EVAL FAILED' } }));
    console.error('SEED-POPUP DUMP:', JSON.stringify(dump.result?.value));
    throw err;
  }
  const now = Date.now();
  const sessions = [
    {
      id: 'seed-1', name: 'Research', icon: '🔬', createdAt: now - 86400000, updatedAt: now - 3600000,
      tabs: [
        { id: 101, url: 'https://arxiv.org/list/cs.HC/recent', title: 'Human-Computer Interaction — arXiv', favIconUrl: '', active: false, pinned: false, windowId: 1 },
        { id: 102, url: 'https://en.wikipedia.org/wiki/Attention', title: 'Attention — Wikipedia', favIconUrl: '', active: false, pinned: false, windowId: 1 },
        { id: 103, url: 'https://pubmed.ncbi.nlm.nih.gov/?term=adhd+productivity', title: 'ADHD productivity — PubMed', favIconUrl: '', active: false, pinned: false, windowId: 1 },
      ],
    },
    {
      id: 'seed-2', name: 'Work', icon: '💼', createdAt: now - 172800000, updatedAt: now - 7200000,
      tabs: [
        { id: 201, url: 'https://mail.google.com/mail/u/0/#inbox', title: 'Inbox (12) — Gmail', favIconUrl: '', active: false, pinned: false, windowId: 1 },
        { id: 202, url: 'https://calendar.google.com/calendar/r', title: 'Calendar — Google', favIconUrl: '', active: false, pinned: false, windowId: 1 },
        { id: 203, url: 'https://github.com/ranka23/adhd_tab_manager', title: 'ranka23/adhd_tab_manager — GitHub', favIconUrl: '', active: false, pinned: false, windowId: 1 },
        { id: 204, url: 'https://docs.google.com/document/d/example', title: 'Release notes — Google Docs', favIconUrl: '', active: false, pinned: false, windowId: 1 },
      ],
    },
    {
      id: 'seed-3', name: 'Study', icon: '📚', createdAt: now - 259200000, updatedAt: now - 86400000,
      tabs: [
        { id: 301, url: 'https://www.duolingo.com/learn', title: 'Learn — Duolingo', favIconUrl: '', active: false, pinned: false, windowId: 1 },
        { id: 302, url: 'https://quizlet.com/latest', title: 'Flashcards — Quizlet', favIconUrl: '', active: false, pinned: false, windowId: 1 },
      ],
    },
  ];
  const seedPayload = {
    adhd_sessions: sessions,
    adhd_blocked_sites: ['reddit.com', 'youtube.com', 'instagram.com', 'x.com', 'tiktok.com', 'facebook.com', 'netflix.com', 'twitch.tv'],
    adhd_blocked_sites_active: true,
    adhd_theme: 'light',
    adhd_active_timer: { phase: 'work', isRunning: true, remainingSeconds: 1483, totalSeconds: 1500, completedInCycle: 2 },
  };
  await evalIn(cdp, sessionId, `chrome.storage.local.set(${JSON.stringify(seedPayload)}).then(() => 'seeded')`);
  await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  await sleep(400);
  console.log('ℹ️  storage seeded (3 sessions, 8 blocked sites, light theme, running timer)');
}

const shot = async (label, pageUrl, width, height, prep) => {
  const { targetId, sessionId } = await openPage(cdp, EXT_ID, pageUrl, width, height);
  try {
    await waitFor(cdp, sessionId, `!!document.querySelector('.app-header')`, `${label} render`);
    if (prep) {
      await prep(cdp, sessionId);
      await sleep(400);
    }
    await capture(cdp, sessionId, label);
  } finally {
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  }
};

/* 1. Home — light (640×400 + 1280×800) */
await shot('home-light-640x400', EXT_POPUP, 640, 400);
await shot('home-light-1280x800', EXT_POPUP, 1280, 800);

/* 2. Home — dark (640×400) */
await shot('home-dark-640x400', EXT_POPUP, 640, 400, async (cdp, sid) => {
  await evalIn(cdp, sid, `[...document.querySelectorAll('.theme-toggle')].find(b => (b.getAttribute('aria-label')||'').includes('Switch to dark mode'))?.click(); true`, true);
  await waitFor(cdp, sid, `document.documentElement.dataset.theme === 'dark'`, 'dark theme');
});

/* 3. Tabs view — multi-window (640×400 + 1280×800) */
await shot('tabs-multiwindow-640x400', EXT_POPUP, 640, 400, async (cdp, sid) => {
  await evalIn(cdp, sid, `document.querySelector('#tab-tabs')?.click(); true`, true);
  await waitFor(cdp, sid, `!!document.querySelector('.tab-group')`, 'tabs view');
});
await shot('tabs-multiwindow-1280x800', EXT_POPUP, 1280, 800, async (cdp, sid) => {
  await evalIn(cdp, sid, `document.querySelector('#tab-tabs')?.click(); true`, true);
  await waitFor(cdp, sid, `!!document.querySelector('.tab-group')`, 'tabs view');
});

/* 4. Sessions view (640×400) */
await shot('sessions-640x400', EXT_POPUP, 640, 400, async (cdp, sid) => {
  await evalIn(cdp, sid, `document.querySelector('#tab-sessions')?.click(); true`, true);
  await waitFor(cdp, sid, `document.querySelectorAll('.session-card').length >= 3`, 'sessions list');
});

/* 5. Timer view — running (640×400) */
await shot('timer-running-640x400', EXT_POPUP, 640, 400, async (cdp, sid) => {
  await evalIn(cdp, sid, `document.querySelector('#tab-timer')?.click(); true`, true);
  await waitFor(cdp, sid, `document.body.textContent.includes('24:') || document.body.textContent.includes('23:') || document.body.textContent.includes('22:')`, 'running timer');
});

/* 6. Block view (640×400) */
await shot('blocked-sites-640x400', EXT_POPUP, 640, 400, async (cdp, sid) => {
  await evalIn(cdp, sid, `document.querySelector('#tab-block')?.click(); true`, true);
  await waitFor(cdp, sid, `document.querySelectorAll('.blocked-site').length >= 3`, 'blocked list');
});

/* 7. Side panel (400×700 native + 1280×800) */
await shot('sidepanel-400x700', EXT_PANEL, 400, 700);
await shot('sidepanel-1280x800', EXT_PANEL, 1280, 800);

cdp.close();
console.log(`\n✅ Screenshots → ${outDir}\n`);
