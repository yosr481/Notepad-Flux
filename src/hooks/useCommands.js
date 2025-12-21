import React from 'react';
import { useSession } from '../context/SessionContext';
import { fileSystem } from '../utils/fileSystem';
import { dialogs } from '../utils/dialogs';
import { exportToHtml } from '../utils/export';
import { createRoot } from 'react-dom/client';
import PrintDocument from '../components/Print/PrintDocument';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const useCommands = (showToast) => {
    const {
        tabs,
        activeTabId,
        setActiveTabId,
        createTab,
        closeTab: closeTabInContext,
        updateTab,
        switchTab,
        reorderTabs,
        recentFiles,
        addRecentFile,
        isPrimaryWindow
    } = useSession();

    const newTab = () => {
        createTab();
    };

    const closeTab = async (id, options = {}) => {
        const { skipPrompt = false } = options;
        const tab = tabs.find(t => t.id === id);
        if (!tab) return;

        if (!skipPrompt && tab.isDirty) {
            const choice = await dialogs.saveChangesPrompt({
                title: 'Save changes?',
                message: `Do you want to save changes to "${tab.title}" before closing?`
            });
            if (choice === 'cancel') return;
            if (choice === 'save') {
                const content = tab.content;
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

        if (tabs.length === 1) {
            createTab();
            closeTabInContext(id);
        } else {
            if (activeTabId === id) {
                const index = tabs.findIndex(t => t.id === id);
                const nextTab = tabs[index + 1] || tabs[index - 1];
                if (nextTab) {
                    setActiveTabId(nextTab.id);
                }
            }
            closeTabInContext(id);
        }
    };

    const closeOtherTabs = async (id) => {
        const tabsToClose = tabs.filter(t => t.id !== id);
        for (const tab of tabsToClose) {
            await closeTab(tab.id);
        }
    };

    const closeTabsToRight = async (id) => {
        const index = tabs.findIndex(t => t.id === id);
        if (index === -1) return;

        const tabsToClose = tabs.slice(index + 1);
        for (const tab of tabsToClose) {
            await closeTab(tab.id);
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
                addRecentFile(file.name, file.name, file.handle);
            }
        } catch (error) {
            console.error("Failed to open file", error);
        }
    };

    const saveFile = async (editorRef) => {
        const tab = tabs.find(t => t.id === activeTabId);
        if (!tab) return;

        const content = editorRef?.current?.getCurrentContent() || tab.content;

        if (tab.fileHandle) {
            try {
                await fileSystem.saveFile(tab.fileHandle, content);
                updateTab(activeTabId, { content, isDirty: false });
            } catch (error) {
                console.error("Failed to save file", error);
            }
        } else if (!fileSystem.isSupported() && tab.filePath) {
            try {
                const result = await fileSystem.saveFileAs(content, tab.filePath);
                if (result) {
                    updateTab(activeTabId, { content, isDirty: false });
                }
            } catch (error) {
                console.error("Failed to save file", error);
            }
        } else {
            saveFileAs(editorRef);
        }
    };

    const saveFileAs = async (editorRef) => {
        const tab = tabs.find(t => t.id === activeTabId);
        if (!tab) return;

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
                addRecentFile(result.name, result.name, result.handle);
            }
        } catch (error) {
            console.error("Failed to save file as", error);
        }
    };

    const openRecentFile = async (filePath, fileName, fileHandle) => {
        try {
            let file = null;
            if (fileHandle && fileSystem.isSupported()) {
                try {
                    file = await fileSystem.openFileFromHandle(fileHandle);
                } catch (err) {
                    console.warn(`Could not open from handle, trying filePath:`, err);
                    file = null;
                }
            }

            if (!file && filePath) {
                try {
                    file = await fileSystem.openFileFromPath(filePath);
                } catch (err) {
                    console.warn(`Could not open from filePath, falling back to picker:`, err);
                    file = null;
                }
            }
            
            if (!file) {
                file = await fileSystem.openFile();
                if (!file) {
                    await dialogs.alert(`Could not open file "${fileName}". The file may have been moved or deleted.`);
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
                addRecentFile(file.name, file.name, file.handle);
            }
        } catch (error) {
            console.error(`Failed to open recent file: ${fileName}`, error);
            await dialogs.alert(`Could not open file "${fileName}". The file may have been moved or deleted.`);
        }
    };

    const exportToPDF = async () => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) return;

        showToast('Exporting to PDF...');

        const printContainer = document.createElement('div');
        printContainer.id = 'print-container';
        document.body.appendChild(printContainer);

        const root = createRoot(printContainer);
        const content = React.createElement(PrintDocument, { title: activeTab.title, content: activeTab.content });
        root.render(content);

        await new Promise(resolve => requestIdleCallback(resolve));

        try {
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
            const success = await fileSystem.exportFile(pdfBlob, `${activeTab.title.replace(/\s/g, '_')}.pdf`, [
                {
                    description: 'PDF Document',
                    accept: { 'application/pdf': ['.pdf'] },
                },
            ]);

            if (success) {
                showToast('Exported to PDF successfully!');
            } else {
                showToast('Export to PDF cancelled.');
            }
        } catch (error) {
            console.error("Failed to export to PDF", error);
            showToast('Failed to export to PDF.');
        } finally {
            root.unmount();
            document.body.removeChild(printContainer);
        }
    };

    const exportToHTML = async () => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) return;

        showToast('Exporting to HTML...');

        try {
            const success = await exportToHtml(activeTab.title, activeTab.content);
            if (success) {
                showToast('Exported to HTML successfully!');
            } else {
                showToast('Export to HTML cancelled.');
            }
        } catch (error) {
            console.error("Failed to export to HTML", error);
            showToast('Failed to export to HTML.');
        }
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

    const closeWindow = async () => {
        if (!isPrimaryWindow) {
            // Iterate tabs and prompt/save/close one by one until only one default tab remains
            // Take a snapshot of current order to iterate deterministically
            let toProcess = [...tabs];
            for (let i = 0; i < toProcess.length; i++) {
                // Refresh current tabs length on each iteration
                if (tabs.length <= 1) break; // leave one default tab
                const tab = toProcess[i];
                // If this tab has already been closed due to side effects, skip
                const current = tabs.find(t => t.id === tab.id);
                if (!current) continue;

                if (current.isDirty) {
                    const choice = await dialogs.saveChangesPrompt({
                        title: 'Save changes?',
                        message: `Do you want to save changes to "${current.title}" before closing the window?`
                    });
                    if (choice === 'cancel') return; // abort entire close
                    if (choice === 'save') {
                        try {
                            if (current.fileHandle) {
                                await fileSystem.saveFile(current.fileHandle, current.content);
                                updateTab(current.id, { isDirty: false });
                            } else if (!fileSystem.isSupported() && current.filePath) {
                                const result = await fileSystem.saveFileAs(current.content, current.filePath);
                                if (!result) return; // aborted save-as
                                updateTab(current.id, { isDirty: false });
                            } else {
                                const result = await fileSystem.saveFileAs(current.content, current.title);
                                if (!result) return; // aborted save-as
                                updateTab(current.id, {
                                    title: result.name,
                                    filePath: result.name,
                                    fileHandle: result.handle,
                                    isDirty: false
                                });
                            }
                        } catch (err) {
                            console.error('Failed to save', err);
                            return; // abort close on error
                        }
                    }
                    // if 'dontsave', proceed without saving
                }

                await closeTab(current.id, { skipPrompt: true });
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
