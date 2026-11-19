import { normalizeLabel } from '../extensions/linkDefs';
import { scanFootnoteDef, scanFootnoteRef, scanInlineFootnote, footnoteDefEnd, numberFootnotes, defText } from '../extensions/footnoteSyntax';

// Footnotes for marked: same rules as the editor (footnoteSyntax). marked lexes every block before any
// inline text, so definitions (registered while lexing blocks, first per label wins) are known when
// refs are tokenized. Refs and inline notes are recorded in document order, numbered by numberFootnotes.
// Ids are emitted as marker classes `${mark}fn-1`; finish turns them into ids after sanitizing.
const footnoteExtension = (state, mark) => ({
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
                // Lexed even for a duplicate; its events are tagged IGNORED and never numbered, like in the editor.
                const tokens = this.lexer.blockTokens(defText(src.slice(def.markEnd, end)), []);
                const key = normalizeLabel(def.label);
                const first = !state.defs.has(key);
                if (first) state.defs.set(key, tokens);
                state.bodies.push({ inDef: first ? key : IGNORED, tokens });
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
                state.events.push({ kind: 'ref', label, inDef: null });
                return { type: 'footnoteRef', raw: src.slice(0, ref.end), index: state.events.length - 1, inLink: this.lexer.state.inLink };
            },
            renderer: (t) => refHtml(state, mark, t),
        },
        {
            name: 'inlineFootnote',
            level: 'inline',
            start: (src) => { const i = src.indexOf('^['); return i < 0 ? undefined : i; },
            tokenizer(src) {
                const note = scanInlineFootnote(src);
                if (!note) return undefined;
                const event = { kind: 'inline', inDef: null };
                state.events.push(event); // before the content: refs inside it come after, like in the editor
                const index = state.events.length - 1;
                event.tokens = this.lexer.inlineTokens(note.content);
                return { type: 'inlineFootnote', raw: src.slice(0, note.end), index, inLink: this.lexer.state.inLink };
            },
            renderer: (t) => refHtml(state, mark, t),
        },
    ],
});

const refId = (number, occurrence) => (occurrence === 1 ? `fnref-${number}` : `fnref-${number}-${occurrence}`);
const IGNORED = Symbol('ignored duplicate definition');

// An anchor inside link text would nest <a> in <a>: the number is a plain <sup> there, but it still carries the
// ref id marker so the note's back-link resolves to it.
const refHtml = (state, mark, t) => {
    const { number, occurrence } = state.numbered().ids[t.index];
    if (t.inLink) return `<sup class="${mark}${refId(number, occurrence)}">${number}</sup>`;
    return `<sup><a href="#fn-${number}" class="footnote-ref ${mark}${refId(number, occurrence)}">${number}</a></sup>`;
};

// Tag every event with the label of the definition it sits in. Inline lexing runs after all blocks, so this
// is done on the finished definition bodies, once, when numbering is first needed.
const tagEvents = (events, bodies) => {
    const walk = (node, inDef) => {
        if (Array.isArray(node)) return node.forEach((n) => walk(n, inDef));
        if (!node || typeof node !== 'object') return;
        if (node.type === 'footnoteRef' || node.type === 'inlineFootnote') {
            events[node.index].inDef = inDef;
            if (events[node.index].tokens) walk(events[node.index].tokens, inDef);
        }
        Object.values(node).forEach((v) => walk(v, inDef));
    };
    for (const { inDef, tokens } of bodies) walk(tokens, inDef);
};

// Lex, render and append the notes section. Ids and hrefs are built from numbers only; labels never reach the output.
export const createFootnotes = (mark) => {
    const state = { defs: new Map(), events: [], bodies: [] };
    let cached;
    state.numbered = () => {
        if (cached?.length === state.events.length) return cached.value;
        tagEvents(state.events, state.bodies);
        const numbers = numberFootnotes(state.events, () => true);
        const seen = new Map(), notes = [];
        const ids = numbers.map((number, i) => {
            if (number === null) return null;
            const occurrence = (seen.get(number) ?? 0) + 1;
            seen.set(number, occurrence);
            if (occurrence === 1) notes[number - 1] = state.events[i];
            return { number, occurrence };
        });
        cached = { length: state.events.length, value: { ids, notes, counts: seen } };
        return cached.value;
    };
    // Call with the Marked instance that rendered the body, after parsing; returns html plus the notes section.
    const appendSection = (m, html) => {
        if (!state.events.length) return html;

        const { notes, counts } = state.numbered();
        const items = notes.map((event, k) => {
            const number = k + 1;
            const rendered = event.kind === 'inline'
                ? m.parser([{ type: 'paragraph', raw: '', text: '', tokens: event.tokens }])
                : m.parser(state.defs.get(event.label));
            const back = Array.from({ length: counts.get(number) }, (_, o) => `<a href="#${refId(number, o + 1)}" class="footnote-backref">↩</a>`).join(' ');
            const trimmed = rendered.trimEnd();
            const body = trimmed.endsWith('</p>') ? `${trimmed.slice(0, -4)}${back}</p>\n` : `${rendered}${back}\n`;
            return `<li class="${mark}fn-${number}">\n${body}</li>\n`;
        });
        return `${html}<section class="footnotes">\n<ol>\n${items.join('')}</ol>\n</section>\n`;
    };
    // Post-sanitize DOM pass: marker classes become ids, so raw HTML in the document can never produce an id.
    const finish = (root) => {
        for (const el of root.querySelectorAll(`[class*="${mark}"]`)) {
            const cls = [...el.classList].find((c) => c.startsWith(mark));
            el.classList.remove(cls);
            el.id = cls.slice(mark.length);
            if (!el.classList.length) el.removeAttribute('class');
        }
    };
    return { extension: footnoteExtension(state, mark), appendSection, finish };
};

