import { describe, it, expect } from 'vitest';
import { convertTableToHTML } from '../livePreview';

// ---------------------------------------------------------------------------
// ROUND G — convertTableToHTML backfill (must be exported from livePreview.js)
// ---------------------------------------------------------------------------
//
// Pinned contract (choices the spec left open, stated as decisions):
//
//  * Input is raw markdown table text (pipe rows, newline-separated).
//  * Output structure:
//      <table><thead><tr><th>..</th>..</tr></thead>
//             <tbody><tr><td>..</td>..</tr>..</tbody></table>
//    Row 0 -> <thead> with <th> cells. The delimiter row (index 1, matching
//    /^\|?[\s\-:|]+\|?$/ and containing '-') is consumed, never rendered.
//    Remaining rows -> <tbody> with <td> cells.
//  * Alignment tokens on the delimiter row set per-column alignment, applied as
//    a class="cm-align-X" on EVERY cell (th + td) of that column:
//      :---  -> cm-align-left   ---:  -> cm-align-right   :---: -> cm-align-center
//      ---   -> none
//    A "none" column gets NO class attribute. Alignment is NEVER emitted as an
//    inline style="text-align: X" — sanitizeHTML (DOMPurify) strips `style` but
//    keeps `class`, so inline style would render every cell left-aligned.
//    (TASK 6 / audit #5 — contract change from the earlier inline-style form.)
//  * Empty, whitespace-only, or single-line input (no delimiter row) returns
//    exactly: <div class='cm-table-empty'>Empty Table</div>
//  * Cell content runs through the existing mini-parser: **x** -> <strong>x</strong>,
//    and &, <, > are HTML-escaped FIRST so a raw <script> can never execute.

const T = (...lines) => lines.join('\n');
const EMPTY = "<div class='cm-table-empty'>Empty Table</div>";

describe('convertTableToHTML — basic structure', () => {
    it('wraps a 2-col table in <table><thead>..</thead><tbody>..</tbody></table>', () => {
        const html = convertTableToHTML(T('| H1 | H2 |', '| --- | --- |', '| a | b |'));
        expect(html).toContain('<table>');
        expect(html).toMatch(/<thead>[\s\S]*<th[^>]*>H1<\/th>[\s\S]*<th[^>]*>H2<\/th>[\s\S]*<\/thead>/);
        expect(html).toMatch(/<tbody>[\s\S]*<td[^>]*>a<\/td>[\s\S]*<td[^>]*>b<\/td>[\s\S]*<\/tbody>/);
    });

    it('renders header cells as <th>, body cells as <td>, and drops the delimiter row', () => {
        const html = convertTableToHTML(T('| H1 | H2 |', '| --- | --- |', '| a | b |'));
        expect(html).not.toContain('---');
        expect((html.match(/<th[ >]/g) || []).length).toBe(2);
        expect((html.match(/<td[ >]/g) || []).length).toBe(2);
    });

    it('renders every body row', () => {
        const html = convertTableToHTML(T('| H |', '| --- |', '| r1 |', '| r2 |', '| r3 |'));
        expect((html.match(/<tr>/g) || []).length).toBe(4); // 1 header + 3 body
        expect(html).toContain('<td');
        expect(html).toContain('r3');
    });
});

