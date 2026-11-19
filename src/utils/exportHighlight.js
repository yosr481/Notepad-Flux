// ==highlight== for marked: the editor's rule (livePreview.js, /==(.*?)==/ within one line), content parsed
// as inline markdown so ==**b**== keeps its bold. An empty ==== stays text.
export const highlightExtension = {
    extensions: [{
        name: 'highlight',
        level: 'inline',
        start: (src) => { const i = src.indexOf('=='); return i < 0 ? undefined : i; },
        tokenizer(src) {
            const m = /^==([^\n]+?)==/.exec(src);
            if (!m) return undefined;
            return { type: 'highlight', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        },
        renderer(t) { return `<mark>${this.parser.parseInline(t.tokens)}</mark>`; },
    }],
};
