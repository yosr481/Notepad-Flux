/**
 * Centralized Dialog Service
 * Abstracts the implementation of dialogs to allow for easy replacement
 * with native Electron dialogs or custom UI components in the future.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

// Lazy import to avoid bundling cost unless needed
let MessageBox = null;

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
    },

    /**
     * Show a tri-state save changes prompt using the app design system.
     * Returns one of: 'save' | 'dontsave' | 'cancel'
     * @param {object} options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Dialog message
     * @param {string} [options.primaryLabel] - Label for Save button
     * @param {string} [options.secondaryLabel] - Label for Don't Save button
     * @param {string} [options.cancelLabel] - Label for Cancel button
     * @returns {Promise<'save'|'dontsave'|'cancel'>}
     */
    saveChangesPrompt: async ({ title, message, primaryLabel = 'Save', secondaryLabel = "Don't Save", cancelLabel = 'Cancel' }) => {
        // Dynamic import to avoid circular deps
        if (!MessageBox) {
            // eslint-disable-next-line no-undef
            MessageBox = (await import('../components/Layout/MessageBox.jsx')).default;
        }

        return new Promise((resolve) => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const root = createRoot(container);

            const handleClose = (result) => {
                try {
                    root.unmount();
                } catch (_err) {
                    // noop: unmount can throw if already unmounted
                }
                container.remove();
                resolve(result);
            };

            root.render(
                React.createElement(MessageBox, {
                    title,
                    message,
                    primaryLabel,
                    secondaryLabel,
                    cancelLabel,
                    onPrimary: () => handleClose('save'),
                    onSecondary: () => handleClose('dontsave'),
                    onCancel: () => handleClose('cancel')
                })
            );
        });
    }
};
