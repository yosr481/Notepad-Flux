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
    const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
    const [progress, setProgress] = useState(0);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [error, setError] = useState(null);

    const checkForUpdates = useCallback(async () => {
        if (!window.electronAPI?.updater) return;

        setStatus('checking');
        setError(null);
        try {
            await window.electronAPI.updater.check();
        } catch (err) {
            console.error('Failed to check for updates:', err);
            setStatus('error');
            setError(err.message);
        }
    }, []);

    const downloadUpdate = useCallback(async () => {
        if (!window.electronAPI?.updater) return;

        setStatus('downloading');
        setProgress(0);
        try {
            await window.electronAPI.updater.download();
        } catch (err) {
            console.error('Failed to download update:', err);
            setStatus('error');
            setError(err.message);
        }
    }, []);

    const installUpdate = useCallback(async () => {
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

        return cleanup;
    }, []);

    const value = {
        status,
        progress,
        updateInfo,
        error,
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
