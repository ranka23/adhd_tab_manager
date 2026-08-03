/**
 * Real-browser manual smoke for the Chrome side panel, driven against the
 * persistent test environment (start-test-env.mjs on :9222).
 *
 * Uses genuine CDP input events (Input.dispatchMouseEvent) for the side-panel
 * toggle click — `chrome.sidePanel.open()` requires a real user gesture, so a
 * scripted `el.click()` would be rejected.
 *
 * Verifies:
 *   - the toggle icon renders after the light/dark toggle, before Focus
 *   - a real click opens the panel (storage flag flips, panel page mounts)
 *   - the panel renders the full app (header, 5 nav tabs, fluid layout)
 *   - the panel writes the popup heartbeat (SW double-decrement guard)
 *   - the popup header icon tracks the panel's open/closed state
 *   - theme changes in the panel propagate to the popup (no visual desync)
 *   - responsive widths in the panel (320 / 400 / 720 px) have no overflow
 *   - screenshots into artifacts/ for visual review
 *
 * Usage: node scripts/e2e/sidepanel-smoke.mjs   (env must be running)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverExtensionId } from './discover-extension.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const distDir = join(root, 'dist');
const artifactsDir = join(root, 'artifacts');
const PORT = process.env.CDP_PORT ?? '9222';

const results = [];
const pass = (name) => { results.push({ name, ok: true }); console.log(`  ✅ ${name}`); };
const fail = (name, detail) => { results.push({ name, ok: false }); console.error(`  ❌ ${name} — ${detail}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------- CDP client ----------------------------- */
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

/* ----------------------------- helpers ----------------------------- */
async function evalIn(cdp, sid, expression, userGesture = false) {
  const res = await cdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true, userGesture },
    sid,
  );
  if (res.exceptionDetails) {
    throw new Error(`${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description ?? ''}`);
  }
  return res.result?.value;
}

async function waitFor(cdp, sid, expression, label, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await evalIn(cdp, sid, expression)) return true;
    } catch { /* page may still be settling */ }
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${label}`);
}

/** Real mouse click at the element's center — genuine user gesture. */
async function realClick(cdp, sid, selector) {
  const box = await evalIn(
    cdp,
    sid,
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null;
      const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
  );
  if (!box) throw new Error(`element not found: ${selector}`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 }, sid);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 }, sid);
  await sleep(300);
}

async function shot(cdp, sid, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sid);
  const file = join(artifactsDir, `sidepanel-${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`  📸 ${file}`);
}

/* ----------------------------- main ----------------------------- */
mkdirSync(artifactsDir, { recursive: true });

const EXT_ID = await discoverExtensionId(Number(PORT), distDir);
if (!EXT_ID) {
  console.error('✗ Could not discover the extension id. Is the test env running?');
  process.exit(1);
}
console.log(`\n=== ADHD Tab Manager — side panel smoke (extension ${EXT_ID}) ===\n`);

const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const cdp = new Cdp(version.webSocketDebuggerUrl);

let panelSid = null;

/* Clean slate: close leftover extension pages and clear a stale open flag so
 * the run is deterministic regardless of earlier manual/probe sessions. */
{
  const { targetInfos } = await cdp.send('Target.getTargets');
  for (const t of targetInfos.filter((x) => x.type === 'page' && x.url.startsWith('chrome-extension://'))) {
    await cdp.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
  }
  await sleep(300);
  const wake = await cdp.send('Target.createTarget', { url: `chrome-extension://${EXT_ID}/src/popup/index.html` });
  await sleep(1500);
  const { targetInfos: ti2 } = await cdp.send('Target.getTargets');
  const sw = ti2.find((x) => x.type === 'service_worker');
  const attach = sw
    ? (await cdp.send('Target.attachToTarget', { targetId: sw.targetId, flatten: true })).sessionId
    : (await cdp.send('Target.attachToTarget', { targetId: wake.targetId, flatten: true })).sessionId;
  await cdp.send('Runtime.enable', {}, attach);
  await evalIn(cdp, attach, `chrome.storage.local.set({ adhd_sidepanel_open: false })`);
  const cleared = await evalIn(cdp, attach, `chrome.storage.local.get('adhd_sidepanel_open').then(r => r.adhd_sidepanel_open)`);
  if (cleared === true) {
    console.error('✗ Could not reset adhd_sidepanel_open — aborting.');
    cdp.close();
    process.exit(2);
  }
  await cdp.send('Target.closeTarget', { targetId: wake.targetId }).catch(() => {});
  await sleep(300);
  console.log('ℹ️  clean slate: stale extension pages closed, open flag reset');
}

