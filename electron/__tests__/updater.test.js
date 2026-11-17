import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'

import { createUpdater } from '../updater.js'

// ---------------------------------------------------------------------------
// Contract: Docs/internal/update-spec.md (U1), module electron/updater.js
// createUpdater({ autoUpdater, dialog, getWindows, isPackaged, log })
//   -> { getStatus, check, download, install }
// Status: { state, version, percent, error }
// ---------------------------------------------------------------------------

const flush = () => new Promise((r) => setTimeout(r, 0))

function makeWindow({ destroyed = false } = {}) {
    return {
        webContents: { send: vi.fn() },
        setProgressBar: vi.fn(),
        isDestroyed: vi.fn(() => destroyed),
    }
}

function setup({ isPackaged = true, windows = [makeWindow()], response = 1, prepareInstall } = {}) {
    const autoUpdater = Object.assign(new EventEmitter(), {
        checkForUpdates: vi.fn(async () => undefined),
        downloadUpdate: vi.fn(async () => undefined),
        quitAndInstall: vi.fn(),
    })
    const dialog = { showMessageBox: vi.fn(async () => ({ response })) }
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const updater = createUpdater({ autoUpdater, dialog, getWindows: () => windows, isPackaged, log, prepareInstall })
    return { autoUpdater, dialog, log, updater, windows }
}

const statusPushes = (win) =>
    win.webContents.send.mock.calls.filter(([ch]) => ch === 'update-status').map(([, p]) => p)

// drive to `available` via a startup (non-manual) check, user answers "Later"
async function toAvailable(ctx, version = '2.0.0') {
    ctx.dialog.showMessageBox.mockResolvedValueOnce({ response: 1 })
    await ctx.updater.check({ manual: false })
    ctx.autoUpdater.emit('update-available', { version })
    await flush()
}

async function toDownloading(ctx) {
    await toAvailable(ctx)
    await ctx.updater.download()
}

async function toDownloaded(ctx) {
    await toDownloading(ctx)
    ctx.dialog.showMessageBox.mockResolvedValueOnce({ response: 1 })
    ctx.autoUpdater.emit('update-downloaded', { version: '2.0.0' })
    await flush()
}

describe('createUpdater — initial state and status shape', () => {
    it('packaged: starts idle with null version/percent/error', () => {
        const { updater } = setup()
        expect(updater.getStatus()).toEqual({ state: 'idle', version: null, percent: null, error: null })
    })

    it('status is plain JSON (survives a JSON round trip)', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        const s = ctx.updater.getStatus()
        expect(JSON.parse(JSON.stringify(s))).toEqual(s)
        expect(Object.keys(s).sort()).toEqual(['error', 'percent', 'state', 'version'])
    })

    it('every change yields a new object (no shared mutable status)', async () => {
        const ctx = setup()
        const a = ctx.updater.getStatus()
        await ctx.updater.check({ manual: true })
        const b = ctx.updater.getStatus()
        expect(b).not.toBe(a)
        expect(a.state).toBe('idle') // old snapshot not mutated
    })
})

describe('unsupported (not packaged)', () => {
    it('state is unsupported with null fields', () => {
        const { updater } = setup({ isPackaged: false })
        expect(updater.getStatus()).toEqual({ state: 'unsupported', version: null, percent: null, error: null })
    })

    it('check/download/install are no-ops that return the status and never touch autoUpdater', async () => {
        const { updater, autoUpdater, dialog } = setup({ isPackaged: false })
        const r1 = await updater.check({ manual: true })
        const r2 = await updater.check({ manual: false })
        const r3 = await updater.download()
        const r4 = await updater.install()
        for (const r of [r1, r2, r3, r4]) expect(r.state).toBe('unsupported')
        expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
        expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled()
        expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
        expect(dialog.showMessageBox).not.toHaveBeenCalled()
        expect(updater.getStatus().state).toBe('unsupported')
    })

    it('stays unsupported even if autoUpdater events fire', async () => {
        const { updater, autoUpdater } = setup({ isPackaged: false })
        autoUpdater.on('error', () => {}) // a bare EventEmitter throws on unhandled 'error'
        autoUpdater.emit('update-available', { version: '9.9.9' })
        autoUpdater.emit('error', new Error('x'))
        await flush()
        expect(updater.getStatus().state).toBe('unsupported')
    })
})

