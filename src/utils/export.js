import { marked, Marked } from 'marked';
import { fileSystem } from './fileSystem';
import { sanitizeHTML } from './sanitize';
import { createMath } from './exportMath';
import { createFootnotes } from './exportFootnotes';
import { subSupExtension } from './exportSubSup';
import { emojiExtension } from './exportEmoji';
import { highlightExtension } from './exportHighlight';
import { createCallouts } from './exportCallouts';
import { createMermaid } from './exportMermaid';
import { scanFrontMatter } from '../extensions/frontMatterSyntax';
import calloutCss from '../styles/calloutExport.css?raw';
import baseCss from '../styles/exportBase.css?raw';

const escapeHtml = (s) => {
    return s.replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[c]));
};

// Column alignment as a class: the sanitizer drops marked's align="" attribute.
const tableAlign = {
    renderer: {
        tablecell({ tokens, header, align }) {
            const tag = header ? 'th' : 'td';
            return `<${tag}${align ? ` class="align-${align}"` : ''}>${this.parser.parseInline(tokens)}</${tag}>\n`;
        },
    },
};

export const markdownToHtml = (markdown) => {
    return marked(markdown);
};

// Markdown -> sanitized HTML with math rendered and footnote ids set. Used by HTML export, PDF export and Print.
export const renderMarkdownHtml = async (markdown, options = {}) => {
    const fm = scanFrontMatter(markdown);
    const body = fm ? markdown.slice(fm.to).replace(/^\r?\n/, '') : markdown;
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
    const idMark = `nf${nonce}-`; // footnote ids ride as classes with this prefix: sanitizing drops every id
    const math = createMath(nonce);
    const footnotes = createFootnotes(idMark);
    const callouts = createCallouts(idMark, options.expandFolds === true);
    const mermaid = createMermaid(nonce);
    // marked tries the last-registered inline extension first: footnotes must come after subSup so `^[note]` stays a footnote.
    const m = new Marked(tableAlign, math.extension, highlightExtension, subSupExtension, emojiExtension, footnotes.extension, callouts.extension, mermaid.extension);
    const html = sanitizeHTML(footnotes.appendSection(m, m.parser(m.lexer(body))));
    if (!math.has() && !mermaid.has() && !html.includes(idMark)) return html;

    await Promise.all([math.prepare(), mermaid.prepare()]);
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    callouts.finish(tpl.content);
    footnotes.finish(tpl.content);
    math.finish(tpl.content);
    mermaid.finish(tpl.content);
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
                kbd { font-family: monospace; font-size: 0.9em; padding: 1px 5px; color: #1e293b; background-color: #f1f5f9; border: 1px solid #94a3b8; border-bottom-width: 2px; border-radius: 4px; }
                mark { color: #1e293b; background-color: #ede9fe; padding: 2px 4px; border-radius: 4px; }
                ${baseCss}
                ${calloutCss}
                .math svg { vertical-align: middle; }
            </style>
        </head>
        <body class="nf-export">
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
