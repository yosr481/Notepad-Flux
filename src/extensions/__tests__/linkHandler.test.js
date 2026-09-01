import { describe, it, expect } from 'vitest';
import { isSafeExternalUrl, linkHandler } from '../linkHandler';

describe('linkHandler', () => {
    it('should be exported', () => {
        expect(linkHandler).toBeDefined();
    });

    describe('isSafeExternalUrl scheme allowlist', () => {
        it('allows http/https/mailto', () => {
            expect(isSafeExternalUrl('https://example.com')).toBe(true);
            expect(isSafeExternalUrl('http://example.com')).toBe(true);
            expect(isSafeExternalUrl('mailto:a@b.com')).toBe(true);
        });

        it('blocks file:, smb: and javascript:', () => {
            expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
            expect(isSafeExternalUrl('smb://attacker/share')).toBe(false);
            expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
        });

        it('blocks unparseable input', () => {
            expect(isSafeExternalUrl('not a url')).toBe(false);
            expect(isSafeExternalUrl('')).toBe(false);
        });
    });
});
