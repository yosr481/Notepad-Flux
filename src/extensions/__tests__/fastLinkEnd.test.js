import { describe, it, expect } from 'vitest';
import { markdownLanguage } from '@codemirror/lang-markdown';
import { fastLinkEnd } from '../fastLinkEnd';

const stock = markdownLanguage.parser;
const fast = stock.configure(fastLinkEnd);

// Full tree shape including positions, so a different link/no-link decision shows up.
const dump = (parser, text) => {
    const out = [];
    parser.parse(text).iterate({ enter: (n) => { out.push(`${n.name}:${n.from}-${n.to}`); } });
    return out.join(' ');
};
const same = (text) => expect(dump(fast, text), JSON.stringify(text)).toBe(dump(stock, text));

describe('fastLinkEnd: same syntax tree as stock @lezer/markdown', () => {
    it('normal inline links, images, reference links, autolinks, titles', () => {
        for (const t of [
            '[a](http://x.com) text [b](https://y.org "t") end',
            '![alt](img.png) and [![alt](img.png)](http://x)',
            '[ref][r] and [r] and ![img][r]\n\n[r]: http://x "title"',
            '<https://example.com> [a](<b c>) **[bold link](u)** *[em](u)*',
            '[link with `code](x)` inside](u)',
            '- [a](u1)\n- [b](u2)\n\n> [q](u)',
        ]) same(t);
    });
    it('nested links: a link inside a link text invalidates the outer opener (CommonMark)', () => {
        for (const t of ['[outer [inner](i) tail](o)', '[a [b [c](c) d](b) e](a)', '[[x](y)](z)', '[x [y](y) [z](z)](w)']) same(t);
    });
    it('images inside links keep the outer link valid (only links invalidate)', () => {
        for (const t of ['[![a](i)](u)', '[text ![a](i) more](u)', '![a [b](c)](d)', '[![a][r]][s]\n\n[r]: x\n[s]: y']) same(t);
    });
    it('hostile bracket soup: unclosed [, [[x]], stray ], empty and adjacent forms', () => {
        for (const t of ['[', ']', '[[x]]', '[[x]](y)', '[x', 'x]', '[x](', '[x](y', '[](a)', '[][]', '[]()', '![', '![]', '![](', '[x][', '[[[[[a]]]]]', '[a]]]](b)', '[a](b)](c)', '[[a](b)', '[a](b)]',
            '[x](y) [z', '[z [x](y)', '\\[x](y)', '[x\\](y)', '[x](y\\)', '`[x](y)`', '[`x`](y)', '[x]\n(y)', '[x](y\nz)', '[x]: y\n[x]', '![x]\n\n[x]: y'])
            same(t);
    });
    it('multi-paragraph and multi-line paragraphs', () => {
        same('[a](1)\n[b](2)\n[c](3)\n\n[d](4) [e [f](5)](6)\n\n[g');
    });
    it('deterministic fuzz: 1500 random bracket/paren/link-ish strings give identical trees', () => {
        let seed = 12345;
        const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
        const alphabet = ['[', ']', '(', ')', '!', 'a', 'b', ' ', '*', '`', '<', '>', '\n', '\\', ':', 'http://x', '"t"', '[r]'];
        for (let i = 0; i < 1500; i++) {
            const n = 1 + Math.floor(rnd() * 24);
            let t = '';
            for (let k = 0; k < n; k++) t += alphabet[Math.floor(rnd() * alphabet.length)];
            same(t);
        }
    });
    it('is a no-op for text without links and for very long unclosed-bracket runs', () => {
        same('just some words\n\nand another paragraph');
        same('['.repeat(2000) + 'x' + ']'.repeat(10));
    });
});

describe('fastLinkEnd: linear in the number of links per paragraph', () => {
    it('a one-paragraph document with many links parses much faster than stock (regression guard for the O(n^2) LinkEnd)', () => {
        const n = 3000;
        const text = Array.from({ length: n }, (_, i) => `line ${i} **bold** [link](https://example.com/${i})`).join('\n');
        const time = (p) => { const t = performance.now(); p.parse(text); return performance.now() - t; };
        time(fast);                                    // warm up
        const f = Math.min(time(fast), time(fast)), s = time(stock);
        expect(f, `fast ${f.toFixed(0)}ms vs stock ${s.toFixed(0)}ms`).toBeLessThan(s * 0.6);
    }, 60000);
    it('and produces the same tree for that big paragraph', () => {
        const text = Array.from({ length: 800 }, (_, i) => `l ${i} [a](u${i}) [b [c](d)](e) ![i](p)`).join('\n');
        expect(dump(fast, text)).toBe(dump(stock, text));
    });
});
