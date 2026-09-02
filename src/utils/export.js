import { marked } from 'marked';
import { fileSystem } from './fileSystem';
import { sanitizeHTML } from './sanitize';

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

export const exportToHtml = async (title, markdown) => {
    const htmlContent = sanitizeHTML(marked(markdown));
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
