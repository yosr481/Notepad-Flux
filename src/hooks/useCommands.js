import React from 'react';
import { useSession } from '../context/SessionContext';
import { fileSystem } from '../utils/fileSystem';
import { marked } from 'marked';
import { exportToHtml } from '../utils/export';
import { createRoot } from 'react-dom/client';
import PrintDocument from '../components/Print/PrintDocument';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const useCommands = () => {
    const {
        tabs,
        activeTabId,
        setActiveTabId,
        createTab,
        closeTab: closeTabInContext,
        updateTab,
        switchTab,
        reorderTabs,
        setTabs,
        recentFiles,
        addRecentFile,
        isPrimaryWindow
    } = useSession();

    const newTab = () => {
        createTab();
    };

    const closeTab = async (id, editorRef) => {
        const tab = tabs.find(t => t.id === id);
        if (!tab) return;

        if (tab.isDirty) {
            const shouldSave = window.confirm(`Save changes to ${tab.title}?`);
            if (shouldSave) {
                const content = editorRef?.current?.getCurrentContent() || tab.content;

                try {
                    if (tab.fileHandle) {
                        await fileSystem.saveFile(tab.fileHandle, content);
                        updateTab(id, { content, isDirty: false });
                    } else if (!fileSystem.isSupported() && tab.filePath) {
                        const result = await fileSystem.saveFileAs(content, tab.filePath);
                        if (!result) return;
                        updateTab(id, { content, isDirty: false });
                    } else {
                        const result = await fileSystem.saveFileAs(content, tab.title);
                        if (!result) return;
                        updateTab(id, {
                            title: result.name,
                            filePath: result.name,
                            fileHandle: result.handle,
                            content: content,
                            isDirty: false
                        });
                    }
                } catch (error) {
                    console.error("Failed to save file on close", error);
                    return;
                }
            }
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

    const closeOtherTabs = async (id, editorRef) => {
        const tabsToClose = tabs.filter(t => t.id !== id);

        for (const tab of tabsToClose) {
            if (tab.isDirty) {
                const shouldSave = window.confirm(`Save changes to ${tab.title}?`);
                if (shouldSave) {
                    const content = tab.content;

                    try {
                        if (tab.fileHandle) {
                            await fileSystem.saveFile(tab.fileHandle, content);
                            updateTab(tab.id, { content, isDirty: false });
                        } else if (!fileSystem.isSupported() && tab.filePath) {
                            const result = await fileSystem.saveFileAs(content, tab.filePath);
                            if (!result) return;
                            updateTab(tab.id, { content, isDirty: false });
                        } else {
                            const result = await fileSystem.saveFileAs(content, tab.title);
                            if (!result) return;
                            updateTab(tab.id, {
                                title: result.name,
                                filePath: result.name,
                                fileHandle: result.handle,
                                content: content,
                                isDirty: false
                            });
                        }
                    } catch (error) {
                        console.error("Failed to save file on close", error);
                        return;
                    }
                }
            }
        }

        setTabs([tabs.find(t => t.id === id)]);
        setActiveTabId(id);
    };

    const closeTabsToRight = async (id, editorRef) => {
        const index = tabs.findIndex(t => t.id === id);
        if (index === -1) return;

        const tabsToClose = tabs.slice(index + 1);

        for (const tab of tabsToClose) {
            if (tab.isDirty) {
                const shouldSave = window.confirm(`Save changes to ${tab.title}?`);
                if (shouldSave) {
                    const content = tab.content;

                    try {
                        if (tab.fileHandle) {
                            await fileSystem.saveFile(tab.fileHandle, content);
                            updateTab(tab.id, { content, isDirty: false });
                        } else if (!fileSystem.isSupported() && tab.filePath) {
                            const result = await fileSystem.saveFileAs(content, tab.filePath);
                            if (!result) return;
                            updateTab(tab.id, { content, isDirty: false });
                        } else {
                            const result = await fileSystem.saveFileAs(content, tab.title);
                            if (!result) return;
                            updateTab(tab.id, {
                                title: result.name,
                                filePath: result.name,
                                fileHandle: result.handle,
                                content: content,
                                isDirty: false
                            });
                        }
                    } catch (error) {
                        console.error("Failed to save file on close", error);
                        return;
                    }
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
                // Add to recent files with handle
                addRecentFile(file.name, file.name, file.handle);
            }
        } catch (error) {
            console.error("Failed to open file", error);
        }
    };

    const saveFile = async (editorRef) => {
        const tab = tabs.find(t => t.id === activeTabId);
        if (!tab) return;

        // Get current content from editor
        const content = editorRef?.current?.getCurrentContent() || tab.content;

        if (tab.fileHandle) {
            // We have a handle - use it to save directly (Chrome/Edge)
            try {
                await fileSystem.saveFile(tab.fileHandle, content);
                updateTab(activeTabId, { content, isDirty: false });
            } catch (error) {
                console.error("Failed to save file", error);
            }
        } else if (!fileSystem.isSupported() && tab.filePath) {
            // In fallback mode (Firefox) with an existing file, just download again with same name
            try {
                const result = await fileSystem.saveFileAs(content, tab.filePath);
                if (result) {
                    updateTab(activeTabId, { content, isDirty: false });
                }
            } catch (error) {
                console.error("Failed to save file", error);
            }
        } else {
            // No handle and no existing file, or first save - open Save As dialog
            saveFileAs(editorRef);
        }
    };

    const saveFileAs = async (editorRef) => {
        const tab = tabs.find(t => t.id === activeTabId);
        if (!tab) return;

        // Get current content from editor
        const content = editorRef?.current?.getCurrentContent() || tab.content;

        try {
            const result = await fileSystem.saveFileAs(content, tab.title);
            if (result) {
                updateTab(activeTabId, {
                    title: result.name,
                    filePath: result.name,
                    fileHandle: result.handle,
                    content: content,
                    isDirty: false
                });
                // Add to recent files with handle
                addRecentFile(result.name, result.name, result.handle);
            }
        } catch (error) {
            console.error("Failed to save file as", error);
        }
    };

    const openRecentFile = async (filePath, fileName, fileHandle) => {
        try {
            // Try to open from file handle first
            let file = null;
            if (fileHandle && fileSystem.isSupported()) {
                try {
                    file = await fileSystem.openFileFromHandle(fileHandle);
                } catch (err) {
                    console.warn(`Could not open from handle, fallback to picker:`, err);
                    file = null;
                }
            }

            // Fallback: open file picker if handle doesn't work
            if (!file) {
                file = await fileSystem.openFile();
                if (!file) {
                    window.alert(`Could not open file "${fileName}". The file may have been moved or deleted.`);
                    return;
                }
            }

            if (file) {
                createTab({
                    title: file.name,
                    content: file.content,
                    filePath: file.name,
                    fileHandle: file.handle,
                    isDirty: false
                });
                // Add to recent files with updated handle
                addRecentFile(file.name, file.name, file.handle);
            }
        } catch (error) {
            console.error(`Failed to open recent file: ${fileName}`, error);
            window.alert(`Could not open file "${fileName}". The file may have been moved or deleted.`);
        }
    };

    const exportToPDF = (
    ) => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) return;

        const printContainer = document.createElement('div');
        printContainer.id = 'print-container';
        document.body.appendChild(printContainer);

        const root = createRoot(printContainer);
        const content = React.createElement(PrintDocument, { title: activeTab.title, content: activeTab.content });
        root.render(content);

        requestIdleCallback(async () => {
            const canvas = await html2canvas(printContainer, {
                scale: 2, // Higher resolution
            });
            const imgData = canvas.toDataURL('image/png');

            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
            const imgWidth = pdfWidth;
            const imgHeight = imgWidth / ratio;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            const pdfBlob = pdf.output('blob');
            await fileSystem.exportFile(pdfBlob, `${activeTab.title.replace(/\s/g, '_')}.pdf`, [
                {
                    description: 'PDF Document',
                    accept: { 'application/pdf': ['.pdf'] },
                },
            ]);

            root.unmount();
            document.body.removeChild(printContainer);
        });
    };

    const exportToHTML = () => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) return;
        exportToHtml(activeTab.title, activeTab.content);
    };

    const print = () => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) return;

        const printContainer = document.createElement('div');
        printContainer.id = 'print-container';
        document.body.appendChild(printContainer);

        const root = createRoot(printContainer);
        root.render(
            React.createElement(PrintDocument, { title: activeTab.title, content: activeTab.content })
        );

        requestIdleCallback(() => {
            window.print();
            root.unmount();
            document.body.removeChild(printContainer);
        });
    };

    const closeWindow = async (editorRef) => {
        if (!isPrimaryWindow) {
            const dirtyTabs = tabs.filter(t => t.isDirty);
            if (dirtyTabs.length > 0) {
                const confirmMsg = `You have ${dirtyTabs.length} unsaved tab${dirtyTabs.length > 1 ? 's' : ''}. Do you want to save your changes before closing?`;
                // We can't easily use a custom dialog here without blocking, so we use confirm.
                // A better UX might be a custom modal, but for now window.confirm is consistent with closeTab.
                // However, standard confirm is OK/Cancel. We need Save/Don't Save/Cancel.
                // Browser confirm doesn't support 3 options.
                // Let's use a simple flow: "Save changes?" -> OK=Save, Cancel=Don't Save? No, Cancel usually means abort.
                // Let's try: "Unsaved changes. Click OK to Save and Close, Cancel to Close without saving?" - No that's dangerous.
                // Let's stick to the browser standard: "Leave site? Changes you made may not be saved." logic via beforeunload for the X button.
                // For the menu button, we can be smarter.

                // Let's assume we want to offer saving.
                if (window.confirm('You have unsaved changes. Save them now?')) {
                    // Try to save all dirty tabs
                    for (const tab of dirtyTabs) {
                        // Logic similar to closeTab save
                        // We need to activate the tab to get editor content? 
                        // Actually tab.content might be stale if editor has changes not yet synced?
                        // onContentChange syncs to tab.content, so tab.content should be up to date.

                        try {
                            if (tab.fileHandle) {
                                await fileSystem.saveFile(tab.fileHandle, tab.content);
                            } else if (!fileSystem.isSupported() && tab.filePath) {
                                await fileSystem.saveFileAs(tab.content, tab.filePath);
                            } else {
                                const result = await fileSystem.saveFileAs(tab.content, tab.title);
                                if (result) {
                                    // Update tab just in case, though we are closing
                                    updateTab(tab.id, { ...result, isDirty: false });
                                } else {
                                    // User cancelled save dialog for a file
                                    return; // Abort close
                                }
                            }
                        } catch (err) {
                            console.error('Failed to save', err);
                            return; // Abort close
                        }
                    }
                } else {
                    // User said No to "Save them now?". 
                    // Does that mean "Don't Save" or "Cancel"?
                    // Usually "Cancel" means "Oops, I didn't mean to close".
                    // But standard confirm is binary.
                    // Let's ask: "Are you sure you want to close without saving?" if they say No to saving.
                    if (!window.confirm('Close without saving?')) {
                        return;
                    }
                }
            }
        }
        window.close();
    };

    return {
        newTab,
        openFile,
        openRecentFile,
        saveFile,
        saveFileAs,
        exportToPDF,
        exportToHTML,
        print,
        closeTab,
        closeOtherTabs,
        closeTabsToRight,
        switchTab,
        updateTab,
        setActiveTabId,
        activeTabId,
        tabs,
        reorderTabs,
        recentFiles,
        closeWindow,
        isPrimaryWindow
    };
};
