import { describe, it, expect } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { mathSyntax } from '../mathSyntax';
import {
    footnoteSyntax, scanFootnoteRef, scanInlineFootnote, scanFootnoteDef, INLINE_FOOTNOTE_MAX,
} from '../footnoteSyntax';

// Spec: Docs/internal/footnotes-spec.md ("Syntax", "Modules and public API").
// Pinned choices where the spec is silent:
//  - FootnoteDefinition.from = the `[` (after any indent); .to = end of its last content line
//    (for an empty `[^1]:` that is just after the `:`).
//  - The first-line Paragraph starts at the first non-space char after `]:`; empty text -> no Paragraph.
//  - Scanner `label` is the raw text (case kept); `content` of an inline note is raw, unparsed text.

const parser = markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax] }).language.parser;
const plainParser = markdown({ base: markdownLanguage, extensions: [footnoteSyntax] }).language.parser;

const nodes = (doc, p = parser) => {
    const out = [];
    p.parse(doc).iterate({
        enter: (n) => { out.push({ name: n.name, from: n.from, to: n.to, parent: n.node.parent && n.node.parent.name }); },
    });
    return out;
};
const named = (doc, name, p = parser) => nodes(doc, p).filter((n) => n.name === name);
const span = (n) => [n.from, n.to];
const spans = (doc, name) => named(doc, name).map(span);
const noFootnote = (doc) =>
    expect(nodes(doc).filter((n) => /^(Inline)?Footnote/.test(n.name))).toEqual([]);

describe('footnoteSyntax: FootnoteReference', () => {
    it('parses [^1] with exact ref, mark and label spans', () => {
        const doc = 'a [^1] b';
        expect(spans(doc, 'FootnoteReference')).toEqual([[2, 6]]);
        expect(spans(doc, 'FootnoteMark')).toEqual([[2, 4], [5, 6]]);
        expect(spans(doc, 'FootnoteLabel')).toEqual([[4, 5]]);
    });

    it('marks and label are children of the reference', () => {
        const doc = '[^note]';
        expect(named(doc, 'FootnoteMark').map((n) => n.parent)).toEqual(['FootnoteReference', 'FootnoteReference']);
        expect(named(doc, 'FootnoteLabel')[0].parent).toBe('FootnoteReference');
    });

    it('label excludes the caret: [^abc]', () => {
        expect(spans('[^abc]', 'FootnoteLabel')).toEqual([[2, 5]]);
    });

    it('does not also produce a Link', () => {
        expect(named('a [^1] b', 'Link')).toEqual([]);
        expect(named('[^1]', 'Link')).toEqual([]);
    });

    it('[^1](http://x): reference, then the parens are plain text (no Link, no URL)', () => {
        const doc = '[^1](http://x)';
        expect(spans(doc, 'FootnoteReference')).toEqual([[0, 4]]);
        expect(named(doc, 'Link')).toEqual([]);
        expect(named(doc, 'URL')).toEqual([]);
    });

    it('finds two refs on one line', () => {
        expect(spans('x[^1] and [^2].', 'FootnoteReference')).toEqual([[1, 5], [10, 14]]);
    });

    it('ref at line start without colon is a reference inside a Paragraph, not a definition', () => {
        const doc = '[^1] text';
        expect(spans(doc, 'FootnoteReference')).toEqual([[0, 4]]);
        expect(named(doc, 'FootnoteReference')[0].parent).toBe('Paragraph');
        expect(named(doc, 'FootnoteDefinition')).toEqual([]);
    });

    it('works around Hebrew text', () => {
        const doc = 'שלום [^א1] עולם';
        expect(spans(doc, 'FootnoteReference')).toEqual([[5, 10]]);
        expect(spans(doc, 'FootnoteLabel')).toEqual([[7, 9]]);
    });

    it('accepts punctuation, digits and case in labels', () => {
        for (const l of ['Note', 'a-b_c', '1.2', 'x:y', '!', '^']) {
            expect(named(`[^${l}]`, 'FootnoteReference')).toHaveLength(1);
        }
    });

    it('accepts a 999-char label, rejects 1000', () => {
        expect(named(`[^${'a'.repeat(999)}]`, 'FootnoteReference')).toHaveLength(1);
        noFootnote(`[^${'a'.repeat(1000)}]`);
    });

    it('is not a footnote: empty label [^]', () => noFootnote('a [^] b'));
    it('is not a footnote: label with a space [^a b]', () => noFootnote('[^a b]'));
    it('is not a footnote: leading space [^ a]', () => noFootnote('[^ a]'));
    it('is not a footnote: label with a tab', () => noFootnote('[^a\tb]'));
    it('is not a footnote: label spanning a newline', () => noFootnote('[^a\nb]'));
    it('is not a footnote: label containing [', () => noFootnote('[^a[b]'));
    it('is not a footnote: unclosed [^1', () => noFootnote('[^1 and more'));
    it('is not a footnote: escaped \\[^1]', () => noFootnote('\\[^1]'));

    it('does not treat [ ^1] or [^ ] as footnotes', () => {
        noFootnote('[ ^1]');
        noFootnote('[^ ]');
    });

    it('works inside emphasis, strong and link text', () => {
        expect(named('*a [^1] b*', 'FootnoteReference')).toHaveLength(1);
        expect(named('**a [^1]**', 'FootnoteReference')).toHaveLength(1);
        expect(named('[see [^1]](http://x)', 'FootnoteReference')).toHaveLength(1);
    });

    it('works in a list item and a table cell', () => {
        expect(named('- item [^1]', 'FootnoteReference')).toHaveLength(1);
        expect(named('| a | b [^1] |\n|---|---|\n| c | d |', 'FootnoteReference')).toHaveLength(1);
    });

    it('does not touch a normal link or reference link', () => {
        expect(named('[a](http://x)', 'Link')).toHaveLength(1);
        expect(named('[a][b]\n\n[b]: http://x', 'Link')).toHaveLength(1);
        noFootnote('[a](http://x) [b]');
    });
});

