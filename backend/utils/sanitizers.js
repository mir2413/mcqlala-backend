/**
 * Sanitization Utilities
 * Prevents XSS and injection attacks by sanitizing user input
 */

/**
 * Strips HTML tags from string to prevent XSS
 */
const stripHtmlTags = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '').trim();
};

/**
 * Escapes special characters for safe HTML display
 */
const escapeHtml = (str) => {
    if (typeof str !== 'string') return str;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    return str.replace(/[&<>"'\/]/g, (char) => map[char]);
};

/**
 * Unescapes HTML entities (for display)
 */
const unescapeHtml = (str) => {
    if (typeof str !== 'string') return str;
    const map = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#x27;': "'",
        '&#39;': "'",
        '&#x2F;': '/'
    };
    let result = str;
    Object.entries(map).forEach(([entity, char]) => {
        result = result.replace(new RegExp(entity, 'g'), char);
    });
    return result;
};

/**
 * Sanitizes object recursively
 * Removes HTML tags from all string fields except specified ones
 */
const sanitizeObject = (obj, skipFields = ['password', 'newPassword', 'token']) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, skipFields));
    }
    
    const sanitized = {};
    for (const key in obj) {
        if (skipFields.includes(key)) {
            sanitized[key] = obj[key];
        } else if (typeof obj[key] === 'string') {
            sanitized[key] = stripHtmlTags(obj[key]).trim();
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitized[key] = sanitizeObject(obj[key], skipFields);
        } else {
            sanitized[key] = obj[key];
        }
    }
    return sanitized;
};

/**
 * Prevents MongoDB injection by escaping special characters
 */
const sanitizeMongoQuery = (str) => {
    if (typeof str !== 'string') return str;
    // Escape regex special characters and MongoDB operators
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
             .replace(/\$/g, '\\$');
};

/**
 * Validates and sanitizes object IDs
 */
const sanitizeMongoId = (id) => {
    if (typeof id !== 'string') return null;
    // MongoDB ObjectId must be 24 hex characters
    return /^[a-f\d]{24}$/i.test(id) ? id : null;
};

/**
 * Removes null/undefined values from object
 */
const removeEmptyFields = (obj) => {
    const sanitized = {};
    for (const key in obj) {
        if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
            sanitized[key] = obj[key];
        }
    }
    return sanitized;
};

/**
 * Safely parses JSON with error handling
 */
const safeJsonParse = (str, defaultValue = null) => {
    try {
        return JSON.parse(str);
    } catch (e) {
        console.warn('JSON parse error:', e.message);
        return defaultValue;
    }
};

/**
 * Validates and sanitizes email
 */
const sanitizeEmail = (email) => {
    if (typeof email !== 'string') return null;
    const sanitized = email.toLowerCase().trim();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(sanitized) ? sanitized : null;
};

/**
 * Sanitizes URL to prevent open redirect attacks
 */
const sanitizeUrl = (url) => {
    if (typeof url !== 'string') return '/';
    
    try {
        // If it's a relative URL, ensure it starts with /
        if (url.startsWith('/')) {
            return url;
        }
        // Don't allow absolute URLs with protocols
        if (url.match(/^https?:\/\//i)) {
            return '/';
        }
        // Default to home
        return '/';
    } catch (e) {
        return '/';
    }
};

module.exports = {
    stripHtmlTags,
    escapeHtml,
    unescapeHtml,
    sanitizeObject,
    sanitizeMongoQuery,
    sanitizeMongoId,
    removeEmptyFields,
    safeJsonParse,
    sanitizeEmail,
    sanitizeUrl
};
