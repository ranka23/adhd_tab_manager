/**
 * Starts a persistent Chrome for Testing instance with the extension loaded
 * and a CDP debug port, so chrome-devtools-mcp (and the e2e harness) can
 * attach and drive it interactively.
 *
 *   node scripts/e2e/start-test-env.mjs            # start (background)
 *   node scripts/e2e/start-test-env.mjs --foreground # start (attached)
 *   node scripts/e2e/start-test-env.mjs --stop     # kill the instance
 *   node scripts/e2e/start-test-env.mjs --status   # is it running?
 *
 * Profile persists in .e2e-profile/ (git-ignored) so manual test state
 * survives restarts. Writes a PID file to .e2e-chrome.pid and prints the
 * extension id + popup URL once the extension is discovered.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverExtensionId } from './discover-extension.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const PORT = process.env.CDP_PORT ?? '9222';
const PROFILE = resolve(ROOT, '.e2e-profile');
const PID_FILE = resolve(ROOT, '.e2e-chrome.pid');

const CHROME =
  process.env.CFT_CHROME ??
  '/tmp/cft/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const DIST = resolve(ROOT, 'dist');

function isRunning() {
  if (!existsSync(PID_FILE)) return false;
  const pid = Number(readFileSync(PID_FILE, 'utf8'));
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForCdpEndpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const version = await res.json();
      if (version.webSocketDebuggerUrl) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('CDP endpoint never came up — is Chrome for Testing installed?');
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--stop')
    ? 'stop'
    : args.includes('--foreground')
      ? 'foreground'
      : args.includes('--status')
        ? 'status'
        : 'start';

  if (mode === 'status') {
    console.log(isRunning() ? '🟢 running' : '⚪ not running');
    return;
  }
  if (mode === 'stop') {
    if (!isRunning()) {
      console.log('Nothing to stop.');
      return;
    }
    const pid = Number(readFileSync(PID_FILE, 'utf8'));
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
    rmSync(PID_FILE, { force: true });
    console.log(`🛑 Stopped Chrome for Testing (pid ${pid}). Profile kept at .e2e-profile/.`);
    return;
  }

  if (isRunning()) {
    console.log('⚠️  Instance already running (see .e2e-chrome.pid). Use --stop first.');
    return;
  }
  if (!existsSync(CHROME)) {
    console.error(`✗ Chrome for Testing not found at:\n  ${CHROME}\nSet CFT_CHROME to the binary path.`);
    process.exit(1);
  }
  if (!existsSync(DIST)) {
    console.error('✗ dist/ missing — run `pnpm build:all` first.');
    process.exit(1);
  }
  mkdirSync(PROFILE, { recursive: true });

  const chromeArgs = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    `--load-extension=${DIST}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ];

  console.log(`🚀 Launching ${CHROME.split('/').slice(-2).join('/')}`);
  console.log(`   port:      ${PORT}\n   profile:   ${PROFILE}\n   extension: ${DIST}`);

  const proc = spawn(CHROME, chromeArgs, {
    stdio: 'ignore',
    detached: true,
  });
  proc.unref();
  writeFileSync(PID_FILE, String(proc.pid));
  console.log(`   pid:       ${proc.pid} (log: .e2e-chrome.log)`);

  try {
    await waitForCdpEndpoint();
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }

  // Give the extension a moment to register its service worker, then report.
  await new Promise((r) => setTimeout(r, 1500));
  const extId = await discoverExtensionId(Number(PORT), DIST);
  if (extId) {
    console.log(`✅ Extension loaded: ${extId}`);
    console.log(`   popup: chrome-extension://${extId}/src/popup/index.html`);
  } else {
    console.log('⚠️  Extension not found among CDP targets — check chrome://extensions.');
  }

  console.log(`\nMCP attach: npx chrome-devtools-mcp@latest --browserUrl http://127.0.0.1:${PORT}`);
  console.log('(already configured in .zed/mcp.json — restart Zed if needed)');
  if (mode === 'start') {
    console.log('\nInstance is running in the background. Stop with:');
    console.log('  node scripts/e2e/start-test-env.mjs --stop');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
