import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { resolveFootnotes } from '../footnotes';

// Spec: Docs/internal/footnotes-spec.md ("Modules and public API", "Numbering").
// Pinned choices where the spec is silent:
//  - `text` of a definition: raw source from the first non-space char after `]:` to defTo; each
//    continuation line loses up to 4 leading spaces; ONLY the end of the whole text is trimmed
//    (per-line trailing space is kept); blank lines inside stay as empty lines. Not tested inside
//    blockquotes/lists beyond single-line notes (container prefixes are not stripped by contract).
//  - defFrom = the `[` of `[^label]:` (after indent); defTo = end of the last content line (no newline).
//  - `labelled` keys are normalizeLabel(label): lowercased, whitespace-collapsed.
//  - Entries are plain objects with exactly { number, defFrom, defTo, text, refs } / { number, text }.
//  - A reference located inside a definition's text counts at its document position, even when the
//    definition itself is later referenced from there.

const state = (doc) => {
    const s = EditorState.create({
        doc,
        extensions: [markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax] })],
    });
    ensureSyntaxTree(s, s.doc.length, 5000);
    return s;
};
const res = (doc) => resolveFootnotes(state(doc));
const nums = (r) => Object.fromEntries([...r.labelled].map(([k, v]) => [k, v.number]));

describe('resolveFootnotes: shape and basics', () => {
    it('empty document -> two empty maps', () => {
        const r = res('');
        expect(r.labelled).toBeInstanceOf(Map);
        expect(r.inline).toBeInstanceOf(Map);
        expect(r.labelled.size).toBe(0);
        expect(r.inline.size).toBe(0);
    });

    it('doc with no footnotes -> empty maps', () => {
        const r = res('# Title\n\nplain [link](x) text\n');
        expect(r.labelled.size).toBe(0);
        expect(r.inline.size).toBe(0);
    });

    it('simple ref + def: exact entry', () => {
        const doc = 'a[^1]\n\n[^1]: hello';
        const r = res(doc);
        expect([...r.labelled.keys()]).toEqual(['1']);
        expect(r.labelled.get('1')).toEqual({
            number: 1, defFrom: 7, defTo: doc.length, text: 'hello', refs: [1],
        });
    });

    it('defFrom/defTo slice the definition source', () => {
        const doc = 'a[^1]\n\n[^1]: hello\n\nafter';
        const e = res(doc).labelled.get('1');
        expect(doc.slice(e.defFrom, e.defTo)).toBe('[^1]: hello');
    });

    it('definition before its reference resolves', () => {
        const doc = '[^1]: note\n\ntext[^1]';
        const e = res(doc).labelled.get('1');
        expect(e.number).toBe(1);
        expect(e.refs).toEqual([doc.indexOf('text') + 4]);
        expect(e.text).toBe('note');
    });

    it('definition after its reference resolves', () => {
        const doc = 'text[^a] more\n\n[^a]: later';
        const e = res(doc).labelled.get('a');
        expect(e.number).toBe(1);
        expect(e.refs).toEqual([4]);
        expect(e.text).toBe('later');
    });
});

describe('resolveFootnotes: labelled filtering', () => {
    it('unreferenced definition is absent', () => {
        const r = res('text\n\n[^1]: orphan');
        expect(r.labelled.size).toBe(0);
    });

    it('unreferenced definition takes no number', () => {
        const r = res('[^orphan]: x\n\na[^b]\n\n[^b]: y');
        expect([...r.labelled.keys()]).toEqual(['b']);
        expect(r.labelled.get('b').number).toBe(1);
    });

    it('unresolved reference (no definition) is absent and takes no number', () => {
        const doc = 'a[^missing] b[^1]\n\n[^1]: x';
        const r = res(doc);
        expect([...r.labelled.keys()]).toEqual(['1']);
        expect(r.labelled.get('1').number).toBe(1);
        expect(r.labelled.get('1').refs).toEqual([doc.indexOf('b[^1]') + 1]);
    });

    it('reference only, no definitions at all -> empty', () => {
        expect(res('a[^1] b[^2]').labelled.size).toBe(0);
    });
});

