import React, { useState, useEffect } from 'react';
import Editor from './components/Editor';
import MenuBar from './components/Layout/MenuBar';
import Tabs from './components/Layout/Tabs';
import StatusBar from './components/Layout/StatusBar';
import ContextMenu from './components/Layout/ContextMenu';
import FindReplacePanel from './components/Layout/FindReplacePanel';
import GoToLineDialog from './components/Layout/GoToLineDialog';
import styles from './App.module.css';
import { useCommands } from './hooks/useCommands';

import Settings from './components/Settings/Settings';

function App() {
    const [theme, setTheme] = useState('dark');
    const [showSettings, setShowSettings] = useState(false);
    const [stats, setStats] = useState({
        line: 1,
        col: 1,
        wordCount: 0,
        charCount: 0
    });

    const {
        tabs,
        activeTabId,
        setActiveTabId,
        newTab,
        openFile,
        openRecentFile,
        saveFile,
        saveFileAs,
        exportToPDF,
        exportToHTML,
        print,
        closeTab,
        closeOtherTabs,
        closeTabsToRight,
        switchTab,
        updateTab,
        reorderTabs,
        recentFiles
    } = useCommands();

    const [contextMenu, setContextMenu] = useState(null);
    const [showFindReplace, setShowFindReplace] = useState(false);
    const [findReplaceMode, setFindReplaceMode] = useState('find');
    const [showGoToLine, setShowGoToLine] = useState(false);

    const handleContextMenu = (e, id) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            options: [
                {
                    label: 'Close Other Tabs',
                    onClick: () => closeOtherTabs(id)
                },
                {
                    label: 'Close Tabs to the Right',
                    onClick: () => closeTabsToRight(id)
                }
            ]
        });
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                newTab();
            } else if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                openFile();
            } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveFileAs(editorRef);
            } else if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveFile(editorRef);
            } else if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                closeTab(activeTabId);
            } else if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                switchTab(e.shiftKey ? 'prev' : 'next');
            } else if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                setFindReplaceMode('find');
                setShowFindReplace(true);
            } else if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                setFindReplaceMode('replace');
                setShowFindReplace(true);
            } else if (e.ctrlKey && e.key === 'g') {
                e.preventDefault();
                setShowGoToLine(true);
            } else if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                print();
            } else if (e.key === 'F5') {
                e.preventDefault();
                editorRef.current?.insertDateTime();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [newTab, openFile, saveFile, saveFileAs, closeTab, activeTabId, switchTab]);

    // Apply theme to body
    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
    }, [theme]);

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

    // Safety check if activeTab is undefined (e.g. during close race condition)
    if (!activeTab) return null;

    const editorRef = React.useRef(null);

    const handleUndo = () => editorRef.current?.undo();
    const handleRedo = () => editorRef.current?.redo();
    const handleSelectAll = () => editorRef.current?.selectAll();
    const handleCut = () => editorRef.current?.cut();
    const handleCopy = () => editorRef.current?.copy();
    const handlePaste = () => editorRef.current?.paste();
    const handleDelete = () => editorRef.current?.delete();

    const handleFind = () => {
        setFindReplaceMode('find');
        setShowFindReplace(true);
    };

    const handleReplace = () => {
        setFindReplaceMode('replace');
        setShowFindReplace(true);
    };

    const handleGoToLine = () => {
        setShowGoToLine(true);
    };

    const handleInsertDateTime = () => {
        editorRef.current?.insertDateTime();
    };

    return (
        <div className={styles.appContainer} data-theme={theme} onClick={() => setContextMenu(null)}>
            <div className={styles.topBar}>
                <Tabs
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onTabClick={setActiveTabId}
                    onTabClose={closeTab}
                    onNewTab={newTab}
                    onContextMenu={handleContextMenu}
                    onReorder={reorderTabs}
                />
                <MenuBar
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onCut={handleCut}
                    onCopy={handleCopy}
                    onPaste={handlePaste}
                    onDelete={handleDelete}
                    onSelectAll={handleSelectAll}
                    onFind={handleFind}
                    onReplace={handleReplace}
                    onGoToLine={handleGoToLine}
                    onInsertDateTime={handleInsertDateTime}
                    onNewTab={newTab}
                    onNewWindow={() => window.open(window.location.href, '_blank')}
                    onOpen={openFile}
                    onOpenRecent={openRecentFile}
                    onSave={() => saveFile(editorRef)}
                    onSaveAs={() => saveFileAs(editorRef)}
                    onExportToPDF={exportToPDF}
                    onExportToHTML={exportToHTML}
                    onPrint={print}
                    onCloseTab={() => closeTab(activeTabId)}
                    onCloseWindow={() => window.close()}
                    onExit={() => window.close()}
                    onOpenSettings={() => setShowSettings(true)}
                    recentFiles={recentFiles}
                />
            </div>

            <div className={styles.editorWrapper}>
                <Editor
                    ref={editorRef}
                    activeTabId={activeTabId}
                    initialContent={activeTab.content}
                    initialCursor={activeTab.cursor || 0}
                    initialScroll={activeTab.scroll || 0}
                    onContentChange={(content, isDirty) => updateTab(activeTabId, { content, isDirty })}
                    onStateChange={(state) => updateTab(activeTabId, state)}
                    onStatsUpdate={setStats}
                />
            </div>

            <StatusBar stats={stats} />

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    options={contextMenu.options}
                    onClose={() => setContextMenu(null)}
                />
            )}

            {showFindReplace && (
                <FindReplacePanel
                    initialMode={findReplaceMode}
                    onClose={() => setShowFindReplace(false)}
                    onFind={(text, options) => editorRef.current?.find(text, options) || { current: 0, total: 0 }}
                    onReplace={(text) => editorRef.current?.replace(text)}
                    onReplaceAll={(searchText, replaceText, options) => editorRef.current?.replaceAll(searchText, replaceText, options) || 0}
                />
            )}

            {showGoToLine && (
                <GoToLineDialog
                    totalLines={editorRef.current?.getTotalLines() || 0}
                    onGoToLine={(line) => editorRef.current?.goToLine(line)}
                    onClose={() => setShowGoToLine(false)}
                />
            )}

            <Settings
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                theme={theme}
                setTheme={setTheme}
            />
        </div>
    );
}

export default App;
