import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { filtersForName, OPEN_FILTERS } from '../dialogFilters.js';

const ALL = { name: 'All Files', extensions: ['*'] };

describe('filtersForName (P2-pdf save dialog)', () => {
    it('pdf → PDF Document + All Files', () => {
        expect(filtersForName('report.pdf')).toEqual([
            { name: 'PDF Document', extensions: ['pdf'] }, ALL,
        ]);
    });
    it('is case-insensitive on the extension', () => {
        expect(filtersForName('R.PDF')[0].name).toBe('PDF Document');
    });
    it('html / htm → HTML Document', () => {
        expect(filtersForName('a.html')[0].extensions).toEqual(['html', 'htm']);
        expect(filtersForName('a.htm')[0].name).toBe('HTML Document');
    });
    it('md / markdown → Markdown', () => {
        expect(filtersForName('n.md')[0].name).toBe('Markdown');
        expect(filtersForName('n.markdown')[0].name).toBe('Markdown');
    });
    it('txt → Text', () => {
        expect(filtersForName('n.txt')[0].name).toBe('Text');
    });
    it('unknown extension → All Files only', () => {
        expect(filtersForName('n.xyz')).toEqual([ALL]);
    });
    it('no extension → All Files only', () => {
        expect(filtersForName('README')).toEqual([ALL]);
    });
    it('trailing dot → All Files only', () => {
        expect(filtersForName('weird.')).toEqual([ALL]);
    });
    it('non-string → All Files only', () => {
        expect(filtersForName(null)).toEqual([ALL]);
        expect(filtersForName(undefined)).toEqual([ALL]);
        expect(filtersForName(42)).toEqual([ALL]);
    });
});

describe('OPEN_FILTERS (read-file open dialog)', () => {
    it('is a non-empty array of exactly 3 entries', () => {
        expect(Array.isArray(OPEN_FILTERS)).toBe(true);
        expect(OPEN_FILTERS).toHaveLength(3);
    });
    it('entry 0 is Markdown covering md + markdown', () => {
        expect(OPEN_FILTERS[0]).toEqual({
            name: 'Markdown', extensions: ['md', 'markdown'],
        });
    });
    it('entry 1 is Text covering txt', () => {
        expect(OPEN_FILTERS[1].name).toBe('Text');
        expect(OPEN_FILTERS[1].extensions).toContain('txt');
    });
    it('some entry covers txt', () => {
        expect(OPEN_FILTERS.some((f) => f.extensions.includes('txt'))).toBe(true);
    });
    it('last entry is the All Files ["*"] catch-all', () => {
        expect(OPEN_FILTERS[OPEN_FILTERS.length - 1]).toEqual({
            name: 'All Files', extensions: ['*'],
        });
    });
    it('every entry has a string name and a non-empty extensions array', () => {
        for (const f of OPEN_FILTERS) {
            expect(typeof f.name).toBe('string');
            expect(f.name.length).toBeGreaterThan(0);
            expect(Array.isArray(f.extensions)).toBe(true);
            expect(f.extensions.length).toBeGreaterThan(0);
        }
    });
});

describe('electron/main.js save-file handler (source check)', () => {
    const src = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '..', 'main.js'), 'utf-8'
    );
    it('imports filtersForName from ./dialogFilters', () => {
        expect(src).toMatch(/from\s+['"]\.\/dialogFilters(\.js)?['"]/);
    });
    it('no longer hardcodes the Markdown-only filter in the save handler', () => {
        // the read-file OPEN dialog keeps its Markdown filter; only assert the
        // save handler now derives filters + writes binary
        expect(src).toMatch(/filters:\s*filtersForName\(suggestedName\)/);
        expect(src).toMatch(/Buffer\.from\(content\)/);
    });
});
