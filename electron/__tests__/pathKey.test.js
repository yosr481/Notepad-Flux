import { describe, it, expect } from 'vitest'
import { pathKey, createIsPathSafe } from '../pathSafety.js'

describe('pathKey', () => {
    it('win32: case- and separator-insensitive', () => {
        expect(pathKey('C:\\Dir\\a.md', 'win32')).toBe(pathKey('c:/dir/A.MD', 'win32'))
        expect(pathKey('C:/Dir/a.md', 'win32')).toBe('c:\\dir\\a.md')
        expect(pathKey('\\\\Host\\Share\\F.md', 'win32')).toBe(pathKey('//host/share/f.md', 'win32'))
    })
    it('win32: different files stay different (drive, name, UNC host)', () => {
        const k = (p) => pathKey(p, 'win32')
        expect(k('C:\\a.md')).not.toBe(k('D:\\a.md')); expect(k('C:\\a.md')).not.toBe(k('C:\\b.md'))
        expect(k('\\\\h1\\s\\a')).not.toBe(k('\\\\h2\\s\\a'))
    })
    it('linux and darwin stay exact (case and backslash are significant)', () => {
        for (const pf of ['linux', 'darwin']) {
            expect(pathKey('/A/b.md', pf)).toBe('/A/b.md')
            expect(pathKey('/A/b.md', pf)).not.toBe(pathKey('/a/B.md', pf))
            expect(pathKey('/a\\b', pf)).toBe('/a\\b')
        }
    })
    it('defaults to the running platform', () => {
        expect(pathKey('/X/y')).toBe(process.platform === 'win32' ? '\\x\\y' : '/X/y')
    })
})

// map-backed realpath that mirrors the fs: returns the path as given for known entries
const realpathOf = (known) => (p) => { if (!known.has(p)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e } return p }

describe('createIsPathSafe with platform win32 (rule evaluated on any OS)', () => {
    const granted = 'c:\\Users\\u\\Docs\\CaseFile.md'
    const mk = (extra = {}) => createIsPathSafe({
        allowedPaths: new Set([granted]), platform: 'win32', grantedReal: new Map([[granted, granted]]),
        realpath: realpathOf(new Set(['C:\\Users\\u\\Docs\\CaseFile.md', 'C:\\Users\\u\\Docs', granted, 'c:\\Users\\u\\Docs\\other.md'])), ...extra,
    })
    it('a grant for one spelling covers upper-case drive, forward slashes and name case', () => {
        const safe = mk()
        expect(safe('c:\\Users\\u\\Docs\\CaseFile.md')).toBe(true)
        expect(safe('C:\\Users\\u\\Docs\\CaseFile.md')).toBe(true)
    })
    it('a directory grant matches children case-insensitively but not a sibling with the same prefix', () => {
        const dir = 'C:\\Proj'
        const safe = createIsPathSafe({ allowedPaths: new Set([dir]), platform: 'win32', grantedReal: new Map([[dir, dir]]),
            realpath: (p) => p })
        expect(safe('c:\\proj\\sub\\a.md')).toBe(true)
        expect(safe('C:\\PROJ')).toBe(true)
        expect(safe('C:\\Proj2\\a.md')).toBe(false)
        expect(safe('C:\\Other\\a.md')).toBe(false)
    })
    it('still refuses a ".." segment and relative paths with the win32 rules', () => {
        const safe = mk()
        expect(safe('C:\\Users\\u\\Docs\\..\\Docs\\CaseFile.md')).toBe(false)
        expect(safe('Docs\\CaseFile.md')).toBe(false)
    })
    it('does not widen to other files', () => {
        expect(mk()('c:\\Users\\u\\Docs\\other.md')).toBe(false)
    })
})

describe('createIsPathSafe on linux stays case-sensitive', () => {
    const safe = createIsPathSafe({ allowedPaths: new Set(['/home/u/Case.md']), platform: 'linux', grantedReal: new Map([['/home/u/Case.md', '/home/u/Case.md']]),
        realpath: (p) => p })
    it('exact spelling is granted, other case is not', () => {
        expect(safe('/home/u/Case.md')).toBe(true)
        expect(safe('/home/u/case.md')).toBe(false)
        expect(safe('/HOME/u/Case.md')).toBe(false)
    })
})
