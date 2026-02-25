import sanitizeHtml from 'sanitize-html';

export const sanitizeInput = (text) => {
    if (typeof text !== 'string') return text;

    // Remove all HTML tags and attributes, including scripts and their content,
    // using a robust HTML sanitizer instead of brittle regular expressions.
    return sanitizeHtml(text, {
        allowedTags: [],
        allowedAttributes: {}
    });
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
