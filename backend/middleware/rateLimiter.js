const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { message: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
            return true;
        }
        return process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true';
    }
});

const loginLimiter = rateLimit({
    windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS) || 5,
    message: { message: 'Too many login attempts, please try again later.' },
    skipSuccessfulRequests: true
});

module.exports = { limiter, loginLimiter };
