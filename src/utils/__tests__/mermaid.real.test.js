import { describe, it, expect, beforeAll } from 'vitest';
import mermaid from 'mermaid';
import { handleRenderMessage } from '../../mermaidFrame';

// Real Mermaid 12.x under jsdom, driven through the frame's handleRenderMessage (getBBox/getComputedTextLength stubbed: no layout in jsdom).
// What this file used to cover and no longer does: "nothing document-controlled reaches the app DOM while rendering". Mermaid no longer runs in
// the app document at all (it runs in the sandboxed frame), so that guarantee is now proven end to end by packaged e2e MM-9 (zero requests
// to the attacker host, editor + export, and no element with the host in the main document). What stays: a document can't change the theme.
const T = 120000;
beforeAll(() => {
    const P = window.SVGElement.prototype;
    P.getBBox = () => ({ x: 0, y: 0, width: 50, height: 20 });
    P.getComputedTextLength = () => 40;
});

const BODY = 'flowchart TD\n  A[Start] --> B[End]';
const draw = (source) => handleRenderMessage(mermaid, { id: 'nf-real', source, theme: 'default' });

describe('real Mermaid via handleRenderMessage: a document cannot change the theme (light theme)', () => {
    it('baseline renders (guards against vacuous equality below)', async () => {
        const r = await draw(BODY);
        expect(r.error, `render failed: ${r.error}`).toBeUndefined();
        expect(r.svg).toContain('<style');
        expect(r.svg).toContain('Start');
    }, T);

    for (const [name, src] of [
        ['%%{init}%% theme dark', `%%{init: {"theme":"dark"}}%%\n${BODY}`],
        ['%%{init}%% theme forest', `%%{init: {"theme":"forest"}}%%\n${BODY}`],
        ['%%{init}%% darkMode', `%%{init: {"darkMode": true}}%%\n${BODY}`],
        ['frontmatter config theme', `---\nconfig:\n  theme: forest\n---\n${BODY}`],
        ['frontmatter config look handDrawn', `---\nconfig:\n  look: handDrawn\n---\n${BODY}`],
        ['frontmatter config darkMode', `---\nconfig:\n  darkMode: true\n---\n${BODY}`],
    ]) {
        it(`${name}: output equals the same diagram without it`, async () => {
            const a = await draw(BODY);
            const b = await draw(src);
            expect(b.error, `render failed: ${b.error}`).toBeUndefined();
            expect(b.svg).toBe(a.svg);
        }, T);
    }
});
