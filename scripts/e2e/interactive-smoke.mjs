/**
 * Quick interactive smoke of the running test environment (start-test-env.mjs):
 * opens the popup in the already-running Chrome for Testing over CDP and
 * verifies it renders. This mirrors what chrome-devtools-mcp will drive.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { discoverExtensionId } from './discover-extension.mjs';

const PORT = process.env.CDP_PORT ?? '9222';
const DIST = resolve(fileURLToPath(import.meta.url), '../../..', 'dist');

const EXT_ID = await discoverExtensionId(Number(PORT), DIST);
if (!EXT_ID) {
  console.error('✗ Could not discover the extension id.');
  console.error('  Is the test env running? node scripts/e2e/start-test-env.mjs');
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

const { targetId } = await send('Target.createTarget', {
  url: `chrome-extension://${EXT_ID}/src/popup/index.html`,
});
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);

const evalJs = async (expr) => {
  const { result, exceptionDetails } = await send(
    'Runtime.evaluate',
    { expression: expr, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (exceptionDetails) {
    throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description ?? ''));
  }
  return result.value;
};

// Wait for React to mount (header + nav tabs rendered).
for (let i = 0; i < 40; i++) {
  const ready = await evalJs(
    `!!document.querySelector('.app-header') && document.querySelectorAll('.nav-tab').length === 5`,
  ).catch(() => false);
  if (ready) break;
  await new Promise((r) => setTimeout(r, 250));
}

const header = await evalJs(`document.querySelector('.header-text')?.textContent`);
const navCount = await evalJs(`document.querySelectorAll('.nav-tab').length`);
const quote = await evalJs(`!!document.querySelector('.daily-quote')`);
const focusToggle = await evalJs(`!!document.querySelector('.focus-toggle')`);
const heartbeat = await evalJs(
  `chrome.storage.local.get('adhd_popup_heartbeat').then(r => typeof r.adhd_popup_heartbeat === 'number')`,
);
const bodyW = await evalJs(`document.body.scrollWidth`);
const clientW = await evalJs(`document.documentElement.clientWidth`);

console.log(`header:      "${header}"`);
console.log(`nav tabs:    ${navCount}`);
console.log(`quote:       ${quote}`);
console.log(`focus toggle:${focusToggle}`);
console.log(`heartbeat:   ${heartbeat}`);
console.log(`no overflow: ${bodyW <= clientW} (${bodyW} <= ${clientW})`);

const ok =
  header === 'ADHD Tabs' &&
  navCount === 5 &&
  quote &&
  focusToggle &&
  heartbeat &&
  bodyW <= clientW;
console.log(ok ? '\n✅ INTERACTIVE SMOKE PASS' : '\n❌ SMOKE FAIL');
await send('Target.closeTarget', { targetId }).catch(() => {});
ws.close();
process.exit(ok ? 0 : 1);
