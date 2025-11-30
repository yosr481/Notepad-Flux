/**
 * Centralized Dialog Service
 * Abstracts the implementation of dialogs to allow for easy replacement
 * with native Electron dialogs or custom UI components in the future.
 */

export const dialogs = {
    /**
     * Show a confirmation dialog.
     * @param {string} message - The message to display.
     * @returns {Promise<boolean>} - True if confirmed (OK/Yes), false otherwise.
     */
    confirm: async (message) => {
        // In the future, check for Electron context:
        // if (window.electron) return await window.electron.dialog.showMessageBox(...)

        return window.confirm(message);
    },

    /**
     * Show an alert dialog.
     * @param {string} message - The message to display.
     * @returns {Promise<void>}
     */
    alert: async (message) => {
        // if (window.electron) ...
        return window.alert(message);
    }
};