describe('convertTableToHTML — alignment (TASK 6 / audit #5: class, not inline style)', () => {
    it('maps :--- / :---: / ---: to cm-align-left / -center / -right on header cells', () => {
        const html = convertTableToHTML(T('| L | C | R |', '| :--- | :---: | ---: |', '| 1 | 2 | 3 |'));
        expect(html).toMatch(/<th[^>]*class="cm-align-left"[^>]*>L<\/th>/);
        expect(html).toMatch(/<th[^>]*class="cm-align-center"[^>]*>C<\/th>/);
        expect(html).toMatch(/<th[^>]*class="cm-align-right"[^>]*>R<\/th>/);
    });

    it('applies the same per-column alignment class to body cells', () => {
        const html = convertTableToHTML(T('| L | C | R |', '| :--- | :---: | ---: |', '| 1 | 2 | 3 |'));
        expect(html).toMatch(/<td[^>]*class="cm-align-left"[^>]*>1<\/td>/);
        expect(html).toMatch(/<td[^>]*class="cm-align-center"[^>]*>2<\/td>/);
        expect(html).toMatch(/<td[^>]*class="cm-align-right"[^>]*>3<\/td>/);
    });

    it('recognises a delimiter row with no outer pipes (h\\n:--:\\nx)', () => {
        const html = convertTableToHTML(T('| h |', '| :--: |', '| x |'));
        expect(html).toMatch(/<th[^>]*class="cm-align-center"[^>]*>h<\/th>/);
        expect(html).toMatch(/<td[^>]*class="cm-align-center"[^>]*>x<\/td>/);
    });

    it('---: (right) and :--- (left) each map to their class', () => {
        const right = convertTableToHTML(T('| h |', '| ---: |', '| x |'));
        expect(right).toMatch(/<th[^>]*class="cm-align-right"[^>]*>h<\/th>/);
        const left = convertTableToHTML(T('| h |', '| :--- |', '| x |'));
        expect(left).toMatch(/<th[^>]*class="cm-align-left"[^>]*>h<\/th>/);
    });

    it('a plain "---" column carries NO cm-align class and NO inline style', () => {
        const html = convertTableToHTML(T('| A | B |', '| --- | --- |', '| 1 | 2 |'));
        expect(html).not.toContain('cm-align');
        expect(html).not.toContain('text-align');
        expect(html).not.toContain('style=');
    });

    it('NEVER emits an inline style="text-align:..." for any alignment (DOMPurify strips style)', () => {
        const html = convertTableToHTML(T('| L | C | R |', '| :--- | :---: | ---: |', '| 1 | 2 | 3 |'));
        expect(html).not.toContain('style="text-align');
        expect(html).not.toContain('text-align');
    });

    it('mixed row: aligned column keeps its class, plain column gets none', () => {
        const html = convertTableToHTML(T('| A | B |', '| :---: | --- |', '| 1 | 2 |'));
        expect(html).toMatch(/<th[^>]*class="cm-align-center"[^>]*>A<\/th>/);
        // second column (B / 2) has no class
        expect(html).toMatch(/<th>B<\/th>/);
        expect(html).toMatch(/<td>2<\/td>/);
    });
});

describe('convertTableToHTML — empty fallback', () => {
    it('returns the empty-table div for an empty string', () => {
        expect(convertTableToHTML('')).toBe(EMPTY);
    });
    it('returns the empty-table div for whitespace only', () => {
        expect(convertTableToHTML('   \n  ')).toBe(EMPTY);
    });
    it('returns the empty-table div for a single line with no delimiter row', () => {
        expect(convertTableToHTML('| just one cell |')).toBe(EMPTY);
    });
});

describe('convertTableToHTML — cell content', () => {
    it('renders **bold** inside a cell as <strong>', () => {
        const html = convertTableToHTML(T('| H |', '| --- |', '| **bold** |'));
        expect(html).toContain('<strong>bold</strong>');
    });

    it('escapes a raw <script> in a cell so it cannot execute', () => {
        const html = convertTableToHTML(T('| H |', '| --- |', '| <script>alert(1)</script> |'));
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });
});

// ---------------------------------------------------------------------------
// TASK 3 — link with a title attribute inside a table cell (audit #10)
//
// parseCellContent link rule: html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" ...')
// captures `url "title"` into $2, so a titled link in a cell renders
// href="http://x "hi"" (broken attr, title leaks). Fix mirrors the image /
// linkPreview fix: URL group stops at whitespace/quote/paren, title dropped.
//
// Pinned contract:
//   * | [t](http://x "hi") |  -> cell HTML contains href="http://x" exactly,
//     no "hi", no &quot;.
//   * | [t](http://x) |       -> unchanged.
//   * URL group [^"\s)]+ keeps query strings; stops at the first space.
//   * out of scope: images inside table cells, escaped \" in a title.
// ---------------------------------------------------------------------------
describe('convertTableToHTML — link title in a cell (TASK 3)', () => {
    it('strips the title from a titled link in a cell (FAILS before fix)', () => {
        const html = convertTableToHTML(T('| H |', '| --- |', '| [t](http://x "hi") |'));
        expect(html).toContain('href="http://x"');
        expect(html).not.toContain('hi');
        expect(html).not.toContain('&quot;');
    });

    it('leaves an untitled link in a cell unchanged', () => {
        const html = convertTableToHTML(T('| H |', '| --- |', '| [t](http://x) |'));
        expect(html).toContain('href="http://x"');
        expect(html).toContain('>t</a>');
    });

    it('keeps a query string in the URL when a title follows', () => {
        const html = convertTableToHTML(T('| H |', '| --- |', '| [t](http://x?a=1&b=2 "hi") |'));
        expect(html).toContain('href="http://x?a=1&amp;b=2"');
        expect(html).not.toContain('hi');
    });
});

