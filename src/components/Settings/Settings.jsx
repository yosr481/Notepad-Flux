import React, { useState } from 'react';
import { ArrowLeft } from 'phosphor-react';
import styles from './Settings.module.css';

const Settings = ({ isOpen, onClose, settings, updateSettings }) => {
    const [errors, setErrors] = useState({});

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
        updateSettings({ [key]: isNaN(num) ? 0 : num });
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
