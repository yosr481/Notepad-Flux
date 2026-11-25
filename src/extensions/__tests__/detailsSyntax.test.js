import { describe, it, expect } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Subscript, Superscript } from '@lezer/markdown';
import { codeLanguages } from '../codeLanguages';
import { fastLinkEnd } from '../fastLinkEnd';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { emojiSyntax } from '../emojiSyntax';
import { INDEXED_NODES, nodesOf } from '../nodeIndex';
import { findDetails } from '../detailsSyntax';
import { mkState, countTreeWalks } from './selectionReuseHelpers';

// T1 of Docs/internal/details-spec.md. findDetails(state) -> Region[] (outer before inner, document order).
// Region = { from, headerTo, label, open, bodyFrom, bodyTo, closeFrom, closeTo }, exactly these keys.
// Offsets come from doc.line(n); line numbers are 1-based positions in the fixture's line array.

const lang = markdown({ base: markdownLanguage, codeLanguages, extensions: [fastLinkEnd, mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax] });
const mk = (lines, sep = '\n') => mkState(lines.join(sep), [lang]);
const find = (lines, sep) => findDetails(mk(lines, sep));

// Expected region from 1-based line numbers: open line, header's last line, close line.
const reg = (state, { open: o, header: h, close: c, label = 'Details', isOpen = false }) => {
    const d = state.doc;
    const emptyBody = c === h + 1;
    return {
        from: d.line(o).from,
        headerTo: d.line(h).to,
        label,
        open: isOpen,
        bodyFrom: d.line(h + 1).from,
        bodyTo: emptyBody ? d.line(h).to : d.line(c - 1).to,
        closeFrom: d.line(c).from,
        closeTo: d.line(c).to,
    };
};
const check = (lines, spec, sep) => {
    const state = mk(lines, sep);
    expect(findDetails(state)).toEqual([reg(state, spec)]);
};

describe('nodeIndex: HTMLBlock', () => {
    it('INDEXED_NODES includes HTMLBlock', () => {
        expect(INDEXED_NODES).toContain('HTMLBlock');
    });

    it('nodesOf(state, "HTMLBlock") lists blocks in document order, nested ones too', () => {
        const state = mk(['<div>a</div>', '', '> <div>q</div>', '', '<div>b</div>']);
        const blocks = nodesOf(state, 'HTMLBlock');
        expect(blocks).toHaveLength(3);
        expect(blocks.map((b) => state.doc.sliceString(b.from, b.to))).toEqual(['<div>a</div>', '<div>q</div>', '<div>b</div>']);
    });
});

describe('findDetails: no tree walk of its own', () => {
    const doc = ['<details>', '<summary>S</summary>', '', 'body', '', '</details>'];

    it('index warm -> 0 tree walks', () => {
        const state = mk(doc);
        nodesOf(state, 'HTMLBlock');
        expect(countTreeWalks(state, () => findDetails(state))).toBe(0);
    });

    it('index cold -> at most the one shared index walk', () => {
        const state = mk(doc);
        expect(countTreeWalks(state, () => findDetails(state))).toBeLessThanOrEqual(1);
    });
});

describe('findDetails: basic shapes', () => {
    it('empty doc and doc without details -> []', () => {
        expect(find([''])).toEqual([]);
        expect(find(['# Title', '', 'text', '', '<div>x</div>'])).toEqual([]);
    });

    it('blank-line form with markdown body', () => {
        check(['<details>', '<summary>Sum</summary>', '', 'Body **md**', '', '</details>'],
            { open: 1, header: 2, close: 6, label: 'Sum' });
    });

    it('no-blank-line form: one HTMLBlock, raw body', () => {
        const lines = ['<details>', '<summary>Sum</summary>', 'raw body', 'more', '</details>'];
        expect(nodesOf(mk(lines), 'HTMLBlock')).toHaveLength(1);
        check(lines, { open: 1, header: 2, close: 5, label: 'Sum' });
    });

    it('region has exactly the 8 documented keys', () => {
        const [r] = find(['<details>', '<summary>S</summary>', '', 'b', '', '</details>']);
        expect(Object.keys(r).sort()).toEqual(['bodyFrom', 'bodyTo', 'closeFrom', 'closeTo', 'from', 'headerTo', 'label', 'open']);
    });

    it('text before and after the region is untouched; region spans only its own lines', () => {
        const lines = ['# T', '', '<details>', '<summary>S</summary>', '', 'b', '', '</details>', '', 'after'];
        const state = mk(lines);
        const [r] = findDetails(state);
        expect(r.from).toBe(state.doc.line(3).from);
        expect(r.closeTo).toBe(state.doc.line(8).to);
        expect(findDetails(state)).toHaveLength(1);
    });

    it('two sibling regions come back in document order', () => {
        const lines = ['<details>', '<summary>A</summary>', '', 'a', '', '</details>', '', '<details>', '<summary>B</summary>', '', 'b', '', '</details>'];
        const state = mk(lines);
        const rs = findDetails(state);
        expect(rs.map((r) => r.label)).toEqual(['A', 'B']);
        expect(rs).toEqual([
            reg(state, { open: 1, header: 2, close: 6, label: 'A' }),
            reg(state, { open: 8, header: 9, close: 13, label: 'B' }),
        ]);
    });

    it('details inside a fenced code block -> none', () => {
        expect(find(['```html', '<details>', '<summary>S</summary>', '', 'b', '', '</details>', '```'])).toEqual([]);
    });
});

