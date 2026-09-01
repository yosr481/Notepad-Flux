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

    it('returns "" (never the ciphertext) when input is undecryptable', async () => {
        // Not valid base64 -> atob throws inside decrypt's try/catch.
        expect(await decrypt('not-base64!!!')).toBe('');
        // Valid base64 but not real AES-GCM output -> subtle.decrypt rejects.
        expect(await decrypt(btoa('garbage payload that is not ciphertext'))).toBe('');
    });
});
