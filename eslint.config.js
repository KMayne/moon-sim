import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const RENDER_AND_UI = [
  { group: ['three', 'three/*'], message: 'Pure layer: no rendering imports.' },
  { group: ['react', 'react-dom', 'react/*', '@react-three/*'], message: 'Pure layer: no React.' },
  { group: ['zustand', 'zustand/*', 'leva'], message: 'Pure layer: no app state or UI.' },
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.claude'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Leva is confined to one file so it can be swapped out later.
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'leva', message: 'Only src/ui/Controls.tsx may import leva.' }] },
      ],
    },
  },
  {
    files: ['src/ui/Controls.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  // Layering: astro/ is ephemeris only; sim/ is pure scene math. Neither touches rendering or UI.
  {
    files: ['src/astro/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...RENDER_AND_UI,
            {
              group: ['../sim/*', '../state/*', '../scene/*', '../ui/*'],
              message: 'astro/ depends on nothing else in src.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...RENDER_AND_UI,
            {
              group: ['../state/*', '../scene/*', '../ui/*'],
              message: 'sim/ may only depend on astro/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
);
