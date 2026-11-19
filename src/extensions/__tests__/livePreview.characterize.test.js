import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { buildDecorations } from '../livePreview';

// Characterization of buildDecorations (C4 refactor guard). Snapshot generated from
// the pre-refactor code; it must pass unchanged after the handler-map refactor.
// Widgets are serialized by behaviour (toDOM outerHTML, ignoreEvent, eq against an
// equal and an unequal twin) and never by constructor name, so folding
// EntityWidget/OrderedMarkerWidget into TextSpanWidget does not move the snapshot.

const TAIL = '\n\nplain tail';

// [name, doc, touch]: `touch` is a unique substring; the touching state puts the cursor 1 char into it.
const FIXTURES = [
    ['emphasis', 'a *em* b', 'em'],
    ['strong', 'a **strong** b', 'strong'],
    ['strike', 'a ~~gone~~ b', 'gone'],
    ['nested-em-strong', '***both*** and **bold *inner* bold**', 'inner'],
    ['nested-strike-in-strong', '**a ~~b~~ c**', 'b'],
    ['escape', 'x \\* y \\# z', '\\*'],
    ['link', 'see [text](http://example.com/a) now', 'text'],
    ['link-in-emphasis', '*see [text](http://e.com) now*', 'text'],
    ['link-in-strong-in-em', '*a **[t](http://e.com)** b*', 't]'],
    ['autolink', 'go <http://example.com> now', 'example'],
    ['bare-url', 'go http://example.com/x now', 'example'],
    ['image', '![alt](http://e.com/i.png) end', 'alt'],
    ['reference-resolved', 'see [text][ref] and [ref] here\n\n[ref]: http://example.com', 'text'],
    ['reference-unresolved', 'see [text][nope] and [nope] here', 'text'],
    ['image-reference', '![alt][ref] end\n\n[ref]: http://e.com/i.png', 'alt'],
    ['link-ref-definition', 'para\n\n[ref]: http://example.com "Title"', 'example'],
    ['bullet-list', '- one\n- two\n  - nested\n* star\n+ plus', 'two'],
    ['ordered-list', '1. one\n2. two\n3. three', 'two'],
    ['ordered-list-start5-paren', '5) five\n6) six\n9) renumbered', 'six'],
    ['ordered-list-nested', '1. a\n   1. b\n   2. c\n2. d', 'c'],
    ['ordered-list-lazy-numbers', '1. a\n1. b\n1. c', 'b'],
    ['task-list', '- [ ] todo\n- [x] done\n- [X] DONE', 'todo'],
    ['task-list-touch-mark', '- [ ] todo\n- [x] done', '- [x'],
    ['task-ordered', '1. [ ] a\n2. [x] b', '[x] b'],
    ['atx-heading', '# H1\n## H2 ##\n### H3 ###   \n#### H4', 'H2'],
    ['atx-heading-empty-closing', '# \n#\n## a #b', 'a #b'],
    ['setext-1', 'Title\n=====\n\nnext', 'Title'],
    ['setext-2-multiline', 'Line one\nline two\n---\n\nnext', 'line two'],
    ['hr', 'above\n\n---\n\n***\n\nbelow', '***'],
    ['blockquote', '> quoted\n> more\n\nafter', 'more'],
    ['blockquote-nested', '> a\n>> b\n>>> c\n>>>> d\n\nafter', 'c'],
    ['blockquote-with-list', '> - item\n> - item2', 'item2'],
    ['inline-code', 'use `code` and ``co`de`` here', 'code'],
    ['fenced-code', '```js\nlet a = 1;\n```\n\nafter', 'let a'],
    ['fenced-code-tilde-noinfo', '~~~\nplain\n~~~', 'plain\n'],
    ['fenced-code-unclosed', '```py\nprint(1)', 'print'],
    ['entities', 'a &amp; b &lt;i&gt; &#65; &#x42; &bogus; &nbsp;', '&lt;'],
    ['table', '| a | b |\n|---|:-:|\n| 1 | **2** |\n\nafter', '| 1'],
    ['table-escaped-pipe-link', '| a | b |\n|---|---|\n| x\\|y | [l](http://e.com) |', 'x'],
    ['math-skipped', 'inline $a *b* c$ and\n\n$$\n*x*\n$$\n\n*real*', 'real'],
    ['rtl-emphasis', 'שלום **עולם** וגם *טקסט* ו~~מחוק~~', 'עולם'],
    ['rtl-heading-list', '# כותרת\n\n1. אחד\n2. שניים\n\n- [ ] משימה\n\n> ציטוט', 'שניים'],
    ['rtl-link-entity', '[קישור](http://e.com) &amp; ‏`קוד`', 'קישור'],
    ['crlf-mixed', '# H\r\n\r\n**b** and *i*\r\n\r\n1. a\r\n2. b\r\n\r\n> q\r\n> r\r\n\r\n```js\r\nx\r\n```\r\n', 'b** and'],
    ['crlf-table', '| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n\r\nafter', '| 1'],
    ['empty', '', ''],
    ['plain-only', 'just text', ''],
];

