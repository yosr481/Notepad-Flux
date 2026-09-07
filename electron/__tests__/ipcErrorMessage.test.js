import { describe, it, expect } from 'vitest';
import { toUserMessage } from '../ipcErrorMessage.js';

const GENERIC = 'An internal system error occurred. Please try again.';

describe('toUserMessage — message-based branches (checked before code)', () => {
    it('message exactly "Not a text file." → "Not a text file."', () => {
        expect(toUserMessage(new Error('Not a text file.'))).toBe('Not a text file.');
    });

    it('message containing "Unauthorized file path" → "That file path is not authorized."', () => {
        expect(toUserMessage(new Error('Access denied: Unauthorized file path.')))
            .toBe('That file path is not authorized.');
    });

    it('"Unauthorized file path" match is case-insensitive', () => {
        expect(toUserMessage(new Error('unauthorized file path')))
            .toBe('That file path is not authorized.');
        expect(toUserMessage(new Error('UNAUTHORIZED FILE PATH')))
            .toBe('That file path is not authorized.');
    });

    it('message containing "Safe storage is not available" → "Secure storage is unavailable on this system."', () => {
        expect(toUserMessage(new Error('Safe storage is not available on this platform')))
            .toBe('Secure storage is unavailable on this system.');
    });
});

describe('toUserMessage — code-based branches', () => {
    it('code EACCES → "Permission denied."', () => {
        expect(toUserMessage({ message: 'boom', code: 'EACCES' })).toBe('Permission denied.');
    });

    it('code ENOENT → "File not found."', () => {
        expect(toUserMessage({ message: 'boom', code: 'ENOENT' })).toBe('File not found.');
    });

    it('code EISDIR → "That is a folder, not a file."', () => {
        expect(toUserMessage({ message: 'boom', code: 'EISDIR' })).toBe('That is a folder, not a file.');
    });

    it('unrecognized code → generic fallback', () => {
        expect(toUserMessage({ message: 'boom', code: 'EPERM' })).toBe(GENERIC);
    });

    it('error with a message but no code and nothing recognized → generic fallback', () => {
        expect(toUserMessage(new Error('some unexpected failure'))).toBe(GENERIC);
    });
});

describe('toUserMessage — ordering: message wins over code', () => {
    it('message contains "Unauthorized file path" AND code is EACCES → message-based string', () => {
        const err = Object.assign(new Error('Unauthorized file path'), { code: 'EACCES' });
        expect(toUserMessage(err)).toBe('That file path is not authorized.');
    });

    it('message exactly "Not a text file." AND code is ENOENT → "Not a text file."', () => {
        const err = Object.assign(new Error('Not a text file.'), { code: 'ENOENT' });
        expect(toUserMessage(err)).toBe('Not a text file.');
    });

    it('"Not a text file." is an exact-equality check, not a substring — a message merely containing it falls through to the code', () => {
        expect(toUserMessage({ message: 'Error: Not a text file.', code: 'EACCES' }))
            .toBe('Permission denied.');
        expect(toUserMessage({ message: 'Error: Not a text file.' })).toBe(GENERIC);
    });
});

describe('toUserMessage — non-object / empty input → generic fallback', () => {
    it('null', () => {
        expect(toUserMessage(null)).toBe(GENERIC);
    });
    it('undefined', () => {
        expect(toUserMessage(undefined)).toBe(GENERIC);
    });
    it('a string', () => {
        expect(toUserMessage('EACCES')).toBe(GENERIC);
    });
    it('a number', () => {
        expect(toUserMessage(42)).toBe(GENERIC);
    });
    it('an empty object (no message, no code)', () => {
        expect(toUserMessage({})).toBe(GENERIC);
    });
});
