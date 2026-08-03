/**
 * generate-icons.mjs — rasterize public/icons/logo.svg into the extension's
 * PNG icons (16 / 32 / 48 / 128) using a headless Chrome for Testing session
 * over CDP (the same wire protocol the e2e harnesses use).
 *
 * macOS `sips` can't rasterize SVG and the repo has no image library, but
 * Chrome renders the vector SVG at the exact target size, giving crisp
 * icons. The captured PNGs keep the SVG's transparency (corner alpha).
 *
 * Usage:
 *   node scripts/generate-icons.mjs
 * Set CHROME_FOR_TESTING (or CFT_CHROME) to override the browser binary.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/icons');
const svgPath = join(outDir, 'logo.svg');
const SIZES = [16, 32, 48, 128];

const CHROME =
  process.env.CHROME_FOR_TESTING ||
  process.env.CFT_CHROME ||
  '/tmp/cft/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------- CDP client ----------------------------- */
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 0;
    this.pending = new Map();
    this.ready = new Promise((resolvePromise, reject) => {
      this.ws.onopen = resolvePromise;
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
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

/* ----------------------------- main ----------------------------- */
mkdirSync(outDir, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'adhd-icons-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

/** Resolve the devtools port from Chrome's stderr banner. */
const port = await new Promise((resolvePort, reject) => {
  let buf = '';
  const timer = setTimeout(() => reject(new Error('timed out waiting for the DevTools port')), 20000);
  chrome.stderr.on('data', (d) => {
    buf += d.toString();
    const m = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
    if (m) {
      clearTimeout(timer);
      resolvePort(Number(m[1]));
    }
  });
  chrome.on('exit', (code) => {
    clearTimeout(timer);
    reject(new Error(`Chrome exited early with code ${code}`));
  });
});

const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const cdp = new Cdp(version.webSocketDebuggerUrl);

try {
  for (const size of SIZES) {
    const { targetId } = await cdp.send('Target.createTarget', {
      url: `file://${svgPath}`,
    });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    // The SVG fills the viewport (width/height 100%); capture at the exact
    // target size with a transparent background so the tile's corners stay
    // alpha-clean.
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: size, height: size, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );
    await cdp.send(
      'Emulation.setDefaultBackgroundColorOverride',
      { color: { r: 0, g: 0, b: 0, a: 0 } },
      sessionId,
    );
    await sleep(400);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const file = join(outDir, `icon${size}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`  ✅ ${file} (${size}×${size})`);
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  }
  console.log('\nIcons generated from logo.svg.');
} finally {
  cdp.close();
  chrome.kill('SIGKILL');
}
