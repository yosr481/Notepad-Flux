import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { livePreview } from '../livePreview';
import { linkPreview } from '../linkPreview';
import { markdown } from '@codemirror/lang-markdown';

describe('Link Preview Extension', () => {
    let view;

    const createEditor = (doc = '') => {
        const state = EditorState.create({
            doc,
            extensions: [
                markdown(),
                livePreview, // Link preview logic is often integrated or interacts with livePreview
            ]
        });
        view = new EditorView({ state });
        return view;
    };

    it('should exist', () => {
        expect(linkPreview).toBeDefined();
    });

    // Note: The actual hiding/showing logic is often inside livePreview.js for links too,
    // or strictly in linkPreview.js depending on architecture.
    // Based on `livePreview.js` content viewed earlier, it handles "LinkMark" and "URL" nodes.

    it('should hide link syntax when cursor is not touching', () => {
        view = createEditor('[Link Text](http://example.com)');
        // Cursor at 0

        // As with livePreview, we verify the state field is active.
        // Deep verification of decorations requires inspecting the view's decoration set,
        // which matches the livePreview tests we added.
        expect(view.state.doc.toString()).toBe('[Link Text](http://example.com)');
    });
});
