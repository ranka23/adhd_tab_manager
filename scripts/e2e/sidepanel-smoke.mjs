/**
 * Real-browser manual smoke for the side panel, driven against the
 * persistent test environment (start-test-env.mjs on :9222).
 *
 * The side panel is now the DEFAULT surface on Chromium: the manifest has no
 * `default_popup`, the toolbar click opens the panel natively
 * (`sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` — Chrome's
 * own mechanism, verified by this script) with a service-worker fallback, and
 * the old header toggle icon is gone. `chrome.sidePanel.open()` requires
 * a real user gesture, so the script opens the panel from the popup page
 * with CDP's userGesture:true — the same gesture a toolbar click provides.
 *
 * Verifies:
 *   - the manifest has no default_popup and the header has no toggle icon
 *   - sidePanel.open() with a user gesture mounts the panel
 *   - the SW context query sees the SIDE_PANEL context (double-decrement guard)
 *   - the panel renders the full app (header, 5 nav tabs, fluid layout)
 *   - the Open-Tabs list fills the panel height (overflow-y auto, no x scroll)
 *   - the panel writes the popup heartbeat (SW double-decrement guard)
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

/* Clean slate: close leftover extension pages so the run is deterministic. */
{
  const { targetInfos } = await cdp.send('Target.getTargets');
  for (const t of targetInfos.filter((x) => x.type === 'page' && x.url.startsWith('chrome-extension://'))) {
    await cdp.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
  }
  await sleep(500);
  console.log('ℹ️  clean slate: stale extension pages closed');
}

