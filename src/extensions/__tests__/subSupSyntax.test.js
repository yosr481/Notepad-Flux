import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Subscript, Superscript } from '@lezer/markdown';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';

// F6 T1 editor parsing. Pinned node names (from @lezer/markdown): Subscript/SubscriptMark, Superscript/SuperscriptMark;
// an escape inside is a child `Escape`. Node range = opening mark .. closing mark inclusive; two 1-char marks.
// The test list mirrors the app's (same pattern as footnoteSyntax.test.js); the "Editor.jsx wiring" block guards drift.
// Offsets via doc.indexOf, never by hand.
const parser = markdown({
    base: markdownLanguage,
    extensions: [mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript],
}).language.parser;

const nodes = (doc) => {
    const out = [];
    parser.parse(doc).iterate({
        enter: (n) => { out.push({ name: n.name, from: n.from, to: n.to, parent: n.node.parent && n.node.parent.name }); },
    });
    return out;
};
const named = (doc, name) => nodes(doc).filter((n) => n.name === name);
const spans = (doc, name) => named(doc, name).map((n) => [n.from, n.to]);

describe('subSupSyntax: subscript', () => {
    it('H~2~O: node and both marks have exact spans', () => {
        const doc = 'H~2~O';
        const open = doc.indexOf('~');
        const close = doc.lastIndexOf('~');
        expect(spans(doc, 'Subscript')).toEqual([[open, close + 1]]);
        expect(spans(doc, 'SubscriptMark')).toEqual([[open, open + 1], [close, close + 1]]);
        expect(named(doc, 'SubscriptMark').map((n) => n.parent)).toEqual(['Subscript', 'Subscript']);
    });
    it('no Superscript and no Strikethrough for H~2~O', () => {
        expect(named('H~2~O', 'Superscript')).toEqual([]);
        expect(named('H~2~O', 'Strikethrough')).toEqual([]);
    });
    it('two subscripts in one line', () => {
        const doc = 'a~1~ b~2~';
        expect(named(doc, 'Subscript')).toHaveLength(2);
    });
    it('multi-char content: ~abc~', () => {
        expect(spans('~abc~', 'Subscript')).toEqual([[0, 5]]);
    });
    it('~a b~ (space) is not subscript', () => {
        expect(named('~a b~', 'Subscript')).toEqual([]);
    });
    it('~a\\ b~ (escaped space) is subscript, with an Escape child', () => {
        const doc = '~a\\ b~';
        expect(spans(doc, 'Subscript')).toEqual([[0, doc.length]]);
        expect(named(doc, 'Escape')).toHaveLength(1);
    });
    it('escaped closer does not close: ~a\\~b~', () => {
        const doc = '~a\\~b~';
        expect(spans(doc, 'Subscript')).toEqual([[0, doc.length]]);
    });
    it('a newline is whitespace: ~a\\nb~ is not subscript', () => {
        expect(named('~a\nb~', 'Subscript')).toEqual([]);
    });
    it('unclosed ~a is plain text', () => {
        expect(named('~a', 'Subscript')).toEqual([]);
    });
    it('NOT handled: no flanking rule, intra-word a~b~c is subscript', () => {
        expect(named('a~b~c', 'Subscript')).toHaveLength(1);
    });
    it('inside strong, a blockquote, a list item and a heading', () => {
        for (const doc of ['**H~2~O**', '> H~2~O', '- H~2~O', '# H~2~O', '   H~2~O']) {
            expect(named(doc, 'Subscript')).toHaveLength(1);
        }
    });
});

describe('subSupSyntax: superscript', () => {
    it('x^2^: node and marks have exact spans', () => {
        const doc = 'x^2^';
        const open = doc.indexOf('^');
        const close = doc.lastIndexOf('^');
        expect(spans(doc, 'Superscript')).toEqual([[open, close + 1]]);
        expect(spans(doc, 'SuperscriptMark')).toEqual([[open, open + 1], [close, close + 1]]);
    });
    it('^a b^ is not superscript; ^a\\ b^ is', () => {
        expect(named('^a b^', 'Superscript')).toEqual([]);
        expect(named('^a\\ b^', 'Superscript')).toHaveLength(1);
    });
    it('^^ and unclosed ^a are plain text', () => {
        expect(named('^^', 'Superscript')).toEqual([]);
        expect(named('x^2', 'Superscript')).toEqual([]);
    });
    it('sub and sup together', () => {
        const doc = 'H~2~O and x^2^';
        expect(named(doc, 'Subscript')).toHaveLength(1);
        expect(named(doc, 'Superscript')).toHaveLength(1);
    });
});

