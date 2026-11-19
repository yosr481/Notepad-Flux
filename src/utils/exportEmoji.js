import { scanEmoji } from '../extensions/emojiSyntax';
import { emojiFor } from './emojiTable';

// Emoji shortcodes for marked: the editor's scanner (scanEmoji) plus the table. The character is plain text.
// marked gives start() only the source after its first char, but tokenizer(src, tokens) gets the tokens emitted so
// far in this inline run (text merges into the last one), so the real previous char is the end of the last token's raw.
// No tokens = start of the run (line start or a parent's opening delimiter): fine, as in the editor.
// start() may cut at an opener that then fails the boundary; the tokenizer declines and the text just continues.
const ALNUM = /[a-zA-Z0-9]/;

export const emojiExtension = {
    extensions: [{
        name: 'emoji',
        level: 'inline',
        start(src) {
            for (let i = src.indexOf(':'); i >= 0; i = src.indexOf(':', i + 1)) if (scanEmoji(src, i)) return i;
            return undefined;
        },
        tokenizer(src, tokens) {
            const hit = scanEmoji(src, 0); // first: reading the last token's raw on every call flattens its string, O(n^2)
            if (hit && ALNUM.test(tokens.at(-1)?.raw.slice(-1) ?? '')) return undefined;
            const emoji = hit && emojiFor(hit.name);
            return emoji ? { type: 'emoji', raw: src.slice(0, hit.to), text: emoji } : undefined;
        },
        renderer: (t) => t.text,
    }],
};
