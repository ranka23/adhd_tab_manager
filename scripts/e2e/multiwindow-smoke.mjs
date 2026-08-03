#!/usr/bin/env node
/**
 * Real-browser interactive smoke of LIVE DATA + MULTI-WINDOW support.
 *
 * Drives the already-running test environment (start-test-env.mjs → Chrome
 * for Testing on :9222 with dist/ loaded) over CDP — the exact wire protocol
 * chrome-devtools-mcp uses — clicking real buttons and creating real tabs and
 * windows to verify:
 *
 *   1. popup renders (header, 5 nav tabs, side-panel toggle after theme)
 *   2. live: creating/closing a tab outside the popup updates the UI
 *   3. multi-window: a second window splits the Tabs view per window
 *   4. save-session prompt asks which window(s) to snapshot
 *   5. close-window action closes only the target window
 *
 * Screenshots land in artifacts/manual/.
 *
 * Usage:
 *   node scripts/e2e/start-test-env.mjs          # in one terminal
 *   node scripts/e2e/multiwindow-smoke.mjs       # in another
 */
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverExtensionId } from './discover-extension.mjs';

const PORT = process.env.CDP_PORT ?? '9222';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = resolve(ROOT, 'dist');
const ART = resolve(ROOT, 'artifacts/manual');
mkdirSync(ART, { recursive: true });

const EXT_ID = await discoverExtensionId(Number(PORT), DIST);
if (!EXT_ID) {
  console.error('✗ Could not discover the extension id. Is the test env running?');
  process.exit(1);
}
console.log(`extension id: ${EXT_ID}`);

const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
await new Promise((r) => (ws.onopen = r));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const pass = (name, detail = '') => {
  results.push({ name, ok: true });
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
};
const fail = (name, detail) => {
  results.push({ name, ok: false });
  console.error(`  ❌ ${name} — ${detail}`);
};

/* ---------- open the popup as a real tab ---------- */
const { targetId } = await send('Target.createTarget', {
  url: `chrome-extension://${EXT_ID}/src/popup/index.html`,
});
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);

