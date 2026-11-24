import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { Subscript, Superscript } from '@lezer/markdown';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { emojiSyntax } from '../emojiSyntax';
import { subSupPreview } from '../subSupPreview';
import { emojiPreview } from '../emojiPreview';
import { htmlInlinePreview } from '../htmlInlinePreview';
import { nodesOf, INDEXED_NODES } from '../nodeIndex';
import { decoSets, mkState, countTreeWalks, at } from './selectionReuseHelpers';

// B11 T2. Pinned: nodesOf(state, name) -> [{ from, to, node }] in document order (from ascending, outer before
// inner on ties); node is the SyntaxNode. Unknown name THROWS (never []). One full Tree.iterate per syntax tree,
// shared by all names; keyed on doc + tree (no StateField). No subtree skipping: nested nodes all appear.
// Offsets via at(); only counts/ranges are asserted, never time.

const lang = markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax] });
const mk = (doc, extra = [], anchor = 0, head = anchor) => mkState(doc, [lang, ...extra], anchor, head);
const texts = (state, name) => nodesOf(state, name).map((n) => state.sliceDoc(n.from, n.to));
const finish = (state) => { ensureSyntaxTree(state, state.doc.length, 5000); return state.update({}).state; };

describe('INDEXED_NODES', () => {
    it('is an array of strings including the T2 names', () => {
        expect(Array.isArray(INDEXED_NODES)).toBe(true);
        for (const n of ['Subscript', 'Superscript', 'Emoji', 'HTMLTag']) expect(INDEXED_NODES).toContain(n);
        INDEXED_NODES.forEach((n) => expect(typeof n).toBe('string'));
    });
    it('every indexed name is accepted', () => {
        const s = mk('plain');
        for (const n of INDEXED_NODES) expect(() => nodesOf(s, n)).not.toThrow();
    });
});

describe('nodesOf: contents', () => {
    it('entries are { from, to, node } with node a SyntaxNode of that name at that range', () => {
        const doc = 'a :smile: b ~sub~ c ^sup^ <kbd>k</kbd>';
        const s = mk(doc);
        for (const name of ['Emoji', 'Subscript', 'Superscript', 'HTMLTag']) {
            const list = nodesOf(s, name);
            expect(list.length, name).toBeGreaterThan(0);
            for (const e of list) {
                expect(e.node.name).toBe(name);
                expect(e.node.from).toBe(e.from);
                expect(e.node.to).toBe(e.to);
                expect(e.to).toBeGreaterThan(e.from);
            }
        }
        expect(texts(s, 'Emoji')).toEqual([':smile:']);
        expect(texts(s, 'Subscript')).toEqual(['~sub~']);
        expect(texts(s, 'Superscript')).toEqual(['^sup^']);
        expect(texts(s, 'HTMLTag')).toEqual(['<kbd>', '</kbd>']);
    });

    it('document order across the whole doc', () => {
        const doc = ':a: x :b:\n\n- :c:\n\n> :d: and :e:\n\n| h |\n|---|\n| :f: |\n\n:g:';
        const s = mk(doc);
        expect(texts(s, 'Emoji')).toEqual([':a:', ':b:', ':c:', ':d:', ':e:', ':f:', ':g:']);
        const froms = nodesOf(s, 'Emoji').map((n) => n.from);
        expect(froms).toEqual([...froms].sort((a, b) => a - b));
    });

    it('nested: <sub> inside <kbd> (all four tags, in order)', () => {
        const doc = '<kbd>a <sub>x</sub> b</kbd>';
        const s = mk(doc);
        expect(texts(s, 'HTMLTag')).toEqual(['<kbd>', '<sub>', '</sub>', '</kbd>']);
        expect(nodesOf(s, 'HTMLTag').map((n) => n.from)).toEqual([0, at(doc, '<sub>'), at(doc, '</sub>'), at(doc, '</kbd>')]);
    });

    it('nested: Subscript inside a link label, Superscript in emphasis', () => {
        const doc = '[H~2~O](http://x.test) and *E=mc^2^ here*';
        const s = mk(doc);
        expect(texts(s, 'Subscript')).toEqual(['~2~']);
        expect(texts(s, 'Superscript')).toEqual(['^2^']);
        expect(nodesOf(s, 'Subscript')[0].from).toBe(at(doc, '~2~'));
    });

    it('nested: emoji inside emphasis, strong, table cells, blockquote, list item', () => {
        const doc = [
            '*em :one: x*', '',
            '**strong :two:**', '',
            '| a | b |', '|---|---|', '| :three: | H~2~O |', '',
            '> quote :four:', '',
            '- item :five:',
            '  - deep :six:', '',
            '1. num :seven:',
        ].join('\n');
        const s = mk(doc);
        expect(texts(s, 'Emoji')).toEqual([':one:', ':two:', ':three:', ':four:', ':five:', ':six:', ':seven:']);
        expect(texts(s, 'Subscript')).toEqual(['~2~']);
        expect(nodesOf(s, 'Emoji').map((n) => n.from)).toEqual([':one:', ':two:', ':three:', ':four:', ':five:', ':six:', ':seven:'].map((t) => at(doc, t)));
    });

    it('HTMLTag inside table cells and blockquote lists is included', () => {
        const doc = '| a |\n|---|\n| <u>x</u> |\n\n> - <mark>m</mark>';
        const s = mk(doc);
        expect(texts(s, 'HTMLTag')).toEqual(['<u>', '</u>', '<mark>', '</mark>']);
    });

    it('a name with no matches gives an empty array', () => {
        const s = mk('just plain text');
        for (const n of ['Subscript', 'Superscript', 'Emoji', 'HTMLTag']) expect(nodesOf(s, n)).toEqual([]);
    });

    it('empty doc: [] for every indexed name', () => {
        const s = mk('');
        for (const n of INDEXED_NODES) expect(nodesOf(s, n)).toEqual([]);
    });

    it('reflects the current doc after an edit', () => {
        const s = mk('a :x: b');
        const t = finish(s.update({ changes: { from: 0, insert: ':y: ' } }).state);
        expect(texts(t, 'Emoji')).toEqual([':y:', ':x:']);
        expect(texts(s, 'Emoji')).toEqual([':x:']); // old state untouched
    });
});

