import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax, scanFrontMatter } from '../frontMatterSyntax';
import { livePreview } from '../livePreview';
import { frontMatterPreview, propertiesFromYaml } from '../frontMatterPreview';

// Spec: Docs/internal/frontmatter-spec.md ("Parsing", "Editor"). Offsets via doc.indexOf / scanFrontMatter, never by hand.
// Pinned choices (spec silent / task contract):
//  - propertiesFromYaml(yamlText) -> { rows: [{ key, kind, value }] } | { error }. js-yaml `load`, default schema.
//    kinds: text (string), number (String(n)), boolean ('true'/'false'), date (YYYY-MM-DD, or 'YYYY-MM-DD HH:MM'
//    when not midnight UTC), list (array of scalars -> string[]; an empty array is a list with []), empty
//    (null/undefined/'' -> ''), yaml (nested map, or array containing a map/array -> dump(v,{flowLevel:0}).trim()).
//  - Empty / whitespace / comment-only content -> { rows: [] }. Top level not a mapping, YAML syntax error and
//    duplicate keys -> { error } (error = first line of js-yaml's message; assertion is toContain).
//  - Widget range = the FrontMatter node range (from..to as scanFrontMatter gives it). Any selection range with
//    range.from <= to && range.to >= from shows raw YAML and NO widget. Block replace, ONE widget div.cm-properties.
//  - Header: widget text contains "Properties" (non-error, incl. empty). Error box: div.cm-properties-error holds the
//    message text AND a <pre> (inside it) whose textContent is the raw YAML (contentFrom..contentTo).
//  - Row: div.cm-property > span.cm-property-key + span.cm-property-value[dir=auto]; list value = one
//    span.cm-property-chip inside the value span, nothing else in it.
//  - mousedown on the widget (or any child): cursor to contentFrom; empty front matter -> end of the opening fence line.
//  - Widget identity: same YAML text -> same DOM node survives cursor moves outside the block.
//  - Not asserted (cannot be done in jsdom / not decidable with js-yaml `load`): real CSS/contrast, hit-testing,
//    key order for integer-like keys (JS objects reorder them; see report).

