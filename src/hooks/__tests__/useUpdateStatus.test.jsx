import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as mod from '../useUpdateStatus';

// Spec U1: returns status or null when window.electronAPI?.updates is missing;
// subscribes on mount, fetches current status, unsubscribes on unmount;
// a push arriving before the initial fetch resolves wins.
const useUpdateStatus = mod.useUpdateStatus ?? mod.default;

const st = (over = {}) => ({ state: 'idle', version: null, percent: null, error: null, ...over });

function installApi(getStatus) {
    let cb = null;
    const unsubscribe = vi.fn();
    const updates = {
        getStatus: vi.fn(getStatus),
        check: vi.fn(), download: vi.fn(), install: vi.fn(),
        onStatus: vi.fn((fn) => { cb = fn; return unsubscribe; }),
    };
    window.electronAPI = { updates };
    return { updates, unsubscribe, push: (s) => cb(s) };
}

afterEach(() => { delete window.electronAPI; });

describe('useUpdateStatus', () => {
    it('is exported', () => {
        expect(typeof useUpdateStatus).toBe('function');
    });

    it('returns null when there is no electronAPI (web build)', () => {
        const { result } = renderHook(() => useUpdateStatus());
        expect(result.current).toBeNull();
    });

    it('returns null when electronAPI exists without updates', () => {
        window.electronAPI = {};
        const { result } = renderHook(() => useUpdateStatus());
        expect(result.current).toBeNull();
    });

    it('fetches the current status on mount and returns it', async () => {
        const api = installApi(async () => st({ state: 'available', version: '2.0.0' }));
        const { result } = renderHook(() => useUpdateStatus());
        await waitFor(() => expect(result.current).toEqual(st({ state: 'available', version: '2.0.0' })));
        expect(api.updates.getStatus).toHaveBeenCalledTimes(1);
        expect(api.updates.onStatus).toHaveBeenCalledTimes(1);
    });

    it('pushed statuses update the returned value', async () => {
        const api = installApi(async () => st());
        const { result } = renderHook(() => useUpdateStatus());
        await waitFor(() => expect(result.current).toEqual(st()));
        act(() => api.push(st({ state: 'downloading', percent: 42 })));
        expect(result.current).toEqual(st({ state: 'downloading', percent: 42 }));
    });

    it('unsubscribes on unmount', async () => {
        const api = installApi(async () => st());
        const { unmount } = renderHook(() => useUpdateStatus());
        expect(api.unsubscribe).not.toHaveBeenCalled();
        unmount();
        expect(api.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('a push before the fetch resolves wins over the stale fetch result', async () => {
        let resolveFetch;
        const api = installApi(() => new Promise((r) => { resolveFetch = r; }));
        const { result } = renderHook(() => useUpdateStatus());
        act(() => api.push(st({ state: 'downloading', percent: 10 })));
        await act(async () => { resolveFetch(st({ state: 'idle' })); });
        expect(result.current).toEqual(st({ state: 'downloading', percent: 10 }));
    });

    it('a fetch resolving after unmount does not throw or resubscribe', async () => {
        let resolveFetch;
        const api = installApi(() => new Promise((r) => { resolveFetch = r; }));
        const { unmount } = renderHook(() => useUpdateStatus());
        unmount();
        await act(async () => { resolveFetch(st({ state: 'idle' })); });
        expect(api.updates.onStatus).toHaveBeenCalledTimes(1);
    });

    it('a rejected getStatus does not crash the hook', async () => {
        const api = installApi(async () => { throw new Error('ipc gone'); });
        const { result } = renderHook(() => useUpdateStatus());
        await act(async () => { await Promise.resolve(); });
        expect(api.updates.getStatus).toHaveBeenCalled();
        expect(result.current).toBeNull();
    });
});
