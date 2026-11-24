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
import { emojiSyntax } from '../emojiSyntax';
import { livePreview } from '../livePreview';
import { emojiPreview } from '../emojiPreview';
import { emojiFor } from '../../utils/emojiTable';

// F6 T2 editor preview. Pinned choices (spec silent / task contract):
//  - Touching = isCursorTouching(selection, node.from, node.to) on the whole Emoji node (colons included): cursor
//    right before the opening colon or right after the closing colon TOUCHES; one char further does not.
//  - Not touching + known name: the whole `:name:` is replaced by a widget <span class="cm-emoji" role="img"
//    aria-label="name"> whose textContent is the emoji (textContent, never innerHTML). The source text is absent.
//  - Unknown name (incl. names the table lacks, uppercase): no decoration, source stays raw, touched or not.
//  - Touching: nothing from this extension (raw source).
//  - emojiPreview is a StateField providing EditorView.decorations (a plain DecorationSet in the facet), so the
//    structural-identity test can see it. The set is reused when only the selection moves and the touched set is unchanged.
//  - Widget eq compares the name (observed via the widgets in the facet's decoration set).
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
                markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax, frontMatterSyntax, Subscript, Superscript, emojiSyntax] }),
                livePreview, emojiPreview,
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
const setSel = (v, anchor, head = anchor) => v.dispatch({ selection: { anchor, head } });
const text = (v) => qa(v, '.cm-content')[0].textContent;
const SMILE = emojiFor('smile'), TADA = emojiFor('tada');

afterEach(() => {
    while (views.length) views.pop().destroy();
    document.body.innerHTML = '';
});

// Decoration sets in the facet that hold emoji widgets (found structurally: the widget builds span.cm-emoji).
const widgetsIn = (v, set) => {
    const out = [];
    set.between(0, v.state.doc.length, (_f, _t, val) => {
        const w = val.spec.widget;
        if (!w || typeof w.toDOM !== 'function') return;
        const el = w.toDOM(v);
        if (el && el.classList && el.classList.contains('cm-emoji')) out.push(w);
    });
    return out;
};
const emojiSets = (v) => v.state.facet(EditorView.decorations).filter((d) => typeof d !== 'function' && widgetsIn(v, d).length > 0);

describe('emojiPreview: widget when the cursor is away', () => {
    it(':smile: -> span.cm-emoji with the emoji as textContent, source gone', () => {
        const v = mkView('a :smile: b\n\ntail', 'a :smile: b\n\ntail'.length);
        const e = qa(v, '.cm-emoji');
        expect(e).toHaveLength(1);
        expect(e[0].tagName).toBe('SPAN');
        expect(e[0].textContent).toBe(SMILE);
        expect(text(v)).toContain(`a ${SMILE} b`);
        expect(text(v)).not.toContain(':smile:');
    });
    it('accessibility: role=img and aria-label is the name', () => {
        const v = mkView(':smile: :tada:\n\ntail');
        const e = qa(v, '.cm-emoji');
        expect(e.map((x) => x.getAttribute('role'))).toEqual(['img', 'img']);
        expect(e.map((x) => x.getAttribute('aria-label'))).toEqual(['smile', 'tada']);
        expect(e.map((x) => x.textContent)).toEqual([SMILE, TADA]);
    });
    it('the emoji goes in via textContent: no child elements', () => {
        const v = mkView(':heart:\n\ntail');
        const e = qa(v, '.cm-emoji')[0];
        expect(e.children).toHaveLength(0);
        expect(e.textContent).toBe(emojiFor('heart'));
    });
    it('names with + and - work (lezer\'s built-in rule could not parse these)', () => {
        const names = ['+1', '-1', 't-rex', 'e-mail', 'non-potable_water'];
        const v = mkView(':+1: :-1: :t-rex: :e-mail: :non-potable_water:\n\ntail');
        expect(qa(v, '.cm-emoji').map((e) => e.getAttribute('aria-label'))).toEqual(names);
        expect(qa(v, '.cm-emoji').map((e) => e.textContent)).toEqual(names.map(emojiFor));
        expect(text(v)).not.toMatch(/:\+1:|:t-rex:/);
    });
    it('alias names work: thumbsup', () => {
        const v = mkView(':thumbsup:\n\ntail');
        expect(qa(v, '.cm-emoji').map((e) => e.getAttribute('aria-label'))).toEqual(['thumbsup']);
    });
    it('several in one line, adjacent ones included', () => {
        const v = mkView(':smile::tada: x :smile:\n\ntail');
        expect(qa(v, '.cm-emoji').map((e) => e.textContent)).toEqual([SMILE, TADA, SMILE]);
    });
    it('works inside heading, blockquote, list item, emphasis and link text', () => {
        for (const doc of ['# :smile:\n\ntail', '> :smile:\n\ntail', '- :smile:\n\ntail', '**:smile:**\n\ntail', '[:smile:](http://x.test)\n\ntail']) {
            const v = mkView(doc);
            expect(qa(v, '.cm-emoji').map((e) => e.textContent)).toEqual([SMILE]);
            expect(text(v)).not.toContain(':smile:');
        }
    });
});