const mkState = (doc, anchor) =>
    EditorState.create({
        doc,
        selection: { anchor },
        extensions: [markdown({ base: markdownLanguage })],
    });

// Equal twin = shallow clone; unequal twin = clone with one own field changed.
const clone = (w) => Object.assign(Object.create(Object.getPrototypeOf(w)), w);
const mutate = (w, key) => {
    const t = clone(w);
    const v = w[key];
    t[key] = typeof v === 'boolean' ? !v : typeof v === 'string' ? v + '⁣' : { other: true };
    return t;
};

const serializeWidget = (w) => {
    const out = {};
    let dom;
    try { dom = w.toDOM({}); } catch (e) { out.toDOMError = String(e.message); }
    if (dom) {
        out.html = dom.outerHTML;
        if ('checked' in dom) out.checked = dom.checked;
    }
    out.ignoreEvent = w.ignoreEvent({});
    out.eqEqualTwin = w.eq(clone(w));
    // One boolean, so the snapshot does not depend on how many own fields a widget has.
    out.eqAnyFieldChangeIsUnequal = Object.keys(w).map((k) => mutate(w, k)).every((t) => !w.eq(t));
    return out;
};

const serialize = (set) => {
    const out = [];
    for (const it = set.iter(); it.value; it.next()) {
        const v = it.value;
        const s = v.spec || {};
        const d = { from: it.from, to: it.to, startSide: v.startSide, endSide: v.endSide };
        if (s.class) d.class = s.class;
        if (s.attributes) d.attributes = s.attributes;
        if (s.widget) d.widget = serializeWidget(s.widget);
        else if (v.point && !s.class) d.replace = true;
        out.push(d);
    }
    return out;
};

const run = (doc, anchor) => serialize(buildDecorations(mkState(doc, anchor)));

describe('buildDecorations characterization (pre-refactor snapshot)', () => {
    for (const [name, body, touch] of FIXTURES) {
        // CodeMirror normalizes CRLF to LF on state creation; positions are in the normalized doc.
        const doc = EditorState.create({ doc: body + TAIL }).doc.toString();
        const outside = doc.length;
        const idx = touch ? doc.indexOf(touch) : -1;

        it(`${name}: touch substring is unique`, () => {
            if (touch) {
                expect(idx).toBeGreaterThanOrEqual(0);
                expect(doc.indexOf(touch, idx + 1)).toBe(-1);
            }
        });

        it(`${name}: cursor outside`, () => {
            expect(run(doc, outside)).toMatchSnapshot();
        });

        if (touch) {
            it(`${name}: cursor touching`, () => {
                expect(run(doc, idx + 1)).toMatchSnapshot();
            });
        }
    }

    it('range selection spanning several constructs', () => {
        const doc = '*a* **b**\n\n- x\n- y\n\n1. p\n2. q' + TAIL;
        const state = EditorState.create({
            doc,
            selection: { anchor: 2, head: doc.indexOf('q') },
            extensions: [markdown({ base: markdownLanguage })],
        });
        expect(serialize(buildDecorations(state))).toMatchSnapshot();
    });

    it('range argument restricts iteration', () => {
        const doc = '*a*\n\n**b**\n\n*c*' + TAIL;
        const state = mkState(doc, doc.length);
        const r = { from: doc.indexOf('**b**'), to: doc.indexOf('**b**') + 5 };
        expect(serialize(buildDecorations(state, r))).toMatchSnapshot();
    });
});
