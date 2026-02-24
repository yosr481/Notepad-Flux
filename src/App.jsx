import React, { useState, useEffect } from 'react';
import Editor from './components/Editor';
import MenuBar from './components/Layout/MenuBar';
import Tabs from './components/Layout/Tabs';
import StatusBar from './components/Layout/StatusBar';
import ContextMenu from './components/Layout/ContextMenu';
import FindReplacePanel from './components/Layout/FindReplacePanel';
import GoToLineDialog from './components/Layout/GoToLineDialog';
import Toast from './components/Layout/Toast';
import styles from './App.module.css';
import { useCommands } from './hooks/useCommands';
import { useSession } from './context/SessionContext';

import Settings from './components/Settings/Settings';

function App() {
    const editorRef = React.useRef(null);
    const closingRef = React.useRef(false);
    const [showSettings, setShowSettings] = useState(false);
    const [toast, setToast] = useState({ message: '', show: false });
    const [appVersion, setAppVersion] = useState(null);

    useEffect(() => {
        window.electronAPI?.getAppVersion?.().then(setAppVersion).catch(() => { });
    }, []);
    const [stats, setStats] = useState({
        line: 1,
        col: 1,
        wordCount: 0,
        charCount: 0
    });

    const { settings, updateSettings } = useSession();

    const [systemTheme, setSystemTheme] = useState(
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    );

    useEffect(() => {
        if (!window.matchMedia) return;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => setSystemTheme(e.matches ? 'dark' : 'light');
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    const showToast = (message) => {
        setToast({ message, show: true });
        setTimeout(() => {
            setToast({ message: '', show: false });
        }, 3000);
    };

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
        recentFiles,
        closeWindow,
        isPrimaryWindow
    } = useCommands(showToast);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (!isPrimaryWindow) {
                if (closingRef.current) return;

                const hasDirtyTabs = tabs.some(t => t.isDirty);
                if (hasDirtyTabs) {
                    e.preventDefault();
                    setTimeout(async () => {
                        closingRef.current = true;
                        try {
                            await closeWindow();
                        } finally {
                            closingRef.current = false;
                        }
                    }, 0);
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isPrimaryWindow, tabs, closeWindow]);

    const [contextMenu, setContextMenu] = useState(null);
    const [showFindReplace, setShowFindReplace] = useState(false);
    const [findReplaceMode, setFindReplaceMode] = useState('find');
    const [showGoToLine, setShowGoToLine] = useState(false);
    const [totalLines, setTotalLines] = useState(0);

    useEffect(() => {
        if (showGoToLine) {
            setTotalLines(editorRef.current?.getTotalLines() || 0);
        }
    }, [showGoToLine]);

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
    }, [newTab, openFile, saveFile, saveFileAs, closeTab, activeTabId, switchTab, print]);

    // Apply theme to body
    useEffect(() => {
        const effectiveTheme = settings.theme === 'system' ? systemTheme : settings.theme;
        document.body.setAttribute('data-theme', effectiveTheme);
    }, [settings.theme, systemTheme]);

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

    // Safety check if activeTab is undefined (e.g. during close race condition)
    if (!activeTab) return null;

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
        <div className={styles.appContainer} data-theme={settings.theme} onClick={() => setContextMenu(null)}>
            <div className={styles.topBar}>
                <Tabs
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onTabClick={setActiveTabId}
                    onTabClose={closeTab}
                    onNewTab={newTab}
                    onContextMenu={handleContextMenu}
                    onReorder={reorderTabs}
                    appVersion={appVersion}
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
                    onCloseWindow={() => closeWindow(editorRef)}
                    onExit={() => closeWindow(editorRef)}
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
                    totalLines={totalLines}
                    onGoToLine={(line) => editorRef.current?.goToLine(line)}
                    onClose={() => setShowGoToLine(false)}
                />
            )}

            <Settings
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                settings={settings}
                updateSettings={updateSettings}
                appVersion={appVersion}
            />

            {toast.show && (
                <Toast
                    message={toast.message}
                    duration={3000}
                    onClose={() => setToast({ message: '', show: false })}
                />
            )}
        </div>
    );
}

export default App;
