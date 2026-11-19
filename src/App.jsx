import React, { useState, useEffect, useCallback } from 'react';
import { useUpdateStatus } from './hooks/useUpdateStatus';
import Editor from './components/Editor';
import MenuBar from './components/Layout/MenuBar';
import Tabs from './components/Layout/Tabs';
import StatusBar from './components/Layout/StatusBar';
import ContextMenu from './components/Layout/ContextMenu';
import FindReplacePanel from './components/Layout/FindReplacePanel';
import GoToLineDialog from './components/Layout/GoToLineDialog';
import Toast from './components/Layout/Toast';
import toastStyles from './components/Layout/Toast.module.css';
import styles from './App.module.css';
import { useCommands } from './hooks/useCommands';
import { useFileDrop } from './hooks/useFileDrop';
import { useLaunchFiles } from './hooks/useLaunchFiles';
import { useSettings, useTabState, useSessionActions } from './context/SessionContext';
import { version } from '../package.json';

import Settings from './components/Settings/Settings';

function App() {
    const editorRef = React.useRef(null);
    const [showSettings, setShowSettings] = useState(false);
    const [toast, setToast] = useState({ message: '', show: false });
    const [appVersion, setAppVersion] = useState(version);
    const updateStatus = useUpdateStatus();

    useEffect(() => {
        if (window.electronAPI?.getAppVersion) {
            window.electronAPI.getAppVersion().then(setAppVersion).catch(() => { });
        }
        // Windows draws overlay caption buttons over the top-right of the page;
        // mark the body so the tab bar can reserve room for them (that platform only).
        if (window.electronAPI?.platform === 'win32') {
            document.body.classList.add('platform-win32');
        }
    }, []);
    const [stats, setStats] = useState({
        line: 1,
        col: 1,
        wordCount: 0,
        charCount: 0
    });

    const { settings } = useSettings();
    const { restoreWarning, savingOnClose } = useTabState();
    const { clearRestoreWarning, createTab, addRecentFile } = useSessionActions();

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

    const showToast = useCallback((message) => {
        setToast({ message, show: true });
    }, []);

    const hideToast = useCallback(() => {
        setToast({ message: '', show: false });
    }, []);

    useFileDrop({ createTab, addRecentFile, showToast });
    useLaunchFiles({ createTab, addRecentFile, showToast });

    useEffect(() => {
        if (restoreWarning) {
            showToast(restoreWarning);
            clearRestoreWarning();
        }
    }, [restoreWarning, showToast, clearRestoreWarning]);

    const handleFindInEditor = useCallback(
        (text, options) => editorRef.current?.find(text, options) || { current: 0, total: 0 },
        []
    );
    const handleReplaceInEditor = useCallback(
        (text) => editorRef.current?.replace(text),
        []
    );
    const handleReplaceAllInEditor = useCallback(
        (searchText, replaceText, options) => editorRef.current?.replaceAll(searchText, replaceText, options) || 0,
        []
    );

    const {
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
        tabs,
        activeTabId,
        isPrimaryWindow
    } = useCommands(showToast, editorRef);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (!isPrimaryWindow && tabs.some(t => t.isDirty)) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [tabs, isPrimaryWindow]);

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
        // Matches e.code (physical key), so it works on any layout and with Caps Lock.
        // Modifiers are exact: an unlisted modifier (Alt, Meta, AltGr) means no match.
        const newWindow = () => window.open(window.location.href, '_blank');
        const find = () => { setFindReplaceMode('find'); setShowFindReplace(true); };
        const replace = () => { setFindReplaceMode('replace'); setShowFindReplace(true); };
        const shortcuts = [
            { code: 'KeyN', ctrl: true, noRepeat: true, run: newTab },
            { code: 'KeyN', ctrl: true, shift: true, noRepeat: true, run: newWindow },
            { code: 'KeyO', ctrl: true, noRepeat: true, run: openFile },
            { code: 'KeyS', ctrl: true, run: () => saveFile(editorRef) },
            { code: 'KeyS', ctrl: true, shift: true, run: () => saveFileAs(editorRef) },
            { code: 'KeyW', ctrl: true, noRepeat: true, run: () => closeTab(activeTabId) },
            { code: 'Tab', ctrl: true, run: () => switchTab('next') },
            { code: 'Tab', ctrl: true, shift: true, run: () => switchTab('prev') },
            { code: 'KeyF', ctrl: true, run: find },
            { code: 'KeyH', ctrl: true, run: replace },
            { code: 'KeyG', ctrl: true, run: () => setShowGoToLine(true) },
            { code: 'KeyP', ctrl: true, noRepeat: true, run: print },
            { code: 'F5', run: () => editorRef.current?.insertDateTime() },
        ];

        const handleKeyDown = (e) => {
            const s = shortcuts.find(sc =>
                sc.code === e.code &&
                e.ctrlKey === !!sc.ctrl &&
                e.shiftKey === !!sc.shift &&
                !e.altKey && !e.metaKey
            );
            if (!s) return;
            e.preventDefault();
            if (s.noRepeat && e.repeat) return;
            s.run();
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
                    onTabClose={(id) => closeTab(id)}
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
                    onCloseWindow={() => closeWindow()}
                    onExit={() => closeWindow({ quit: true })}
                    onOpenSettings={() => setShowSettings(true)}
                    recentFiles={recentFiles}
                />
            </div>

            <div className={styles.editorWrapper}>
                <Editor
                    ref={editorRef}
                    activeTabId={activeTabId}
                    tabIds={tabs.map(t => t.id)}
                    initialContent={activeTab.content}
                    initialCursor={activeTab.cursor || 0}
                    initialScroll={activeTab.scroll || 0}
                    onContentChange={(content, isDirty) => updateTab(activeTabId, { content, isDirty })}
                    onStateChange={(state) => updateTab(activeTabId, state)}
                    onStatsUpdate={setStats}
                />
            </div>

            <StatusBar stats={stats} appVersion={appVersion} updateStatus={updateStatus} eol={activeTab.eol} charset={activeTab.charset} />

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
                    onFind={handleFindInEditor}
                    onReplace={handleReplaceInEditor}
                    onReplaceAll={handleReplaceAllInEditor}
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
                appVersion={appVersion}
            />

            {toast.show && (
                <Toast
                    key={toast.message}
                    message={toast.message}
                    duration={3000}
                    onClose={hideToast}
                />
            )}

            {savingOnClose && (
                <div className={`${toastStyles.toast} ${toastStyles.show}`} role="status" data-testid="saving-on-close">
                    Saving your tabs…
                </div>
            )}
        </div>
    );
}

export default App;