const views = [];
const mkView = (doc, anchor = doc.length, head = anchor) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({
            doc,
            selection: { anchor, head },
            extensions: [
                markdown({ base: markdownLanguage, extensions: [frontMatterSyntax, mathSyntax, footnoteSyntax] }),
                livePreview, frontMatterPreview,
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
const q = (v, sel) => v.dom.querySelector(sel);
const widgets = (v) => qa(v, '.cm-properties');
const lineEl = (v, text) => qa(v, '.cm-line').find((l) => l.textContent.includes(text));
const mouse = (el) =>
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
const setSel = (v, anchor, head = anchor) => v.dispatch({ selection: { anchor, head } });
const rowsOf = (v) => qa(v, '.cm-property').map((r) => ({
    key: r.querySelector('.cm-property-key').textContent,
    value: r.querySelector('.cm-property-value'),
}));

afterEach(() => {
    while (views.length) views.pop().destroy();
    document.body.innerHTML = '';
});

const YAML = 'title: Hello\ntags: [a, b]';
const DOC = `---\n${YAML}\n---\n\ntail`;
const fm = (doc) => scanFrontMatter(doc);

describe('propertiesFromYaml: kinds', () => {
    const one = (y) => {
        const r = propertiesFromYaml(y);
        expect(r.error).toBeUndefined();
        expect(r.rows).toHaveLength(1);
        return r.rows[0];
    };

    it('string -> text', () => {
        expect(one('title: Hello world')).toEqual({ key: 'title', kind: 'text', value: 'Hello world' });
    });
    it('quoted number-looking string stays text', () => {
        expect(one('v: "42"')).toEqual({ key: 'v', kind: 'text', value: '42' });
    });
    it('integer -> number, String(n)', () => {
        expect(one('n: 42')).toEqual({ key: 'n', kind: 'number', value: '42' });
    });
    it('float -> number, String(n) (1.50 -> 1.5)', () => {
        expect(one('n: 1.50')).toEqual({ key: 'n', kind: 'number', value: '1.5' });
    });
    it('hex int is parsed by the default schema (0x10 -> 16)', () => {
        expect(one('n: 0x10')).toEqual({ key: 'n', kind: 'number', value: '16' });
    });
    it('booleans -> "true" / "false"', () => {
        expect(one('b: true')).toEqual({ key: 'b', kind: 'boolean', value: 'true' });
        expect(one('b: false')).toEqual({ key: 'b', kind: 'boolean', value: 'false' });
    });
    it('date only -> YYYY-MM-DD', () => {
        expect(one('d: 2024-01-05')).toEqual({ key: 'd', kind: 'date', value: '2024-01-05' });
    });
    it('date with a non-midnight UTC time -> YYYY-MM-DD HH:MM', () => {
        expect(one('d: 2024-01-05T10:30:00Z')).toEqual({ key: 'd', kind: 'date', value: '2024-01-05 10:30' });
    });
    it('date at exactly midnight UTC -> date only', () => {
        expect(one('d: 2024-01-05T00:00:00Z')).toEqual({ key: 'd', kind: 'date', value: '2024-01-05' });
    });
    it('quoted date-looking string stays text', () => {
        expect(one('d: "2024-01-05"')).toEqual({ key: 'd', kind: 'text', value: '2024-01-05' });
    });
    it('list of scalars -> list of strings', () => {
        expect(one('l: [a, 1, true]')).toEqual({ key: 'l', kind: 'list', value: ['a', '1', 'true'] });
    });
    it('block-style list works the same', () => {
        expect(one('l:\n  - x\n  - y')).toEqual({ key: 'l', kind: 'list', value: ['x', 'y'] });
    });
    it('empty list is a list with no items', () => {
        expect(one('l: []')).toEqual({ key: 'l', kind: 'list', value: [] });
    });
    it('null forms -> empty with ""', () => {
        for (const y of ['v:', 'v: ~', 'v: null', 'v: ""']) {
            expect(one(y)).toEqual({ key: 'v', kind: 'empty', value: '' });
        }
    });
    it('nested map -> compact one-line YAML', () => {
        expect(one('m:\n  b: 1\n  c: x y')).toEqual({ key: 'm', kind: 'yaml', value: '{b: 1, c: x y}' });
    });
    it('list containing maps or lists -> yaml', () => {
        expect(one('l:\n  - a: 1\n  - [1, 2]')).toEqual({ key: 'l', kind: 'yaml', value: '[{a: 1}, [1, 2]]' });
        expect(one('l: [[1]]')).toEqual({ key: 'l', kind: 'yaml', value: '[[1]]' });
    });
    it('Hebrew text passes through untouched', () => {
        expect(one('כותרת: שלום עולם')).toEqual({ key: 'כותרת', kind: 'text', value: 'שלום עולם' });
    });
    it('quoted key with markup is kept verbatim as data', () => {
        expect(one('"<b>k</b>": "<i>v</i>"')).toEqual({ key: '<b>k</b>', kind: 'text', value: '<i>v</i>' });
    });
});

describe('propertiesFromYaml: shape', () => {
    it('keys in document order', () => {
        const r = propertiesFromYaml('zeta: 1\nalpha: 2\nmid: 3');
        expect(r.rows.map((x) => x.key)).toEqual(['zeta', 'alpha', 'mid']);
    });
    it('empty content -> no rows, no error', () => {
        expect(propertiesFromYaml('')).toEqual({ rows: [] });
    });
    it('whitespace-only and comment-only content -> no rows', () => {
        expect(propertiesFromYaml('  \n\t\n')).toEqual({ rows: [] });
        expect(propertiesFromYaml('# just a comment\n# another')).toEqual({ rows: [] });
    });
    it('comments between keys are ignored', () => {
        expect(propertiesFromYaml('# c\na: 1 # trailing\n# d\nb: 2').rows.map((r) => r.key)).toEqual(['a', 'b']);
    });
    it('does not return both rows and error', () => {
        expect('error' in propertiesFromYaml('a: 1')).toBe(false);
        expect('rows' in propertiesFromYaml('- a')).toBe(false);
    });
});

describe('propertiesFromYaml: errors', () => {
    const err = (y) => {
        const r = propertiesFromYaml(y);
        expect(typeof r.error).toBe('string');
        expect(r.error.length).toBeGreaterThan(0);
        return r.error;
    };
    it('top-level scalar', () => { err('just text'); });
    it('top-level number', () => { err('42'); });
    it('top-level list', () => { err('- a\n- b'); });
    it('syntax error carries js-yaml message (first line)', () => {
        const bad = 'a: [1, 2';
        let msg;
        try { yaml.load(bad); } catch (e) { msg = e.message.split('\n')[0]; }
        expect(msg).toBeTruthy();
        expect(propertiesFromYaml(bad).error).toContain(msg);
    });
    it('error is the first line only (no multi-line snippet)', () => {
        expect(err('a: [1, 2')).not.toContain('\n');
    });
    it('duplicate keys are an error (js-yaml throws, no silent last-wins)', () => {
        err('a: 1\na: 2');
    });
    it('never throws on garbage', () => {
        expect(() => propertiesFromYaml('{{{ : ]]\n\t- !!js/function x')).not.toThrow();
    });
    it('executable tags are not honoured (safe schema)', () => {
        const r = propertiesFromYaml('a: !!js/function "function(){}"');
        expect(typeof r.error).toBe('string');
    });
});

describe('frontMatterPreview: widget (cursor outside)', () => {
    it('one div.cm-properties replaces the whole block, fences included; tail stays', () => {
        const v = mkView(DOC);
        expect(widgets(v)).toHaveLength(1);
        expect(widgets(v)[0].tagName).toBe('DIV');
        expect(lineEl(v, 'title: Hello')).toBeUndefined();
        expect(lineEl(v, 'tags:')).toBeUndefined();
        expect(lineEl(v, '---')).toBeUndefined();
        expect(lineEl(v, 'tail')).toBeTruthy();
    });

    it('no HR widget and no setext heading is produced for the block', () => {
        const v = mkView(DOC);
        expect(qa(v, 'hr')).toHaveLength(0);
    });

    it('header text "Properties"', () => {
        const v = mkView(DOC);
        expect(widgets(v)[0].textContent).toContain('Properties');
    });

    it('one div.cm-property per key, key span + value span[dir=auto]', () => {
        const v = mkView('---\na: 1\nb: x\nc: true\n---\n\ntail');
        const rows = qa(v, '.cm-property');
        expect(rows).toHaveLength(3);
        for (const r of rows) {
            expect(r.tagName).toBe('DIV');
            expect(r.querySelectorAll('.cm-property-key')).toHaveLength(1);
            expect(r.querySelectorAll('.cm-property-value')).toHaveLength(1);
            expect(r.querySelector('.cm-property-value').getAttribute('dir')).toBe('auto');
        }
        expect(rowsOf(v).map((r) => [r.key, r.value.textContent])).toEqual([['a', '1'], ['b', 'x'], ['c', 'true']]);
    });

    it('rows are inside the widget', () => {
        const v = mkView(DOC);
        expect(qa(v, '.cm-properties .cm-property')).toHaveLength(2);
    });

    it('scalar kinds render as plain text; date as YYYY-MM-DD; null as empty', () => {
        const v = mkView('---\nd: 2024-01-05\nn: 1.50\nb: false\ne:\n---\n\ntail');
        expect(rowsOf(v).map((r) => [r.key, r.value.textContent])).toEqual([
            ['d', '2024-01-05'], ['n', '1.5'], ['b', 'false'], ['e', ''],
        ]);
    });

    it('list -> one span.cm-property-chip per item inside the value', () => {
        const v = mkView(DOC);
        const tags = rowsOf(v).find((r) => r.key === 'tags').value;
        const chips = [...tags.querySelectorAll('.cm-property-chip')];
        expect(chips.map((c) => c.textContent)).toEqual(['a', 'b']);
        expect(chips.every((c) => c.tagName === 'SPAN')).toBe(true);
        const title = rowsOf(v).find((r) => r.key === 'title').value;
        expect(title.querySelectorAll('.cm-property-chip')).toHaveLength(0);
    });

    it('empty list -> value span with no chips', () => {
        const v = mkView('---\nl: []\n---\n\ntail');
        expect(rowsOf(v)[0].value.querySelectorAll('.cm-property-chip')).toHaveLength(0);
        expect(rowsOf(v)[0].value.textContent).toBe('');
    });

    it('nested map -> compact YAML text, no chips', () => {
        const v = mkView('---\nm:\n  b: 1\n---\n\ntail');
        const val = rowsOf(v)[0].value;
        expect(val.textContent).toBe('{b: 1}');
        expect(val.querySelectorAll('.cm-property-chip')).toHaveLength(0);
    });

    it('Hebrew value keeps dir=auto', () => {
        const v = mkView('---\ntitle: שלום עולם\n---\n\ntail');
        const val = rowsOf(v)[0].value;
        expect(val.textContent).toBe('שלום עולם');
        expect(val.getAttribute('dir')).toBe('auto');
    });

    it('empty front matter -> div.cm-properties-empty "No properties", no rows', () => {
        const v = mkView('---\n---\n\ntail');
        expect(widgets(v)).toHaveLength(1);
        expect(qa(v, '.cm-property')).toHaveLength(0);
        expect(q(v, '.cm-properties-empty').tagName).toBe('DIV');
        expect(q(v, '.cm-properties-empty').textContent).toContain('No properties');
        expect(q(v, '.cm-properties-error')).toBeNull();
    });

    it('comment-only front matter is also "No properties"', () => {
        const v = mkView('---\n# nothing\n---\n\ntail');
        expect(q(v, '.cm-properties-empty')).toBeTruthy();
    });

    it('non-empty front matter has no empty/error boxes', () => {
        const v = mkView(DOC);
        expect(q(v, '.cm-properties-empty')).toBeNull();
        expect(q(v, '.cm-properties-error')).toBeNull();
    });

    it('closing "..." fence works', () => {
        const v = mkView('---\na: 1\n...\n\ntail');
        expect(widgets(v)).toHaveLength(1);
        expect(rowsOf(v)).toHaveLength(1);
    });

    it('CRLF document works', () => {
        const crlf = '---\r\na: 1\r\nb: two\r\n---\r\n\r\ntail';
        const v = mkView(crlf, crlf.replace(/\r\n/g, '\n').length); // CodeMirror normalizes CRLF: anchor in normalized offsets
        expect(rowsOf(v).map((r) => [r.key, r.value.textContent])).toEqual([['a', '1'], ['b', 'two']]);
    });

    it('BOM before the opening fence still gets a widget', () => {
        const v = mkView('\uFEFF---\na: 1\n---\n\ntail');
        expect(widgets(v)).toHaveLength(1);
        expect(rowsOf(v)).toHaveLength(1);
    });

    it('empty document does not throw', () => {
        expect(() => mkView('')).not.toThrow();
        expect(widgets(mkView(''))).toHaveLength(0);
    });
});

describe('frontMatterPreview: error box', () => {
    it('YAML syntax error: div.cm-properties-error with message text and a pre with the raw YAML', () => {
        const bad = 'a: [1, 2';
        const doc = `---\n${bad}\n---\n\ntail`;
        const msg = propertiesFromYaml(bad).error;
        const v = mkView(doc);
        const box = q(v, '.cm-properties-error');
        expect(box.tagName).toBe('DIV');
        expect(widgets(v)).toHaveLength(1);
        expect(box.textContent).toContain(msg);
        const pre = box.querySelector('pre');
        expect(pre.textContent).toBe(bad);
        expect(qa(v, '.cm-property')).toHaveLength(0);
        expect(q(v, '.cm-properties-empty')).toBeNull();
    });

    it('top-level list: error box, raw YAML kept (multi-line)', () => {
        const doc = '---\n- a\n- b\n---\n\ntail';
        const v = mkView(doc);
        expect(q(v, '.cm-properties-error')).toBeTruthy();
        expect(q(v, '.cm-properties-error pre').textContent).toBe('- a\n- b');
    });

    it('markup in the raw YAML and in the message is text, never elements', () => {
        const v = mkView('---\n<img src=x onerror=alert(1)>: [<b>\n---\n\ntail');
        const box = q(v, '.cm-properties-error');
        expect(box).toBeTruthy();
        expect(box.querySelector('img')).toBeNull();
        expect(box.querySelector('b')).toBeNull();
        expect(box.querySelector('pre').textContent).toBe('<img src=x onerror=alert(1)>: [<b>');
    });
});

describe('frontMatterPreview: user text is textContent only', () => {
    it('markup in keys, values and chips creates no elements', () => {
        const doc = '---\n"<img src=x onerror=alert(1)>": "<b>bold</b>"\nl: ["<i>x</i>", "<script>1</script>"]\n---\n\ntail';
        const v = mkView(doc);
        const w = widgets(v)[0];
        expect(w.querySelector('img, b, i, script')).toBeNull();
        const rows = rowsOf(v);
        expect(rows[0].key).toBe('<img src=x onerror=alert(1)>');
        expect(rows[0].value.textContent).toBe('<b>bold</b>');
        expect([...rows[1].value.querySelectorAll('.cm-property-chip')].map((c) => c.textContent))
            .toEqual(['<i>x</i>', '<script>1</script>']);
    });

    it('markup in a nested-map value is text', () => {
        const v = mkView('---\nm:\n  k: "<b>x</b>"\n---\n\ntail');
        expect(widgets(v)[0].querySelector('b')).toBeNull();
        expect(rowsOf(v)[0].value.textContent).toContain('<b>x</b>');
    });
});

describe('frontMatterPreview: cursor touching shows raw YAML, no widget', () => {
    const r = fm(DOC);
    const touching = {
        'cursor at block start (offset 0)': [r.from],
        'cursor at block end': [r.to],
        'cursor on the opening fence': [r.from + 1],
        'cursor inside the YAML': [DOC.indexOf('Hello') + 2],
        'cursor on the closing fence': [r.to - 1],
        'range spanning the whole block': [r.from, r.to + 2],
        'range starting exactly at block end': [r.to, DOC.length],
    };
    for (const [name, sel] of Object.entries(touching)) {
        it(name, () => {
            const v = mkView(DOC, sel[0], sel[1] ?? sel[0]);
            expect(widgets(v)).toHaveLength(0);
            expect(lineEl(v, 'title: Hello')).toBeTruthy();
            expect(lineEl(v, 'tags:')).toBeTruthy();
            expect(qa(v, '.cm-line').filter((l) => l.textContent === '---')).toHaveLength(2);
            expect(qa(v, 'hr')).toHaveLength(0);
        });
    }

    it('cursor one char after the block end (start of the next line) is outside', () => {
        const v = mkView(DOC, fm(DOC).to + 1);
        expect(widgets(v)).toHaveLength(1);
    });

    it('moving the cursor into the block removes the widget; moving out brings it back', () => {
        const v = mkView(DOC);
        expect(widgets(v)).toHaveLength(1);
        setSel(v, DOC.indexOf('Hello'));
        expect(widgets(v)).toHaveLength(0);
        expect(lineEl(v, 'title: Hello')).toBeTruthy();
        setSel(v, DOC.length);
        expect(widgets(v)).toHaveLength(1);
    });

    it('editing the YAML, then leaving, shows the new values', () => {
        const v = mkView(DOC, DOC.indexOf('Hello'));
        const at = DOC.indexOf('Hello');
        v.dispatch({ changes: { from: at, to: at + 5, insert: 'Bye' }, selection: { anchor: at + 3 } });
        setSel(v, v.state.doc.length);
        expect(rowsOf(v).find((r) => r.key === 'title').value.textContent).toBe('Bye');
    });

    it('destroying the closing fence while editing leaves no widget (unclosed -> not front matter)', () => {
        const v = mkView(DOC, DOC.indexOf('Hello'));
        const close = DOC.lastIndexOf('---');
        v.dispatch({ changes: { from: close, to: close + 3, insert: 'x' }, selection: { anchor: 0 } });
        setSel(v, v.state.doc.length);
        expect(widgets(v)).toHaveLength(0); // unclosed -> not front matter
    });
});

describe('frontMatterPreview: raw YAML styling (spec: monospace, fences faint)', () => {
    it('cursor inside: every block line has cm-frontmatter-line, fence lines hold a cm-faint-syntax mark, tail has neither', () => {
        const v = mkView(DOC, DOC.indexOf('Hello'));
        expect(widgets(v)).toHaveLength(0);
        const lines = qa(v, '.cm-line');
        const fmLines = lines.filter((l) => l.classList.contains('cm-frontmatter-line'));
        expect(fmLines.map((l) => l.textContent)).toEqual(['---', 'title: Hello', 'tags: [a, b]', '---']);
        const fences = fmLines.filter((l) => l.textContent === '---');
        for (const l of fences) expect(l.querySelector('.cm-faint-syntax')).toBeTruthy();
        expect(fmLines[1].querySelector('.cm-faint-syntax')).toBeNull();
        const tail = lineEl(v, 'tail');
        expect(tail.classList.contains('cm-frontmatter-line')).toBe(false);
        expect(tail.querySelector('.cm-faint-syntax')).toBeNull();
    });
});

describe('frontMatterPreview: closer-distance cap (decision: closer on line 500 previews, line 501 does not)', () => {
    const docWithCloserAt = (n) => `---\n${Array.from({ length: n - 2 }, (_, i) => `k${i}: ${i}`).join('\n')}\n---\n\ntail`;
    it('closer on line 500 -> widget', () => {
        expect(widgets(mkView(docWithCloserAt(500)))).toHaveLength(1);
    });
    it('closer on line 501 -> no widget, raw YAML shown, no hr and no throw', () => {
        const v = mkView(docWithCloserAt(501));
        expect(widgets(v)).toHaveLength(0);
        expect(lineEl(v, 'k0: 0')).toBeTruthy();
        expect(qa(v, 'hr')).toHaveLength(0);
    });
});

describe('frontMatterPreview: no front matter -> no widget', () => {
    const cases = {
        'plain document': 'intro\n\ntail',
        '--- block later in the document': 'intro\n\n---\ntitle: x\n---\n\ntail',
        'leading blank line before the block': '\n---\ntitle: x\n---\n\ntail',
        'unclosed opening fence': '---\ntitle: x\n\ntail',
        'opening fence with trailing text': '--- x\ntitle: x\n---\n\ntail',
        'leading space before the fence': ' ---\ntitle: x\n---\n\ntail',
    };
    for (const [name, doc] of Object.entries(cases)) {
        it(name, () => {
            const v = mkView(doc);
            expect(widgets(v)).toHaveLength(0);
            expect(scanFrontMatter(doc)).toBeNull();
        });
    }

    it('a later --- block keeps today\'s HR behaviour (hr widget, no properties)', () => {
        const v = mkView('intro\n\n---\n\ntail', 0);
        expect(widgets(v)).toHaveLength(0);
        expect(qa(v, 'hr').length).toBeGreaterThan(0);
    });
});

describe('frontMatterPreview: mousedown on the widget', () => {
    it('puts the cursor at the start of the first YAML line; raw YAML appears', () => {
        const v = mkView(DOC);
        mouse(widgets(v)[0]);
        expect(v.state.selection.main.empty).toBe(true);
        expect(v.state.selection.main.head).toBe(fm(DOC).contentFrom);
        expect(v.state.selection.main.head).toBe(DOC.indexOf('title: Hello'));
        expect(widgets(v)).toHaveLength(0);
        expect(lineEl(v, 'title: Hello')).toBeTruthy();
    });

    it('a click on a row child (key / value / chip) behaves the same', () => {
        for (const sel of ['.cm-property-key', '.cm-property-value', '.cm-property-chip']) {
            const v = mkView(DOC);
            mouse(q(v, sel));
            expect(v.state.selection.main.head).toBe(DOC.indexOf('title: Hello'));
            expect(widgets(v)).toHaveLength(0);
            v.destroy();
            views.pop();
        }
    });

    it('empty front matter: cursor goes to the end of the opening fence line', () => {
        const doc = '---\n---\n\ntail';
        const v = mkView(doc);
        mouse(widgets(v)[0]);
        expect(v.state.selection.main.head).toBe(3);
        expect(v.state.selection.main.head).toBe(doc.indexOf('\n'));
        expect(widgets(v)).toHaveLength(0);
    });

    it('error box click behaves the same (cursor at first YAML line)', () => {
        const doc = '---\na: [1, 2\n---\n\ntail';
        const v = mkView(doc);
        mouse(q(v, '.cm-properties-error pre'));
        expect(v.state.selection.main.head).toBe(doc.indexOf('a: ['));
        expect(widgets(v)).toHaveLength(0);
    });

    it('the document is not changed by the click', () => {
        const v = mkView(DOC);
        mouse(widgets(v)[0]);
        expect(v.state.doc.toString()).toBe(DOC);
    });

    it('with a BOM, cursor goes to the first YAML line', () => {
        const doc = '\uFEFF---\na: 1\n---\n\ntail';
        const v = mkView(doc);
        mouse(widgets(v)[0]);
        expect(v.state.selection.main.head).toBe(doc.indexOf('a: 1'));
    });
});

describe('frontMatterPreview: widget identity', () => {
    it('moving the cursor elsewhere outside the block keeps the same DOM node', () => {
        const doc = `${DOC}\n\nmore text`;
        const v = mkView(doc);
        const w = widgets(v)[0];
        setSel(v, fm(doc).to + 2);
        setSel(v, doc.indexOf('more'));
        setSel(v, doc.length);
        expect(widgets(v)).toHaveLength(1);
        expect(widgets(v)[0]).toBe(w);
    });

    it('typing outside the block keeps the same DOM node', () => {
        const v = mkView(DOC);
        const w = widgets(v)[0];
        v.dispatch({ changes: { from: DOC.length, insert: ' more' }, selection: { anchor: DOC.length + 5 } });
        expect(widgets(v)[0]).toBe(w);
    });
});

describe('Editor.jsx wiring (source guard)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/Editor.jsx'), 'utf8');

    it('frontMatterPreview is imported from ../extensions/frontMatterPreview', () => {
        expect(src).toMatch(/import\s*\{[^}]*\bfrontMatterPreview\b[^}]*\}\s*from\s*['"]\.\.\/extensions\/frontMatterPreview['"]/);
    });

    it('frontMatterSyntax is imported from ../extensions/frontMatterSyntax', () => {
        expect(src).toMatch(/import\s*\{[^}]*\bfrontMatterSyntax\b[^}]*\}\s*from\s*['"]\.\.\/extensions\/frontMatterSyntax['"]/);
    });

    it('frontMatterSyntax is in the markdown({ extensions: [...] }) list', () => {
        expect(src).toMatch(/markdown\(\{[^)]*extensions:\s*\[[^\]]*\bfrontMatterSyntax\b[^\]]*\]/);
    });

    it('frontMatterPreview is in the extensions array, after mermaidPreview', () => {
        expect(src).toMatch(/^\s*frontMatterPreview,/m);
        expect(src.indexOf('frontMatterPreview,')).toBeGreaterThan(src.indexOf('mermaidPreview,'));
    });
});