describe('check', () => {
    it('idle -> checking (already set while checkForUpdates runs), calls checkForUpdates once, returns status', async () => {
        const ctx = setup()
        let seen
        ctx.autoUpdater.checkForUpdates.mockImplementation(async () => { seen = ctx.updater.getStatus().state })
        const r = await ctx.updater.check({ manual: true })
        expect(seen).toBe('checking')
        expect(ctx.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
        expect(r).toEqual(ctx.updater.getStatus())
        expect(r.state).toBe('checking')
    })

    it('is a no-op while checking (double click)', async () => {
        const ctx = setup()
        await ctx.updater.check({ manual: true })
        const r = await ctx.updater.check({ manual: true })
        expect(ctx.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
        expect(r.state).toBe('checking')
    })

    it('is a no-op while downloading', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        ctx.autoUpdater.checkForUpdates.mockClear()
        const r = await ctx.updater.check({ manual: true })
        expect(ctx.autoUpdater.checkForUpdates).not.toHaveBeenCalled()
        expect(r.state).toBe('downloading')
    })

    it('is a no-op once downloaded', async () => {
        const ctx = setup()
        await toDownloaded(ctx)
        ctx.autoUpdater.checkForUpdates.mockClear()
        const r = await ctx.updater.check({ manual: true })
        expect(ctx.autoUpdater.checkForUpdates).not.toHaveBeenCalled()
        expect(r.state).toBe('downloaded')
    })

    it.each([
        ['not-available', async (ctx) => { await ctx.updater.check({ manual: true }); ctx.autoUpdater.emit('update-not-available', {}) }],
        ['error', async (ctx) => { await ctx.updater.check({ manual: true }); ctx.autoUpdater.emit('error', new Error('x')) }],
        ['available', async (ctx) => { await toAvailable(ctx) }],
    ])('re-check is allowed from %s', async (state, drive) => {
        const ctx = setup()
        await drive(ctx)
        expect(ctx.updater.getStatus().state).toBe(state)
        ctx.autoUpdater.checkForUpdates.mockClear()
        const r = await ctx.updater.check({ manual: true })
        expect(ctx.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
        expect(r.state).toBe('checking')
    })

    it('rejected checkForUpdates -> error state with message, check does not throw', async () => {
        const ctx = setup()
        ctx.autoUpdater.checkForUpdates.mockRejectedValue(new Error('network down'))
        // spec: the returned status may be the pre-rejection snapshot; the error lands once the promise settles
        await expect(Promise.resolve(ctx.updater.check({ manual: true }))).resolves.toBeDefined()
        await flush()
        expect(ctx.updater.getStatus()).toMatchObject({ state: 'error', error: 'network down', percent: null })
    })

    it('rejected check broadcasts the error state', async () => {
        const ctx = setup()
        ctx.autoUpdater.checkForUpdates.mockRejectedValue(new Error('nope'))
        await ctx.updater.check({ manual: false })
        await flush()
        const pushes = statusPushes(ctx.windows[0])
        expect(pushes.at(-1)).toMatchObject({ state: 'error', error: 'nope' })
    })
})

describe('check: inactive electron-updater (resolves null)', () => {
    it('null result while still checking -> unsupported, broadcast, no error', async () => {
        const ctx = setup()
        ctx.autoUpdater.checkForUpdates.mockResolvedValue(null)
        await ctx.updater.check({ manual: true })
        await flush()
        expect(ctx.updater.getStatus()).toEqual({ state: 'unsupported', version: null, percent: null, error: null })
        expect(statusPushes(ctx.windows[0]).at(-1)).toEqual({ state: 'unsupported', version: null, percent: null, error: null })
    })

    it('after going unsupported, check/download/install are no-ops', async () => {
        const ctx = setup()
        ctx.autoUpdater.checkForUpdates.mockResolvedValue(null)
        await ctx.updater.check({ manual: false })
        await flush()
        ctx.autoUpdater.checkForUpdates.mockClear()
        await ctx.updater.check({ manual: true })
        await ctx.updater.download()
        await ctx.updater.install()
        expect(ctx.autoUpdater.checkForUpdates).not.toHaveBeenCalled()
        expect(ctx.autoUpdater.downloadUpdate).not.toHaveBeenCalled()
        expect(ctx.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
        expect(ctx.updater.getStatus().state).toBe('unsupported')
    })

    it('non-null result with no event yet stays checking', async () => {
        const ctx = setup()
        ctx.autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '2.0.0' } })
        await ctx.updater.check({ manual: true })
        await flush()
        expect(ctx.updater.getStatus().state).toBe('checking')
    })

    it('update-available arriving before the promise resolves (non-null result) stays available', async () => {
        const ctx = setup()
        let resolve
        ctx.autoUpdater.checkForUpdates.mockImplementation(() => new Promise((r) => { resolve = r }))
        await ctx.updater.check({ manual: true })
        ctx.autoUpdater.emit('update-available', { version: '2.0.0' })
        resolve({ updateInfo: { version: '2.0.0' } })
        await flush()
        expect(ctx.updater.getStatus()).toEqual({ state: 'available', version: '2.0.0', percent: null, error: null })
    })

    it('null result AFTER an event already moved the state is ignored (only applies while still checking)', async () => {
        const ctx = setup()
        let resolve
        ctx.autoUpdater.checkForUpdates.mockImplementation(() => new Promise((r) => { resolve = r }))
        await ctx.updater.check({ manual: true })
        ctx.autoUpdater.emit('update-not-available', {})
        resolve(null)
        await flush()
        expect(ctx.updater.getStatus().state).toBe('not-available')
    })
})

