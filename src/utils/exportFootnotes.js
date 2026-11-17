import { normalizeLabel } from '../extensions/linkDefs';
import { scanFootnoteDef, scanFootnoteRef, scanInlineFootnote, footnoteDefEnd, numberFootnotes } from '../extensions/footnoteSyntax';

// Footnotes for marked: same rules as the editor (footnoteSyntax). marked lexes every block before any
// inline text, so definitions (registered while lexing blocks, first per label wins) are known when
// refs are tokenized. Refs and inline notes are recorded in document order, numbered by numberFootnotes.
const footnoteExtension = (state) => ({
    extensions: [
        {
            name: 'footnoteDef',
            level: 'block',
            start: (src) => src.match(/^ {0,3}\[\^[^\s[\]]{1,999}\]:/m)?.index,
            tokenizer(src) {
                const eol = src.indexOf('\n');
                const def = scanFootnoteDef(eol < 0 ? src : src.slice(0, eol));
                if (!def) return undefined;
                const end = footnoteDefEnd(src);
                const [first, ...rest] = src.slice(def.markEnd, end).split('\n');
                const body = [first.replace(/^[ \t]+/, ''), ...rest.map((l) => l.replace(/^ {0,4}/, ''))].join('\n');
                // Lexed even for a duplicate: its refs still count for numbering, like in the editor.
                const tokens = this.lexer.blockTokens(body, []);
                const key = normalizeLabel(def.label);
                if (!state.defs.has(key)) state.defs.set(key, tokens);
                return { type: 'footnoteDef', raw: src.slice(0, src[end] === '\n' ? end + 1 : end) };
            },
            renderer: () => '',
        },
        {
            name: 'footnoteRef',
            level: 'inline',
            start: (src) => { const i = src.indexOf('[^'); return i < 0 ? undefined : i; },
            tokenizer(src) {
                const ref = scanFootnoteRef(src);
                if (!ref) return undefined;
                const label = normalizeLabel(ref.label);
                if (!state.defs.has(label)) return undefined; // plain link / text rules apply
                state.events.push({ kind: 'ref', label });
                return { type: 'footnoteRef', raw: src.slice(0, ref.end), index: state.events.length - 1 };
            },
            renderer: (t) => {
                const { ids } = state.numbered();
                const { number, occurrence } = ids[t.index];
                return `<sup><a href="#fn-${number}" id="${refId(number, occurrence)}" class="footnote-ref">${number}</a></sup>`;
            },
        },
        {
            name: 'inlineFootnote',
            level: 'inline',
            start: (src) => { const i = src.indexOf('^['); return i < 0 ? undefined : i; },
            tokenizer(src) {
                const note = scanInlineFootnote(src);
                if (!note) return undefined;
                const event = { kind: 'inline' };
                state.events.push(event); // before the content: refs inside it come after, like in the editor
                const index = state.events.length - 1;
                event.tokens = this.lexer.inlineTokens(note.content);
                return { type: 'inlineFootnote', raw: src.slice(0, note.end), index };
            },
            renderer: (t) => {
                const { number, occurrence } = state.numbered().ids[t.index];
                return `<sup><a href="#fn-${number}" id="${refId(number, occurrence)}" class="footnote-ref">${number}</a></sup>`;
            },
        },
    ],
});

const refId = (number, occurrence) => (occurrence === 1 ? `fnref-${number}` : `fnref-${number}-${occurrence}`);

// Lex, render and append the notes section. Ids and hrefs are built from numbers only; labels never reach the output.
export const createFootnotes = () => {
    const state = { defs: new Map(), events: [] };
    let cached;
    state.numbered = () => {
        if (cached?.length === state.events.length) return cached.value;
        const numbers = numberFootnotes(state.events, () => true);
        const seen = new Map(), notes = [];
        const ids = numbers.map((number, i) => {
            const occurrence = (seen.get(number) ?? 0) + 1;
            seen.set(number, occurrence);
            if (occurrence === 1) notes[number - 1] = state.events[i];
            return { number, occurrence };
        });
        cached = { length: state.events.length, value: { ids, notes, counts: seen } };
        return cached.value;
    };
    // Call with the Marked instance that rendered the body, after parsing; returns html plus the notes section.
    const finish = (m, html) => {
        if (!state.events.length) return html;

        const { notes, counts } = state.numbered();
        const items = notes.map((event, k) => {
            const number = k + 1;
            const body0 = event.kind === 'inline'
                ? m.parser([{ type: 'paragraph', raw: '', text: '', tokens: event.tokens }])
                : m.parser(state.defs.get(event.label));
            const back = Array.from({ length: counts.get(number) }, (_, o) => `<a href="#${refId(number, o + 1)}" class="footnote-backref">↩</a>`).join(' ');
            const trimmed = body0.trimEnd();
            const body = trimmed.endsWith('</p>') ? `${trimmed.slice(0, -4)}${back}</p>\n` : `${body0}${back}\n`;
            return `<li id="fn-${number}">\n${body}</li>\n`;
        });
        return `${html}<section class="footnotes">\n<ol>\n${items.join('')}</ol>\n</section>\n`;
    };
    return { extension: footnoteExtension(state), finish };
};