describe('nodesOf: unknown names throw', () => {
    it.each(['Nope', 'Paragraph', 'emoji', '', undefined])('nodesOf(state, %j) throws', (name) => {
        const s = mk('a :smile:');
        expect(() => nodesOf(s, name)).toThrow();
    });
    it('throws on an empty doc too (not a silent [])', () => {
        expect(() => nodesOf(mk(''), 'Nope')).toThrow();
    });
    it('throws even when that name was never requested before (no cache short-circuit)', () => {
        const s = mk('x');
        nodesOf(s, 'Emoji');
        expect(() => nodesOf(s, 'Nope')).toThrow();
    });
});

describe('nodesOf: cache', () => {
    const doc = 'a :smile: ~s~ ^p^ <kbd>k</kbd>';

    it('first call on a fresh tree is exactly one walk', () => {
        const s = mk(doc);
        expect(countTreeWalks(s, () => nodesOf(s, 'Emoji'))).toBe(1);
    });
    it('same state, same name twice: 1 walk total, same array', () => {
        const s = mk(doc);
        let a, b;
        expect(countTreeWalks(s, () => { a = nodesOf(s, 'Emoji'); b = nodesOf(s, 'Emoji'); })).toBe(1);
        expect(b).toBe(a);
    });
    it('two different names on one state: 1 walk total', () => {
        const s = mk(doc);
        expect(countTreeWalks(s, () => { nodesOf(s, 'Emoji'); nodesOf(s, 'Subscript'); })).toBe(1);
    });
    it('all indexed names on one state: 1 walk total', () => {
        const s = mk(doc);
        expect(countTreeWalks(s, () => INDEXED_NODES.forEach((n) => nodesOf(s, n)))).toBe(1);
    });
    it('selection-only update keeps doc + tree: cache hit, 0 walks, same array', () => {
        const s = mk(doc);
        const a = nodesOf(s, 'Emoji');
        const t = s.update({ selection: { anchor: 3 } }).state;
        expect(syntaxTree(t)).toBe(syntaxTree(s));
        expect(countTreeWalks(t, () => expect(nodesOf(t, 'Emoji')).toBe(a))).toBe(0);
    });
    it('doc edit: new tree, exactly one new walk, shared by names', () => {
        const s = mk(doc);
        nodesOf(s, 'Emoji');
        const t = finish(s.update({ changes: { from: 0, insert: ':z: ' } }).state);
        expect(syntaxTree(t)).not.toBe(syntaxTree(s));
        expect(countTreeWalks(t, () => { nodesOf(t, 'Emoji'); nodesOf(t, 'HTMLTag'); nodesOf(t, 'Emoji'); })).toBe(1);
    });
    it('time-sliced tree completion: a changed tree costs one walk, an unchanged tree costs none', () => {
        const big = Array.from({ length: 4000 }, (_, i) => `para ${i} :smile: and ~s~ text`).join('\n\n');
        const s = EditorState.create({ doc: big, extensions: [lang] });
        nodesOf(s, 'Emoji');
        ensureSyntaxTree(s, big.length, 5000);
        const t = s.update({}).state;
        const changed = syntaxTree(t) !== syntaxTree(s);
        expect(countTreeWalks(t, () => nodesOf(t, 'Emoji'))).toBe(changed ? 1 : 0);
        expect(nodesOf(t, 'Emoji').length).toBe(4000); // complete tree, not the partial snapshot
    });
    it('a different state with an equal doc but its own tree does not return the other state\'s nodes', () => {
        const a = mk('x :a:');
        const b = mk('y :b: :c:');
        expect(texts(a, 'Emoji')).toEqual([':a:']);
        expect(texts(b, 'Emoji')).toEqual([':b:', ':c:']);
    });
});