describe('resolveFootnotes: labels', () => {
    it('[^Note] and [^note] resolve together (case-insensitive)', () => {
        const doc = 'a[^Note] b[^note]\n\n[^NOTE]: x';
        const r = res(doc);
        expect([...r.labelled.keys()]).toEqual(['note']);
        expect(r.labelled.get('note').refs).toEqual([1, 10]);
        expect(r.labelled.get('note').number).toBe(1);
    });

    it('key is normalizeLabel form (lowercased)', () => {
        const r = res('a[^MiXed]\n\n[^mixed]: x');
        expect(r.labelled.has('mixed')).toBe(true);
        expect(r.labelled.has('MiXed')).toBe(false);
    });

    it('Hebrew label and text', () => {
        const doc = 'שלום[^הערה] עולם\n\n[^הערה]: טקסט **מודגש** כאן';
        const r = res(doc);
        const e = r.labelled.get('הערה');
        expect(e.number).toBe(1);
        expect(e.refs).toEqual([4]);
        expect(e.text).toBe('טקסט **מודגש** כאן');
    });

    it('non-numeric labels get sequential numbers, not the label', () => {
        const r = res('a[^zeta] b[^alpha]\n\n[^alpha]: A\n[^zeta]: Z');
        expect(nums(r)).toEqual({ zeta: 1, alpha: 2 });
    });
});

describe('resolveFootnotes: numbering', () => {
    it('numbers by first reference order, not definition order', () => {
        const r = res('a[^b] c[^a]\n\n[^a]: A\n\n[^b]: B');
        expect(nums(r)).toEqual({ b: 1, a: 2 });
    });

    it('same note referenced 3 times: number reused, refs has 3 positions', () => {
        const doc = 'x[^1] y[^1] z[^1]\n\n[^1]: n';
        const e = res(doc).labelled.get('1');
        expect(e.number).toBe(1);
        expect(e.refs).toEqual([1, 7, 13]);
    });

    it('later refs do not consume numbers', () => {
        const r = res('a[^1] b[^1] c[^2]\n\n[^1]: A\n[^2]: B');
        expect(nums(r)).toEqual({ 1: 1, 2: 2 });
    });

    it('refs are in document order', () => {
        const doc = 'p[^1]\n\nq[^1]\n\n[^1]: n\n\nr[^1]';
        const refs = res(doc).labelled.get('1').refs;
        expect(refs).toEqual([...refs].sort((a, b) => a - b));
        expect(refs).toHaveLength(3);
    });

    it('mixed: a^[x] b[^2] c[^1] d^[y] e[^2] -> x=1, 2=2, 1=3, y=4', () => {
        const doc = 'a^[x] b[^2] c[^1] d^[y] e[^2]\n\n[^1]: one\n[^2]: two';
        const r = res(doc);
        expect(r.inline.get(1).number).toBe(1);
        expect(r.labelled.get('2').number).toBe(2);
        expect(r.labelled.get('1').number).toBe(3);
        expect(r.inline.get(doc.indexOf('^[y]')).number).toBe(4);
        expect(r.labelled.get('2').refs).toEqual([doc.indexOf('b[^2]') + 1, doc.indexOf('e[^2]') + 1]);
    });

    it('numbering is document position order across paragraphs', () => {
        const r = res('first[^b]\n\nsecond^[i]\n\nthird[^a]\n\n[^a]: A\n[^b]: B');
        expect(nums(r)).toEqual({ b: 1, a: 3 });
        expect([...r.inline.values()].map((v) => v.number)).toEqual([2]);
    });

    it('a ref inside a definition counts at its own document position', () => {
        // [^2] is referenced only from inside def 1, which sits after body ref [^1]
        const doc = 'a[^1] b[^3]\n\n[^1]: see[^2]\n[^2]: two\n[^3]: three';
        const r = res(doc);
        expect(nums(r)).toEqual({ 1: 1, 3: 2, 2: 3 });
    });

    it('a ref inside an inline note counts at its document position', () => {
        const doc = 'a^[see[^1] b] c[^2]\n\n[^1]: one\n[^2]: two';
        const r = res(doc);
        expect(r.inline.get(1).number).toBe(1);
        expect(r.labelled.get('1').number).toBe(2);
        expect(r.labelled.get('2').number).toBe(3);
    });
});

