import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { appendParts } from '../tableCells';
import { EmojiWidget } from '../emojiPreview';
import { FootnoteWidget } from '../footnotes';
import { TableWidget } from '../widgets';

// Backlog C7 (refactor, behaviour unchanged). Pinned names/choices:
//  - emojiPreview.js exports `EmojiWidget(name)`; footnotes.js exports `FootnoteWidget(text, def)`.
//  - tableCells builds emoji / fn parts by calling those widgets' toDOM (no own DOM for them).
//  - kbd/mark export+print rules live in ONE css file under src/styles, referenced by both export.js and PrintDocument.jsx.
//  - the `==` regex literal appears once in src/extensions (non-test); any shared home.
//  - footnote click knowledge (`cm-footnote`) lives only in footnotes.js, not linkHandler.js.
//    Behaviour is already pinned by footnotePreview.test.js ("Ctrl+click on a ref widget inside link text...").
//  - TableWidget computes its key lazily: the constructor never calls JSON.stringify.

const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? (d.name === '__tests__' ? [] : walk(path.join(dir, d.name))) : [path.join(dir, d.name)]);

const cellDom = (part) => {
    const box = document.createElement('div');
    appendParts(box, [part], null);
    return box;
};

describe('C7.1 table cells reuse the outside-table widgets', () => {
    it('emoji part DOM equals EmojiWidget.toDOM()', () => {
        const box = cellDom({ k: 'emoji', name: 'smile' });
        expect(box.children).toHaveLength(1);
        expect(box.firstChild.outerHTML).toBe(new EmojiWidget('smile').toDOM().outerHTML);
        expect(box.firstChild.className).toBe('cm-emoji');
    });

    it('footnote-ref part DOM equals FootnoteWidget(text, false).toDOM()', () => {
        const box = cellDom({ k: 'fn', n: 3 });
        expect(box.children).toHaveLength(1);
        expect(box.firstChild.outerHTML).toBe(new FootnoteWidget('3', false).toDOM().outerHTML);
        expect(box.firstChild.className).toBe('cm-footnote-ref');
        expect(box.firstChild.getAttribute('dir')).toBe('ltr');
    });

    it('tableCells imports both widgets and no longer builds their DOM itself', () => {
        const src = read('extensions/tableCells.js');
        expect(src).toMatch(/import\s*\{[^}]*\bEmojiWidget\b[^}]*\}\s*from\s*["']\.\/emojiPreview["']/);
        expect(src).toMatch(/import\s*\{[^}]*\bFootnoteWidget\b[^}]*\}\s*from\s*["']\.\/footnotes["']/);
        expect(src).not.toContain('"cm-emoji"');
        expect(src).not.toContain('"cm-footnote-ref"');
        expect(src).not.toContain('aria-label');
    });
});

describe('C7.2 footnote click knowledge lives in footnotes.js', () => {
    it('linkHandler.js has no cm-footnote string', () => {
        expect(read('extensions/linkHandler.js')).not.toContain('cm-footnote');
    });
    it('footnotes.js still owns the click handling', () => {
        expect(read('extensions/footnotes.js')).toContain('cm-footnote-ref');
    });
});

describe('C7.3 kbd/mark print+export CSS has one source', () => {
    // codemirror-extensions.css is the editor theme (its own kbd/mark look), not an export/print source.
    const files = [...walk(path.join(root, 'styles')), ...walk(path.join(root, 'utils')), ...walk(path.join(root, 'components', 'Print'))]
        .filter((f) => /\.(css|js|jsx)$/.test(f) && !f.endsWith('codemirror-extensions.css'));
    const rule = (tag) => new RegExp(`(^|[\\s,}])(\\.content\\s+|:where\\(\\.nf-export\\)\\s+|\\.nf-export\\s+)?${tag}\\s*\\{`, 'm');
    const holders = (tag) => files.filter((f) => rule(tag).test(fs.readFileSync(f, 'utf8')));

    it.each(['kbd', 'mark'])('the %s rule is defined in exactly one file', (tag) => {
        expect(holders(tag)).toHaveLength(1);
    });

    it('that file is a css file included by both HTML export and Print', () => {
        const [file] = holders('kbd');
        expect(file).toMatch(/\.css$/);
        expect(holders('mark')).toEqual([file]);
        const base = path.basename(file);
        expect(read('utils/export.js')).toContain(base);
        // Print path: PrintDocument imports it directly or via Print.module.css
        const print = read('components/Print/PrintDocument.jsx') + read('components/Print/Print.module.css');
        expect(print).toContain(base);
        // the shared rule keeps the print-only colour fidelity
        expect(fs.readFileSync(file, 'utf8')).toContain('print-color-adjust');
    });
});

describe('C7.4 ==highlight== regex is defined once', () => {
    it('the literal appears once across non-test src/extensions', () => {
        const dir = path.join(root, 'extensions');
        const n = walk(dir).filter((f) => /\.jsx?$/.test(f))
            .reduce((c, f) => c + (fs.readFileSync(f, 'utf8').split('==(.*?)==').length - 1), 0);
        expect(n).toBe(1);
    });
});

describe('C7.5 TableWidget key is lazy', () => {
    const data = (t) => ({ align: [null], head: [[t]], body: [] });

    it('constructor does not call JSON.stringify', () => {
        const spy = vi.spyOn(JSON, 'stringify');
        try {
            new TableWidget(data('a'));
            expect(spy).not.toHaveBeenCalled();
        } finally { spy.mockRestore(); }
    });

    it('eq still compares by content', () => {
        expect(new TableWidget(data('a')).eq(new TableWidget(data('a')))).toBe(true);
        expect(new TableWidget(data('a')).eq(new TableWidget(data('b')))).toBe(false);
    });

    it('eq on the same data object is true', () => {
        const d = data('a');
        expect(new TableWidget(d).eq(new TableWidget(d))).toBe(true);
    });
});
