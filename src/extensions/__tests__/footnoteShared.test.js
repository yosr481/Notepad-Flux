import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax, footnoteDefEnd, numberFootnotes } from '../footnoteSyntax';
import { resolveFootnotes } from '../footnotes';

// Spec: Docs/internal/footnotes-spec.md ("Syntax"); shared by the export renderer and the editor.
// Pinned choices:
//  - footnoteDefEnd(src): src starts at the LINE START of the definition (indent included); the result is an
//    index into src (so indent counts), = lezer FootnoteDefinition node.to - lineStart. No trailing newline,
//    no trailing blank lines. Caller guarantees src is a definition line.
//  - numberFootnotes: pure, does not mutate `events`; isDefined is called only for 'ref' events, with the label as given.

const parse = (doc) => {
    const s = EditorState.create({
        doc,
        extensions: [markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax] })],
    });
    ensureSyntaxTree(s, s.doc.length, 5000);
    return s;
};

describe('footnoteDefEnd: explicit cases', () => {
    const cases = [
        ['single line, no newline', '[^1]: a', '[^1]: a'],
        ['trailing newline excluded', '[^1]: a\n', '[^1]: a'],
        ['trailing blank lines excluded', '[^1]: a\n\n\n', '[^1]: a'],
        ['unindented line after a blank ends it', '[^1]: a\n\nafter', '[^1]: a'],
        ['lazy paragraph line stays in', '[^1]: a\nlazy\nmore\n\nafter', '[^1]: a\nlazy\nmore'],
        ['4-space continuation after blank stays in', '[^1]: a\n\n    two\n\nafter', '[^1]: a\n\n    two'],
        ['several blank lines between indented paragraphs', '[^1]: a\n\n\n    two\n\n    three\n\nafter', '[^1]: a\n\n\n    two\n\n    three'],
        ['lazy line then blank then indented', '[^1]: a\nlazy\n\n    two', '[^1]: a\nlazy\n\n    two'],
        ['next definition ends it', '[^1]: a\n[^2]: b', '[^1]: a'],
        ['next definition after blank ends it', '[^1]: a\n\n[^2]: b', '[^1]: a'],
        ['next definition after indented part', '[^1]: a\n\n    two\n[^2]: b', '[^1]: a\n\n    two'],
        ['3-space indent: indent counts in the length', '   [^1]: a\n\nafter', '   [^1]: a'],
        ['tab-free 4-space indented code-ish continuation', '[^1]: a\n\n        code\n\nafter', '[^1]: a\n\n        code'],
        ['empty first line, indented body', '[^1]:\n    body\n\nafter', '[^1]:\n    body'],
        ['empty definition', '[^1]:\n\nafter', '[^1]:'],
    ];
    it.each(cases)('%s', (_name, src, def) => {
        expect(footnoteDefEnd(src)).toBe(def.length);
    });

    it('does not look past its definition: later text is irrelevant', () => {
        const head = '[^1]: a\n\n    two';
        expect(footnoteDefEnd(head + '\n\n[^2]: b\n\n    x')).toBe(head.length);
    });
});

describe('footnoteDefEnd: parity with the lezer FootnoteDefinition node (document level)', () => {
    const docs = [
        'a[^1]\n\n[^1]: one\n\nafter',
        'a[^1]\n\n[^1]: one\nlazy line\nmore lazy\n\nafter',
        'a[^1]\n\n[^1]: one\n\n    para two\n\n    para three\n\nafter',
        '[^1]: one\n[^2]: two\n[^3]: three',
        '[^1]: one\n\n\n\n    far indented\n\n\nafter',
        '   [^1]: indented marker\n\nafter',
        '[^1]: one\n\n    - item a\n    - item b\n\nafter',
        '[^1]: one\n\n        code block\n\n# heading',
        '[^1]: one\n# heading right after',
        '[^1]: one\n> quote right after',
        '[^1]: one\n- list right after',
        '[^1]: one\n```\nfence\n```\n',
        '[^1]: one\n\n    two\n[^2]: next def\n',
        '[^1]:\n    body only\n\nafter',
        '[^1]: last line, no newline',
        'text\n\n[^1]: one\n\n---\n\n[^2]: two\n\n    more\n',
    ];
    it.each(docs.map((d, i) => [i, d]))('doc #%i', (_i, doc) => {
        const s = parse(doc);
        const defs = [];
        syntaxTree(s).iterate({ enter: (n) => { if (n.name === 'FootnoteDefinition' && n.node.parent?.name === 'Document') defs.push(n.from) ; } });
        expect(defs.length).toBeGreaterThan(0);
        syntaxTree(s).iterate({
            enter: (n) => {
                if (n.name !== 'FootnoteDefinition' || n.node.parent?.name !== 'Document') return;
                const lineStart = s.doc.lineAt(n.from).from;
                expect(footnoteDefEnd(doc.slice(lineStart))).toBe(n.to - lineStart);
            },
        });
    });
});