describe('resolveFootnotes: duplicates', () => {
    it('first definition wins; later ignored', () => {
        const doc = 'a[^1]\n\n[^1]: first\n\n[^1]: second';
        const e = res(doc).labelled.get('1');
        expect(e.text).toBe('first');
        expect(doc.slice(e.defFrom, e.defTo)).toBe('[^1]: first');
    });

    it('duplicate differing only by case is a duplicate', () => {
        const e = res('a[^x]\n\n[^X]: first\n\n[^x]: second').labelled.get('x');
        expect(e.text).toBe('first');
    });

    it('ignored duplicate takes no number', () => {
        const r = res('a[^1] b[^2]\n\n[^1]: one\n[^1]: dup\n[^2]: two');
        expect(nums(r)).toEqual({ 1: 1, 2: 2 });
    });
});

describe('resolveFootnotes: definition text', () => {
    it('empty definition -> text ""', () => {
        const r = res('a[^1]\n\n[^1]:');
        expect(r.labelled.get('1').text).toBe('');
    });

    it('whitespace-only definition -> text ""', () => {
        expect(res('a[^1]\n\n[^1]:    ').labelled.get('1').text).toBe('');
    });

    it('text starts at first non-space after ]: and ends trimmed', () => {
        const e = res('a[^1]\n\n[^1]:    spaced out   \n\nnext').labelled.get('1');
        expect(e.text).toBe('spaced out');
    });

    it('continuation line indent (4 spaces) removed', () => {
        const doc = 'a[^1]\n\n[^1]: first\n    second';
        expect(res(doc).labelled.get('1').text).toBe('first\nsecond');
    });

    it('only up to 4 spaces removed from a continuation line', () => {
        const doc = 'a[^1]\n\n[^1]: first\n      deeper';
        expect(res(doc).labelled.get('1').text).toBe('first\n  deeper');
    });

    it('multi-paragraph note keeps the blank line', () => {
        const doc = 'a[^1]\n\n[^1]: one\n\n    two\n\nout';
        const e = res(doc).labelled.get('1');
        expect(e.text).toBe('one\n\ntwo');
        expect(doc.slice(e.defFrom, e.defTo)).toBe('[^1]: one\n\n    two');
    });

    it('lazy unindented line continues the paragraph', () => {
        const doc = 'a[^1]\n\n[^1]: one\nlazy';
        expect(res(doc).labelled.get('1').text).toBe('one\nlazy');
    });

    it('text is raw source (markdown kept)', () => {
        const e = res('a[^1]\n\n[^1]: *em* `c` [l](u) $x$').labelled.get('1');
        expect(e.text).toBe('*em* `c` [l](u) $x$');
    });

    it('note ends at blank line + unindented line', () => {
        const doc = 'a[^1]\n\n[^1]: note\n\nnot part';
        expect(res(doc).labelled.get('1').text).toBe('note');
    });

    it('up-to-3-space indented definition: defFrom is the [', () => {
        const doc = 'a[^1]\n\n   [^1]: x';
        const e = res(doc).labelled.get('1');
        expect(e.defFrom).toBe(doc.indexOf('[^1]:'));
        expect(e.text).toBe('x');
    });
});

describe('resolveFootnotes: containers', () => {
    it('definition inside blockquote resolves', () => {
        const doc = 'a[^1]\n\n> [^1]: quoted';
        const e = res(doc).labelled.get('1');
        expect(e.number).toBe(1);
        expect(e.text).toBe('quoted');
        expect(e.defFrom).toBe(doc.indexOf('[^1]:'));
    });

    it('definition inside list item resolves', () => {
        const doc = 'a[^1]\n\n- [^1]: listed';
        const e = res(doc).labelled.get('1');
        expect(e.number).toBe(1);
        expect(e.text).toBe('listed');
        expect(e.defFrom).toBe(doc.indexOf('[^1]:'));
    });

    it('reference inside blockquote / list item resolves', () => {
        const doc = '> q[^1]\n\n- l[^1]\n\n[^1]: n';
        const e = res(doc).labelled.get('1');
        expect(e.refs).toEqual([doc.indexOf('q[^1]') + 1, doc.indexOf('l[^1]') + 1]);
    });

    it('nested definition and top-level duplicate: first in document order wins', () => {
        const doc = 'a[^1]\n\n> [^1]: quoted\n\n[^1]: top';
        expect(res(doc).labelled.get('1').text).toBe('quoted');
    });
});

