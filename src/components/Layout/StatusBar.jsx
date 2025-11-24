import React from 'react';
import styles from './StatusBar.module.css';

const StatusBar = ({ stats }) => {
    const { line, col, wordCount, charCount } = stats;

    return (
        <div className={styles.statusBar}>
            <div className={styles.statusItem}>
                Ln {line}, Col {col}
            </div>
            <div className={styles.statusItem}>
                {wordCount} words
            </div>
            <div className={styles.statusItem}>
                {charCount} chars
            </div>
            <div className={styles.statusItem}>
                100%
            </div>
            <div className={styles.statusItem}>
                Windows (CRLF)
            </div>
            <div className={styles.statusItem}>
                UTF-8
            </div>
        </div>
    );
};

export default StatusBar;
