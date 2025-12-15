import { marked } from 'marked';
import { fileSystem } from './fileSystem';

export const markdownToHtml = (markdown) => {
    return marked(markdown);
};

export const exportToHtml = async (title, markdown) => {
    const htmlContent = markdownToHtml(markdown);
    const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
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

export const exportToPdf = async (title, content) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Print - ${title}</title>
                <link rel="stylesheet" href="src/components/Print/Print.module.css">
            </head>
            <body>
                <div id="print-root"></div>
            </body>
        </html>
    `);
    printWindow.document.close();

    const root = printWindow.document.getElementById('print-root');
    // We need to render the PrintDocument component into this new window
    // This is tricky because we can't just import and render a React component here.
    // Instead, we will use the print() command to render the component in the main window
    // and use a print stylesheet to format it.
};
