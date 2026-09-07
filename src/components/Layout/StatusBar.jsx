import React from 'react';
import styles from './StatusBar.module.css';

const StatusBar = ({ stats, appVersion, eol = 'LF', charset = 'UTF-8' }) => {
    const { line, col, wordCount, charCount } = stats;

    return (
        <div className={styles.statusBar}>
            {appVersion && (
                <div className={styles.statusVersion}>
                    v{appVersion}
                </div>
            )}
            <div className={`${styles.statusItem} ${styles.primaryItem}`}>
                Ln {line}, Col {col}
            </div>
            <div className={styles.statusItem}>
                {wordCount} words
            </div>
            <div className={styles.statusItem}>
                {charCount} chars
            </div>
            <div className={styles.statusItem}>
                {eol}
            </div>
            <div className={styles.statusItem}>
                {charset}
            </div>
        </div>
    );
};

export default StatusBar;
