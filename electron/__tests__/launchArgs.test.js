import { describe, it, expect } from 'vitest'
import { filesFromArgv } from '../launchArgs.js'

const opts = { cwd: '/home/u', defaultApp: false }

describe('filesFromArgv', () => {
    it('skips the executable and returns absolute paths in order', () => {
        expect(filesFromArgv(['/opt/nf/notepad-flux', '/a/one.md', '/b/two.txt'], opts))
            .toEqual(['/a/one.md', '/b/two.txt'])
    })

    it('returns [] when only the executable is present', () => {
        expect(filesFromArgv(['/opt/nf/notepad-flux'], opts)).toEqual([])
    })

    it('defaultApp (electron .) also skips argv[1]', () => {
        expect(filesFromArgv(['/node_modules/electron/dist/electron', '.', '/a/one.md'], { cwd: '/home/u', defaultApp: true }))
            .toEqual(['/a/one.md'])
    })

    it('packaged (defaultApp false) does NOT skip argv[1]', () => {
        expect(filesFromArgv(['/opt/nf/notepad-flux', '/a/one.md'], opts)).toEqual(['/a/one.md'])
    })

    it('skips Chromium/Electron flags', () => {
        expect(filesFromArgv(
            ['/opt/nf/notepad-flux', '--no-sandbox', '--allow-file-access-from-files', '/a/one.md', '-x'],
            opts,
        )).toEqual(['/a/one.md'])
    })

    it('resolves relative paths against cwd', () => {
        expect(filesFromArgv(['x', 'notes.md', './sub/a.md', '../x.md'], { cwd: '/home/u/proj', defaultApp: false }))
            .toEqual(['/home/u/proj/notes.md', '/home/u/proj/sub/a.md', '/home/u/x.md'])
    })

    it('converts file:// URIs with percent-decoding', () => {
        expect(filesFromArgv(['x', 'file:///home/u/My%20Notes.md', 'file:///tmp/caf%C3%A9.txt'], opts))
            .toEqual(['/home/u/My Notes.md', '/tmp/café.txt'])
    })

    it('skips non-local / malformed file URIs without throwing', () => {
        let out
        expect(() => { out = filesFromArgv(['x', 'file://otherhost/x.md', 'file:///a/%zz.md', 'file:///a/%2Fb.md', '/ok.md'], opts) }).not.toThrow()
        expect(out).toEqual(['/ok.md'])
    })

    it('skips other schemes (http, https, ftp, custom)', () => {
        expect(filesFromArgv(['x', 'http://a.com/x.md', 'https://a.com/y.md', 'ftp://h/z.md', 'notepad-flux://open', '/ok.md'], opts))
            .toEqual(['/ok.md'])
    })

    it('dedupes, keeping first position (also across file:// and plain forms)', () => {
        expect(filesFromArgv(['x', '/a/1.md', '/b/2.md', '/a/1.md', 'file:///b/2.md', '/a/./1.md'], opts))
            .toEqual(['/a/1.md', '/b/2.md'])
    })

    it('rejects any path with a ".." segment that survives (filterAuthorizablePaths semantics), but a relative ../ that resolves is fine', () => {
        // literal ".." in an absolute arg is refused, like authorize-paths does
        expect(filesFromArgv(['x', '/home/u/../etc/passwd'], opts)).toEqual([])
        expect(filesFromArgv(['x', '../x.md'], { cwd: '/home/u/proj', defaultApp: false })).toEqual(['/home/u/x.md'])
    })

    it('keeps names containing ".." that are not segments', () => {
        expect(filesFromArgv(['x', '/a/notes..md', '/a/v1..2.md'], opts)).toEqual(['/a/notes..md', '/a/v1..2.md'])
    })

    it('skips non-strings and empty strings', () => {
        expect(filesFromArgv(['x', '', null, undefined, 42, {}, '/ok.md'], opts)).toEqual(['/ok.md'])
    })

    it('non-array argv gives []', () => {
        expect(filesFromArgv(undefined, opts)).toEqual([])
        expect(filesFromArgv(null, opts)).toEqual([])
        expect(filesFromArgv('/a/b.md', opts)).toEqual([])
    })

    it('does not touch the filesystem: nonexistent and directory-looking paths are returned as-is', () => {
        expect(filesFromArgv(['x', '/definitely/not/here.md', '/tmp'], opts))
            .toEqual(['/definitely/not/here.md', '/tmp'])
    })

    it('a "--" end-of-options marker is skipped as a flag', () => {
        expect(filesFromArgv(['x', '--', '/a/1.md'], opts)).toEqual(['/a/1.md'])
    })
})
