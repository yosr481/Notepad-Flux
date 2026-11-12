// Round-4 scenarios shared by packaged.mjs (Linux) and packaged-win.mjs (Windows).
// ctx = { L, check, na, ui, sleep, waitFor, assert, eq, logOf, tmp, cleanup, join, existsSync, readdirSync, isWin }
const pagesOf = (app) => app.windows().filter(w => !w.isClosed() && /index\.html/.test(w.url()))
const mainCount = (app) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => /index\.html/.test(w.webContents.getURL())).length)

export async function multiWindow(ctx) {
    const { L, check, ui, sleep, waitFor, assert, eq, logOf, tmp, cleanup } = ctx
    const texts = async (p) => {
        const out = []; const n = (await ui.tabsInfo(p)).length
        for (let i = 0; i < n; i++) { await p.locator('[class*=tabsList] > div').nth(i).click(); await sleep(300); out.push((await p.evaluate(() => document.querySelector('.cm-content').innerText)).replace(/\n+$/, '')) }
        return out
    }
    const missingOf = (arr, wanted) => wanted.filter(t => !arr.some(x => x.includes(t)))
    const newWindow = async (app, from) => {
        const wp = app.waitForEvent('window', { timeout: 20000 })
        await from.getByText('File', { exact: true }).first().click(); await from.getByText('New Window', { exact: true }).click()
        const w = await wp; await w.waitForLoadState('domcontentloaded'); await sleep(2500); return w
    }
    const type = async (p, text) => { await p.locator('.cm-content').click(); await p.keyboard.press('Control+End'); await p.keyboard.type(text) }
    const stubPrompt = (app, choice) => app.evaluate(({ dialog }, c) => { globalThis.__boxes = 0; globalThis.__choice = c; dialog.showMessageBoxSync = () => { globalThis.__boxes++; return globalThis.__choice } }, choice)
    const closeNth = (app, n) => app.evaluate(({ BrowserWindow }, n) => { const ws = BrowserWindow.getAllWindows().filter(w => /index\.html/.test(w.webContents.getURL())).sort((a, b) => a.id - b.id); ws[n].close() }, n)
    const watchExit = (app) => { const st = { exited: false }; app.process().once('exit', () => { st.exited = true }); return st }

    // ---- A: two windows, close the first (primary) while the second is dirty
    {
        const U = tmp('nf-mw-u-'); cleanup.push(U)
        const { app, win: w1 } = await L(U)
        await type(w1, 'PRIMARY-ONE-TEXT'); await w1.keyboard.press('Control+n'); await sleep(300); await type(w1, 'PRIMARY-TWO-TEXT'); await sleep(1500)
        const w2 = await newWindow(app, w1)
        await type(w2, 'SECOND-ONE-TEXT'); await w2.keyboard.press('Control+n'); await sleep(300); await type(w2, 'SECOND-TWO-TEXT'); await sleep(800)
        await stubPrompt(app, 1)
        const st = watchExit(app)
        await closeNth(app, 0)                       // the first window = the primary one
        await sleep(4000)
        await check('WIN-8', 'window', 'closing the first (primary) window while a New Window with unsaved text is open: no prompt for the primary, the app stays open, the second window survives', async () => {
            assert(!st.exited && !w2.isClosed(), 'app/second window closed with the first. log: ' + (logOf(U).match(/.*\bquit\b.*/) || [''])[0].slice(0, 80))
            eq(await mainCount(app), 1, 'windows left'); eq(await app.evaluate(() => globalThis.__boxes || 0), 0, 'a prompt appeared for the primary window')
        }, { smoke: true })
        await check('FAILOVER-1', 'session', "after the primary closed, the promoted window holds BOTH windows' tabs, every one with its text", async () => {
            const t = await texts(w2); const missing = missingOf(t, ['PRIMARY-ONE-TEXT', 'PRIMARY-TWO-TEXT', 'SECOND-ONE-TEXT', 'SECOND-TWO-TEXT'])
            assert(missing.length === 0, `lost: ${missing.join(', ')}; tabs: ${JSON.stringify(t)}`)
        }, { smoke: true })
        await closeNth(app, 0); await waitFor(() => st.exited, { timeout: 12000, what: 'app exit after the last window closed' }).catch(() => {})
        await check('HANDOVER-1', 'session', 'closing the last window (now primary) ends the app without a prompt; a relaunch restores all four tabs (the session did not shrink across the hand-over)', async () => {
            assert(st.exited, 'app still running after its last window closed'); eq(await app.evaluate(() => globalThis.__boxes || 0).catch(() => 0), 0, 'prompt')
            const r = await L(U); const t = await texts(r.win); await r.app.close().catch(() => {})
            const missing = missingOf(t, ['PRIMARY-ONE-TEXT', 'PRIMARY-TWO-TEXT', 'SECOND-ONE-TEXT', 'SECOND-TWO-TEXT'])
            assert(missing.length === 0, `not restored: ${missing.join(', ')}; tabs: ${JSON.stringify(t)}`)
        }, { smoke: true })
        await app.close().catch(() => {})
    }

    if (!ctx.smoke) {
    // ---- B: three windows, close them one after the other; each hand-over may only add tabs
    {
        const U = tmp('nf-mw3-u-'); cleanup.push(U)
        const { app, win: w1 } = await L(U)
        await type(w1, 'W1-TEXT'); await sleep(1500)
        const w2 = await newWindow(app, w1); await type(w2, 'W2-TEXT')
        const w3 = await newWindow(app, w2); await type(w3, 'W3-TEXT'); await sleep(800)
        await stubPrompt(app, 1)
        const st = watchExit(app)
        await check('WIN-9', 'window', 'three windows (third opened from the second): closing the first leaves two, closing the next leaves one; each survivor takes over the persisted session and every hand-over only adds tabs', async () => {
            eq(await mainCount(app), 3, 'windows at start')
            await closeNth(app, 0); await sleep(3500)
            eq(await mainCount(app), 2, 'windows after closing the first'); assert(!st.exited, 'app quit after the first close')
            const s2 = await texts(w2), s3 = await texts(w3)
            assert(missingOf(s2, ['W1-TEXT', 'W2-TEXT']).length === 0, 'first survivor (queued first) lacks the hand-over: ' + JSON.stringify(s2))
            assert(missingOf(s3, ['W3-TEXT']).length === 0, 'third window lost its own text: ' + JSON.stringify(s3))
            await closeNth(app, 0); await sleep(3500)
            eq(await mainCount(app), 1, 'windows after closing the second'); assert(!st.exited, 'app quit after the second close')
            eq(await app.evaluate(() => globalThis.__boxes || 0), 0, 'a prompt appeared although the closing window was the primary')
            const s3b = await texts(w3)
            const missing = missingOf(s3b, ['W1-TEXT', 'W2-TEXT', 'W3-TEXT']); assert(missing.length === 0, `last survivor lost ${missing.join(', ')}: ${JSON.stringify(s3b)}`)
            assert(s3b.length >= s3.length && s3b.length >= s2.length, `session shrank: ${s2.length}/${s3.length} -> ${s3b.length} tabs`)
        })
        await closeNth(app, 0); await waitFor(() => st.exited, { timeout: 12000, what: 'exit after last window' }).catch(() => {})
        await check('HANDOVER-2', 'session', "after the three-window hand-overs the app exits with the last window and a relaunch restores all three windows' text", async () => {
            assert(st.exited, 'app did not exit after its last window closed')
            const r = await L(U); const t = await texts(r.win); await r.app.close().catch(() => {})
            const missing = missingOf(t, ['W1-TEXT', 'W2-TEXT', 'W3-TEXT']); assert(missing.length === 0, `not restored: ${missing.join(', ')}; tabs ${JSON.stringify(t)}`)
        })
        await app.close().catch(() => {})
    }

    // ---- C: File > Exit with a dirty secondary window: Keep editing keeps that window (and the app); Discard ends everything
    {
        const U = tmp('nf-mwx-u-'); cleanup.push(U)
        const { app, win: w1 } = await L(U)
        await type(w1, 'EXIT-PRIMARY'); await sleep(1500)
        const w2 = await newWindow(app, w1); await type(w2, 'EXIT-SECOND-DIRTY'); await sleep(800)
        await stubPrompt(app, 1)                      // Keep editing
        const st = watchExit(app)
        await w1.getByText('File', { exact: true }).first().click(); await w1.getByText('Exit', { exact: true }).click()
        await sleep(4500)
        await check('EXIT-1', 'window', 'File > Exit with a dirty secondary window and "Keep editing": the primary window closes, the secondary stays with its text, the app keeps running', async () => {
            assert(!st.exited, 'app exited although the secondary window chose Keep editing')
            eq(await mainCount(app), 1, 'windows left'); eq(await app.evaluate(() => globalThis.__boxes || 0), 1, 'prompts shown')
            const t = await texts(w2)
            assert(t.some(x => x.includes('EXIT-SECOND-DIRTY')), 'secondary text lost: ' + JSON.stringify(t))
            assert(t.some(x => x.includes('EXIT-PRIMARY')), "the primary window's tab did not reach the survivor: " + JSON.stringify(t))
        })
        await app.evaluate(() => { globalThis.__choice = 0 })        // Discard
        await w2.getByText('File', { exact: true }).first().click(); await w2.getByText('Exit', { exact: true }).click()
        await waitFor(() => st.exited, { timeout: 12000, what: 'exit after Discard' }).catch(() => {})
        await check('EXIT-2', 'window', 'File > Exit again with "Discard changes and close": the app ends', async () => {
            assert(st.exited, 'app still running after Exit + Discard')
        })
        await app.close().catch(() => {})
    }
    }
}

