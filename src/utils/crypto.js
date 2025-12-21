const ENCRYPTION_KEY_NAME = 'notepad-flux-key';
const SECURE_KEY_NAME = 'notepad-flux-secure-key';

/**
 * Gets or creates a persistent encryption key.
 * To protect the key on disk, we use Electron's safeStorage API when available.
 * This ensures the key is encrypted with OS-level credentials (e.g., DPAPI on Windows, Keychain on macOS).
 */
async function getEncryptionKey() {
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
        keyData = btoa(String.fromCharCode(...randomKey));
        
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
    } else if (keyData && !secureKeyData && window.electronAPI?.safeStorage) {
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

    const rawKey = new Uint8Array(atob(keyData).split('').map(c => c.charCodeAt(0)));
    return await crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
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
    
    return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedBase64) {
    if (!encryptedBase64) return encryptedBase64;
    
    try {
        const combined = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)));
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
        console.error('Decryption failed:', e);
        // If decryption fails, it might be plaintext (migration case) or corrupted
        return encryptedBase64;
    }
}
