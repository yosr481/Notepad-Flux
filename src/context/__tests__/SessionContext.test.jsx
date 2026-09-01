import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { SessionProvider, useSession } from '../SessionContext';

vi.mock('../../services/storage', () => ({
    storage: {
        loadSession: vi.fn(async () => ({ tabs: [] })),
        saveTab: vi.fn(),
        saveMetadata: vi.fn(),
        deleteTab: vi.fn(),
        clearSession: vi.fn(),
    },
}));

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

describe('SessionContext.closeTab (L3)', () => {
    it('does not remove the last remaining tab', () => {
        const api = renderSession();
        expect(api.tabs).toHaveLength(1);
        const lastId = api.tabs[0].id;

        act(() => {
            api.closeTab(lastId);
        });

        expect(api.tabs).toHaveLength(1);
        expect(api.tabs[0].id).toBe(lastId);
    });

    it('removes a tab when others remain', () => {
        const api = renderSession();
        act(() => {
            api.setTabs([
                { id: 'tab-1', title: 'A', content: '', isDirty: false },
                { id: 'tab-2', title: 'B', content: '', isDirty: false },
            ]);
        });

        act(() => {
            api.closeTab('tab-1');
        });

        expect(api.tabs.map(t => t.id)).toEqual(['tab-2']);
    });
});
