const rateLimit = require('express-rate-limit');

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
}

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { message: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${getClientIp(req)}:${req.path}`,
    skip: (req) => {
        if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
            return true;
        }
        return process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true';
    }
});

const loginLimiter = rateLimit({
    windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS) || 10,
    message: { message: 'Too many login attempts, please try again later.' },
    keyGenerator: (req) => getClientIp(req),
    skipSuccessfulRequests: true
});

module.exports = { limiter, loginLimiter };
