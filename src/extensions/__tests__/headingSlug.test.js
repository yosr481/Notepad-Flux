import { describe, it, expect } from 'vitest';
import { headingSlug, createSlugger } from '../headingSlug';

// Spec: Docs/internal/heading-links-spec.md ("Rules (shared, one module)").
// Pinned where the spec is silent:
//  - Trim happens AFTER inline-syntax removal, so `Note [^1]` -> `note` (no trailing `-`).
//  - Every whitespace char (tab, newline, nbsp-class \s) is ONE space; runs are not collapsed.
//  - Slugger returns null (not '') for an empty slug.

describe('headingSlug: spec examples', () => {
    it.each([
        ['Headers', 'headers'],
        ['**Bold** _and_ `code`', 'bold-and-code'],
        ['Link [text](http://x.y)', 'link-text'],
        ['H~2~O and x^2^', 'h2o-and-x2'],
        ['Émoji :smile:', 'émoji-smile'],
        ['שלום עולם', 'שלום-עולם'],
        ["What's new?", 'whats-new'],
        ['snake_case name', 'snake_case-name'],
        ['Note[^1]', 'note'],
    ])('%j -> %j', (raw, want) => {
        expect(headingSlug(raw)).toBe(want);
    });
});

describe('headingSlug: inline syntax to visible text', () => {
    it('removes footnote refs, also after a space (trim after removal)', () => {
        expect(headingSlug('Note [^1]')).toBe('note');
        expect(headingSlug('A[^x]B')).toBe('ab');
    });
    it('image becomes its alt text', () => {
        expect(headingSlug('Pic ![a cat](c.png) here')).toBe('pic-a-cat-here');
    });
    it('reference links keep their text', () => {
        expect(headingSlug('See [the docs][ref] now')).toBe('see-the-docs-now');
        expect(headingSlug('See [the docs][] now')).toBe('see-the-docs-now');
    });
    it('HTML tags removed, inner text kept', () => {
        expect(headingSlug('a <b>bold</b> <span class="x">word</span>')).toBe('a-bold-word');
    });
    it('link url never leaks into the slug', () => {
        expect(headingSlug('[x](http://example.com/path)')).toBe('x');
    });
});

describe('headingSlug: github slug step', () => {
    it('lowercases (Unicode aware)', () => {
        expect(headingSlug('ÉCOLE Normale')).toBe('école-normale');
    });
    it('keeps letters, marks, numbers, - and _', () => {
        expect(headingSlug('v2-final_draft 3')).toBe('v2-final_draft-3');
    });
    it('removes punctuation and symbols', () => {
        expect(headingSlug('a, b. c! (d) & e/f')).toBe('a-b-c-d--ef');
    });
    it('keeps combining marks', () => {
        expect(headingSlug('école')).toBe('école');
    });
    it('runs of spaces are NOT collapsed', () => {
        expect(headingSlug('a  b')).toBe('a--b');
        expect(headingSlug('a   b')).toBe('a---b');
    });
    it('every whitespace char is one space (tab, newline)', () => {
        expect(headingSlug('a\tb')).toBe('a-b');
        expect(headingSlug('a\nb')).toBe('a-b');
        expect(headingSlug('a \t b')).toBe('a---b');
    });
    it('trims leading and trailing whitespace first', () => {
        expect(headingSlug('  \t Hello World \n ')).toBe('hello-world');
    });
    it('emphasis chars vanish: * ~ = ` ^', () => {
        expect(headingSlug('*a* ~b~ ==c== `d` ^e^')).toBe('a-b-c-d-e');
    });
    it('underscore emphasis at word edges is removed, snake_case kept', () => {
        expect(headingSlug('_em_ and __strong__')).toBe('em-and-strong');
        expect(headingSlug('a_b_c')).toBe('a_b_c');
    });
    it('literal hyphens stay, even leading/trailing', () => {
        expect(headingSlug('a - b')).toBe('a---b');
        expect(headingSlug('-x-')).toBe('-x-');
    });
    it('empty and symbol-only give an empty string', () => {
        expect(headingSlug('')).toBe('');
        expect(headingSlug('   ')).toBe('');
        expect(headingSlug('!!! ???')).toBe('');
        expect(headingSlug('[^1]')).toBe('');
    });
});

describe('createSlugger', () => {
    it('dedupes in call order: x, x-1, x-2', () => {
        const s = createSlugger();
        expect([s.slug('x'), s.slug('x'), s.slug('x')]).toEqual(['x', 'x-1', 'x-2']);
    });
    it('dedupe works on the slug, not the raw text', () => {
        const s = createSlugger();
        expect([s.slug('Hello World'), s.slug('hello  world'.replace('  ', ' ')), s.slug('**Hello** World')]).toEqual(['hello-world', 'hello-world-1', 'hello-world-2']);
    });
    it('different slugs do not interact', () => {
        const s = createSlugger();
        expect([s.slug('a'), s.slug('b'), s.slug('a'), s.slug('b')]).toEqual(['a', 'b', 'a-1', 'b-1']);
    });
    it('empty slug returns null and does not advance counters', () => {
        const s = createSlugger();
        expect(s.slug('')).toBeNull();
        expect(s.slug('!!!')).toBeNull();
        expect(s.slug('x')).toBe('x');
        expect(s.slug('')).toBeNull();
        expect(s.slug('x')).toBe('x-1');
    });
    it('a literal `x-1` heading after two `x` headings does not collide (x, x-1, x-1-1)', () => {
        const s = createSlugger();
        expect([s.slug('x'), s.slug('x'), s.slug('x-1')]).toEqual(['x', 'x-1', 'x-1-1']);
    });
    it('each slugger is independent', () => {
        const a = createSlugger();
        const b = createSlugger();
        a.slug('x'); a.slug('x');
        expect(b.slug('x')).toBe('x');
        expect(a.slug('x')).toBe('x-2');
    });
    it('slug() applies headingSlug rules', () => {
        const s = createSlugger();
        expect(s.slug('Link [text](http://x.y)')).toBe('link-text');
        expect(s.slug('Link [text](http://x.y)')).toBe('link-text-1');
    });
});
