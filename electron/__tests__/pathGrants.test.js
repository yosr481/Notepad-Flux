import { describe, it, expect } from 'vitest'
import { hasDotDotSegment, createIsPathSafe } from '../pathSafety.js'
import { filterAuthorizablePaths } from '../authorizePaths.js'

describe('hasDotDotSegment', () => {
    it('flags a ".." segment with either separator, at any position', () => {
        for (const p of ['/a/../b', '/a/..', '/../a', 'C:\\a\\..\\b', '/a\\..\\b', '..', '../x'])
            expect(hasDotDotSegment(p), p).toBe(true)
    })
    it('does not flag names that merely contain dots', () => {
        for (const p of ['/a/notes..md', '/a/v1..2.md', '/a/..hidden', '/a/...', '/a/.. md', '/a/x..', '/a/.', '/a/..a/b', 'C:\\a\\b..c'])
            expect(hasDotDotSegment(p), p).toBe(false)
    })
})

describe('filterAuthorizablePaths guard', () => {
    it('keeps notes..md and v1..2.md, drops traversal and relative paths', () => {
        expect(filterAuthorizablePaths(['/a/notes..md', '/a/v1..2.md', '/a/../b', '/a/b/..', 'rel/x.md', '', 5, null]))
            .toEqual(['/a/notes..md', '/a/v1..2.md'])
    })
    it('non-array input gives []', () => expect(filterAuthorizablePaths('x')).toEqual([]))
})

describe('createIsPathSafe: ".." handling', () => {
    const safe = createIsPathSafe({ allowedPaths: new Set(['/a']), realpath: (p) => p })
    it('allows a file named notes..md inside a granted dir', () => expect(safe('/a/notes..md')).toBe(true))
    it('still refuses a real traversal segment', () => {
        expect(safe('/a/../etc/passwd')).toBe(false)
        expect(safe('/a/sub/..')).toBe(false)
    })
})

// map-backed realpath: links = { path: target }; throws like fs for unknown paths
const fakeFs = (existing, links = {}) => (p) => {
    let cur = p
    for (let i = 0; i < 10 && links[cur]; i++) cur = links[cur]
    // resolve links of a leading directory
    for (const [from, to] of Object.entries(links)) if (cur.startsWith(from + '/')) cur = to + cur.slice(from.length)
    if (!existing.has(cur)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e }
    return cur
}

describe('createIsPathSafe: grants bound to the real path at grant time', () => {
    it('refuses a granted file that was later replaced by a symlink to another file (SEC-5b)', () => {
        const links = {}
        const existing = new Set(['/home/u/x.md', '/etc/secret', '/home/u'])
        const realpath = fakeFs(existing, links)
        const grantedReal = new Map([['/home/u/x.md', '/home/u/x.md']])
        const safe = createIsPathSafe({ allowedPaths: new Set(['/home/u/x.md']), realpath, grantedReal })
        expect(safe('/home/u/x.md')).toBe(true)
        links['/home/u/x.md'] = '/etc/secret'                       // swap
        expect(safe('/home/u/x.md')).toBe(false)
        expect(safe('/etc/secret')).toBe(false)
    })
    it('without a bound real path (legacy) the old check-time behaviour is the fallback, i.e. the swap is NOT detected', () => {
        const links = { '/home/u/x.md': '/etc/secret' }
        const realpath = fakeFs(new Set(['/home/u/x.md', '/etc/secret', '/home/u']), links)
        const safe = createIsPathSafe({ allowedPaths: new Set(['/home/u/x.md']), realpath })
        expect(safe('/home/u/x.md')).toBe(true)
    })
    it('a file granted through a symlinked directory stays allowed (real path captured at grant)', () => {
        const links = { '/link': '/data/real' }
        const realpath = fakeFs(new Set(['/data/real', '/data/real/n.md', '/data']), links)
        const grantedReal = new Map([['/link/n.md', '/data/real/n.md']])
        const safe = createIsPathSafe({ allowedPaths: new Set(['/link/n.md']), realpath, grantedReal })
        expect(safe('/link/n.md')).toBe(true)
        expect(safe('/data/real/n.md')).toBe(true)
        expect(safe('/data/real/other.md')).toBe(false)
    })
    it('a Save As target granted before it exists (real = realParent/name): once the dialog write created it, saves pass; before that, a check on it is refused (unchanged from the old behaviour)', () => {
        const existing = new Set(['/data/real', '/data'])
        const realpath = fakeFs(existing, { '/link': '/data/real' })
        const grantedReal = new Map([['/link/new.md', '/data/real/new.md']])
        const safe = createIsPathSafe({ allowedPaths: new Set(['/link/new.md']), realpath, grantedReal })
        expect(safe('/link/new.md')).toBe(false)           // main never calls isPathSafe here: the save dialog branch writes directly
        existing.add('/data/real/new.md')
        expect(safe('/link/new.md')).toBe(true)
    })
    it('a Save As grant made before the file existed is refused if the name later becomes a symlink elsewhere', () => {
        const links = {}
        const existing = new Set(['/d', '/etc/secret', '/d/new.md'])
        const realpath = fakeFs(existing, links)
        const grantedReal = new Map([['/d/new.md', '/d/new.md']])
        const safe = createIsPathSafe({ allowedPaths: new Set(['/d/new.md']), realpath, grantedReal })
        expect(safe('/d/new.md')).toBe(true)
        links['/d/new.md'] = '/etc/secret'
        expect(safe('/d/new.md')).toBe(false)
    })
    it('a directory grant still covers its children and not a sibling with the same prefix', () => {
        const realpath = fakeFs(new Set(['/g', '/g/a.md', '/gx', '/gx/a.md']))
        const safe = createIsPathSafe({ allowedPaths: new Set(['/g']), realpath, grantedReal: new Map([['/g', '/g']]) })
        expect(safe('/g/a.md')).toBe(true); expect(safe('/gx/a.md')).toBe(false)
    })
    it('a stale entry (no frozen real path, file gone) is skipped without throwing', () => {
        const safe = createIsPathSafe({ allowedPaths: new Set(['/gone', '/ok']), realpath: fakeFs(new Set(['/ok', '/ok/f'])), grantedReal: new Map() })
        expect(safe('/ok/f')).toBe(true)
    })
})
