import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Key-safety spec for getEncryptionKey() (branch fix/crypto-key-safety).
// Encrypted-at-rest tabs (NFv1:) are unreadable once the AES key is lost or replaced,
// so these tests are adversarial about states and orderings:
//   A. never destroy/replace a SECURE blob that cannot be read
//   B. corrupt material: only regenerate when there is no SECURE at all
//   C. drop PLAIN only when proven safe across launches (match + real keyring + compare-before-delete)
//   D. migration rollback is compare-before-delete; PLAIN never removed on the migration launch
//   E. data survives the whole lifecycle
// getEncryptionKey is not exported; it is exercised through encrypt/decrypt.
// Key material is observed by behaviour: blobs are built/opened independently with WebCrypto
// from a known base64 key. Every "launch" is a fresh module (vi.resetModules) so the
// module-scope cachedKey is reset, exactly like a new renderer process.

const PLAIN = 'notepad-flux-key';
const SECURE = 'notepad-flux-secure-key';

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s) => new Uint8Array(atob(s).split('').map((c) => c.charCodeAt(0)));
const newKeyB64 = () => b64(crypto.getRandomValues(new Uint8Array(32)));

const importRaw = (keyB64) =>
    crypto.subtle.importKey('raw', fromB64(keyB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

// Independent NFv1 blob maker (no module state).
async function blobWith(keyB64, text) {
    const key = await importRaw(keyB64);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
    const all = new Uint8Array(12 + ct.length);
    all.set(iv);
    all.set(ct, 12);
    return 'NFv1:' + b64(all);
}

// Independent NFv1 opener: proves which key the module's encrypt() used.
async function openWith(keyB64, blob) {
    const all = fromB64(blob.slice(5));
    const key = await importRaw(keyB64);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12));
    return new TextDecoder().decode(pt);
}

// Asserts the module's active key is exactly keyB64, in both directions.
async function expectActiveKey(mod, keyB64) {
    expect(await mod.decrypt(await blobWith(keyB64, 'probe-in'))).toBe('probe-in');
    expect(await openWith(keyB64, await mod.encrypt('probe-out'))).toBe('probe-out');
}

// Fake OS keyring: reversible, distinguishable from plaintext.
const wrap = (s) => 'ENC(' + btoa(s) + ')';
const unwrap = (s) => {
    if (typeof s !== 'string' || !s.startsWith('ENC(')) throw new Error('not a keyring blob');
    return atob(s.slice(4, -1));
};

// `state.locked` simulates a keyring that is locked now and unlocked later.
function installSafeStorage(overrides = {}) {
    const state = { locked: false };
    const safeStorage = {
        isAvailable: vi.fn(async () => true),
        encrypt: vi.fn(async (s) => wrap(s)),
        decrypt: vi.fn(async (s) => {
            if (state.locked) throw new Error('keyring locked');
            return unwrap(s);
        }),
        backend: vi.fn(async () => 'gnome_libsecret'),
        ...overrides,
    };
    window.electronAPI = { safeStorage };
    return { ss: safeStorage, state };
}

async function launch() {
    vi.resetModules();
    return import('../crypto');
}

const snapshot = () => ({ plain: localStorage.getItem(PLAIN), secure: localStorage.getItem(SECURE) });

const expectKeyUnavailable = (p) => expect(p).rejects.toMatchObject({ code: 'KEY_UNAVAILABLE' });

let errSpy, warnSpy;
beforeEach(() => {
    localStorage.clear();
    delete window.electronAPI;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    delete window.electronAPI;
    errSpy.mockRestore();
    warnSpy.mockRestore();
});

