import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import styles from './MenuBar.module.css';

const MenuBar = ({ theme, toggleTheme, onUndo, onRedo, onCut, onCopy, onPaste, onDelete, onSelectAll, onFind, onReplace, onGoToLine, onInsertDateTime, onNewTab, onNewWindow, onOpen, onSave, onSaveAs, onCloseTab, onCloseWindow, onExit }) => {
    const [activeMenu, setActiveMenu] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setActiveMenu(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleMenuClick = (menuName) => {
        setActiveMenu(activeMenu === menuName ? null : menuName);
    };

    return (
        <div className={styles.menuBar} ref={menuRef}>
            <div className={styles.menuItems}>
                <div className={styles.menuItemWrapper}>
                    <div
                        className={`${styles.menuItem} ${activeMenu === 'file' ? styles.active : ''}`}
                        onClick={() => handleMenuClick('file')}
                    >
                        File
                    </div>
                    {activeMenu === 'file' && (
                        <div className={styles.dropdown}>
                            <div className={styles.dropdownItem} onClick={() => { onNewTab(); handleMenuClick('file'); }}>
                                <span>New Tab</span>
                                <span className={styles.shortcut}>Ctrl+N</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onNewWindow(); handleMenuClick('file'); }}>
                                <span>New Window</span>
                                <span className={styles.shortcut}>Ctrl+Shift+N</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onOpen(); handleMenuClick('file'); }}>
                                <span>Open...</span>
                                <span className={styles.shortcut}>Ctrl+O</span>
                            </div>
                            <div className={styles.separator}></div>
                            <div className={styles.dropdownItem} onClick={() => { onSave(); handleMenuClick('file'); }}>
                                <span>Save</span>
                                <span className={styles.shortcut}>Ctrl+S</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onSaveAs(); handleMenuClick('file'); }}>
                                <span>Save As...</span>
                                <span className={styles.shortcut}>Ctrl+Shift+S</span>
                            </div>
                            <div className={styles.separator}></div>
                            <div className={styles.dropdownItem} onClick={() => { onCloseTab(); handleMenuClick('file'); }}>
                                <span>Close Tab</span>
                                <span className={styles.shortcut}>Ctrl+W</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onCloseWindow(); handleMenuClick('file'); }}>
                                <span>Close Window</span>
                                <span className={styles.shortcut}>Alt+F4</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onExit(); handleMenuClick('file'); }}>
                                <span>Exit</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className={styles.menuItemWrapper}>
                    <div
                        className={`${styles.menuItem} ${activeMenu === 'edit' ? styles.active : ''}`}
                        onClick={() => handleMenuClick('edit')}
                    >
                        Edit
                    </div>
                    {activeMenu === 'edit' && (
                        <div className={styles.dropdown}>
                            <div className={styles.dropdownItem} onClick={() => { onUndo(); handleMenuClick('edit'); }}>
                                <span>Undo</span>
                                <span className={styles.shortcut}>Ctrl+Z</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onRedo(); handleMenuClick('edit'); }}>
                                <span>Redo</span>
                                <span className={styles.shortcut}>Ctrl+Y</span>
                            </div>
                            <div className={styles.separator}></div>
                            <div className={styles.dropdownItem} onClick={() => { onCut(); handleMenuClick('edit'); }}>
                                <span>Cut</span>
                                <span className={styles.shortcut}>Ctrl+X</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onCopy(); handleMenuClick('edit'); }}>
                                <span>Copy</span>
                                <span className={styles.shortcut}>Ctrl+C</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onPaste(); handleMenuClick('edit'); }}>
                                <span>Paste</span>
                                <span className={styles.shortcut}>Ctrl+V</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onDelete(); handleMenuClick('edit'); }}>
                                <span>Delete</span>
                                <span className={styles.shortcut}>Del</span>
                            </div>
                            <div className={styles.separator}></div>
                            <div className={styles.dropdownItem} onClick={() => { onFind(); handleMenuClick('edit'); }}>
                                <span>Find</span>
                                <span className={styles.shortcut}>Ctrl+F</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onReplace(); handleMenuClick('edit'); }}>
                                <span>Replace</span>
                                <span className={styles.shortcut}>Ctrl+H</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onGoToLine(); handleMenuClick('edit'); }}>
                                <span>Go to</span>
                                <span className={styles.shortcut}>Ctrl+G</span>
                            </div>
                            <div className={styles.separator}></div>
                            <div className={styles.dropdownItem} onClick={() => { onSelectAll(); handleMenuClick('edit'); }}>
                                <span>Select All</span>
                                <span className={styles.shortcut}>Ctrl+A</span>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onInsertDateTime(); handleMenuClick('edit'); }}>
                                <span>Insert date/time</span>
                                <span className={styles.shortcut}>F5</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <button className={styles.themeToggle} onClick={toggleTheme} title="Toggle Theme">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
        </div>
    );
};

export default MenuBar;
