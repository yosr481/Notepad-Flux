// Update flow around electron-updater: one status object, pushed to every window on change,
// plus the native taskbar progress bar while downloading. Pure (deps injected) so it is
// unit-testable; main.js wires it to the real autoUpdater, dialog and windows.
// See Docs/internal/update-spec.md.

const BUSY = new Set(['checking', 'downloading', 'downloaded'])

// prepareInstall: optional async () => boolean. main.js closes every window through its close
// guard (unsaved tabs get saved) and resolves true once all are gone; only then do we install.
export function createUpdater({ autoUpdater, dialog, getWindows, isPackaged, log = console, prepareInstall }) {
    let status = { state: isPackaged ? 'idle' : 'unsupported', version: null, percent: null, error: null }
    let manualCheck = false
    let installing = false

    const eachWindow = (fn) => {
        for (const w of getWindows()) {
            try {
                if (!w.isDestroyed()) fn(w)
            } catch (err) {
                log.warn?.('updater: window update failed', err)
            }
        }
    }

    const set = (patch) => {
        status = { ...status, ...patch }
        eachWindow((w) => w.webContents.send('update-status', status))
    }

    // Call now (synchronously), and turn a throw or a rejected promise into the error state.
    const run = (fn, what) => {
        let result
        try {
            result = fn()
        } catch (err) {
            result = Promise.reject(err)
        }
        return Promise.resolve(result).catch((err) => {
            log.error?.(what, err)
            fail(err)
        })
    }

    const fail = (err) => {
        eachWindow((w) => w.setProgressBar(-1))
        set({ state: 'error', percent: null, error: (err && err.message) || String(err) })
    }

    const getStatus = () => status

    const check = ({ manual = false } = {}) => {
        // A Settings click during the startup check makes it a manual one: no box over Settings.
        if (status.state === 'checking' && manual) manualCheck = true
        if (status.state === 'unsupported' || BUSY.has(status.state)) return status
        manualCheck = manual
        set({ state: 'checking', error: null })
        run(() => autoUpdater.checkForUpdates(), 'Failed to check for updates:').then((result) => {
            // electron-updater resolves null with no event when it is inactive (not an AppImage
            // install, Snap, unpacked build): there is nothing to update, not a pending check.
            if (result === null && status.state === 'checking') set({ state: 'unsupported' })
        })
        return status
    }

    const download = () => {
        if (status.state !== 'available') return status
        set({ state: 'downloading', percent: 0, error: null })
        run(() => autoUpdater.downloadUpdate(), 'Update download failed:')
        return status
    }

    const install = () => {
        if (status.state !== 'downloaded' || installing) return status
        if (!prepareInstall) {
            autoUpdater.quitAndInstall()
            return status
        }
        installing = true
        Promise.resolve()
            .then(() => prepareInstall())
            .then((ok) => {
                if (ok) autoUpdater.quitAndInstall()
                else installing = false
            }, (err) => {
                installing = false
                log.error?.('Update install: closing windows failed:', err)
            })
        return status
    }

    // A window opened mid-download gets the taskbar progress right away.
    const attachWindow = (w) => {
        if (status.state === 'downloading' && status.percent !== null && !w.isDestroyed()) w.setProgressBar(status.percent / 100)
    }

    // The native boxes: a failure there is logged, never an unhandled rejection.
    const ask = async (options) => {
        try {
            return (await dialog.showMessageBox(options)).response
        } catch (err) {
            log.error?.('Update dialog failed:', err)
            return -1
        }
    }

    if (isPackaged) {
        autoUpdater.on('update-available', async (info) => {
            set({ state: 'available', version: info?.version ?? null, percent: null, error: null })
            if (manualCheck) return // Settings shows the offer on its button
            const response = await ask({
                type: 'info',
                buttons: ['Download Now', 'Later'],
                title: 'Update Available',
                message: `A new version (${info?.version}) of Notepad Flux is available. Would you like to download it now?`,
            })
            if (response === 0) download()
        })

        autoUpdater.on('update-not-available', () => set({ state: 'not-available', percent: null, error: null }))

        autoUpdater.on('download-progress', (p) => {
            if (status.state !== 'downloading') return
            const percent = Math.min(100, Math.max(0, Math.floor(Number(p?.percent) || 0)))
            if (percent === status.percent) return
            eachWindow((w) => w.setProgressBar(percent / 100))
            set({ percent })
        })

        autoUpdater.on('update-downloaded', async () => {
            eachWindow((w) => w.setProgressBar(-1))
            set({ state: 'downloaded', percent: 100, error: null })
            const response = await ask({
                type: 'info',
                buttons: ['Restart and Install', 'Later'],
                title: 'Update Ready',
                message: 'The update has been downloaded and is ready to be installed. Would you like to restart the application now?',
            })
            if (response === 0) install()
        })

        autoUpdater.on('error', (err) => {
            log.error?.('Auto Updater error:', err)
            // The update is still on disk after a failed install attempt: keep the Restart offer.
            if (status.state === 'downloaded') {
                installing = false
                set({ error: (err && err.message) || String(err) })
                return
            }
            fail(err)
        })
    }

    return { getStatus, check, download, install, attachWindow }
}