describe('findDetails: open attribute', () => {
    it.each([
        ['<details open>', true],
        ['<details class="x" open>', true],
        ['<DETAILS OPEN="">', true],
        ['<details open="">', true],
        ['<details>', false],
        ['<details opener>', false],
        ['<details class="x">', false],
    ])('%s -> open %s', (tag, expected) => {
        const [r] = find([tag, '<summary>S</summary>', '', 'b', '', '</details>']);
        expect(r.open).toBe(expected);
    });
});

describe('findDetails: summary and label', () => {
    it('summary on the opening line: header is the opening line', () => {
        check(['<details><summary>S</summary>', '', 'b', '', '</details>'], { open: 1, header: 1, close: 5, label: 'S' });
    });

    it('summary on the next line: header ends on the summary line', () => {
        check(['<details>', '<summary>S</summary>', '', 'b', '', '</details>'], { open: 1, header: 2, close: 6, label: 'S' });
    });

    it('summary on a later line of the same HTMLBlock (third line)', () => {
        check(['<details>', '<div>x</div>', '<summary>S</summary>', 'raw', '</details>'], { open: 1, header: 3, close: 5, label: 'S' });
    });

    it('first of two summaries wins', () => {
        check(['<details>', '<summary>One</summary>', '<summary>Two</summary>', 'raw', '</details>'], { open: 1, header: 2, close: 5, label: 'One' });
    });

    it('no summary -> label "Details", header is the opening line', () => {
        check(['<details>', '', 'b', '', '</details>'], { open: 1, header: 1, close: 5 });
    });

    it('empty summary -> "Details", header still ends on the summary line', () => {
        check(['<details>', '<summary></summary>', '', 'b', '', '</details>'], { open: 1, header: 2, close: 6 });
    });

    it('whitespace-only summary -> "Details"', () => {
        const [r] = find(['<details>', '<summary>   </summary>', '', 'b', '', '</details>']);
        expect(r.label).toBe('Details');
    });

    it('label is trimmed', () => {
        const [r] = find(['<details>', '<summary>  Hi there  </summary>', '', 'b', '', '</details>']);
        expect(r.label).toBe('Hi there');
    });

    it('tags removed and entities decoded', () => {
        check(['<details>', '<summary><b>A</b> &amp; B</summary>', '', 'b', '', '</details>'], { open: 1, header: 2, close: 6, label: 'A & B' });
    });

    it('summary spanning lines does not match: label "Details", header is the opening line, summary lines fall in the body', () => {
        check(['<details>', '<summary>', 'Multi', '</summary>', '', 'b', '', '</details>'], { open: 1, header: 1, close: 8 });
    });

    it('a summary in a later HTMLBlock (after a blank line) is not the header summary', () => {
        check(['<details>', '', '<summary>S</summary>', '', 'b', '', '</details>'], { open: 1, header: 1, close: 7 });
    });
});

