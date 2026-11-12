// Binary-file guard: sniff the first 8000 bytes for a NUL (0x00) byte.
// Presence of NUL indicates binary; absence suggests text. Pure (no electron
// import) so it can be unit-tested; electron/main.js's read-file and
// read-file-content handlers use it to refuse binary files.

export function isProbablyText(buf) {
    // Only Buffer and Uint8Array are text-readable; anything else is false.
    if (!buf || typeof buf !== 'object') return false
    if (!(buf instanceof Buffer || buf instanceof Uint8Array)) return false

    // Scan bytes at indices 0..7999 (first 8000) for NUL.
    const limit = Math.min(buf.length, 8000)
    for (let i = 0; i < limit; i++) {
        if (buf[i] === 0x00) return false
    }

    return true
}
