import { describe, it, expect } from 'vitest'

import { buildWindowOptions } from '../windowOptions.js'

// ---------------------------------------------------------------------------
// PINNED CONTRACT for electron/windowOptions.js  (TASK 9 / audit B6)
// ---------------------------------------------------------------------------
// buildWindowOptions({ platform, prefersDark, preloadPath, iconPath }) -> object
//
//   A plain options bag meant to be spread into a `BrowserWindow({ ... })`
//   config (and into `overrideBrowserWindowOptions` in setWindowOpenHandler).
//   It carries ONLY the keys listed below — callers add width/height/show/etc.
//
//   platform     : process.platform value ('win32' | 'linux' | 'darwin' | ...)
//   prefersDark  : boolean. Drives the two colour choices below. Truthy/falsy
//                  is enough; tests pass real booleans.
//   preloadPath  : absolute path string, passed straight to webPreferences.preload
//   iconPath     : absolute path string, passed straight to `icon`
//
// ALWAYS PRESENT (every platform):
//   backgroundColor : '#1E1E1E' when prefersDark, else '#FFFFFF'
//                     (app tokens --color-dark-canvas / --color-editor-white;
//                      this is the fix for the white-flash / light-frame bug)
//   icon : iconPath                                (verbatim pass-through)
//   webPreferences : {
//     preload: preloadPath,                        (verbatim pass-through)
//     nodeIntegration: false,                      SECURITY — must stay false
//     contextIsolation: true,                      SECURITY — must stay true
//     sandbox: true,                               SECURITY — must stay true
//   }
//
// WINDOWS ONLY (platform === 'win32') — Windows-only Electron APIs, inert /
// wrong on Linux & macOS, so they must NOT appear elsewhere:
//   titleBarStyle : 'hidden'   — only paired with titleBarOverlay, which draws
//     replacement min/max/close glyphs. On Linux 'hidden' strips the native
//     controls with no replacement (window can't be min/max/closed from its
//     frame — the B6-followup bug); macOS has no renderer drag region. So the
//     native title bar stays on every non-Windows platform.
//   backgroundMaterial : 'mica'
//   titleBarOverlay : {
//     color: '#00000000',                          (transparent)
//     symbolColor: '#CBD5E1' when prefersDark, else '#64748b',
//     height: 40,
//   }
//
// NON-WINDOWS ('linux', 'darwin', anything !== 'win32'):
//   'titleBarStyle'      in opts === false
//   'backgroundMaterial' in opts === false
//   'titleBarOverlay'    in opts === false
//
// Deliberately NOT handled (pinned as decisions, not oversights):
//   - No merging of caller keys — the function returns its own bag only.
//   - prefersDark is not defaulted; caller always supplies it.
//   - No per-platform icon vari/format juggling — iconPath is passed as given.
//   - darwin gets the same treatment as linux (no win-only keys, native title
//     bar); no separate macOS traffic-light / titleBarStyle handling here.
//   - Each call returns a fresh, independently-mutable object graph (no frozen
//     or shared module-level literal).
// ---------------------------------------------------------------------------

const PRELOAD = '/app/dist-electron/preload.js'
const ICON = '/app/public/icons/desktop/icon.png'

const build = (over = {}) =>
    buildWindowOptions({
        platform: 'linux',
        prefersDark: true,
        preloadPath: PRELOAD,
        iconPath: ICON,
        ...over,
    })

describe('buildWindowOptions — case 1: linux + prefersDark', () => {
    const opts = build({ platform: 'linux', prefersDark: true })

    it('sets backgroundColor to the dark canvas token', () => {
        expect(opts.backgroundColor).toBe('#1E1E1E')
    })
    it('does NOT set titleBarStyle (Linux keeps its native window controls)', () => {
        expect('titleBarStyle' in opts).toBe(false)
    })
    it('does NOT set backgroundMaterial (Windows-only API)', () => {
        expect('backgroundMaterial' in opts).toBe(false)
    })
    it('does NOT set titleBarOverlay (Windows-only API)', () => {
        expect('titleBarOverlay' in opts).toBe(false)
    })
    it('carries the exact security-critical webPreferences flags', () => {
        expect(opts.webPreferences).toEqual({
            preload: PRELOAD,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        })
    })
})

describe('buildWindowOptions — case 2: linux + light', () => {
    const opts = build({ platform: 'linux', prefersDark: false })

    it('sets backgroundColor to the editor-white token', () => {
        expect(opts.backgroundColor).toBe('#FFFFFF')
    })
    it('still sets no Windows-only keys', () => {
        expect('backgroundMaterial' in opts).toBe(false)
        expect('titleBarOverlay' in opts).toBe(false)
    })
    it('still sets no titleBarStyle', () => {
        expect('titleBarStyle' in opts).toBe(false)
    })
})

describe('buildWindowOptions — case 3: win32 + prefersDark', () => {
    const opts = build({ platform: 'win32', prefersDark: true })

    it('sets backgroundMaterial to "mica"', () => {
        expect(opts.backgroundMaterial).toBe('mica')
    })
    it('sets a transparent titleBarOverlay background', () => {
        expect(opts.titleBarOverlay.color).toBe('#00000000')
    })
    it('sets the dark caption-glyph colour (visible on a dark bar)', () => {
        expect(opts.titleBarOverlay.symbolColor).toBe('#CBD5E1')
    })
    it('sets the titleBarOverlay height to 40 (tab height)', () => {
        expect(opts.titleBarOverlay.height).toBe(40)
    })
    it('also sets the dark backgroundColor', () => {
        expect(opts.backgroundColor).toBe('#1E1E1E')
    })
    it('sets titleBarStyle "hidden" (paired with the overlay glyphs)', () => {
        expect(opts.titleBarStyle).toBe('hidden')
    })
})

