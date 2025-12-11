import React from 'react';
import { X } from 'phosphor-react';
import styles from './Tabs.module.css';

const Tab = React.forwardRef(({ id, title, isActive, isDirty, onClick, onClose, onContextMenu, style, attributes, listeners }, ref) => {
    const handleClose = (e) => {
        e.stopPropagation();
        onClose(id);
    };

    return (
        <div
            ref={ref}
            style={style}
            {...attributes}
            {...listeners}
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
                    <button className={styles.closeButton} onClick={handleClose} onPointerDown={(e) => e.stopPropagation()}>
                        <X />
                    </button>
                </div>
            </div>
        </div>
    );
});

Tab.displayName = 'Tab';

export default Tab;
