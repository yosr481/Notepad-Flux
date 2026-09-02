import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { SessionProvider, useSession } from '../SessionContext';
import { storage } from '../../services/storage';

/**
 * ROUND C — P2-settings: SessionContext exposes clearSessionData.
 *
 * Pinned contract:
 *  - The context value gains `clearSessionData` (a stable useCallback).
 *  - clearSessionData() awaits storage.clearSession() then calls
 *    window.location.reload().
 */

vi.mock('../../services/storage', () => ({
    storage: {
        loadSession: vi.fn(async () => ({ tabs: [] })),
        saveTab: vi.fn(),
        saveMetadata: vi.fn(),
        saveSnapshot: vi.fn(async () => {}),
        getSchemaVersion: vi.fn(async () => 1),
        deleteTab: vi.fn(),
        clearSession: vi.fn(async () => {}),
    },
}));

let reloadSpy;
let originalLocation;

beforeEach(() => {
    reloadSpy = vi.fn();
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: { ...originalLocation, reload: reloadSpy },
    });
});

afterEach(() => {
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: originalLocation,
    });
    vi.clearAllMocks();
});

function renderSession() {
    const api = {};
    function Probe() {
        Object.assign(api, useSession());
        return null;
    }
    render(
        <SessionProvider>
            <Probe />
        </SessionProvider>
    );
    return api;
}

describe('SessionContext.clearSessionData', () => {
    it('exposes clearSessionData as a function on the context value', () => {
        const api = renderSession();
        expect(typeof api.clearSessionData).toBe('function');
    });

    it('calls storage.clearSession()', async () => {
        const api = renderSession();
        await act(async () => {
            await api.clearSessionData();
        });
        expect(storage.clearSession).toHaveBeenCalledTimes(1);
    });

    it('reloads the window after clearing', async () => {
        const api = renderSession();
        await act(async () => {
            await api.clearSessionData();
        });
        expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it('clears before it reloads', async () => {
        const order = [];
        storage.clearSession.mockImplementation(async () => { order.push('clear'); });
        reloadSpy.mockImplementation(() => { order.push('reload'); });

        const api = renderSession();
        await act(async () => {
            await api.clearSessionData();
        });
        expect(order).toEqual(['clear', 'reload']);
    });

    it('returns a stable reference across renders', () => {
        const api = renderSession();
        const first = api.clearSessionData;
        expect(typeof first).toBe('function');
        act(() => {
            api.setActiveTabId(api.activeTabId);
        });
        expect(api.clearSessionData).toBe(first);
    });
});
