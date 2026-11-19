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

        // B8: generic ProgIDs (Markdown / Text) can be overwritten by another app, and our uninstall would then delete theirs.
        it('md and markdown share the ProgID NotepadFlux.Markdown, description unchanged', () => {
            for (const ext of ['md', 'markdown']) {
                expect(find(ext).name).toBe('NotepadFlux.Markdown');
                expect(find(ext).description).toBe('Markdown document');
            }
            expect(find('md')).toBe(find('markdown'));
        });
        it('txt has the ProgID NotepadFlux.Text, description unchanged', () => {
            expect(find('txt').name).toBe('NotepadFlux.Text');
            expect(find('txt').description).toBe('Text document');
        });
        it('exactly two associations, no stale generic ProgID', () => {
            expect(list.map((a) => a.name).sort()).toEqual(['NotepadFlux.Markdown', 'NotepadFlux.Text']);
        });
    });
});

// B8: electron-builder writes the open command as `C:\...\Notepad Flux.exe "%1"` (exe path unquoted), which breaks on
// any path with a space-delimited ambiguity. installer.nsh rewrites it, after registerFileAssociations, as `"$appExe" "%1"`.
describe('installer.nsh open command', () => {
    const nsh = readFileSync(join(REPO, 'installer', 'installer.nsh'), 'utf8');
    const macroBody = (name) => {
        const m = new RegExp('^[ \\t]*!macro[ \\t]+' + name + '[ \\t]*$([\\s\\S]*?)^[ \\t]*!macroend', 'm').exec(nsh);
        return m ? m[1] : null;
    };
    // The value token of `WriteRegStr SHCTX "<key>" "" <value>`, decoded from NSIS quoting
    // ('...', "..." with $\" escapes, or `...`) to the string NSIS would write.
    const written = (body, progId) => {
        const key = ('Software\\Classes\\' + progId + '\\shell\\open\\command').replace(/\\/g, '\\\\');
        const re = new RegExp('^[ \\t]*WriteRegStr[ \\t]+SHCTX[ \\t]+(["\'`])' + key + '\\1[ \\t]+(["\'`])\\2[ \\t]+(["\'`])(.*)\\3[ \\t]*$', 'm');
        const m = re.exec(body);
        return m ? m[4].replace(/\$\\(["'`])/g, '$1') : null;
    };

    it('keeps customUnInstall', () => {
        expect(macroBody('customUnInstall')).toMatch(/updater/);
    });
    it('defines !macro customInstall', () => {
        expect(macroBody('customInstall'), 'no !macro customInstall').not.toBeNull();
    });
    it.each(['NotepadFlux.Markdown', 'NotepadFlux.Text'])('customInstall writes "$appExe" "%1" (both quoted) for %s', (id) => {
        const body = macroBody('customInstall') ?? '';
        expect(written(body, id), 'no WriteRegStr SHCTX ...\\' + id + '\\shell\\open\\command "" <value>').toBe('"$appExe" "%1"');
    });
    it('decoder rejects the unquoted form electron-builder emits', () => {
        const bad = '  WriteRegStr SHCTX "Software\\Classes\\NotepadFlux.Text\\shell\\open\\command" "" "$appExe $\\"%1$\\""';
        expect(written(bad, 'NotepadFlux.Text')).toBe('$appExe "%1"');
        expect(written(bad, 'NotepadFlux.Text')).not.toBe('"$appExe" "%1"');
    });
    it('accepts the single-quoted and escaped-double-quoted NSIS styles', () => {
        const k = 'Software\\Classes\\NotepadFlux.Text\\shell\\open\\command';
        expect(written("WriteRegStr SHCTX '" + k + "' '' '\"$appExe\" \"%1\"'", 'NotepadFlux.Text')).toBe('"$appExe" "%1"');
        expect(written('WriteRegStr SHCTX "' + k + '" "" "$\\"$appExe$\\" $\\"%1$\\""', 'NotepadFlux.Text')).toBe('"$appExe" "%1"');
    });
});
