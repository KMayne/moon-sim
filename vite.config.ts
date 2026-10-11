/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves from /<repo>/; the deploy workflow passes BASE_PATH.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  // Agent worktrees live under <root>/.claude/worktrees/; watching them reloads this dev page.
  // Anchored to this root, so a dev server started inside a worktree still watches itself.
  server: { watch: { ignored: [`${import.meta.dirname}/.claude/worktrees/**`] } },
  optimizeDeps: { entries: ['index.html'] },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
