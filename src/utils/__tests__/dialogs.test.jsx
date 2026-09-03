import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, act } from '@testing-library/react';
import { dialogs } from '../dialogs';

/**
 * ROUND C — dialogs.confirm -> design-system modal, Promise<boolean>.
 *
 * Pinned contract:
 *  - Signature: dialogs.confirm({ title, message, confirmLabel = 'OK',
 *    cancelLabel = 'Cancel', danger = false }) -> Promise<boolean>.
 *  - Back-compat: dialogs.confirm('some string') is treated as { message: 'some string' }.
 *  - Renders MessageBox imperatively via createRoot into a container appended
 *    to document.body (mirrors saveChangesPrompt).
 *  - Clicking the primary button resolves true.
 *  - Clicking cancel OR pressing Esc resolves false.
 *  - After resolution the mount container is removed from document.body.
 *  - It renders in 2-button mode: no secondary/"Don't Save" button.
 */

afterEach(() => {
    // Clean any leftover imperative mount containers between tests.
    document.querySelectorAll('[role="dialog"]').forEach(d => {
        const host = d.closest('body > div');
        if (host) host.remove();
    });
});

const findDialog = () =>
    document.querySelector('[role="dialog"]');

const findButtonByText = (text) =>
    [...document.querySelectorAll('[role="dialog"] button')].find(
        b => b.textContent.trim() === text
    );

const flush = () => new Promise(r => setTimeout(r, 0));

describe('dialogs.confirm — return type & mount', () => {
    it('returns a Promise', () => {
        const p = dialogs.confirm({ message: 'Proceed?' });
        expect(typeof p.then).toBe('function');
        // resolve it so the test does not leak a mounted modal
        return flush().then(() => {
            findButtonByText('OK')?.click();
            return p;
        });
    });

    it('mounts a design-system dialog (role="dialog") into document.body', async () => {
        const p = dialogs.confirm({ title: 'T', message: 'Proceed?' });
        await flush();
        expect(findDialog()).toBeTruthy();
        findButtonByText('OK').click();
        await p;
    });

    it('shows the message text', async () => {
        const p = dialogs.confirm({ message: 'Delete everything?' });
        await flush();
        expect(findDialog().textContent).toContain('Delete everything?');
        findButtonByText('OK').click();
        await p;
    });

    it('renders in 2-button mode — no "Don\'t Save"/secondary button', async () => {
        const p = dialogs.confirm({ message: 'x' });
        await flush();
        const labels = [...document.querySelectorAll('[role="dialog"] button')]
            .map(b => b.textContent.trim());
        expect(labels).toHaveLength(2);
        expect(labels).not.toContain("Don't Save");
        findButtonByText('OK').click();
        await p;
    });
});

describe('dialogs.confirm — resolution', () => {
    it('resolves true when the primary/confirm button is clicked', async () => {
        const p = dialogs.confirm({ message: 'Proceed?', confirmLabel: 'Clear' });
        await flush();
        findButtonByText('Clear').click();
        await expect(p).resolves.toBe(true);
    });

    it('resolves false when the cancel button is clicked', async () => {
        const p = dialogs.confirm({ message: 'Proceed?', cancelLabel: 'Nope' });
        await flush();
        findButtonByText('Nope').click();
        await expect(p).resolves.toBe(false);
    });

    it('resolves false when Escape is pressed', async () => {
        // MessageBox binds its keydown listener in a useEffect. Open the dialog
        // inside act() so the passive effect (listener registration) is flushed
        // before we dispatch the key event — a bare macrotask hop is racy for a
        // component mounted via raw createRoot (no RTL render()).
        let p;
        await act(async () => {
            p = dialogs.confirm({ message: 'Proceed?' });
        });
        await act(async () => {
            fireEvent.keyDown(document, { key: 'Escape' });
        });
        await expect(p).resolves.toBe(false);
    });

    it('removes the mount container from document.body after resolving true', async () => {
        const before = document.body.childElementCount;
        const p = dialogs.confirm({ message: 'Proceed?' });
        await flush();
        expect(document.body.childElementCount).toBe(before + 1);
        findButtonByText('OK').click();
        await p;
        await flush();
        expect(findDialog()).toBeNull();
        expect(document.body.childElementCount).toBe(before);
    });

    it('removes the mount container from document.body after resolving false', async () => {
        const before = document.body.childElementCount;
        const p = dialogs.confirm({ message: 'Proceed?' });
        await flush();
        findButtonByText('Cancel').click();
        await p;
        await flush();
        expect(findDialog()).toBeNull();
        expect(document.body.childElementCount).toBe(before);
    });
});

describe('dialogs.confirm — defaults & back-compat', () => {
    it('uses default labels "OK" and "Cancel"', async () => {
        const p = dialogs.confirm({ message: 'Proceed?' });
        await flush();
        expect(findButtonByText('OK')).toBeTruthy();
        expect(findButtonByText('Cancel')).toBeTruthy();
        findButtonByText('OK').click();
        await p;
    });

    it('accepts a plain string and treats it as the message', async () => {
        const p = dialogs.confirm('Just a string message');
        await flush();
        expect(findDialog()).toBeTruthy();
        expect(findDialog().textContent).toContain('Just a string message');
        findButtonByText('OK').click();
        await expect(p).resolves.toBe(true);
    });

    it('passes danger through so the confirm button is marked destructive', async () => {
        const p = dialogs.confirm({ message: 'Proceed?', confirmLabel: 'Clear', danger: true });
        await flush();
        expect(findButtonByText('Clear')).toHaveAttribute('data-danger');
        findButtonByText('Clear').click();
        await p;
    });

    it('does not mark the confirm button destructive when danger is not set', async () => {
        const p = dialogs.confirm({ message: 'Proceed?', confirmLabel: 'Clear' });
        await flush();
        expect(findButtonByText('Clear')).not.toHaveAttribute('data-danger');
        findButtonByText('Clear').click();
        await p;
    });
});