// ---------------------------------------------------------------------------
describe('A. unreadable SECURE is never destroyed or replaced', () => {
    const unreadable = [
        ['decrypt throws', () => vi.fn(async () => { throw new Error('keyring locked'); })],
        ["decrypt returns ''", () => vi.fn(async () => '')],
        ['decrypt returns null', () => vi.fn(async () => null)],
        ['decrypt returns undefined', () => vi.fn(async () => undefined)],
        ['decrypt returns a number', () => vi.fn(async () => 12345)],
        ['decrypt returns an object', () => vi.fn(async () => ({}))],
    ];

    for (const [label, mk] of unreadable) {
        it(`${label}, PLAIN present -> uses PLAIN; SECURE byte-identical; PLAIN kept`, async () => {
            const k = newKeyB64();
            const secureBlob = wrap(newKeyB64()); // the real key behind SECURE is unknown to us
            localStorage.setItem(PLAIN, k);
            localStorage.setItem(SECURE, secureBlob);
            const { ss } = installSafeStorage({ decrypt: mk() });
            const mod = await launch();

            await expectActiveKey(mod, k);
            expect(snapshot()).toEqual({ plain: k, secure: secureBlob });
            expect(ss.encrypt).not.toHaveBeenCalled();
        });

        it(`${label}, no PLAIN -> rejects KEY_UNAVAILABLE; nothing generated or written`, async () => {
            const secureBlob = wrap(newKeyB64());
            localStorage.setItem(SECURE, secureBlob);
            const { ss } = installSafeStorage({ decrypt: mk() });
            const mod = await launch();

            await expectKeyUnavailable(mod.encrypt('new text'));
            await expectKeyUnavailable(mod.decrypt(await blobWith(newKeyB64(), 'old')));
            expect(snapshot()).toEqual({ plain: null, secure: secureBlob });
            expect(ss.encrypt).not.toHaveBeenCalled();
        });
    }

    it('KEY_UNAVAILABLE is not cached: once the keyring unlocks, the same session gets the ORIGINAL key', async () => {
        const k = newKeyB64();
        localStorage.setItem(SECURE, wrap(k));
        const { state } = installSafeStorage();
        state.locked = true;
        const mod = await launch();
        const old = await blobWith(k, 'tab written last week');

        await expectKeyUnavailable(mod.decrypt(old));
        await expectKeyUnavailable(mod.encrypt('x')); // second failure: still not a generated key
        expect(snapshot()).toEqual({ plain: null, secure: wrap(k) });

        state.locked = false; // keyring unlocked later, same renderer
        expect(await mod.decrypt(old)).toBe('tab written last week');
        await expectActiveKey(mod, k);
        expect(snapshot()).toEqual({ plain: null, secure: wrap(k) });
    });

    it('SECURE present, window.electronAPI.safeStorage absent, PLAIN present -> uses PLAIN; SECURE byte-identical', async () => {
        const k = newKeyB64();
        const secureBlob = wrap(newKeyB64());
        localStorage.setItem(PLAIN, k);
        localStorage.setItem(SECURE, secureBlob);
        window.electronAPI = {}; // bridge without safeStorage
        const mod = await launch();

        await expectActiveKey(mod, k);
        expect(snapshot()).toEqual({ plain: k, secure: secureBlob });
    });

    for (const [label, setup] of [
        ['no window.electronAPI at all', () => { delete window.electronAPI; }],
        ['window.electronAPI without safeStorage', () => { window.electronAPI = {}; }],
    ]) {
        it(`SECURE present, ${label}, no PLAIN -> rejects KEY_UNAVAILABLE; SECURE not overwritten; no PLAIN written`, async () => {
            const secureBlob = wrap(newKeyB64());
            localStorage.setItem(SECURE, secureBlob);
            setup();
            const mod = await launch();

            await expectKeyUnavailable(mod.encrypt('x'));
            expect(snapshot()).toEqual({ plain: null, secure: secureBlob });
        });
    }
});

