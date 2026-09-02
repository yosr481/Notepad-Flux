import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt } from '../crypto';

// Pinned contract for crypto.js hardening (P0 data-loss + security).
// This suite is the spec. See the per-block comments for the exact decisions.

const SENTINEL = 'NFv1:';

// Decode a base64 string the same way the module does, for byte-length asserts.
function b64ToBytes(b64) {
    return new Uint8Array(atob(b64).split('').map((c) => c.charCodeAt(0)));
}

// Flip one character early in the base64 body (inside the IV region) to a
// different, still-valid base64 char. Stays clear of the padding tail so atob()
// still succeeds and the failure is AES-GCM auth — the path contract 3 pins.
function tamperBase64Body(b64) {
    const i = 4; // well inside the 16-char span that encodes the 12-byte IV
    const c = b64[i];
    const repl = c === 'A' ? 'B' : 'A';
    return b64.slice(0, i) + repl + b64.slice(i + 1);
}

beforeEach(() => {
    // Deterministic key per test: force key generation via localStorage fallback
    // (window.electronAPI is undefined in jsdom).
    localStorage.clear();
});

describe('crypto hardening — versioned ciphertext (contract 1)', () => {
    it('encrypt() output starts with the literal NFv1: prefix', async () => {
        const out = await encrypt('hello');
        expect(typeof out).toBe('string');
        expect(out.startsWith(SENTINEL)).toBe(true);
    });

    it('the body after NFv1: is base64 of at least 12 bytes (the IV)', async () => {
        const out = await encrypt('hello');
        const body = out.slice(SENTINEL.length);
        const bytes = b64ToBytes(body);
        // 12-byte IV followed by non-empty AES-GCM ciphertext (>=16-byte tag).
        expect(bytes.length).toBeGreaterThanOrEqual(12 + 16);
    });

    it("encrypt('') returns '' unchanged (no prefix)", async () => {
        expect(await encrypt('')).toBe('');
    });

    it('encrypt(null) returns null unchanged (no prefix)', async () => {
        expect(await encrypt(null)).toBe(null);
    });

    it('encrypt(undefined) returns undefined unchanged (no prefix)', async () => {
        expect(await encrypt(undefined)).toBe(undefined);
    });
});

describe('crypto hardening — round-trip (contract 2)', () => {
    it('round-trips short ASCII', async () => {
        const x = 'the quick brown fox';
        expect(await decrypt(await encrypt(x))).toBe(x);
    });

    it('round-trips empty-ish (returns input, never a prefixed blob)', async () => {
        expect(await decrypt(await encrypt(''))).toBe('');
    });

    it('round-trips unicode', async () => {
        const x = 'café ☕ \u{1F600}';
        expect(await decrypt(await encrypt(x))).toBe(x);
    });

    it('round-trips a LARGE string (>=200000 chars) without throwing — P0-2 RangeError guard', async () => {
        const x = 'a'.repeat(200_000);
        const enc = await encrypt(x); // must not throw (no String.fromCharCode(...hugeArray))
        expect(enc.startsWith(SENTINEL)).toBe(true);
        expect(await decrypt(enc)).toBe(x);
    });
});

describe('crypto hardening — tamper / wrong-key must THROW (contract 3, P0-1)', () => {
    it('a NFv1:-prefixed blob whose body fails AES-GCM auth rejects', async () => {
        const good = await encrypt('secret content');
        const bad = SENTINEL + tamperBase64Body(good.slice(SENTINEL.length));
        expect(bad.startsWith(SENTINEL)).toBe(true);
        expect(bad).not.toBe(good);
        await expect(decrypt(bad)).rejects.toThrow();
    });

    it('does NOT silently return "" for a tampered NFv1: blob', async () => {
        const good = await encrypt('secret content');
        const bad = SENTINEL + tamperBase64Body(good.slice(SENTINEL.length));
        await expect(decrypt(bad)).rejects.toBeDefined();
        // and specifically not the silent-data-loss sentinel:
        let returned;
        try {
            returned = await decrypt(bad);
        } catch {
            returned = Symbol('threw');
        }
        expect(returned).not.toBe('');
    });

    it('does NOT return the ciphertext string back for a tampered NFv1: blob', async () => {
        const good = await encrypt('secret content');
        const bad = SENTINEL + tamperBase64Body(good.slice(SENTINEL.length));
        let returned;
        try {
            returned = await decrypt(bad);
        } catch {
            returned = Symbol('threw');
        }
        expect(returned).not.toBe(bad);
    });
});

describe('crypto hardening — legacy plaintext passthrough (contract 4)', () => {
    it('returns non-prefixed, non-ciphertext plain text unchanged', async () => {
        const x = 'just some plain text that was never encrypted';
        expect(await decrypt(x)).toBe(x);
    });

    it('does not throw and does not return "" for legacy plaintext', async () => {
        const x = 'just some plain text that was never encrypted';
        const out = await decrypt(x);
        expect(out).not.toBe('');
        expect(out).toBe(x);
    });
});

describe('crypto hardening — legacy encrypted-without-sentinel (contract 5)', () => {
    it('decrypts an old-style blob (IV‖ciphertext base64, no NFv1: prefix)', async () => {
        const x = 'content from a pre-sentinel install';
        const prefixed = await encrypt(x);
        expect(prefixed.startsWith(SENTINEL)).toBe(true);
        const legacy = prefixed.slice(SENTINEL.length); // strip prefix -> old format
        expect(await decrypt(legacy)).toBe(x);
    });
});

describe('crypto hardening — key stability across calls (contract 6)', () => {
    it('two sequential encrypt() calls use the same key; both decrypt', async () => {
        const a = 'first message';
        const b = 'second message';
        const encA = await encrypt(a);
        const encB = await encrypt(b);
        expect(await decrypt(encA)).toBe(a);
        expect(await decrypt(encB)).toBe(b);
    });
});