describe('update-available: manual vs startup', () => {
    it('startup check: sets available + version and shows the same box as today', async () => {
        const ctx = setup({ response: 1 })
        await ctx.updater.check({ manual: false })
        ctx.autoUpdater.emit('update-available', { version: '2.0.0' })
        await flush()
        expect(ctx.updater.getStatus()).toEqual({ state: 'available', version: '2.0.0', percent: null, error: null })
        expect(ctx.dialog.showMessageBox).toHaveBeenCalledTimes(1)
        expect(ctx.dialog.showMessageBox).toHaveBeenCalledWith({
            type: 'info',
            buttons: ['Download Now', 'Later'],
            title: 'Update Available',
            message: 'A new version (2.0.0) of Notepad Flux is available. Would you like to download it now?',
        })
    })

    it('startup box "Download Now" (response 0) starts the download', async () => {
        const ctx = setup({ response: 0 })
        await ctx.updater.check({ manual: false })
        ctx.autoUpdater.emit('update-available', { version: '2.0.0' })
        await flush()
        expect(ctx.autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1)
        expect(ctx.updater.getStatus()).toMatchObject({ state: 'downloading', percent: 0, version: '2.0.0' })
    })

    it('startup box "Later" (response 1) stays available and does not download', async () => {
        const ctx = setup({ response: 1 })
        await ctx.updater.check({ manual: false })
        ctx.autoUpdater.emit('update-available', { version: '2.0.0' })
        await flush()
        expect(ctx.autoUpdater.downloadUpdate).not.toHaveBeenCalled()
        expect(ctx.updater.getStatus().state).toBe('available')
    })

    it('manual check: no box, state available with version, no download', async () => {
        const ctx = setup({ response: 0 })
        await ctx.updater.check({ manual: true })
        ctx.autoUpdater.emit('update-available', { version: '2.1.0' })
        await flush()
        expect(ctx.dialog.showMessageBox).not.toHaveBeenCalled()
        expect(ctx.autoUpdater.downloadUpdate).not.toHaveBeenCalled()
        expect(ctx.updater.getStatus()).toEqual({ state: 'available', version: '2.1.0', percent: null, error: null })
    })

    it('update-not-available -> not-available, version null', async () => {
        const ctx = setup()
        await ctx.updater.check({ manual: true })
        ctx.autoUpdater.emit('update-not-available', { version: '1.0.0' })
        expect(ctx.updater.getStatus()).toEqual({ state: 'not-available', version: null, percent: null, error: null })
        expect(ctx.dialog.showMessageBox).not.toHaveBeenCalled()
    })
})