describe('subSupSyntax: what they must not touch', () => {
    it('~~del~~ stays Strikethrough, no Subscript', () => {
        const doc = '~~del~~';
        expect(spans(doc, 'Strikethrough')).toEqual([[0, doc.length]]);
        expect(named(doc, 'Subscript')).toEqual([]);
    });
    it('~~a~~ and ~b~ in one line: one of each', () => {
        const doc = '~~a~~ and ~b~';
        expect(named(doc, 'Strikethrough')).toHaveLength(1);
        expect(named(doc, 'Subscript')).toHaveLength(1);
    });
    it('^[inline note] stays the F2 footnote node, never Superscript', () => {
        const doc = 'a^[inline note] b';
        expect(named(doc, 'InlineFootnote')).toHaveLength(1);
        expect(named(doc, 'Superscript')).toEqual([]);
    });
    it('^[note] (no space, would satisfy sup rules) is still InlineFootnote', () => {
        const doc = '^[note]';
        expect(named(doc, 'InlineFootnote')).toHaveLength(1);
        expect(named(doc, 'Superscript')).toEqual([]);
    });
    it('inline code span: nothing parses inside', () => {
        for (const doc of ['`H~2~O`', '`x^2^`']) {
            expect(named(doc, 'Subscript')).toEqual([]);
            expect(named(doc, 'Superscript')).toEqual([]);
        }
    });
    it('fenced code (backtick and tilde fences): nothing parses inside', () => {
        for (const doc of ['```\nH~2~O x^2^\n```', '~~~\nH~2~O x^2^\n~~~']) {
            expect(named(doc, 'Subscript')).toEqual([]);
            expect(named(doc, 'Superscript')).toEqual([]);
        }
    });
    it('math $x^2^$ is InlineMath, no Superscript inside', () => {
        const doc = '$x^2^$';
        expect(named(doc, 'InlineMath')).toHaveLength(1);
        expect(named(doc, 'Superscript')).toEqual([]);
    });
    it('escaped markers \\~a\\~ are not subscript', () => {
        expect(named('\\~a\\~', 'Subscript')).toEqual([]);
    });
    it('link URL is not parsed: [a](http://x.test/p~1~q)', () => {
        expect(named('[a](http://x.test/p~1~q)', 'Subscript')).toEqual([]);
    });
});

describe('Editor.jsx wiring (source guard)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/Editor.jsx'), 'utf8');
    const list = (src.match(/markdown\(\{[^)]*?extensions:\s*\[([^\]]*)\]/) || [])[1] || '';

    it('Subscript and Superscript are imported from @lezer/markdown', () => {
        expect(src).toMatch(/import\s*\{[^}]*\bSubscript\b[^}]*\}\s*from\s*['"]@lezer\/markdown['"]/);
        expect(src).toMatch(/import\s*\{[^}]*\bSuperscript\b[^}]*\}\s*from\s*['"]@lezer\/markdown['"]/);
    });
    it('both are in the markdown({ extensions: [...] }) list, after footnoteSyntax', () => {
        expect(list).toMatch(/\bSubscript\b/);
        expect(list).toMatch(/\bSuperscript\b/);
        expect(list.indexOf('Superscript')).toBeGreaterThan(list.indexOf('footnoteSyntax'));
        expect(list.indexOf('Subscript')).toBeGreaterThan(list.indexOf('footnoteSyntax'));
    });
    it('subSupPreview is imported from ../extensions/subSupPreview and in the extensions array after livePreview', () => {
        expect(src).toMatch(/import\s*\{[^}]*\bsubSupPreview\b[^}]*\}\s*from\s*['"]\.\.\/extensions\/subSupPreview['"]/);
        expect(src).toMatch(/^\s*subSupPreview,/m);
        expect(src.indexOf('subSupPreview,')).toBeGreaterThan(src.indexOf('livePreview,'));
    });
    it('@lezer/markdown is a declared dependency (imported directly, not just hoisted)', () => {
        const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
        expect({ ...pkg.dependencies, ...pkg.devDependencies }).toHaveProperty(['@lezer/markdown']);
    });
});