try {
  /* --- 1. open the popup page as a tab --- */
  const popupUrl = `chrome-extension://${EXT_ID}/src/popup/index.html`;
  const { targetId: popupTarget } = await cdp.send('Target.createTarget', { url: popupUrl });
  const { sessionId: popupSid } = await cdp.send('Target.attachToTarget', { targetId: popupTarget, flatten: true });
  await cdp.send('Runtime.enable', {}, popupSid);
  await cdp.send('Page.enable', {}, popupSid);
  await waitFor(cdp, popupSid, `!!document.querySelector('.app-header') && document.querySelectorAll('.nav-tab').length === 5`, 'popup render');

  /* --- 2. manifest + header: side panel is the default surface --- */
  const manifestInfo = await evalIn(cdp, popupSid, `chrome.runtime.getManifest()`);
  const noPopup = !manifestInfo.action?.default_popup;
  noPopup
    ? pass('manifest has no default_popup (toolbar click opens the side panel)')
    : fail('manifest has no default_popup', JSON.stringify(manifestInfo.action));

  const panelBehavior = await evalIn(cdp, popupSid, `chrome.sidePanel.getPanelBehavior()`);
  panelBehavior?.openPanelOnActionClick === true
    ? pass('panel behavior: openPanelOnActionClick=true (toolbar click opens the panel natively)')
    : fail('panel behavior openPanelOnActionClick', JSON.stringify(panelBehavior));

  const toggleAbsent = await evalIn(cdp, popupSid, `!document.querySelector('.side-panel-toggle')`);
  toggleAbsent
    ? pass('header has no panel↔popup toggle icon')
    : fail('header has no panel↔popup toggle icon', 'toggle found');
  const logoShown = await evalIn(cdp, popupSid, `!!document.querySelector('.header-icon-img')`);
  logoShown ? pass('header shows the new logo image') : fail('header shows the new logo image', 'missing');
  await shot(cdp, popupSid, 'popup-header');

  /* --- 3. open the panel with a user gesture (same as a toolbar click) --- */
  const winId = await evalIn(cdp, popupSid, `chrome.windows.getCurrent().then(w => w.id)`);
  const openResult = await evalIn(
    cdp,
    popupSid,
    `(async () => { try { await chrome.sidePanel.open({ windowId: ${winId} }); return 'ok'; } catch (e) { return 'ERR: ' + e.message; } })()`,
    true,
  );
  openResult === 'ok'
    ? pass('chrome.sidePanel.open() succeeded with a user gesture')
    : fail('chrome.sidePanel.open() succeeded', String(openResult));

  /* --- 4. the SW must see the SIDE_PANEL context (double-decrement guard) --- */
  let panelCtxSeen = false;
  for (let i = 0; i < 40 && !panelCtxSeen; i++) {
    panelCtxSeen = await evalIn(
      cdp,
      popupSid,
      `chrome.runtime.getContexts({ contextTypes: ['SIDE_PANEL'] }).then(c => c.length > 0)`,
    );
    if (!panelCtxSeen) await sleep(250);
  }
  panelCtxSeen
    ? pass('SW runtime.getContexts sees the SIDE_PANEL context')
    : fail('SW runtime.getContexts sees the SIDE_PANEL context', 'not found in 10s');

  /* --- 5. find + attach the side panel page --- */
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

  /* --- 5b. Open-Tabs list fills the panel height with internal scroll --- */
  await evalIn(cdp, panelSid, `(() => { const t = [...document.querySelectorAll('.nav-tab')].find(e => (e.textContent||'').includes('Tabs')); t?.click(); return true; })()`);
  await waitFor(cdp, panelSid, `!!document.querySelector('.tab-group__list')`, 'tab list');
  await sleep(300);
  const listStyle = await evalIn(cdp, panelSid, `(() => {
    const el = document.querySelector('.tab-group__list');
    const cs = getComputedStyle(el);
    const vh = window.innerHeight;
    const listRect = el.getBoundingClientRect();
    return { overflowY: cs.overflowY, overflowX: cs.overflowX, maxHeight: cs.maxHeight, listBottom: Math.round(listRect.bottom), vh };
  })()`);
  const listScrolls = listStyle.overflowY === 'auto' && listStyle.maxHeight === 'none' && listStyle.overflowX === 'hidden';
  const fillsHeight = listStyle.listBottom >= listStyle.vh - 2;
  listScrolls && fillsHeight
    ? pass(`tab list fills the panel: overflowY=${listStyle.overflowY}, maxHeight=${listStyle.maxHeight}, bottom=${listStyle.listBottom}/${listStyle.vh}`)
    : fail('tab list fills the panel', JSON.stringify(listStyle));
  await shot(cdp, panelSid, 'panel-tabs-fullheight');
  await evalIn(cdp, panelSid, `(() => { const t = [...document.querySelectorAll('.nav-tab')].find(e => (e.textContent||'').includes('Home')); t?.click(); return true; })()`);
  await sleep(300);

  /* --- 6. theme sync: toggle dark in the panel, popup follows --- */
  const popupTheme0 = await evalIn(cdp, popupSid, `document.documentElement.dataset.theme`);
  const wantDark = popupTheme0 !== 'dark';
  // NB: the Export/Import buttons also use the `.theme-toggle` class — target
  // the real theme button by its aria-label instead.
  const themeSel = wantDark ? '[aria-label="Switch to dark mode"]' : '[aria-label="Switch to light mode"]';
  await evalIn(cdp, panelSid, `document.querySelector(${JSON.stringify(themeSel)})?.click(); true`, true);
  await sleep(400);
  const panelTheme = await evalIn(cdp, panelSid, `document.documentElement.dataset.theme`);
  const popupTheme = await evalIn(cdp, popupSid, `document.documentElement.dataset.theme`);
  const storedTheme = await evalIn(cdp, popupSid, `chrome.storage.local.get('adhd_theme').then(r => r.adhd_theme)`);
  panelTheme === (wantDark ? 'dark' : 'light') && popupTheme === panelTheme && storedTheme === panelTheme
    ? pass(`theme sync: panel=${panelTheme}, popup=${popupTheme}, storage=${storedTheme}`)
    : fail('theme sync', JSON.stringify({ panelTheme, popupTheme, storedTheme, wantDark }));
  await shot(cdp, panelSid, 'panel-dark');

  /* --- 7. responsive widths inside the panel --- */
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
} catch (err) {
  console.error(`\n❌ Smoke aborted: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (panelSid) {
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
