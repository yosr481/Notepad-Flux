// Static checks on the Linux installers (no install, no sudo, never executes the AppImage runtime).
//   node electron/e2e/packaging.mjs            (run from the repo root; artifacts expected in release/)
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { check, na, assert, eq, results, tally, writeResults } from './lib/harness.mjs'

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '../..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const rel = join(root, 'release')
const DEB = join(rel, `Notepad Flux-${pkg.version}-linux-amd64.deb`)
const APP = join(rel, `Notepad Flux-${pkg.version}-x86_64.AppImage`)
const UNP = join(rel, 'linux-unpacked')
const sh = (c, a, o = {}) => execFileSync(c, a, { encoding: 'utf8', maxBuffer: 1 << 28, ...o })
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const work = mkdtempSync(join(tmpdir(), 'nf-pkg-'))
const debRoot = join(work, 'deb'), ctl = join(work, 'ctl'), appRoot = join(work, 'appimage')
mkdirSync(debRoot); mkdirSync(ctl)
for (const f of [DEB, APP, UNP]) if (!existsSync(f)) { console.error('missing ' + f); process.exit(2) }
sh('dpkg-deb', ['-x', DEB, debRoot]); sh('dpkg-deb', ['-e', DEB, ctl])
const field = (k) => (sh('dpkg-deb', ['-f', DEB, k]).trim())

