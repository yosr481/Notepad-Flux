import React from 'react';
import styles from './Tabs.module.css';

const Tab = ({ id, title, isActive, isDirty, onClick, onClose, onContextMenu }) => {
    const handleClose = (e) => {
        e.stopPropagation();
        onClose(id);
    };

    return (
        <div
            className={`${styles.tab} ${isActive ? styles.activeTab : ''} ${isDirty ? styles.unsavedTab : ''}`}
            onClick={() => onClick(id)}
            onContextMenu={(e) => onContextMenu(e, id)}
            title={title}
        >
            <div className={styles.tabContent}>
                <span className={styles.tabTitle}>
                    {isDirty ? '*' : ''} {title}
                </span>
                <button className={styles.closeButton} onClick={handleClose}>
                    ×
                </button>
            </div>
        </div>
    );
};

export default Tab;
