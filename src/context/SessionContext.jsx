import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const SessionContext = createContext();

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};

export const SessionProvider = ({ children }) => {
    const [tabs, setTabs] = useState([
        { id: 'tab-1', title: 'Untitled', isDirty: false, content: '', filePath: null, fileHandle: null }
    ]);
    const [activeTabId, setActiveTabId] = useState('tab-1');
    const nextTabId = useRef(2);

    // Helper to generate title from content
    const generateTitle = (content) => {
        const firstLine = content.split('\n')[0].trim();
        return firstLine ? firstLine.slice(0, 35) : 'Untitled';
    };

    const createTab = useCallback((initialData = {}) => {
        const newId = `tab-${nextTabId.current}`;
        nextTabId.current += 1;
        const newTab = {
            id: newId,
            title: 'Untitled',
            isDirty: false,
            content: '',
            filePath: null,
            fileHandle: null,
            ...initialData
        };
        setTabs(curr => [...curr, newTab]);
        setActiveTabId(newId);
    }, []);

    const closeTab = useCallback((id) => {
        // Note: The actual "Save?" prompt logic should probably live in the Command layer or UI layer
        // because Context shouldn't necessarily trigger window.confirm directly if we want to be clean.
        // But for now, we'll expose a method that just does the state update, and let the caller handle checks.

        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== id);
            if (newTabs.length === 0) {
                // If closing last tab, create a new one
                // We need to handle the ID generation carefully here or just reset
                // For simplicity, let's just return a fresh state if empty
                // But we can't easily access 'nextTabId' inside this setter without refs or another setter.
                // So we'll handle the "empty list" case in the effect or the caller.
                // Actually, let's just prevent empty list here.
                return prev.filter(t => t.id !== id);
            }
            return newTabs;
        });
    }, []);

    // We need a separate effect or logic to handle "Active Tab" switching when one is closed
    // This is easier to handle if closeTab is an async function or we use an effect.
    // Let's keep it simple: The caller (useCommands) will handle the logic of "What is the next tab?"
    // and call setActiveTabId.

    const updateTab = useCallback((id, updates) => {
        setTabs(prev => prev.map(tab => {
            if (tab.id !== id) return tab;

            let newTab = { ...tab, ...updates };

            // Auto-update title if not saved (no fileHandle) and content changed
            if (updates.content !== undefined && !newTab.fileHandle) {
                newTab.title = generateTitle(updates.content);
            }

            return newTab;
        }));
    }, []);

    const switchTab = useCallback((direction) => {
        setTabs(currentTabs => {
            const currentIndex = currentTabs.findIndex(t => t.id === activeTabId);
            if (currentIndex === -1) return currentTabs;

            let nextIndex;
            if (direction === 'next') {
                nextIndex = (currentIndex + 1) % currentTabs.length;
            } else {
                nextIndex = (currentIndex - 1 + currentTabs.length) % currentTabs.length;
            }
            setActiveTabId(currentTabs[nextIndex].id);
            return currentTabs;
        });
    }, [activeTabId]);

    const value = {
        tabs,
        activeTabId,
        setActiveTabId,
        createTab,
        closeTab,
        updateTab,
        switchTab,
        setTabs // Expose for complex operations like bulk close
    };

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
};
