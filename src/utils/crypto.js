const ENCRYPTION_KEY_NAME = 'notepad-flux-key';

/**
 * Gets or creates a persistent encryption key from subtle crypto
 * In a real-world scenario, this should be more secure, but for this app
 * we'll use a simple approach with a derived key.
 */
async function getEncryptionKey() {
    let keyData = localStorage.getItem(ENCRYPTION_KEY_NAME);
    if (!keyData) {
        // Generate a random key if not exists
        const randomKey = crypto.getRandomValues(new Uint8Array(32));
        keyData = btoa(String.fromCharCode(...randomKey));
        localStorage.setItem(ENCRYPTION_KEY_NAME, keyData);
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
