import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBar from '../StatusBar';

// ---------------------------------------------------------------------------
// TASK 10 — status bar: delete the fake zoom cell, make the line-ending and
// charset cells show real per-tab values.
// ---------------------------------------------------------------------------
//
// Pinned contract:
//  * The hardcoded "100%" zoom cell is GONE — no element renders that text.
//  * New props: `eol` (default 'LF'), `charset` (default 'UTF-8').
//  * The former "Windows (CRLF)" cell now renders exactly `{eol}` — the bare
//    token 'CRLF' or 'LF', no "Windows (...)" wrapper text.
//  * The former "UTF-8" cell now renders exactly `{charset}`.
//  * `stats` is still required: { line, col, wordCount, charCount }.

const stats = { line: 1, col: 1, wordCount: 0, charCount: 0 };

describe('StatusBar — line-ending + charset cells (TASK 10)', () => {
    it('renders without crashing given stats', () => {
        render(<StatusBar stats={stats} />);
        expect(screen.getByText(/Ln 1, Col 1/)).toBeInTheDocument();
    });

    it('no element renders the literal "100%" zoom text', () => {
        render(<StatusBar stats={stats} eol="LF" charset="UTF-8" />);
        expect(screen.queryByText('100%')).toBeNull();
    });

    it('shows the bare EOL token "CRLF" when eol="CRLF"', () => {
        render(<StatusBar stats={stats} eol="CRLF" charset="UTF-8" />);
        expect(screen.getByText('CRLF')).toBeInTheDocument();
        // the old "Windows (CRLF)" wrapper text is gone
        expect(screen.queryByText('Windows (CRLF)')).toBeNull();
    });

    it('shows "LF" when eol="LF"', () => {
        render(<StatusBar stats={stats} eol="LF" charset="UTF-8" />);
        expect(screen.getByText('LF')).toBeInTheDocument();
    });

    it('shows the charset value verbatim, including "UTF-8 BOM"', () => {
        render(<StatusBar stats={stats} eol="LF" charset="UTF-8 BOM" />);
        expect(screen.getByText('UTF-8 BOM')).toBeInTheDocument();
    });

    it('defaults to "LF" and "UTF-8" when eol / charset props are omitted', () => {
        render(<StatusBar stats={stats} />);
        expect(screen.getByText('LF')).toBeInTheDocument();
        expect(screen.getByText('UTF-8')).toBeInTheDocument();
    });
});
