import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { Subscript, Superscript } from '@lezer/markdown';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax } from '../frontMatterSyntax';
import { livePreview } from '../livePreview';
import { subSupPreview } from '../subSupPreview';

// F6 T1 editor preview. Pinned choices (spec silent / task contract):
//  - Touching = isCursorTouching(selection, node.from, node.to): any range with range.from <= to && range.to >= from,
//    node = the whole Subscript/Superscript (marks included). Cursor right before the opening mark or right after the
//    closing mark TOUCHES; one char further away does not.
//  - Not touching: both marks replaced (Decoration.replace -> absent from the DOM text) and the content between them
//    carries mark class cm-subscript / cm-superscript. Touching: nothing from this extension (raw source, no class).
//  - Content is not re-parsed; whatever livePreview does inside (escape backslash hiding) is its own business.
//  - subSupPreview is a StateField providing EditorView.decorations (a plain DecorationSet in the facet), so the
//    structural-identity test can see it. A ViewPlugin would not pass the identity test.
//  - Not asserted (jsdom): real CSS rendering.
const views = [];
const mkView = (doc, anchor = doc.length, head = anchor) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({
            doc,
            selection: { anchor, head },
            extensions: [
                EditorState.allowMultipleSelections.of(true),
                markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript] }),
                livePreview, subSupPreview,
            ],
        }),
        parent,
    });
    ensureSyntaxTree(view.state, view.state.doc.length, 5000);
    view.dispatch({ selection: { anchor, head } }); // force a decoration rebuild with the tree ready
    views.push(view);
    return view;
};
const qa = (v, sel) => [...v.dom.querySelectorAll(sel)];
const lineEl = (v, text) => qa(v, '.cm-line').find((l) => l.textContent.includes(text.replace(/[~^\\]/g, '')) || l.textContent.includes(text));
const setSel = (v, anchor, head = anchor) => v.dispatch({ selection: { anchor, head } });
const text = (v) => qa(v, '.cm-content')[0].textContent;

afterEach(() => {
    while (views.length) views.pop().destroy();
    document.body.innerHTML = '';
});

// The decoration set(s) holding sub/sup marks, found structurally (not by timing).
const subSupSets = (v) => v.state.facet(EditorView.decorations).filter((d) => {
    if (typeof d === 'function') return false;
    let hit = false;
    d.between(0, v.state.doc.length, (_f, _t, val) => {
        if (/cm-su(b|per)script/.test(val.spec.class || '')) { hit = true; return false; }
    });
    return hit;
});

describe('subSupPreview: hidden when the cursor is away', () => {
    it('H~2~O: tildes gone, 2 wrapped in .cm-subscript', () => {
        const v = mkView('H~2~O\n\ntail', 'H~2~O\n\ntail'.length);
        expect(lineEl(v, 'H2O').textContent).toBe('H2O');
        const s = qa(v, '.cm-subscript');
        expect(s).toHaveLength(1);
        expect(s[0].textContent).toBe('2');
        expect(qa(v, '.cm-superscript')).toHaveLength(0);
    });
    it('x^2^: carets gone, 2 wrapped in .cm-superscript', () => {
        const v = mkView('x^2^\n\ntail');
        expect(lineEl(v, 'x2').textContent).toBe('x2');
        const s = qa(v, '.cm-superscript');
        expect(s).toHaveLength(1);
        expect(s[0].textContent).toBe('2');
        expect(qa(v, '.cm-subscript')).toHaveLength(0);
    });
    it('multi-char content and two nodes in a line', () => {
        const v = mkView('a~xy~ b^zw^ c\n\ntail');
        expect(qa(v, '.cm-subscript').map((e) => e.textContent)).toEqual(['xy']);
        expect(qa(v, '.cm-superscript').map((e) => e.textContent)).toEqual(['zw']);
        expect(lineEl(v, 'axy').textContent).toBe('axy bzw c');
    });
    it('content class wraps ONLY the content, not the marks', () => {
        const v = mkView('H~2~O\n\ntail');
        expect(qa(v, '.cm-subscript')[0].textContent).not.toMatch(/[~^]/);
    });
    it('works inside heading, blockquote and list item', () => {
        for (const doc of ['# H~2~O\n\ntail', '> H~2~O\n\ntail', '- H~2~O\n\ntail']) {
            const v = mkView(doc);
            expect(qa(v, '.cm-subscript').map((e) => e.textContent)).toEqual(['2']);
            expect(text(v)).not.toContain('~');
        }
    });
    it('escaped space: ~a\\ b~ still renders as subscript with marks hidden', () => {
        const v = mkView('x ~a\\ b~ y\n\ntail');
        const s = qa(v, '.cm-subscript');
        expect(s).toHaveLength(1);
        expect(s[0].textContent).toMatch(/^a.?b$/);
        expect(text(v)).not.toContain('~');
    });
});

