import { sanitizeFilename } from './fileSystem';
import { scanFrontMatter } from '../extensions/frontMatterSyntax';

// Tab title from a document's first line. After front matter, the first non-blank line below it
// (a "---" title says nothing about the file).
export function titleFromContent(content) {
    const fm = scanFrontMatter(content);
    const line = fm
        ? content.slice(fm.to).split('\n').find((l) => l.trim()) ?? ''
        : content.split('\n')[0];
    const first = line.trim();
    return sanitizeFilename(first ? first.slice(0, 35) : 'Untitled');
}
