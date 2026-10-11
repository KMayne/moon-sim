/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves from /<repo>/; the deploy workflow passes BASE_PATH.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  // Agent worktrees live under .claude/; watching or dep-scanning them reloads the dev page.
  server: { watch: { ignored: ['**/.claude/**'] } },
  optimizeDeps: { entries: ['index.html'] },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
