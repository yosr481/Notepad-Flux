import process from 'node:process';
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
const notesFile = pkg.build.releaseInfo.releaseNotesFile;

// Guards: `npm run build` failing on a clean checkout with
// 'cannot find specified resource "release-notes.md"' (file is gitignored).
describe('build -> release notes wiring', () => {
    it('npm lifecycle runs the extractor before `build`', () => {
        expect(pkg.scripts.build).toMatch(/electron-builder/);
        expect(pkg.scripts.prebuild).toMatch(/scripts\/extract-changelog\.js/);
    });

    it('extractor writes exactly the file electron-builder expects', () => {
        const dir = mkdtempSync(join(tmpdir(), 'relnotes-'));
        try {
            copyFileSync(join(REPO, 'CHANGELOG.md'), join(dir, 'CHANGELOG.md'));
            execFileSync('node', [join(REPO, 'scripts', 'extract-changelog.js')], { cwd: dir, stdio: 'pipe' });
            expect(existsSync(join(dir, notesFile))).toBe(true);
            expect(readFileSync(join(dir, notesFile), 'utf8').trim().length).toBeGreaterThan(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