describe('buildWindowOptions — case 4: win32 + light', () => {
    const opts = build({ platform: 'win32', prefersDark: false })

    it('sets the light caption-glyph colour', () => {
        expect(opts.titleBarOverlay.symbolColor).toBe('#64748b')
    })
    it('sets the light backgroundColor', () => {
        expect(opts.backgroundColor).toBe('#FFFFFF')
    })
    it('still sets backgroundMaterial "mica" and the transparent overlay', () => {
        expect(opts.backgroundMaterial).toBe('mica')
        expect(opts.titleBarOverlay.color).toBe('#00000000')
        expect(opts.titleBarOverlay.height).toBe(40)
    })
})

describe('buildWindowOptions — case 5: darwin treated as non-Windows', () => {
    const dark = build({ platform: 'darwin', prefersDark: true })
    const light = build({ platform: 'darwin', prefersDark: false })

    it('sets no backgroundMaterial', () => {
        expect('backgroundMaterial' in dark).toBe(false)
    })
    it('sets no titleBarOverlay', () => {
        expect('titleBarOverlay' in dark).toBe(false)
    })
    it('still resolves backgroundColor from prefersDark', () => {
        expect(dark.backgroundColor).toBe('#1E1E1E')
        expect(light.backgroundColor).toBe('#FFFFFF')
    })
    it('sets no titleBarStyle (native traffic lights + frame)', () => {
        expect('titleBarStyle' in dark).toBe(false)
        expect('titleBarStyle' in light).toBe(false)
    })
})

describe('buildWindowOptions — an unknown platform is also non-Windows', () => {
    const opts = build({ platform: 'freebsd', prefersDark: true })
    it('gets no Windows-only keys', () => {
        expect('backgroundMaterial' in opts).toBe(false)
        expect('titleBarOverlay' in opts).toBe(false)
        expect('titleBarStyle' in opts).toBe(false)
    })
})

describe('buildWindowOptions — case 6: preloadPath / iconPath pass through verbatim', () => {
    const opts = build({
        platform: 'win32',
        prefersDark: true,
        preloadPath: '/somewhere/custom/preload.cjs',
        iconPath: '/somewhere/custom/app-icon.ico',
    })

    it('forwards preloadPath to webPreferences.preload unchanged', () => {
        expect(opts.webPreferences.preload).toBe('/somewhere/custom/preload.cjs')
    })
    it('forwards iconPath to icon unchanged', () => {
        expect(opts.icon).toBe('/somewhere/custom/app-icon.ico')
    })
})

describe('buildWindowOptions — case 7: security flags are explicit and correct', () => {
    for (const platform of ['linux', 'win32', 'darwin']) {
        for (const prefersDark of [true, false]) {
            it(`nodeIntegration=false, contextIsolation=true, sandbox=true (${platform}, dark=${prefersDark})`, () => {
                const wp = build({ platform, prefersDark }).webPreferences
                expect(wp.nodeIntegration).toBe(false)
                expect(wp.contextIsolation).toBe(true)
                expect(wp.sandbox).toBe(true)
            })
        }
    }
})

describe('buildWindowOptions — case 8: independent objects per call', () => {
    it('returns a different top-level object each call', () => {
        expect(build()).not.toBe(build())
    })

    it('does not share the webPreferences reference between calls', () => {
        const a = build()
        const b = build()
        expect(a.webPreferences).not.toBe(b.webPreferences)
        a.webPreferences.sandbox = false
        a.webPreferences.injected = 'x'
        expect(b.webPreferences.sandbox).toBe(true)
        expect('injected' in b.webPreferences).toBe(false)
    })

    it('does not share the titleBarOverlay reference between win32 calls', () => {
        const a = build({ platform: 'win32' })
        const b = build({ platform: 'win32' })
        expect(a.titleBarOverlay).not.toBe(b.titleBarOverlay)
        a.titleBarOverlay.height = 999
        expect(b.titleBarOverlay.height).toBe(40)
    })

    it('the returned object is not frozen (callers spread/extend it)', () => {
        expect(Object.isFrozen(build())).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// electron/main.js source — B6: the duplicated inline options bag is gone,
// both BrowserWindow sites go through buildWindowOptions. main.js imports
// electron so it is not otherwise unit-testable (same rationale as the
// pathSafety / dialogFilters source checks).
// ---------------------------------------------------------------------------
describe('electron/main.js source — B6 dedupe', () => {
    let mainSrc
    it('imports buildWindowOptions from ./windowOptions', async () => {
        const { readFileSync } = await import('node:fs')
        const { fileURLToPath } = await import('node:url')
        const { join, dirname } = await import('node:path')
        mainSrc = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'main.js'),
            'utf-8',
        )
        expect(mainSrc).toMatch(/from\s+['"]\.\/windowOptions(\.js)?['"]/)
    })

    it('no longer hardcodes backgroundMaterial: \'mica\' inline in main.js', () => {
        expect(mainSrc).not.toMatch(/backgroundMaterial:\s*'mica'/)
    })
})
