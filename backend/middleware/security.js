const helmet = require('helmet');

function securityHeaders(req, res, next) {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    next();
}

function apiCacheControl(req, res, next) {
    if (req.path.startsWith('/api/')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');
    }
    next();
}

function nonceGenerator(req, res, next) {
    res.locals.nonce = require('crypto').randomBytes(16).toString('base64');
    next();
}

function helmetMiddleware(req, res, next) {
    return helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", 'cdnjs.cloudflare.com', (req, res) => `'nonce-${res.locals.nonce}'`],
                styleSrc: ["'self'", 'cdnjs.cloudflare.com', 'fonts.googleapis.com', (req, res) => `'nonce-${res.locals.nonce}'`],
                fontSrc: ["'self'", 'cdnjs.cloudflare.com', 'fonts.gstatic.com'],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: ["'self'"],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: false,
        hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
        xContentTypeOptions: false,
        referrerPolicy: false,
        xFrameOptions: false,
        xPermittedCrossDomainPolicies: false,
        xDnsPrefetchControl: false,
        permissionsPolicy: false
    })(req, res, next);
}

function sensitiveFileBlock(req, res, next) {
    const forbiddenFiles = ['/server.js', '/database.json', '/.env', '/migrate.js', '/package.json', '/package-lock.json', '/TODO.md', '/.gitignore', '/.env.example'];
    if (forbiddenFiles.includes(req.path)) {
        console.warn(`[SECURITY] Blocked access to sensitive file: ${req.path} from ${req.ip}`);
        return res.status(403).json({ message: 'Forbidden' });
    }
    next();
}

function securityLogger(req, res, next) {
    const startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        if (res.statusCode === 401 || res.statusCode === 403) {
            console.warn(`[SECURITY] ${res.statusCode} - ${req.method} ${req.path} - IP: ${req.ip}`);
        }
        if (res.statusCode >= 500) {
            console.error(`[ERROR] ${res.statusCode} - ${req.method} ${req.path} - IP: ${req.ip}`);
        }
        if (duration > 1000) {
            console.warn(`[PERFORMANCE] Slow request: ${req.method} ${req.path} - ${duration}ms`);
        }
    });
    next();
}

function errorHandler(err, req, res, next) {
    console.error('[SERVER ERROR]', err.message);
    res.status(500).json({ message: 'Internal server error' });
}

module.exports = { securityHeaders, apiCacheControl, nonceGenerator, helmetMiddleware, sensitiveFileBlock, securityLogger, errorHandler };