describe('footnoteSyntax: InlineFootnote', () => {
    it('parses ^[note] with exact spans: marks ^[ and ]', () => {
        const doc = 'a ^[note] b';
        expect(spans(doc, 'InlineFootnote')).toEqual([[2, 9]]);
        expect(spans(doc, 'FootnoteMark')).toEqual([[2, 4], [8, 9]]);
        expect(named(doc, 'FootnoteMark').map((n) => n.parent)).toEqual(['InlineFootnote', 'InlineFootnote']);
    });

    it('has no FootnoteLabel', () => {
        expect(named('^[note]', 'FootnoteLabel')).toEqual([]);
    });

    it('parses inline markdown inside: Emphasis in ^[a *b* c]', () => {
        const doc = '^[a *b* c]';
        expect(spans(doc, 'InlineFootnote')).toEqual([[0, 10]]);
        expect(spans(doc, 'Emphasis')).toEqual([[4, 7]]);
        expect(named(doc, 'Emphasis')[0].parent).toBe('InlineFootnote');
    });

    it('parses code, link and strong inside', () => {
        expect(named('^[use `x` here]', 'InlineCode')).toHaveLength(1);
        expect(named('^[see [a](http://x)]', 'Link')).toHaveLength(1);
        expect(named('^[**big**]', 'StrongEmphasis')).toHaveLength(1);
    });

    it('a labelled ref inside an inline note is still a FootnoteReference', () => {
        const doc = '^[see [^1]]';
        expect(spans(doc, 'InlineFootnote')).toEqual([[0, 11]]);
        expect(spans(doc, 'FootnoteReference')).toEqual([[6, 10]]);
    });

    it('balances nested brackets: ^[see [a] here] ends at the last ]', () => {
        const doc = 'x ^[see [a] here] y';
        expect(spans(doc, 'InlineFootnote')).toEqual([[2, 17]]);
    });

    it('escaped \\] does not close the note', () => {
        const doc = '^[a \\] b] c';
        expect(spans(doc, 'InlineFootnote')).toEqual([[0, 9]]);
    });

    it('may span lines within one paragraph', () => {
        const doc = 'a ^[one\ntwo] b';
        expect(spans(doc, 'InlineFootnote')).toEqual([[2, 12]]);
    });

    it('never spans a blank line', () => {
        noFootnote('a ^[one\n\ntwo] b');
        noFootnote('a ^[one\n  \ntwo] b');
    });

    it('two inline notes on one line', () => {
        expect(spans('^[a] and ^[b]', 'InlineFootnote')).toEqual([[0, 4], [9, 13]]);
    });

    it('inline note and ref on one line', () => {
        const doc = '^[a][^1]';
        expect(spans(doc, 'InlineFootnote')).toEqual([[0, 4]]);
        expect(spans(doc, 'FootnoteReference')).toEqual([[4, 8]]);
    });

    it('Hebrew content', () => {
        expect(spans('שלום ^[הערה] עולם', 'InlineFootnote')).toEqual([[5, 12]]);
    });

    it('is not a footnote: empty ^[]', () => noFootnote('a ^[] b'));
    it('is not a footnote: unclosed ^[abc', () => noFootnote('a ^[abc'));
    it('is not a footnote: unbalanced ^[a [b] (inner [ never closed)', () => noFootnote('^[a [b]'));
    it('is not a footnote: escaped \\^[x]', () => noFootnote('\\^[x]'));
    it('is not a footnote: ^ then space then [x]', () => noFootnote('^ [x]'));

    it('longer than INLINE_FOOTNOTE_MAX is not a footnote; at the limit it is', () => {
        expect(INLINE_FOOTNOTE_MAX).toBe(2000);
        noFootnote('^[' + 'a'.repeat(INLINE_FOOTNOTE_MAX + 1) + ']');
        expect(named('^[' + 'a'.repeat(INLINE_FOOTNOTE_MAX) + ']', 'InlineFootnote')).toHaveLength(1);
    });
});

