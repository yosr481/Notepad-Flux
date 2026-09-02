/**
 * Centralized Dialog Service
 * Abstracts the implementation of dialogs to allow for easy replacement
 * with native Electron dialogs or custom UI components in the future.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import MessageBox from '../components/Layout/MessageBox.jsx';

export const dialogs = {
    /**
     * Show a confirmation dialog using the design-system MessageBox.
     * @param {string|object} arg - Plain string message or options object
     * @param {string} [arg.title] - Dialog title
     * @param {string} [arg.message] - Dialog message
     * @param {string} [arg.confirmLabel='OK'] - Label for confirm button
     * @param {string} [arg.cancelLabel='Cancel'] - Label for cancel button
     * @param {boolean} [arg.danger=false] - Mark confirm button as destructive
     * @returns {Promise<boolean>} - True if confirmed, false if cancelled/escaped
     */
    confirm(arg) {
        const opts = typeof arg === 'string' ? { message: arg } : (arg || {});
        const { title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false } = opts;

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
                    primaryLabel: confirmLabel,
                    cancelLabel,
                    secondaryLabel: null,
                    danger,
                    onPrimary: () => handleClose(true),
                    onCancel: () => handleClose(false)
                })
            );
        });
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
