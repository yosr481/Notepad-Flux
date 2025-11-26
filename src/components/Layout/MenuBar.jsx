import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import styles from './MenuBar.module.css';

const MenuBar = ({ theme, toggleTheme, onUndo, onRedo, onSelectAll }) => {
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
                <div className={styles.menuItem}>File</div>
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
                            <div className={styles.dropdownItem}>
                                <span>Cut</span>
                                <span className={styles.shortcut}>Ctrl+X</span>
                            </div>
                            <div className={styles.dropdownItem}>
                                <span>Copy</span>
                                <span className={styles.shortcut}>Ctrl+C</span>
                            </div>
                            <div className={styles.dropdownItem}>
                                <span>Paste</span>
                                <span className={styles.shortcut}>Ctrl+V</span>
                            </div>
                            <div className={styles.dropdownItem}>
                                <span>Delete</span>
                                <span className={styles.shortcut}>Del</span>
                            </div>
                            <div className={styles.separator}></div>
                            <div className={styles.dropdownItem} onClick={() => { onSelectAll(); handleMenuClick('edit'); }}>
                                <span>Select All</span>
                                <span className={styles.shortcut}>Ctrl+A</span>
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