// ---- the userData override applies before the single-instance lock (166b8cd)
export async function overrideScenarios(ctx) {
    const { L, check, assert, tmp, cleanup, join, existsSync, readdirSync, readFileSync, isWin } = ctx
    const U1 = tmp('nf-lk1-'), U2 = tmp('nf-lk2-'), H = tmp('nf-home-'); cleanup.push(U1, U2, H)
    // Linux derives the default profile from homedir()/.config; a temp HOME keeps the real one out of it
    const env = isWin ? {} : { HOME: H, XDG_CONFIG_HOME: join(H, '.config') }
    const a = await L(U1, { env })
    let b = null, err = null
    try { b = await L(U2, { env }) } catch (e) { err = e }
    await check('LOCK-1', 'launch', 'two instances with different NOTEPAD_FLUX_USER_DATA run side by side (the single-instance lock follows the override, not the default profile)', async () => {
        assert(!err, 'second instance did not start: ' + String(err?.message).split('\n')[0])
        assert(await b.win.evaluate(() => !!window.electronAPI), 'second instance has no bridge')
        assert(existsSync(join(U2, 'logs', 'main.log')), 'second instance wrote no log in its own userData')
    })
    await check('PROFILE-1', 'launch', 'with the override set, the default profile directory is not created or touched', async () => {
        const def = isWin ? join(process.env.APPDATA, 'notepad-flux') : join(H, '.config', 'notepad-flux')
        if (!existsSync(def)) return def + ' (absent)'
        assert(readdirSync(def).length === 0, 'default profile dir has content: ' + readdirSync(def).join(','))
        return def + ' (exists but empty)'
    })
    await a.app.close().catch(() => {}); if (b) await b.app.close().catch(() => {})
    if (!isWin) {
        const r = await L(null, { env })
        await check('DEFPROFILE-1', 'launch', 'without the override nothing changed: the profile is ~/.config/notepad-flux (HOME redirected to a temp dir for the test) with its log', async () => {
            const def = join(H, '.config', 'notepad-flux')
            assert(existsSync(join(def, 'logs', 'main.log')), 'no log in ' + def)
            assert(readFileSync(join(def, 'logs', 'main.log'), 'utf8').includes(def), 'start block does not name ' + def)
        })
        await r.app.close().catch(() => {})
    }
}

