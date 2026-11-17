import DOMPurify from 'dompurify';

// Footnote ids only (fn-N, fnref-N, fnref-N-M): any other id could clobber document globals.
// Reads the raw attribute: DOMPurify trims the value it hands to hooks, which would let " fn-1" through.
const FOOTNOTE_ID = /^fn(?:ref)?-\d+(?:-\d+)?$/;
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'id' && !FOOTNOTE_ID.test(node.getAttribute('id'))) data.keepAttr = false;
});

export const sanitizeHTML = (html) => {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'code', 'del', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'img', 'hr', 'blockquote', 'span', 'sup', 'section'],
        ALLOWED_ATTR: ['href', 'title', 'class', 'src', 'alt', 'id'],
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
