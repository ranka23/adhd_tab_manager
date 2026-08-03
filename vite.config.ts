/**
 * Vite configuration for the ADHD Tab Manager Chrome Extension.
 * Uses @crxjs/vite-plugin to bundle the extension with hot-reload support.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.tsx',
        sidepanel: 'src/sidepanel/index.tsx',
      },
    },
  },
});

