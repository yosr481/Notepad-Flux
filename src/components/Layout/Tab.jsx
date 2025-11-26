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
                    {title}
                </span>
                <div className={styles.tabIndicator}>
                    {isDirty && <div className={styles.dirtyIndicator}></div>}
                    <button className={styles.closeButton} onClick={handleClose}>
                        ×
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Tab;