describe('footnoteSyntax: FootnoteDefinition', () => {
    it('parses [^1]: text with exact spans', () => {
        const doc = '[^1]: hello';
        expect(spans(doc, 'FootnoteDefinition')).toEqual([[0, 11]]);
        expect(spans(doc, 'FootnoteMark')).toEqual([[0, 2], [3, 5]]);
        expect(spans(doc, 'FootnoteLabel')).toEqual([[2, 3]]);
        expect(spans(doc, 'Paragraph')).toEqual([[6, 11]]);
        expect(named(doc, 'Paragraph')[0].parent).toBe('FootnoteDefinition');
    });

    it('is not a LinkReference, FootnoteReference or Link', () => {
        const doc = '[^1]: hello';
        expect(named(doc, 'LinkReference')).toEqual([]);
        expect(named(doc, 'FootnoteReference')).toEqual([]);
        expect(named(doc, 'Link')).toEqual([]);
    });

    it('a URL-looking definition is still a definition, not a LinkReference', () => {
        const doc = '[^1]: http://x';
        expect(named(doc, 'FootnoteDefinition')).toHaveLength(1);
        expect(named(doc, 'LinkReference')).toEqual([]);
    });

    it('allows 1-3 leading spaces; from is the [', () => {
        expect(spans('   [^1]: t', 'FootnoteDefinition')).toEqual([[3, 10]]);
        expect(spans(' [^1]: t', 'FootnoteDefinition')).toEqual([[1, 8]]);
    });

    it('4 leading spaces is not a definition (indented code)', () => {
        const doc = 'a\n\n    [^1]: t';
        expect(named(doc, 'FootnoteDefinition')).toEqual([]);
        expect(named(doc, 'CodeBlock')).toHaveLength(1);
    });

    it('empty text [^1]: is still a definition, without a Paragraph', () => {
        const doc = '[^1]:';
        expect(spans(doc, 'FootnoteDefinition')).toEqual([[0, 5]]);
        expect(spans(doc, 'FootnoteMark')).toEqual([[0, 2], [3, 5]]);
        expect(named(doc, 'Paragraph')).toEqual([]);
    });

    it('requires the colon: "[^1] x" and "[^1] : x" are not definitions', () => {
        expect(named('[^1] x', 'FootnoteDefinition')).toEqual([]);
        expect(named('[^1] : x', 'FootnoteDefinition')).toEqual([]);
    });

    it('rejects bad labels: [^]:, [^a b]:, [^ a]:', () => {
        for (const d of ['[^]: t', '[^a b]: t', '[^ a]: t']) expect(named(d, 'FootnoteDefinition')).toEqual([]);
    });

    it('escaped \\[^1]: t is not a definition', () => {
        expect(named('\\[^1]: t', 'FootnoteDefinition')).toEqual([]);
    });

    it('inline content of the first line parses (emphasis, ref)', () => {
        const doc = '[^1]: a *b* [^2]';
        expect(spans(doc, 'Emphasis')).toEqual([[8, 11]]);
        expect(spans(doc, 'FootnoteReference')).toEqual([[12, 16]]);
    });

    it('Hebrew definition', () => {
        const doc = '[^א]: הערה';
        expect(spans(doc, 'FootnoteDefinition')).toEqual([[0, 10]]);
        expect(spans(doc, 'FootnoteLabel')).toEqual([[2, 3]]);
    });

    it('lazy continuation: unindented next line extends the paragraph', () => {
        const doc = '[^1]: one\ntwo';
        expect(spans(doc, 'FootnoteDefinition')).toEqual([[0, 13]]);
        expect(spans(doc, 'Paragraph')).toEqual([[6, 13]]);
    });

    it('indented continuation line stays in the definition', () => {
        const doc = '[^1]: one\n    two';
        expect(spans(doc, 'FootnoteDefinition')).toEqual([[0, 17]]);
        expect(named(doc, 'Paragraph')).toHaveLength(1);
    });

    it('blank line + 4-space indented line is a second Paragraph inside the definition', () => {
        const doc = '[^1]: one\n\n    two';
        expect(spans(doc, 'FootnoteDefinition')).toEqual([[0, 18]]);
        const paras = named(doc, 'Paragraph');
        expect(paras).toHaveLength(2);
        expect(paras.every((p) => p.parent === 'FootnoteDefinition')).toBe(true);
    });

    it('an indented list belongs to the definition', () => {
        const doc = '[^1]: one\n\n    - a\n    - b';
        expect(spans(doc, 'FootnoteDefinition')).toEqual([[0, doc.length]]);
        expect(named(doc, 'BulletList')).toHaveLength(1);
        expect(named(doc, 'ListItem')).toHaveLength(2);
        expect(named(doc, 'BulletList')[0].parent).toBe('FootnoteDefinition');
    });

    it('blank line then an unindented line ends the definition', () => {
        const doc = '[^1]: one\n\nnext';
        expect(spans(doc, 'FootnoteDefinition')).toEqual([[0, 9]]);
        const paras = named(doc, 'Paragraph');
        expect(paras.map(span)).toEqual([[6, 9], [11, 15]]);
        expect(paras[1].parent).toBe('Document');
    });

    it('a definition followed directly by a normal paragraph after a blank line', () => {
        const doc = 'text [^1]\n\n[^1]: note\n\nafter';
        expect(spans(doc, 'FootnoteReference')).toEqual([[5, 9]]);
        expect(spans(doc, 'FootnoteDefinition')).toEqual([[11, 21]]);
        expect(named(doc, 'Paragraph').map((p) => p.parent)).toEqual(['Document', 'FootnoteDefinition', 'Document']);
    });

    it('two consecutive definitions are two nodes', () => {
        const doc = '[^1]: a\n[^2]: b';
        expect(spans(doc, 'FootnoteDefinition')).toEqual([[0, 7], [8, 15]]);
    });

    it('works inside a Blockquote', () => {
        const doc = '> [^1]: note';
        const def = named(doc, 'FootnoteDefinition');
        expect(def).toHaveLength(1);
        expect(def[0].parent).toBe('Blockquote');
        expect(named(doc, 'LinkReference')).toEqual([]);
    });

    it('works inside a ListItem', () => {
        const doc = '- item\n\n  [^1]: note';
        const def = named(doc, 'FootnoteDefinition');
        expect(def).toHaveLength(1);
        expect(def[0].parent).toBe('ListItem');
    });

    it('marks, label and Paragraph spans are exact when the definition is nested or indented', () => {
        // blockquote: line.pos is 2, so every span must be offset by it (no from > to)
        const bq = '> [^1]: a';
        expect(spans(bq, 'FootnoteDefinition')).toEqual([[2, 9]]);
        expect(spans(bq, 'FootnoteMark')).toEqual([[2, 4], [5, 7]]);
        expect(spans(bq, 'FootnoteLabel')).toEqual([[4, 5]]);
        expect(spans(bq, 'Paragraph')).toEqual([[8, 9]]);
        expect(spans('  [^1]: a', 'FootnoteLabel')).toEqual([[4, 5]]);
        expect(spans('- x\n\n  [^1]: n', 'FootnoteLabel')).toEqual([[9, 10]]);
    });

    it('a ref-looking line after paragraph text stays a reference, not a definition', () => {
        const doc = 'para\n[^1] x';
        expect(named(doc, 'FootnoteDefinition')).toEqual([]);
        expect(named(doc, 'FootnoteReference')).toHaveLength(1);
    });

    it('does not break a normal link reference definition', () => {
        const doc = '[a]: http://x\n\n[a]';
        expect(named(doc, 'LinkReference')).toHaveLength(1);
        expect(named(doc, 'FootnoteDefinition')).toEqual([]);
    });
});