try {
  /* --- 1. open the popup as a tab --- */
  const popupUrl = `chrome-extension://${EXT_ID}/src/popup/index.html`;
  const { targetId: popupTarget } = await cdp.send('Target.createTarget', { url: popupUrl });
  const { sessionId: popupSid } = await cdp.send('Target.attachToTarget', { targetId: popupTarget, flatten: true });
  await cdp.send('Runtime.enable', {}, popupSid);
  await cdp.send('Page.enable', {}, popupSid);
  await waitFor(cdp, popupSid, `!!document.querySelector('.app-header') && document.querySelectorAll('.nav-tab').length === 5`, 'popup render');

  /* --- 2. header + toggle placement --- */
  const placement = await evalIn(cdp, popupSid, `(() => {
    const actions = [...document.querySelectorAll('.header-actions > *')];
    const themeIdx = actions.findIndex(
      (b) => b.classList.contains('theme-toggle') && (b.getAttribute('aria-label') || '').includes('dark mode'),
    );
    const spIdx = actions.findIndex((b) => b.classList.contains('side-panel-toggle'));
    const focusIdx = actions.findIndex((b) => b.classList.contains('focus-toggle'));
    return { found: spIdx !== -1, afterTheme: spIdx > themeIdx, beforeFocus: spIdx < focusIdx, count: actions.length };
  })()`);
  placement.found && placement.afterTheme && placement.beforeFocus
    ? pass(`toggle after theme toggle, before Focus (${placement.count} header buttons)`)
    : fail('toggle placement', JSON.stringify(placement));
  await shot(cdp, popupSid, 'popup-header');

  const themeBefore = await evalIn(cdp, popupSid, `chrome.storage.local.get('adhd_theme').then(r => r.adhd_theme ?? 'light')`);
  console.log(`  ℹ️  current theme in storage: ${themeBefore}`);

  /* --- 3. real click opens the panel --- */
  await realClick(cdp, popupSid, '.side-panel-toggle');
  await waitFor(
    cdp,
    popupSid,
    `chrome.storage.local.get('adhd_sidepanel_open').then(r => r.adhd_sidepanel_open === true)`,
    'side panel page to mount',
    10000,
  );
  pass('real click opened the side panel (storage flag flipped)');

  await waitFor(cdp, popupSid, `document.querySelector('.side-panel-toggle')?.classList.contains('side-panel-toggle--active')`, 'toggle icon active');
  pass('popup header icon reflects the open state');
  await shot(cdp, popupSid, 'popup-toggle-active');

  /* --- 4. find + attach the side panel page --- */
  let panelTarget = null;
  for (let i = 0; i < 20 && !panelTarget; i++) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    panelTarget = targetInfos.find(
      (t) => t.type === 'page' && t.url.includes('/src/sidepanel/index.html'),
    );
    if (!panelTarget) await sleep(250);
  }
  if (!panelTarget) throw new Error('side panel page target never appeared');
  const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId: panelTarget.targetId, flatten: true });
  panelSid = sid;
  await cdp.send('Runtime.enable', {}, panelSid);
  await cdp.send('Page.enable', {}, panelSid);
  await waitFor(cdp, panelSid, `!!document.querySelector('.app-header') && document.querySelectorAll('.nav-tab').length === 5`, 'panel render');

  const panelState = await evalIn(cdp, panelSid, `(() => ({
    title: document.querySelector('.header-text')?.textContent,
    nav: document.querySelectorAll('.nav-tab').length,
    fluid: document.body.classList.contains('sidepanel-body'),
    quote: !!document.querySelector('.daily-quote'),
    focusBtn: !!document.querySelector('.focus-toggle'),
    theme: document.documentElement.dataset.theme,
  }))()`);
  panelState.title === 'ADHD Tabs' && panelState.nav === 5
    ? pass('panel renders the full app (title + 5 nav tabs)')
    : fail('panel renders the full app', JSON.stringify(panelState));
  panelState.fluid ? pass('panel uses the fluid sidepanel layout') : fail('panel layout', 'missing sidepanel-body');
  panelState.quote && panelState.focusBtn ? pass('quote + focus toggle present') : fail('quote/focus', JSON.stringify(panelState));

  const panelHeartbeat = await evalIn(cdp, panelSid, `chrome.storage.local.get('adhd_popup_heartbeat').then(r => typeof r.adhd_popup_heartbeat === 'number')`);
  panelHeartbeat ? pass('panel writes the popup heartbeat (SW double-decrement guard)') : fail('panel heartbeat', 'missing');
  await shot(cdp, panelSid, 'panel-home');

  /* --- 4b. SW double-decrement guard: getContexts must see the panel --- */
  const contexts = await evalIn(
    cdp,
    popupSid,
    `chrome.runtime.getContexts({ contextTypes: ['POPUP', 'SIDE_PANEL'] }).then((c) =>
      c.map((x) => x.contextType).sort(),
    )`,
  );
  Array.isArray(contexts) && contexts.includes('SIDE_PANEL')
    ? pass(`SW context query sees the panel: ${contexts.join(', ')}`)
    : fail('SW context query sees the panel', JSON.stringify(contexts));

  /* --- 5. theme sync: toggle dark in the panel, popup follows --- */
  const popupTheme0 = await evalIn(cdp, popupSid, `document.documentElement.dataset.theme`);
  const wantDark = popupTheme0 !== 'dark';
  // NB: the Export/Import buttons also use the `.theme-toggle` class — target
  // the real theme button by its aria-label instead.
  const themeSel = wantDark ? '[aria-label="Switch to dark mode"]' : '[aria-label="Switch to light mode"]';
  await realClick(cdp, panelSid, themeSel);
  await sleep(400);
  const panelTheme = await evalIn(cdp, panelSid, `document.documentElement.dataset.theme`);
  const popupTheme = await evalIn(cdp, popupSid, `document.documentElement.dataset.theme`);
  const storedTheme = await evalIn(cdp, popupSid, `chrome.storage.local.get('adhd_theme').then(r => r.adhd_theme)`);
  panelTheme === (wantDark ? 'dark' : 'light') && popupTheme === panelTheme && storedTheme === panelTheme
    ? pass(`theme sync: panel=${panelTheme}, popup=${popupTheme}, storage=${storedTheme}`)
    : fail('theme sync', JSON.stringify({ panelTheme, popupTheme, storedTheme, wantDark }));
  await shot(cdp, panelSid, 'panel-dark');

  /* --- 6. responsive widths inside the panel --- */
  let respOk = true;
  for (const [w, h, label] of [[320, 640, 'narrow'], [400, 700, 'standard'], [720, 700, 'wide']]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, panelSid);
    await sleep(300);
    // Scrollbar-tolerant check: a vertical scrollbar narrows clientWidth, which
    // makes scrollWidth > clientWidth even with zero real overflow. Compare
    // against window.innerWidth (which includes the scrollbar) instead.
    const { vw, offenders } = await evalIn(
      cdp,
      panelSid,
      `(() => {
        const vw = window.innerWidth;
        const offenders = [...document.querySelectorAll('body *')]
          .map(el => { const r = el.getBoundingClientRect(); return { right: Math.round(r.right), w: Math.round(r.width) }; })
          .filter(o => o.right > vw + 1 && o.w > 1)
          .slice(0, 5);
        return { vw, offenders };
      })()`,
    );
    const fits = offenders.length === 0;
    fits ? pass(`panel ${label} (${w}px): no horizontal overflow (innerWidth ${vw})`) : fail(`panel ${label} (${w}px)`, JSON.stringify({ vw, offenders }));
    respOk = respOk && fits;
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride', {}, panelSid);
  await shot(cdp, panelSid, 'panel-responsive');

  /* --- 7. icon tracks the closed state --- */
  await evalIn(cdp, popupSid, `chrome.storage.local.set({ adhd_sidepanel_open: false })`);
  await waitFor(cdp, popupSid, `!document.querySelector('.side-panel-toggle')?.classList.contains('side-panel-toggle--active')`, 'toggle icon inactive');
  pass('icon relaxes when the panel closes');
  await shot(cdp, popupSid, 'popup-toggle-inactive');

  /* --- 8. closing the panel page clears the flag (beforeunload) --- */
  await evalIn(cdp, popupSid, `chrome.storage.local.set({ adhd_sidepanel_open: true })`);
  const { targetInfos } = await cdp.send('Target.getTargets');
  const livePanel = targetInfos.find((t) => t.url.includes('/src/sidepanel/index.html'));
  if (livePanel) {
    await cdp.send('Target.closeTarget', { targetId: livePanel.targetId });
    let cleared = false;
    for (let i = 0; i < 25 && !cleared; i++) {
      cleared = await evalIn(cdp, popupSid, `chrome.storage.local.get('adhd_sidepanel_open').then(r => r.adhd_sidepanel_open !== true)`);
      if (!cleared) await sleep(200);
    }
    cleared
      ? pass('closing the panel clears the storage flag (beforeunload)')
      : fail('closing the panel clears the storage flag', 'flag still true after 5s');
    panelSid = null; // target is gone; nothing to detach in finally
  }
} catch (err) {
  console.error(`\n❌ Smoke aborted: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (panelSid) {
    // Closing the panel target lets beforeunload clear the storage flag.
    try {
      const { targetInfos } = await cdp.send('Target.getTargets');
      const p = targetInfos.find((t) => t.url.includes('/src/sidepanel/index.html'));
      if (p) await cdp.send('Target.closeTarget', { targetId: p.targetId });
    } catch {}
  }
  cdp.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== RESULT: ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) failed.forEach((f) => console.error(`  - ${f.name}`));
process.exit(failed.length ? 1 : 0);
