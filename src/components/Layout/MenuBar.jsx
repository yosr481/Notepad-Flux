import React from 'react';
import { Sun, Moon } from 'lucide-react';

const MenuBar = ({ theme, toggleTheme }) => {
    return (
        <div className="menu-bar">
            <div className="menu-items">
                <div className="menu-item">File</div>
                <div className="menu-item">Edit</div>
                <div className="menu-item">View</div>
            </div>
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
        </div>
    );
};

export default MenuBar;