// ---------------------------------------------------------------------------
// TASK 6 — audit #6: a GFM table nested in a Blockquote renders "Empty Table"
//
// The `Table` Lezer node nests INSIDE `Blockquote` (verified against the
// installed parser). doc.sliceString(Table.from, Table.to) still carries the
// leading "> " quote prefix on every row after the first, so the delimiter
// row reads "> | - | - |", the /^\|?[\s\-:|]+\|?$/ test fails, and
// convertTableToHTML bails out to the Empty-Table div.
//
// Pinned contract for the fix:
//   * convertTableToHTML strips a leading ">" + at most one following space
//     (/^>\s?/) from EACH row, right after `text.trim().split('\n')`, BEFORE
//     the delimiter check and the per-row loop.
//   * A non-quoted table is unaffected — /^>\s?/ is a no-op on its rows
//     (regression: every existing test above still passes unchanged).
//   * Both "> " (space) and ">" (no space) prefixes are handled.
// ---------------------------------------------------------------------------
describe('convertTableToHTML — blockquote-prefixed rows (TASK 6 / audit #6)', () => {
    it('renders a real <table> for "> "-prefixed rows, not the Empty-Table div', () => {
        const html = convertTableToHTML(T('> | a | b |', '> | - | - |', '> | 1 | 2 |'));
        expect(html).not.toContain('cm-table-empty');
        expect(html).not.toContain('Empty Table');
        expect(html).toContain('<table>');
        expect(html).toMatch(/<th[^>]*>a<\/th>/);
        expect(html).toMatch(/<th[^>]*>b<\/th>/);
        expect(html).toMatch(/<td[^>]*>1<\/td>/);
        expect(html).toMatch(/<td[^>]*>2<\/td>/);
    });

    it('handles ">"-prefixed rows with no space after the ">"', () => {
        const html = convertTableToHTML(T('>| a | b |', '>| - | - |', '>| 1 | 2 |'));
        expect(html).not.toContain('cm-table-empty');
        expect(html).toContain('<table>');
        expect(html).toMatch(/<th[^>]*>a<\/th>/);
        expect(html).toMatch(/<td[^>]*>2<\/td>/);
    });

    it('mixed prefix (parser slice: first row unprefixed, rest quoted) still renders', () => {
        // This is the exact shape doc.sliceString gives for a blockquote table:
        // the opening QuoteMark sits outside Table.from, so row 0 has no "> ".
        const html = convertTableToHTML(T('| a | b |', '> | - | - |', '> | 1 | 2 |'));
        expect(html).not.toContain('cm-table-empty');
        expect(html).toContain('<table>');
        expect(html).toMatch(/<th[^>]*>a<\/th>/);
        expect(html).toMatch(/<td[^>]*>1<\/td>/);
    });

    it('strips only ONE leading space after ">" (indented quote body keeps the rest)', () => {
        // ">  | a | b |" -> after /^>\s?/ -> " | a | b |" -> trims fine, still a table.
        const html = convertTableToHTML(T('>  | a | b |', '>  | - | - |', '>  | 1 | 2 |'));
        expect(html).not.toContain('cm-table-empty');
        expect(html).toMatch(/<th[^>]*>a<\/th>/);
    });

    it('pinned: strips ONLY ONE quote level — a "> >" nested table falls back to Empty Table', () => {
        // /^>\s?/ removes one "> "; the delimiter row is left as "> | - | - |",
        // which fails /^\|?[\s\-:|]+\|?$/, so convertTableToHTML bails to the
        // Empty-Table div. Deeper nesting is a deliberate non-feature, not a bug.
        const html = convertTableToHTML(T('> > | a | b |', '> > | - | - |', '> > | 1 | 2 |'));
        expect(html).toBe("<div class='cm-table-empty'>Empty Table</div>");
    });

    it('regression: a plain non-quoted table renders with no stray ">" leaked into a cell', () => {
        const html = convertTableToHTML(T('| a | b |', '| --- | --- |', '| 1 | 2 |'));
        expect(html).toBe(
            '<table><thead><tr><th>a</th><th>b</th></tr></thead>' +
            '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
        );
    });
});

