import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: 'electron/main.js',
      },
      {
        entry: 'electron/preload.js',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            // Sandboxed preload must be CommonJS. The package is
            // "type": "module", so vite-plugin-electron's default lib mode emits
            // ESM and the preload fails to load ("Cannot use import statement
            // outside a module"). Bypass lib mode and force a CJS .cjs bundle.
            lib: false,
            rollupOptions: {
              input: 'electron/preload.js',
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
})
