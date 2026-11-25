const namedCache = new Map();

// Numeric and every HTML5 named entity (via the platform decoder below); null for anything else (unknown, no semicolon).
export function decodeEntity(entity) {
    // entity is the whole token including & and ;
    if (!entity.startsWith('&') || !entity.endsWith(';')) {
        return null;
    }

    const content = entity.slice(1, -1);  // Remove & and ;

    // Numeric: &#...;
    if (content.startsWith('#')) {
        if (content.startsWith('#x') || content.startsWith('#X')) {
            // Hex: &#xABC;
            const hex = content.slice(2);
            if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
            const num = parseInt(hex, 16);
            if (!Number.isFinite(num) || num > 0x10FFFF) return null;
            // Reject control chars, surrogates
            if (num < 0x20 || (num >= 0x7F && num <= 0x9F) || (num >= 0xD800 && num <= 0xDFFF)) return null;
            return String.fromCodePoint(num);
        } else {
            // Decimal: &#123;
            const digits = content.slice(1);
            if (!/^[0-9]+$/.test(digits)) return null;
            const num = parseInt(digits, 10);
            if (!Number.isFinite(num) || num > 0x10FFFF) return null;
            // Reject control chars, surrogates
            if (num < 0x20 || (num >= 0x7F && num <= 0x9F) || (num >= 0xD800 && num <= 0xDFFF)) return null;
            return String.fromCodePoint(num);
        }
    }

    // Named: platform decoder answers; unchanged = unknown. Map, not object, so inherited names can't hit.
    if (!/^[A-Za-z0-9]+$/.test(content)) return null;
    if (!namedCache.has(content)) {
        const out = decodeAttrEntities(entity);
        // Legacy no-semicolon names (&not, &amp...) match as a prefix of an unknown name: &notreal; -> "¬real;".
        // Only &semi; yields a lone ";", no real name decodes to text ending in ";".
        namedCache.set(content, out === entity || (out.length > 1 && out.endsWith(';')) ? null : out);
    }
    return namedCache.get(content);
}

// Attribute values (abbr title, link destination): every HTML5 entity, one pass, same as export. The platform
// parser decodes each matched entity inside a detached <textarea>, which is RCDATA: it makes text only, never
// elements (even </textarea> is no end tag without a start tag), so nothing can fire; CSP script-src 'self' backs it. Unknown names and malformed numerics come back unchanged.
let scratch;
export function decodeAttrEntities(str) {
    return str.replace(/&[^&;\s]*;/g, (e) => {
        scratch ??= document.createElement("textarea");
        scratch.innerHTML = e;
        return scratch.value;
    });
}
