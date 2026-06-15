console.log('Starting server...');

const express = require('express');
const path = require('path');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set. Server cannot start securely.');
    process.exit(1);
}

const { connectDB, getDbStatus } = require('./config/database');
const { allowedOrigins } = require('./config/constants');
const { securityHeaders, apiCacheControl, sensitiveFileBlock, securityLogger, errorHandler } = require('./middleware/security');
const { csrfSecretMiddleware, csrfProtection, sanitizeInput } = require('./middleware/auth');
const { limiter, loginLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3004;

connectDB();

app.use(securityHeaders);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(csrfSecretMiddleware);
app.use(csrfProtection);
app.use(sanitizeInput);

const cors = require('cors');
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-User-ID']
}));

app.use((req, res, next) => {
    const protectedRoutes = ['/api/mcqs', '/api/subjects', '/api/users', '/api/contact', '/api/pdfs', '/api/navitems', '/api/settings'];
    const isProtected = protectedRoutes.some(r => req.path.startsWith(r)) && req.method !== 'GET';
    if (isProtected) {
        limiter(req, res, next);
    } else {
        next();
    }
});

app.use('/api/users/login', loginLimiter);
app.use('/api/users/register', loginLimiter);

app.use(express.static(path.join(__dirname, '..', 'frontend'), {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
        if (filePath.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
}));

app.use(sensitiveFileBlock);

app.get('/api/csrf-token', (req, res) => {
    const Tokens = require('csrf');
    const tokens = new Tokens();
    const token = tokens.create(req.csrfSecret);
    res.json({ csrfToken: token });
});
app.use('/api', require('./routes/auth'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/mcqs', require('./routes/mcqs'));
app.use('/api', require('./routes/scores'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/pdfs', require('./routes/pdfs'));
app.use('/api/navitems', require('./routes/navitems'));
app.use('/api/visitors', require('./routes/visitors'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/verify-mcqs', require('./routes/verify'));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), db: getDbStatus() });
});

app.get('/api/stats', async (req, res) => {
    if (!getDbStatus()) return res.status(503).json({ error: 'Database not connected' });
    try {
        const { MCQ, Subject, User, Score } = require('./models');
        const [totalMCQs, totalSubjects, totalUsers, totalScores] = await Promise.all([
            MCQ.countDocuments(), Subject.countDocuments(), User.countDocuments(), Score.countDocuments()
        ]);
        res.json({ totalMCQs, totalSubjects, totalUsers, totalScores });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/api/leaderboard/:topic', async (req, res) => {
    if (!getDbStatus()) return res.status(503).json({ error: 'Database not connected' });
    try {
        const { Score } = require('./models');
        const leaderboard = await Score.find({ topic: req.params.topic })
            .sort({ percentage: -1, createdAt: 1 })
            .limit(20)
            .select('username percentage score totalQuestions createdAt');
        res.json(leaderboard);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

app.get('/api/badges', async (req, res) => {
    if (!getDbStatus()) return res.status(503).json({ error: 'Database not connected' });
    try {
        const { Badge } = require('./models');
        const badges = await Badge.find().sort({ order: 1 });
        res.json(badges);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch badges' });
    }
});

app.get('/api/security/audit', require('./middleware/auth').adminAuth, (req, res) => {
    const audit = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        httpsEnabled: !!(process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH && process.env.NODE_ENV === 'production'),
        corsOrigins: allowedOrigins,
        rateLimiting: {
            enabled: true,
            general: { windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100 },
            login: {
                windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 900000,
                max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS) || 5
            }
        },
        securityHeaders: { helmet: true, hsts: process.env.NODE_ENV === 'production', csp: true, xFrameOptions: true, xContentTypeOptions: true },
        jwtSecretSet: !!JWT_SECRET,
        mongodbConnected: getDbStatus()
    };
    res.json(audit);
});

app.get('/api/mcqs-category/all', async (req, res) => {
    if (!getDbStatus()) return res.status(503).json({ error: 'Database not connected' });
    try {
        const { MCQ } = require('./models');
        const structure = await MCQ.aggregate([
            { $group: { _id: { category: '$category', topic: '$topic' }, count: { $sum: 1 } } },
            { $group: { _id: '$_id.category', topics: { $push: { name: '$_id.topic', count: '$count' } }, total: { $sum: '$count' } } },
            { $sort: { _id: 1 } }
        ]);
        res.json(structure);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch MCQ structure' });
    }
});

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.use(securityLogger);
app.use(errorHandler);

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

const shutdown = async () => {
    console.log('Shutting down gracefully...');
    const { default: mongoose } = require('mongoose');
    await mongoose.connection.close();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const DatabaseBackup = require('./backup');
const backupManager = new DatabaseBackup();
if (getDbStatus()) backupManager.scheduleBackup('0 2 * * *');

const SELF_PING_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
if (SELF_PING_URL && process.env.NODE_ENV === 'production') {
    setInterval(async () => {
        try {
            await fetch(`${SELF_PING_URL}/api/health`);
            console.log('[Keep-Alive] Ping successful');
        } catch (err) {
            console.log('[Keep-Alive] Ping failed:', err.message);
        }
    }, 14 * 60 * 1000);
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
