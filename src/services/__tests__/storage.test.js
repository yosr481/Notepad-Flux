import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../storage';
import 'fake-indexeddb/auto';

describe('Storage Service', () => {
    const mockTabs = [
        { id: '1', content: 'Test Content', title: 'Test.txt', isDirty: false }
    ];

    beforeEach(async () => {
        await storage.clearSession();
    });

    it('should save and restore session', async () => {
        // We need to save tabs individually or use saveMetadata depending on implementation
        // storage.js has saveTab, saveMetadata, loadSession

        // Mock the active tab ID
        await storage.saveMetadata({ activeTabId: 0 });

        // Save tabs
        for (const tab of mockTabs) {
            await storage.saveTab(tab);
        }

        const session = await storage.loadSession();
        expect(session).not.toBeNull();
        expect(session.tabs).toHaveLength(1);
        expect(session.tabs[0].content).toBe('Test Content');
        expect(session.activeTabId).toBe(0);
    });

    it('should clear session', async () => {
        await storage.saveTab(mockTabs[0]);
        await storage.clearSession();

        const session = await storage.loadSession();
        // loadSession returns object with empty array if nothing found, based on code reading
        expect(session.tabs).toHaveLength(0);
    });
});