// ---------------------------------------------------------------------------
describe('B. corrupt key material', () => {
    // Values that decrypt "successfully" from the keyring but cannot be an AES key.
    const garbage = [
        ['non-base64 text', 'definitely not a key %%%'],
        ['valid base64 of 7 bytes', btoa('7 bytes')],
    ];

    for (const [label, junk] of garbage) {
        it(`SECURE decrypts to ${label}, PLAIN valid -> uses PLAIN; SECURE untouched; PLAIN kept`, async () => {
            const k = newKeyB64();
            localStorage.setItem(PLAIN, k);
            localStorage.setItem(SECURE, wrap(junk));
            const { ss } = installSafeStorage();
            const mod = await launch();

            await expectActiveKey(mod, k);
            expect(snapshot()).toEqual({ plain: k, secure: wrap(junk) });
            expect(ss.encrypt).not.toHaveBeenCalled();
        });

        it(`SECURE decrypts to ${label}, no PLAIN -> KEY_UNAVAILABLE; nothing overwritten (may be a backend mismatch)`, async () => {
            localStorage.setItem(SECURE, wrap(junk));
            const { ss } = installSafeStorage();
            const mod = await launch();

            await expectKeyUnavailable(mod.encrypt('x'));
            expect(snapshot()).toEqual({ plain: null, secure: wrap(junk) });
            expect(ss.encrypt).not.toHaveBeenCalled();
        });
    }

    // Pinned current behaviour, for this one case only: with no SECURE, a corrupt PLAIN
    // already makes the data unreadable, so a fresh key is generated and persisted.
    it('no SECURE, corrupt PLAIN, no Electron -> regenerates a valid 32-byte PLAIN that persists across launches', async () => {
        localStorage.setItem(PLAIN, 'corrupt!!');
        const mod = await launch();
        const blob = await mod.encrypt('after regen');

        const fresh = localStorage.getItem(PLAIN);
        expect(fresh).not.toBe('corrupt!!');
        expect(fromB64(fresh)).toHaveLength(32);
        expect(await openWith(fresh, blob)).toBe('after regen');

        const mod2 = await launch();
        expect(await mod2.decrypt(blob)).toBe('after regen');
    });

    it('no SECURE, corrupt PLAIN, safeStorage available -> regenerates; new key survives the next launch', async () => {
        localStorage.setItem(PLAIN, 'corrupt!!');
        installSafeStorage();
        const mod = await launch();
        const blob = await mod.encrypt('after regen');
        expect(await mod.decrypt(blob)).toBe('after regen');

        const mod2 = await launch();
        expect(await mod2.decrypt(blob)).toBe('after regen');
    });
});

