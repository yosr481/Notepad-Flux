import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { livePreview } from '../extensions/livePreview';

const Editor = () => {
    const editorRef = useRef(null);
    const viewRef = useRef(null);

    useEffect(() => {
        if (!editorRef.current) return;

        const startState = EditorState.create({
            doc: "# Welcome to Obsidian-like Editor\n\nTry typing **bold** or *italic* text.\n\n- [ ] Checkbox item\n- List item\n\n[Link](https://example.com)\n",
            extensions: [
                keymap.of([...defaultKeymap, ...historyKeymap]),
                history(),
                EditorView.lineWrapping,
                markdown({ base: markdownLanguage, codeLanguages: languages }),
                livePreview, // Our custom extension
                EditorView.theme({
                    "&": { height: "100%" },
                    ".cm-content": { fontFamily: "var(--font-text)" }
                })
            ]
        });

        const view = new EditorView({
            state: startState,
            parent: editorRef.current
        });

        viewRef.current = view;

        return () => {
            view.destroy();
        };
    }, []);

    return <div ref={editorRef} className="cm-editor-container" style={{ height: '100%' }} />;
};

export default Editor;
