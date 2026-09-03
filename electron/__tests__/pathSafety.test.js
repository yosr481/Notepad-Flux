import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createIsPathSafe } from '../pathSafety.js'

// ---------------------------------------------------------------------------
// PINNED CONTRACT for electron/pathSafety.js  (TASK 10 / P1-12 / P1-13)
// ---------------------------------------------------------------------------
// createIsPathSafe({ allowedPaths, realpath }) -> (filePath) => boolean
//
//   allowedPaths : iterable of absolute path strings, exactly as main.js adds
//                  them (i.e. `resolve(userPickedPath)` results — lexical, NOT
//                  yet realpath'd). A Set is what main.js passes.
//   realpath     : (p: string) => string   synchronous. MUST mirror
//                  fs.realpathSync: returns the canonical path, THROWS if p
//                  does not exist. The factory injects fs.realpathSync in
//                  production; tests inject a map-backed fake.
//
// Returned predicate, order of checks (pin — must run top to bottom):
//   1. Non-string / empty / null / undefined  -> false      (before anything)
//   2. Lexical guard, on the ORIGINAL filePath string, BEFORE any fs call:
//        - not absolute            -> false
//        - contains ".."           -> false
//   3. Canonicalise the request:
//        real = realpath(resolve(filePath))
//        - if that throws (ENOENT — e.g. a brand-new file for `save-file`):
//          real = realpath(resolve(dirname(resolve(filePath))))   (the PARENT)
//          - if the parent realpath ALSO throws -> false
//   4. For each allowed entry:
//        allowedReal = realpath(entry)
//        - if that throws (entry deleted since being added) -> skip this entry,
//          no crash, keep scanning the rest
//        - match if   real === allowedReal
//                 or  real.startsWith(allowedReal + sep)
//      No allowed entry matches -> false. Empty allowlist -> always false.
//
// Deliberately NOT handled (pinned as decisions, not oversights):
//   - No path wraparound / normalisation beyond node's resolve().
//   - Trailing-slash variants of allowed entries are not special-cased.
//   - Windows drive-letter casing is not special-cased (suite runs posix).
//   - The predicate never touches the real filesystem itself — every fs fact
//     comes through the injected `realpath`.
// ---------------------------------------------------------------------------

// Map-backed fake for `realpath`: keys that are present resolve to their value
// (use an identity mapping `p: p` for "exists, not a symlink"); any key absent
// from the map throws ENOENT, exactly like fs.realpathSync on a missing path.
const fakeRealpath = (map) => (p) => {
    if (Object.prototype.hasOwnProperty.call(map, p)) return map[p]
    const err = new Error(`ENOENT: no such file or directory, lstat '${p}'`)
    err.code = 'ENOENT'
    throw err
}

describe('createIsPathSafe — input guard (check 1)', () => {
    const isPathSafe = createIsPathSafe({
        allowedPaths: new Set(['/safe']),
        realpath: fakeRealpath({ '/safe': '/safe' }),
    })

    it('rejects null', () => expect(isPathSafe(null)).toBe(false))
    it('rejects undefined', () => expect(isPathSafe(undefined)).toBe(false))
    it('rejects the empty string', () => expect(isPathSafe('')).toBe(false))
    it('rejects a number', () => expect(isPathSafe(123)).toBe(false))
    it('rejects zero (falsy non-string)', () => expect(isPathSafe(0)).toBe(false))
    it('rejects an object', () => expect(isPathSafe({})).toBe(false))
    it('rejects an array', () => expect(isPathSafe(['/safe/x'])).toBe(false))
})

describe('createIsPathSafe — lexical guard (check 2), before any fs call', () => {
    // realpath here THROWS for everything: proves the guard returns false
    // without ever consulting the filesystem.
    const explode = () => { throw new Error('realpath must not be called') }
    const isPathSafe = createIsPathSafe({
        allowedPaths: new Set(['/safe']),
        realpath: explode,
    })

    it('rejects a relative path', () => {
        expect(isPathSafe('safe/notes.md')).toBe(false)
    })
    it('rejects a bare filename', () => {
        expect(isPathSafe('notes.md')).toBe(false)
    })
    it('rejects an absolute path containing ".."', () => {
        expect(isPathSafe('/safe/../etc/passwd')).toBe(false)
    })
    it('rejects "./" relative-with-dot form', () => {
        expect(isPathSafe('./notes.md')).toBe(false)
    })
    it('rejects a path whose ".." would still land inside an allowed dir', () => {
        // The ".." string is refused outright — we do not "resolve then trust".
        expect(isPathSafe('/safe/sub/../ok.md')).toBe(false)
    })
})

