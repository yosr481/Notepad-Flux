import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { livePreview } from '../extensions/livePreview';
import { imagePreview } from '../extensions/imagePreview';
import { linkPreview } from '../extensions/linkPreview';
import { linkHandler } from '../extensions/linkHandler';
import { listKeymap } from '../extensions/listKeymap';
import { obsidianTheme } from '../theme';
import styles from './Editor.module.css';

const Editor = ({ onStatsUpdate }) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const statsCache = useRef({ charCount: 0, wordCount: 0, docVersion: 0 });

  useEffect(() => {
    if (!editorRef.current) return;

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

    const getInitialDoc = async () => {
      if (import.meta.env.DEV) {
        const { mockMarkdown } = await import('../mockData.js');
        return mockMarkdown;
      }
      return '';
    };

    getInitialDoc().then((doc) => {
      const startState = EditorState.create({
        doc,
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
            }
          })
        ]
      });

      const view = new EditorView({
        state: startState,
        parent: editorRef.current
      });

      viewRef.current = view;

      updateStats(view);
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, []);

  return <div ref={editorRef} className={styles.editorContainer} style={{ height: '100%' }} />;
};

export default Editor;
