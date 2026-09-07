// BrowserWindow options builder for Electron main process.
// Pure ESM (no electron import) so contract can be pinned with unit tests.
// Exported object spreads into BrowserWindow config and setWindowOpenHandler's
// overrideBrowserWindowOptions. Each call returns a fresh, independently-mutable
// object graph; no frozen or shared module-level literals.

export function buildWindowOptions({ platform, prefersDark, preloadPath, iconPath }) {
    const backgroundColor = prefersDark ? '#1E1E1E' : '#FFFFFF'

    const baseOptions = {
        backgroundColor,
        icon: iconPath,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
    }

    // titleBarStyle:'hidden' only makes sense paired with the Windows
    // titleBarOverlay, which draws replacement min/max/close glyphs. On Linux
    // 'hidden' removes the native window controls with nothing to replace them,
    // leaving a window that can't be minimised/maximised/closed from its frame;
    // macOS keeps the traffic lights but the renderer has no drag region. So
    // only Windows opts out of the native title bar.
    if (platform === 'win32') {
        baseOptions.titleBarStyle = 'hidden'
        baseOptions.backgroundMaterial = 'mica'
        baseOptions.titleBarOverlay = {
            color: '#00000000',
            symbolColor: prefersDark ? '#CBD5E1' : '#64748b',
            height: 40,
        }
    }

    return baseOptions
}
