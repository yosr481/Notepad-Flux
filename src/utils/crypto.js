const ENCRYPTION_KEY_NAME = 'notepad-flux-key';
const SECURE_KEY_NAME = 'notepad-flux-secure-key';
const SENTINEL = 'NFv1:';

// Module-scope CryptoKey memo (P1-10)
let cachedKey = null;

/**
 * Chunk-safe base64 encoding (handles large arrays without RangeError from spread operator).
 * Processes data in 0x8000-byte (32KB) slices to avoid "Maximum call stack size exceeded" on large arrays.
 */
function uint8ToBase64(arr) {
    const chunkSize = 0x8000;
    let result = '';
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        result += String.fromCharCode(...chunk);
    }
    return btoa(result);
}

/**
 * Decode base64 to Uint8Array.
 */
function base64ToUint8(b64) {
    return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
}

const keyUnavailable = () => Object.assign(
    new Error('The encryption key is unavailable (is the system keyring locked?). Saved tabs stay as they are on disk.'),
    { code: 'KEY_UNAVAILABLE' }
);

const importRaw = (b64) => crypto.subtle.importKey('raw', base64ToUint8(b64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

// null for anything that isn't usable key material.
async function tryImport(b64) {
    if (typeof b64 !== 'string' || !b64) return null;
    try { return await importRaw(b64); } catch { return null; }
}

// First launch with a plaintext key: write the secure copy, keep the plaintext one.
// The plaintext copy goes only on a later launch that reads the secure copy back.
// A secure copy that doesn't read back is removed, unless another window replaced it.
async function migrateToSecure(ss, plain) {
    if (!ss) return;
    try {
        if (!(await ss.isAvailable())) return;
        const blob = await ss.encrypt(plain);
        localStorage.setItem(SECURE_KEY_NAME, blob);
        let ok = false;
        try { ok = (await ss.decrypt(blob)) === plain; } catch { /* treated as a failed check */ }
        if (!ok && localStorage.getItem(SECURE_KEY_NAME) === blob) localStorage.removeItem(SECURE_KEY_NAME);
    } catch (e) {
        console.warn('Migration to secure storage failed:', e);
    }
}

// Drop the plaintext key once a later launch read the same key from the secure copy,
// and only on a real keyring: on Linux 'basic_text' is a fixed-key obfuscation, so the
// plaintext copy is the only real recovery path there.
async function removePlainIfSafe(ss, plain) {
    let backend;
    try { backend = await ss?.backend?.(); } catch { return; }
    if (typeof backend !== 'string' || !backend || backend === 'basic_text' || backend === 'unknown') return;
    try {
        if (localStorage.getItem(ENCRYPTION_KEY_NAME) === plain) localStorage.removeItem(ENCRYPTION_KEY_NAME);
    } catch (e) {
        console.warn('Could not remove the plaintext key:', e);
    }
}

/**
 * Gets or creates a persistent encryption key.
 * To protect the key on disk, we use Electron's safeStorage API when available.
 * This ensures the key is encrypted with OS-level credentials (e.g., DPAPI on Windows, Keychain on macOS).
 */
async function getEncryptionKey() {
    // Return cached key if available (P1-10)
    if (cachedKey) {
        return cachedKey;
    }

    const doKeyWork = async () => {
        const ss = window.electronAPI?.safeStorage;
        const secure = localStorage.getItem(SECURE_KEY_NAME);
        const plain = localStorage.getItem(ENCRYPTION_KEY_NAME);

        if (secure) {
            let fromSecure = null;
            if (ss) {
                try { fromSecure = await ss.decrypt(secure); } catch (e) { console.warn('Secure key unreadable:', e); }
            }
            const secureKey = await tryImport(fromSecure);
            if (secureKey) {
                if (plain && plain === fromSecure) await removePlainIfSafe(ss, plain);
                cachedKey = secureKey;
                return secureKey;
            }
            // The secure copy exists but can't be read now (keyring locked or changed,
            // backend mismatch). Never replace it: the data on disk is encrypted with it,
            // and it may read fine on the next launch.
            const plainKey = await tryImport(plain);
            if (plainKey) {
                cachedKey = plainKey;
                return plainKey;
            }
            throw keyUnavailable();
        }

        if (plain) {
            const plainKey = await tryImport(plain);
            if (plainKey) {
                await migrateToSecure(ss, plain);
                cachedKey = plainKey;
                return plainKey;
            }
            // Corrupt plaintext key and no secure copy: the data was unreadable anyway.
            console.error('Encryption key corrupt — regenerating');
        }

        // A new key starts as plaintext and is secured the same way as an old one, so an
        // unreliable backend on this first launch can't leave a secure copy as the only copy.
        const fresh = uint8ToBase64(crypto.getRandomValues(new Uint8Array(32)));
        localStorage.setItem(ENCRYPTION_KEY_NAME, fresh);
        await migrateToSecure(ss, fresh);
        cachedKey = await importRaw(fresh);
        return cachedKey;
    };

    // Wrap key create/migrate branch in Web Lock (P1-9) if available
    if (navigator?.locks?.request) {
        return await navigator.locks.request('notepad-flux-key', doKeyWork);
    } else {
        return await doKeyWork();
    }
}

// Rejects (KEY_UNAVAILABLE) when the key can't be read now; writes nothing in that case.
export async function checkKey() {
    await getEncryptionKey();
}

export async function encrypt(text) {
    if (!text) return text;

    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Sentinel + base64(IV ‖ ciphertext)
    return SENTINEL + uint8ToBase64(combined);
}

export async function decrypt(encryptedBase64) {
    if (!encryptedBase64) return encryptedBase64;

    // Handle NFv1-prefixed ciphertext (contract 3, P0-1)
    if (encryptedBase64.startsWith(SENTINEL)) {
        try {
            const body = encryptedBase64.slice(SENTINEL.length);
            const combined = base64ToUint8(body);
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);

            const key = await getEncryptionKey();
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                data
            );

            return new TextDecoder().decode(decrypted);
        } catch (e) {
            // Tampered or corrupted NFv1 blob — throw to reject the promise
            console.error('NFv1 decryption failed:', e);
            throw e;
        }
    }

    // Handle legacy plaintext or legacy ciphertext (contracts 4, 5)
    try {
        const combined = base64ToUint8(encryptedBase64);
        if (combined.length < 28) {
            // Too short to be valid ciphertext (12-byte IV + 16-byte tag minimum),
            // treat as plaintext that happens to be valid base64
            return encryptedBase64;
        }

        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        // A key we can't get is not "this was plaintext": showing ciphertext as text would
        // get it saved back as content.
        let key;
        try { key = await getEncryptionKey(); } catch (keyErr) { throw Object.assign(keyErr, { fromKey: true }); }
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        return new TextDecoder().decode(decrypted);
    } catch (e) {
        // ponytail: non-NFv1 passthrough is bounded to pre-migration rows only. The NFv1:
        // sentinel caps the ceiling — all new data takes the throw path (contract 3). For
        // legacy input that fails atob or AES-GCM: treat as plaintext and return unchanged.
        // Rationale: a legacy ciphertext whose key was lost is byte-indistinguishable from
        // plaintext without the sentinel. Returning '' (old behavior) destroyed both real
        // legacy plaintext and irrecoverable lost-key ciphertext equally; passthrough is
        // the only heuristic that can preserve real plaintext without a marker.
        if (e?.fromKey) throw e;
        console.error('Legacy decryption failed:', e);
        return encryptedBase64;
    }
}
