import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { storage } from '../services/storage';
import { sanitizeFilename } from '../utils/fileSystem';

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
    const [recentFiles, setRecentFiles] = useState([]);
    const [isPrimaryWindow, setIsPrimaryWindow] = useState(false);
    const [isSessionLoaded, setIsSessionLoaded] = useState(false);
    const [settings, setSettings] = useState({
        theme: 'system',
        sessionWarnTabs: 30,
        sessionWarnSize: 80,
    });

    const nextTabId = useRef(2);
    const saveTimers = useRef(new Map());

    const generateTitle = (content) => {
        const firstLine = content.split('\n')[0].trim();
        const title = firstLine ? firstLine.slice(0, 35) : 'Untitled';
        return sanitizeFilename(title);
    };

    const saveTabDebounced = useCallback((tab) => {
        if (!isPrimaryWindow || !isSessionLoaded) return;

        if (saveTimers.current.has(tab.id)) {
            clearTimeout(saveTimers.current.get(tab.id));
        }

        const timer = setTimeout(() => {
            storage.saveTab(tab);
            saveTimers.current.delete(tab.id);
        }, 1000);

        saveTimers.current.set(tab.id, timer);
    }, [isPrimaryWindow, isSessionLoaded]);

    useEffect(() => {
        if (!navigator.locks) {
            console.warn('Web Locks API not supported. Session persistence disabled.');
            setIsSessionLoaded(true);
            return;
        }

        const abortController = new AbortController();
        let timeoutId;

        const initSession = async (lock) => {
            if (lock) {
                setIsPrimaryWindow(true);
                try {
                    const session = await storage.loadSession();
                    if (session.tabs && session.tabs.length > 0) {
                        let loadedTabs = session.tabs;

                        if (session.tabOrder && session.tabOrder.length > 0) {
                            const orderMap = new Map(session.tabOrder.map((id, index) => [id, index]));
                            loadedTabs.sort((a, b) => {
                                const indexA = orderMap.has(a.id) ? orderMap.get(a.id) : 9999;
                                const indexB = orderMap.has(b.id) ? orderMap.get(b.id) : 9999;
                                return indexA - indexB;
                            });
                        }

                        setTabs(loadedTabs);
                        const maxId = session.tabs.reduce((max, t) => {
                            const num = parseInt(t.id.replace('tab-', ''));
                            return !isNaN(num) && num > max ? num : max;
                        }, 1);
                        nextTabId.current = maxId + 1;
                    }
                    if (session.activeTabId) {
                        setActiveTabId(session.activeTabId);
                    }
                    if (session.recentFiles) {
                        setRecentFiles(session.recentFiles);
                    }
                    if (session.settings) {
                        setSettings(prev => ({ ...prev, ...session.settings }));
                    }
                } catch (err) {
                    console.error('Failed to load session:', err);
                } finally {
                    setIsSessionLoaded(true);
                }

                await new Promise((resolve) => {
                    abortController.signal.addEventListener('abort', () => {
                        resolve();
                    });
                });
            } else {
                // We are a secondary window
                setIsPrimaryWindow(false);
                try {
                    // Attempt to load settings so we inherit the theme/preferences
                    const session = await storage.loadSession();
                    if (session.settings) {
                        setSettings(prev => ({ ...prev, ...session.settings }));
                    }
                } catch (err) {
                    console.warn('Secondary window failed to load settings:', err);
                }
                setIsSessionLoaded(true);
            }
        };

        // Add a small delay to allow cleanup of previous effect (Strict Mode) to release lock
        timeoutId = setTimeout(() => {
            navigator.locks.request('notepad-flux-primary', { ifAvailable: true }, initSession);
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            abortController.abort();
        };
    }, []);

    // Save metadata when relevant state changes
    useEffect(() => {
        if (isPrimaryWindow && isSessionLoaded) {
            storage.saveMetadata({ activeTabId, recentFiles, settings });
        }
    }, [activeTabId, recentFiles, settings, isPrimaryWindow, isSessionLoaded]);

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

        if (isPrimaryWindow && isSessionLoaded) {
            storage.saveTab(newTab);
            storage.saveMetadata({
                activeTabId: newId,
                tabOrder: [...tabs.map(t => t.id), newId]
            });
        }
    }, [tabs, isPrimaryWindow, isSessionLoaded]);

    const closeTab = useCallback((id) => {
        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== id);
            if (newTabs.length === 0) {
                // Prevent empty list, but if we really want to close the last one and create new...
                // For now, keep behavior: don't allow closing last tab effectively, or handle it upstream.
                // But if we DO close it, we should delete from storage.
                return prev.filter(t => t.id !== id);
            }
            return newTabs;
        });

        if (isPrimaryWindow && isSessionLoaded) {
            storage.deleteTab(id);
        }
    }, [isPrimaryWindow, isSessionLoaded]);

    const updateTab = useCallback((id, updates) => {
        setTabs(prev => prev.map(tab => {
            if (tab.id !== id) return tab;

            let newTab = { ...tab, ...updates };

            // Auto-update title if not saved (no fileHandle) and content changed
            if (updates.content !== undefined && !newTab.fileHandle) {
                newTab.title = generateTitle(updates.content);
                if (updates.content === '') {
                    newTab.isDirty = false;
                }
            }

            // Trigger persistence
            if (isPrimaryWindow && isSessionLoaded) {
                saveTabDebounced(newTab);
            }

            return newTab;
        }));
    }, [isPrimaryWindow, isSessionLoaded, saveTabDebounced]);

    const addRecentFile = useCallback((filePath, fileName, fileHandle = null) => {
        setRecentFiles(prev => {
            const filtered = prev.filter(f => f.filePath !== filePath);
            return [{ filePath, fileName, fileHandle }, ...filtered].slice(0, 20);
        });
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

    const reorderTabs = useCallback((activeId, overId) => {
        setTabs((items) => {
            const oldIndex = items.findIndex((item) => item.id === activeId);
            const newIndex = items.findIndex((item) => item.id === overId);

            if (oldIndex === -1 || newIndex === -1) return items;

            const newItems = [...items];
            const [movedItem] = newItems.splice(oldIndex, 1);
            newItems.splice(newIndex, 0, movedItem);

            // We should probably save the new order to storage?
            // Since we store tabs individually, the order is determined by the array.
            // But we load them via getAll which might not preserve order unless we store an index.
            // For now, let's assume getAll returns in insertion order or key order.
            // If we want strict order, we should store a 'tabsOrder' in metadata or an 'order' field in tab.
            // Let's add 'order' field to tab or just save the whole list order in metadata?
            // Saving whole list order in metadata is safer.
            // For now, let's just update the tabs.

            return newItems;
        });
    }, []);

    // Effect to save tab order if needed. 
    // Since we store tabs individually, we might lose order on reload if we rely on IDB key order.
    // Let's save the tab IDs order in metadata.
    useEffect(() => {
        if (isPrimaryWindow && isSessionLoaded) {
            const order = tabs.map(t => t.id);
            storage.saveMetadata({ tabOrder: order });
        }
    }, [tabs, isPrimaryWindow, isSessionLoaded]);

    const updateSettings = useCallback((newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const saveSession = useCallback(async () => {
        if (!isPrimaryWindow || !isSessionLoaded) return;

        try {
            // Save all tabs content immediately
            await Promise.all(tabs.map(tab => storage.saveTab(tab)));

            // Save metadata
            await storage.saveMetadata({
                activeTabId,
                recentFiles,
                settings,
                tabOrder: tabs.map(t => t.id)
            });
        } catch (err) {
            console.error('Failed to save session:', err);
        }
    }, [tabs, activeTabId, recentFiles, settings, isPrimaryWindow, isSessionLoaded]);

    // Save session before window closes
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isPrimaryWindow && isSessionLoaded) {
                // Since beforeunload is synchronous, we can't wait for the promise.
                // However, storage operations might still complete if they start before the process dies.
                // In Electron, we could use synchronous storage or IPC, but with IDB we do our best.
                saveSession();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [saveSession, isPrimaryWindow, isSessionLoaded]);

    const value = {
        tabs,
        activeTabId,
        setActiveTabId,
        createTab,
        closeTab,
        updateTab,
        switchTab,
        setTabs,
        reorderTabs,
        recentFiles,
        addRecentFile,
        isPrimaryWindow,
        isSessionLoaded,
        settings,
        updateSettings,
        saveSession
    };

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
};