await check('PKG-DEB-1', 'deb', 'control: package notepad-flux, version == package.json, arch amd64', async () => {
    eq([field('Package'), field('Version'), field('Architecture')], ['notepad-flux', pkg.version, 'amd64'])
    return 'Depends: ' + field('Depends') + ' | Recommends: ' + field('Recommends')
})
await check('PKG-DEB-2', 'deb', 'declared Depends cover every shared library the binary links (ldd -> dpkg -S -> dependency closure)', async () => {
    const decl = field('Depends').split(',').map(s => s.trim().split(/[ (|]/)[0]).filter(Boolean)
    // Ubuntu 24.04 renamed many libs to *t64 and keeps the old name as a virtual package: seed both spellings.
    const seeds = decl.flatMap(d => { const r = [d]; try { sh('apt-cache', ['show', d + 't64']); r.push(d + 't64') } catch { /* no t64 variant */ } return r })
    const clos = new Set(sh('apt-cache', ['depends', '--recurse', '--no-recommends', '--no-suggests', '--no-conflicts', '--no-breaks', '--no-replaces', '--no-enhances', ...seeds]).split('\n').filter(l => /^\S/.test(l)).map(l => l.trim().replace(/^<|>$/g, '')))
    const bin = join(debRoot, 'opt/Notepad Flux/notepad-flux')
    const out = sh('ldd', [bin], { env: { ...process.env, LD_LIBRARY_PATH: dirname(bin) } })
    assert(!/not found/.test(out), 'unresolved libs: ' + out.split('\n').filter(l => /not found/.test(l)).join(';'))
    const libs = [...out.matchAll(/=> (\/\S+)/g)].map(m => m[1]).filter(l => !l.startsWith(work))
    const pk = new Set()
    for (const l of libs) { try { const p = sh('dpkg', ['-S', sh('readlink', ['-f', l]).trim()]).split(':')[0].trim(); pk.add(p) } catch { /* unowned */ } }
    assert(pk.size > 10, 'could not map libs to packages (' + pk.size + ')')
    const strip = (n) => n.replace(/:amd64$/, '')
    const missing = [...pk].filter(p => ![...clos].some(c => strip(c) === p) && !['libc6', 'libgcc-s1', 'libstdc++6', 'libm6'].includes(p))
    assert(missing.length === 0, 'linked-library packages not reachable from Depends: ' + missing.join(', '))
    return `${libs.length} libs -> ${pk.size} packages, all in Depends closure (${clos.size} pkgs; host is Ubuntu-family, other distros unverified)`
})
await check('PKG-DEB-3', 'deb', '.desktop: Exec quotes the spaced path, Icon exists, StartupWMClass == app id, Categories set', async () => {
    const d = readFileSync(join(debRoot, 'usr/share/applications/notepad-flux.desktop'), 'utf8')
    assert(/^Exec="\/opt\/Notepad Flux\/notepad-flux" %U$/m.test(d), 'Exec line: ' + (d.match(/^Exec=.*$/m) || [])[0])
    assert(existsSync(join(debRoot, 'opt/Notepad Flux/notepad-flux')), 'Exec target missing')
    assert(/^Icon=notepad-flux$/m.test(d) && existsSync(join(debRoot, 'usr/share/icons/hicolor/512x512/apps/notepad-flux.png')), 'icon')
    assert(/^StartupWMClass=notepad-flux$/m.test(d), 'StartupWMClass'); assert(/^Categories=.*Utility/m.test(d))
    return /^MimeType=/m.test(d) ? 'has MimeType' : 'OBSERVATION: no MimeType= line, so the app is not offered for .md/.txt in "Open with"'
})
await check('PKG-DEB-4', 'deb', 'postinst/postrm are valid bash; postinst links /usr/bin/notepad-flux and chmods chrome-sandbox only when userns is missing', async () => {
    for (const s of ['postinst', 'postrm']) sh('bash', ['-n', join(ctl, s)])
    const p = readFileSync(join(ctl, 'postinst'), 'utf8')
    assert(/update-alternatives --install '\/usr\/bin\/notepad-flux'/.test(p) && /chmod 4755/.test(p) && /unshare --user/.test(p), 'unexpected postinst')
    assert(existsSync(join(debRoot, 'opt/Notepad Flux/resources/apparmor-profile')), 'apparmor profile missing (Ubuntu 24 userns restriction)')
})
await check('PKG-DEB-5', 'deb', 'payload inside the .deb is byte-identical to release/linux-unpacked (binary, app.asar)', async () => {
    for (const f of ['notepad-flux', 'resources/app.asar']) eq(sha(join(debRoot, 'opt/Notepad Flux', f)), sha(join(UNP, f)), f)
})
await check('PKG-ASAR-1', 'asar', 'app.asar ships dist/, main.js and preload.cjs, and no source/secrets', async () => {
    const asar = join(root, 'node_modules/.bin/asar')
    const l = sh(asar, ['list', join(UNP, 'resources/app.asar')])
    for (const f of ['/dist/index.html', '/dist-electron/main.js', '/dist-electron/preload.cjs', '/package.json']) assert(l.includes(f + '\n') || l.includes(f), 'missing ' + f)
    const bad = l.split('\n').filter(x => /^\/(src|release|Docs|reports|coverage|scripts|\.env|\.git)(\/|$)/.test(x) || (/\.(pem|key|p12|pfx)$/.test(x) && !x.startsWith('/node_modules/')))
    assert(bad.length === 0, 'unexpected top-level files shipped: ' + bad.slice(0, 5).join(', '))
})
let off
await check('PKG-APPIMG-1', 'appimage', 'AppImage is a type-2 ELF with a gzip SquashFS payload (commit 616dc6f)', async () => {
    const b = readFileSync(APP).subarray(0, 0x40)
    off = Number(b.readBigUInt64LE(0x28)) + b.readUInt16LE(0x3A) * b.readUInt16LE(0x3C)
    eq(readFileSync(APP).subarray(8, 11).toString('latin1'), 'AI\x02', 'AppImage type-2 magic')
    eq(readFileSync(APP).subarray(off, off + 4).toString('latin1'), 'hsqs', 'squashfs magic at ELF end')
    const s = sh('unsquashfs', ['-s', '-o', String(off), APP]); assert(/Compression gzip/.test(s), s.split('\n').find(l => /Compression/.test(l)))
    return `squashfs at offset ${off}, ` + s.split('\n').find(l => /Compression/.test(l))
})
await check('PKG-APPIMG-2', 'appimage', 'AppImage payload (extracted without running it) has AppRun, desktop+icon and a byte-identical binary/app.asar', async () => {
    sh('unsquashfs', ['-q', '-d', appRoot, '-o', String(off), APP])
    for (const f of ['AppRun', 'notepad-flux.desktop', 'notepad-flux.png']) assert(existsSync(join(appRoot, f)), 'missing ' + f)
    for (const f of ['notepad-flux', 'resources/app.asar']) eq(sha(join(appRoot, f)), sha(join(UNP, f)), f)
    const d = readFileSync(join(appRoot, 'notepad-flux.desktop'), 'utf8')
    return 'desktop Exec: ' + (d.match(/^Exec=.*$/m) || [])[0] + ' (AppImage always runs with --no-sandbox)'
})
na('PKG-APPIMG-3', 'appimage', 'execute the AppImage runtime itself (FUSE mount / --appimage-extract-and-run)', 'this host registers AppImageLauncher as a kernel binfmt handler (flags F) for every AppImage exec; running one would pop AppImageLauncher UI on the real desktop. Payload was extracted with unsquashfs and its AppRun was tested instead.')
na('PKG-DEB-6', 'deb', 'install the .deb system-wide (dpkg -i / apt install), run postinst, launch from /usr/bin', 'needs sudo (password required, forbidden here). Payload extracted with dpkg-deb -x and tested in place; postinst/postrm only syntax-checked.')
for (const d of [work]) rmSync(d, { recursive: true, force: true })
writeResults(join(root, 'Docs/internal/e2e/results-linux.json'), 'installers-static', { at: new Date().toISOString() })
console.log('\n' + JSON.stringify(tally()))
process.exit(results.some(r => r.result === 'fail') ? 1 : 0)
