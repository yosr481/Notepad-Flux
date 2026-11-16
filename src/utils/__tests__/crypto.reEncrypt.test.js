import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The keyring may ask (shouldReEncrypt) for the secure key copy to be rewritten. The old copy
// may only ever be replaced by a new blob that reads back to the same key, and only if no other
// window changed it meanwhile. Whatever happens, the key is still returned and data stays readable.

const PLAIN = 'notepad-flux-key';
const SECURE = 'notepad-flux-secure-key';
const OLD = 'OLD-BLOB';
const NEW = 'NEW-BLOB';

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s) => new Uint8Array(atob(s).split('').map((c) => c.charCodeAt(0)));
const newKeyB64 = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const importRaw = (k) => crypto.subtle.importKey('raw', fromB64(k), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

async function openWith(keyB64, blob) {
    const all = fromB64(blob.slice(5));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, await importRaw(keyB64), all.slice(12));
    return new TextDecoder().decode(pt);
}

// Keyring fake: OLD decrypts to key, NEW decrypts to `newReads` (key unless a test breaks read-back).
function install(key, { needs = true, newReads = key, decrypt, ...rest } = {}) {
    const ss = {
        isAvailable: vi.fn(async () => true),
        encrypt: vi.fn(async () => NEW),
        decrypt: decrypt || vi.fn(async (b) => (b === OLD ? key : newReads)),
        backend: vi.fn(async () => 'basic_text'), // keeps PLAIN out of the way
        needsReEncrypt: vi.fn(async () => needs),
        ...rest,
    };
    window.electronAPI = { safeStorage: ss };
    return ss;
}

// Starts with PLAIN absent so only the secure copy matters.
async function launch(key, opts) {
    localStorage.setItem(SECURE, OLD);
    const ss = install(key, opts);
    vi.resetModules();
    const mod = await import('../crypto');
    return { ss, mod };
}

// Proves the module got `key` from the keyring path.
const expectKey = async (mod, key) => expect(await openWith(key, await mod.encrypt('x'))).toBe('x');

let warnSpy;
beforeEach(() => { localStorage.clear(); delete window.electronAPI; warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { delete window.electronAPI; warnSpy.mockRestore(); });

describe('re-encrypting the secure key copy', () => {
    it('flag false -> nothing written, encrypt never called', async () => {
        const k = newKeyB64();
        const { ss, mod } = await launch(k, { needs: false });
        await expectKey(mod, k);
        expect(ss.needsReEncrypt).toHaveBeenCalledWith(OLD);
        expect(ss.encrypt).not.toHaveBeenCalled();
        expect(localStorage.getItem(SECURE)).toBe(OLD);
    });

    it('flag true + good read-back -> new blob stored, key returned', async () => {
        const k = newKeyB64();
        const { mod } = await launch(k);
        await expectKey(mod, k);
        expect(localStorage.getItem(SECURE)).toBe(NEW);
    });

    it('flag true + read-back differs -> old blob kept', async () => {
        const k = newKeyB64();
        const { mod } = await launch(k, { newReads: newKeyB64() });
        await expectKey(mod, k);
        expect(localStorage.getItem(SECURE)).toBe(OLD);
    });

    it('flag true + read-back throws -> old blob kept, key returned', async () => {
        const k = newKeyB64();
        const decrypt = vi.fn(async (b) => { if (b === OLD) return k; throw new Error('cannot read back'); });
        const { mod } = await launch(k, { decrypt });
        await expectKey(mod, k);
        expect(localStorage.getItem(SECURE)).toBe(OLD);
    });

    it('another window replaced the blob during the check -> its blob is not overwritten', async () => {
        const k = newKeyB64();
        const other = 'OTHER-WINDOW-BLOB';
        const { mod } = await launch(k, {
            encrypt: vi.fn(async () => { localStorage.setItem(SECURE, other); return NEW; }),
        });
        await expectKey(mod, k);
        expect(localStorage.getItem(SECURE)).toBe(other);
    });

    it('needsReEncrypt missing (old preload / web) -> no-op, key returned', async () => {
        const k = newKeyB64();
        const { ss, mod } = await launch(k, { needsReEncrypt: undefined });
        await expectKey(mod, k);
        expect(ss.encrypt).not.toHaveBeenCalled();
        expect(localStorage.getItem(SECURE)).toBe(OLD);
    });

    it('needsReEncrypt throws -> old blob kept, key still returned', async () => {
        const k = newKeyB64();
        const { ss, mod } = await launch(k, { needsReEncrypt: vi.fn(async () => { throw new Error('ipc gone'); }) });
        await expectKey(mod, k);
        expect(ss.encrypt).not.toHaveBeenCalled();
        expect(localStorage.getItem(SECURE)).toBe(OLD);
    });

    it('encrypt throws -> old blob kept, key still returned', async () => {
        const k = newKeyB64();
        const { mod } = await launch(k, { encrypt: vi.fn(async () => { throw new Error('keyring busy'); }) });
        await expectKey(mod, k);
        expect(localStorage.getItem(SECURE)).toBe(OLD);
    });

    it('localStorage.setItem throws (quota) -> old blob kept, key still returned', async () => {
        const k = newKeyB64();
        const { mod } = await launch(k);
        const real = Storage.prototype.setItem;
        // arm after launch's own seeding: the first import happens lazily on encrypt()
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (n, v) {
            if (n === SECURE) throw new DOMException('full', 'QuotaExceededError');
            return real.call(this, n, v);
        });
        try { await expectKey(mod, k); } finally { spy.mockRestore(); }
        expect(localStorage.getItem(SECURE)).toBe(OLD);
    });

    it('PLAIN-only profile (no secure copy) never asks about re-encryption', async () => {
        const k = newKeyB64();
        localStorage.setItem(PLAIN, k);
        const ss = install(k);
        vi.resetModules();
        const mod = await import('../crypto');
        await expectKey(mod, k);
        expect(ss.needsReEncrypt).not.toHaveBeenCalled();
    });
});