// ---------------------------------------------------------------------------
// TASK 6 — audit #7: an escaped pipe "\|" inside a cell splits the cell
//
// Cell/delimiter splitting is done with cleanRow.split('|'), which treats a
// backslash-escaped "\|" as a column separator. "| `a \| b` | c |" produces
// 3 cells instead of 2.
//
// Pinned contract for the fix:
//   * Rows are split on an UNESCAPED pipe only: .split(/(?<!\\)\|/)
//     (lookbehind; Node 20+). The delimiter row is split the same way, so
//     alignment column indices still line up with body cells.
//   * After splitting, EACH cell has its literal "\|" un-escaped to "|"
//     (cell.replace(/\\\|/g, '|')) BEFORE parseCellContent runs — so the
//     literal "|" survives into the rendered <td>/<th> (parseCellContent only
//     HTML-escapes & < >, never "|").
//   * The existing leading/trailing `replace(/^\|/,'').replace(/\|$/,'')` on a
//     row stays as-is (an unescaped outer pipe).
//   * A cell whose "\|" is at the very start still yields a literal leading "|".
// ---------------------------------------------------------------------------
describe('convertTableToHTML — escaped pipe in a cell (TASK 6 / audit #7)', () => {
    it('"| `a \\| b` | c |" is exactly 2 columns, not 3', () => {
        const html = convertTableToHTML(T('| `a \\| b` | c |', '| --- | --- |', '| 1 | 2 |'));
        expect((html.match(/<th[ >]/g) || []).length).toBe(2);
        expect((html.match(/<td[ >]/g) || []).length).toBe(2);
    });

    it('the escaped pipe renders as ONE literal "|" inside the first cell', () => {
        const html = convertTableToHTML(T('| `a \\| b` | c |', '| --- | --- |', '| 1 | 2 |'));
        // `a \| b` -> code span with a single literal pipe
        expect(html).toContain('<code>a | b</code>');
        expect(html).not.toContain('\\|');   // backslash-pipe never survives
        expect(html).toMatch(/<th[^>]*>c<\/th>/);
    });

    it('escaped pipe in a BODY cell splits the same way (2 cells, literal "|")', () => {
        const html = convertTableToHTML(T('| H1 | H2 |', '| --- | --- |', '| a \\| b | c |'));
        expect((html.match(/<td[ >]/g) || []).length).toBe(2);
        expect(html).toMatch(/<td[^>]*>a \| b<\/td>/);
        expect(html).toMatch(/<td[^>]*>c<\/td>/);
    });

    it('"\\|" at the very start of a cell -> literal leading "|"', () => {
        const html = convertTableToHTML(T('| H1 | H2 |', '| --- | --- |', '| \\|x | y |'));
        expect((html.match(/<td[ >]/g) || []).length).toBe(2);
        expect(html).toMatch(/<td[^>]*>\|x<\/td>/);
        expect(html).toMatch(/<td[^>]*>y<\/td>/);
    });

    it('a plain (unescaped) table is unchanged by the new split', () => {
        const html = convertTableToHTML(T('| a | b | c |', '| --- | --- | --- |', '| 1 | 2 | 3 |'));
        expect((html.match(/<th[ >]/g) || []).length).toBe(3);
        expect((html.match(/<td[ >]/g) || []).length).toBe(3);
    });
});

// ---------------------------------------------------------------------------
// TASK 6 — #6 strip and #7 unescaped-split COMPOSE
//
// "> | a \| b | c |" inside a blockquote: after the ">" strip AND the
// unescaped-pipe split -> 2 cells, "a | b" and "c". Alignment index still
// lines up because the delimiter row is split the same new way.
// ---------------------------------------------------------------------------
describe('convertTableToHTML — blockquote strip + escaped pipe compose (TASK 6)', () => {
    it('"> | a \\| b | c |" -> 2 columns, header cells "a | b" and "c"', () => {
        const html = convertTableToHTML(T('> | a \\| b | c |', '> | - | - |', '> | 1 | 2 |'));
        expect(html).not.toContain('cm-table-empty');
        expect((html.match(/<th[ >]/g) || []).length).toBe(2);
        expect(html).toMatch(/<th[^>]*>a \| b<\/th>/);
        expect(html).toMatch(/<th[^>]*>c<\/th>/);
        expect(html).toMatch(/<td[^>]*>1<\/td>/);
        expect(html).toMatch(/<td[^>]*>2<\/td>/);
    });

    it('compose + alignment: index j still lines up across the new split', () => {
        const html = convertTableToHTML(T('> | a \\| b | c |', '> | :---: | ---: |', '> | 1 | 2 |'));
        expect(html).toMatch(/<th[^>]*class="cm-align-center"[^>]*>a \| b<\/th>/);
        expect(html).toMatch(/<th[^>]*class="cm-align-right"[^>]*>c<\/th>/);
        expect(html).toMatch(/<td[^>]*class="cm-align-center"[^>]*>1<\/td>/);
        expect(html).toMatch(/<td[^>]*class="cm-align-right"[^>]*>2<\/td>/);
    });
});