describe('footnoteSyntax: never footnotes inside', () => {
    it('inline code', () => {
        noFootnote('`[^1]`');
        noFootnote('`^[x]`');
        noFootnote('``a [^1] b``');
    });
    it('fenced code', () => {
        noFootnote('```\n[^1] ^[x]\n[^1]: t\n```');
        noFootnote('~~~\n[^1]\n~~~');
    });
    it('indented code', () => {
        noFootnote('a\n\n    [^1] and ^[x]');
    });
    it('HTML comments', () => {
        noFootnote('<!-- [^1] ^[x] -->');
        noFootnote('<!--\n[^1]: t\n-->');
    });
    it('inline math', () => {
        noFootnote('$a[^1]b$');
        noFootnote('$a^[x]b$');
    });
    it('display math', () => {
        noFootnote('$$a[^1]b$$');
        noFootnote('$$\n[^1]\n^[x]\n$$');
    });
    it('link URLs', () => {
        const doc = '[t](http://x/[^1])';
        expect(named(doc, 'FootnoteReference')).toEqual([]);
        expect(named(doc, 'Link')).toHaveLength(1);
    });
    it('footnotes still work next to math', () => {
        const doc = '$x$ [^1] ^[n] $y$';
        expect(named(doc, 'InlineMath')).toHaveLength(2);
        expect(spans(doc, 'FootnoteReference')).toEqual([[4, 8]]);
        expect(spans(doc, 'InlineFootnote')).toEqual([[9, 13]]);
    });
    it('math carets and a lone ^[ next to math are not footnotes', () => {
        expect(named('$a^2$', 'InlineMath')).toHaveLength(1);
        noFootnote('$a^2$');
        noFootnote('x^2 and y^[');
    });
});

