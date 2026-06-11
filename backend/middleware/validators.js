/**
 * Input Validation Middleware
 * Validates and sanitizes all incoming requests
 * Prevents injection attacks and malformed data
 */

const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) && email.length <= 254;
};

const validateUsername = (username) => {
    if (!username || typeof username !== 'string') return false;
    // Allow alphanumeric, underscore, hyphen, 3-32 chars
    return /^[a-zA-Z0-9_-]{3,32}$/.test(username);
};

const validatePassword = (password) => {
    if (!password || typeof password !== 'string') return false;
    // Min 6 chars, at least one letter and one number
    return password.length >= 6 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
};

const validateMongoId = (id) => {
    if (!id || typeof id !== 'string') return false;
    return /^[a-f\d]{24}$/i.test(id);
};

const validateStringField = (value, maxLength = 1000, minLength = 1) => {
    if (typeof value !== 'string') return false;
    const len = value.trim().length;
    return len >= minLength && len <= maxLength;
};

const validateNumberField = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const num = Number(value);
    return !isNaN(num) && num >= min && num <= max;
};

const validateArrayField = (value, maxLength = 100) => {
    return Array.isArray(value) && value.length <= maxLength;
};

/**
 * Validates user registration data
 */
const validateRegisterData = (data) => {
    const errors = [];
    
    if (!validateUsername(data.username)) {
        errors.push('Username must be 3-32 characters (alphanumeric, underscore, hyphen only)');
    }
    if (!validateEmail(data.email)) {
        errors.push('Invalid email format');
    }
    if (!validatePassword(data.password)) {
        errors.push('Password must be at least 6 characters with letters and numbers');
    }
    if (data.password !== data.confirmPassword) {
        errors.push('Passwords do not match');
    }
    
    return { isValid: errors.length === 0, errors };
};

/**
 * Validates user login data
 */
const validateLoginData = (data) => {
    const errors = [];
    
    if (!validateEmail(data.email)) {
        errors.push('Invalid email format');
    }
    if (!validatePassword(data.password)) {
        errors.push('Invalid password format');
    }
    
    return { isValid: errors.length === 0, errors };
};

/**
 * Validates subject data
 */
const validateSubjectData = (data) => {
    const errors = [];
    
    if (!validateStringField(data.name, 200)) {
        errors.push('Subject name must be 1-200 characters');
    }
    if (data.description && !validateStringField(data.description, 1000)) {
        errors.push('Description must be 0-1000 characters');
    }
    
    return { isValid: errors.length === 0, errors };
};

/**
 * Validates topic data
 */
const validateTopicData = (data) => {
    const errors = [];
    
    if (!validateStringField(data.name, 200)) {
        errors.push('Topic name must be 1-200 characters');
    }
    
    return { isValid: errors.length === 0, errors };
};

/**
 * Validates MCQ data
 */
const validateMCQData = (data) => {
    const errors = [];
    
    if (!validateStringField(data.question, 2000)) {
        errors.push('Question must be 1-2000 characters');
    }
    if (!validateStringField(data.category, 200)) {
        errors.push('Category must be 1-200 characters');
    }
    if (!validateStringField(data.topic, 200)) {
        errors.push('Topic must be 1-200 characters');
    }
    if (!validateArrayField(data.options, 20)) {
        errors.push('Options must be an array with max 20 items');
    }
    if (!Array.isArray(data.options) || data.options.length < 2) {
        errors.push('Must have at least 2 options');
    }
    data.options.forEach((opt, idx) => {
        if (!validateStringField(opt, 500)) {
            errors.push(`Option ${idx + 1} must be 1-500 characters`);
        }
    });
    if (!validateNumberField(data.correctAnswer, 0, (data.options?.length || 0) - 1)) {
        errors.push('Invalid correct answer index');
    }
    if (data.explanation && !validateStringField(data.explanation, 2000)) {
        errors.push('Explanation must be 0-2000 characters');
    }
    if (data.difficulty && !['easy', 'medium', 'hard'].includes(data.difficulty)) {
        errors.push('Difficulty must be easy, medium, or hard');
    }
    
    return { isValid: errors.length === 0, errors };
};

/**
 * Validates score/answer submission
 */
const validateScoreData = (data) => {
    const errors = [];
    
    if (!validateStringField(data.topic, 200)) {
        errors.push('Topic must be 1-200 characters');
    }
    if (!validateStringField(data.category, 200)) {
        errors.push('Category must be 1-200 characters');
    }
    if (!validateNumberField(data.score, 0)) {
        errors.push('Score must be non-negative');
    }
    if (!validateNumberField(data.totalQuestions, 1)) {
        errors.push('Total questions must be at least 1');
    }
    if (!validateArrayField(data.answers, 1000)) {
        errors.push('Answers must be an array with max 1000 items');
    }
    if (data.timeTaken && !validateNumberField(data.timeTaken, 0)) {
        errors.push('Time taken must be non-negative');
    }
    
    return { isValid: errors.length === 0, errors };
};

/**
 * Validates message/contact data
 */
const validateMessageData = (data) => {
    const errors = [];
    
    if (!validateStringField(data.name, 200)) {
        errors.push('Name must be 1-200 characters');
    }
    if (!validateEmail(data.email)) {
        errors.push('Invalid email format');
    }
    if (!validateStringField(data.message, 5000)) {
        errors.push('Message must be 1-5000 characters');
    }
    
    return { isValid: errors.length === 0, errors };
};

/**
 * Middleware to validate request body against schema
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
        const validation = schema(req.body);
        
        if (!validation.isValid) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: validation.errors
            });
        }
        
        req.validated = true;
        next();
    };
};

module.exports = {
    validateEmail,
    validateUsername,
    validatePassword,
    validateMongoId,
    validateStringField,
    validateNumberField,
    validateArrayField,
    validateRegisterData,
    validateLoginData,
    validateSubjectData,
    validateTopicData,
    validateMCQData,
    validateScoreData,
    validateMessageData,
    validateRequest
};
