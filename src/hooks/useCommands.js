import { useSession } from '../context/SessionContext';

export const useCommands = () => {
    const {
        tabs,
        activeTabId,
        setActiveTabId,
        createTab,
        closeTab: closeTabInContext,
        updateTab,
        switchTab,
        setTabs
    } = useSession();

    const newTab = () => {
        createTab();
    };

    const closeTab = (id) => {
        const tab = tabs.find(t => t.id === id);
        if (!tab) return;

        if (tab.isDirty) {
            if (!window.confirm(`Save changes to ${tab.title}?`)) {
                return;
            }
            // TODO: Implement Save logic
        }

        // Logic to determine next active tab
        if (tabs.length === 1) {
            // Closing the last tab -> Create new one, then close old
            createTab();
            closeTabInContext(id);
        } else {
            if (activeTabId === id) {
                const index = tabs.findIndex(t => t.id === id);
                // Try to go to the right, else left
                const nextTab = tabs[index + 1] || tabs[index - 1];
                if (nextTab) {
                    setActiveTabId(nextTab.id);
                }
            }
            closeTabInContext(id);
        }
    };

    const closeOtherTabs = (id) => {
        const tabsToClose = tabs.filter(t => t.id !== id);

        // Check for dirty tabs
        for (const tab of tabsToClose) {
            if (tab.isDirty) {
                if (!window.confirm(`Save changes to ${tab.title}?`)) {
                    return; // Cancel entire operation
                }
            }
        }

        setTabs([tabs.find(t => t.id === id)]);
        setActiveTabId(id);
    };

    const closeTabsToRight = (id) => {
        const index = tabs.findIndex(t => t.id === id);
        if (index === -1) return;

        const tabsToClose = tabs.slice(index + 1);

        for (const tab of tabsToClose) {
            if (tab.isDirty) {
                if (!window.confirm(`Save changes to ${tab.title}?`)) {
                    return;
                }
            }
        }

        const newTabs = tabs.slice(0, index + 1);
        setTabs(newTabs);
        // The active tab might have been one of the closed ones, or the current one.
        // If active tab was to the right, switch to the 'id' tab.
        if (!newTabs.find(t => t.id === activeTabId)) {
            setActiveTabId(id);
        }
    };

    return {
        newTab,
        closeTab,
        closeOtherTabs,
        closeTabsToRight,
        switchTab,
        updateTab,
        setActiveTabId,
        activeTabId,
        tabs
    };
};
