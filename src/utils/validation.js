export const sanitizeInput = (text) => {
    if (typeof text !== 'string') return text;
    
    let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    sanitized = sanitized.replace(/<[^>]*>?/gm, '');
    
    return sanitized;
};

export const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const escapeForQuery = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/['"\\;]/g, (match) => `\\${match}`);
};

export const limitLength = (str, maxLength) => {
    if (typeof str !== 'string') return str;
    return str.substring(0, maxLength);
};
