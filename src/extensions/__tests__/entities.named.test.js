import { describe, it, expect, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { decodeEntity } from '../entities';
import { livePreview, buildDecorations } from '../livePreview';
import { TextSpanWidget } from '../widgets';

// B19 T1: decodeEntity decodes every HTML5 named entity (was 7 names).
//
// PINNED CONTRACT:
//  - decodeEntity(token) takes the whole token incl. & and ;. Missing either -> null.
//  - Numeric path unchanged (control chars <0x20 and 0x7F-0x9F, surrogates, >0x10FFFF, malformed digits -> null).
//  - Named: case-sensitive, [A-Za-z0-9]+ only, any HTML5 name WITH semicolon; the platform decoder's answer is used
//    (multi-codepoint names return both code points). Unknown name -> null. Inherited property names -> null.
//  - No-semicolon legacy forms (`&eacute`) -> null (no `;`).
//  - A numeric reference in the named slot is not a name: `&#;`, `&#x;`, `&#xZZ;` -> null.
//  - One pass: `&amp;eacute;` is not a single token (inner `&` is not in [A-Za-z0-9]) -> null.
//  - Pure: same input -> same output on repeated calls (memoisation is not observable otherwise).
//  - Output is text; no element is created in the document.

describe('decodeEntity: named, newly decoded', () => {
    it.each([
        ['&eacute;', 'é'], ['&Eacute;', 'É'], ['&frac12;', '½'], ['&hellip;', '…'], ['&mdash;', '—'],
        ['&euro;', '€'], ['&rarr;', '→'], ['&Aacute;', 'Á'], ['&szlig;', 'ß'], ['&alpha;', 'α'],
        ['&hearts;', '♥'], ['&trade;', '™'], ['&reg;', '®'], ['&times;', '×'], ['&ne;', '≠'],
        ['&frac34;', '¾'], ['&sup2;', '²'], ['&ndash;', '–'], ['&lsquo;', '‘'], ['&rdquo;', '”'],
        ['&Omega;', 'Ω'], ['&ouml;', 'ö'], ['&ntilde;', 'ñ'],
    ])('%s -> %s', (tok, ch) => {
        expect(decodeEntity(tok)).toBe(ch);
    });

    it('digits in names (&frac12; &sup2; &there4;) work', () => {
        expect(decodeEntity('&there4;')).toBe('∴');
    });

    it('multi-codepoint names return all code points', () => {
        expect(decodeEntity('&fjlig;')).toBe('fj');
        expect(decodeEntity('&NotEqualTilde;')).toBe('≂̸');
    });

    it('long name decodes', () => {
        expect(decodeEntity('&CounterClockwiseContourIntegral;')).toBe('∳');
    });

    it('repeated calls are stable (memoised or not)', () => {
        for (let i = 0; i < 3; i++) {
            expect(decodeEntity('&eacute;')).toBe('é');
            expect(decodeEntity('&notreal;')).toBeNull();
        }
    });
});

describe('decodeEntity: case sensitivity', () => {
    it('&eacute; and &Eacute; differ', () => {
        expect(decodeEntity('&eacute;')).not.toBe(decodeEntity('&Eacute;'));
    });
    it.each(['&EACUTE;', '&Copy;', '&Nbsp;'])('%s is not HTML5 spelling', (tok) => {
        expect(decodeEntity(tok)).toBeNull();
    });
    it('&AMP; (a real HTML5 name) decodes, mixed-case non-name does not', () => {
        expect(decodeEntity('&AMP;')).toBe('&');
        expect(decodeEntity('&eAcute;')).toBeNull();
    });
    it('&Eacute;-style mixed case that is not a name -> null', () => {
        expect(decodeEntity('&eAcute;')).toBeNull();
    });
});

describe('decodeEntity: old 7 names unchanged', () => {
    it.each([['&amp;', '&'], ['&lt;', '<'], ['&gt;', '>'], ['&quot;', '"'], ['&apos;', "'"], ['&copy;', '©'], ['&nbsp;', '\u00A0']])(
        '%s', (tok, ch) => { expect(decodeEntity(tok)).toBe(ch); });
    it('&nbsp; is U+00A0 exactly', () => {
        expect(decodeEntity('&nbsp;').charCodeAt(0)).toBe(0xA0);
        expect(decodeEntity('&nbsp;').length).toBe(1);
    });
});

describe('decodeEntity: null paths', () => {
    it.each([
        '&notreal;', '&EACUTE;', '&e-acute;', '&;', '&<b>;', '&e acute;', '&eacute ;', '& eacute;', '&é;', '&e_acute;',
        '&constructor;', '&__proto__;', '&toString;', '&hasOwnProperty;', '&valueOf;', '&prototype;',
    ])('%j -> null', (tok) => {
        expect(decodeEntity(tok)).toBeNull();
    });

    it.each(['&eacute', 'eacute;', 'eacute', '&amp', 'amp;', '', '&', ';'])('missing & or ; : %j -> null', (tok) => {
        expect(decodeEntity(tok)).toBeNull();
    });

    it('no trailing/leading junk accepted around a real name', () => {
        expect(decodeEntity('&eacute;x')).toBeNull();
        expect(decodeEntity('x&eacute;')).toBeNull();
        expect(decodeEntity(' &eacute;')).toBeNull();
    });

    it('two tokens are not one entity', () => {
        expect(decodeEntity('&eacute;&eacute;')).toBeNull();
        expect(decodeEntity('&lt;script&gt;')).toBeNull();
        expect(decodeEntity('&amp;eacute;')).toBeNull();
    });

    it('numeric-looking tokens in the name slot are not names', () => {
        expect(decodeEntity('&#;')).toBeNull();
        expect(decodeEntity('&#x;')).toBeNull();
        expect(decodeEntity('&#xZZ;')).toBeNull();
    });

    it('the inherited-name check does not poison real names afterwards', () => {
        decodeEntity('&constructor;');
        expect(decodeEntity('&eacute;')).toBe('é');
        expect(decodeEntity('&constructor;')).toBeNull();
    });
});

describe('decodeEntity: numeric path unchanged', () => {
    it.each([['&#233;', 'é'], ['&#xE9;', 'é'], ['&#XE9;', 'é'], ['&#65;', 'A'], ['&#x1F600;', '😀'], ['&#32;', ' '], ['&#126;', '~'], ['&#xA0;', '\u00A0'], ['&#160;', '\u00A0'], ['&#x10FFFF;', '\u{10FFFF}']])(
        '%s -> %j', (tok, ch) => { expect(decodeEntity(tok)).toBe(ch); });

    it.each([
        '&#0;', '&#1;', '&#31;', '&#x1F;', '&#127;', '&#x7F;', '&#128;', '&#x9F;', '&#159;',
        '&#xD800;', '&#xDFFF;', '&#55296;', '&#1114112;', '&#x110000;', '&#99999999999;',
        '&#abc;', '&#12a;', '&#xG1;', '&#-5;', '&#+5;', '&#x-5;',
    ])('%s -> null', (tok) => { expect(decodeEntity(tok)).toBeNull(); });

    it('boundaries just inside stay decoded: 0x20 and 0xA0', () => {
        expect(decodeEntity('&#32;')).toBe(' ');
        expect(decodeEntity('&#xA0;')).toBe(' ');
        expect(decodeEntity('&#x7E;')).toBe('~');
    });
});

describe('decodeEntity: output is text, never DOM', () => {
    it('&lt; decodes to "<" text and creates no element in the document', () => {
        const before = document.body.innerHTML;
        expect(decodeEntity('&lt;')).toBe('<');
        expect(decodeEntity('&gt;')).toBe('>');
        expect(document.body.innerHTML).toBe(before);
        expect(document.querySelector('script')).toBeNull();
    });
    it('return type is string or null', () => {
        for (const t of ['&eacute;', '&lt;', '&nope;', '&#233;', '&#0;']) {
            const r = decodeEntity(t);
            expect(r === null || typeof r === 'string').toBe(true);
        }
    });
});

// ---------- consumers, end to end ----------
const EXT = [markdown({ base: markdownLanguage }), livePreview];
const views = [];
afterEach(() => { while (views.length) views.pop().destroy(); });
const mkView = (doc, anchor, exts = EXT) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor }, extensions: exts }), parent });
    ensureSyntaxTree(view.state, view.state.doc.length, 5000);
    view.dispatch({ selection: { anchor } });
    views.push(view);
    return view;
};

