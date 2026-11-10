import { describe, it, expect } from 'vitest'
import { isAppPage } from '../appPage.js'

const posixOpts = { devUrl: undefined, indexPath: '/opt/Notepad Flux/resources/app.asar/dist/index.html', platform: 'linux' }
const winOpts = { devUrl: undefined, indexPath: 'C:\\Program Files\\Notepad Flux\\resources\\app.asar\\dist\\index.html', platform: 'win32' }
const OWN = 'file:///opt/Notepad%20Flux/resources/app.asar/dist/index.html'

describe('isAppPage (posix)', () => {
    it('accepts the packaged index.html', () => expect(isAppPage(OWN, posixOpts)).toBe(true))
    it('ignores hash and query', () => {
        expect(isAppPage(OWN + '#/x', posixOpts)).toBe(true)
        expect(isAppPage(OWN + '?a=1#b', posixOpts)).toBe(true)
    })
    it('decodes percent-encoded spaces; the raw-space form too', () => {
        expect(isAppPage('file:///opt/Notepad Flux/resources/app.asar/dist/index.html', posixOpts)).toBe(true)
    })
    it('rejects ".." traversal out of the app dir', () => {
        expect(isAppPage('file:///opt/Notepad%20Flux/resources/app.asar/dist/../../../../../etc/hostname', posixOpts)).toBe(false)
        expect(isAppPage('file:///opt/Notepad%20Flux/resources/app.asar/dist/%2e%2e/%2e%2e/%2e%2e/etc/hostname', posixOpts)).toBe(false)
    })
    it('accepts a ".." path that normalises back to index.html', () => {
        expect(isAppPage('file:///opt/Notepad%20Flux/resources/app.asar/dist/sub/../index.html', posixOpts)).toBe(true)
    })
    it('rejects other local files, including siblings and look-alikes', () => {
        for (const u of ['file:///etc/passwd', 'file:///opt/Notepad%20Flux/resources/app.asar/dist/other.html',
            'file:///opt/Notepad%20Flux/resources/app.asar/dist/index.html.bak', 'file:///opt/Notepad%20Flux/resources/app.asar/dist/', 'file:///'])
            expect(isAppPage(u, posixOpts), u).toBe(false)
    })
    it('rejects an encoded slash that would smuggle a path', () => {
        expect(isAppPage('file:///opt/Notepad%20Flux/resources/app.asar/dist%2Findex.html', posixOpts)).toBe(false)
    })
    it('rejects non-file schemes', () => {
        for (const u of ['https://example.com/', 'http://localhost/', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://x/', 'about:blank', 'blob:file:///x'])
            expect(isAppPage(u, posixOpts), u).toBe(false)
    })
    it('rejects non-string and garbage input without throwing', () => {
        for (const u of [undefined, null, 42, {}, [], '', 'not a url', 'file://', 'file://%zz'])
            expect(isAppPage(u, posixOpts), String(u)).toBe(false)
    })
    it('rejects a file URL with a foreign host on posix', () => {
        expect(isAppPage('file://evil/opt/Notepad%20Flux/resources/app.asar/dist/index.html', posixOpts)).toBe(false)
    })
    it('accepts file://localhost/ form of the own page', () => {
        expect(isAppPage('file://localhost/opt/Notepad%20Flux/resources/app.asar/dist/index.html', posixOpts)).toBe(true)
    })
    it('dev server: any URL under devUrl is the app, others are not', () => {
        const o = { ...posixOpts, devUrl: 'http://localhost:5173' }
        expect(isAppPage('http://localhost:5173/', o)).toBe(true)
        expect(isAppPage('http://localhost:5173/#x', o)).toBe(true)
        expect(isAppPage('http://localhost:9999/', o)).toBe(false)
        expect(isAppPage('https://example.com/', o)).toBe(false)
    })
    it('dev server: a look-alike host that merely starts with devUrl is NOT the app (KNOWN DEFECT: raw startsWith accepts it)', () => {
        expect(isAppPage('http://localhost:5173.evil.test/', { ...posixOpts, devUrl: 'http://localhost:5173' })).toBe(false)
    })
    it('in dev (no packaged page) file URLs outside indexPath are still rejected', () => {
        expect(isAppPage('file:///etc/passwd', { ...posixOpts, devUrl: 'http://localhost:5173' })).toBe(false)
    })
})

describe('isAppPage (win32 rules, evaluated on any OS)', () => {
    const OWNW = 'file:///C:/Program%20Files/Notepad%20Flux/resources/app.asar/dist/index.html'
    it('accepts the packaged index.html', () => expect(isAppPage(OWNW, winOpts)).toBe(true))
    it('drive letter and path case are insensitive', () => {
        expect(isAppPage('file:///c:/program%20files/notepad%20flux/resources/app.asar/dist/index.html', winOpts)).toBe(true)
        expect(isAppPage('file:///C:/PROGRAM%20FILES/NOTEPAD%20FLUX/RESOURCES/APP.ASAR/DIST/INDEX.HTML', winOpts)).toBe(true)
    })
    it('ignores hash and query', () => expect(isAppPage(OWNW + '?x=1#y', winOpts)).toBe(true))
    it('rejects another drive and other files', () => {
        expect(isAppPage('file:///D:/Program%20Files/Notepad%20Flux/resources/app.asar/dist/index.html', winOpts)).toBe(false)
        expect(isAppPage('file:///C:/Windows/win.ini', winOpts)).toBe(false)
        expect(isAppPage('file:///C:/Program%20Files/Notepad%20Flux/resources/app.asar/dist/other.html', winOpts)).toBe(false)
    })
    it('rejects UNC file://server/share/... even with an identical tail', () => {
        expect(isAppPage('file://server/share/Program%20Files/Notepad%20Flux/resources/app.asar/dist/index.html', winOpts)).toBe(false)
        expect(isAppPage('file://evil/C$/Program%20Files/Notepad%20Flux/resources/app.asar/dist/index.html', winOpts)).toBe(false)
        expect(isAppPage('file:////server/share/x.html', winOpts)).toBe(false)
    })
    it('rejects ".." traversal and backslash tricks', () => {
        expect(isAppPage('file:///C:/Program%20Files/Notepad%20Flux/resources/app.asar/dist/../../../../Windows/win.ini', winOpts)).toBe(false)
        expect(isAppPage('file:///C:/Program%20Files/Notepad%20Flux/resources/app.asar/dist/..%5C..%5Cx', winOpts)).toBe(false)
    })
    it('non-file schemes and non-strings are rejected', () => {
        expect(isAppPage('https://example.com', winOpts)).toBe(false)
        expect(isAppPage(null, winOpts)).toBe(false)
    })
    it('a UNC indexPath (installed on a share) matches its own UNC URL only', () => {
        const o = { ...winOpts, indexPath: '\\\\server\\share\\app\\dist\\index.html' }
        expect(isAppPage('file://server/share/app/dist/index.html', o)).toBe(true)
        expect(isAppPage('file://other/share/app/dist/index.html', o)).toBe(false)
    })
})