describe('frontMatterPreview: selection-only fast path', () => {
    // Identity, not timing: a cursor move that stays outside the block keeps the same decoration set object.
    const propsSet = (v) => {
        const found = v.state.facet(EditorView.decorations).filter((d) => {
            if (typeof d === 'function') return false;
            let hit = false;
            d.between(0, v.state.doc.length, (_f, _t, val) => {
                const w = val.spec.widget;
                if (w && typeof w.toDOM === 'function' && w.toDOM(v).classList.contains('cm-properties')) {
                    hit = true;
                    return false;
                }
            });
            return hit;
        });
        return found;
    };

    it('move outside -> outside keeps the same set; into the block removes it; back out gives a set again', () => {
        let doc = DOC + '\n\n';
        for (let i = 0; i < 40; i++) doc += `plain ${i}\n\n`;
        const v = mkView(doc, doc.indexOf('plain 1\n'));
        const plain = (n) => doc.indexOf(`plain ${n}\n`) + 2;
        const before = propsSet(v);
        expect(before).toHaveLength(1);
        setSel(v, plain(6));
        expect(propsSet(v)).toHaveLength(1);
        expect(propsSet(v)[0]).toBe(before[0]);
        setSel(v, plain(30));
        expect(propsSet(v)[0]).toBe(before[0]);
        setSel(v, doc.indexOf('Hello'));
        expect(propsSet(v)).toHaveLength(0);
        setSel(v, plain(30));
        expect(propsSet(v)).toHaveLength(1);
    });
});
