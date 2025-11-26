import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import styles from './GoToLineDialog.module.css';

const GoToLineDialog = ({ onClose, onGoToLine, totalLines }) => {
    const [lineNumber, setLineNumber] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        const num = parseInt(lineNumber, 10);
        if (!isNaN(num) && num > 0 && num <= totalLines) {
            onGoToLine(num);
            onClose();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3 className={styles.title}>Go to Line</h3>
                    <button className={styles.closeButton} onClick={onClose} title="Close (Esc)">
                        <X size={16} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className={styles.content}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>
                            Line number (1-{totalLines}):
                        </label>
                        <input
                            ref={inputRef}
                            type="number"
                            min="1"
                            max={totalLines}
                            className={styles.input}
                            value={lineNumber}
                            onChange={(e) => setLineNumber(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={styles.goButton}
                            disabled={!lineNumber || parseInt(lineNumber) < 1 || parseInt(lineNumber) > totalLines}
                        >
                            Go
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GoToLineDialog;
