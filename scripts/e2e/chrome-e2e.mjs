/**
 * Real-browser end-to-end test for the ADHD Tab Manager extension (Chrome).
 *
 * Launches Chrome for Testing (branded Google Chrome 137+ ignores
 * --load-extension) in an isolated temporary profile with `dist/` loaded as an
 * unpacked extension, then exercises the popup and asserts the core flows:
 *
 *   - popup renders (header, quote, focus toggle, 5 nav tabs)
 *   - popup heartbeat written for the Firefox background fallback
 *   - dark mode toggles, persists to storage, survives reload (no flash path)
 *   - nav tab switching
 *   - pomodoro start / countdown / pause / resume / reset
 *   - focus mode start / end
 *   - distraction blocker add / remove
 *   - session save / delete / undo-restore
 *   - service worker: alarms registered + message handler responds
 *   - responsiveness: no horizontal overflow at 360 / 400 / 480 / 800 px
 *   - screenshots of every tab into artifacts/ for visual review
 *
 * No user profile is touched — a fresh temp profile is used and deleted.
 *
 * Usage: `node scripts/e2e/chrome-e2e.mjs [--no-screenshots]`
 * Set CHROME_FOR_TESTING to override the binary path.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const distDir = join(root, 'dist');
const artifactsDir = join(root, 'artifacts');
const withScreenshots = !process.argv.includes('--no-screenshots');

const CHROME =
  process.env.CHROME_FOR_TESTING ||
  '/tmp/cft/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const PORT = 9333;
const PROFILE = `/tmp/adhd-e2e-chrome-${process.pid}`;

const results = [];
const consoleErrors = [];

function pass(name) { results.push({ name, ok: true }); console.log(`  ✅ ${name}`); }
function fail(name, detail) { results.push({ name, ok: false, detail }); console.error(`  ❌ ${name} — ${detail}`); }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ----------------------------- CDP client ----------------------------- */
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 0;
    this.pending = new Map();
    this.events = [];
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
        if (msg.error) p.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
        consoleErrors.push(text);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        consoleErrors.push(`EXCEPTION: ${d.text} ${d.exception?.description ?? ''}`);
      } else {
        this.events.push(msg);
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
  async waitForEvent(method, timeoutMs = 8000, sessionId) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const idx = this.events.findIndex((e) => e.method === method && (!sessionId || e.sessionId === sessionId));
      if (idx !== -1) return this.events.splice(idx, 1)[0].params;
      await sleep(100);
    }
    throw new Error(`timed out waiting for CDP event ${method}`);
  }
  close() { try { this.ws.close(); } catch {} }
}
/* ----------------------------- helpers ----------------------------- */
let cdp;
let sessionId; // popup session
let extId;

async function evalInSession(sid, expression) {
  const res = await cdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true, userGesture: true },
    sid,
  );
  if (res.exceptionDetails) {
    throw new Error(`page eval failed: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description ?? ''}`);
  }
  return res.result?.value;
}

async function waitForSession(sid, expression, label, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await evalInSession(sid, expression)) return true;
    } catch { /* page may still be settling */ }
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${label}`);
}

const evalIn = (expression) => evalInSession(sessionId, expression);
const waitFor = (expression, label, timeoutMs) => waitForSession(sessionId, expression, label, timeoutMs);

async function clickAria(label) {
  const ok = await evalIn(
    `(() => { const el = document.querySelector('[aria-label=${JSON.stringify(label)}]'); if (!el) return false; el.click(); return true; })()`,
  );
  if (!ok) throw new Error(`button not found: aria-label=${label}`);
}

async function clickByText(text, scope = 'button') {
  const ok = await evalIn(
    `(() => { const els = [...document.querySelectorAll(${JSON.stringify(scope)})]; const el = els.find(e => (e.textContent||'').trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true; })()`,
  );
  if (!ok) throw new Error(`button not found: "${text}"`);
}

async function clickNav(label) {
  const ok = await evalIn(
    `(() => { const els = [...document.querySelectorAll('.nav-tab')]; const el = els.find(e => (e.textContent||'').includes(${JSON.stringify(label)})); if (!el) return false; el.click(); return true; })()`,
  );
  if (!ok) throw new Error(`nav tab not found: ${label}`);
}

async function setInputValue(selector, value) {
  const ok = await evalIn(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true; })()`,
  );
  if (!ok) throw new Error(`input not found: ${selector}`);
}