// ---------------------------------------------------------------------------
describe('C. removing PLAIN only when proven safe across launches', () => {
    it('migration launch (PLAIN only, safeStorage available, real backend): writes SECURE, KEEPS PLAIN', async () => {
        const k = newKeyB64();
        localStorage.setItem(PLAIN, k);
        installSafeStorage();
        const mod = await launch();

        await expectActiveKey(mod, k);
        expect(snapshot()).toEqual({ plain: k, secure: wrap(k) });
    });

    it('migration with isAvailable() false: no SECURE, PLAIN kept', async () => {
        const k = newKeyB64();
        localStorage.setItem(PLAIN, k);
        installSafeStorage({ isAvailable: vi.fn(async () => false) });
        const mod = await launch();

        await expectActiveKey(mod, k);
        expect(snapshot()).toEqual({ plain: k, secure: null });
    });

    it('migration with encrypt() throwing: no SECURE, PLAIN kept', async () => {
        const k = newKeyB64();
        localStorage.setItem(PLAIN, k);
        installSafeStorage({ encrypt: vi.fn(async () => { throw new Error('keyring down'); }) });
        const mod = await launch();

        await expectActiveKey(mod, k);
        expect(snapshot()).toEqual({ plain: k, secure: null });
    });

    for (const backend of ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6', 'os']) {
        it(`later launch, SECURE decrypts to PLAIN, backend '${backend}' -> PLAIN removed; SECURE kept; same key`, async () => {
            const k = newKeyB64();
            localStorage.setItem(PLAIN, k);
            localStorage.setItem(SECURE, wrap(k));
            const { ss } = installSafeStorage({ backend: vi.fn(async () => backend) });
            const mod = await launch();

            await expectActiveKey(mod, k);
            expect(ss.backend).toHaveBeenCalled();
            expect(snapshot()).toEqual({ plain: null, secure: wrap(k) });
        });
    }

    for (const [label, backend] of [
        ["backend 'basic_text'", vi.fn(async () => 'basic_text')],
        ["backend 'unknown'", vi.fn(async () => 'unknown')],
        ['backend() resolves undefined', vi.fn(async () => undefined)],
        ['backend() throws', vi.fn(async () => { throw new Error('no handler'); })],
        ['backend() missing from the bridge', undefined],
    ]) {
        it(`later launch, SECURE decrypts to PLAIN, ${label} -> PLAIN kept`, async () => {
            const k = newKeyB64();
            localStorage.setItem(PLAIN, k);
            localStorage.setItem(SECURE, wrap(k));
            const { ss } = installSafeStorage({ backend });
            if (!backend) delete ss.backend;
            const mod = await launch();

            await expectActiveKey(mod, k);
            expect(snapshot()).toEqual({ plain: k, secure: wrap(k) });
        });
    }

    it('later launch, SECURE decrypts to a DIFFERENT valid key -> both kept; key used = SECURE', async () => {
        const plainK = newKeyB64();
        const secureK = newKeyB64();
        localStorage.setItem(PLAIN, plainK);
        localStorage.setItem(SECURE, wrap(secureK));
        installSafeStorage();
        const mod = await launch();

        await expectActiveKey(mod, secureK);
        expect(snapshot()).toEqual({ plain: plainK, secure: wrap(secureK) });
    });

    it('compare-before-delete: PLAIN changed by another window during the async checks -> the new PLAIN is NOT removed', async () => {
        const k = newKeyB64();
        const other = newKeyB64();
        localStorage.setItem(PLAIN, k);
        localStorage.setItem(SECURE, wrap(k));
        // Every async hop into the keyring flips PLAIN (idempotent), so whichever order the
        // implementation awaits decrypt/backend in, PLAIN differs from the checked value
        // by the time it would be removed.
        const flip = () => localStorage.setItem(PLAIN, other);
        installSafeStorage({
            decrypt: vi.fn(async (s) => { flip(); return unwrap(s); }),
            backend: vi.fn(async () => { flip(); return 'gnome_libsecret'; }),
        });
        const mod = await launch();
        await mod.encrypt('trigger key load');

        expect(localStorage.getItem(PLAIN)).toBe(other);
        expect(localStorage.getItem(SECURE)).toBe(wrap(k));
    });

    it('cleanup happens on the launch AFTER migration, not during it (three launches)', async () => {
        const k = newKeyB64();
        localStorage.setItem(PLAIN, k);
        installSafeStorage();

        await expectActiveKey(await launch(), k);
        expect(snapshot()).toEqual({ plain: k, secure: wrap(k) }); // launch 1: migrate, keep PLAIN

        await expectActiveKey(await launch(), k);
        expect(snapshot()).toEqual({ plain: null, secure: wrap(k) }); // launch 2: proven, remove

        await expectActiveKey(await launch(), k); // launch 3: SECURE only
        expect(snapshot()).toEqual({ plain: null, secure: wrap(k) });
    });
});

// ---------------------------------------------------------------------------
describe('D. migration rollback is compare-before-delete', () => {
    it('verify-decrypt returns a different key -> SECURE this call wrote is removed; PLAIN kept and used', async () => {
        const k = newKeyB64();
        localStorage.setItem(PLAIN, k);
        const { ss } = installSafeStorage({ decrypt: vi.fn(async () => newKeyB64()) });
        const mod = await launch();

        await expectActiveKey(mod, k);
        expect(ss.decrypt).toHaveBeenCalledWith(wrap(k)); // the verify step ran
        expect(snapshot()).toEqual({ plain: k, secure: null });
    });

    it('verify-decrypt throws -> SECURE this call wrote is removed; PLAIN kept and used', async () => {
        const k = newKeyB64();
        localStorage.setItem(PLAIN, k);
        installSafeStorage({ decrypt: vi.fn(async () => { throw new Error('cannot decrypt'); }) });
        const mod = await launch();

        await expectActiveKey(mod, k);
        expect(snapshot()).toEqual({ plain: k, secure: null });
    });

    it('verify fails but another window replaced SECURE meanwhile -> that SECURE is left alone; PLAIN kept', async () => {
        const k = newKeyB64();
        const foreign = 'ENC(written-by-another-window)';
        localStorage.setItem(PLAIN, k);
        installSafeStorage({
            decrypt: vi.fn(async () => {
                localStorage.setItem(SECURE, foreign);
                throw new Error('cannot decrypt');
            }),
        });
        const mod = await launch();

        await expectActiveKey(mod, k);
        expect(snapshot()).toEqual({ plain: k, secure: foreign });
    });

    it('verify succeeds -> SECURE kept, PLAIN kept (never removed on the migration launch, even with a real backend)', async () => {
        const k = newKeyB64();
        localStorage.setItem(PLAIN, k);
        const { ss } = installSafeStorage({ backend: vi.fn(async () => 'os') });
        const mod = await launch();

        await expectActiveKey(mod, k);
        expect(ss.decrypt).toHaveBeenCalledWith(wrap(k));
        expect(snapshot()).toEqual({ plain: k, secure: wrap(k) });
    });
});

