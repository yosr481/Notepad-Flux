import { scanCallout, calloutTitle } from '../extensions/calloutSyntax';

// Callouts for marked: same header rules as the editor (calloutSyntax). A blockquote whose first line scans as a
// callout gets `callout` on its token; the renderer then emits the callout markup instead of <blockquote>.
// The icon is a marker span `${mark}icon-<canonical>` that export.js swaps for the svg after sanitizing.
// ponytail: leans on two marked internals: `lexer.inlineQueue` entries matched by `tokens` identity, and
// `this.constructor.prototype.blockquote` (skips any other blockquote tokenizer override). The nested-blockquote
// and list tests in export.callouts.test.js guard a marked upgrade.
export const calloutExtension = (mark, expandFolds) => ({
    tokenizer: {
        blockquote(src) {
            const bq = this.constructor.prototype.blockquote.call(this, src);
            if (!bq) return false;
            const para = bq.tokens[0];
            if (para?.type !== 'paragraph') return bq;
            const scan = scanCallout(para.text.split('\n', 1)[0]);
            if (!scan) return bq;
            // The paragraph was queued for inline lexing as a whole; re-queue its body and the title separately.
            const queue = this.lexer.inlineQueue;
            const at = queue.findIndex((q) => q.tokens === para.tokens);
            if (at < 0) return bq;
            const nl = para.text.indexOf('\n');
            const rest = nl < 0 ? '' : para.text.slice(nl + 1);
            const title = { tokens: [] };
            if (scan.title) queue[at] = { src: scan.title, tokens: title.tokens };
            else queue.splice(at, 1);
            const body = bq.tokens.slice(1);
            if (rest) {
                para.text = rest;
                para.tokens = [];
                queue.splice(at + (scan.title ? 1 : 0), 0, { src: rest, tokens: para.tokens });
                body.unshift(para);
            }
            return { ...bq, callout: scan, titleTokens: scan.title ? title.tokens : null, bodyTokens: body };
        },
    },
    renderer: {
        blockquote(token) {
            const scan = token.callout;
            if (!scan) return false;
            const fold = scan.fold !== '';
            const tag = fold ? 'details' : 'div';
            const open = fold && (expandFolds || scan.fold === '+') ? ' open' : '';
            const titleHtml = token.titleTokens ? this.parser.parseInline(token.titleTokens) : calloutTitle(scan);
            const titleTag = fold ? 'summary' : 'div';
            const hasBody = token.bodyTokens.some((t) => t.type !== 'space');
            const content = hasBody ? `<div class="callout-content">${this.parser.parse(token.bodyTokens)}</div>` : '';
            return `<${tag} class="callout callout-${scan.canonical}"${open}><${titleTag} class="callout-title"><span class="${mark}icon-${scan.canonical}"></span><span class="callout-title-text">${titleHtml}</span></${titleTag}>${content}</${tag}>\n`;
        },
    },
});