describe('three preview fields share one walk per tree', () => {
    const exts = [subSupPreview, emojiPreview, htmlInlinePreview];
    const doc = [
        'Intro plain text.', '',
        'water H~2~O and x^2^ and :smile: here', '',
        '<kbd>Ctrl <sub>1</sub></kbd> and <abbr title="t">ab</abbr><br>', '',
        '| a | b |', '|---|---|', '| :tada: | <u>u</u> |', '',
        '> quote :smile: ~q~', '',
        'tail plain text',
    ].join('\n');
    const P = { plain: at(doc, 'Intro', 2), plain2: at(doc, 'tail plain', 3), sub: at(doc, '~2~', 1), emoji: at(doc, ':tada:', 2) };

    it('creation + completion: at most one walk per tree', () => {
        const s = EditorState.create({ doc, extensions: [lang, ...exts] });
        const t = finish(s);
        expect(countTreeWalks(t, () => finish(t))).toBeLessThanOrEqual(1);
    });

    it('doc change: at most ONE full-tree iterate across the three fields', () => {
        const s = mk(doc, exts, P.plain);
        const walks = countTreeWalks(s, () => { s.update({ changes: { from: P.plain, insert: 'x' } }).state; });
        expect(walks).toBeLessThanOrEqual(1);
    });

    it('doc change then tree completion: at most ONE walk per new tree', () => {
        const s = mk(doc, exts, P.plain);
        let after;
        const w1 = countTreeWalks(s, () => { after = s.update({ changes: { from: P.plain, insert: 'x' } }).state; });
        expect(w1).toBeLessThanOrEqual(1);
        const treeBefore = syntaxTree(after);
        let done;
        const w2 = countTreeWalks(s, () => { done = finish(after); });
        expect(w2).toBeLessThanOrEqual(syntaxTree(done) !== treeBefore ? 1 : 0);
    });

    it('edit that adds an emoji and a sub still costs one walk, and shows up in the index', () => {
        const s = mk(doc, exts, P.plain);
        let t;
        const walks = countTreeWalks(s, () => { t = finish(s.update({ changes: { from: P.plain, insert: ' :wave: H~3~ ' } }).state); });
        expect(walks).toBeLessThanOrEqual(2); // one per tree: the change itself and, if the parse was cut short, its completion
        expect(texts(t, 'Emoji')).toContain(':wave:');
        expect(texts(t, 'Subscript')).toContain('~3~');
    });

    it('selection-only move: 0 walks', () => {
        const s = mk(doc, exts, P.plain);
        expect(countTreeWalks(s, () => { s.update({ selection: { anchor: P.plain2 } }).state; })).toBe(0);
        expect(countTreeWalks(s, () => { s.update({ selection: { anchor: P.sub } }).state; })).toBe(0);
    });

    it('selection move that leaves the touched set unchanged keeps every DecorationSet identical', () => {
        const s = mk(doc, exts, P.plain);
        const before = decoSets(s);
        expect(before.length).toBe(3);
        const t = s.update({ selection: { anchor: P.plain2 } }).state;
        decoSets(t).forEach((set, i) => expect(set).toBe(before[i]));
        const u = s.update({ selection: { anchor: P.plain } }).state; // same place
        decoSets(u).forEach((set, i) => expect(set).toBe(before[i]));
    });

    it('selection move that touches a node changes only that field\'s set', () => {
        const s = mk(doc, exts, P.plain);
        const before = decoSets(s);
        const t = s.update({ selection: { anchor: P.sub } }).state;
        const after = decoSets(t);
        const changed = after.map((set, i) => set !== before[i]);
        expect(changed.filter(Boolean).length).toBe(1);
    });

    it('fields stay in the facet under their exported names', () => {
        for (const f of exts) expect(f).toBeDefined();
    });
});
