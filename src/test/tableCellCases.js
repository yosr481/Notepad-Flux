// Shared inline snippets for table-cell parity (B12 T1). One list, one consumer today:
// src/extensions/__tests__/tableCells.test.js renders each snippet in a table cell and as a plain paragraph line
// (cursor elsewhere) and compares the visible text and the cm-subscript / cm-superscript / cm-emoji / cm-math /
// cm-footnote-ref classes. Rules: no `|` (cell separator), single line, footnote refs use labels a and b only
// (the test docs define both) and the link reference [r] (-> https://e.com), every snippet must parse as inline content on its own line.
export const TABLE_CELL_CASES = [
    'plain words only',
    'H~2~O and x^2^',
    '**bold H~2~O**',
    '*it :smile: ic*',
    '~~gone~~ $a+b$',
    '$x^2$ and x^2^',
    '`code :smile: $x$ H~2~O ^[n] [^a]`',
    '[link text](https://x.test) and H~2~O',
    ':tada: ==hi== :nope:',
    '12:100:45 and a:smile:b',
    'ref[^a] and note^[inline] end',
    '**$x$[^b]** ~~x^2^~~',
    '\\*not italic\\* and \\~x\\~',
    'cost $5 and H~2~O',
    ':+1: :white_check_mark: done[^a]',
    '&amp; &lt;b&gt; &copy; &#65; &bogus;',
    '<https://e.com> and https://e.com/p',
    '[t][r] [r][] [r] [t][nope] [nope]',
];
