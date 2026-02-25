import { sanitizeText } from './sanitize';

export const sanitizeInput = (text) => {
    return sanitizeText(text);
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
