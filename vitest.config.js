import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.js',
        css: { include: [/calloutExport\.css/] }, // vitest blanks plain css (also ?raw) unless included
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{js,jsx}'],
            exclude: [
                'src/main.jsx',
                'src/test/**',
                'src/mockData.js',
                '**/*.d.ts',
                '**/*.config.js'
            ]
        },
    },
});
