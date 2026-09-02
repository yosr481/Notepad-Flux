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
    const [restoreWarning, setRestoreWarning] = useState(null);

    const nextTabId = useRef(2);
    const saveTimers = useRef(new Map());
    const metadataTimer = useRef(null);
    const currentTabsRef = useRef(tabs);
    const currentActiveTabIdRef = useRef(activeTabId);

    // Keep currentTabsRef in sync with tabs state
    useEffect(() => {
        currentTabsRef.current = tabs;
        currentActiveTabIdRef.current = activeTabId;
    }, [tabs, activeTabId]);

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

    const saveMetadataDebounced = useCallback((data) => {
        if (!isPrimaryWindow || !isSessionLoaded) return;

        if (metadataTimer.current) {
            clearTimeout(metadataTimer.current);
        }

        metadataTimer.current = setTimeout(() => {
            storage.saveMetadata(data);
            metadataTimer.current = null;
        }, 400);
    }, [isPrimaryWindow, isSessionLoaded]);

    useEffect(() => {
        if (!navigator.locks) {
            console.warn('Web Locks API not supported. Session persistence disabled.');
            setIsSessionLoaded(true);
            return;
        }

        const abortController = new AbortController();
        let timeoutId;

        // Extract adoptSessionMeta for use in both loadAndSetupSession and onPromoted
        const adoptSessionMeta = (diskSession) => {
            const diskTabs = diskSession.tabs || [];

            // Calculate restoreWarning: count tabs with _decryptFailed
            const failedCount = diskTabs.filter(t => t._decryptFailed).length;
            if (failedCount > 0) {
                const s = failedCount > 1 ? 's' : '';
                setRestoreWarning(`${failedCount} tab${s} couldn't be restored (decryption failed)`);
            } else {
                setRestoreWarning(null);
            }

            // Update nextTabId based on disk tabs
            const maxId = diskTabs.reduce((max, t) => {
                const num = parseInt(t.id.replace('tab-', ''));
                return !isNaN(num) && num > max ? num : max;
            }, 1);
            nextTabId.current = maxId + 1;

            // Adopt metadata from disk
            if (diskSession.activeTabId) {
                setActiveTabId(diskSession.activeTabId);
            }
            if (diskSession.recentFiles) {
                setRecentFiles(diskSession.recentFiles);
            }
            if (diskSession.settings) {
                setSettings(prev => ({ ...prev, ...diskSession.settings }));
            }
        };

        const loadAndSetupSession = async (diskSession) => {
            if (diskSession.tabs && diskSession.tabs.length > 0) {
                let loadedTabs = diskSession.tabs;

                if (diskSession.tabOrder && diskSession.tabOrder.length > 0) {
                    const orderMap = new Map(diskSession.tabOrder.map((id, index) => [id, index]));
                    loadedTabs.sort((a, b) => {
                        const indexA = orderMap.has(a.id) ? orderMap.get(a.id) : 9999;
                        const indexB = orderMap.has(b.id) ? orderMap.get(b.id) : 9999;
                        return indexA - indexB;
                    });
                }

                setTabs(loadedTabs);
            }

            adoptSessionMeta(diskSession);
        };

        const initSession = async (lock) => {
            if (lock) {
                // Primary window: load from disk
                setIsPrimaryWindow(true);
                try {
                    const session = await storage.loadSession();
                    await loadAndSetupSession(session);
                } catch (err) {
                    console.error('Failed to load session:', err);
                } finally {
                    setIsSessionLoaded(true);
                }

                await new Promise((resolve) => {
                    if (abortController.signal.aborted) { resolve(); return; }
                    abortController.signal.addEventListener('abort', () => resolve(), { once: true });
                });
            } else {
                // Secondary window: load settings only, then queue for promotion
                setIsPrimaryWindow(false);
                try {
                    const session = await storage.loadSession();
                    if (session.settings) {
                        setSettings(prev => ({ ...prev, ...session.settings }));
                    }
                } catch (err) {
                    console.warn('Secondary window failed to load settings:', err);
                }
                setIsSessionLoaded(true);

                // Queue for promotion: when primary dies, this will be called with the lock
                navigator.locks.request('notepad-flux-primary', { signal: abortController.signal }, onPromoted).catch(() => {});
            }
        };

        const onPromoted = async (_lock) => {
            // Capture pre-promotion activeTabId to restore if the tab still exists after merge
            const localActiveId = currentActiveTabIdRef.current;

            // Called when this secondary window is promoted to primary
            // Gate the promotion window with isSessionLoaded = false to prevent saveTabDebounced
            // from writing pristine state while we're merging
            setIsSessionLoaded(false);

            // Clear any pending debounced saves
            for (const t of saveTimers.current.values()) clearTimeout(t);
            saveTimers.current.clear();

            setIsPrimaryWindow(true);
            try {
                // Reload the on-disk session as the base
                const diskSession = await storage.loadSession();
                const diskTabMap = new Map((diskSession.tabs || []).map(t => [t.id, t]));

                // Identify meaningful local tabs (use ref to avoid effect dependency)
                // A tab is NOT meaningful if: content === '' && isDirty !== true && filePath == null &&
                // fileHandle == null && id not in disk
                const meaningfulLocalTabs = currentTabsRef.current.filter(localTab => {
                    const isInDisk = diskTabMap.has(localTab.id);
                    const isPristine =
                        localTab.content === '' &&
                        localTab.isDirty !== true &&
                        localTab.filePath == null &&
                        localTab.fileHandle == null;

                    // A tab is meaningful if it's in disk OR it's not pristine
                    return isInDisk || !isPristine;
                });

                // Build merged tabs: disk tabs + meaningful local tabs
                const mergedTabs = [...(diskSession.tabs || [])];
                for (const localTab of meaningfulLocalTabs) {
                    const idx = mergedTabs.findIndex(t => t.id === localTab.id);
                    if (idx !== -1) {
                        // Replace: local edit wins
                        mergedTabs[idx] = localTab;
                    } else {
                        // Append: new local tab
                        mergedTabs.push(localTab);
                    }
                }

                // Sort merged tabs by diskSession.tabOrder, same as loadAndSetupSession
                if (diskSession.tabOrder && diskSession.tabOrder.length > 0) {
                    const orderMap = new Map(diskSession.tabOrder.map((id, index) => [id, index]));
                    mergedTabs.sort((a, b) => {
                        const indexA = orderMap.has(a.id) ? orderMap.get(a.id) : 9999;
                        const indexB = orderMap.has(b.id) ? orderMap.get(b.id) : 9999;
                        return indexA - indexB;
                    });
                }

                setTabs(mergedTabs);

                // Adopt metadata from disk
                adoptSessionMeta(diskSession);

                // Restore pre-promotion activeTabId if the tab still exists in merged state
                if (mergedTabs.some(t => t.id === localActiveId)) {
                    setActiveTabId(localActiveId);
                }

                // Persist meaningful local tabs
                for (const localTab of meaningfulLocalTabs) {
                    await storage.saveTab(localTab);
                }

                // Persist metadata
                await storage.saveMetadata({
                    activeTabId: diskSession.activeTabId || mergedTabs[0]?.id,
                    recentFiles: diskSession.recentFiles || [],
                    settings: diskSession.settings || {},
                    tabOrder: mergedTabs.map(t => t.id)
                });
            } catch (err) {
                console.error('Failed to promote to primary window:', err);
            } finally {
                setIsSessionLoaded(true);
            }

            // Hold the lock until this window unloads
            await new Promise((resolve) => {
                if (abortController.signal.aborted) { resolve(); return; }
                abortController.signal.addEventListener('abort', () => resolve(), { once: true });
            });
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

    // Save metadata when relevant state changes (debounced to avoid churn)
    useEffect(() => {
        saveMetadataDebounced({ activeTabId, recentFiles, settings });
    }, [activeTabId, recentFiles, settings, saveMetadataDebounced]);

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
        // Decide synchronously from the live tab list (the setTabs updater runs
        // later, so a flag mutated inside it isn't visible here). The last tab is
        // never removed (L3), so a last-tab close must not touch disk either.
        const willRemove =
            currentTabsRef.current.some(t => t.id === id) &&
            currentTabsRef.current.length > 1;

        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== id);
            if (newTabs.length === 0) return prev;
            return newTabs;
        });

        // Only touch disk when the tab was actually removed. Deleting the row for
        // a last-tab close that the UI refused would lose that tab on next launch.
        if (willRemove && isPrimaryWindow && isSessionLoaded) {
            // Cancel any pending debounced save for this tab, otherwise its 1s
            // timer fires after deleteTab and re-puts the row (phantom tab).
            const pending = saveTimers.current.get(id);
            if (pending) {
                clearTimeout(pending);
                saveTimers.current.delete(id);
            }
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

    // Persist the tab-id order to metadata. `tabs` is a fresh array on every
    // keystroke (updateTab), but the ORDER only changes on create/close/reorder,
    // so gate the write on the id-list actually changing - otherwise every
    // keypress triggers an openDB + encrypt (IPC) + txn for an unchanged value.
    const prevTabOrderRef = useRef('');
    useEffect(() => {
        if (!isPrimaryWindow || !isSessionLoaded) return;
        const order = tabs.map(t => t.id);
        const key = order.join(',');
        if (key === prevTabOrderRef.current) return;
        prevTabOrderRef.current = key;
        storage.saveMetadata({ tabOrder: order });
    }, [tabs, isPrimaryWindow, isSessionLoaded]);

    const updateSettings = useCallback((newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const saveSession = useCallback(async () => {
        if (!isPrimaryWindow || !isSessionLoaded) return;

        try {
            await storage.saveSnapshot({
                tabs,
                metadata: {
                    activeTabId,
                    recentFiles,
                    settings,
                    tabOrder: tabs.map(t => t.id)
                }
            });
        } catch (err) {
            console.error('Failed to save session:', err);
        }
    }, [tabs, activeTabId, recentFiles, settings, isPrimaryWindow, isSessionLoaded]);

    // Write-through flush: persist every pending debounced tab save + metadata
    // immediately, without waiting for the debounce. Used when the window is
    // about to lose focus / be hidden, so edits survive a fast close (H1).
    const flushPendingSaves = useCallback(() => {
        if (!isPrimaryWindow || !isSessionLoaded) return;

        // Clear all pending timers
        for (const timer of saveTimers.current.values()) {
            clearTimeout(timer);
        }
        saveTimers.current.clear();

        if (metadataTimer.current) {
            clearTimeout(metadataTimer.current);
            metadataTimer.current = null;
        }

        // Persist via snapshot
        storage.saveSnapshot({
            tabs,
            metadata: {
                activeTabId,
                recentFiles,
                settings,
                tabOrder: tabs.map(t => t.id)
            }
        });
    }, [tabs, activeTabId, recentFiles, settings, isPrimaryWindow, isSessionLoaded]);

    useEffect(() => {
        const onHide = () => {
            if (document.visibilityState === 'hidden') flushPendingSaves();
        };
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('blur', flushPendingSaves);
        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('blur', flushPendingSaves);
        };
    }, [flushPendingSaves]);

    // Save session before window closes (last-resort best-effort; beforeunload is
    // synchronous so IndexedDB writes may not land — flushPendingSaves above is
    // the reliable path).
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

    const clearRestoreWarning = useCallback(() => {
        setRestoreWarning(null);
    }, []);

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
        saveSession,
        restoreWarning,
        clearRestoreWarning
    };

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
};