describe('live preview body text', () => {
    const doc = 'p\n\nx &eacute; y\n\nz\n';
    const ent = doc.indexOf('&eacute;');

    it('cursor off: decoded é in a cm-entity span, raw name gone', () => {
        const v = mkView(doc, 0);
        const span = v.dom.querySelector('.cm-content .cm-entity');
        expect(span).not.toBeNull();
        expect(span.textContent).toBe('é');
        expect(span.children.length).toBe(0);
        expect(v.dom.querySelector('.cm-content').textContent).not.toContain('&eacute;');
    });

    it.each([[0], [1], [4]])('cursor inside the token (offset +%i) shows raw source, no cm-entity', (d) => {
        const v = mkView(doc, ent + d);
        expect(v.dom.querySelector('.cm-content').textContent).toContain('&eacute;');
        expect(v.dom.querySelector('.cm-content .cm-entity')).toBeNull();
    });

    it('cursor touching the end of the token shows source', () => {
        const v = mkView(doc, ent + '&eacute;'.length);
        expect(v.dom.querySelector('.cm-content').textContent).toContain('&eacute;');
    });

    it('buildDecorations: widget is a cm-entity TextSpanWidget with text é', () => {
        const state = EditorState.create({ doc, selection: { anchor: 0 }, extensions: EXT });
        ensureSyntaxTree(state, state.doc.length, 5000);
        const field = buildDecorations(state, { from: 0, to: doc.length });
        let w = null;
        field.between(ent, ent + 8, (f, t, val) => { if (f === ent && t === ent + 8) w = val.spec.widget; });
        expect(w).toBeInstanceOf(TextSpanWidget);
        expect(w.className).toBe('cm-entity');
        expect(w.text).toBe('é');
    });

    it('several names in one line each decode', () => {
        const v = mkView('p\n\n&frac12; &hellip; &Eacute;\n\nz\n', 0);
        const spans = [...v.dom.querySelectorAll('.cm-content .cm-entity')].map((s) => s.textContent);
        expect(spans).toEqual(['½', '…', 'É']);
    });

    it.each(['&notreal;', '&EACUTE;', '&toString;', '&constructor;'])('%s stays literal, no widget', (tok) => {
        const v = mkView(`p\n\nx ${tok} y\n\nz\n`, 0);
        expect(v.dom.querySelector('.cm-content').textContent).toContain(tok);
        expect(v.dom.querySelector('.cm-content .cm-entity')).toBeNull();
    });

    it('&lt;script&gt; shows as text, no element created', () => {
        const v = mkView('p\n\n&lt;script&gt;\n\nz\n', 0);
        expect(v.dom.querySelector('.cm-content script')).toBeNull();
        expect(v.dom.querySelector('.cm-content').textContent).toContain('<script>');
    });

    it('named entity in inline code stays raw', () => {
        const v = mkView('p\n\n`&eacute;`\n\nz\n', 0);
        expect(v.dom.querySelector('.cm-content .cm-entity')).toBeNull();
        expect(v.dom.querySelector('.cm-content').textContent).toContain('&eacute;');
    });

    it('named entity in a fenced code block stays raw', () => {
        const v = mkView('p\n\n```\n&eacute;\n```\n\nz\n', 0);
        expect(v.dom.querySelector('.cm-content .cm-entity')).toBeNull();
        expect(v.dom.querySelector('.cm-content').textContent).toContain('&eacute;');
    });
});

describe('table cells', () => {
    const cellDoc = (cell) => `p\n\n| h |\n| --- |\n| ${cell} |\n\nz\n`;
    const td = (v) => v.dom.querySelector('.cm-table-widget tbody td');

    it('| &eacute; | cell renders é', () => {
        const v = mkView(cellDoc('&eacute;'), 0);
        expect(td(v).textContent).toBe('é');
    });

    it('several newly decoded names in one cell, mixed with text', () => {
        const v = mkView(cellDoc('a &frac12; b &hellip; &Eacute;'), 0);
        expect(td(v).textContent).toBe('a ½ b … É');
    });

    it('unknown / wrong-case names stay literal in a cell', () => {
        expect(td(mkView(cellDoc('&notreal; &EACUTE;'), 0)).textContent).toBe('&notreal; &EACUTE;');
    });

    it('&lt;b&gt; in a cell is text, no element from it', () => {
        const c = td(mkView(cellDoc('&lt;b&gt; &eacute;'), 0));
        expect(c.textContent).toBe('<b> é');
        expect(c.querySelector('b')).toBeNull();
    });
});