// ---- 957c1bb: promotion of a window whose default tab was left untouched must not leave an orphan row (tab would come back twice)
export async function orphanRows(ctx) {
    const { L, check, ui, sleep, waitFor, assert, eq, tmp, cleanup } = ctx
    const U = tmp('nf-orph-u-'); cleanup.push(U)
    const { app, win: w1 } = await L(U)
    const type = async (p, text) => { await p.locator('.cm-content').click(); await p.keyboard.press('Control+End'); await p.keyboard.type(text) }
    await type(w1, 'ORPH-ONE'); await w1.keyboard.press('Control+n'); await sleep(300); await type(w1, 'ORPH-TWO'); await sleep(1800)
    const wp = app.waitForEvent('window', { timeout: 20000 })
    await w1.getByText('File', { exact: true }).first().click(); await w1.getByText('New Window', { exact: true }).click()
    const w2 = await wp; await w2.waitForLoadState('domcontentloaded'); await sleep(2500)        // the new window is left untouched
    let exited = false; app.process().once('exit', () => { exited = true })
    const closeFirst = () => app.evaluate(({ BrowserWindow }) => { const ws = BrowserWindow.getAllWindows().filter(w => /index\.html/.test(w.webContents.getURL())).sort((a, b) => a.id - b.id); ws[0].close() })
    await closeFirst(); await sleep(4000)                                                         // w2 is promoted: its pristine tab-1 clashes with saved tab-1
    await closeFirst(); await waitFor(() => exited, { timeout: 12000, what: 'app exit' }).catch(() => {})
    await check('ORPHAN-1', 'session', 'saved tabs, an untouched New Window, close the first window, quit, relaunch: every saved tab comes back exactly once (no orphan row from the promotion)', async () => {
        assert(exited, 'app did not exit after the last window closed')
        const r = await L(U)
        const texts = []; const n = (await ui.tabsInfo(r.win)).length
        for (let i = 0; i < n; i++) { await r.win.locator('[class*=tabsList] > div').nth(i).click(); await sleep(300); texts.push((await r.win.evaluate(() => document.querySelector('.cm-content').innerText)).replace(/\n+$/, '')) }
        await r.app.close().catch(() => {})
        eq(texts.filter(t => t === 'ORPH-ONE').length, 1, 'ORPH-ONE copies: ' + JSON.stringify(texts)); eq(texts.filter(t => t === 'ORPH-TWO').length, 1, 'ORPH-TWO copies: ' + JSON.stringify(texts))
        eq(texts.length, 2, 'tab count: ' + JSON.stringify(texts))
    }, { smoke: true })
    await app.close().catch(() => {})
}
