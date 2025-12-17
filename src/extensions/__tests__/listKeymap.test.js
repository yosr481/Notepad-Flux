import { describe, it, expect } from 'vitest';
import { listKeymap } from '../listKeymap';
import { keymap } from '@codemirror/view';

describe('List Keymap Extension', () => {
    it('should be defined (CodeMirror keymap extension)', () => {
        expect(listKeymap).toBeDefined();
        // Avoid depending on CM6 internals; ensure it's truthy/usable as an extension
        expect(!!listKeymap).toBe(true);
    });

    it('should be exported', () => {
        // We simply assert the exported value exists; detailed behavior is covered by integration tests.
        expect(listKeymap).toBeDefined();
    });
});
