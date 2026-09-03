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
//  * Alignment tokens on the delimiter row set per-column text-align, applied as
//    an inline style="text-align: X" on EVERY cell (th + td) of that column:
//      :---  -> left     ---:  -> right     :---: -> center     ---   -> none
//    A "none" column gets NO style attribute.
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

describe('convertTableToHTML — alignment', () => {
    it('maps :--- / :---: / ---: to left / center / right on header cells', () => {
        const html = convertTableToHTML(T('| L | C | R |', '| :--- | :---: | ---: |', '| 1 | 2 | 3 |'));
        expect(html).toMatch(/<th[^>]*style="text-align: left"[^>]*>L<\/th>/);
        expect(html).toMatch(/<th[^>]*style="text-align: center"[^>]*>C<\/th>/);
        expect(html).toMatch(/<th[^>]*style="text-align: right"[^>]*>R<\/th>/);
    });

    it('applies the same per-column alignment to body cells', () => {
        const html = convertTableToHTML(T('| L | C | R |', '| :--- | :---: | ---: |', '| 1 | 2 | 3 |'));
        expect(html).toMatch(/<td[^>]*style="text-align: left"[^>]*>1<\/td>/);
        expect(html).toMatch(/<td[^>]*style="text-align: center"[^>]*>2<\/td>/);
        expect(html).toMatch(/<td[^>]*style="text-align: right"[^>]*>3<\/td>/);
    });

    it('a plain "---" column carries no text-align style at all', () => {
        const html = convertTableToHTML(T('| A | B |', '| --- | --- |', '| 1 | 2 |'));
        expect(html).not.toContain('text-align');
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
