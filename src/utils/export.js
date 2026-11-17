import { marked, Marked } from 'marked';
import { fileSystem } from './fileSystem';
import { sanitizeHTML } from './sanitize';
import { renderTex } from './math';
import { createFootnotes } from './exportFootnotes';
import { scanInlineMath, findClose, INLINE_MATH_MAX } from '../extensions/mathSyntax';

const escapeHtml = (s) => {
    return s.replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[c]));
};

export const markdownToHtml = (markdown) => {
    return marked(markdown);
};

// Math for marked: same rules as the editor (mathSyntax). Each formula becomes a random
// placeholder that survives sanitizing, then is swapped for MathJax's sanitized SVG.
const mathExtension = (formulas, token) => ({
    extensions: [
        {
            name: 'blockMath',
            level: 'block',
            start: (src) => src.match(/^ {0,3}\$\$/m)?.index,
            tokenizer(src) {
                const m = /^ {0,3}\$\$/.exec(src);
                if (!m) return undefined;
                const close = findClose(src, m[0].length);
                if (close < 0) return undefined; // unclosed: stays text, like the editor
                const eol = src.indexOf('\n', close);
                const raw = eol < 0 ? src : src.slice(0, eol + 1);
                return { type: 'blockMath', raw, text: src.slice(m[0].length, close) };
            },
            renderer: (t) => `<p>${token(formulas.push({ tex: t.text, display: true, block: true, raw: `$$${t.text}$$` }) - 1)}</p>\n`,
        },
        {
            name: 'inlineMath',
            level: 'inline',
            start: (src) => { const i = src.indexOf('$'); return i < 0 ? undefined : i; },
            tokenizer(src) {
                const head = src.slice(0, INLINE_MATH_MAX);
                const eol = head.indexOf('\n');
                const m = scanInlineMath(eol < 0 ? head : head.slice(0, eol));
                if (!m) return undefined;
                const mark = m.display ? 2 : 1;
                return { type: 'inlineMath', raw: src.slice(0, m.end), text: src.slice(mark, m.end - mark), display: m.display };
            },
            renderer: (t) => token(formulas.push({ tex: t.text, display: t.display, block: false, raw: t.raw }) - 1),
        },
    ],
});

// Markdown -> sanitized HTML with math rendered. Used by HTML export, PDF export and Print.
export const renderMarkdownHtml = async (markdown) => {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
    const token = (i) => `NFMATH${nonce}I${i}E`;
    const formulas = [];
    const footnotes = createFootnotes();
    const m = new Marked(mathExtension(formulas, token), footnotes.extension);
    const html = sanitizeHTML(footnotes.finish(m, m.parser(m.lexer(markdown))));
    if (!formulas.length) return html;

    const rendered = await Promise.all(formulas.map((f) => renderTex(f.tex, { display: f.display })));
    // Swap on the parsed DOM, not the string: a formula can land in an attribute (an image's
    // alt text), where markup would break out of the quotes. There it becomes its source text.
    const marker = `NFMATH${nonce}I`;
    const re = new RegExp(`${marker}(\\d+)E`, 'g');
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    for (const el of tpl.content.querySelectorAll('*')) {
        for (const attr of el.attributes) {
            if (attr.value.includes(marker)) attr.value = attr.value.replace(re, (w, i) => formulas[Number(i)]?.raw ?? w);
        }
    }
    const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
    const hits = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data.includes(marker)) hits.push(n);
    for (const node of hits) {
        const frag = document.createDocumentFragment();
        node.data.split(re).forEach((part, k) => { // [text, index, text, index, ..., text]
            if (k % 2 === 0) { if (part) frag.append(part); return; }
            const f = formulas[Number(part)];
            const span = document.createElement('span');
            span.className = f.block ? 'math math-block' : f.display ? 'math math-display' : 'math math-inline';
            span.dir = 'ltr';
            span.innerHTML = rendered[Number(part)]; // sanitized SVG from renderTex
            frag.append(span);
        });
        node.replaceWith(frag);
    }
    return tpl.innerHTML;
};

export const exportToHtml = async (title, markdown) => {
    const htmlContent = await renderMarkdownHtml(markdown);
    const escapedTitle = escapeHtml(title);
    const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${escapedTitle}</title>
            <style>
                body { font-family: sans-serif; line-height: 1.6; padding: 2rem; max-width: 800px; margin: 0 auto; }
                h1, h2, h3, h4, h5, h6 { font-weight: 600; }
                code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
                pre { background-color: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
                blockquote { border-left: 4px solid #ddd; padding-left: 1rem; color: #666; }
                .math-block, .math-display { display: block; text-align: center; margin: 1em 0; overflow-x: auto; }
                .footnotes { font-size: 0.875rem; color: #444; border-top: 1px solid #ccc; margin-top: 2rem; padding-top: 0.5rem; }
                .math svg { vertical-align: middle; }
            </style>
        </head>
        <body>
            ${htmlContent}
        </body>
        </html>
    `;

    return await fileSystem.exportFile(fullHtml, `${title.replace(/\s/g, '_')}.html`, [
        {
            description: 'HTML File',
            accept: { 'text/html': ['.html'] },
        },
    ]);
};
