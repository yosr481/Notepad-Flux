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

// ---------------------------------------------------------------------------
// U1 — update download progress (Docs/internal/update-spec.md)
// ASSUMPTION: the spec does not say how StatusBar receives the status; these
// tests assume an `updateStatus` prop (status object or null/undefined).
// ---------------------------------------------------------------------------
describe('StatusBar — update progress item (U1)', () => {
    const status = (over) => ({ state: 'idle', version: null, percent: null, error: null, ...over });

    it('shows "Downloading update 42%" with role=status and class statusUpdate while downloading', () => {
        render(<StatusBar stats={stats} updateStatus={status({ state: 'downloading', version: '2.0.0', percent: 42 })} />);
        const el = screen.getByRole('status');
        expect(el).toHaveTextContent('Downloading update 42%');
        expect(el.className).toMatch(/statusUpdate/);
    });

    it('shows 0% at the start of a download', () => {
        render(<StatusBar stats={stats} updateStatus={status({ state: 'downloading', percent: 0 })} />);
        expect(screen.getByRole('status')).toHaveTextContent('Downloading update 0%');
    });

    it.each(['idle', 'checking', 'available', 'not-available', 'downloaded', 'error', 'unsupported'])(
        'renders nothing update-related in state %s', (state) => {
            render(<StatusBar stats={stats} updateStatus={status({ state, version: '2.0.0', percent: state === 'downloaded' ? 100 : null, error: state === 'error' ? 'boom' : null })} />);
            expect(screen.queryByRole('status')).toBeNull();
            expect(screen.queryByText(/Downloading update/)).toBeNull();
        });

    it('renders nothing when updateStatus is null or omitted', () => {
        const { rerender } = render(<StatusBar stats={stats} updateStatus={null} />);
        expect(screen.queryByRole('status')).toBeNull();
        rerender(<StatusBar stats={stats} />);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('updates live as the percent changes and disappears when done', () => {
        const { rerender } = render(<StatusBar stats={stats} updateStatus={status({ state: 'downloading', percent: 5 })} />);
        expect(screen.getByRole('status')).toHaveTextContent('Downloading update 5%');
        rerender(<StatusBar stats={stats} updateStatus={status({ state: 'downloading', percent: 6 })} />);
        expect(screen.getByRole('status')).toHaveTextContent('Downloading update 6%');
        rerender(<StatusBar stats={stats} updateStatus={status({ state: 'downloaded', percent: 100 })} />);
        expect(screen.queryByRole('status')).toBeNull();
    });
});