describe('findDetails: body and offsets', () => {
    it('empty body, no blank lines: bodyFrom === closeFrom, bodyTo === headerTo', () => {
        const state = mk(['<details>', '<summary>S</summary>', '</details>']);
        const [r] = findDetails(state);
        expect(r.bodyFrom).toBe(r.closeFrom);
        expect(r.bodyTo).toBe(r.headerTo);
        expect(r).toEqual(reg(state, { open: 1, header: 2, close: 3, label: 'S' }));
    });

    it('empty body without summary: same convention', () => {
        const state = mk(['<details>', '</details>']);
        const [r] = findDetails(state);
        expect(r.bodyFrom).toBe(r.closeFrom);
        expect(r.bodyTo).toBe(r.headerTo);
        expect(r.bodyTo).toBe(state.doc.line(1).to);
    });

    it('one blank line between header and close is a one-line body (bodyFrom === bodyTo)', () => {
        const state = mk(['<details>', '<summary>S</summary>', '', '</details>']);
        const [r] = findDetails(state);
        expect(r.bodyFrom).toBe(state.doc.line(3).from);
        expect(r.bodyTo).toBe(state.doc.line(3).to);
        expect(r.bodyFrom).toBe(r.bodyTo);
    });

    it('body runs from the line after the header to the end of the line before the close', () => {
        const state = mk(['<details>', '<summary>S</summary>', '', 'l1', 'l2', '', '</details>']);
        const [r] = findDetails(state);
        expect(r.bodyFrom).toBe(state.doc.line(3).from);
        expect(r.bodyTo).toBe(state.doc.line(6).to);
    });

    it('lines of the opening HTMLBlock after the summary line belong to the body', () => {
        const state = mk(['<details>', '<summary>S</summary>', 'raw1', 'raw2', '</details>']);
        const [r] = findDetails(state);
        expect(r.headerTo).toBe(state.doc.line(2).to);
        expect(r.bodyFrom).toBe(state.doc.line(3).from);
        expect(r.bodyTo).toBe(state.doc.line(4).to);
    });
});

describe('findDetails: closing line', () => {
    it.each([
        ['  </details>'],
        ['</details>  '],
        ['  </details>  '],
        ['</DETAILS>'],
        ['</Details>'],
    ])('%j counts as a closing line', (close) => {
        const state = mk(['<details>', '<summary>S</summary>', '', 'b', '', close]);
        const [r] = findDetails(state);
        expect(r.closeFrom).toBe(state.doc.line(6).from);
        expect(r.closeTo).toBe(state.doc.line(6).to);
    });

    it('closing tag followed by other text on its line is not a closing line -> unmatched', () => {
        expect(find(['<details>', '<summary>S</summary>', '', 'b', '', '</details> trailing'])).toEqual([]);
    });

    it('stray closing is ignored (before, between, after)', () => {
        const lines = ['</details>', '', '<details>', '<summary>S</summary>', '', 'b', '', '</details>', '', '</details>'];
        const state = mk(lines);
        expect(findDetails(state)).toEqual([reg(state, { open: 3, header: 4, close: 8, label: 'S' })]);
    });

    it('only a stray closing -> none', () => {
        expect(find(['text', '', '</details>'])).toEqual([]);
    });
});

describe('findDetails: unmatched, one-line, lookalikes', () => {
    it('unmatched opening -> no region', () => {
        expect(find(['<details>', '<summary>S</summary>', '', 'body'])).toEqual([]);
    });

    it('unmatched outer with a matched inner -> only the inner region', () => {
        const lines = ['<details>', '<summary>Outer</summary>', '', '<details>', '<summary>Inner</summary>', '', 'x', '', '</details>'];
        const state = mk(lines);
        expect(findDetails(state)).toEqual([reg(state, { open: 4, header: 5, close: 9, label: 'Inner' })]);
    });

    it('one-line form -> none', () => {
        expect(find(['<details><summary>S</summary>body</details>'])).toEqual([]);
        expect(find(['<details>body</details>'])).toEqual([]);
    });

    it('a one-line form does not disturb pairing of a real region around it', () => {
        const lines = ['<details>', '<summary>Outer</summary>', '', '<details><summary>x</summary>y</details>', '', 'b', '', '</details>'];
        const state = mk(lines);
        expect(findDetails(state)).toEqual([reg(state, { open: 1, header: 2, close: 8, label: 'Outer' })]);
    });

    it.each([['<detailsx>'], ['<details-foo>']])('%s is not an opening', (tag) => {
        expect(find([tag, '<summary>S</summary>', '', 'b', '', '</details>'])).toEqual([]);
    });
});

