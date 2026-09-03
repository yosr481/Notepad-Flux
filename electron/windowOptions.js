// BrowserWindow options builder for Electron main process.
// Pure ESM (no electron import) so contract can be pinned with unit tests.
// Exported object spreads into BrowserWindow config and setWindowOpenHandler's
// overrideBrowserWindowOptions. Each call returns a fresh, independently-mutable
// object graph; no frozen or shared module-level literals.

export function buildWindowOptions({ platform, prefersDark, preloadPath, iconPath }) {
    const backgroundColor = prefersDark ? '#1E1E1E' : '#FFFFFF'

    const baseOptions = {
        titleBarStyle: 'hidden',
        backgroundColor,
        icon: iconPath,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
    }

    // Windows-only Electron APIs; must not appear on linux/darwin/unknown platforms
    if (platform === 'win32') {
        baseOptions.backgroundMaterial = 'mica'
        baseOptions.titleBarOverlay = {
            color: '#00000000',
            symbolColor: prefersDark ? '#CBD5E1' : '#64748b',
            height: 40,
        }
    }

    return baseOptions
}
