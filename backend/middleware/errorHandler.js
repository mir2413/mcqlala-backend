/**
 * Error Handling Middleware
 * Catches and formats all errors in a consistent way
 * Prevents sensitive info leakage and standardizes responses
 */

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Global error handler middleware
 * Should be used as the last middleware in Express app
 */
const errorHandler = (err, req, res, next) => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Log error for debugging
    if (err.statusCode >= 500 || !err.statusCode) {
        console.error(`[ERROR] ${err.statusCode || 500} - ${req.method} ${req.path}`);
        console.error('Error:', err.message);
        if (isDevelopment) console.error('Stack:', err.stack);
    } else if (err.statusCode >= 400) {
        console.warn(`[WARNING] ${err.statusCode} - ${req.method} ${req.path} - ${err.message}`);
    }
    
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            statusCode: 400,
            message: 'Validation error',
            errors,
            timestamp: new Date().toISOString()
        });
    }
    
    // Mongoose cast error (invalid ID)
    if (err.name === 'CastError') {
        return res.status(400).json({
            statusCode: 400,
            message: 'Invalid ID format',
            timestamp: new Date().toISOString()
        });
    }
    
    // Duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(409).json({
            statusCode: 409,
            message: `${field} already exists`,
            timestamp: new Date().toISOString()
        });
    }
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            statusCode: 401,
            message: 'Invalid token',
            timestamp: new Date().toISOString()
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            statusCode: 401,
            message: 'Token expired',
            timestamp: new Date().toISOString()
        });
    }
    
    // Custom app errors
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            statusCode: err.statusCode,
            message: err.message,
            timestamp: err.timestamp
        });
    }
    
    // Multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            statusCode: 413,
            message: 'File too large',
            timestamp: new Date().toISOString()
        });
    }
    
    if (err.code === 'LIMIT_PART_COUNT') {
        return res.status(400).json({
            statusCode: 400,
            message: 'Too many file parts',
            timestamp: new Date().toISOString()
        });
    }
    
    // Default error response - don't leak stack trace in production
    res.status(err.statusCode || 500).json({
        statusCode: err.statusCode || 500,
        message: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack }),
        timestamp: new Date().toISOString()
    });
};

/**
 * Async error wrapper to catch promise rejections
 * Usage: app.get('/route', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 Not Found handler
 * Should be used as the second-to-last middleware
 */
const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        statusCode: 404,
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    AppError,
    errorHandler,
    asyncHandler,
    notFoundHandler
};
