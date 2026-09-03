import DOMPurify from 'dompurify';

export const sanitizeHTML = (html) => {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'code', 'del', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'img', 'hr', 'blockquote', 'span'],
        ALLOWED_ATTR: ['href', 'title', 'class', 'src', 'alt'],
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false
    });
};

export const sanitizeText = (text) => {
    if (typeof text !== 'string') return text;
    return DOMPurify.sanitize(text, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
    });
};
