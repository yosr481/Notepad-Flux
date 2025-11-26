import React, { useState, useEffect } from 'react';
import Editor from './components/Editor';
import MenuBar from './components/Layout/MenuBar';
import Tabs from './components/Layout/Tabs';
import StatusBar from './components/Layout/StatusBar';
import ContextMenu from './components/Layout/ContextMenu';
import styles from './App.module.css';
import { useCommands } from './hooks/useCommands';

function App() {
    const [theme, setTheme] = useState('dark');
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
        closeTab,
        closeOtherTabs,
        closeTabsToRight,
        switchTab,
        updateTab
    } = useCommands();

    const [contextMenu, setContextMenu] = useState(null);

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
            } else if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                switchTab(e.shiftKey ? 'prev' : 'next');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [newTab, switchTab]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

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

    return (
        <div className={styles.appContainer} data-theme={theme} onClick={() => setContextMenu(null)}>
            <Tabs
                tabs={tabs}
                activeTabId={activeTabId}
                onTabClick={setActiveTabId}
                onTabClose={closeTab}
                onNewTab={newTab}
                onContextMenu={handleContextMenu}
            />
            <MenuBar
                theme={theme}
                toggleTheme={toggleTheme}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onSelectAll={handleSelectAll}
            />

            <div className={styles.editorWrapper}>
                <Editor
                    ref={editorRef}
                    activeTabId={activeTabId}
                    initialContent={activeTab.content}
                    onContentChange={(content, isDirty) => updateTab(activeTabId, { content, isDirty })}
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
        </div>
    );
}

export default App;
