import React, { useEffect, useRef } from 'react';
import styles from './ContextMenu.module.css';

const ContextMenu = ({ x, y, options, onClose }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className={styles.contextMenu}
            style={{ top: y, left: x }}
        >
            {options.map((option, index) => (
                <div
                    key={index}
                    className={styles.menuItem}
                    onClick={() => {
                        option.onClick();
                        onClose();
                    }}
                >
                    {option.label}
                </div>
            ))}
        </div>
    );
};

export default ContextMenu;