// ---------------------------------------------------------------------------
describe('E. data safety end-to-end', () => {
    it('ciphertext from a both-keys launch decrypts after cleanup and on a SECURE-only launch', async () => {
        const k = newKeyB64();
        localStorage.setItem(PLAIN, k);
        localStorage.setItem(SECURE, wrap(k));
        installSafeStorage({ backend: vi.fn(async () => 'basic_text') }); // launch 1: no cleanup
        const blob = await (await launch()).encrypt('my notes');
        expect(localStorage.getItem(PLAIN)).toBe(k);

        installSafeStorage(); // launch 2: real keyring -> cleanup
        expect(await (await launch()).decrypt(blob)).toBe('my notes');
        expect(snapshot()).toEqual({ plain: null, secure: wrap(k) });

        installSafeStorage(); // launch 3: SECURE only
        expect(await (await launch()).decrypt(blob)).toBe('my notes');
    });

    it('PLAIN removed by any means -> SECURE alone still opens old ciphertext (no regeneration)', async () => {
        const k = newKeyB64();
        localStorage.setItem(PLAIN, k);
        localStorage.setItem(SECURE, wrap(k));
        installSafeStorage();
        const blob = await (await launch()).encrypt('my notes');

        localStorage.removeItem(PLAIN);
        expect(await (await launch()).decrypt(blob)).toBe('my notes');
        expect(localStorage.getItem(SECURE)).toBe(wrap(k));
    });

    it('legacy (no NFv1:) ciphertext + SECURE unreadable + no PLAIN -> decrypt rejects KEY_UNAVAILABLE, not plaintext passthrough', async () => {
        const k = newKeyB64();
        localStorage.setItem(SECURE, wrap(k));
        const legacy = (await blobWith(k, 'pre-sentinel note')).slice(5); // IV||ct base64, >= 28 bytes
        expect(fromB64(legacy).length).toBeGreaterThanOrEqual(28);
        const { state } = installSafeStorage();
        state.locked = true;

        await expectKeyUnavailable((await launch()).decrypt(legacy));
        expect(snapshot()).toEqual({ plain: null, secure: wrap(k) });

        installSafeStorage(); // keyring back: the same legacy row opens
        expect(await (await launch()).decrypt(legacy)).toBe('pre-sentinel note');
    });

    it('SECURE only + keyring failing -> decrypt of existing ciphertext rejects; next healthy launch still opens it', async () => {
        const k = newKeyB64();
        localStorage.setItem(SECURE, wrap(k));
        const blob = await blobWith(k, 'precious');
        const { state } = installSafeStorage();
        state.locked = true;

        await expectKeyUnavailable((await launch()).decrypt(blob));
        expect(snapshot()).toEqual({ plain: null, secure: wrap(k) });

        installSafeStorage();
        expect(await (await launch()).decrypt(blob)).toBe('precious');
    });
});