describe('findDetails: nesting', () => {
    it('blank-line nesting: outer before inner, correct pairing', () => {
        const lines = ['<details>', '<summary>Outer</summary>', '', '<details>', '<summary>Inner</summary>', '', 'x', '', '</details>', '', '</details>'];
        const state = mk(lines);
        expect(findDetails(state)).toEqual([
            reg(state, { open: 1, header: 2, close: 11, label: 'Outer' }),
            reg(state, { open: 4, header: 5, close: 9, label: 'Inner' }),
        ]);
    });

    it('nesting inside a single HTMLBlock (no blank lines)', () => {
        const lines = ['<details>', '<summary>Outer</summary>', '<details>', '<summary>Inner</summary>', 'x', '</details>', '</details>'];
        const state = mk(lines);
        expect(findDetails(state)).toEqual([
            reg(state, { open: 1, header: 2, close: 7, label: 'Outer' }),
            reg(state, { open: 3, header: 4, close: 6, label: 'Inner' }),
        ]);
    });

    it('outer without summary does not steal the summary of a nested one (same HTMLBlock)', () => {
        const lines = ['<details>', '<details>', '<summary>Inner</summary>', 'x', '</details>', '</details>'];
        const state = mk(lines);
        expect(findDetails(state)).toEqual([
            reg(state, { open: 1, header: 1, close: 6 }),
            reg(state, { open: 2, header: 3, close: 5, label: 'Inner' }),
        ]);
    });

    it('summary may carry attributes (any case); <summaryx> is not a summary', () => {
        check(['<details>', '<summary class="x">Hi</summary>', 'b', '</details>'], { open: 1, header: 2, close: 4, label: 'Hi' });
        check(['<details>', '<SUMMARY title="t">Hi</SUMMARY>', 'b', '</details>'], { open: 1, header: 2, close: 4, label: 'Hi' });
        check(['<details>', '<summaryx>Hi</summary>', 'b', '</details>'], { open: 1, header: 1, close: 4 });
    });

    it('two siblings inside an outer: order is outer, first, second', () => {
        const lines = ['<details>', '<summary>O</summary>', '',
            '<details>', '<summary>A</summary>', '', 'a', '', '</details>', '',
            '<details>', '<summary>B</summary>', '', 'b', '', '</details>', '',
            '</details>'];
        const state = mk(lines);
        expect(findDetails(state).map((r) => r.label)).toEqual(['O', 'A', 'B']);
        expect(findDetails(state)[0].closeFrom).toBe(state.doc.line(18).from);
    });

    it('each nested region keeps its own open flag', () => {
        const lines = ['<details open>', '<summary>O</summary>', '', '<details>', '<summary>I</summary>', '', 'x', '', '</details>', '', '</details>'];
        expect(find(lines).map((r) => r.open)).toEqual([true, false]);
    });
});

describe('findDetails: containers and indentation (v1 limits)', () => {
    it('inside a blockquote -> none', () => {
        expect(find(['> <details>', '> <summary>S</summary>', '>', '> body', '>', '> </details>'])).toEqual([]);
    });

    it('inside a list item -> none', () => {
        expect(find(['- <details>', '  <summary>S</summary>', '', '  body', '', '  </details>'])).toEqual([]);
        expect(find(['1. <details>', '   <summary>S</summary>', '', '   body', '', '   </details>'])).toEqual([]);
    });

    it('a closing line inside a blockquote does not close a document-level opening', () => {
        expect(find(['<details>', '<summary>S</summary>', '', 'b', '', '> </details>'])).toEqual([]);
    });

    it('a document-level region next to a quoted one: only the document-level one counts', () => {
        const lines = ['> <details>', '> <summary>Q</summary>', '>', '> </details>', '', '<details>', '<summary>D</summary>', '', 'b', '', '</details>'];
        const state = mk(lines);
        expect(findDetails(state)).toEqual([reg(state, { open: 6, header: 7, close: 11, label: 'D' })]);
    });

    it.each([[1], [2], [3]])('%i-space indented opening counts; from is the line start (indent included)', (n) => {
        const pad = ' '.repeat(n);
        const state = mk([pad + '<details>', pad + '<summary>S</summary>', '', 'b', '', '</details>']);
        const [r] = findDetails(state);
        expect(r).toEqual(reg(state, { open: 1, header: 2, close: 6, label: 'S' }));
        expect(r.from).toBe(0);
    });

    it('4-space indented opening is code -> none', () => {
        expect(find(['    <details>', '    <summary>S</summary>', '', 'b', '', '</details>'])).toEqual([]);
    });
});

describe('findDetails: line endings', () => {
    it('CRLF doc gives the same regions as LF (offsets from doc.line)', () => {
        const lines = ['<details open>', '<summary>S</summary>', '', 'Body', '', '</details>'];
        const crlf = mk(lines, '\r\n');
        expect(findDetails(crlf)).toEqual([reg(crlf, { open: 1, header: 2, close: 6, label: 'S', isOpen: true })]);
    });

    it('CRLF no-blank form and nesting', () => {
        const lines = ['<details>', '<summary>O</summary>', '<details>', '<summary>I</summary>', 'x', '</details>', '</details>'];
        const state = mk(lines, '\r\n');
        expect(findDetails(state)).toEqual([
            reg(state, { open: 1, header: 2, close: 7, label: 'O' }),
            reg(state, { open: 3, header: 4, close: 6, label: 'I' }),
        ]);
    });
});
