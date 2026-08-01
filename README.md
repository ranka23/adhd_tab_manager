# 🧠 ADHD Tab Manager

A Chrome Extension designed specifically for ADHD brains — minimal clutter, one-action-at-a-time, dopamine-friendly tab management.

## Features

### 🧘 Focus Mode
- One click to start focusing
- Closes distractions and blocks distracting sites
- Calming visual feedback with elapsed time
- Gentle end-of-focus celebration

### 🍅 Pomodoro Timer
- Beautiful circular SVG timer
- Customizable work/break durations
- Streak counter for motivation
- Gentle audio chime on completion

### 💾 Session Saver
- Save current tabs as named sessions
- Restore sessions with one click
- Auto-saves every 5 minutes
- Undo-close for accidentally closed tabs

### 🛡️ Distraction Blocker
- Pre-loaded with common distracting sites
- Add/remove sites easily
- Calm redirect page when blocked site is accessed
- "Distractions avoided" counter for dopamine hits

### 📊 Daily Motivation
- Rotating calming quotes
- Daily progress stats
- Focus time tracking
- Encouraging messages based on activity

## Design Principles

This extension follows ADHD-specific design principles:

- **Calm color palette**: Soft blues, muted greens, warm neutrals
- **One primary action**: Each screen has ONE clear thing to do
- **Dopamine rewards**: Celebrate small wins with gentle animations
- **Minimal text**: Use icons and short labels
- **Forgiving UX**: "Undo" everything, no destructive actions without confirmation
- **Rounded, soft UI**: Large border-radius, soft shadows, no sharp edges
- **Progress indicators**: Show progress bars, streaks, and achievements

## Development

### Prerequisites
- Node.js 18+
- pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Build both targets (Chrome dist/ + Firefox dist-firefox/)
pnpm build:all

# Run unit/integration tests (248)
pnpm test

# Lint
pnpm lint

# Firefox add-on lint (web-ext)
pnpm lint:firefox

# Format
pnpm format
```

### Real-browser verification

```bash
# Automated Chrome e2e (32 checks, headless, temp profile)
node scripts/e2e/chrome-e2e.mjs

# Full manual-test matrix (74 checks, real clicks/tabs/storage/SW)
node scripts/e2e/manual-test.mjs

# + the ~60s service-worker tick test (timer completes with popup closed)
MANUAL_TEST_SLOW=1 node scripts/e2e/manual-test.mjs

# Interactive environment for MCP-driven / human testing (Chrome for Testing :9222)
node scripts/e2e/start-test-env.mjs
```

Results: `docs/manual-test-results.md`, `docs/manual-test-plan.md`, `adhd-prod-todo.md`.

### Loading the Extension

1. Run `pnpm build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` directory

## Tech Stack

- **Language**: TypeScript (strictest config)
- **UI**: React 18
- **Build**: Vite + @crxjs/vite-plugin
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **Storage**: chrome.storage.local
- **Architecture**: Manifest V3

## Project Structure

```
src/
├── popup/          # React UI for the extension popup
│   ├── components/ # Reusable UI components
│   ├── hooks/      # Custom React hooks
│   ├── services/   # Chrome API abstractions
│   ├── types/      # TypeScript type definitions
│   ├── utils/      # Helper functions and constants
│   └── styles/     # CSS stylesheets
├── background/     # Service worker (background scripts)
└── shared/         # Constants shared between popup and background
```

## License

MIT
