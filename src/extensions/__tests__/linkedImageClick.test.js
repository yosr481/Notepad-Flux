import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { imagePreview } from '../imagePreview';
import { linkClickHandler } from '../linkHandler';
import { fastLinkEnd } from '../fastLinkEnd';

const IMG = 'https://img.test/i.png';
const views = [];
// Cursor is placed on line 1 ("first") so the images on later lines render as widgets.
const mkView = (doc) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
        state: EditorState.create({ doc, selection: { anchor: 0 }, extensions: [markdown({ base: markdownLanguage, extensions: [fastLinkEnd] }), imagePreview, linkClickHandler] }),
        parent,
    });
    views.push(view);
    return view;
};
const click = (view, el, pos, init = { ctrlKey: true }) => {
    view.posAtCoords = () => pos;                                  // jsdom has no layout
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
};

describe('linked-image click handling (Ctrl/Cmd+click on [![alt](img)](url))', () => {
    let open, warn;
    beforeEach(() => { open = vi.spyOn(window, 'open').mockImplementation(() => null); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => { views.splice(0).forEach(v => v.destroy()); document.body.innerHTML = ''; vi.restoreAllMocks(); });

    const imgs = (v) => [...v.dom.querySelectorAll('.cm-image-container, .cm-image-broken')];   // widget root (the <img> appears only after load)

    it('renders the image as a widget so there is something to click', () => {
        const v = mkView(`first\n\n[![a](${IMG})](https://example.com/x)\n`);
        expect(imgs(v)).toHaveLength(1);
    });

    it('Ctrl+click on the image inside an inline link opens the link URL', () => {
        const doc = `first\n\n[![a](${IMG})](https://example.com/x)\n`;
        const v = mkView(doc);
        click(v, imgs(v)[0], doc.indexOf('![a]') + 3);
        expect(open).toHaveBeenCalledWith('https://example.com/x', '_blank');
    });

    it('Cmd (metaKey) click works too', () => {
        const doc = `first\n\n[![a](${IMG})](https://example.com/x)\n`;
        const v = mkView(doc);
        click(v, imgs(v)[0], doc.indexOf('![a]') + 3, { metaKey: true });
        expect(open).toHaveBeenCalledWith('https://example.com/x', '_blank');
    });

    it('reference forms resolve: [![a][img]][site]', () => {
        const doc = `first\n\n[![a][img]][site]\n\n[img]: ${IMG}\n[site]: https://example.com/ref\n`;
        const v = mkView(doc);
        click(v, imgs(v)[0], doc.indexOf('![a]') + 3);
        expect(open).toHaveBeenCalledWith('https://example.com/ref', '_blank');
    });

    it('a bare image (no enclosing link) opens nothing', () => {
        const doc = `first\n\n![a](${IMG})\n`;
        const v = mkView(doc);
        click(v, imgs(v)[0], doc.indexOf('![a]') + 3);
        expect(open).not.toHaveBeenCalled();
    });

    it('a plain click (no Ctrl/Cmd) opens nothing', () => {
        const doc = `first\n\n[![a](${IMG})](https://example.com/x)\n`;
        const v = mkView(doc);
        click(v, imgs(v)[0], doc.indexOf('![a]') + 3, {});
        expect(open).not.toHaveBeenCalled();
    });

    it('unsafe schemes are blocked (javascript:, file:, data:) and logged', () => {
        for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi']) {
            const doc = `first\n\n[![a](${IMG})](${bad})\n`;
            const v = mkView(doc);
            click(v, imgs(v)[0], doc.indexOf('![a]') + 3);
            expect(open, bad).not.toHaveBeenCalled();
        }
        expect(warn).toHaveBeenCalled();
    });

    it('unsafe scheme through a reference definition is blocked too', () => {
        const doc = `first\n\n[![a](${IMG})][s]\n\n[s]: javascript:alert(1)\n`;
        const v = mkView(doc);
        click(v, imgs(v)[0], doc.indexOf('![a]') + 3);
        expect(open).not.toHaveBeenCalled();
    });

    it('the control still works: Ctrl+click on a plain text link', () => {
        const doc = `first\n\n[txt](https://example.com/t)\n`;
        const v = mkView(doc);
        click(v, v.contentDOM, doc.indexOf('txt'));
        expect(open).toHaveBeenCalledWith('https://example.com/t', '_blank');
    });
});