describe('download', () => {
    it.each([
        ['idle', async () => {}],
        ['checking', async (ctx) => { await ctx.updater.check({ manual: true }) }],
        ['not-available', async (ctx) => { await ctx.updater.check({ manual: true }); ctx.autoUpdater.emit('update-not-available', {}) }],
        ['error', async (ctx) => { await ctx.updater.check({ manual: true }); ctx.autoUpdater.emit('error', new Error('x')) }],
    ])('is a no-op from %s', async (state, drive) => {
        const ctx = setup()
        await drive(ctx)
        const before = ctx.updater.getStatus()
        const r = await ctx.updater.download()
        expect(ctx.autoUpdater.downloadUpdate).not.toHaveBeenCalled()
        expect(r).toEqual(before)
        expect(before.state).toBe(state)
    })

    it('is a no-op while downloading and once downloaded', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        await ctx.updater.download()
        expect(ctx.autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1)
        ctx.autoUpdater.emit('update-downloaded', { version: '2.0.0' })
        await flush()
        await ctx.updater.download()
        expect(ctx.autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1)
    })

    it('from available: downloading, percent 0, calls downloadUpdate once, returns status', async () => {
        const ctx = setup()
        await toAvailable(ctx)
        const r = await ctx.updater.download()
        expect(ctx.autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1)
        expect(r).toEqual({ state: 'downloading', version: '2.0.0', percent: 0, error: null })
        expect(ctx.updater.getStatus()).toEqual(r)
    })

    it('rapid double download() calls only start one download', async () => {
        const ctx = setup()
        await toAvailable(ctx)
        await Promise.all([ctx.updater.download(), ctx.updater.download()])
        expect(ctx.autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1)
    })

    it('rejected downloadUpdate -> error state, keeps version, does not throw', async () => {
        const ctx = setup()
        await toAvailable(ctx)
        ctx.autoUpdater.downloadUpdate.mockRejectedValue(new Error('disk full'))
        await expect(Promise.resolve(ctx.updater.download())).resolves.toBeDefined()
        await flush()
        expect(ctx.updater.getStatus()).toEqual({ state: 'error', version: '2.0.0', percent: null, error: 'disk full' })
    })

    it('rejected download resets the taskbar progress bar', async () => {
        const ctx = setup()
        await toAvailable(ctx)
        ctx.autoUpdater.downloadUpdate.mockRejectedValue(new Error('x'))
        await ctx.updater.download()
        await flush()
        expect(ctx.windows[0].setProgressBar).toHaveBeenLastCalledWith(-1)
    })
})

describe('download-progress', () => {
    it('floors percent and broadcasts only when the integer changes', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        const win = ctx.windows[0]
        const base = statusPushes(win).length

        ctx.autoUpdater.emit('download-progress', { percent: 0.4 }) // floor 0, same as start
        expect(statusPushes(win).length).toBe(base)

        ctx.autoUpdater.emit('download-progress', { percent: 1.2 })
        expect(ctx.updater.getStatus().percent).toBe(1)
        expect(statusPushes(win).length).toBe(base + 1)

        ctx.autoUpdater.emit('download-progress', { percent: 1.9 }) // still 1
        expect(ctx.updater.getStatus().percent).toBe(1)
        expect(statusPushes(win).length).toBe(base + 1)

        ctx.autoUpdater.emit('download-progress', { percent: 42.99 })
        expect(ctx.updater.getStatus().percent).toBe(42)
        expect(statusPushes(win).length).toBe(base + 2)
        expect(statusPushes(win).at(-1)).toMatchObject({ state: 'downloading', percent: 42 })
    })

    it('does not round up (99.9 -> 99)', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        ctx.autoUpdater.emit('download-progress', { percent: 99.9 })
        expect(ctx.updater.getStatus().percent).toBe(99)
    })

    it('clamps to 0..100', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        ctx.autoUpdater.emit('download-progress', { percent: 250 })
        expect(ctx.updater.getStatus().percent).toBe(100)
        ctx.autoUpdater.emit('download-progress', { percent: -7 })
        expect(ctx.updater.getStatus().percent).toBe(0)
    })

    it('sets the taskbar progress bar to percent/100 on every window', async () => {
        const w1 = makeWindow(), w2 = makeWindow()
        const ctx = setup({ windows: [w1, w2] })
        await toDownloading(ctx)
        ctx.autoUpdater.emit('download-progress', { percent: 42.5 })
        expect(w1.setProgressBar).toHaveBeenLastCalledWith(0.42)
        expect(w2.setProgressBar).toHaveBeenLastCalledWith(0.42)
    })

    it('percent stays an integer and state stays downloading', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        ctx.autoUpdater.emit('download-progress', { percent: 12.345 })
        const s = ctx.updater.getStatus()
        expect(Number.isInteger(s.percent)).toBe(true)
        expect(s.state).toBe('downloading')
    })
})