// ---------------------------------------------------------------------------
// Spec 3: a newly generated key (no SECURE; PLAIN missing or corrupt) is written as PLAIN
// first, then goes through the same migration as an existing PLAIN key. PLAIN is removed
// only on a later launch per rule C.
describe('3. key generation goes PLAIN first, then the normal migration', () => {
    it('no keys, safeStorage available -> PLAIN and SECURE both hold the new key; it is the active key', async () => {
        installSafeStorage();
        const mod = await launch();
        const blob = await mod.encrypt('first note');

        const { plain, secure } = snapshot();
        expect(plain).not.toBeNull();
        expect(fromB64(plain)).toHaveLength(32);
        expect(secure).toBe(wrap(plain));
        expect(await openWith(plain, blob)).toBe('first note');
    });

    it('PLAIN is already on disk when the keyring is asked to encrypt (a crash there cannot lose the key)', async () => {
        let plainAtEncrypt = 'encrypt never called';
        installSafeStorage({ encrypt: vi.fn(async (s) => { plainAtEncrypt = localStorage.getItem(PLAIN); return wrap(s); }) });
        const mod = await launch();
        await mod.encrypt('x');

        expect(plainAtEncrypt).toBe(localStorage.getItem(PLAIN));
        expect(plainAtEncrypt).not.toBeNull();
    });

    it('generation: the new SECURE is read back (verify step runs)', async () => {
        const { ss } = installSafeStorage();
        await (await launch()).encrypt('x');
        expect(ss.decrypt).toHaveBeenCalledWith(wrap(localStorage.getItem(PLAIN)));
    });

    it('generation: verify mismatch -> SECURE rolled back, PLAIN kept and used', async () => {
        installSafeStorage({ decrypt: vi.fn(async () => newKeyB64()) });
        const mod = await launch();
        const blob = await mod.encrypt('x');
        const { plain, secure } = snapshot();
        expect(secure).toBeNull();
        expect(await openWith(plain, blob)).toBe('x');
    });

    it('generation: verify throws and another window replaced SECURE meanwhile -> that SECURE left alone; PLAIN kept', async () => {
        const foreign = 'ENC(other-window)';
        installSafeStorage({ decrypt: vi.fn(async () => { localStorage.setItem(SECURE, foreign); throw new Error('no'); }) });
        const mod = await launch();
        const blob = await mod.encrypt('x');
        const { plain, secure } = snapshot();
        expect(secure).toBe(foreign);
        expect(await openWith(plain, blob)).toBe('x');
    });

    it('launch 1 generates on basic_text; launch 2 cannot read SECURE -> PLAIN still there, old data opens', async () => {
        installSafeStorage({ backend: vi.fn(async () => 'basic_text') });
        const blob = await (await launch()).encrypt('written on launch 1');
        const plain = localStorage.getItem(PLAIN);
        expect(plain).not.toBeNull();

        installSafeStorage({ decrypt: vi.fn(async () => { throw new Error('backend changed'); }) });
        const mod2 = await launch();
        expect(await mod2.decrypt(blob)).toBe('written on launch 1');
        expect(localStorage.getItem(PLAIN)).toBe(plain);
    });

    it('generation launch keeps PLAIN even on a real keyring; the NEXT launch removes it (rule C)', async () => {
        installSafeStorage({ backend: vi.fn(async () => 'os') });
        const blob = await (await launch()).encrypt('note');
        const plain = localStorage.getItem(PLAIN);
        expect(plain).not.toBeNull();
        expect(localStorage.getItem(SECURE)).toBe(wrap(plain));

        const mod2 = await launch();
        expect(await mod2.decrypt(blob)).toBe('note');
        expect(snapshot()).toEqual({ plain: null, secure: wrap(plain) });
    });

    it('no SECURE, corrupt PLAIN, safeStorage available -> fresh PLAIN replaces the corrupt one, plus SECURE of it', async () => {
        localStorage.setItem(PLAIN, 'corrupt!!');
        installSafeStorage();
        const mod = await launch();
        const blob = await mod.encrypt('y');
        const { plain, secure } = snapshot();
        expect(plain).not.toBe('corrupt!!');
        expect(fromB64(plain)).toHaveLength(32);
        expect(secure).toBe(wrap(plain));
        expect(await openWith(plain, blob)).toBe('y');
    });

    it('no keys, isAvailable() false -> PLAIN only (unchanged)', async () => {
        installSafeStorage({ isAvailable: vi.fn(async () => false) });
        const blob = await (await launch()).encrypt('z');
        const { plain, secure } = snapshot();
        expect(secure).toBeNull();
        expect(await openWith(plain, blob)).toBe('z');
    });

    it('no keys, no Electron -> PLAIN only (unchanged)', async () => {
        const blob = await (await launch()).encrypt('z');
        const { plain, secure } = snapshot();
        expect(secure).toBeNull();
        expect(await openWith(plain, blob)).toBe('z');
    });
});