describe('createIsPathSafe — exact match (check 4, real === allowedReal)', () => {
    it('accepts a filePath whose realpath equals an allowed entry realpath', () => {
        const isPathSafe = createIsPathSafe({
            allowedPaths: new Set(['/safe/notes.md']),
            realpath: fakeRealpath({ '/safe/notes.md': '/safe/notes.md' }),
        })
        expect(isPathSafe('/safe/notes.md')).toBe(true)
    })

    it('matches on the REALPATH of the allowed entry, not its lexical form', () => {
        // Allowed entry is itself a symlink: lexically "/link/notes.md",
        // really "/real/notes.md". A request for the real path is allowed.
        const isPathSafe = createIsPathSafe({
            allowedPaths: new Set(['/link/notes.md']),
            realpath: fakeRealpath({
                '/link/notes.md': '/real/notes.md',
                '/real/notes.md': '/real/notes.md',
            }),
        })
        expect(isPathSafe('/real/notes.md')).toBe(true)
    })
})

describe('createIsPathSafe — containment (check 4, startsWith allowedReal + sep)', () => {
    const isPathSafe = createIsPathSafe({
        allowedPaths: new Set(['/foo/bar']),
        realpath: fakeRealpath({
            '/foo/bar': '/foo/bar',
            '/foo/bar/child.md': '/foo/bar/child.md',
            '/foo/bar/a/b/deep.md': '/foo/bar/a/b/deep.md',
            '/foo/barbaz': '/foo/barbaz',
            '/foo/barbaz/x.md': '/foo/barbaz/x.md',
        }),
    })

    it('accepts a direct child of an allowed dir', () => {
        expect(isPathSafe('/foo/bar/child.md')).toBe(true)
    })
    it('accepts a deeply nested descendant', () => {
        expect(isPathSafe('/foo/bar/a/b/deep.md')).toBe(true)
    })
    it('rejects a sibling dir sharing a name prefix ("/foo/barbaz" vs "/foo/bar")', () => {
        expect(isPathSafe('/foo/barbaz')).toBe(false)
    })
    it('rejects a file inside that prefix-sharing sibling dir', () => {
        expect(isPathSafe('/foo/barbaz/x.md')).toBe(false)
    })
})

describe('createIsPathSafe — symlink escape (P1-12, the core bug)', () => {
    // allowed = /safe.  /safe/link is lexically in-tree but its realpath is
    // /etc/passwd — must be REJECTED. Pre-fix code (lexical resolve only)
    // wrongly accepts this.
    const isPathSafe = createIsPathSafe({
        allowedPaths: new Set(['/safe']),
        realpath: fakeRealpath({
            '/safe': '/safe',
            '/safe/link': '/etc/passwd',
        }),
    })

    it('rejects an in-tree symlink whose target is outside every allowed dir', () => {
        expect(isPathSafe('/safe/link')).toBe(false)
    })

    it('rejects when a mid-path component is a symlink pointing out of tree', () => {
        // /safe/out is a symlinked dir -> /elsewhere ; /safe/out/notes.md
        // realpath is /elsewhere/notes.md.
        const isPathSafe2 = createIsPathSafe({
            allowedPaths: new Set(['/safe']),
            realpath: fakeRealpath({
                '/safe': '/safe',
                '/safe/out/notes.md': '/elsewhere/notes.md',
            }),
        })
        expect(isPathSafe2('/safe/out/notes.md')).toBe(false)
    })

    it('still accepts an in-tree symlink whose target is ALSO inside an allowed dir', () => {
        const isPathSafe3 = createIsPathSafe({
            allowedPaths: new Set(['/safe']),
            realpath: fakeRealpath({
                '/safe': '/safe',
                '/safe/link': '/safe/real/notes.md',
            }),
        })
        expect(isPathSafe3('/safe/link')).toBe(true)
    })
})

