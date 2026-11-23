import { readFileSync } from 'node:fs';
import React from 'react';
import { render } from '@testing-library/react';
import PrintDocument from '../PrintDocument';

// P2: title once in normal flow on page 1; page numbers from an @page margin box, no footer element.
const css = readFileSync('src/components/Print/Print.module.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Body of the first balanced { ... } after `header`.
const block = (header) => {
    const i = css.search(header);
    if (i < 0) return null;
    const open = css.indexOf('{', i);
    let depth = 0;
    for (let j = open; j < css.length; j++) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}' && --depth === 0) return css.slice(open + 1, j);
    }
    return null;
};

describe('PrintDocument markup', () => {
    const setup = () => render(React.createElement(PrintDocument, { title: 'My Title', html: '<p id="body">hello</p>' })).container.firstElementChild;

    it('renders the title exactly once, in an h1', () => {
        const root = setup();
        expect(root.querySelectorAll('h1')).toHaveLength(1);
        expect(root.querySelector('h1').textContent).toBe('My Title');
        expect(root.textContent.split('My Title')).toHaveLength(2);
    });

    it('puts the title before the content in document order', () => {
        const root = setup();
        const h1 = root.querySelector('h1');
        const body = root.querySelector('#body');
        expect(h1.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('renders the content html', () => {
        expect(setup().querySelector('#body').textContent).toBe('hello');
    });

    it('renders no footer / pageNumber element', () => {
        const root = setup();
        const all = [root, ...root.querySelectorAll('*')];
        expect(all.filter((e) => /footer|pageNumber/i.test(e.className || '') || e.tagName === 'FOOTER')).toHaveLength(0);
        expect(root.textContent).not.toMatch(/Page/);
    });
});

describe('Print.module.css source guards', () => {
    it('the print block has no position: fixed', () => {
        const media = block(/@media\s+print/);
        expect(media).not.toBeNull();
        expect(media).not.toMatch(/position\s*:\s*fixed/);
    });

    it('no rule in the file is position: fixed', () => {
        expect(css).not.toMatch(/position\s*:\s*fixed/);
    });

    it('has no .footer / .pageNumber rules', () => {
        expect(css).not.toMatch(/\.footer\b/);
        expect(css).not.toMatch(/\.pageNumber\b/);
    });

    it('@page declares @bottom-right with "Page " counter(page) " of " counter(pages)', () => {
        const page = block(/@page\b/);
        expect(page).not.toBeNull();
        const box = block(/@bottom-right/);
        expect(box).not.toBeNull();
        expect(box).toMatch(/content\s*:\s*"Page "\s*counter\(page\)\s*" of "\s*counter\(pages\)\s*;?/);
        expect(page).toContain('@bottom-right');
    });

    it('does not reset the page counter', () => {
        expect(css).not.toMatch(/counter-reset\s*:[^;}]*\bpage\b/);
    });
});

describe('Toast.module.css print guard', () => {
    it('hides .toast in @media print (its .show visibility would beat the body * hiding)', () => {
        const toast = readFileSync('src/components/Layout/Toast.module.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        const i = toast.search(/@media\s+print/);
        expect(i).toBeGreaterThanOrEqual(0);
        const open = toast.indexOf('{', i);
        let depth = 0, end = -1;
        for (let j = open; j < toast.length && end < 0; j++) {
            if (toast[j] === '{') depth++;
            else if (toast[j] === '}' && --depth === 0) end = j;
        }
        expect(toast.slice(open + 1, end)).toMatch(/\.toast\s*\{[^}]*display\s*:\s*none/);
    });
});
