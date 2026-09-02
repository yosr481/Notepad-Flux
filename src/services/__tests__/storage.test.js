import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../storage';
import { encrypt } from '../../utils/crypto';
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

    it('loadSession isolates a corrupted tab row: good tab keeps plaintext, bad tab -> ""', async () => {
        // Per-row isolation (round-1 blocker): one undecryptable NFv1: tab must not
        // reject the whole loadSession. Seed two rows directly in the tabs store —
        // one valid NFv1: blob, one NFv1: blob with a flipped char (AES-GCM auth fails).
        const db = await storage.initDB();

        const goodBlob = await encrypt('good tab plaintext');
        const otherBlob = await encrypt('this content will be corrupted');
        const body = otherBlob.slice('NFv1:'.length);
        const i = 4; // inside the IV region; still valid base64 so atob() succeeds
        const corruptedBody = body.slice(0, i) + (body[i] === 'A' ? 'B' : 'A') + body.slice(i + 1);
        const badBlob = 'NFv1:' + corruptedBody;
        expect(badBlob).not.toBe(otherBlob);

        await db.put('tabs', { id: 'good', title: 'Good', content: goodBlob, isDirty: false });
        await db.put('tabs', { id: 'bad', title: 'Bad', content: badBlob, isDirty: false });

        const session = await storage.loadSession();
        expect(session.tabs).toHaveLength(2);
        const byId = Object.fromEntries(session.tabs.map(t => [t.id, t]));
        expect(byId.good).toBeDefined();
        expect(byId.bad).toBeDefined();
        expect(byId.good.content).toBe('good tab plaintext');
        expect(byId.bad.content).toBe('');
    });
});
