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

// TEST MAINTENANCE (B18 T4): fastLinkEnd deliberately differs from stock in one case: a link that closed in bare
// shortcut form `[x]` no longer invalidates earlier `[` openers. Inputs where that matters can no longer be compared
// with stock, so they use this oracle instead: the same rule written the slow way (full re-walk of every earlier part
// after each non-shortcut link, no per-paragraph cursor). See fastLinkEnd.brackets.test.js for the pinned behaviour.
const stockOf = (name) => stock.inlineParsers[stock.inlineNames.indexOf(name)];
const delim = (name, next) => {
    let type = null;
    stockOf(name)({ append: (d) => { type = d.type; return 0; }, char: () => 91 }, next, 0);
    return type;
};
const LinkStartT = delim('Link', 91), ImageStartT = delim('Image', 33);
const naive = stock.configure({ parseInline: [{ name: 'LinkEnd', parse(cx, next, start) {
    if (next !== 93) return -1;
    const { parts } = cx;
    let i = parts.length - 1;
    while (i >= 0 && !(parts[i] && (parts[i].type === LinkStartT || parts[i].type === ImageStartT))) i--;
    if (i < 0) return -1;
    const opener = parts[i];
    const view = Object.create(cx);
    view.parts = parts.slice(i);
    const result = stockOf('LinkEnd')(view, next, start);
    parts.length = i;
    for (const p of view.parts) parts.push(p);
    if (result >= 0 && opener.type === LinkStartT && result !== start + 1) {
        for (let j = 0; j < i; j++) if (parts[j] && parts[j].type === LinkStartT) parts[j].side = 0;
    }
    return result;
} }] });
const sameAsNaive = (text) => expect(dump(fast, text), JSON.stringify(text)).toBe(dump(naive, text));

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
            sameAsNaive(t);
    });
    it('multi-paragraph and multi-line paragraphs', () => {
        same('[a](1)\n[b](2)\n[c](3)\n\n[d](4) [e [f](5)](6)\n\n[g');
    });
    it('deterministic fuzz: 1500 random bracket/paren/link-ish strings give the same trees as the naive oracle', () => {
        let seed = 12345;
        const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
        const alphabet = ['[', ']', '(', ')', '!', 'a', 'b', ' ', '*', '`', '<', '>', '\n', '\\', ':', 'http://x', '"t"', '[r]'];
        for (let i = 0; i < 1500; i++) {
            const n = 1 + Math.floor(rnd() * 24);
            let t = '';
            for (let k = 0; k < n; k++) t += alphabet[Math.floor(rnd() * alphabet.length)];
            sameAsNaive(t);
        }
    });
    it('is a no-op for text without links and for very long unclosed-bracket runs', () => {
        same('just some words\n\nand another paragraph');
        sameAsNaive('['.repeat(2000) + 'x' + ']'.repeat(10));
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
