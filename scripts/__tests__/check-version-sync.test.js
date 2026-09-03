import process from 'node:process';
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, '..', 'check-version-sync.js');
const REPO = join(HERE, '..', '..');

describe('check-version-sync.js', () => {
    it('passes on the current repo (package.json and lock are in sync)', () => {
        const out = execFileSync('node', [SCRIPT], { cwd: REPO, encoding: 'utf8', env: { ...process.env, GITHUB_REF_NAME: '' } });
        expect(out).toMatch(/Version sync OK/);
    });

    it('fails when the tag does not match package.json version', () => {
        expect(() =>
            execFileSync('node', [SCRIPT], { cwd: REPO, encoding: 'utf8', env: { ...process.env, GITHUB_REF_NAME: 'v99.99.99' } })
        ).toThrow();
    });
});