describe('resolveFootnotes: inline notes', () => {
    it('keyed by from, text = raw content', () => {
        const r = res('a^[hello] b');
        expect([...r.inline.keys()]).toEqual([1]);
        expect(r.inline.get(1)).toEqual({ number: 1, text: 'hello' });
    });

    it('raw content keeps inline markdown and balanced brackets', () => {
        const r = res('x ^[*em* and [nested] `c`] y');
        expect(r.inline.get(2).text).toBe('*em* and [nested] `c`');
    });

    it('two inline notes number in order', () => {
        const doc = '^[a] and ^[b]';
        const r = res(doc);
        expect(r.inline.get(0).number).toBe(1);
        expect(r.inline.get(doc.indexOf('^[b]')).number).toBe(2);
    });

    it('inline note needs no definition and does not touch labelled', () => {
        const r = res('^[solo]');
        expect(r.labelled.size).toBe(0);
        expect(r.inline.size).toBe(1);
    });

    it('empty ^[] is not a note', () => {
        expect(res('a^[]b').inline.size).toBe(0);
    });

    it('inline note inside blockquote / list item is found', () => {
        const doc = '> a^[q]\n\n- b^[l]';
        const r = res(doc);
        expect([...r.inline.keys()]).toEqual([doc.indexOf('^[q]'), doc.indexOf('^[l]')]);
        expect([...r.inline.values()].map((v) => v.number)).toEqual([1, 2]);
    });

    it('inline Hebrew text', () => {
        const r = res('שלום^[הערה בעברית] עולם');
        expect(r.inline.get(4)).toEqual({ number: 1, text: 'הערה בעברית' });
    });
});

describe('resolveFootnotes: excluded contexts (end to end)', () => {
    it('nothing in code, comments or math counts', () => {
        const doc = [
            '`a[^1]` `b^[x]`',
            '',
            '```',
            'c[^1] d^[y]',
            '```',
            '',
            '    e[^1] f^[z]',
            '',
            '<!-- g[^1] h^[w] -->',
            '',
            '$i[^1]$ $$j^[v]$$',
            '',
            '[^1]: def',
        ].join('\n');
        const r = res(doc);
        expect(r.labelled.size).toBe(0);
        expect(r.inline.size).toBe(0);
    });

    it('escaped \\[^1] does not count', () => {
        const r = res('a \\[^1] b\n\n[^1]: x');
        expect(r.labelled.size).toBe(0);
    });

    it('a real ref still counts next to excluded ones', () => {
        const doc = '`[^1]` real[^1]\n\n[^1]: x';
        expect(res(doc).labelled.get('1').refs).toEqual([doc.indexOf('real') + 4]);
    });
});

describe('resolveFootnotes: memoization', () => {
    it('same state -> same object', () => {
        const s = state('a[^1]\n\n[^1]: x');
        expect(resolveFootnotes(s)).toBe(resolveFootnotes(s));
    });

    it('new state after a change -> fresh, correct result', () => {
        const s1 = state('a[^1]\n\n[^1]: x');
        const r1 = resolveFootnotes(s1);
        const s2 = s1.update({ changes: { from: 0, to: 0, insert: 'z[^1] ' } }).state;
        ensureSyntaxTree(s2, s2.doc.length, 5000);
        const r2 = resolveFootnotes(s2);
        expect(r2).not.toBe(r1);
        expect(r2.labelled.get('1').refs).toEqual([1, 7]);
        expect(r1.labelled.get('1').refs).toEqual([1]);
    });

    it('result reflects removal of the definition', () => {
        const s1 = state('a[^1]\n\n[^1]: x');
        expect(resolveFootnotes(s1).labelled.size).toBe(1);
        const s2 = s1.update({ changes: { from: 7, to: s1.doc.length } }).state;
        ensureSyntaxTree(s2, s2.doc.length, 5000);
        expect(resolveFootnotes(s2).labelled.size).toBe(0);
    });
});
