import { useSession } from '../context/SessionContext';
import { fileSystem } from '../utils/fileSystem';

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

    const openFile = async () => {
        try {
            const file = await fileSystem.openFile();
            if (file) {
                createTab({
                    title: file.name,
                    content: file.content,
                    filePath: file.name,
                    fileHandle: file.handle,
                    isDirty: false
                });
            }
        } catch (error) {
            console.error("Failed to open file", error);
        }
    };

    const saveFile = async () => {
        const tab = tabs.find(t => t.id === activeTabId);
        if (!tab) return;

        if (tab.fileHandle) {
            try {
                await fileSystem.saveFile(tab.fileHandle, tab.content);
                updateTab(activeTabId, { isDirty: false });
            } catch (error) {
                console.error("Failed to save file", error);
            }
        } else {
            saveFileAs();
        }
    };

    const saveFileAs = async () => {
        const tab = tabs.find(t => t.id === activeTabId);
        if (!tab) return;

        try {
            const result = await fileSystem.saveFileAs(tab.content, tab.title);
            if (result) {
                updateTab(activeTabId, {
                    title: result.name,
                    filePath: result.name,
                    fileHandle: result.handle,
                    isDirty: false
                });
            }
        } catch (error) {
            console.error("Failed to save file as", error);
        }
    };

    return {
        newTab,
        openFile,
        saveFile,
        saveFileAs,
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
