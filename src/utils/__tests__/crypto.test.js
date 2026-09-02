import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../crypto';

describe('crypto', () => {
    it('round-trips text', async () => {
        const plain = 'hello # markdown\n\n- list';
        const out = await decrypt(await encrypt(plain));
        expect(out).toBe(plain);
    });

    it('passes empty/falsy through untouched', async () => {
        expect(await encrypt('')).toBe('');
        expect(await decrypt('')).toBe('');
    });

    it('returns non-NFv1 undecryptable input unchanged (plaintext passthrough, no data loss)', async () => {
        // New hardening contract (crypto.hardening.test.js contract 4): a non-NFv1:
        // string that cannot be decrypted is treated as legacy plaintext and returned
        // as-is, rather than silently collapsed to '' (the old data-loss behavior).
        // Not valid base64 -> atob throws inside decrypt's try/catch.
        expect(await decrypt('not-base64!!!')).toBe('not-base64!!!');
        // Valid base64 but not real AES-GCM output -> subtle.decrypt rejects -> passthrough.
        const garbage = btoa('garbage payload that is not ciphertext');
        expect(await decrypt(garbage)).toBe(garbage);
    });
});
