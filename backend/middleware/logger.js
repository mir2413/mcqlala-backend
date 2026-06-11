/**
 * Request Logging Middleware
 * Logs all requests for debugging and monitoring
 * Tracks response times and status codes
 */

/**
 * Enhanced logging middleware with structured output
 */
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    
    // Store request ID in request object for later reference
    req.id = requestId;
    
    // Log incoming request
    const incomingLog = {
        timestamp: new Date().toISOString(),
        requestId,
        type: 'REQUEST',
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')?.substring(0, 100)
    };
    
    // Log after response is sent
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        const outgoingLog = {
            timestamp: new Date().toISOString(),
            requestId,
            type: 'RESPONSE',
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip
        };
        
        // Log based on status code
        if (res.statusCode >= 500) {
            console.error(`[${outgoingLog.statusCode}] ${outgoingLog.method} ${outgoingLog.path} - ${outgoingLog.duration}`);
        } else if (res.statusCode >= 400) {
            console.warn(`[${outgoingLog.statusCode}] ${outgoingLog.method} ${outgoingLog.path} - ${outgoingLog.duration}`);
        } else if (duration > 1000) {
            console.warn(`[SLOW] ${outgoingLog.method} ${outgoingLog.path} - ${outgoingLog.duration}`);
        } else {
            // Suppress verbose logging for successful requests in production
            if (process.env.NODE_ENV === 'development') {
                console.log(`[${outgoingLog.statusCode}] ${outgoingLog.method} ${outgoingLog.path} - ${outgoingLog.duration}`);
            }
        }
    });
    
    next();
};

/**
 * Generates a unique request ID for tracking
 */
const generateRequestId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Security event logger
 * Logs suspicious activities
 */
const securityLogger = (req, res, next) => {
    res.on('finish', () => {
        // Log auth failures
        if (res.statusCode === 401) {
            console.warn(`[SECURITY] Auth failed - ${req.method} ${req.path} from ${req.ip}`);
        }
        
        // Log access denials
        if (res.statusCode === 403) {
            console.warn(`[SECURITY] Access denied - ${req.method} ${req.path} from ${req.ip}`);
        }
        
        // Log suspicious patterns
        if (req.path.includes('..') || req.path.includes('eval') || req.path.includes('script')) {
            console.warn(`[SECURITY] Suspicious path - ${req.path} from ${req.ip}`);
        }
    });
    
    next();
};

module.exports = {
    requestLogger,
    securityLogger,
    generateRequestId
};
