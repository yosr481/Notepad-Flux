export const sanitizeInput = (text) => {
    if (typeof text !== 'string') return text;
    
    // Remove all angle brackets to prevent any HTML or script tags
    return text.replace(/[<>]/g, '');
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
