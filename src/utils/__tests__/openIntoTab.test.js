import { describe, it, expect, vi } from 'vitest';
import { openIntoTab } from '../openIntoTab';

// final-architect follow-up: openIntoTab is the shared createTab literal for
// openFile / openRecentFile / openDroppedFiles — pins its contract so any of
// the three call sites can be refactored without silently dropping a field.
describe('openIntoTab', () => {
    it('creates a tab from the file and records it in Recent Files', () => {
        const createTab = vi.fn();
        const addRecentFile = vi.fn();
        const file = { name: 'note.md', content: 'body', handle: '/abs/note.md' };

        openIntoTab(file, { createTab, addRecentFile });

        expect(createTab).toHaveBeenCalledWith({
            title: 'note.md',
            content: 'body',
            filePath: 'note.md',
            fileHandle: '/abs/note.md',
            isDirty: false,
        });
        expect(addRecentFile).toHaveBeenCalledWith('note.md', 'note.md', '/abs/note.md');
    });

    it('tolerates a missing addRecentFile (optional chaining)', () => {
        const createTab = vi.fn();
        const file = { name: 'note.md', content: 'body', handle: null };

        expect(() => openIntoTab(file, { createTab })).not.toThrow();
        expect(createTab).toHaveBeenCalledTimes(1);
    });
});
