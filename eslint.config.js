import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Ignore built artifacts
  globalIgnores(['dist', 'dist-electron']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      // Default to browser globals for the renderer
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Keep noise low pre-merge; still surface issues as warnings
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      // This rule is too strict for some of our effects that sync with external systems
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // Electron main process (Node context)
  {
    files: ['electron/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Allow try/catch wrappers in main process code
      'no-useless-catch': 'off',
    },
  },
  // Tests and setup files (Vitest globals, Node-like environment)
  {
    files: ['src/**/*.{test,spec}.js', 'src/test/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        // Vitest/JSDOM common globals (minimal set we actually use)
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        global: 'readonly',
      },
    },
  },
  // React-refresh rule can be noisy for context modules
  {
    files: ['src/context/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