async function screenshot(name) {
  if (!withScreenshots) return;
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
  const file = join(artifactsDir, `chrome-${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`  📸 ${file}`);
}

async function setViewport(width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
  await sleep(300);
}

async function getStored(key) {
  return evalIn(`chrome.storage.local.get(${JSON.stringify(key)}).then(r => r[${JSON.stringify(key)}])`);
}

/* ---------- discover extension id from the loaded extension ---------- */
async function discoverExtension() {
  // The extension service worker starts on install (alarms are registered), so
  // its target URL reveals the id. Fall back to profile Preferences.
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const sw = list.find((t) => t.type === 'service_worker' && t.url.includes('service-worker-loader.js'));
    if (sw) {
      extId = new URL(sw.url).host;
      break;
    }
    try {
      const prefs = JSON.parse(readFileSync(join(PROFILE, 'Default', 'Preferences'), 'utf8'));
      const settings = prefs?.extensions?.settings ?? {};
      const ours = Object.entries(settings).find(([, v]) => (v?.path ?? '').includes('adhd-tab-manager'));
      if (ours) { extId = ours[0]; break; }
    } catch { /* prefs not ready */ }
    await sleep(500);
  }
  if (!extId) throw new Error('extension service worker never appeared');
  console.log(`Extension id: ${extId}`);
}

/* ----------------------------- main ----------------------------- */
async function main() {
  mkdirSync(artifactsDir, { recursive: true });
  rmSync(PROFILE, { recursive: true, force: true });

  console.log(`\n=== ADHD Tab Manager — Chrome e2e (port ${PORT}) ===`);

  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      `--load-extension=${distDir}`,
      `--disable-extensions-except=${distDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=800,700',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const cleanup = () => {
    try { chrome.kill('SIGKILL'); } catch {}
    try { rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); } catch {}
  };

  try {
    let version;
    for (let i = 0; i < 60; i++) {
      try {
        version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
        break;
      } catch { await sleep(500); }
    }
    if (!version) throw new Error('Chrome devtools endpoint never came up');

    cdp = new Cdp(version.webSocketDebuggerUrl);
    await discoverExtension();

    /* --- open the popup as a tab --- */
    const popupUrl = `chrome-extension://${extId}/src/popup/index.html`;
    const { targetId } = await cdp.send('Target.createTarget', { url: popupUrl });
    const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    sessionId = sid;
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    await setViewport(400, 600);

    console.log('\n--- 1. Popup renders ---');
    await waitFor(`!!document.querySelector('.app-header')`, 'app header');
    await waitFor(`!!document.querySelector('.daily-quote')`, 'daily quote');
    const headerText = await evalIn(`document.querySelector('.header-text')?.textContent`);
    const quote = await evalIn(`!!document.querySelector('.daily-quote')`);
    const focusToggle = await evalIn(`!!document.querySelector('.focus-toggle')`);
    const navCount = await evalIn(`document.querySelectorAll('.nav-tab').length`);
    headerText === 'ADHD Tabs' ? pass('header renders "ADHD Tabs"') : fail('header renders "ADHD Tabs"', `got "${headerText}"`);
    quote ? pass('daily quote renders') : fail('daily quote renders', 'missing');
    focusToggle ? pass('focus toggle renders') : fail('focus toggle renders', 'missing');
    navCount === 5 ? pass('5 nav tabs render') : fail('5 nav tabs render', `got ${navCount}`);
    await screenshot('home-light-400');

    console.log('\n--- 2. Popup heartbeat ---');
    await waitFor(`chrome.storage.local.get('adhd_popup_heartbeat').then(r => typeof r.adhd_popup_heartbeat === 'number')`, 'heartbeat');
    const heartbeat = await getStored('adhd_popup_heartbeat');
    Date.now() - heartbeat < 60_000
      ? pass('heartbeat written to storage')
      : fail('heartbeat written to storage', `stale by ${Math.round((Date.now() - heartbeat) / 1000)}s`);

    console.log('\n--- 3. Dark mode toggle + persistence + reload ---');
    // The popup starts in the OS color scheme — normalize to light first.
    const startLabel = await evalIn(
      `(() => { const b = [...document.querySelectorAll('.theme-toggle')].find(b => { const l = b.getAttribute('aria-label')||''; return l.includes('dark mode') || l.includes('light mode'); }); return b ? b.getAttribute('aria-label') : null; })()`,
    );
    if (startLabel === 'Switch to light mode') {
      await clickAria('Switch to light mode');
      await sleep(300);
    }
    await clickAria('Switch to dark mode');
    await sleep(400);
    const themeDark = await evalIn(`document.documentElement.dataset.theme`);
    const storedDark = await getStored('adhd_theme');
    themeDark === 'dark' ? pass('theme attribute flips to dark') : fail('theme attribute flips to dark', themeDark);
    storedDark === 'dark' ? pass('theme persisted to storage') : fail('theme persisted to storage', String(storedDark));
    await screenshot('home-dark-400');

    await cdp.send('Page.reload', {}, sessionId);
    await waitFor(`!!document.querySelector('.app-header')`, 'app header after reload');
    await sleep(400);
    const afterReload = await evalIn(`document.documentElement.dataset.theme`);
    afterReload === 'dark'
      ? pass('theme survives reload (preload script)')
      : fail('theme survives reload (preload script)', `got "${afterReload}"`);
    await clickAria('Switch to light mode');

    console.log('\n--- 4. Nav switching ---');
    for (const [label, panelId] of [['Tabs', 'panel-tabs'], ['Timer', 'panel-timer'], ['Sessions', 'panel-sessions'], ['Block', 'panel-block'], ['Home', 'panel-home']]) {
      await clickNav(label);
      await sleep(250);
      const active = await evalIn(`!!document.getElementById(${JSON.stringify(panelId)})`);
      active ? pass(`nav → ${label}`) : fail(`nav → ${label}`, `panel ${panelId} missing`);
    }

    console.log('\n--- 5. Pomodoro timer ---');
    await clickNav('Timer');
    await waitFor(`!!document.querySelector('.pomodoro-timer__time')`, 'timer');
    const idleTime = await evalIn(`document.querySelector('.pomodoro-timer__time')?.textContent`);
    idleTime === '25:00' ? pass(`timer idle shows 25:00`) : fail(`timer idle shows 25:00`, `got "${idleTime}"`);
    await clickByText('Start Focus');
    await sleep(3500);
    const ticking = await evalIn(`document.querySelector('.pomodoro-timer__time')?.textContent`);
    ticking !== '25:00' && ticking !== idleTime
      ? pass('timer counts down while popup open')
      : fail('timer counts down while popup open', `still "${ticking}" after 3.5s`);
    await screenshot('timer-running-400');
    await clickByText('Pause');
    await sleep(1500);
    const paused = await evalIn(`document.querySelector('.pomodoro-timer__time')?.textContent`);
    await sleep(1200);
    const stillPaused = await evalIn(`document.querySelector('.pomodoro-timer__time')?.textContent`);
    paused === stillPaused ? pass('pause stops countdown') : fail('pause stops countdown', `${paused} → ${stillPaused}`);
    await clickByText('Resume');
    await sleep(1500);
    const resumed = await evalIn(`document.querySelector('.pomodoro-timer__time')?.textContent`);
    resumed !== stillPaused ? pass('resume continues countdown') : fail('resume continues countdown', `${stillPaused} → ${resumed}`);
    await clickByText('Reset');
    await sleep(400);
    const reset = await evalIn(`document.querySelector('.pomodoro-timer__phase')?.textContent`);
    reset === 'Ready?' ? pass('reset returns to idle') : fail('reset returns to idle', `got "${reset}"`);

    console.log('\n--- 6. Focus mode ---');
    await clickNav('Home');
    await clickAria('Start focus mode');
    await waitFor(`!!document.querySelector('.focus-mode--active')`, 'focus mode active');
    const focusActive = await evalIn(`document.querySelector('.focus-mode__status')?.textContent`);
    focusActive === "You're focused" ? pass('focus mode starts') : fail('focus mode starts', `got "${focusActive}"`);
    await screenshot('focus-active-400');
    await clickAria('End focus mode');
    await waitFor(`!!document.querySelector('.focus-mode--inactive')`, 'focus mode ended');
    pass('focus mode ends');

    console.log('\n--- 7. Distraction blocker ---');
    await clickNav('Block');
    // The list is collapsed to 5 items — expand it so a newly added site is visible.
    await evalIn(
      `(() => { const b = [...document.querySelectorAll('.distraction-blocker__list button')].find(b => (b.textContent||'').includes('Show all')); if (!b) return false; b.click(); return true; })()`,
    );
    await sleep(300);
    await setInputValue('.distraction-blocker__input', 'example.com');
    await sleep(300);
    // Wait until the Add button is enabled (React state must settle first).
    await waitFor(
      `(() => { const b = [...document.querySelectorAll('.distraction-blocker__add button')][0]; return b && !b.disabled; })()`,
      'add button enabled',
    );
    await clickByText('+ Add', '.distraction-blocker__add button');
    await waitFor(`document.body.textContent.includes('example.com')`, 'blocked site added');
    pass('add blocked site');
    await screenshot('blocker-400');
    await clickAria('Remove example.com from blocked list');
    await waitFor(`!document.body.textContent.includes('example.com')`, 'blocked site removed');
    pass('remove blocked site');

    console.log('\n--- 8. Sessions: save / delete / undo ---');
    await clickNav('Sessions');
    // Tab count varies (the popup page itself is an open tab) — match by prefix.
    await evalIn(
      `(() => { const b = [...document.querySelectorAll('.session-saver__actions button')].find(b => (b.textContent||'').trim().startsWith('💾 Save Tabs')); if (!b || b.disabled) return false; b.click(); return true; })()`,
    );
    await waitFor(`!!document.querySelector('.session-saver__dialog')`, 'save dialog');
    await setInputValue('.session-saver__input', 'E2E Test Session');
    await sleep(200);
    await clickByText('Save', '.session-saver__dialog-actions button');
    await waitFor(`[...document.querySelectorAll('.session-card__name')].some(e => e.textContent === 'E2E Test Session')`, 'session card');
    pass('session saved');
    await screenshot('sessions-400');
    await clickAria('Delete E2E Test Session');
    await waitFor(`!!document.querySelector('.session-card__confirm-delete')`, 'confirm delete dialog');
    await clickByText('Yes');
    await waitFor(`!!document.querySelector('.toast--undo')`, 'undo toast');
    pass('delete shows undo toast');
    await clickByText('Undo', '.toast__action');
    await waitFor(`[...document.querySelectorAll('.session-card__name')].some(e => e.textContent === 'E2E Test Session')`, 'session restored');
    pass('undo restores session');

    console.log('\n--- 9. Service worker (alarms + messages) ---');
    const alarms = await evalIn(`chrome.alarms.getAll().then(a => a.map(x => x.name).sort())`);
    alarms.join() === 'adhd_auto_save,adhd_pomodoro_tick'
      ? pass(`alarms registered: ${alarms.join(', ')}`)
      : fail('alarms registered', `got ${alarms.join(', ')}`);
    const msgReply = await evalIn(`chrome.runtime.sendMessage({type:'GET_FOCUS_STATE'}).then(r => r && r.success)`);
    msgReply === true ? pass('SW message handler responds') : fail('SW message handler responds', String(msgReply));

    console.log('\n--- 10. Responsiveness (no horizontal overflow) ---');
    const viewports = [[360, 560, 'mobile-narrow'], [400, 600, 'popup-standard'], [480, 700, 'popup-wide'], [800, 700, 'tab-wide']];
    for (const [w, h, label] of viewports) {
      await setViewport(w, h);
      const { scrollW, clientW, bodyW } = await evalIn(
        `(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, bodyW: document.body.getBoundingClientRect().width }))()`,
      );
      const fits = scrollW <= clientW + 1;
      const capped = bodyW <= 480 + 1;
      fits && capped
        ? pass(`${label} (${w}px): no horizontal overflow (scroll ${scrollW} ≤ client ${clientW}, body ${bodyW}px)`)
        : fail(`${label} (${w}px): overflow`, JSON.stringify({ scrollW, clientW, bodyW }));
      await screenshot(`responsive-${label}-${w}px`);
    }

    console.log('\n--- 11. Console health ---');
    const realErrors = consoleErrors.filter((e) => !e.includes('favicon'));
    realErrors.length === 0
      ? pass('no console errors / exceptions')
      : fail('no console errors / exceptions', realErrors.slice(0, 5).join(' || '));

    /* ---------- summary ---------- */
    const failed = results.filter((r) => !r.ok);
    console.log(`\n=== RESULT: ${results.length - failed.length}/${results.length} passed ===`);
    if (failed.length) {
      console.error('FAILED:');
      failed.forEach((f) => console.error(`  - ${f.name}: ${f.detail}`));
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`\n❌ E2E run aborted: ${err.message}`);
    process.exitCode = 1;
  } finally {
    cleanup();
    if (cdp) cdp.close();
  }
}

main();
