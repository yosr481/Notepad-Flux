import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage, SCHEMA_VERSION } from '../storage';
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

// ---------------------------------------------------------------------------
// ROUND B — P2-atomic: reserved schema version + single-transaction snapshot
// ---------------------------------------------------------------------------
//
// Pinned contract (choices the spec left open, stated so they read as
// decisions and not oversights):
//
//  * SCHEMA_VERSION is a module-level named export, value 1.
//  * storage.getSchemaVersion() resolves to the stored `schemaVersion`
//    metadata value, or 0 when the key is absent (a pre-versioning DB). We
//    pin the absent case to the NUMBER 0, not null — the reader normalises.
//  * The version key is stamped lazily: a fresh DB has no `schemaVersion`
//    until the first loadSession() OR the first saveSnapshot(); either one
//    writes `schemaVersion: SCHEMA_VERSION` if missing. No migration logic —
//    the key is reserved and read, nothing more. Repeated loads keep it at 1.
//  * storage.saveSnapshot({ tabs, metadata }):
//      - tabs: array of tab objects, metadata: plain object of key -> value.
//      - EVERY tab and EVERY metadata key land in ONE readwrite transaction
//        over [tabs, metadata]; encryption of every value happens BEFORE the
//        transaction opens (no awaiting non-idb work mid-transaction).
//      - schemaVersion is written in that same transaction.
//      - tab content is encrypted at rest exactly like saveTab (NFv1 blob).
//      - metadata values are JSON round-tripped exactly like saveMetadata.
//      - the saveTab skip-guard is reused verbatim: a tab with
//        `_decryptFailed && !content` is NOT written, so its prior on-disk
//        row survives untouched. A `_decryptFailed` tab that DID gain real
//        content (user typed into the placeholder) IS written.
//      - an empty snapshot ({ tabs: [], metadata: {} }) is a no-op write that
//        still stamps schemaVersion and does not throw.
//
// All of this fails now: no SCHEMA_VERSION export, no getSchemaVersion, no
// saveSnapshot. The missing named import also red-bars the pre-existing
// storage tests until the export lands — expected for the test-first step.

describe('Storage schema version (P2-atomic — reserved key)', () => {
    beforeEach(async () => {
        await storage.clearSession();
    });

    it('exports SCHEMA_VERSION === 1', () => {
        expect(SCHEMA_VERSION).toBe(1);
    });

    it('getSchemaVersion() returns 0 on a pre-versioning DB (key absent)', async () => {
        // clearSession wiped the metadata store, so there is no schemaVersion key.
        expect(await storage.getSchemaVersion()).toBe(0);
    });

    it('loadSession() stamps schemaVersion on a fresh DB', async () => {
        await storage.loadSession();
        expect(await storage.getSchemaVersion()).toBe(1);
    });

    it('saveSnapshot() stamps schemaVersion on a fresh DB', async () => {
        await storage.saveSnapshot({ tabs: [], metadata: {} });
        expect(await storage.getSchemaVersion()).toBe(1);
    });

    it('schemaVersion persists across a fresh DB handle (written to disk, not memoised)', async () => {
        await storage.loadSession();
        await storage.initDB(); // new idb connection to the same database
        expect(await storage.getSchemaVersion()).toBe(1);
    });

    it('stays at 1 across repeated loadSession calls (no migration, no rewrite churn)', async () => {
        await storage.loadSession();
        await storage.loadSession();
        await storage.loadSession();
        expect(await storage.getSchemaVersion()).toBe(1);
    });
});

describe('Storage.saveSnapshot (P2-atomic — one transaction)', () => {
    beforeEach(async () => {
        await storage.clearSession();
    });

    const t = (id, content) => ({ id, title: id, content, isDirty: false });

    it('writes every tab and every metadata key; loadSession reads them all back', async () => {
        await storage.saveSnapshot({
            tabs: [t('s1', 'first body'), t('s2', 'second body')],
            metadata: { activeTabId: 's2', tabOrder: ['s2', 's1'] },
        });

        const session = await storage.loadSession();
        const byId = Object.fromEntries(session.tabs.map(x => [x.id, x]));
        expect(Object.keys(byId).sort()).toEqual(['s1', 's2']);
        expect(byId.s1.content).toBe('first body');
        expect(byId.s2.content).toBe('second body');
        expect(session.activeTabId).toBe('s2');
        expect(session.tabOrder).toEqual(['s2', 's1']);
    });

    it('round-trips arbitrary metadata keys (recentFiles, settings) as JSON', async () => {
        const recentFiles = [{ filePath: '/a.md', fileName: 'a.md', fileHandle: null }];
        const settings = { theme: 'dark', sessionWarnTabs: 12 };
        await storage.saveSnapshot({ tabs: [], metadata: { recentFiles, settings } });

        const session = await storage.loadSession();
        expect(session.recentFiles).toEqual(recentFiles);
        expect(session.settings).toEqual(settings);
    });

    it('encrypts tab content at rest (NFv1 sentinel, no plaintext on disk)', async () => {
        await storage.saveSnapshot({ tabs: [t('enc', 'secret plaintext')], metadata: {} });

        const db = await storage.initDB();
        const raw = await db.get('tabs', 'enc');
        expect(raw.content.startsWith('NFv1:')).toBe(true);
        expect(raw.content).not.toContain('secret plaintext');
    });

    it('stamps schemaVersion in the same call', async () => {
        await storage.saveSnapshot({ tabs: [t('x', 'y')], metadata: {} });
        expect(await storage.getSchemaVersion()).toBe(1);
    });

    it('overwrites an existing tab row', async () => {
        await storage.saveTab(t('o', 'v1'));
        await storage.saveSnapshot({ tabs: [t('o', 'v2')], metadata: {} });

        const session = await storage.loadSession();
        expect(session.tabs.find(x => x.id === 'o').content).toBe('v2');
    });

    it('skips a _decryptFailed placeholder tab (empty content) — its prior row survives, metadata still lands', async () => {
        await storage.saveTab(t('keep', 'original content'));

        await storage.saveSnapshot({
            tabs: [{ id: 'keep', title: 'keep', content: '', _decryptFailed: true }],
            metadata: { activeTabId: 'keep' },
        });

        const session = await storage.loadSession();
        const kept = session.tabs.find(x => x.id === 'keep');
        expect(kept.content).toBe('original content');
        expect(session.activeTabId).toBe('keep');
    });

    it('DOES write a _decryptFailed tab once it has real content (user typed into the placeholder)', async () => {
        await storage.saveSnapshot({
            tabs: [{ id: 'revived', title: 'revived', content: 'typed after failure', _decryptFailed: true }],
            metadata: {},
        });

        const session = await storage.loadSession();
        const revived = session.tabs.find(x => x.id === 'revived');
        expect(revived).toBeDefined();
        expect(revived.content).toBe('typed after failure');
    });

    it('handles an empty snapshot without throwing and still stamps the version', async () => {
        await storage.saveSnapshot({ tabs: [], metadata: {} });

        const session = await storage.loadSession();
        expect(session.tabs).toHaveLength(0);
        expect(await storage.getSchemaVersion()).toBe(1);
    });

    it('tabs-only snapshot writes the tabs and still stamps the version', async () => {
        await storage.saveSnapshot({ tabs: [t('a', 'aa')], metadata: {} });

        const session = await storage.loadSession();
        expect(session.tabs.map(x => x.id)).toEqual(['a']);
        expect(await storage.getSchemaVersion()).toBe(1);
    });
});