describe('createIsPathSafe — non-existent target / new file for save-file (check 3 parent fallback)', () => {
    it('accepts a brand-new file directly inside an allowed dir', () => {
        const isPathSafe = createIsPathSafe({
            allowedPaths: new Set(['/safe']),
            realpath: fakeRealpath({
                '/safe': '/safe',
                // '/safe/new.md' intentionally absent -> realpath throws ENOENT
            }),
        })
        expect(isPathSafe('/safe/new.md')).toBe(true)
    })

    it('accepts a brand-new file in an existing subdir of an allowed dir', () => {
        const isPathSafe = createIsPathSafe({
            allowedPaths: new Set(['/safe']),
            realpath: fakeRealpath({
                '/safe': '/safe',
                '/safe/sub': '/safe/sub',
            }),
        })
        expect(isPathSafe('/safe/sub/new.md')).toBe(true)
    })

    it('rejects a brand-new file whose parent is a symlink pointing out of tree', () => {
        // /safe/evillink -> /tmp ; new file /safe/evillink/new.md must be refused.
        const isPathSafe = createIsPathSafe({
            allowedPaths: new Set(['/safe']),
            realpath: fakeRealpath({
                '/safe': '/safe',
                '/safe/evillink': '/tmp',
                // '/safe/evillink/new.md' absent -> ENOENT -> parent fallback
            }),
        })
        expect(isPathSafe('/safe/evillink/new.md')).toBe(false)
    })

    it('rejects a new file when the parent dir also does not exist (double ENOENT)', () => {
        const isPathSafe = createIsPathSafe({
            allowedPaths: new Set(['/safe']),
            realpath: fakeRealpath({ '/safe': '/safe' }),
        })
        expect(isPathSafe('/safe/nope/new.md')).toBe(false)
    })

    it('rejects a new file outside every allowed dir', () => {
        const isPathSafe = createIsPathSafe({
            allowedPaths: new Set(['/safe']),
            realpath: fakeRealpath({ '/safe': '/safe', '/tmp': '/tmp' }),
        })
        expect(isPathSafe('/tmp/new.md')).toBe(false)
    })
})

describe('createIsPathSafe — allowed entry whose realpath throws (check 4, pin 7)', () => {
    it('skips a stale allowed entry without crashing and still matches a good one', () => {
        const isPathSafe = createIsPathSafe({
            // first entry was deleted from disk since being added
            allowedPaths: new Set(['/gone', '/safe']),
            realpath: fakeRealpath({
                '/safe': '/safe',
                '/safe/notes.md': '/safe/notes.md',
                // '/gone' absent -> realpath throws
            }),
        })
        expect(isPathSafe('/safe/notes.md')).toBe(true)
    })

    it('returns false (no throw) when the ONLY allowed entry is stale', () => {
        const isPathSafe = createIsPathSafe({
            allowedPaths: new Set(['/gone']),
            realpath: fakeRealpath({
                '/gone/notes.md': '/gone/notes.md',
            }),
        })
        expect(() => isPathSafe('/gone/notes.md')).not.toThrow()
        expect(isPathSafe('/gone/notes.md')).toBe(false)
    })
})

describe('createIsPathSafe — empty allowlist', () => {
    it('rejects any otherwise-valid path when nothing is allowed', () => {
        const isPathSafe = createIsPathSafe({
            allowedPaths: new Set(),
            realpath: fakeRealpath({ '/safe/notes.md': '/safe/notes.md' }),
        })
        expect(isPathSafe('/safe/notes.md')).toBe(false)
    })
})

describe('createIsPathSafe — multiple allowed roots', () => {
    const isPathSafe = createIsPathSafe({
        allowedPaths: new Set(['/docs', '/projects/notepad']),
        realpath: fakeRealpath({
            '/docs': '/docs',
            '/projects/notepad': '/projects/notepad',
            '/docs/a.md': '/docs/a.md',
            '/projects/notepad/b.md': '/projects/notepad/b.md',
            '/projects/other/c.md': '/projects/other/c.md',
        }),
    })

    it('accepts a file under the first root', () => {
        expect(isPathSafe('/docs/a.md')).toBe(true)
    })
    it('accepts a file under the second root', () => {
        expect(isPathSafe('/projects/notepad/b.md')).toBe(true)
    })
    it('rejects a file under a non-allowed sibling root', () => {
        expect(isPathSafe('/projects/other/c.md')).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// P1-13: the userData tree must no longer be on the allowlist. main.js is not
// otherwise unit-testable (imports electron), so assert against its source.
// ---------------------------------------------------------------------------
describe('electron/main.js source — P1-13 userData allowlist entry dropped', () => {
    const mainSrc = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '..', 'main.js'),
        'utf-8',
    )

    it('does not allowlist the whole userData tree', () => {
        expect(mainSrc).not.toMatch(/allowedPaths\.add\(\s*resolve\(\s*userDataPath\s*\)\s*\)/)
    })

    it('routes path safety through the extracted pathSafety module', () => {
        expect(mainSrc).toMatch(/from\s+['"]\.\/pathSafety(\.js)?['"]/)
    })
})
