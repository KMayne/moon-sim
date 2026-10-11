/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served from a subpath in production (kianmayne.co.uk/moon-sim/): the build sets BASE_PATH.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  build: {
    // Bundled dependencies' licence texts, shipped with the site (linked from the Credits panel).
    license: { fileName: 'third-party-licenses.md' },
  },
  // Agent worktrees live under <root>/.claude/worktrees/; watching them reloads this dev page.
  // Anchored to this root, so a dev server started inside a worktree still watches itself.
  server: { watch: { ignored: [`${import.meta.dirname}/.claude/worktrees/**`] } },
  optimizeDeps: { entries: ['index.html'] },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
