// Tiny check registry: PASS/FAIL lines, results JSON, helpers shared by packaged.mjs.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

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
    if (existsSync(file)) { try { all = JSON.parse(readFileSync(file, 'utf8')) } catch { /* start over */ } }
    all.targets ||= {}
    const prev = merge ? (all.targets[target]?.checks ?? []).filter(c => !results.some(r => r.id === c.id)) : []
    all.targets[target] = { meta: merge ? { ...all.targets[target]?.meta, ...meta } : meta, checks: [...prev, ...results] }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(all, null, 2))
}
export const tally = () => results.reduce((a, r) => (a[r.result] = (a[r.result] || 0) + 1, a), {})
