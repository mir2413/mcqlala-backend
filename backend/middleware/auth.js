const jwt = require('jsonwebtoken');
const Tokens = require('csrf');
const csrfTokens = new Tokens();
const { User } = require('../models');
const { getDbStatus } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;

async function auth(req, res, next) {
    const token = req.cookies.jwt;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Missing token.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!getDbStatus()) {
            return res.status(503).json({ message: 'Database not connected' });
        }
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized: User not found.' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }
}

async function adminAuth(req, res, next) {
    const token = req.cookies.jwt;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Missing token.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!getDbStatus()) {
            return res.status(503).json({ message: 'Database not connected' });
        }
        const user = await User.findById(decoded.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Forbidden: Admin access required.' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Forbidden: Invalid token or not admin.' });
    }
}

function csrfSecretMiddleware(req, res, next) {
    let secret = req.cookies['csrf-secret'];
    if (!secret) {
        secret = csrfTokens.secretSync();
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('csrf-secret', secret, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });
    }
    req.csrfSecret = secret;
    next();
}

function csrfProtection(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    const skipPaths = ['/api/users/login', '/api/users/register', '/api/users/forgot-password', '/api/users/reset-password'];
    if (skipPaths.includes(req.path)) {
        return next();
    }
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    if (!token || !csrfTokens.verify(req.csrfSecret, token)) {
        return res.status(403).json({ message: 'Invalid CSRF token' });
    }
    next();
}

function sanitizeInput(req, res, next) {
    const skipFields = ['password', 'newPassword'];
    const sanitize = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        for (const key in obj) {
            if (skipFields.includes(key)) {
                continue;
            }
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key].replace(/<[^>]*>/g, '').trim();
            } else if (typeof obj[key] === 'object') {
                sanitize(obj[key]);
            }
        }
        return obj;
    };
    if (req.body && typeof req.body === 'object') {
        req.body = sanitize(req.body);
    }
    next();
}

module.exports = { auth, adminAuth, csrfTokens, csrfSecretMiddleware, csrfProtection, sanitizeInput };
