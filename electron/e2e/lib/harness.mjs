// Tiny check registry: PASS/FAIL lines, results JSON, helpers shared by packaged.mjs.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

export const results = []
let smokeOnly = false
export const setSmoke = (v) => { smokeOnly = v }

const line = (r, id, what, note) =>
    console.log(`${r.toUpperCase().padEnd(14)} ${id}  ${what}${note ? `  [${note}]` : ''}`)

// fn returns undefined/true = pass; a string = pass with note; throws = fail.
export async function check(id, area, what, fn, { smoke = false } = {}) {
    if (smokeOnly && !smoke) {
        results.push({ id, area, what, result: 'skipped', note: 'outside smoke subset' })
        return
    }
    globalThis.__cur = id
    try {
        const out = await fn()
        const note = typeof out === 'string' ? out : ''
        results.push({ id, area, what, result: 'pass', note })
        line('pass', id, what, note)
    } catch (e) {
        const note = String(e?.message ?? e).split('\n').slice(0, 14).join(' ~ ').slice(0, 900)
        results.push({ id, area, what, result: 'fail', note })
        line('fail', id, what, note)
    }
}
// Anything that escapes check() (an unhandled rejection, a crash in scenario setup) is recorded as a FAIL and the run goes on,
// so one stray rejection cannot take the final summary with it. Ids get a #n suffix so they never collide with a check id
// (writeResults(merge) keys on id).
const failCount = {}
export function recordFailure(id, what, e) {
    const note = String(e?.stack ?? e?.message ?? e).split('\n').slice(0, 14).join(' ~ ').slice(0, 900)
    const uid = `${id}#${failCount[id] = (failCount[id] || 0) + 1}`
    results.push({ id: uid, area: 'harness', what, result: 'fail', note })
    line('fail', uid, what, note)
}
// A launch that hits Playwright's timeout leaves 3 internal promises rejected that nobody can await (waitForLine in
// electron.launch). They are the bare server-side TimeoutError: message "Timeout <n>ms exceeded." (no "electron.launch:" prefix)
// and a stack made only of playwright-core frames. Anything with an e2e frame, another message or another type is not noise.
export const launchStats = { retries: 0, absorbed: 0 }
export function absorbLaunchNoise(e) {
    if (e?.name !== 'TimeoutError' || !/^Timeout \d+ms exceeded\.$/.test(e.message)) return false
    const frames = String(e.stack).split('\n').slice(1)
    if (!frames.length || !frames.every(l => /playwright-core/.test(l)) || !frames.some(l => /_ProgressController\.run/.test(l))) return false
    launchStats.absorbed++; console.log('NOTE absorbed launch rejection: ' + e.message + ' (Playwright-internal leftover of a timed-out electron.launch)')
    return true
}
// Kill what a timed-out launch left behind (Linux: every process whose environment carries this userData) so it cannot hold the
// single-instance lock for the retry. Elsewhere this is a no-op.
export function killAppsOf(userData) {
    if (!userData || process.platform !== 'linux') return 0
    let n = 0
    for (const p of readdirSync('/proc')) {
        if (!/^\d+$/.test(p) || +p === process.pid) continue
        try { if (readFileSync(`/proc/${p}/environ`, 'latin1').split('\0').includes('NOTEPAD_FLUX_USER_DATA=' + userData)) { process.kill(+p, 'SIGKILL'); n++ } } catch { /* gone or not ours */ }
    }
    return n
}
// Evidence for a launch or exit failure that otherwise leaves nothing to look at (B17): the app's own log, its stderr
// (buffered by launch.mjs on app._nfStderr) and which Notepad Flux processes are alive. Bounded to ~4 KB.
export function diag(label, { userData, app } = {}) {
    const tail = (s, n) => s.length > n ? '...' + s.slice(-n) : s
    let log
    try { log = readFileSync(join(userData, 'logs', 'main.log'), 'utf8').split('\n').slice(-40).join('\n') } catch (e) { log = '(no main.log: ' + (userData ? e.code : 'no userData') + ')' }
    const err = (app?._nfStderr ?? []).join('\n') || '(none captured)'
    let procs = ''
    try {
        procs = process.platform === 'win32'
            ? execFileSync('tasklist', ['/NH', '/FO', 'CSV'], { encoding: 'utf8' }).split('\n').filter(l => /notepad/i.test(l)).join('\n')
            : execFileSync('pgrep', ['-a', '-x', 'notepad-flux'], { encoding: 'utf8' })
    } catch { /* pgrep exits 1 when nothing matches */ }
    console.log(`DIAG ${label}\n--- main.log tail\n${tail(log, 1800)}\n--- app stderr tail\n${tail(err, 1000)}\n--- Notepad Flux processes\n${tail(procs.trim().split('\n').map(l => l.slice(0, 110)).join('\n') || '(none)', 700)}\n--- end DIAG`)
}
// Kill an app that will not close, by pid (and its process tree on Windows), so it cannot hold a lock or a window into the next scenario.
export function killApp(app) {
    const pid = app?.process?.().pid
    if (!pid) return
    try { if (process.platform === 'win32') execFileSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' }); else process.kill(pid, 'SIGKILL') } catch { /* already gone */ }
}
// Every launched app, so a crashed scenario can close what it left running.
export const launched = new Set()
export async function scenarioCrashed(name, e) {
    globalThis.__cur = 'SCENARIO-' + name
    recordFailure('SCENARIO-' + name, `scenario "${name}" threw outside a check (the remaining scenarios still run)`, e)
    await Promise.all([...launched].map(async a => { try { if (await Promise.race([a.close().then(() => 0), new Promise(r => setTimeout(() => r(1), 5000))])) killApp(a) } catch { /* already gone */ } }))
    launched.clear()
}
export function na(id, area, what, reason) {
    results.push({ id, area, what, result: 'not-automatable', note: reason })
    line('not-automatable', id, what, reason)
}
export const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed') }
export const eq = (a, b, m = '') => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`)
}
export const sleep = (ms) => new Promise(r => setTimeout(r, ms))
export async function waitFor(fn, { timeout = 8000, every = 100, what = 'condition' } = {}) {
    const end = Date.now() + timeout
    let last
    while (Date.now() < end) {
        try { const v = await fn(); if (v) return v } catch (e) { last = e }
        await sleep(every)
    }
    throw new Error(`timeout waiting for ${what}${last ? ': ' + last.message : ''}`)
}

// Merge this run into the shared results file: { targets: { <name>: {meta, checks} } }.
export function writeResults(file, target, meta, { merge = false } = {}) {
    let all = { targets: {} }
    try { all = JSON.parse(readFileSync(file, 'utf8')) } catch { /* missing or corrupt: start over */ }
    all.targets ||= {}
    const prev = merge ? (all.targets[target]?.checks ?? []).filter(c => !results.some(r => r.id === c.id)) : []
    all.targets[target] = { meta: merge ? { ...all.targets[target]?.meta, ...meta } : meta, checks: [...prev, ...results] }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(all, null, 2))
}
export const tally = () => results.reduce((a, r) => (a[r.result] = (a[r.result] || 0) + 1, a), {})
