import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo, redo, selectAll } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { SearchQuery, setSearchQuery, findNext, findPrevious, getSearchQuery, search } from '@codemirror/search';
import { livePreview } from '../extensions/livePreview';
import { imagePreview } from '../extensions/imagePreview';
import { linkPreview } from '../extensions/linkPreview';
import { linkHandler } from '../extensions/linkHandler';
import { listKeymap } from '../extensions/listKeymap';
import { indentUnit } from '@codemirror/language';
import { searchMatchHighlight } from '../extensions/searchHighlight';
import { obsidianTheme } from '../theme';
import styles from './Editor.module.css';

const Editor = forwardRef(({ activeTabId, onStatsUpdate, initialContent = '', initialCursor = 0, initialScroll = 0, onContentChange, onStateChange }, ref) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const stateCache = useRef(new Map()); // Map<string, EditorState>
  const scrollCache = useRef(new Map()); // Map<string, number>
  const currentTabIdRef = useRef(activeTabId);
  const statsCache = useRef({ charCount: 0, wordCount: 0, docVersion: 0 });
  const stateUpdateTimer = useRef(null);

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
    cut: () => {
      if (viewRef.current) {
        const state = viewRef.current.state;
        const selection = state.selection.main;
        if (!selection.empty) {
          const selectedText = state.sliceDoc(selection.from, selection.to);
          navigator.clipboard.writeText(selectedText);
          viewRef.current.dispatch({
            changes: { from: selection.from, to: selection.to }
          });
        }
        viewRef.current.focus();
      }
    },
    copy: () => {
      if (viewRef.current) {
        const state = viewRef.current.state;
        const selection = state.selection.main;
        if (!selection.empty) {
          const selectedText = state.sliceDoc(selection.from, selection.to);
          navigator.clipboard.writeText(selectedText);
        }
        viewRef.current.focus();
      }
    },
    paste: async () => {
      if (viewRef.current) {
        try {
          const text = await navigator.clipboard.readText();
          const state = viewRef.current.state;
          const selection = state.selection.main;
          viewRef.current.dispatch({
            changes: { from: selection.from, to: selection.to, insert: text }
          });
        } catch (err) {
          console.error('Failed to read clipboard:', err);
        }
        viewRef.current.focus();
      }
    },
    delete: () => {
      if (viewRef.current) {
        const state = viewRef.current.state;
        const selection = state.selection.main;
        if (!selection.empty) {
          viewRef.current.dispatch({
            changes: { from: selection.from, to: selection.to }
          });
        }
        viewRef.current.focus();
      }
    },
    getCurrentContent: () => {
      if (viewRef.current) {
        return viewRef.current.state.doc.toString();
      }
      return '';
    },
    find: (searchText, options = {}) => {
      if (!viewRef.current || !searchText) return { current: 0, total: 0 };

      const view = viewRef.current;
      const query = new SearchQuery({
        search: searchText,
        caseSensitive: options.caseSensitive || false,
        regexp: options.useRegex || false
      });

      view.dispatch({ effects: setSearchQuery.of(query) });

      if (options.direction === 'next') {
        findNext(view);
      } else if (options.direction === 'previous') {
        findPrevious(view);
      } else if (options.direction === 'current') {
        // Incremental search: start from the beginning of current selection
        // to avoid skipping the match being typed
        const { from } = view.state.selection.main;
        view.dispatch({ selection: { anchor: from, head: from } });
        findNext(view);
      }

      // Count matches
      const state = view.state;
      const cursor = query.getCursor(state.doc);
      let total = 0;
      let current = 0;
      let currentPos = state.selection.main.from;

      while (!cursor.next().done) {
        total++;
        if (cursor.value.from <= currentPos) {
          current = total;
        }
      }

      return { current, total };
    },
    replace: (replaceText) => {
      if (!viewRef.current) return;

      const view = viewRef.current;
      const state = view.state;
      const selection = state.selection.main;

      if (!selection.empty) {
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: replaceText }
        });
        findNext(view);
      }
    },
    replaceAll: (searchText, replaceText, options = {}) => {
      if (!viewRef.current || !searchText) return 0;

      const view = viewRef.current;
      const state = view.state;
      const query = new SearchQuery({
        search: searchText,
        caseSensitive: options.caseSensitive || false,
        regexp: options.useRegex || false
      });

      const cursor = query.getCursor(state.doc);
      const changes = [];
      let count = 0;

      while (!cursor.next().done) {
        changes.push({ from: cursor.value.from, to: cursor.value.to, insert: replaceText });
        count++;
      }

      if (changes.length > 0) {
        view.dispatch({ changes });
      }

      return count;
    },
    goToLine: (lineNumber) => {
      if (!viewRef.current) return;

      const view = viewRef.current;
      const state = view.state;
      const line = state.doc.line(Math.min(lineNumber, state.doc.lines));

      view.dispatch({
        selection: { anchor: line.from },
        scrollIntoView: true
      });

      view.focus();
    },
    getTotalLines: () => {
      if (viewRef.current) {
        return viewRef.current.state.doc.lines;
      }
      return 0;
    },
    insertDateTime: () => {
      if (!viewRef.current) return;

      const view = viewRef.current;
      const state = view.state;
      const selection = state.selection.main;

      const now = new Date();
      const dateTimeString = now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: dateTimeString }
      });

      view.focus();
    }
  }));

  // Helper to create the EditorState with all extensions
  const createEditorState = (docContent, cursorAnchor = 0) => {
    return EditorState.create({
      doc: docContent,
      selection: { anchor: Math.min(cursorAnchor, docContent.length) },
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        search(),
        searchMatchHighlight,
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        livePreview,
        imagePreview,
        linkPreview,
        linkHandler,
        listKeymap,
        indentUnit.of("\t"),
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
          }
          if (update.docChanged) {
            updateStats(update.view);
            if (onContentChange) {
              onContentChange(update.state.doc.toString(), true);
            }
          }

          // Debounced state update (cursor & scroll)
          if (onStateChange && (update.selectionSet || update.docChanged || update.viewportChanged)) {
            if (stateUpdateTimer.current) clearTimeout(stateUpdateTimer.current);
            stateUpdateTimer.current = setTimeout(() => {
              onStateChange({
                cursor: update.view.state.selection.main.head,
                scroll: update.view.scrollDOM.scrollTop
              });
            }, 500);
          }
        }),
        EditorView.domEventHandlers({
          scroll: (event, view) => {
            if (onStateChange) {
              if (stateUpdateTimer.current) clearTimeout(stateUpdateTimer.current);
              stateUpdateTimer.current = setTimeout(() => {
                onStateChange({
                  cursor: view.state.selection.main.head,
                  scroll: view.scrollDOM.scrollTop
                });
              }, 500);
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

    const startState = createEditorState(initialContent, initialCursor);
    const view = new EditorView({
      state: startState,
      parent: editorRef.current
    });

    viewRef.current = view;

    // Restore initial scroll
    if (initialScroll > 0) {
      requestAnimationFrame(() => {
        view.scrollDOM.scrollTop = initialScroll;
      });
    }

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
      scrollCache.current.set(prevId, view.scrollDOM.scrollTop);

      // Restore or Create new state
      if (stateCache.current.has(activeTabId)) {
        view.setState(stateCache.current.get(activeTabId));
        // Restore scroll from cache
        if (scrollCache.current.has(activeTabId)) {
          requestAnimationFrame(() => {
            view.scrollDOM.scrollTop = scrollCache.current.get(activeTabId);
          });
        }
      } else {
        // Create new state with current initialContent
        // (Note: initialContent here is the content of the NEW tab because parent passed it)
        const newState = createEditorState(initialContent, initialCursor);
        view.setState(newState);
        // Restore scroll from props
        if (initialScroll > 0) {
          requestAnimationFrame(() => {
            view.scrollDOM.scrollTop = initialScroll;
          });
        }
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

  }, [activeTabId, initialContent, initialCursor, initialScroll]);

  return <div ref={editorRef} className={styles.editorContainer} style={{ height: '100%' }} />;
});

export default Editor;