describe('footnoteSyntax: works without mathSyntax', () => {
    it('parses all three node types alone', () => {
        const doc = 'a [^1] ^[n]\n\n[^1]: d';
        expect(named(doc, 'FootnoteReference', plainParser)).toHaveLength(1);
        expect(named(doc, 'InlineFootnote', plainParser)).toHaveLength(1);
        expect(named(doc, 'FootnoteDefinition', plainParser)).toHaveLength(1);
    });
});

describe('scanFootnoteRef', () => {
    it('returns { label, end } for [^1]', () => {
        expect(scanFootnoteRef('[^1]')).toEqual({ label: '1', end: 4 });
    });
    it('end is the index after ] and trailing text is ignored', () => {
        expect(scanFootnoteRef('[^note] rest')).toEqual({ label: 'note', end: 7 });
        expect(scanFootnoteRef('[^1](http://x)')).toEqual({ label: '1', end: 4 });
    });
    it('keeps label case raw (normalizing is the caller\'s job)', () => {
        expect(scanFootnoteRef('[^Note]').label).toBe('Note');
    });
    it('999-char label ok, 1000 null', () => {
        expect(scanFootnoteRef(`[^${'a'.repeat(999)}]`)).toEqual({ label: 'a'.repeat(999), end: 1002 });
        expect(scanFootnoteRef(`[^${'a'.repeat(1000)}]`)).toBeNull();
    });
    it('null for text not starting with [^', () => {
        for (const t of ['', '[', '[^', '^1]', 'a[^1]', '[a]', ' [^1]', '\\[^1]']) expect(scanFootnoteRef(t)).toBeNull();
    });
    it('null for empty, whitespace, [ or newline in label, or no closer', () => {
        for (const t of ['[^]', '[^a b]', '[^ a]', '[^a\tb]', '[^a\nb]', '[^a[b]', '[^abc', '[^a\n]']) {
            expect(scanFootnoteRef(t)).toBeNull();
        }
    });
    it('stops at the first ]', () => {
        expect(scanFootnoteRef('[^a]b]')).toEqual({ label: 'a', end: 4 });
    });
});

