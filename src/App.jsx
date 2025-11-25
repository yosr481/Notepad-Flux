import React, { useState, useEffect } from 'react';
import Editor from './components/Editor';
import MenuBar from './components/Layout/MenuBar';
import Tabs from './components/Layout/Tabs';
import StatusBar from './components/Layout/StatusBar';
import ContextMenu from './components/Layout/ContextMenu';
import styles from './App.module.css';

function App() {
    const [theme, setTheme] = useState('dark');
    const [stats, setStats] = useState({
        line: 1,
        col: 1,
        wordCount: 0,
        charCount: 0
    });

    // Tabs State
    const [tabs, setTabs] = useState([
        { id: 'tab-1', title: 'Untitled', isDirty: false, content: '' }
    ]);
    const [activeTabId, setActiveTabId] = useState('tab-1');
    const [nextTabId, setNextTabId] = useState(2);

    const handleDocChange = (id, newContent, isDirty) => {
        setTabs(prev => prev.map(tab => {
            if (tab.id !== id) return tab;

            let newTitle = tab.title;
            // Update title if it's "Untitled" or was auto-generated (we don't track auto-generated flag yet, but let's assume if it matches the pattern or is Untitled)
            // Actually, user said: "No need for number in title, only Untitled for each tab, or the first line of content (trancuated to 20 chars)"
            // So if content is empty -> "Untitled".
            // If content exists -> First line truncated.

            const firstLine = newContent.split('\n')[0].trim();
            if (!firstLine) {
                newTitle = 'Untitled';
            } else {
                newTitle = firstLine.slice(0, 20);
            }

            return {
                ...tab,
                content: newContent,
                isDirty: isDirty,
                title: newTitle
            };
        }));
    }

    const createTab = () => {
        const newId = `tab-${nextTabId}`;
        const newTab = { id: newId, title: 'Untitled', isDirty: false, content: '' };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newId);
        setNextTabId(prev => prev + 1);
    };

    const closeTab = (id) => {
        const tabToClose = tabs.find(t => t.id === id);
        if (tabToClose.isDirty) {
            if (!window.confirm(`Save changes to ${tabToClose.title}?`)) {
                return;
            }
            // In a real app, we'd save here.
        }

        const newTabs = tabs.filter(t => t.id !== id);
        if (newTabs.length === 0) {
            // Don't allow closing the last tab, or create a new one
            const newId = `tab-${nextTabId}`;
            setTabs([{ id: newId, title: 'Untitled', isDirty: false, content: '' }]);
            setActiveTabId(newId);
            setNextTabId(prev => prev + 1);
        } else {
            setTabs(newTabs);
            if (activeTabId === id) {
                // Switch to the one to the right, or the last one if we closed the last one
                const index = tabs.findIndex(t => t.id === id);
                const nextTab = newTabs[index] || newTabs[index - 1];
                setActiveTabId(nextTab.id);
            }
        }
    };

    const switchTab = (direction) => {
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % tabs.length;
        } else {
            nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        }
        setActiveTabId(tabs[nextIndex].id);
    };

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
                    onClick: () => closeTabsRight(id)
                }
            ]
        });
    };

    const closeOtherTabs = (id) => {
        const tabsToClose = tabs.filter(t => t.id !== id);
        closeMultipleTabs(tabsToClose, id); // Pass the ID of the tab that should remain active
    };

    const closeTabsRight = (id) => {
        const index = tabs.findIndex(t => t.id === id);
        const tabsToClose = tabs.slice(index + 1);
        closeMultipleTabs(tabsToClose, id); // Pass the ID of the tab that should remain active
    };

    const closeMultipleTabs = (tabsToClose, clickedTabId) => {
        let newTabs = [...tabs];
        let newActiveTabId = activeTabId;

        // Filter out tabs that are dirty and user cancelled
        const tabsToActuallyClose = [];
        for (const tab of tabsToClose) {
            if (tab.isDirty) {
                if (!window.confirm(`Save changes to ${tab.title}?`)) {
                    return; // Abort operation if cancelled
                }
            }
            tabsToActuallyClose.push(tab);
        }

        newTabs = newTabs.filter(t => !tabsToActuallyClose.find(tc => tc.id === t.id));

        if (newTabs.length === 0) {
            // If all tabs are closed, create a new one
            const newId = `tab-${nextTabId}`;
            setTabs([{ id: newId, title: 'Untitled', isDirty: false, content: '' }]);
            setActiveTabId(newId);
            setNextTabId(prev => prev + 1);
        } else {
            setTabs(newTabs);
            // If the active tab was closed, or if we want to switch to the clicked tab
            if (!newTabs.find(t => t.id === activeTabId) || (clickedTabId && activeTabId !== clickedTabId)) {
                // If the clicked tab is still in the list, make it active. Otherwise, pick the first remaining.
                newActiveTabId = newTabs.find(t => t.id === clickedTabId)?.id || newTabs[0].id;
                setActiveTabId(newActiveTabId);
            }
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                createTab();
            } else if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                switchTab(e.shiftKey ? 'prev' : 'next');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tabs, activeTabId]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Apply theme to body to ensure global styles (scrollbars, bg) update
    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
    }, [theme]);

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

    return (
        <div className={styles.appContainer} data-theme={theme} onClick={() => setContextMenu(null)}>
            <Tabs
                tabs={tabs}
                activeTabId={activeTabId}
                onTabClick={setActiveTabId}
                onTabClose={closeTab}
                onNewTab={createTab}
                onContextMenu={handleContextMenu}
            />
            <MenuBar theme={theme} toggleTheme={toggleTheme} />

            <div className={styles.editorWrapper}>
                <Editor
                    key={activeTabId} // Force re-mount for now to ensure state isolation, but we need to pass initial content
                    initialContent={activeTab.content}
                    onContentChange={(content, isDirty) => handleDocChange(activeTabId, content, isDirty)}
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
