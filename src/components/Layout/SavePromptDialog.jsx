import React, { useEffect, useRef } from 'react';
import { X } from 'phosphor-react';
import styles from './SavePromptDialog.module.css';

const SavePromptDialog = ({ fileName, onSave, onDontSave, onCancel }) => {
    const saveButtonRef = useRef(null);

    useEffect(() => {
        saveButtonRef.current?.focus();
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div className={styles.overlay} onClick={onCancel} onKeyDown={handleKeyDown}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3 className={styles.title}>Unsaved Changes</h3>
                    <button className={styles.closeButton} onClick={onCancel} title="Cancel (Esc)">
                        <X size={16} />
                    </button>
                </div>

                <div className={styles.content}>
                    Do you want to save changes to <span className={styles.fileName}>{fileName || 'Untitled'}</span>?
                </div>

                <div className={styles.footer}>
                    <button
                        className={`${styles.button} ${styles.primaryButton}`}
                        onClick={onSave}
                        ref={saveButtonRef}
                    >
                        Save
                    </button>
                    <button
                        className={`${styles.button} ${styles.dangerButton}`}
                        onClick={onDontSave}
                    >
                        Don't Save
                    </button>
                    <button
                        className={`${styles.button} ${styles.secondaryButton}`}
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SavePromptDialog;