describe('subSupPreview: raw when the selection touches', () => {
    const doc = 'H~2~O\n\ntail';
    const open = doc.indexOf('~');
    const close = doc.lastIndexOf('~', doc.indexOf('O'));
    it('cursor inside the content: raw source, no class', () => {
        const v = mkView(doc, open + 2);
        expect(lineEl(v, 'H~2~O').textContent).toBe('H~2~O');
        expect(qa(v, '.cm-subscript')).toHaveLength(0);
    });
    it('cursor right before the opening mark and right after the closing mark both touch', () => {
        const v = mkView(doc, open);
        expect(qa(v, '.cm-subscript')).toHaveLength(0);
        expect(text(v)).toContain('H~2~O');
        setSel(v, close + 1);
        expect(qa(v, '.cm-subscript')).toHaveLength(0);
        expect(text(v)).toContain('H~2~O');
    });
    it('one char further away does not touch', () => {
        const v = mkView(doc, open - 1);
        expect(qa(v, '.cm-subscript')).toHaveLength(1);
        setSel(v, close + 2);
        expect(qa(v, '.cm-subscript')).toHaveLength(1);
    });
    it('a selection range overlapping the node touches, even from outside it', () => {
        const v = mkView(doc, 0, open + 1);
        expect(qa(v, '.cm-subscript')).toHaveLength(0);
        expect(text(v)).toContain('H~2~O');
    });
    it('a selection that ends exactly where the node starts touches', () => {
        const v = mkView(doc, 0, open);
        expect(qa(v, '.cm-subscript')).toHaveLength(0);
    });
    it('only the touched node goes raw; the other stays hidden', () => {
        const d = 'a~1~ and b^2^\n\ntail';
        const v = mkView(d, d.indexOf('~') + 1);
        expect(qa(v, '.cm-subscript')).toHaveLength(0);
        expect(qa(v, '.cm-superscript').map((e) => e.textContent)).toEqual(['2']);
        expect(lineEl(v, 'a~1~').textContent).toBe('a~1~ and b2');
    });
    it('multi-cursor: touching with any range reveals', () => {
        const d = 'a~1~ and b^2^\n\ntail';
        const v = mkView(d, d.length);
        v.dispatch({ selection: EditorSelection.create([EditorSelection.cursor(d.length), EditorSelection.cursor(d.indexOf('^') + 1)], 0) });
        expect(v.state.selection.ranges).toHaveLength(2); // setup check: both cursors really exist
        expect(qa(v, '.cm-superscript')).toHaveLength(0);
        expect(qa(v, '.cm-subscript')).toHaveLength(1);
    });
    it('moving away hides again; moving in reveals again', () => {
        const v = mkView(doc, open + 2);
        expect(qa(v, '.cm-subscript')).toHaveLength(0);
        setSel(v, doc.length);
        expect(qa(v, '.cm-subscript')).toHaveLength(1);
        setSel(v, open + 2);
        expect(qa(v, '.cm-subscript')).toHaveLength(0);
    });
    it('typing inside the node updates the content class text', () => {
        const v = mkView('H~2~O\n\ntail', doc.length);
        v.dispatch({ changes: { from: open + 2, insert: '3' }, selection: { anchor: doc.length + 1 } });
        expect(qa(v, '.cm-subscript').map((e) => e.textContent)).toEqual(['23']);
    });
    it('breaking the syntax (typing a space) drops the class', () => {
        const v = mkView('H~2~O\n\ntail', doc.length);
        v.dispatch({ changes: { from: open + 2, insert: ' ' }, selection: { anchor: doc.length + 1 } });
        expect(qa(v, '.cm-subscript')).toHaveLength(0);
        expect(text(v)).toContain('H~2 ~O');
    });
});

