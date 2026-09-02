# decisions.md — writer-only, ONE entry per task, non-obvious assumptions only

Reset to this template after each commit.

## Task 1 — crypto.js hardening (P0 data-loss + security)

**Legacy decrypt dispatch heuristic**: Non-NFv1 input that fails base64 decode (atob throws) or is <28 bytes returns input unchanged (treated as plaintext). Input that decodes to >=28 bytes but fails AES-GCM also returns input unchanged (treats it as plaintext or corrupted legacy ciphertext). This is the "acceptable heuristic" mentioned in contract 5 (ponytail-marked).

**Security-property reversal (intentional)**: Pre-change `decrypt` guaranteed it would never return ciphertext-shaped data — every failure collapsed to `''`. That guarantee is deliberately dropped for the non-sentinel legacy path: undecryptable legacy input now returns unchanged. Rationale: the old `''` also destroyed real legacy plaintext (indistinguishable from ciphertext without the sentinel); with the sentinel in place, all new data takes the strict throw path, so the exposure is bounded to pre-migration rows. `crypto.test.js` lines 16–22 were updated to match the new contract (plaintext passthrough).

**`_decryptFailed` skip-guard in saveTab**: When a tab fails decryption on load, it's stored with `_decryptFailed: true` and `content: ''`. The `saveTab` guard skips persistence if both flags are true, preventing `saveSession()` on window close from re-encrypting empty content over the intact ciphertext. Once the user types real content, the tab saves normally and the stale flag is harmless.
