import React from 'react';
import { Sun, Moon } from 'lucide-react';
import styles from './MenuBar.module.css';

const MenuBar = ({ theme, toggleTheme }) => {
    return (
        <div className={styles.menuBar}>
            <div className={styles.menuItems}>
                <div className={styles.menuItem}>File</div>
                <div className={styles.menuItem}>Edit</div>
            </div>
            <button className={styles.themeToggle} onClick={toggleTheme} title="Toggle Theme">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
        </div>
    );
};

export default MenuBar;
