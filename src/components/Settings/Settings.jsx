import React from 'react';
import { ArrowLeft } from 'phosphor-react';
import styles from './Settings.module.css';

const Settings = ({ isOpen, onClose, settings, updateSettings }) => {
    if (!isOpen) return null;

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
                            className={styles.input}
                            value={settings.sessionWarnTabs}
                            onChange={(e) => updateSettings({ sessionWarnTabs: parseInt(e.target.value) || 0 })}
                        />
                    </div>

                    <div className={styles.row}>
                        <div>
                            <div className={styles.label}>Session size threshold (MB)</div>
                            <div className={styles.description}>Warn me if total session size exceeds this limit</div>
                        </div>
                        <input
                            type="number"
                            className={styles.input}
                            value={settings.sessionWarnSize}
                            onChange={(e) => updateSettings({ sessionWarnSize: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                </div>

                {/* Clear Session */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Data Management</h3>
                    <div className={styles.row}>
                        <div>
                            <div className={styles.label}>Clear saved session</div>
                            <div className={styles.description}>Remove all saved tabs and session data</div>
                        </div>
                        <button className={`${styles.button} ${styles.danger}`}>
                            Clear Session Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
