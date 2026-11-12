import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../storage';
import { encrypt } from '../../utils/crypto';
import 'fake-indexeddb/auto';

const rawRow = async (id) => (await storage.initDB()).get('tabs', id);
const tab = (o = {}) => ({ id: 't1', title: 'My secret first line', content: 'body text', filePath: '/home/u/secret plan.md', fileHandle: '/home/u/secret plan.md', isDirty: true, ...o });

describe('storage: title, filePath and fileHandle are encrypted at rest', () => {
    beforeEach(async () => { await storage.clearSession(); });

    it('saveTab writes NFv1 ciphertext for content, title, filePath and fileHandle; other fields stay clear', async () => {
        await storage.saveTab(tab());
        const row = await rawRow('t1');
        for (const f of ['content', 'title', 'filePath', 'fileHandle']) expect(row[f], f).toMatch(/^NFv1:/);
        expect(JSON.stringify(row)).not.toContain('secret');
        expect(row.isDirty).toBe(true);
        expect(row.id).toBe('t1');
    });

    it('saveSnapshot encrypts them too', async () => {
        await storage.saveSnapshot({ tabs: [tab({ id: 's1' })], metadata: { activeTabId: 's1' } });
        const row = await rawRow('s1');
        expect(JSON.stringify(row)).not.toContain('secret');
    });

    it('loadSession round-trips the original values', async () => {
        await storage.saveTab(tab());
        const [t] = (await storage.loadSession()).tabs;
        expect(t).toMatchObject({ title: 'My secret first line', content: 'body text', filePath: '/home/u/secret plan.md', fileHandle: '/home/u/secret plan.md' });
    });

    it('null / missing path fields are left alone (not encrypted into "null")', async () => {
        await storage.saveTab(tab({ id: 'n1', filePath: null, fileHandle: undefined }));
        const row = await rawRow('n1');
        expect(row.filePath).toBeNull();
        const [t] = (await storage.loadSession()).tabs;
        expect(t.filePath).toBeNull();
    });

    it('an empty-string title stays empty (encrypt passes "" through) and restores as ""', async () => {
        await storage.saveTab(tab({ id: 'e1', title: '' }));
        expect((await rawRow('e1')).title).toBe('');
        expect((await storage.loadSession()).tabs[0].title).toBe('');
    });

    it('legacy plaintext rows still load, and the next save rewrites them encrypted', async () => {
        const db = await storage.initDB();
        await db.put('tabs', { id: 'old', title: 'Plain title', content: await encrypt('old body'), filePath: '/p/old.md', fileHandle: '/p/old.md', isDirty: false });
        const [t] = (await storage.loadSession()).tabs;
        expect(t).toMatchObject({ title: 'Plain title', filePath: '/p/old.md', fileHandle: '/p/old.md', content: 'old body' });
        await storage.saveTab(t);
        const row = await rawRow('old');
        expect(row.title).toMatch(/^NFv1:/); expect(row.fileHandle).toMatch(/^NFv1:/);
    });

    it('a tab whose content cannot be decrypted loads as Untitled with no paths, flagged _decryptFailed', async () => {
        const db = await storage.initDB();
        const good = await encrypt('x'); const body = good.slice(5);
        const bad = 'NFv1:' + body.slice(0, 4) + (body[4] === 'A' ? 'B' : 'A') + body.slice(5);
        await db.put('tabs', { id: 'bad', title: await encrypt('Real title'), content: bad, filePath: await encrypt('/p/x.md'), fileHandle: await encrypt('/p/x.md'), isDirty: true });
        const [t] = (await storage.loadSession()).tabs;
        expect(t).toMatchObject({ id: 'bad', title: 'Untitled', filePath: null, fileHandle: null, content: '', _decryptFailed: true });
    });

    it('a decrypt-failed placeholder is not written back, so the original encrypted row survives', async () => {
        const db = await storage.initDB();
        const row = { id: 'keep', title: await encrypt('T'), content: 'NFv1:AAAAAAAAAAAAAAAAAAAAAAAA', filePath: null, fileHandle: null, isDirty: false };
        await db.put('tabs', row);
        const [t] = (await storage.loadSession()).tabs;
        expect(t._decryptFailed).toBe(true);
        await storage.saveTab(t);
        expect(await rawRow('keep')).toEqual(row);
    });

    it('a title that fails to decrypt on its own also degrades the tab to the neutral placeholder (documented behaviour)', async () => {
        const db = await storage.initDB();
        const badTitle = 'NFv1:' + 'A'.repeat(40);
        await db.put('tabs', { id: 'bt', title: badTitle, content: await encrypt('fine body'), isDirty: false });
        const [t] = (await storage.loadSession()).tabs;
        expect(t._decryptFailed).toBe(true); expect(t.title).toBe('Untitled'); expect(t.content).toBe('');
    });
});
