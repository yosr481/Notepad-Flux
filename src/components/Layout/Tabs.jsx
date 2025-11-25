import React, { useRef, useState, useEffect } from 'react';
import Tab from './Tab';
import styles from './Tabs.module.css';

const Tabs = ({ tabs, activeTabId, onTabClick, onTabClose, onNewTab, onContextMenu }) => {
    const listRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    const checkScroll = () => {
        if (listRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = listRef.current;
            setShowLeftArrow(scrollLeft > 0);
            setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
        }
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, [tabs]);

    const scroll = (direction) => {
        if (listRef.current) {
            const scrollAmount = 200;
            listRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
            setTimeout(checkScroll, 300);
        }
    };

    return (
        <div className={styles.tabsContainer}>
            {showLeftArrow && (
                <button className={styles.scrollButton} onClick={() => scroll('left')}>
                    ‹
                </button>
            )}

            <div
                className={styles.tabsList}
                ref={listRef}
                onScroll={checkScroll}
            >
                {tabs.map(tab => (
                    <Tab
                        key={tab.id}
                        id={tab.id}
                        title={tab.title}
                        isActive={tab.id === activeTabId}
                        isDirty={tab.isDirty}
                        onClick={onTabClick}
                        onClose={onTabClose}
                        onContextMenu={onContextMenu}
                    />
                ))}
            </div>

            {showRightArrow && (
                <button className={styles.scrollButton} onClick={() => scroll('right')}>
                    ›
                </button>
            )}

            <button className={styles.newTabButton} onClick={onNewTab} title="New Tab (Ctrl+N)">
                +
            </button>
        </div>
    );
};

export default Tabs;
