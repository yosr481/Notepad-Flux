import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const UpdateContext = createContext();

export function useUpdate() {
    const context = useContext(UpdateContext);
    if (!context) {
        throw new Error('useUpdate must be used within an UpdateProvider');
    }
    return context;
}

export function UpdateProvider({ children }) {
    const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
    const [progress, setProgress] = useState(0);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [error, setError] = useState(null);
    const [isManualCheck, setIsManualCheck] = useState(false);

    const checkForUpdates = useCallback(async (manual = false) => {
        setIsManualCheck(manual);
        setStatus('checking');
        setError(null);

        if (import.meta.env.DEV) {
            console.log('[DEV] Mock update check initiated (manual:', manual, ')');
            // Try to use electronAPI if available, otherwise just simulate it locally if needed
            // But we want to test the main.js logic, so we call the IPC
            if (window.electronAPI?.updater) {
                window.electronAPI.updater.check();
            } else {
                console.warn('[DEV] window.electronAPI.updater not found. Ensure Electron is running.');
                // Fallback simulation for browser-only dev (if someone runs in browser)
                setTimeout(() => {
                    setStatus('available');
                    setUpdateInfo({ version: '1.9.9 (Browser Mock)', releaseNotes: 'Mock notes' });
                }, 1000);
            }
            return;
        }

        if (!window.electronAPI?.updater) return;

        try {
            await window.electronAPI.updater.check();
        } catch (err) {
            console.error('Failed to check for updates:', err);
            setStatus('error');
            setError(err.message);
        }
    }, []);

    const downloadUpdate = useCallback(async () => {
        setStatus('downloading');
        setProgress(0);

        if (import.meta.env.DEV && !window.electronAPI?.updater) {
            let p = 0;
            const interval = setInterval(() => {
                p += 10;
                setProgress(p);
                if (p >= 100) {
                    clearInterval(interval);
                    setStatus('downloaded');
                }
            }, 500);
            return;
        }

        if (!window.electronAPI?.updater) return;

        try {
            await window.electronAPI.updater.download();
        } catch (err) {
            console.error('Failed to download update:', err);
            setStatus('error');
            setError(err.message);
        }
    }, []);

    const installUpdate = useCallback(async () => {
        if (import.meta.env.DEV && !window.electronAPI?.updater) {
            alert('[DEV] Mock update: Application would restart now.');
            setStatus('idle');
            return;
        }

        if (!window.electronAPI?.updater) return;

        try {
            await window.electronAPI.updater.install();
        } catch (err) {
            console.error('Failed to install update:', err);
            setStatus('error');
            setError(err.message);
        }
    }, []);

    const dismissUpdate = useCallback(() => {
        setStatus('idle');
        setUpdateInfo(null);
        setProgress(0);
    }, []);

    useEffect(() => {
        if (!window.electronAPI?.updater) return;

        const cleanup = window.electronAPI.updater.onEvents({
            onChecking: () => {
                setStatus('checking');
            },
            onUpdateAvailable: (info) => {
                setStatus('available');
                setUpdateInfo(info);
            },
            onUpdateNotAvailable: () => {
                setStatus('not-available');
            },
            onDownloadProgress: (progressEvent) => {
                setStatus('downloading');
                setProgress(Math.round(progressEvent.percent));
            },
            onUpdateDownloaded: (info) => {
                setStatus('downloaded');
                setUpdateInfo(info);
            },
            onError: (err) => {
                setStatus('error');
                setError(err?.message || 'An error occurred during update');
            }
        });

        // Trigger automatic check on mount
        // We use a small timeout to ensure listeners are fully established
        const timer = setTimeout(() => {
            checkForUpdates(false);
        }, 3000);
        return () => {
            cleanup();
            clearTimeout(timer);
        };
    }, [checkForUpdates]);

    const value = {
        status,
        progress,
        updateInfo,
        error,
        isManualCheck,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
        dismissUpdate
    };

    return (
        <UpdateContext.Provider value={value}>
            {children}
        </UpdateContext.Provider>
    );
}