describe('footnoteDefEnd: paragraph interruption matches lezer', () => {
    // Review gap: BLOCK_START must agree with lezer on what may interrupt the note's open paragraph.
    // Interrupts (note ends): html block starts, `$$` math block. Does not interrupt (lazy line stays in the note):
    // an ordered item not starting at 1, an empty bullet.
    it.each(['<div>', '<!-- c', '$$', '$$ x', '2) x', '2. x', '- '])('line after "[^1]: one": %j', (tail) => {
        const doc = `[^1]: one\n${tail}\nlast`;
        const s = parse(doc);
        let to = -1;
        syntaxTree(s).iterate({ enter: (n) => { if (n.name === 'FootnoteDefinition' && to < 0) to = n.to; } });
        expect(footnoteDefEnd(doc)).toBe(doc.slice(0, to).trimEnd().length);
    });
});

describe('numberFootnotes', () => {
    const ref = (label) => ({ kind: 'ref', label });
    const inline = { kind: 'inline' };
    const all = () => true;

    it('empty -> empty array', () => {
        expect(numberFootnotes([], all)).toEqual([]);
    });

    it('numbers distinct defined labels 1, 2, 3 in order', () => {
        expect(numberFootnotes([ref('b'), ref('a'), ref('c')], all)).toEqual([1, 2, 3]);
    });

    it('a repeated label reuses its first number and takes no new one', () => {
        expect(numberFootnotes([ref('a'), ref('b'), ref('a'), ref('c'), ref('b')], all)).toEqual([1, 2, 1, 3, 2]);
    });

    it('unresolved refs give null and do not consume a number', () => {
        const defined = (l) => l !== 'x';
        expect(numberFootnotes([ref('x'), ref('a'), ref('x'), ref('b')], defined)).toEqual([null, 1, null, 2]);
    });

    it('inline notes take their own number each, interleaved with labelled', () => {
        expect(numberFootnotes([inline, ref('a'), inline, ref('a'), ref('b'), inline], all)).toEqual([1, 2, 3, 2, 4, 5]);
    });

    it('two inline notes never share a number', () => {
        expect(numberFootnotes([inline, inline], all)).toEqual([1, 2]);
    });

    it('only inline notes and nothing defined', () => {
        expect(numberFootnotes([ref('q'), inline], () => false)).toEqual([null, 1]);
    });

    it('isDefined gets the label as given and is not called for inline events', () => {
        const seen = [];
        numberFootnotes([inline, ref('Mixed Case'), inline], (l) => { seen.push(l); return true; });
        expect(seen).toEqual(['Mixed Case']);
    });

    it('returns a fresh array of the same length and leaves events untouched', () => {
        const events = [ref('a'), inline, ref('a')];
        const copy = JSON.parse(JSON.stringify(events));
        const out = numberFootnotes(events, all);
        expect(out).not.toBe(events);
        expect(out).toHaveLength(3);
        expect(events).toEqual(copy);
    });
});

describe('resolveFootnotes stays consistent with numberFootnotes', () => {
    it('mixed inline/labelled/unresolved doc numbers like the pure helper', () => {
        const doc = 'a^[i1] b[^z] c[^q] d[^z] e^[i2] f[^w]\n\n[^z]: Z\n[^w]: W';
        const r = resolveFootnotes(parse(doc));
        const out = numberFootnotes(
            [inline(), ref('z'), ref('q'), ref('z'), inline(), ref('w')],
            (l) => l === 'z' || l === 'w',
        );
        expect(out).toEqual([1, 2, null, 2, 3, 4]);
        expect(r.labelled.get('z').number).toBe(2);
        expect(r.labelled.get('w').number).toBe(4);
        expect([...r.inline.values()].map((v) => v.number)).toEqual([1, 3]);
        function inline() { return { kind: 'inline' }; }
        function ref(label) { return { kind: 'ref', label }; }
    });
});
