// Shared case table for editor/export parity (F6 T1). [markdown, expectSubscript, expectSuperscript].
// Editor side: lezer Subscript/Superscript node present. Export side: a <sub>/<sup> element present
// (footnote ref <sup><a class="footnote-ref"> does not count as superscript).
// One table, two consumers: src/extensions/__tests__/subSupParity.test.js.
export const SUB_SUP_CASES = [
    ['H~2~O', true, false],
    ['x^2^', false, true],
    ['~a~', true, false],
    ['^a^', false, true],
    ['a~b~c', true, false],            // intra-word is fine (no flanking rule)
    ['2^10^', false, true],
    ['x^2^ and H~2~O', true, true],
    ['**H~2~O**', true, false],
    ['*x^2^*', false, true],
    ['[a~b~](http://x.test)', true, false],        // link text is inline content
    ['[a](http://x.test/p~1~q)', false, false],    // link URL is not inline content
    ['http://x.test/p~1~q', false, false],          // GFM autolink swallows its tildes
    // spaces end the attempt; backslash-space is allowed
    ['~a b~', false, false],
    ['^a b^', false, false],
    ['~a\\ b~', true, false],
    ['^a\\ b^', false, true],
    ['x ~ y ~ z', false, false],
    ['~a\nb~', false, false],          // newline is whitespace
    // escaped closer / escaped opener
    ['~a\\~b~', true, false],
    ['\\~a\\~', false, false],
    ['\\^a\\^', false, false],
    // empty, unclosed, strikethrough, doubled markers
    ['~a', false, false],
    ['a~', false, false],
    ['~~', false, false],
    ['^^', false, false],
    ['~~del~~', false, false],
    ['~~a~~ and ~b~', true, false],
    ['~~a~', false, false],            // unclosed strikethrough run: the 2nd tilde must not open a subscript
    ['x ~~ ~b~', true, false],         // a text-run of tildes must not swallow a following subscript
    // intra-word `~~` + punctuation-first content: marked's flanking rules refuse <del>, lezer sees Strikethrough
    // (no Subscript). The single-tilde rule must not open mid-run.
    ['a~~(y)~~', false, false],
    ['a~~:x~~', false, false],
    ['a~~:smile:~~', false, false],
    ['a~~.b~~', false, false],
    ['a~~"q"~~', false, false],
    ['a~~[z]~~', false, false],
    ['a~~-k~~', false, false],
    ['a~~!~~', false, false],
    ['a~~*e*~~', false, false],
    ['1~~(y)~~', false, false],
    ['a~~(y)~~b', false, false],
    // `^^` is different: lezer DOES open a Superscript at the 2nd caret (`a^^(y)^^` -> `^`, sup 2..7, `^`).
    ['a^^(y)^^', false, true],
    ['a^^:x^^', false, true],
    ['a^^.b^^', false, true],
    // adjacent / tilde-run neighbours (lezer: 2, 2 and exactly 1 Subscript nodes; the table holds only presence,
    // counts are pinned in export.subsup.test.js for H~2~~3~)
    ['a~1~~2~', true, false],
    ['~a~~b~', true, false],
    ['a~b~~~c~', true, false],
    // footnotes keep winning over superscript
    ['^[note]', false, false],
    // never inside code or math
    ['`H~2~O`', false, false],
    ['`x^2^`', false, false],
    ['```\nH~2~O x^2^\n```', false, false],
    ['~~~\nH~2~O\n~~~', false, false],
    ['$x^2^$', false, false],
];
