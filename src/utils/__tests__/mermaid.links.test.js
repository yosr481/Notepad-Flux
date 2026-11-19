import { describe, it, expect, vi } from 'vitest';

vi.mock('../mermaidBridge', () => ({ createMermaidFrame: vi.fn() }));

const IN = '<svg><a xlink:href="https://evil.example" href="javascript:alert(1)" target="_blank" class="node-link" transform="translate(10,20)"><g class="node"><rect width="5" height="5"/></g></a></svg>';

describe('sanitizeMermaidSvg: clickable node wrapper', () => {
    it('<a> becomes a <g> keeping transform and class, children kept, no link attributes', async () => {
        const { sanitizeMermaidSvg } = await import('../mermaid');
        const d = document.createElement('div');
        d.innerHTML = sanitizeMermaidSvg(IN);
        expect(d.querySelector('a')).toBeNull();
        const g = d.querySelector('g.node-link');
        expect(g, 'g.node-link wrapper').not.toBeNull();
        expect(g.getAttribute('transform')).toBe('translate(10,20)');
        expect(g.querySelector(':scope > g.node > rect')).not.toBeNull();
        for (const el of d.querySelectorAll('*')) {
            for (const n of ['href', 'xlink:href', 'target']) expect(el.hasAttribute(n), `${el.tagName} ${n}`).toBe(false);
        }
    });

    it('href="#x" on a non-link element (use) is still kept', async () => {
        const { sanitizeMermaidSvg } = await import('../mermaid');
        const d = document.createElement('div');
        d.innerHTML = sanitizeMermaidSvg('<svg><defs><g id="x"/></defs><use href="#x"/></svg>');
        expect(d.querySelector('use')?.getAttribute('href')).toBe('#x');
    });

    it('only transform/class/id/style are copied from the <a>: xlink:actuate, xlink:show, rel are dropped', async () => {
        const { sanitizeMermaidSvg } = await import('../mermaid');
        const d = document.createElement('div');
        d.innerHTML = sanitizeMermaidSvg('<svg><a xlink:actuate="onLoad" xlink:show="new" rel="noopener" class="node-link" transform="translate(1,2)"><g class="node"><rect width="5" height="5"/></g></a></svg>');
        const g = d.querySelector('g.node-link');
        expect(g, 'g.node-link wrapper').not.toBeNull();
        expect(g.getAttribute('transform')).toBe('translate(1,2)');
        expect([...g.attributes].map((a) => a.name).sort()).toEqual(['class', 'transform']);
    });
});
