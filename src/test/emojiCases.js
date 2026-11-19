// Shared case table for editor/export parity (F6 T2). [markdown, expectedEmojiNames[]] in document order.
// Editor side: `Emoji` nodes from emojiSyntax whose name (text between the colons) is known to emojiFor().
// Export side: those names, mapped through emojiFor(), appear as characters in the rendered text, in this order;
// everything else stays literal text.
// Rule pinned = our own scanEmoji (src/extensions/emojiSyntax.js), NOT lezer's built-in Emoji:
//   `:` + [a-zA-Z0-9_+-]+ + `:`, and the char before the opening colon and the char after the closing colon must not
//   be [a-zA-Z0-9] (start/end of text is fine; `_`, punctuation, non-ASCII letters, whitespace, `:` are fine).
// So :+1: :-1: :t-rex: :e-mail: :non-potable_water: parse; a:smile:b, 10:30:45, 12:100:45, 1:100:1000 do not.
// One table, two consumers: src/extensions/__tests__/emojiParity.test.js.
export const EMOJI_CASES = [
    // basics
    [':smile:', ['smile']],
    [':tada:', ['tada']],
    [':thumbsup:', ['thumbsup']],
    [':heart:', ['heart']],               // gemoji value carries U+FE0F
    [':white_check_mark:', ['white_check_mark']],
    [':100:', ['100']],
    ['a :smile: b', ['smile']],
    ['a:smile:b', []],                    // boundary rule: letter before the opening colon
    [':smile:b', []],                     // boundary rule: letter after the closing colon
    ['1:smile:', []],                     // digit before
    [':smile:1', []],                     // digit after
    ['x_:smile:', ['smile']],             // `_` is not a boundary char
    [':smile:_x', ['smile']],
    ['(:smile:)', ['smile']],
    ['a,:smile:,b', ['smile']],
    ['\u05D0:smile:\u05D1', ['smile']],     // Hebrew letters on both sides: not [a-zA-Z0-9]
    ['\u00E9:smile:\u00E9', ['smile']],
    [':smile: :tada: :heart:', ['smile', 'tada', 'heart']],
    [':smile::tada:', ['smile', 'tada']], // adjacent
    [':smile:smile:', []],                // letter after the first closing colon; the 2nd colon has a letter before it
    [':smile:\n:tada:', ['smile', 'tada']],
    // unknown / not parseable by lezer's rule: literal
    [':notanemoji:', []],
    [':SMILE:', []],                      // lezer parses uppercase, table is lowercase-only: unknown
    [':+1:', ['+1']],                     // the 5 names lezer's built-in rule cannot parse
    [':-1:', ['-1']],
    [':t-rex:', ['t-rex']],
    [':e-mail:', ['e-mail']],
    [':non-potable_water:', ['non-potable_water']],
    [':email:', ['email']],
    [':-:', []],                          // scans, but '-' is not a known name
    [':+:', []],
    [':_:', []],
    [':sm ile:', []],
    [':sm\nile:', []],
    ['::', []],
    [':smile', []],
    ['smile:', []],
    [':', []],
    // not shortcodes
    ['10:30:45', []],
    ['at 10:30:45 sharp', []],
    ['12:100:45', []],                    // boundary rule: digits on both sides
    ['1:100:1000', []],
    ['a :100: b', ['100']],
    ['http://x.test', []],
    ['a::b', []],
    ['a::smile::b', ['smile']],           // `::smile:` -> the second colon opens `:smile:`
    // escapes
    ['\\:smile:', []],
    [':smile\\:', []],
    // code, math, URLs, raw HTML, front matter
    ['`:smile:`', []],
    ['``:smile:``', []],
    [':smile: and `:tada:`', ['smile']],
    ['```\n:smile:\n```', []],
    ['~~~\n:smile:\n~~~', []],
    ['    :smile:', []],                  // indented code block
    ['a $:smile:$ b', []],
    ['$$\n:smile:\n$$', []],
    ['[a](http://x.test/:smile:)', []],
    ['[a](http://x.test/ ":smile:")', []], // link title is not inline content either
    ['http://x.test/a:smile:b', []],
    ['<http://x.test/a:smile:b>', []],
    ['<span title=":smile:">x</span>', []],
    ['---\ntitle: :smile:\n---\n\nbody', []],
    ['---\ntitle: :smile:\n---\n\n:tada:', ['tada']],
    // inline contexts that DO parse
    ['**:smile:**', ['smile']],
    ['*:smile:*', ['smile']],
    ['~~:smile:~~', ['smile']],
    ['[:smile:](http://x.test)', ['smile']],
    ['# :smile: title', ['smile']],
    ['- :smile:', ['smile']],
    ['1. :smile:', ['smile']],
    ['> :smile:', ['smile']],
    ['> > :smile:', ['smile']],
    ['- > :smile:', ['smile']],
    ['  :smile:', ['smile']],           // 2-space indent is still a paragraph
    ['| a |\n|---|\n| :smile: |', ['smile']],
    ['> [!NOTE]\n> :smile: hi', ['smile']],
    ['a[^1]\n\n[^1]: :tada: done', ['tada']],
    ['a^[:tada: x]', ['tada']],
    // sub/sup content is not re-parsed (T1): no emoji inside
    ['H~:smile:~', []],
    ['x^:smile:^', []],
    ['~:smile:~ :tada:', ['tada']],
];
