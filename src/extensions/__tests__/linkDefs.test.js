import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { resolveLinkDefs, normalizeLabel } from '../linkDefs';

// ===========================================================================
// TASK 8 — Part A: pure link-definition resolver `src/extensions/linkDefs.js`
// ===========================================================================
//
// Lezer node shapes verified against the installed @lezer/markdown
// (markdown({ base: markdownLanguage })):
//
//   "[id]: http://x"            -> LinkReference > LinkLabel "[id]", LinkMark ":", URL "http://x"
//   '[id]: http://x "Hello"'    -> ... URL "http://x", LinkTitle '"Hello"'   (quotes IN the node)
//   "[id]: http://x 'Hello'"    -> ... LinkTitle "'Hello'"
//   "[id]: http://x (Hello)"    -> ... LinkTitle "(Hello)"
//   "```\n[id]: http://x\n```"  -> FencedCode > CodeText — NO LinkReference emitted
//   "> [id]: http://x"          -> Blockquote > QuoteMark, LinkReference  (IS emitted)
//   "[id]: http://a\n[id]: http://b" -> two sibling LinkReference nodes, first at [0,14]
//
// PINNED CONVENTIONS (writer must match):
//  * resolveLinkDefs(state) -> Map<normalizedLabel, { url, title? }>. One pruned
//    full-document syntaxTree(state).iterate (NO range) collecting every
//    LinkReference. Key = normalizeLabel(LinkLabel text). Value.url = URL node
//    text verbatim. Value.title = LinkTitle text with ONE surrounding delimiter
//    pair stripped ('"' / "'" / matching "(" ")"); when there is no LinkTitle
//    child the `title` key is ABSENT (not `undefined`-valued, not empty string).
//  * Duplicate label -> FIRST definition wins (CommonMark). Later ones ignored.
//  * normalizeLabel(raw): strip ONE leading "[" and ONE trailing "]", .trim(),
//    collapse every internal whitespace run (spaces, tabs, newlines) to a single
//    space, .toLowerCase().  normalizeLabel('[Foo Bar]') === 'foo bar';
//    normalizeLabel('foo') === 'foo'.
//  * Module-level WeakMap<EditorState, Map> memo: two calls with the SAME state
//    object return the IDENTICAL Map reference. Distinct state objects get
//    distinct Maps.
// ===========================================================================

const mk = (doc) =>
    EditorState.create({
        doc,
        extensions: [markdown({ base: markdownLanguage })],
    });

describe('normalizeLabel', () => {
    it('strips the surrounding [ ] and lower-cases', () => {
        expect(normalizeLabel('[Foo Bar]')).toBe('foo bar');
    });

    it('passes a bare (bracket-less) label through, still lower-cased', () => {
        expect(normalizeLabel('foo')).toBe('foo');
        expect(normalizeLabel('FOO')).toBe('foo');
    });

    it('trims and collapses internal whitespace runs to one space', () => {
        expect(normalizeLabel('[  Foo   Bar  ]')).toBe('foo bar');
    });

    it('treats tabs and newlines as whitespace when collapsing', () => {
        expect(normalizeLabel('[foo\t\n bar]')).toBe('foo bar');
    });

    it('is idempotent', () => {
        expect(normalizeLabel(normalizeLabel('[Foo   Bar]'))).toBe('foo bar');
    });
});

describe('resolveLinkDefs', () => {
    it('returns a Map', () => {
        expect(resolveLinkDefs(mk(''))).toBeInstanceOf(Map);
    });

    it('an empty / def-less document yields an empty Map', () => {
        expect(resolveLinkDefs(mk('just a paragraph')).size).toBe(0);
    });

    it('collects a single definition keyed by its normalized label, no title key', () => {
        const res = resolveLinkDefs(mk('[a][id]\n\n[id]: http://x'));
        expect(res.size).toBe(1);
        expect(res.get('id')).toEqual({ url: 'http://x' });
        expect(res.get('id').title).toBeUndefined();
    });

    it('strips a double-quoted title', () => {
        const res = resolveLinkDefs(mk('[id]: http://x "Hello"'));
        expect(res.get('id')).toEqual({ url: 'http://x', title: 'Hello' });
    });

    it('strips a single-quoted title', () => {
        const res = resolveLinkDefs(mk("[id]: http://x 'Hello'"));
        expect(res.get('id')).toEqual({ url: 'http://x', title: 'Hello' });
    });

    it('strips a parenthesised title', () => {
        const res = resolveLinkDefs(mk('[id]: http://x (Hello)'));
        expect(res.get('id')).toEqual({ url: 'http://x', title: 'Hello' });
    });

    it('normalizes the key: "[Foo Bar]:" is retrievable via a differently-spaced/cased label', () => {
        const res = resolveLinkDefs(mk('[Foo Bar]: http://x'));
        expect(res.get(normalizeLabel('[foo   bar]'))).toEqual({ url: 'http://x' });
    });

    it('does NOT collect a definition sitting inside a fenced code block', () => {
        const res = resolveLinkDefs(mk('```\n[id]: http://x\n```'));
        expect(res.size).toBe(0);
    });

    it('DOES collect a definition sitting inside a blockquote', () => {
        const res = resolveLinkDefs(mk('x\n\n> [id]: http://x'));
        expect(res.get('id')).toEqual({ url: 'http://x' });
    });

    it('duplicate label -> FIRST definition wins (CommonMark)', () => {
        const res = resolveLinkDefs(mk('[id]: http://a\n[id]: http://b'));
        expect(res.size).toBe(1);
        expect(res.get('id').url).toBe('http://a');
    });

    it('memoizes per EditorState: two calls on the same state return the identical Map', () => {
        const state = mk('[id]: http://x');
        expect(resolveLinkDefs(state)).toBe(resolveLinkDefs(state));
    });

    it('distinct EditorState objects get distinct Maps', () => {
        const a = resolveLinkDefs(mk('[id]: http://x'));
        const b = resolveLinkDefs(mk('[id]: http://x'));
        expect(a).not.toBe(b);
    });
});