describe('emojiPreview: raw when the selection touches', () => {
    const doc = 'a :smile: b\n\ntail';
    const open = doc.indexOf(':smile:');
    const close = open + ':smile:'.length;
    it('cursor inside: raw source, no widget', () => {
        const v = mkView(doc, open + 3);
        expect(qa(v, '.cm-emoji')).toHaveLength(0);
        expect(text(v)).toContain('a :smile: b');
    });
    it('cursor right before the opening colon and right after the closing colon both touch', () => {
        const v = mkView(doc, open);
        expect(qa(v, '.cm-emoji')).toHaveLength(0);
        setSel(v, close);
        expect(qa(v, '.cm-emoji')).toHaveLength(0);
        expect(text(v)).toContain(':smile:');
    });
    it('one char further away does not touch', () => {
        const v = mkView(doc, open - 1);
        expect(qa(v, '.cm-emoji')).toHaveLength(1);
        setSel(v, close + 1);
        expect(qa(v, '.cm-emoji')).toHaveLength(1);
    });
    it('a selection range overlapping the node touches, even from outside it', () => {
        const v = mkView(doc, 0, open + 2);
        expect(qa(v, '.cm-emoji')).toHaveLength(0);
        expect(text(v)).toContain(':smile:');
    });
    it('only the touched shortcode goes raw; the other stays a widget', () => {
        const d = ':smile: and :tada:\n\ntail';
        const v = mkView(d, d.indexOf(':smile:') + 2);
        expect(qa(v, '.cm-emoji').map((e) => e.getAttribute('aria-label'))).toEqual(['tada']);
        expect(text(v)).toContain(`:smile: and ${TADA}`);
    });
    it('multi-cursor: any touching range reveals', () => {
        const d = ':smile: and :tada:\n\ntail';
        const v = mkView(d, d.length);
        v.dispatch({ selection: EditorSelection.create([EditorSelection.cursor(d.length), EditorSelection.cursor(d.indexOf(':tada:') + 2)], 0) });
        expect(v.state.selection.ranges).toHaveLength(2); // setup check
        expect(qa(v, '.cm-emoji').map((e) => e.getAttribute('aria-label'))).toEqual(['smile']);
    });
    it('moving away shows the widget again; moving in reveals again', () => {
        const v = mkView(doc, open + 3);
        expect(qa(v, '.cm-emoji')).toHaveLength(0);
        setSel(v, doc.length);
        expect(qa(v, '.cm-emoji')).toHaveLength(1);
        setSel(v, open + 3);
        expect(qa(v, '.cm-emoji')).toHaveLength(0);
    });
    it('typing the closing colon makes the shortcode appear; deleting it removes the widget', () => {
        const v = mkView('a :smile b\n\ntail', 'a :smile b\n\ntail'.length);
        expect(qa(v, '.cm-emoji')).toHaveLength(0);
        const at = v.state.doc.toString().indexOf(' b');
        v.dispatch({ changes: { from: at, insert: ':' }, selection: { anchor: v.state.doc.length + 1 } });
        expect(qa(v, '.cm-emoji').map((e) => e.textContent)).toEqual([SMILE]);
        v.dispatch({ changes: { from: at, to: at + 1 }, selection: { anchor: v.state.doc.length - 1 } });
        expect(qa(v, '.cm-emoji')).toHaveLength(0);
    });
});

describe('emojiPreview: nothing where nothing is a known shortcode', () => {
    it.each([
        ['unknown name', ':notanemoji:\n\ntail'],
        ['uppercase', ':SMILE:\n\ntail'],
        ['only a hyphen', ':-:\n\ntail'],
        ['boundary: letter before', 'a:smile:\n\ntail'],
        ['boundary: letter after', ':smile:b\n\ntail'],
        ['boundary: digits', '12:100:45\n\ntail'],
        ['time', '10:30:45\n\ntail'],
        ['url', 'http://x.test\n\ntail'],
        ['double colon', 'a::b\n\ntail'],
        ['inline code', '`:smile:`\n\ntail'],
        ['fenced code', '```\n:smile:\n```\n\ntail'],
        ['tilde fence', '~~~\n:smile:\n~~~\n\ntail'],
        ['indented code', '    :smile:\n\ntail'],
        ['math', '$:smile:$\n\ntail'],
        ['link url', '[a](http://x.test/:smile:)\n\ntail'],
        ['autolink', 'http://x.test/a:smile:b\n\ntail'],
        ['front matter', '---\ntitle: :smile:\n---\n\ntail'],
        ['escaped', '\\:smile:\n\ntail'],
        ['inside sub', 'H~:smile:~\n\ntail'],
    ])('%s: no widget, source text intact', (_n, doc) => {
        const v = mkView(doc);
        expect(qa(v, '.cm-emoji')).toHaveLength(0);
        expect(text(v)).not.toContain(SMILE);
    });
    it('unknown name stays raw even when the cursor is far away', () => {
        const v = mkView(':notanemoji: x\n\ntail');
        expect(text(v)).toContain(':notanemoji: x');
    });
    it('a known and an unknown name in one line: only the known one is a widget', () => {
        const v = mkView(':smile: :nope: :tada:\n\ntail');
        expect(qa(v, '.cm-emoji').map((e) => e.getAttribute('aria-label'))).toEqual(['smile', 'tada']);
        expect(text(v)).toContain(`${SMILE} :nope: ${TADA}`);
    });
});

