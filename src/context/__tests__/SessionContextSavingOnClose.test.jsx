import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { SessionProvider, useTabState } from '../SessionContext';
import { storage } from '../../services/storage';
import { createFakeLockManager } from '../../test/fakeLocks';

vi.mock('../../utils/fileSystem', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, fileSystem: { ...actual.fileSystem, fileExists: vi.fn(async () => null) } };
});
vi.mock('../../services/storage', () => ({
    storage: {
        loadSession: vi.fn(async () => ({ tabs: [] })),
        saveTab: vi.fn(), saveMetadata: vi.fn(), saveSnapshot: vi.fn(async () => {}),
        getSchemaVersion: vi.fn(async () => 1), deleteTab: vi.fn(), clearSession: vi.fn(),
    },
}));

// savingOnClose drives the "Saving your tabs" indicator: on only once a close wait has run 400ms.
let closeCb, history;
const probe = {}; // latest useTabState() value, filled by Probe
const latest = () => probe.state;
function mount() {
    window.electronAPI = { onCloseRequested: vi.fn((cb) => { closeCb = cb; return () => {}; }) };
    function Probe() { const st = useTabState(); Object.assign(probe, { state: st }); history.push(st.savingOnClose); return null; }
    render(<SessionProvider><Probe /></SessionProvider>);
}
const slowSave = () => {
    let finish;
    storage.saveSnapshot.mockImplementationOnce(() => new Promise(r => { finish = r; }));
    return () => finish();
};

describe('SessionContext: savingOnClose', () => {
    beforeEach(async () => {
        Object.defineProperty(navigator, 'locks', { configurable: true, writable: true, value: createFakeLockManager() });
        vi.clearAllMocks(); closeCb = null; history = [];
        mount();
        await waitFor(() => { expect(latest().isSessionLoaded).toBe(true); expect(closeCb).toBeTruthy(); });
    });
    afterEach(() => { vi.useRealTimers(); delete navigator.locks; delete window.electronAPI; });

    it('is false when no close is in progress', () => {
        expect(latest().savingOnClose).toBe(false);
    });

    it('slow flush: false before 400ms, true after, false again once the callback settles', async () => {
        const finish = slowSave();
        vi.useFakeTimers();
        let settled = false;
        const p = closeCb().then(() => { settled = true; });
        await act(async () => { await vi.advanceTimersByTimeAsync(399); });
        expect(latest().savingOnClose).toBe(false);
        await act(async () => { await vi.advanceTimersByTimeAsync(2); });
        expect(latest().savingOnClose).toBe(true);
        await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
        expect(latest().savingOnClose, 'still waiting, indicator must stay').toBe(true);
        expect(settled).toBe(false);
        await act(async () => { finish(); await p; });
        expect(settled).toBe(true);
        expect(latest().savingOnClose).toBe(false);
    });

    it('fast close (<400ms) never sets it, and the timer does not fire later', async () => {
        vi.useFakeTimers();
        history.length = 0;
        await act(async () => { await closeCb(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
        expect(history).not.toContain(true);
        expect(latest().savingOnClose).toBe(false);
    });

    it('a flush that throws still clears the indicator', async () => {
        vi.useFakeTimers();
        storage.saveSnapshot.mockImplementationOnce(() => new Promise((_, rej) => setTimeout(() => rej(new Error('boom')), 1000)));
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const p = closeCb();
        await act(async () => { await vi.advanceTimersByTimeAsync(600); });
        expect(latest().savingOnClose).toBe(true);
        await act(async () => { await vi.advanceTimersByTimeAsync(600); await p; });
        expect(latest().savingOnClose).toBe(false);
        err.mockRestore();
    });
});
