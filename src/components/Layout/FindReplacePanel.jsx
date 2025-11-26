import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './FindReplacePanel.module.css';

const FindReplacePanel = ({ onClose, onFind, onReplace, onReplaceAll, initialMode = 'find' }) => {
    const [mode, setMode] = useState(initialMode);
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [useRegex, setUseRegex] = useState(false);
    const [currentMatch, setCurrentMatch] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);
    const findInputRef = useRef(null);

    useEffect(() => {
        findInputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (findText) {
            const result = onFind(findText, { caseSensitive, useRegex, direction: 'current' });
            setCurrentMatch(result.current);
            setTotalMatches(result.total);
        } else {
            setCurrentMatch(0);
            setTotalMatches(0);
        }
    }, [findText, caseSensitive, useRegex]);

    const handleFindNext = () => {
        const result = onFind(findText, { caseSensitive, useRegex, direction: 'next' });
        setCurrentMatch(result.current);
        setTotalMatches(result.total);
    };

    const handleFindPrevious = () => {
        const result = onFind(findText, { caseSensitive, useRegex, direction: 'previous' });
        setCurrentMatch(result.current);
        setTotalMatches(result.total);
    };

    const handleReplace = () => {
        onReplace(replaceText);
        const result = onFind(findText, { caseSensitive, useRegex, direction: 'current' });
        setCurrentMatch(result.current);
        setTotalMatches(result.total);
    };

    const handleReplaceAll = () => {
        const count = onReplaceAll(findText, replaceText, { caseSensitive, useRegex });
        setCurrentMatch(0);
        setTotalMatches(0);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'Enter') {
            if (e.shiftKey) {
                handleFindPrevious();
            } else {
                handleFindNext();
            }
        }
    };

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${mode === 'find' ? styles.activeTab : ''}`}
                        onClick={() => setMode('find')}
                    >
                        Find
                    </button>
                    <button
                        className={`${styles.tab} ${mode === 'replace' ? styles.activeTab : ''}`}
                        onClick={() => setMode('replace')}
                    >
                        Replace
                    </button>
                </div>
                <button className={styles.closeButton} onClick={onClose} title="Close (Esc)">
                    <X size={16} />
                </button>
            </div>

            <div className={styles.content}>
                <div className={styles.inputRow}>
                    <input
                        ref={findInputRef}
                        type="text"
                        className={styles.input}
                        placeholder="Find"
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className={styles.matchCounter}>
                        {findText && `${currentMatch}/${totalMatches}`}
                    </div>
                    <button
                        className={styles.navButton}
                        onClick={handleFindPrevious}
                        disabled={!findText || totalMatches === 0}
                        title="Previous match (Shift+Enter)"
                    >
                        <ChevronUp size={16} />
                    </button>
                    <button
                        className={styles.navButton}
                        onClick={handleFindNext}
                        disabled={!findText || totalMatches === 0}
                        title="Next match (Enter)"
                    >
                        <ChevronDown size={16} />
                    </button>
                </div>

                {mode === 'replace' && (
                    <>
                        <div className={styles.inputRow}>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Replace"
                                value={replaceText}
                                onChange={(e) => setReplaceText(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                className={styles.actionButton}
                                onClick={handleReplace}
                                disabled={!findText || totalMatches === 0}
                            >
                                Replace
                            </button>
                            <button
                                className={styles.actionButton}
                                onClick={handleReplaceAll}
                                disabled={!findText || totalMatches === 0}
                            >
                                Replace All
                            </button>
                        </div>
                    </>
                )}

                <div className={styles.options}>
                    <label className={styles.option}>
                        <input
                            type="checkbox"
                            checked={caseSensitive}
                            onChange={(e) => setCaseSensitive(e.target.checked)}
                        />
                        <span>Match case</span>
                    </label>
                    <label className={styles.option}>
                        <input
                            type="checkbox"
                            checked={useRegex}
                            onChange={(e) => setUseRegex(e.target.checked)}
                        />
                        <span>Use regex</span>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default FindReplacePanel;