describe('update-downloaded and install', () => {
    it('-> downloaded, percent 100, progress bar cleared on every window', async () => {
        const w1 = makeWindow(), w2 = makeWindow()
        const ctx = setup({ windows: [w1, w2] })
        await toDownloading(ctx)
        ctx.autoUpdater.emit('download-progress', { percent: 60 })
        ctx.dialog.showMessageBox.mockResolvedValueOnce({ response: 1 })
        ctx.autoUpdater.emit('update-downloaded', { version: '2.0.0' })
        await flush()
        expect(ctx.updater.getStatus()).toEqual({ state: 'downloaded', version: '2.0.0', percent: 100, error: null })
        expect(w1.setProgressBar).toHaveBeenLastCalledWith(-1)
        expect(w2.setProgressBar).toHaveBeenLastCalledWith(-1)
    })

    it('shows the Restart and Install box (also after a manual check/download) with today\'s text', async () => {
        const ctx = setup()
        await ctx.updater.check({ manual: true })
        ctx.autoUpdater.emit('update-available', { version: '2.0.0' })
        await ctx.updater.download()
        ctx.dialog.showMessageBox.mockClear()
        ctx.dialog.showMessageBox.mockResolvedValueOnce({ response: 1 })
        ctx.autoUpdater.emit('update-downloaded', { version: '2.0.0' })
        await flush()
        expect(ctx.dialog.showMessageBox).toHaveBeenCalledTimes(1)
        expect(ctx.dialog.showMessageBox).toHaveBeenCalledWith({
            type: 'info',
            buttons: ['Restart and Install', 'Later'],
            title: 'Update Ready',
            message: 'The update has been downloaded and is ready to be installed. Would you like to restart the application now?',
        })
    })

    it('box "Restart and Install" (0) calls quitAndInstall', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        ctx.dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })
        ctx.autoUpdater.emit('update-downloaded', { version: '2.0.0' })
        await flush()
        expect(ctx.autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
    })

    it('box "Later" (1) does not install; state stays downloaded', async () => {
        const ctx = setup()
        await toDownloaded(ctx)
        expect(ctx.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
        expect(ctx.updater.getStatus().state).toBe('downloaded')
    })

    it('install() from downloaded calls quitAndInstall', async () => {
        const ctx = setup()
        await toDownloaded(ctx)
        await ctx.updater.install()
        expect(ctx.autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['idle', async () => {}],
        ['checking', async (ctx) => { await ctx.updater.check({ manual: true }) }],
        ['available', async (ctx) => { await toAvailable(ctx) }],
        ['downloading', async (ctx) => { await toDownloading(ctx) }],
        ['error', async (ctx) => { await ctx.updater.check({ manual: true }); ctx.autoUpdater.emit('error', new Error('x')) }],
    ])('install() is a no-op from %s', async (state, drive) => {
        const ctx = setup()
        await drive(ctx)
        expect(ctx.updater.getStatus().state).toBe(state)
        await ctx.updater.install()
        expect(ctx.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
        expect(ctx.updater.getStatus().state).toBe(state)
    })
})

describe('error event', () => {
    it('uses err.message, nulls percent, clears progress bar, shows no box', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        ctx.autoUpdater.emit('download-progress', { percent: 30 })
        ctx.dialog.showMessageBox.mockClear()
        ctx.autoUpdater.emit('error', new Error('checksum mismatch'))
        await flush()
        expect(ctx.updater.getStatus()).toEqual({ state: 'error', version: '2.0.0', percent: null, error: 'checksum mismatch' })
        expect(ctx.windows[0].setProgressBar).toHaveBeenLastCalledWith(-1)
        expect(ctx.dialog.showMessageBox).not.toHaveBeenCalled()
    })

    it('falls back to String(err) for non-Error values', async () => {
        const ctx = setup()
        ctx.autoUpdater.emit('error', 'plain string failure')
        expect(ctx.updater.getStatus()).toMatchObject({ state: 'error', error: 'plain string failure' })
    })

    it('falls back to String(err) when message is empty', async () => {
        const ctx = setup()
        const err = new Error('')
        ctx.autoUpdater.emit('error', err)
        expect(ctx.updater.getStatus().error).toBe(String(err))
    })

    it('version is null if it was never known', async () => {
        const ctx = setup()
        await ctx.updater.check({ manual: true })
        ctx.autoUpdater.emit('error', new Error('x'))
        expect(ctx.updater.getStatus().version).toBeNull()
    })

    it('error state is recoverable: check() works again', async () => {
        const ctx = setup()
        ctx.autoUpdater.emit('error', new Error('x'))
        const r = await ctx.updater.check({ manual: true })
        expect(r.state).toBe('checking')
        expect(r.error).toBeNull()
    })
})