// ---------------------------------------------------------------------------
// Spec 4: decrypt's legacy (non-NFv1) branch rejects on ANY failure to get the key; only a
// failure of the AES decrypt itself (or bad base64 / too short) keeps plaintext passthrough.
describe('4. legacy decrypt: key errors reject, only AES/format failures pass through', () => {
    const legacyOf = async (k, text) => (await blobWith(k, text)).slice(5);

    it('localStorage quota error while generating the key -> legacy decrypt rejects (not the ciphertext back)', async () => {
        const legacy = await legacyOf(newKeyB64(), 'legacy body');
        const quota = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
        });
        try {
            const mod = await launch();
            await expect(mod.decrypt(legacy)).rejects.toBeDefined();
        } finally {
            quota.mockRestore();
        }
    });

    it('key cannot be persisted -> encrypt rejects instead of using a key that will be lost', async () => {
        const quota = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
        try {
            const mod = await launch();
            await expect(mod.encrypt('would be unreadable next launch')).rejects.toBeDefined();
        } finally {
            quota.mockRestore();
        }
    });

    it('safeStorage.decrypt throwing a non-KEY_UNAVAILABLE error inside key loading still surfaces as a rejection for legacy rows', async () => {
        // SECURE unreadable, no PLAIN: the key is unavailable; whatever code the error carries, legacy must not pass through.
        const k = newKeyB64();
        localStorage.setItem(SECURE, wrap(k));
        installSafeStorage({ decrypt: vi.fn(async () => { throw new TypeError('ipc broke'); }) });
        const legacy = await legacyOf(k, 'legacy body');
        await expect((await launch()).decrypt(legacy)).rejects.toBeDefined();
    });

    it('AES failure with a working key still passes the input through unchanged (pinned)', async () => {
        const mod = await launch();
        const wrongKeyLegacy = await legacyOf(newKeyB64(), 'not ours');
        expect(await mod.decrypt(wrongKeyLegacy)).toBe(wrongKeyLegacy);
    });

    it('invalid base64 and too-short input pass through even while the key is unavailable (no key needed)', async () => {
        localStorage.setItem(SECURE, wrap(newKeyB64()));
        const { state } = installSafeStorage();
        state.locked = true;
        const mod = await launch();
        expect(await mod.decrypt('plain text, not base64!')).toBe('plain text, not base64!');
        expect(await mod.decrypt(btoa('short'))).toBe(btoa('short'));
    });
});

// ---------------------------------------------------------------------------
describe('checkKey() (spec 2 helper)', () => {
    it('is exported and resolves when the key is available', async () => {
        const mod = await launch();
        expect(typeof mod.checkKey).toBe('function');
        await mod.checkKey(); // rejects -> test fails
        expect(localStorage.getItem(PLAIN)).not.toBeNull(); // it really loaded (generated) the key
    });

    it('rejects with KEY_UNAVAILABLE when SECURE is unreadable and there is no PLAIN; writes nothing', async () => {
        const k = newKeyB64();
        localStorage.setItem(SECURE, wrap(k));
        const { state } = installSafeStorage();
        state.locked = true;
        const mod = await launch();
        expect(typeof mod.checkKey).toBe('function');
        await expectKeyUnavailable(mod.checkKey());
        expect(snapshot()).toEqual({ plain: null, secure: wrap(k) });

        state.locked = false; // not cached
        await mod.checkKey();
        await expectActiveKey(mod, k);
    });
});