describe('emojiPreview: widget eq compares the name', () => {
    it('same name -> equal widgets; different name -> not equal', () => {
        const v = mkView(':smile: :smile: :tada:\n\ntail');
        const [ws] = emojiSets(v).map((s) => widgetsIn(v, s));
        expect(ws).toHaveLength(3);
        expect(ws[0].eq(ws[1])).toBe(true);
        expect(ws[0].eq(ws[2])).toBe(false);
        expect(ws[2].eq(ws[0])).toBe(false);
    });
    it('eq is false against a foreign widget', () => {
        const v = mkView(':smile:\n\ntail');
        const [ws] = emojiSets(v).map((s) => widgetsIn(v, s));
        expect(ws[0].eq({})).toBe(false);
    });
});

describe('emojiPreview: selection-only fast path (structural identity)', () => {
    let doc = 'A :smile: and :tada: end\n\n';
    for (let i = 0; i < 40; i++) doc += `plain ${i}\n\n`;
    const plain = (n) => doc.indexOf(`plain ${n}\n`) + 2;
    const aAt = doc.indexOf(':smile:') + 3;
    const bAt = doc.indexOf(':tada:') + 3;

    it('the extension exposes a plain DecorationSet in the facet', () => {
        const v = mkView(doc, plain(3));
        expect(emojiSets(v)).toHaveLength(1);
    });
    it('moves that keep the touched set unchanged return the identical set', () => {
        const v = mkView(doc, plain(3));
        const before = emojiSets(v);
        expect(before).toHaveLength(1);
        setSel(v, plain(20));
        expect(emojiSets(v)[0]).toBe(before[0]);
        setSel(v, plain(35), plain(36));
        expect(emojiSets(v)[0]).toBe(before[0]);
    });
    it('touching a shortcode changes the set; moving within it keeps the new set; leaving restores a set again', () => {
        const v = mkView(doc, plain(3));
        const before = emojiSets(v)[0];
        setSel(v, aAt);
        const inside = emojiSets(v);
        expect(inside).toHaveLength(1);       // the other shortcode is still a widget
        expect(inside[0]).not.toBe(before);
        setSel(v, aAt + 1);
        expect(emojiSets(v)[0]).toBe(inside[0]);
        setSel(v, plain(30));
        expect(emojiSets(v)).toHaveLength(1);
        expect(emojiSets(v)[0]).not.toBe(inside[0]);
    });
    it('moving from one shortcode to the other changes the set', () => {
        const v = mkView(doc, aAt);
        const a = emojiSets(v)[0];
        setSel(v, bAt);
        expect(emojiSets(v)[0]).not.toBe(a);
    });
    it('a document change rebuilds (new set), and the new content is decorated', () => {
        const v = mkView(doc, plain(3));
        const before = emojiSets(v)[0];
        v.dispatch({ changes: { from: 0, insert: 'Z' }, selection: { anchor: plain(3) + 1 } });
        expect(emojiSets(v)[0]).not.toBe(before);
        expect(qa(v, '.cm-emoji').map((e) => e.textContent)).toEqual([SMILE, TADA]);
    });
});

describe('source guards', () => {
    const own = readFileSync(resolve(process.cwd(), 'src/extensions/emojiPreview.js'), 'utf8');
    const cssFiles = (dir) => readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? cssFiles(p) : /\.css$/.test(f) ? [p] : [];
    });
    const allStyle = [own, ...cssFiles(resolve(process.cwd(), 'src')).map((p) => readFileSync(p, 'utf8'))].join('\n');

    it('reuses isCursorTouching from ./selection (one touching rule across extensions)', () => {
        expect(own).toMatch(/import\s*\{[^}]*\bisCursorTouching\b[^}]*\}\s*from\s*['"]\.\/selection['"]|import\s*\{[^}]*\bselectionKeyedField\b[^}]*\}\s*from\s*['"]\.\/decorationField['"]/);
    });
    it('looks names up through emojiFor from ../utils/emojiTable', () => {
        expect(own).toMatch(/import\s*\{[^}]*\bemojiFor\b[^}]*\}\s*from\s*['"]\.\.\/utils\/emojiTable['"]/);
    });
    it('never writes innerHTML', () => {
        expect(own).not.toMatch(/innerHTML/);
    });
    it('.cm-emoji has a style rule (class is styled somewhere)', () => {
        expect(allStyle).toMatch(/\.cm-emoji\b[^{}]*\{[^}]*\}/);
    });
});