describe('broadcast', () => {
    it('every state change pushes update-status with the new status to every live window', async () => {
        const w1 = makeWindow(), w2 = makeWindow()
        const ctx = setup({ windows: [w1, w2] })
        await ctx.updater.check({ manual: true })
        for (const w of [w1, w2]) {
            expect(w.webContents.send).toHaveBeenCalledWith('update-status', expect.objectContaining({ state: 'checking' }))
        }
        ctx.autoUpdater.emit('update-available', { version: '3.0.0' })
        for (const w of [w1, w2]) {
            expect(statusPushes(w).at(-1)).toEqual({ state: 'available', version: '3.0.0', percent: null, error: null })
        }
    })

    it('pushes arrive in transition order', async () => {
        const ctx = setup()
        await toDownloaded(ctx)
        const states = statusPushes(ctx.windows[0]).map((s) => s.state)
        const dedup = states.filter((s, i) => s !== states[i - 1])
        expect(dedup).toEqual(['checking', 'available', 'downloading', 'downloaded'])
    })

    it('skips destroyed windows entirely (no send, no setProgressBar) and never throws', async () => {
        const dead = makeWindow({ destroyed: true })
        dead.webContents.send.mockImplementation(() => { throw new Error('Object has been destroyed') })
        dead.setProgressBar.mockImplementation(() => { throw new Error('Object has been destroyed') })
        const live = makeWindow()
        const ctx = setup({ windows: [dead, live] })
        await toDownloading(ctx)
        ctx.autoUpdater.emit('download-progress', { percent: 10 })
        ctx.dialog.showMessageBox.mockResolvedValueOnce({ response: 1 })
        ctx.autoUpdater.emit('update-downloaded', {})
        ctx.autoUpdater.emit('error', new Error('x'))
        await flush()
        expect(dead.webContents.send).not.toHaveBeenCalled()
        expect(dead.setProgressBar).not.toHaveBeenCalled()
        expect(statusPushes(live).length).toBeGreaterThan(0)
    })

    it('works with zero windows', async () => {
        const ctx = setup({ windows: [] })
        await ctx.updater.check({ manual: true })
        ctx.autoUpdater.emit('update-not-available', {})
        expect(ctx.updater.getStatus().state).toBe('not-available')
    })

    it('reads the window list fresh on each broadcast (new windows get later pushes)', async () => {
        const windows = []
        const autoUpdater = Object.assign(new EventEmitter(), {
            checkForUpdates: vi.fn(async () => undefined), downloadUpdate: vi.fn(), quitAndInstall: vi.fn(),
        })
        const updater = createUpdater({
            autoUpdater, dialog: { showMessageBox: vi.fn(async () => ({ response: 1 })) },
            getWindows: () => windows, isPackaged: true, log: { info() {}, warn() {}, error() {} },
        })
        await updater.check({ manual: true })
        const late = makeWindow()
        windows.push(late)
        autoUpdater.emit('update-not-available', {})
        expect(statusPushes(late).at(-1)).toMatchObject({ state: 'not-available' })
    })
})

// ---------------------------------------------------------------------------
// Review-fix rules: prepareInstall, attachWindow, manual-during-startup,
// box failures, error while downloaded.
// ---------------------------------------------------------------------------
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

