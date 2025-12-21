/**
 * Utility functions for input validation and sanitization.
 */

/**
 * Removes HTML tags and script elements from a string.
 * @param {string} text - The input text to sanitize.
 * @returns {string} - The sanitized text.
 */
export const sanitizeInput = (text) => {
    if (typeof text !== 'string') return text;
    
    // Remove script tags and their content
    let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove all other HTML tags
    sanitized = sanitized.replace(/<[^>]*>?/gm, '');
    
    return sanitized;
};

/**
 * Validates if a string is a valid email format.
 * @param {string} email - The email to validate.
 * @returns {boolean} - True if valid, false otherwise.
 */
export const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    // Standard email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Escapes special characters for use in simple "queries" or storage keys if needed.
 * For IndexedDB, this is less critical than SQL but good for consistency.
 * @param {string} str - The string to escape.
 * @returns {string} - The escaped string.
 */
export const escapeForQuery = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/['"\\;]/g, (match) => `\\${match}`);
};

/**
 * Limits a string to a maximum length.
 * @param {string} str - The string to limit.
 * @param {number} maxLength - The maximum allowed length.
 * @returns {string} - The truncated string.
 */
export const limitLength = (str, maxLength) => {
    if (typeof str !== 'string') return str;
    return str.substring(0, maxLength);
};
