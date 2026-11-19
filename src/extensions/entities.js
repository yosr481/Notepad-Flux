const namedEntities = {
    'amp': '&',
    'lt': '<',
    'gt': '>',
    'quot': '"',
    'apos': "'",
    'copy': '©',
    'nbsp': ' '
};

// The entities live preview shows decoded; null for anything else (unknown, no semicolon).
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

    // Named entity — use own-property lookup, not inherited
    if (Object.hasOwn(namedEntities, content)) {
        return namedEntities[content];
    }

    return null;
}
