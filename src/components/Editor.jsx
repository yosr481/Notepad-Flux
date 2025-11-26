import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo, redo, selectAll } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { livePreview } from '../extensions/livePreview';
import { imagePreview } from '../extensions/imagePreview';
import { linkPreview } from '../extensions/linkPreview';
import { linkHandler } from '../extensions/linkHandler';
import { listKeymap } from '../extensions/listKeymap';
import { obsidianTheme } from '../theme';
import styles from './Editor.module.css';

const Editor = forwardRef(({ activeTabId, onStatsUpdate, initialContent = '', onContentChange }, ref) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const stateCache = useRef(new Map()); // Map<string, EditorState>
  const currentTabIdRef = useRef(activeTabId);
  const statsCache = useRef({ charCount: 0, wordCount: 0, docVersion: 0 });

  useImperativeHandle(ref, () => ({
    undo: () => {
      if (viewRef.current) {
        undo(viewRef.current);
        viewRef.current.focus();
      }
    },
    redo: () => {
      if (viewRef.current) {
        redo(viewRef.current);
        viewRef.current.focus();
      }
    },
    selectAll: () => {
      if (viewRef.current) {
        selectAll(viewRef.current);
        viewRef.current.focus();
      }
    },
    getCurrentContent: () => {
      if (viewRef.current) {
        return viewRef.current.state.doc.toString();
      }
      return '';
    }
  }));

  // Helper to create the EditorState with all extensions
  const createEditorState = (docContent) => {
    return EditorState.create({
      doc: docContent,
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        livePreview,
        imagePreview,
        linkPreview,
        linkHandler,
        listKeymap,
        obsidianTheme,
        EditorView.theme({
          "&": {
            height: "100%",
            fontFamily: "var(--font-text)",
            fontSize: "16px",
            lineHeight: "var(--line-height)",
            backgroundColor: "var(--background-primary)",
            color: "var(--text-normal)"
          },
          ".cm-scroller": {
            overflow: "auto",
            padding: "0"
          },
          ".cm-content": {
            maxWidth: "var(--line-width)",
            margin: "0 auto",
            padding: "20px 0 30vh 0",
            caretColor: "var(--text-normal)"
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.selectionSet) {
            updateStats(update.view);
          } else if (update.docChanged) {
            updateStats(update.view);
            if (onContentChange) {
              onContentChange(update.state.doc.toString(), true);
            }
          }
        })
      ]
    });
  };

  const updateStats = (view) => {
    if (!onStatsUpdate) return;

    const state = view.state;
    const doc = state.doc;
    const selection = state.selection.main;
    const pos = selection.head;

    const lineObj = doc.lineAt(pos);
    const line = lineObj.number;
    const col = pos - lineObj.from + 1;

    let charCount, wordCount;

    if (statsCache.current.docVersion !== doc.length) {
      charCount = doc.length;

      let words = 0;
      for (let i = 1; i <= doc.lines; i++) {
        const lineText = doc.line(i).text;
        if (lineText.trim()) {
          words += lineText.trim().split(/\s+/).length;
        }
      }
      wordCount = words;

      statsCache.current = { charCount, wordCount, docVersion: doc.length };
    } else {
      charCount = statsCache.current.charCount;
      wordCount = statsCache.current.wordCount;
    }

    onStatsUpdate({ line, col, charCount, wordCount });
  };

  // Initialize Editor View (Once)
  useEffect(() => {
    if (!editorRef.current) return;

    const startState = createEditorState(initialContent);
    const view = new EditorView({
      state: startState,
      parent: editorRef.current
    });

    viewRef.current = view;
    updateStats(view);

    return () => {
      view.destroy();
    };
  }, []);

  // Handle Tab Switching and Content Updates
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // 1. Handle Tab Switch
    if (activeTabId !== currentTabIdRef.current) {
      // Save previous state
      const prevId = currentTabIdRef.current;
      const prevState = view.state;
      stateCache.current.set(prevId, prevState);

      // Restore or Create new state
      if (stateCache.current.has(activeTabId)) {
        view.setState(stateCache.current.get(activeTabId));
      } else {
        // Create new state with current initialContent
        // (Note: initialContent here is the content of the NEW tab because parent passed it)
        const newState = createEditorState(initialContent);
        view.setState(newState);
      }

      currentTabIdRef.current = activeTabId;

      // Force stats update for the new tab
      updateStats(view);
      return;
    }

    // 2. Handle External Content Update (e.g. File Open)
    // Only if activeTabId matches (which it should if we are here)
    // and content is different from view state.
    const currentDoc = view.state.doc.toString();
    if (initialContent !== currentDoc) {
      // This is an external change (e.g. loading a file).
      // We should replace the content.
      // NOTE: This might clear history if we just dispatch a change.
      // If we want to preserve history of "loading", we dispatch.
      // If we want to "reset" the file, we might want to setState.
      // Usually "Open File" implies a fresh state for that file.

      // For now, let's use dispatch to be safe with React cycles, 
      // but ideally we might want to reset state if it's a "load".
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: initialContent
        }
      });
    }

  }, [activeTabId, initialContent]);

  return <div ref={editorRef} className={styles.editorContainer} style={{ height: '100%' }} />;
});

export default Editor;