const evalJs = async (expr) => {
  const { result, exceptionDetails } = await send(
    'Runtime.evaluate',
    { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true },
    sessionId,
  );
  if (exceptionDetails) {
    throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description ?? ''));
  }
  return result.value;
};
const waitFor = async (expr, label, timeoutMs = 10000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await evalJs(expr)) return;
    } catch {
      /* page settling */
    }
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${label}`);
};
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  const file = `${ART}/${name}.png`;
  const { writeFileSync } = await import('node:fs');
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`  📸 ${file}`);
};
const clickNav = (label) =>
  evalJs(`(() => { const el = [...document.querySelectorAll('.nav-tab')].find(e => (e.textContent||'').includes(${JSON.stringify(label)})); if (!el) return false; el.click(); return true; })()`);

console.log('\n=== Multi-window & live-data interactive smoke ===');

/* 1. render + header */
await waitFor(`!!document.querySelector('.app-header') && document.querySelectorAll('.nav-tab').length === 5`, 'app header');
const layout = await evalJs(`(() => {
  const actions = [...document.querySelectorAll('.header-actions > *')];
  const themeIdx = actions.findIndex(b => b.classList.contains('theme-toggle') && (b.getAttribute('aria-label')||'').includes('dark mode'));
  const spIdx = actions.findIndex(b => b.classList.contains('side-panel-toggle'));
  const focusIdx = actions.findIndex(b => b.classList.contains('focus-toggle'));
  return { sp: spIdx !== -1, afterTheme: spIdx > themeIdx, beforeFocus: spIdx < focusIdx, nav: document.querySelectorAll('.nav-tab').length };
})()`);
layout.sp && layout.afterTheme && layout.beforeFocus && layout.nav === 5
  ? pass('popup renders; side-panel toggle sits after the theme toggle', JSON.stringify(layout))
  : fail('popup renders; side-panel toggle placement', JSON.stringify(layout));

/* 2. LIVE: create a tab outside the popup */
await clickNav('Tabs');
await waitFor(`!!document.querySelector('.tab-group__count')`, 'tab count');
const before = await evalJs(`document.querySelector('.tab-group__count').textContent`);
const newTabId = await evalJs(`chrome.tabs.create({ url: 'https://interactive-live.example.com/' }).then(t => t.id)`);
await waitFor(
  `document.querySelector('.tab-group__count')?.textContent === '${Number(before) + 1}'`,
  'count increments (no reload)',
);
await waitFor(
  `[...document.querySelectorAll('.tab-card__domain')].some(e => (e.textContent||'').includes('interactive-live'))`,
  'new card appears',
);
pass('live: tab created outside the popup shows up automatically', `count ${before} → ${Number(before) + 1}`);
await evalJs(`chrome.tabs.remove(${newTabId})`);
await waitFor(`document.querySelector('.tab-group__count')?.textContent === '${before}'`, 'count restored');
pass('live: tab closed outside the popup disappears automatically', `count back to ${before}`);

/* 3. MULTI-WINDOW: second window → per-window sections */
await evalJs(`chrome.windows.create({ url: 'https://interactive-win2.example.com/', focused: false }).then(() => true)`);
await waitFor(`chrome.windows.getAll().then(ws => ws.length === 2)`, 'second window');
await waitFor(`document.querySelectorAll('.tab-group__window').length === 2`, 'two window sections');
const labels = await evalJs(`[...document.querySelectorAll('.tab-group__window-label')].map(e => e.textContent.trim())`);
const currentMarked = await evalJs(`!!document.querySelector('.tab-group__window--current')`);
labels.join() === 'Window 1,Window 2' && currentMarked
  ? pass('multi-window: tabs grouped per window, current marked', labels.join(', '))
  : fail('multi-window: tabs grouped per window', `labels=${labels.join(',')} current=${currentMarked}`);
await shot('interactive-multiwindow-tabs.png');

/* 4. save-session window prompt */
await clickNav('Sessions');
await evalJs(`(() => { const b = [...document.querySelectorAll('.session-saver__actions button')].find(b => (b.textContent||'').trim().startsWith('💾 Save Tabs')); if (!b || b.disabled) return false; b.click(); return true; })()`);
await waitFor(`!!document.querySelector('.session-saver__dialog')`, 'save dialog');
const options = await evalJs(`document.querySelectorAll('.session-saver__window-option').length`);
if (options === 2) {
  pass('save dialog asks which window(s) to save', `${options} window options`);
} else {
  fail('save dialog asks which window(s) to save', `options=${options}`);
}
// Select ONLY window 2 (toggle current window off, second on), save.
await evalJs(`(() => { const boxes = [...document.querySelectorAll('.session-saver__window-checkbox')]; boxes[0].click(); boxes[1].click(); return true; })()`);
await evalJs(`(() => {
  const el = document.querySelector('.session-saver__input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, 'Interactive MultiWin');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(250);
await evalJs(`(() => { const b = [...document.querySelectorAll('.session-saver__dialog-actions button')].find(b => (b.textContent||'').trim() === 'Save'); if (!b) return false; b.click(); return true; })()`);
await waitFor(
  `chrome.storage.local.get('adhd_sessions').then(r => (r.adhd_sessions||[])[0]?.name === 'Interactive MultiWin')`,
  'session saved',
);
const savedTabs = await evalJs(`chrome.storage.local.get('adhd_sessions').then(r => (r.adhd_sessions||[])[0].tabs.length)`);
savedTabs === 1
  ? pass('session contains ONLY the selected window tab', `${savedTabs} tab`)
  : fail('session contains ONLY the selected window tab', `tabs=${savedTabs}`);
await shot('interactive-multiwindow-save.png');

/* 5. close-window action */
await clickNav('Tabs');
const closeFound = await evalJs(`(() => {
  const b = [...document.querySelectorAll('.tab-group__window-close')].find(b => (b.getAttribute('aria-label')||'').includes('Window 2'));
  if (!b) return false; b.click(); return true;
})()`);
if (!closeFound) {
  fail('close-window button for Window 2', 'not found');
} else {
  await waitFor(`!!document.querySelector('.modal-overlay')`, 'modal');
  const modalText = await evalJs(`document.querySelector('.confirm-dialog__message')?.textContent`);
  (modalText || '').includes('Window 2')
    ? pass('close modal names the target window', modalText.trim())
    : fail('close modal names the target window', modalText);
  await evalJs(`(() => { const b = [...document.querySelectorAll('.confirm-dialog__actions button')].find(b => (b.textContent||'').trim().startsWith('Close ')); if (!b) return false; b.click(); return true; })()`);
  await waitFor(`chrome.windows.getAll().then(ws => ws.length === 1)`, 'window 2 closed');
  pass('close-window closed only Window 2');
  await waitFor(`document.querySelectorAll('.tab-group__window').length === 0`, 'single-window list');
  pass('UI collapsed back to a single unwrapped list');
}

/* summary */
const failed = results.filter((r) => !r.ok);
console.log(`\n=== RESULT: ${results.length - failed.length}/${results.length} ===`);
await send('Target.closeTarget', { targetId }).catch(() => {});
ws.close();
process.exit(failed.length ? 1 : 0);
