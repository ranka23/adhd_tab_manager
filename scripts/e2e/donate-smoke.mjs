/**
 * Real-browser smoke for the Home-tab donation + feedback sections, driven
 * against the persistent test environment (start-test-env.mjs on :9222).
 *
 * ADHD Tab Manager is open source. The Home tab ends with two sections:
 *   1. "Request a Feature or Report a Bug" (FeedbackCard) — links to the
 *      GitHub Issues page, opens via browser.tabs.create.
 *   2. "Support the Project" (DonateCard) — SideRouter-style modal with
 *      ETH + SOL wallet addresses, their QR-code images, copy buttons, and
 *      an open-source footer link.
 *
 * Verifies:
 *   - both cards render on the Home tab, FeedbackCard above DonateCard
 *   - the feedback CTA points at ISSUES_URL and opens a tab on click
 *   - the donate modal opens with the "Buy me a Coffee!" hero
 *   - both wallets render name, address, QR image (loaded, non-blank)
 *   - the copy buttons write the real wallet addresses to the clipboard
 *   - Escape closes the modal; footer links to SOURCE_URL
 *   - no horizontal overflow at popup + panel widths
 *   - screenshots into artifacts/ for visual review
 *
 * Usage: node scripts/e2e/donate-smoke.mjs   (env must be running)
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
  const file = join(artifactsDir, `donate-${name}.png`);
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
console.log(`\n=== ADHD Tab Manager — Home donation + feedback smoke (extension ${EXT_ID}) ===\n`);

const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const cdp = new Cdp(version.webSocketDebuggerUrl);

let sid = null;

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
  /* --- 1. open the popup page as a tab (800px wide by default) --- */
  const popupUrl = `chrome-extension://${EXT_ID}/src/popup/index.html`;
  const { targetId } = await cdp.send('Target.createTarget', { url: popupUrl });
  ({ sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
  await cdp.send('Runtime.enable', {}, sid);
  await cdp.send('Page.enable', {}, sid);
  await waitFor(cdp, sid, `!!document.querySelector('.app-header') && document.querySelectorAll('.nav-tab').length === 5`, 'popup render');

  /* --- 2. both cards render on the Home tab, Feedback above Donate --- */
  const cards = await evalIn(
    cdp,
    sid,
    `(() => {
      const feedback = document.querySelector('.feedback-card');
      const donate = document.querySelector('.donate-card');
      if (!feedback || !donate) return { ok: false };
      const fbRect = feedback.getBoundingClientRect();
      const dnRect = donate.getBoundingClientRect();
      return {
        ok: true,
        feedbackTitle: feedback.querySelector('.feedback-card__title')?.textContent,
        donateTitle: donate.querySelector('.donate-card__title')?.textContent,
        feedbackAbove: fbRect.top < dnRect.top,
        donateLast: !donate.nextElementSibling || !donate.closest('.section').nextElementSibling,
      };
    })()`,
  );
  cards.ok && cards.feedbackTitle === 'Request a Feature or Report a Bug' && cards.donateTitle === 'Support the Project'
    ? pass('both cards render on the Home tab (Feedback + Donate)')
    : fail('both cards render', JSON.stringify(cards));
  cards.feedbackAbove
    ? pass('FeedbackCard sits just ABOVE the DonateCard')
    : fail('FeedbackCard above DonateCard', JSON.stringify(cards));

  /* --- 3. feedback CTA → GitHub Issues, opens a tab on click --- */
  const issuesInfo = await evalIn(
    cdp,
    sid,
    `(() => {
      const link = document.querySelector('.feedback-card__button');
      return { href: link?.getAttribute('href'), target: link?.getAttribute('target'), rel: link?.getAttribute('rel') };
    })()`,
  );
  issuesInfo.href?.includes('/issues') && issuesInfo.target === '_blank'
    ? pass(`feedback CTA → ${issuesInfo.href}`)
    : fail('feedback CTA href', JSON.stringify(issuesInfo));

  const tabsBefore = await evalIn(cdp, sid, `chrome.tabs.query({}).then(t => t.length)`);
  await evalIn(cdp, sid, `document.querySelector('.feedback-card__button')?.click(); true`, true);
  // chrome.tabs.create resolves before the URL commits — poll for the tab.
  let issuesTab = null;
  for (let i = 0; i < 25 && !issuesTab; i++) {
    issuesTab = await evalIn(
      cdp,
      sid,
      `chrome.tabs.query({}).then(ts => ts.find(t => (t.url||'').includes('github.com/ranka23/adhd_tab_manager/issues')) || null)`
    );
    if (!issuesTab) await sleep(200);
  }
  const tabsAfter = await evalIn(cdp, sid, `chrome.tabs.query({}).then(t => t.length)`);
  tabsAfter === tabsBefore + 1 && issuesTab
    ? pass('click opens the GitHub Issues page in a new tab')
    : fail('click opens GitHub Issues', JSON.stringify({ tabsBefore, tabsAfter, issuesUrl: issuesTab?.url }));
  // close the issues tab to keep the slate clean
  if (issuesTab?.id) await evalIn(cdp, sid, `chrome.tabs.remove(${issuesTab.id}).then(() => true)`, true);

  /* --- 4. open the donate modal --- */
  await evalIn(cdp, sid, `document.querySelector('.donate-card__button')?.scrollIntoView({ block: 'center' }); true`);
  await sleep(200);
  await shot(cdp, sid, 'home-cards');
  await evalIn(cdp, sid, `document.querySelector('.donate-card__button')?.click(); true`, true);
  await waitFor(cdp, sid, `!!document.querySelector('.donate-dialog')`, 'donate modal');

  const modal = await evalIn(
    cdp,
    sid,
    `(() => ({
      title: document.querySelector('.donate-dialog__title')?.textContent,
      message: document.querySelector('.donate-dialog__message')?.textContent,
      body: document.querySelector('.donate-dialog__body')?.textContent,
      wallets: [...document.querySelectorAll('.donate-wallet__name')].map(e => e.textContent),
      addresses: [...document.querySelectorAll('.donate-wallet__address')].map(e => e.textContent.trim()),
      footer: document.querySelector('.donate-dialog__footer a')?.textContent,
      footerHref: document.querySelector('.donate-dialog__footer a')?.getAttribute('href'),
    }))()`,
  );
  modal.title === 'Buy me a Coffee!'
    ? pass('modal opens with the "Buy me a Coffee!" hero')
    : fail('modal hero', JSON.stringify(modal.title));
  modal.wallets.join(',') === 'ETH,SOL'
    ? pass(`both wallets render: ${modal.wallets.join(' + ')}`)
    : fail('wallets', JSON.stringify(modal.wallets));
  modal.addresses[0]?.startsWith('0x') && modal.addresses[1]?.length >= 40
    ? pass(`addresses shown: ETH ${modal.addresses[0].slice(0, 10)}…, SOL ${modal.addresses[1].slice(0, 8)}…`)
    : fail('addresses', JSON.stringify(modal.addresses));
  modal.footer === 'Source Code' && modal.footerHref?.includes('github.com/ranka23/adhd_tab_manager')
    ? pass(`footer links to the open-source repo (${modal.footerHref})`)
    : fail('footer link', JSON.stringify(modal));

  /* --- 5. QR images loaded and non-blank --- */
  await waitFor(
    cdp,
    sid,
    `[...document.querySelectorAll('.donate-wallet__qr-img')].length === 2 && [...document.querySelectorAll('.donate-wallet__qr-img')].every(img => img.complete && img.naturalWidth > 0)`,
    'QR images to load',
  );
  const qr = await evalIn(
    cdp,
    sid,
    `(() => [...document.querySelectorAll('.donate-wallet__qr-img')].map(img => ({
      alt: img.alt,
      src: img.src,
      loaded: img.complete && img.naturalWidth > 0,
      w: img.naturalWidth,
    })))()`,
  );
  qr.length === 2 && qr.every((q) => q.loaded && q.w > 100)
    ? pass(`QR images loaded: ETH ${qr[0].w}px, SOL ${qr[1].w}px`)
    : fail('QR images', JSON.stringify(qr));
  await shot(cdp, sid, 'donate-modal');

  /* --- 6. copy buttons write the real wallet addresses --- */
  await evalIn(
    cdp,
    sid,
    `Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } } }); true`,
  );
  await evalIn(cdp, sid, `document.querySelectorAll('.donate-dialog__copy')[0]?.click(); true`, true);
  await sleep(300);
  const copiedEth = await evalIn(cdp, sid, `window.__copied`);
  copiedEth?.startsWith('0x')
    ? pass(`ETH copy writes the address (${copiedEth.slice(0, 10)}…)`)
    : fail('ETH copy', JSON.stringify(copiedEth));
  await evalIn(cdp, sid, `document.querySelectorAll('.donate-dialog__copy')[1]?.click(); true`, true);
  await sleep(300);
  const copiedSol = await evalIn(cdp, sid, `window.__copied`);
  copiedSol?.length >= 40 && !copiedSol.startsWith('0x')
    ? pass(`SOL copy writes the address (${copiedSol.slice(0, 8)}…)`)
    : fail('SOL copy', JSON.stringify(copiedSol));

  /* --- 7. Escape closes the modal --- */
  await evalIn(cdp, sid, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(200);
  const closed = await evalIn(cdp, sid, `!document.querySelector('.donate-dialog')`);
  closed ? pass('Escape closes the modal') : fail('Escape closes the modal', 'still open');

  /* --- 8. responsive: no horizontal overflow at popup + panel widths --- */
  let respOk = true;
  for (const [w, h, label] of [[320, 600, 'narrow'], [400, 600, 'standard'], [720, 700, 'wide']]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, sid);
    await sleep(300);
    const { vw, offenders } = await evalIn(
      cdp,
      sid,
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
    fits ? pass(`home cards at ${label} (${w}px): no horizontal overflow`) : fail(`home cards ${label} (${w}px)`, JSON.stringify({ vw, offenders }));
    respOk = respOk && fits;
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride', {}, sid);
  await shot(cdp, sid, 'home-responsive');
} catch (err) {
  console.error(`\n❌ Smoke aborted: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (sid) {
    try {
      const { targetInfos } = await cdp.send('Target.getTargets');
      const p = targetInfos.find((t) => t.url.startsWith('chrome-extension://'));
      if (p) await cdp.send('Target.closeTarget', { targetId: p.targetId });
    } catch {}
  }
  cdp.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== RESULT: ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) failed.forEach((f) => console.error(`  - ${f.name}`));
process.exit(failed.length ? 1 : 0);
