import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const build = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).build;

// Guards: app offered by the OS "Open with" / default-app pickers for .md/.txt,
// WITHOUT electron-builder generating a system-wide /usr/share/mime/packages
// XML on Linux (top-level build.fileAssociations emitted a broken glob
// `*.md,markdown` and overrode text/plain + text/markdown comment/icon).
describe('file associations config shape', () => {
    it('has NO top-level build.fileAssociations (Linux MIME XML regression)', () => {
        expect(build.fileAssociations).toBeUndefined();
    });

    it('linux.mimeTypes lists text/markdown and text/plain', () => {
        expect(build.linux.mimeTypes).toEqual(expect.arrayContaining(['text/markdown', 'text/plain']));
    });

    it('linux has no fileAssociations of its own', () => {
        expect(build.linux.fileAssociations).toBeUndefined();
    });

    describe('win.fileAssociations', () => {
        const list = [].concat(build.win?.fileAssociations ?? []);
        const extsOf = (a) => [].concat(a.ext ?? []);
        const find = (ext) => list.find((a) => extsOf(a).includes(ext));

        it('md and markdown map to text/markdown', () => {
            for (const ext of ['md', 'markdown']) {
                expect(find(ext), `no association for .${ext}`).toBeTruthy();
                expect(find(ext).mimeType).toBe('text/markdown');
            }
        });
        it('txt maps to text/plain', () => {
            expect(find('txt'), 'no association for .txt').toBeTruthy();
            expect(find('txt').mimeType).toBe('text/plain');
        });
        it('extensions have no leading dot or comma-joined globs', () => {
            for (const a of list) for (const e of extsOf(a)) expect(e).toMatch(/^[A-Za-z0-9]+$/);
        });
    });
});
