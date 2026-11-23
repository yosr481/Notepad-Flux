// Tiny check registry: PASS/FAIL lines, results JSON, helpers shared by packaged.mjs.
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
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
        dumpLaunched('check ' + id + ' failed')
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
// Per-run evidence file (set by the runner, truncated at start). Every diag() block is also appended here in full, so a
// Windows run leaves it next to results-windows.json even when the console scrolled away.
let diagFile = null
// The previous run's file is kept as <name>.prev (one level), so a targeted rerun does not wipe the evidence of the failing run.
// Evidence is best effort: a write failure (AV lock, EBUSY) never fails a check or a scenario.
const addDiag = (s) => { if (diagFile) try { appendFileSync(diagFile, s) } catch { /* best effort */ } }
export const setDiagFile = (f) => {
    try {
        mkdirSync(dirname(f), { recursive: true })
        try { renameSync(f, f + '.prev') } catch { /* no previous run */ }
        writeFileSync(f, `# e2e diagnostics ${new Date().toISOString()} (${process.platform})\n`)
        diagFile = f
    } catch (e) { diagFile = null; console.log('WARN no diag file, running without: ' + e.message) }
}
// Things the harness did on its own (a leftover app killed...). Written into the results meta by writeResults.
export const events = []
export const note = (msg) => { events.push(msg); console.log('NOTE ' + msg); addDiag(`[note] ${msg}\n`) }
// Is the tracked app process still alive, and its pid and command line as Playwright spawned it.
export const procInfo = (app) => { const p = app?.process?.(); return p ? `pid=${p.pid} alive=${p.exitCode === null && p.signalCode === null} cmd=${[p.spawnfile, ...(p.spawnargs ?? []).slice(1)].join(' ').slice(0, 300)}` : '(no process)' }
// Evidence for a launch or exit failure that otherwise leaves nothing to look at (B17): the app's own log, its stderr/stdout
// (buffered by launch.mjs on app._nfStderr) and which Notepad Flux processes are alive. preload = text from launch.mjs about the
// preload path the app was given. The console block is bounded to ~4 KB; the diag file gets the full tails (main.log 200 lines).
export function diag(label, { userData, app, stderr, preload } = {}) {
    const tail = (s, n) => s.length > n ? '...' + s.slice(-n) : s
    let log
    try { log = readFileSync(join(userData, 'logs', 'main.log'), 'utf8') } catch (e) { log = '(no main.log: ' + (userData ? e.code : 'no userData') + ')' }
    const err = (stderr ?? app?._nfStderr ?? []).join('\n') || '(none captured)'
    let procs = ''
    try {
        procs = process.platform === 'win32'
            ? execFileSync('powershell', ['-NoProfile', '-Command', "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'Notepad Flux.exe' } | ForEach-Object { \"$($_.ProcessId) parent=$($_.ParentProcessId) $($_.CommandLine)\" }"], { encoding: 'utf8', timeout: 15000 })
            : execFileSync('pgrep', ['-a', '-x', 'notepad-flux'], { encoding: 'utf8', timeout: 5000 })
    } catch (e) { procs = process.platform === 'win32' ? '(process query failed: ' + String(e.message).split('\n')[0] + ')' : '' /* pgrep exits 1 when nothing matches */ }
    const procList = procs.trim().split('\n').map(l => l.slice(0, 260)).join('\n') || '(none)'
    const head = `DIAG ${label}\n--- tracked app\n${procInfo(app)}${preload ? '\n--- preload\n' + preload : ''}`
    console.log(`${head}\n--- main.log tail\n${tail(log.split('\n').slice(-40).join('\n'), 1800)}\n--- app stderr/stdout tail\n${tail(err, 1000)}\n--- Notepad Flux processes\n${tail(procList, 900)}\n--- end DIAG`)
    addDiag(`\n[${new Date().toISOString()}] ${head}\n--- main.log tail\n${tail(log.split('\n').slice(-200).join('\n'), 20000)}\n--- app stderr/stdout tail\n${tail(err, 8000)}\n--- Notepad Flux processes\n${procList}\n--- end DIAG\n`)
}
// A failing check: file the evidence of every app still running (file only: the console already has the FAIL line).
function dumpLaunched(label) {
    if (!diagFile) return
    for (const a of launched) {
        const log = (() => { try { return readFileSync(join(a._nfUserData, 'logs', 'main.log'), 'utf8').split('\n').slice(-120).join('\n') } catch (e) { return '(no main.log: ' + e.code + ')' } })()
        addDiag(`\n[${new Date().toISOString()}] ${label}: ${procInfo(a)}\n--- main.log tail\n${log}\n--- app stderr/stdout tail\n${(a._nfStderr ?? []).join('\n')}\n--- end\n`)
    }
}
// Kill an app that will not close, by pid (the process tree via /T on Windows, via killAppsOf(userData) on Linux), so it cannot hold a lock or a window into the next scenario.
export function killApp(app) {
    const pid = app?.process?.().pid
    if (!pid) return
    try {
        if (process.platform === 'win32') execFileSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore', timeout: 5000 })
        else { killAppsOf(app._nfUserData); process.kill(pid, 'SIGKILL') }   // the whole tree: every process carrying this userData in its environment
    } catch { /* already gone */ }
}
// Every launched app, so a crashed scenario can close what it left running.
export const launched = new Set()
// End of a scenario: any app still running is a leak that could hold the single-instance lock or a window into the next one.
// Kill it by pid (tree), record which one, and drop it from launched.
export async function reap(scenario) {
    for (const a of [...launched]) {
        const p = a.process?.()
        if (!p || p.exitCode !== null || p.signalCode !== null) { launched.delete(a); continue }
        const info = procInfo(a)
        diag(`scenario "${scenario}" ended with an app still running; killing it`, { userData: a._nfUserData, app: a })
        killApp(a); launched.delete(a)
        for (let i = 0; i < 20 && p.exitCode === null && p.signalCode === null; i++) await sleep(100)   // killAppsOf may have taken a sibling too: let its exit register before the next entry
        note(`reaped leftover app after scenario "${scenario}": ${info}`)
    }
}
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
    const m = { ...meta, events: [...events] }
    all.targets[target] = { meta: merge ? { ...all.targets[target]?.meta, ...m } : m, checks: [...prev, ...results] }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(all, null, 2))
}
export const tally = () => results.reduce((a, r) => (a[r.result] = (a[r.result] || 0) + 1, a), {})