describe('subSupPreview: nothing where nothing parses', () => {
    it.each([
        ['inline code', '`H~2~O` and `x^2^`\n\ntail'],
        ['fenced code', '```\nH~2~O x^2^\n```\n\ntail'],
        ['tilde fence', '~~~\nH~2~O x^2^\n~~~\n\ntail'],
        ['math', '$x^2^$\n\ntail'],
        ['strikethrough', '~~del~~\n\ntail'],
        ['inline footnote', 'a^[note]\n\ntail'],
        ['spaced', '~a b~ ^c d^\n\ntail'],
    ])('%s: no sub/sup class', (_n, doc) => {
        const v = mkView(doc);
        expect(qa(v, '.cm-subscript')).toHaveLength(0);
        expect(qa(v, '.cm-superscript')).toHaveLength(0);
    });
    it('inline code keeps its tildes visible', () => {
        const v = mkView('`H~2~O`\n\ntail');
        expect(text(v)).toContain('H~2~O');
    });
});

describe('subSupPreview: selection-only fast path (structural identity)', () => {
    let doc = 'A H~1~ and x^2^ end\n\n';
    for (let i = 0; i < 40; i++) doc += `plain ${i}\n\n`;
    const plain = (n) => doc.indexOf(`plain ${n}\n`) + 2;
    const subAt = doc.indexOf('~1~') + 1;
    const supAt = doc.indexOf('^2^') + 1;

    it('the extension exposes a plain DecorationSet in the facet', () => {
        const v = mkView(doc, plain(3));
        expect(subSupSets(v)).toHaveLength(1);
    });
    it('moves that keep the touched-node set unchanged return the identical set', () => {
        const v = mkView(doc, plain(3));
        const before = subSupSets(v);
        expect(before).toHaveLength(1);
        setSel(v, plain(20));
        expect(subSupSets(v)[0]).toBe(before[0]);
        setSel(v, plain(35), plain(36));
        expect(subSupSets(v)[0]).toBe(before[0]);
    });
    it('touching a node changes the set; moving within it keeps the new set; leaving restores a set again', () => {
        const v = mkView(doc, plain(3));
        const before = subSupSets(v)[0];
        setSel(v, subAt);
        const inside = subSupSets(v);
        expect(inside).toHaveLength(1);       // the other node is still hidden
        expect(inside[0]).not.toBe(before);
        setSel(v, subAt + 1);
        expect(subSupSets(v)[0]).toBe(inside[0]);
        setSel(v, plain(30));
        expect(subSupSets(v)).toHaveLength(1);
        expect(subSupSets(v)[0]).not.toBe(inside[0]);
    });
    it('moving from one node to the other changes the set', () => {
        const v = mkView(doc, subAt);
        const a = subSupSets(v)[0];
        setSel(v, supAt);
        expect(subSupSets(v)[0]).not.toBe(a);
    });
    it('a document change rebuilds (new set), and the new content is decorated', () => {
        const v = mkView(doc, plain(3));
        const before = subSupSets(v)[0];
        v.dispatch({ changes: { from: 0, insert: 'Z' }, selection: { anchor: plain(3) + 1 } });
        expect(subSupSets(v)[0]).not.toBe(before);
        expect(qa(v, '.cm-subscript').map((e) => e.textContent)).toEqual(['1']);
    });
});

describe('source guards', () => {
    const own = readFileSync(resolve(process.cwd(), 'src/extensions/subSupPreview.js'), 'utf8');
    const cssFiles = (dir) => readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? cssFiles(p) : /\.css$/.test(f) ? [p] : [];
    });
    const allStyle = [own, ...cssFiles(resolve(process.cwd(), 'src')).map((p) => readFileSync(p, 'utf8'))].join('\n');
    const rule = (cls) => (allStyle.match(new RegExp(`\\.${cls}\\b[^{}]*\\{([^}]*)\\}`)) || [])[1] || '';

    it('reuses isCursorTouching from ./selection (one touching rule across extensions)', () => {
        expect(own).toMatch(/import\s*\{[^}]*\bisCursorTouching\b[^}]*\}\s*from\s*['"]\.\/selection['"]/);
    });
    it('.cm-subscript: vertical-align sub, smaller font', () => {
        expect(rule('cm-subscript')).toMatch(/vertical-align:\s*sub/);
        expect(rule('cm-subscript')).toMatch(/font-size:/);
    });
    it('.cm-superscript: vertical-align super, smaller font', () => {
        expect(rule('cm-superscript')).toMatch(/vertical-align:\s*super/);
        expect(rule('cm-superscript')).toMatch(/font-size:/);
    });
});
