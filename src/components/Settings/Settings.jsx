import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import styles from './Settings.module.css';
import { version } from '../../../package.json';
import { dialogs } from '../../utils/dialogs';
import { useSettings, useSessionActions } from '../../context/SessionContext';
import { useUpdateStatus } from '../../hooks/useUpdateStatus';
import { formatBytes } from '../../utils/formatBytes';

// Label, action and disabled flag of the update button per update state (update-spec.md).
const updateButton = (status) => {
    switch (status.state) {
        case 'idle':
        case 'error': return { label: 'Check for updates', action: 'check' };
        case 'checking': return { label: 'Checking…', disabled: true };
        case 'available': return { label: `Update to v${status.version}`, action: 'download' };
        case 'downloading': return { label: `Downloading… ${status.percent ?? 0}%`, disabled: true };
        case 'downloaded': return { label: 'Restart to update', action: 'install' };
        case 'not-available': return { label: 'Up to date', action: 'check' };
        default: return null; // unsupported
    }
};

const Settings = ({ isOpen, onClose, appVersion }) => {
    const [errors, setErrors] = useState({});
    const { settings, updateSettings } = useSettings();
    const { clearSessionData } = useSessionActions();
    const updateStatus = useUpdateStatus();
    const update = updateStatus && updateButton(updateStatus);

    const [dataPath, setDataPath] = useState(null);
    const [dataSize, setDataSize] = useState('Calculating…');
    const [webUsage, setWebUsage] = useState('');
    const isDesktop = !!window.electronAPI;

    // Refetch each time Settings opens; cleanup drops stale responses and anything after unmount.
    useEffect(() => {
        if (!isOpen) return undefined;
        let live = true;
        if (window.electronAPI) {
            Promise.resolve().then(() => {
                if (live) setDataSize('Calculating…');
                return window.electronAPI.getDataInfo();
            }).then((info) => {
                if (!live) return;
                if (typeof info?.path === 'string') setDataPath(info.path);
                const size = formatBytes(info?.bytes);
                setDataSize(size ? (info.truncated === true ? `at least ${size}` : size) : 'Size unavailable');
            }).catch(() => { if (live) setDataSize('Size unavailable'); });
        } else {
            Promise.resolve().then(() => navigator.storage.estimate()).then((est) => {
                if (live) setWebUsage(formatBytes(est?.usage));
            }).catch(() => { if (live) setWebUsage(''); });
        }
        return () => { live = false; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleNumberChange = (key, value, min, max) => {
        const num = parseInt(value, 10);
        let error = '';

        if (isNaN(num)) {
            error = 'Please enter a valid number';
        } else if (num < min || num > max) {
            error = `Must be between ${min} and ${max}`;
        }

        setErrors(prev => ({ ...prev, [key]: error }));

        if (error) return;

        updateSettings({ [key]: num });
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.header}>
                <button className={styles.backButton} onClick={onClose}>
                    <ArrowLeft size={20} />
                </button>
                <h2 className={styles.title}>Settings</h2>
            </div>

            <div className={styles.content}>
                {/* App Theme */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Appearance</h3>
                    <div className={styles.row}>
                        <div>
                            <div className={styles.label}>App theme</div>
                            <div className={styles.description}>Select your preferred color theme</div>
                        </div>
                        <select
                            className={styles.select}
                            value={settings.theme}
                            onChange={(e) => updateSettings({ theme: e.target.value })}
                        >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                            <option value="system">Use system setting</option>
                        </select>
                    </div>
                </div>

                {/* Session Restoration */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Session Restoration Warnings</h3>

                    <div className={styles.row}>
                        <div>
                            <div className={styles.label}>Tab count threshold</div>
                            <div className={styles.description}>Warn me if restoring more than this many tabs</div>
                        </div>
                        <input
                            type="number"
                            className={`${styles.input} ${errors.sessionWarnTabs ? styles.inputError : ''}`}
                            value={settings.sessionWarnTabs}
                            onChange={(e) => handleNumberChange('sessionWarnTabs', e.target.value, 1, 100)}
                            min="1"
                            max="100"
                        />
                        {errors.sessionWarnTabs && <div className={styles.error}>{errors.sessionWarnTabs}</div>}
                    </div>

                    <div className={styles.row}>
                        <div>
                            <div className={styles.label}>Session size threshold (MB)</div>
                            <div className={styles.description}>Warn me if total session size exceeds this limit</div>
                        </div>
                        <input
                            type="number"
                            className={`${styles.input} ${errors.sessionWarnSize ? styles.inputError : ''}`}
                            value={settings.sessionWarnSize}
                            onChange={(e) => handleNumberChange('sessionWarnSize', e.target.value, 1, 1024)}
                            min="1"
                            max="1024"
                        />
                        {errors.sessionWarnSize && <div className={styles.error}>{errors.sessionWarnSize}</div>}
                    </div>
                </div>

                {/* Clear Session */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Data Management</h3>
                    {(isDesktop || webUsage) && (
                        <div className={styles.row}>
                            <div className={styles.dataInfo}>
                                <div className={styles.label}>Session data</div>
                                {isDesktop && dataPath && <div className={styles.dataPath} dir="ltr">{dataPath}</div>}
                                <div className={styles.description}>
                                    {isDesktop ? dataSize : `about ${webUsage} used by this site`}
                                </div>
                            </div>
                            {isDesktop && (
                                <button
                                    className={styles.button}
                                    onClick={() => { Promise.resolve().then(() => window.electronAPI.openDataFolder()).catch(() => {}); }}
                                >
                                    Open folder
                                </button>
                            )}
                        </div>
                    )}
                    <div className={styles.row}>
                        <div>
                            <div className={styles.label}>Clear saved session</div>
                            <div className={styles.description}>Remove all saved tabs and session data</div>
                        </div>
                        <button
                            className={`${styles.button} ${styles.danger}`}
                            onClick={async () => {
                                const ok = await dialogs.confirm({
                                    title: 'Clear session data?',
                                    message: 'This permanently removes all saved tabs and session data. This cannot be undone.',
                                    confirmLabel: 'Clear',
                                    danger: true
                                });
                                if (ok) clearSessionData();
                            }}
                        >
                            Clear Session Data
                        </button>
                    </div>
                </div>

                {/* About */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>About</h3>
                    <div className={`${styles.row} ${styles.aboutRow}`}>
                        <div className={styles.aboutInfo}>
                            <div className={styles.label}>Notepad Flux</div>
                            <div className={styles.description}>A minimal, distraction-free markdown editor</div>
                            <div className={styles.versionInfo}>
                                {appVersion ? `v${appVersion}` : `v${version}`}
                            </div>
                            {updateStatus?.error && (
                                <div className={styles.description}>Update failed: {updateStatus.error}</div>
                            )}
                        </div>
                        <div className={styles.aboutActions}>
                        {update && (
                            <button
                                className={styles.button}
                                data-testid="update-button"
                                disabled={!!update.disabled}
                                onClick={() => {
                                    if (!update.action) return;
                                    Promise.resolve(window.electronAPI?.updates?.[update.action]())
                                        .catch((err) => console.error('Update action failed:', err));
                                }}
                            >
                                {update.label}
                            </button>
                        )}
                        <a
                            className={styles.button}
                            href="https://github.com/yosr481/Notepad-Flux/releases"
                            target="_blank"
                            rel="noreferrer"
                        >
                            View Releases
                        </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
