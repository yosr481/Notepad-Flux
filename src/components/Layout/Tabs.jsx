import React, { useRef, useState, useEffect } from 'react';
import Tab from './Tab';
import styles from './Tabs.module.css';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableTab = ({ tab, isActive, onClick, onClose, onContextMenu }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: tab.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto',
        position: 'relative'
    };

    return (
        <Tab
            ref={setNodeRef}
            style={style}
            attributes={attributes}
            listeners={listeners}
            id={tab.id}
            title={tab.title}
            isActive={isActive}
            isDirty={tab.isDirty}
            onClick={onClick}
            onClose={onClose}
            onContextMenu={onContextMenu}
        />
    );
};

const Tabs = ({ tabs, activeTabId, onTabClick, onTabClose, onNewTab, onContextMenu, onReorder, appVersion }) => {
    const listRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            onReorder(active.id, over.id);
        }
    };

    return (
        <div className={styles.tabsContainer}>
            <img
                src="icons/web/favicon-32x32.png"
                alt="App Icon"
                className={styles.appIcon}
                draggable="false"
            />
            {appVersion && (
                <span className={styles.versionBadge}>v{appVersion}</span>
            )}
            {showLeftArrow && (
                <button className={styles.scrollButton} onClick={() => scroll('left')}>
                    ‹
                </button>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div
                    className={styles.tabsList}
                    ref={listRef}
                    onScroll={checkScroll}
                >
                    <SortableContext
                        items={tabs.map(t => t.id)}
                        strategy={horizontalListSortingStrategy}
                    >
                        {tabs.map(tab => (
                            <SortableTab
                                key={tab.id}
                                tab={tab}
                                isActive={tab.id === activeTabId}
                                onClick={onTabClick}
                                onClose={onTabClose}
                                onContextMenu={onContextMenu}
                            />
                        ))}
                    </SortableContext>
                </div>
            </DndContext>

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
