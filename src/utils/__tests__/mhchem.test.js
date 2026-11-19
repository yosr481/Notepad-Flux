import { describe, it, expect, vi } from 'vitest';

// mhchem arrows need the font extension; without it MathJax emits missing-glyph <text> with a private-use char.
const fresh = async () => { vi.resetModules(); return import('../math'); };
const PUA = /[-]/;

describe('renderTex: mhchem', () => {
    it('ordinary \\ce{H2O} still renders as svg paths', async () => {
        const { renderTex } = await fresh();
        const out = await renderTex('\\ce{H2O}', { display: false });
        expect(out).toContain('<svg');
        expect(out).not.toContain('data-mjx-error');
    }, 60000);

    for (const [tex, display] of [['\\ce{2H2 + O2 -> 2H2O}', true], ['\\ce{A <=> B}', false]]) {
        it(`${tex} has no missing-glyph <text> and no U+E4xx char`, async () => {
            const { renderTex } = await fresh();
            const out = await renderTex(tex, { display });
            expect(out).toContain('<svg');
            expect(out).not.toContain('<text');
            expect(out).not.toMatch(PUA);
        }, 60000);
    }
});