describe('install with prepareInstall', () => {
    it('calls prepareInstall first; quitAndInstall only after it resolves true', async () => {
        const d = deferred()
        const prepareInstall = vi.fn(() => d.promise)
        const ctx = setup({ prepareInstall })
        await toDownloaded(ctx)
        await ctx.updater.install()
        await flush()
        expect(prepareInstall).toHaveBeenCalledTimes(1)
        expect(ctx.autoUpdater.quitAndInstall).not.toHaveBeenCalled() // still pending
        d.resolve(true)
        await flush()
        expect(ctx.autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
        expect(prepareInstall.mock.invocationCallOrder[0]).toBeLessThan(ctx.autoUpdater.quitAndInstall.mock.invocationCallOrder[0])
    })

    it('prepareInstall resolving false: no quitAndInstall, a later install() tries again', async () => {
        const prepareInstall = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        const ctx = setup({ prepareInstall })
        await toDownloaded(ctx)
        await ctx.updater.install()
        await flush()
        expect(ctx.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
        await ctx.updater.install()
        await flush()
        expect(prepareInstall).toHaveBeenCalledTimes(2)
        expect(ctx.autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
    })

    it('prepareInstall rejecting: no quitAndInstall, install() does not throw, retry possible', async () => {
        const prepareInstall = vi.fn().mockRejectedValueOnce(new Error('close failed')).mockResolvedValueOnce(true)
        const ctx = setup({ prepareInstall })
        await toDownloaded(ctx)
        await expect(Promise.resolve(ctx.updater.install())).resolves.toBeDefined()
        await flush()
        expect(ctx.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
        expect(ctx.updater.getStatus().state).toBe('downloaded')
        await ctx.updater.install()
        await flush()
        expect(prepareInstall).toHaveBeenCalledTimes(2)
        expect(ctx.autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
    })

    it('a second install() while the first is pending calls prepareInstall once', async () => {
        const d = deferred()
        const prepareInstall = vi.fn(() => d.promise)
        const ctx = setup({ prepareInstall })
        await toDownloaded(ctx)
        await ctx.updater.install()
        await ctx.updater.install()
        await flush()
        expect(prepareInstall).toHaveBeenCalledTimes(1)
        d.resolve(true)
        await flush()
        expect(ctx.autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
    })

    it('the Restart box answer goes through prepareInstall too', async () => {
        const prepareInstall = vi.fn(async () => true)
        const ctx = setup({ prepareInstall })
        await toDownloading(ctx)
        ctx.dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })
        ctx.autoUpdater.emit('update-downloaded', {})
        await flush()
        expect(prepareInstall).toHaveBeenCalledTimes(1)
        expect(ctx.autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
    })

    it('without prepareInstall: direct, synchronous quitAndInstall', async () => {
        const ctx = setup()
        await toDownloaded(ctx)
        ctx.updater.install() // no await, no flush
        expect(ctx.autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
    })
})

describe('attachWindow', () => {
    it('while downloading at 42% sets that window\'s bar to 0.42', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        ctx.autoUpdater.emit('download-progress', { percent: 42.7 })
        const late = makeWindow()
        ctx.updater.attachWindow(late)
        expect(late.setProgressBar).toHaveBeenCalledWith(0.42)
    })

    it('at the start of a download (0%) sets 0', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        const late = makeWindow()
        ctx.updater.attachWindow(late)
        expect(late.setProgressBar).toHaveBeenCalledWith(0)
    })

    it.each([
        ['idle', async () => {}],
        ['checking', async (ctx) => { await ctx.updater.check({ manual: true }) }],
        ['available', async (ctx) => { await toAvailable(ctx) }],
        ['downloaded', async (ctx) => { await toDownloaded(ctx) }],
        ['not-available', async (ctx) => { await ctx.updater.check({ manual: true }); ctx.autoUpdater.emit('update-not-available', {}) }],
        ['error', async (ctx) => { ctx.autoUpdater.emit('error', new Error('x')) }],
    ])('in state %s calls nothing on the window', async (state, drive) => {
        const ctx = setup()
        await drive(ctx)
        expect(ctx.updater.getStatus().state).toBe(state)
        const w = makeWindow()
        ctx.updater.attachWindow(w)
        expect(w.setProgressBar).not.toHaveBeenCalled()
        expect(w.webContents.send).not.toHaveBeenCalled()
    })

    it('unsupported: calls nothing', () => {
        const { updater } = setup({ isPackaged: false })
        const w = makeWindow()
        updater.attachWindow(w)
        expect(w.setProgressBar).not.toHaveBeenCalled()
    })

    it('a destroyed window is skipped while downloading', async () => {
        const ctx = setup()
        await toDownloading(ctx)
        ctx.autoUpdater.emit('download-progress', { percent: 42 })
        const dead = makeWindow({ destroyed: true })
        expect(() => ctx.updater.attachWindow(dead)).not.toThrow()
        expect(dead.setProgressBar).not.toHaveBeenCalled()
    })
})

describe('manual click during the startup check', () => {
    it('check({manual:true}) while a startup check is checking: update-available shows NO box', async () => {
        const ctx = setup({ response: 0 })
        await ctx.updater.check({ manual: false })
        expect(ctx.updater.getStatus().state).toBe('checking')
        await ctx.updater.check({ manual: true })
        expect(ctx.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1) // still no second check
        ctx.autoUpdater.emit('update-available', { version: '2.0.0' })
        await flush()
        expect(ctx.dialog.showMessageBox).not.toHaveBeenCalled()
        expect(ctx.autoUpdater.downloadUpdate).not.toHaveBeenCalled()
        expect(ctx.updater.getStatus()).toMatchObject({ state: 'available', version: '2.0.0' })
    })

    it('a startup check during a manual one does not bring the box back', async () => {
        const ctx = setup({ response: 0 })
        await ctx.updater.check({ manual: true })
        await ctx.updater.check({ manual: false })
        ctx.autoUpdater.emit('update-available', { version: '2.0.0' })
        await flush()
        expect(ctx.dialog.showMessageBox).not.toHaveBeenCalled()
    })
})

describe('native box failures (showMessageBox rejects)', () => {
    let unhandled
    const onUnhandled = (e) => unhandled.push(e)
    beforeEach(() => { unhandled = []; process.on('unhandledRejection', onUnhandled) })
    afterEach(() => { process.off('unhandledRejection', onUnhandled) })

    it('update box: logged, no download, no unhandled rejection, stays available', async () => {
        const ctx = setup()
        ctx.dialog.showMessageBox.mockRejectedValue(new Error('no display'))
        await ctx.updater.check({ manual: false })
        ctx.autoUpdater.emit('update-available', { version: '2.0.0' })
        await flush(); await flush()
        expect(ctx.autoUpdater.downloadUpdate).not.toHaveBeenCalled()
        expect(ctx.updater.getStatus()).toMatchObject({ state: 'available', version: '2.0.0', error: null })
        expect(ctx.log.error).toHaveBeenCalled()
        expect(unhandled).toEqual([])
    })

    it('restart box: logged, no install, no unhandled rejection, stays downloaded', async () => {
        const prepareInstall = vi.fn(async () => true)
        const ctx = setup({ prepareInstall })
        await toDownloading(ctx)
        ctx.dialog.showMessageBox.mockRejectedValue(new Error('no display'))
        ctx.autoUpdater.emit('update-downloaded', {})
        await flush(); await flush()
        expect(prepareInstall).not.toHaveBeenCalled()
        expect(ctx.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
        expect(ctx.updater.getStatus()).toMatchObject({ state: 'downloaded', percent: 100 })
        expect(ctx.log.error).toHaveBeenCalled()
        expect(unhandled).toEqual([])
    })
})

describe('error event while downloaded', () => {
    it('state stays downloaded (percent 100, version kept), error set, update-status broadcast', async () => {
        const ctx = setup({ prepareInstall: vi.fn(async () => true) })
        await toDownloaded(ctx)
        ctx.autoUpdater.emit('error', new Error('install blocked'))
        await flush()
        expect(ctx.updater.getStatus()).toEqual({ state: 'downloaded', version: '2.0.0', percent: 100, error: 'install blocked' })
        expect(statusPushes(ctx.windows[0]).at(-1)).toMatchObject({ state: 'downloaded', error: 'install blocked' })
    })

    it('ends the pending install attempt: a later install() runs prepareInstall again', async () => {
        const d = deferred()
        const prepareInstall = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValueOnce(true)
        const ctx = setup({ prepareInstall })
        await toDownloaded(ctx)
        await ctx.updater.install() // pending
        ctx.autoUpdater.emit('error', new Error('install blocked'))
        await ctx.updater.install()
        await flush()
        expect(prepareInstall).toHaveBeenCalledTimes(2)
        expect(ctx.autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
    })

    it('a failed install attempt after quitAndInstall can be retried too', async () => {
        const prepareInstall = vi.fn(async () => true)
        const ctx = setup({ prepareInstall })
        await toDownloaded(ctx)
        await ctx.updater.install(); await flush()
        ctx.autoUpdater.emit('error', new Error('nsis failed'))
        await ctx.updater.install(); await flush()
        expect(prepareInstall).toHaveBeenCalledTimes(2)
        expect(ctx.autoUpdater.quitAndInstall).toHaveBeenCalledTimes(2)
    })

    it('shows no box and does not touch the taskbar bar', async () => {
        const ctx = setup()
        await toDownloaded(ctx)
        ctx.dialog.showMessageBox.mockClear()
        ctx.windows[0].setProgressBar.mockClear()
        ctx.autoUpdater.emit('error', new Error('x'))
        await flush()
        expect(ctx.dialog.showMessageBox).not.toHaveBeenCalled()
        expect(ctx.windows[0].setProgressBar).not.toHaveBeenCalled()
    })
})
