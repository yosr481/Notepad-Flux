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
        // Try to get the secure key first
        let secureKeyData = localStorage.getItem(SECURE_KEY_NAME);
        let keyData = null;

        if (secureKeyData && window.electronAPI?.safeStorage) {
            try {
                // Decrypt the key using OS-level secure storage
                keyData = await window.electronAPI.safeStorage.decrypt(secureKeyData);
            } catch (e) {
                console.error('Failed to decrypt secure key:', e);
                // Fallback to legacy key or re-generation
            }
        }

        if (!keyData) {
            // Fallback to legacy plaintext key if exists
            keyData = localStorage.getItem(ENCRYPTION_KEY_NAME);
        }

        if (!keyData) {
            // Generate a new random key if none exists
            const randomKey = crypto.getRandomValues(new Uint8Array(32));
            keyData = uint8ToBase64(randomKey);

            // Try to store it securely if possible
            if (window.electronAPI?.safeStorage) {
                try {
                    const isAvailable = await window.electronAPI.safeStorage.isAvailable();
                    if (isAvailable) {
                        const encryptedKey = await window.electronAPI.safeStorage.encrypt(keyData);
                        localStorage.setItem(SECURE_KEY_NAME, encryptedKey);
                    } else {
                        localStorage.setItem(ENCRYPTION_KEY_NAME, keyData);
                    }
                } catch (e) {
                    console.error('Failed to store key securely:', e);
                    localStorage.setItem(ENCRYPTION_KEY_NAME, keyData);
                }
            } else {
                // Not in Electron environment (e.g. browser tests)
                localStorage.setItem(ENCRYPTION_KEY_NAME, keyData);
            }
        } else if (!secureKeyData && window.electronAPI?.safeStorage) {
            // Migration: keyData exists in plaintext, try to secure it
            try {
                const isAvailable = await window.electronAPI.safeStorage.isAvailable();
                if (isAvailable) {
                    const encryptedKey = await window.electronAPI.safeStorage.encrypt(keyData);
                    localStorage.setItem(SECURE_KEY_NAME, encryptedKey);
                    // Optionally remove the legacy plaintext key for better security
                    // localStorage.removeItem(ENCRYPTION_KEY_NAME);
                }
            } catch (e) {
                console.warn('Migration to secure storage failed:', e);
            }
        }

        try {
            const rawKey = base64ToUint8(keyData);
            const key = await crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: 'AES-GCM' },
                false,
                ['encrypt', 'decrypt']
            );
            cachedKey = key;
            return key;
        } catch (e) {
            // Corrupt key material would otherwise throw here and wedge every
            // encrypt/decrypt call (including session load on startup). Regenerate;
            // tabs encrypted with the old key become unreadable (handled by decrypt).
            console.error('Encryption key corrupt — regenerating:', e);
            const randomKey = crypto.getRandomValues(new Uint8Array(32));
            const fresh = uint8ToBase64(randomKey);
            try {
                localStorage.removeItem(SECURE_KEY_NAME);
                localStorage.removeItem(ENCRYPTION_KEY_NAME);
                cachedKey = null; // Clear memo on regeneration
                if (window.electronAPI?.safeStorage && await window.electronAPI.safeStorage.isAvailable()) {
                    localStorage.setItem(SECURE_KEY_NAME, await window.electronAPI.safeStorage.encrypt(fresh));
                } else {
                    localStorage.setItem(ENCRYPTION_KEY_NAME, fresh);
                }
            } catch (persistErr) {
                console.error('Failed to persist regenerated key:', persistErr);
            }
            const rawKey = base64ToUint8(fresh);
            const key = await crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: 'AES-GCM' },
                false,
                ['encrypt', 'decrypt']
            );
            cachedKey = key;
            return key;
        }
    };

    // Wrap key create/migrate branch in Web Lock (P1-9) if available
    if (navigator?.locks?.request) {
        return await navigator.locks.request('notepad-flux-key', doKeyWork);
    } else {
        return await doKeyWork();
    }
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

        const key = await getEncryptionKey();
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
        console.error('Legacy decryption failed:', e);
        return encryptedBase64;
    }
}