describe('scanInlineFootnote', () => {
    it('returns { end, content } for ^[note]', () => {
        expect(scanInlineFootnote('^[note]')).toEqual({ end: 7, content: 'note' });
    });
    it('ignores trailing text', () => {
        expect(scanInlineFootnote('^[a] b')).toEqual({ end: 4, content: 'a' });
    });
    it('balances nested brackets', () => {
        expect(scanInlineFootnote('^[see [a] here] x')).toEqual({ end: 15, content: 'see [a] here' });
        expect(scanInlineFootnote('^[a [b [c]] d]')).toEqual({ end: 14, content: 'a [b [c]] d' });
    });
    it('escaped \\] and \\[ do not count', () => {
        expect(scanInlineFootnote('^[a \\] b]')).toEqual({ end: 9, content: 'a \\] b' });
        expect(scanInlineFootnote('^[a \\[ b]')).toEqual({ end: 9, content: 'a \\[ b' });
    });
    it('spans a single newline', () => {
        expect(scanInlineFootnote('^[a\nb]')).toEqual({ end: 6, content: 'a\nb' });
    });
    it('stops at a blank line (also with spaces/tabs on it)', () => {
        expect(scanInlineFootnote('^[a\n\nb]')).toBeNull();
        expect(scanInlineFootnote('^[a\n  \nb]')).toBeNull();
        expect(scanInlineFootnote('^[a\n\t\nb]')).toBeNull();
    });
    it('null for empty, unclosed, unbalanced, or not starting with ^[', () => {
        for (const t of ['^[]', '^[abc', '^[a [b]', '', '^', '^x]', '[a]', ' ^[a]', '\\^[a]']) {
            expect(scanInlineFootnote(t)).toBeNull();
        }
    });
    it('length cap: max chars of content ok, one more null', () => {
        const ok = scanInlineFootnote('^[' + 'a'.repeat(INLINE_FOOTNOTE_MAX) + ']');
        expect(ok).toEqual({ end: INLINE_FOOTNOTE_MAX + 3, content: 'a'.repeat(INLINE_FOOTNOTE_MAX) });
        expect(scanInlineFootnote('^[' + 'a'.repeat(INLINE_FOOTNOTE_MAX + 1) + ']')).toBeNull();
    });
});

describe('scanFootnoteDef', () => {
    it('returns { label, markEnd } with markEnd just after ]:', () => {
        expect(scanFootnoteDef('[^1]: text')).toEqual({ label: '1', markEnd: 5 });
        expect(scanFootnoteDef('[^note]:')).toEqual({ label: 'note', markEnd: 8 });
    });
    it('1-3 leading spaces shift markEnd; 4 is null', () => {
        expect(scanFootnoteDef('   [^1]: t')).toEqual({ label: '1', markEnd: 8 });
        expect(scanFootnoteDef(' [^1]: t')).toEqual({ label: '1', markEnd: 6 });
        expect(scanFootnoteDef('    [^1]: t')).toBeNull();
        expect(scanFootnoteDef('\t[^1]: t')).toBeNull();
    });
    it('null without the colon directly after ]', () => {
        for (const l of ['[^1]', '[^1] text', '[^1] : t', '[^1]x']) expect(scanFootnoteDef(l)).toBeNull();
    });
    it('null for bad labels and non-footnotes', () => {
        for (const l of ['[^]: t', '[^a b]: t', '[^ a]: t', '[a]: t', '', 'text', '\\[^1]: t', '[^a[b]: t']) {
            expect(scanFootnoteDef(l)).toBeNull();
        }
    });
    it('999-char label ok, 1000 null', () => {
        expect(scanFootnoteDef(`[^${'a'.repeat(999)}]: t`)).toEqual({ label: 'a'.repeat(999), markEnd: 1003 });
        expect(scanFootnoteDef(`[^${'a'.repeat(1000)}]: t`)).toBeNull();
    });
    it('Hebrew label', () => {
        expect(scanFootnoteDef('[^הערה]: טקסט')).toEqual({ label: 'הערה', markEnd: 8 });
    });
});
