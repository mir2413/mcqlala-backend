console.log("Attempting to start server...");
try {
    require('express');
} catch (e) {
    console.error('\n❌ ERROR: The "express" module is missing.');
    console.error('👉 Please run this command in your terminal: npm install express\n');
    process.exit(1);
}

const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-mcqlala';

let bcryptjs;
try {
    bcryptjs = require('bcryptjs');
} catch (e) {
    console.error('\n❌ ERROR: The "bcryptjs" module is missing.');
    console.error('👉 Please run this command in your terminal: npm install bcryptjs\n');
    process.exit(1);
}

let cors;
try {
    cors = require('cors');
} catch (e) {
    console.error('\n❌ ERROR: The "cors" module is missing.');
    console.error('👉 Please run this command in your terminal: npm install cors\n');
    process.exit(1);
}

let rateLimit;
try {
    rateLimit = require('express-rate-limit');
} catch (e) {
    console.error('\n❌ ERROR: The "rate-limit" module is missing.');
    console.error('👉 Please run this command in your terminal: npm install express-rate-limit\n');
    process.exit(1);
}

let helmet;
try {
    helmet = require('helmet');
} catch (e) {
    console.error('\n❌ ERROR: The "helmet" module is missing.');
    console.error('👉 Please run this command in your terminal: npm install helmet\n');
    process.exit(1);
}

try {
    require('dotenv').config();
} catch (e) {
    console.error('\n❌ ERROR: The "dotenv" module is missing.');
    console.error('👉 Please run this command in your terminal: npm install dotenv\n');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3004;

// Trust Proxy (Required for ngrok to detect HTTPS and send HSTS headers)
app.set('trust proxy', 1);
app.disable('x-powered-by'); // Hide server technology (Security)

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
});

// Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "cdnjs.cloudflare.com", "fonts.googleapis.com", "'unsafe-inline'"],
            fontSrc: ["'self'", "cdnjs.cloudflare.com", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    xContentTypeOptions: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xFrameOptions: { action: "deny" },
    xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
    xDnsPrefetchControl: { allow: false },
    permissionsPolicy: {
        features: {
            accelerometer: ["()"],
            camera: ["()"],
            geolocation: ["()"],
            gyroscope: ["()"],
            magnetometer: ["()"],
            microphone: ["()"],
            payment: ["()"],
            usb: ["()"]
        }
    }
}));

app.use(cookieParser());

// CORS Middleware - Must be configured before routes
const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3004', 'https://mcqlala.in', 'https://www.mcqlala.in', 'https://mcqlala-backend.vercel.app', 'https://mcqlala-backend-1.onrender.com'];
app.use(cors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'] 
}));

// Security: Block access to sensitive server files
app.use((req, res, next) => {
    const forbiddenFiles = ['/server.js', '/database.json', '/.env', '/migrate.js', '/package.json', '/package-lock.json', '/TODO.md'];
    if (forbiddenFiles.includes(req.path)) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    next();
});

// Serve static files (HTML, CSS, JS) from frontend directory
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath, {
    setHeaders: (res, path) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');
    }
}));

// Middleware to parse JSON bodies (Move after static files to avoid parsing static requests)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Multer for file uploads
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'frontend', 'pdfs')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDFs allowed'), false);
}});

// Ensure pdfs directory exists
const pdfDir = path.join(__dirname, '..', 'frontend', 'pdfs');
if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
}

// Rate Limiting Middleware (Move after static files to allow UI to load freely)
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // 1000 requests per minute
    message: { message: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'development' // Only skip in development
});

// Specific Rate Limiter for Login/Register (Stricter)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login requests per window
    message: { message: 'Too many login attempts, please try again after 15 minutes.' },
    skipSuccessfulRequests: true,
});

// Apply general rate limiter (After static files, only limits API/Dynamic requests)
// Enable in production for DDoS protection
app.use(limiter);

// Database File
const DB_FILE = path.join(__dirname, 'database.json');

// Data Store (In-memory with file persistence)
let users = [];
let subjects = [
    { _id: '1', name: 'General Knowledge', description: 'Basic GK', topics: [{ _id: 't1', name: 'History' }, { _id: 't2', name: 'Geography' }] }
];
let mcqs = [];
let navItems = [];
let messages = [];
let scores = [];
let settings = { title: 'MCQLala', footer: '© 2026 MCQLala. All Rights Reserved.' };

// Load data from file if exists
if (fs.existsSync(DB_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (data.users) users = data.users;
        if (data.subjects) subjects = data.subjects;
        if (data.mcqs) mcqs = data.mcqs;
        if (data.navItems) navItems = data.navItems;
        if (data.messages) messages = data.messages;
        if (data.scores) scores = data.scores;
        if (data.settings) settings = data.settings;
        console.log('✅ Database loaded from file.');
    } catch (e) {
        console.error('❌ Error loading database:', e);
    }
}

// Ensure Default Navigation Items exist
if (navItems.length === 0) {
    navItems = [
        { _id: '1', name: 'Home', path: '/', icon: 'fa fa-home' },
        { _id: '2', name: 'Admin Panel', path: '/admin.html', icon: 'fa fa-cogs' },
        { _id: '3', name: 'Quiz', path: '/quiz.html', icon: 'fa fa-question-circle' },
        { _id: '4', name: 'Leaderboard', path: '/leaderboard.html', icon: 'fa fa-trophy' }
    ];
}

function saveData() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify({ users, subjects, mcqs, navItems, messages, scores, settings }, null, 2));
    } catch (e) {
        console.error('❌ Error saving database:', e);
    }
}

// General Authentication Middleware using JWT
const auth = (req, res, next) => {
    const token = req.cookies.jwt;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Missing token.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = users.find(u => u._id === decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized: User not found.' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }
};

// Admin Authentication Middleware using JWT
const adminAuth = (req, res, next) => {
    const token = req.cookies.jwt;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Missing token.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = users.find(u => u._id === decoded.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Forbidden: Admin access required.' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Forbidden: Invalid token or not admin.' });
    }
};

// Route to get current user from token securely
app.get('/api/users/me', auth, (req, res) => {
    res.json({
        userId: req.user._id,
        username: req.user.username,
        email: req.user.email,
        isAdmin: req.user.isAdmin
    });
});

// Logout mechanism securely clears the cookie
app.post('/api/users/logout', (req, res) => {
    res.clearCookie('jwt', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
    });
    res.json({ message: 'Logged out successfully' });
});

// Auth Check - used by frontend to verify JWT cookie is valid
app.get('/api/auth/check', auth, (req, res) => {
    res.json({
        authenticated: true,
        userId: req.user._id,
        username: req.user.username,
        email: req.user.email,
        isAdmin: req.user.isAdmin
    });
});

// Basic API Routes (You will need to connect these to a real database later)
app.get('/api/subjects', (req, res) => {
    res.json(subjects);
});

app.post('/api/subjects', adminAuth, (req, res) => {
    const newSubject = { _id: Date.now().toString(), ...req.body, topics: [] };
    subjects.push(newSubject);
    saveData();
    res.json(newSubject);
});

app.put('/api/subjects/:id', adminAuth, (req, res) => {
    const subject = subjects.find(s => s._id === req.params.id);
    if (subject) {
        subject.name = req.body.name || subject.name;
        subject.description = req.body.description || subject.description;
        saveData();
        res.json(subject);
    } else {
        res.status(404).json({ message: 'Subject not found' });
    }
});

app.delete('/api/subjects/:id', adminAuth, (req, res) => {
    subjects = subjects.filter(s => s._id !== req.params.id);
    saveData();
    res.json({ message: 'Deleted' });
});

// Topic Routes
app.post('/api/subjects/:id/topics', adminAuth, (req, res) => {
    const subject = subjects.find(s => s._id === req.params.id);
    if (subject) {
        const newTopic = { _id: Date.now().toString(), name: req.body.name };
        subject.topics.push(newTopic);
        saveData();
        res.json(newTopic);
    } else {
        res.status(404).json({ message: 'Subject not found' });
    }
});

app.put('/api/subjects/:subjectId/topics/:topicId', adminAuth, (req, res) => {
    const subject = subjects.find(s => s._id === req.params.subjectId);
    if (subject) {
        const topic = subject.topics.find(t => t._id === req.params.topicId);
        if (topic) {
            topic.name = req.body.name || topic.name;
            saveData();
            res.json(topic);
        } else {
            res.status(404).json({ message: 'Topic not found' });
        }
    } else {
        res.status(404).json({ message: 'Subject not found' });
    }
});

app.delete('/api/subjects/:subjectId/topics/:topicId', adminAuth, (req, res) => {
    const subject = subjects.find(s => s._id === req.params.subjectId);
    if (subject) {
        subject.topics = subject.topics.filter(t => t._id !== req.params.topicId);
        saveData();
        res.json({ message: 'Topic deleted' });
    } else {
        res.status(404).json({ message: 'Subject not found' });
    }
});

// MCQ Routes
app.get('/api/mcqs/all', (req, res) => res.json(mcqs));
app.get('/api/mcqs-category/all', (req, res) => res.json(mcqs)); // For stats

// Filtered MCQs (Used by quiz.html)
app.get('/api/mcqs', (req, res) => {
    const { topic, category } = req.query;
    console.log(`[API] Fetching MCQs for Topic: "${topic}", Category: "${category}"`);
    let results = mcqs;
    if (category) results = results.filter(m => m.category === category);
    if (topic) results = results.filter(m => m.topic === topic);
    console.log(`[API] Found ${results.length} questions.`);
    res.json(results);
});

app.post('/api/mcqs', adminAuth, (req, res) => {
    const newMcq = { _id: Date.now().toString(), ...req.body };
    mcqs.push(newMcq);
    saveData();
    console.log(`[MCQ Added] Topic: ${newMcq.topic}, Question: ${newMcq.question}`);
    res.json(newMcq);
});

app.delete('/api/mcqs/:id', adminAuth, (req, res) => {
    mcqs = mcqs.filter(m => m._id !== req.params.id);
    saveData();
    res.json({ message: 'Deleted' });
});

// Seed Data Route (For Admin Panel - REMOVED FOR SECURITY)
// This endpoint has been removed. Use the admin panel to add data instead.

// Contact/Message Routes
app.get('/api/contact', adminAuth, (req, res) => res.json(messages.sort((a, b) => b.date - a.date)));
app.post('/api/contact', (req, res) => {
    const msg = { _id: Date.now().toString(), ...req.body, date: new Date(), read: false };
    messages.push(msg);
    saveData();
    res.json({ message: 'Sent' });
});

app.put('/api/contact/:id/read', adminAuth, (req, res) => {
    const msg = messages.find(m => m._id === req.params.id);
    if (msg) {
        msg.read = true;
        saveData();
        res.json(msg);
    } else {
        res.status(404).json({ message: 'Message not found' });
    }
});

app.delete('/api/contact/:id', adminAuth, (req, res) => {
    messages = messages.filter(m => m._id !== req.params.id);
    saveData();
    res.json({ message: 'Deleted' });
});

app.post('/api/contact/bulk-delete', adminAuth, (req, res) => {
    const { ids } = req.body;
    if (Array.isArray(ids)) {
        messages = messages.filter(m => !ids.includes(m._id));
        saveData();
        res.json({ message: 'Messages deleted' });
    } else {
        res.status(400).json({ message: 'Invalid request' });
    }
});

// Settings Routes
app.get('/api/settings', (req, res) => res.json(settings));
app.post('/api/settings', adminAuth, (req, res) => {
    if (req.body.title) settings.title = req.body.title;
    if (req.body.footer) settings.footer = req.body.footer;
    saveData();
    res.json(settings);
});

// PDF Routes
app.get('/api/pdfs', (req, res) => {
    const pdfDir = path.join(__dirname, '..', 'frontend', 'pdfs');
    if (!fs.existsSync(pdfDir)) return res.json([]);
    const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf')).map(f => ({
        name: f,
        url: `/pdfs/${f}`,
        uploadedAt: fs.statSync(path.join(pdfDir, f)).mtime
    }));
    res.json(files.sort((a, b) => b.uploadedAt - a.uploadedAt));
});

app.post('/api/pdfs', adminAuth, upload.single('pdf'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.json({ message: 'PDF uploaded successfully', file: req.file.filename });
});

app.delete('/api/pdfs/:filename', adminAuth, (req, res) => {
    const filePath = path.join(__dirname, '..', 'frontend', 'pdfs', req.params.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ message: 'PDF deleted' });
    } else {
        res.status(404).json({ message: 'File not found' });
    }
});

// Nav Items Routes
app.get('/api/navitems', (req, res) => res.json(navItems));
app.post('/api/navitems', adminAuth, (req, res) => {
    const item = { _id: Date.now().toString(), ...req.body };
    navItems.push(item);
    saveData();
    res.json(item);
});

app.put('/api/navitems/:id', adminAuth, (req, res) => {
    const item = navItems.find(i => i._id === req.params.id);
    if (!item) return res.status(404).json({ message: 'Nav item not found' });
    Object.assign(item, req.body);
    saveData();
    res.json(item);
});

app.delete('/api/navitems/:id', adminAuth, (req, res) => {
    navItems = navItems.filter(i => i._id !== req.params.id);
    saveData();
    res.json({ message: 'Deleted' });
});

// Scores Routes
app.post('/api/scores', auth, (req, res) => {
    const { topic, score, totalQuestions, percentage } = req.body;
    const userId = req.user._id;

    if (!userId || topic === undefined || score === undefined || totalQuestions === undefined || percentage === undefined) {
        return res.status(400).json({ message: 'Missing required score fields.' });
    }

    const scoreData = { 
        _id: Date.now().toString(), 
        submittedAt: new Date().toISOString(),
        userId,
        username: req.user.username,
        topic,
        category: req.body.category,
        score,
        totalQuestions,
        percentage,
        answers: req.body.answers || []
    };
    scores.push(scoreData);
    saveData();
    console.log(`[SCORE] ${scoreData.username}: ${scoreData.score}/${scoreData.totalQuestions} (${scoreData.percentage}%) - ${scoreData.topic}`);
    res.json(scoreData);
});

app.get('/api/scores/user/:userId', (req, res) => {
    const userScores = scores.filter(s => s.userId === req.params.userId);
    // Sort by most recent
    res.json(userScores.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)));
});

app.get('/api/leaderboard/:topic', (req, res) => {
    const topicScores = scores
        .filter(s => s.topic === req.params.topic)
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 10)
        .map(s => ({
            _id: s._id,
            score: s.score,
            totalQuestions: s.totalQuestions,
            percentage: s.percentage,
            user: { username: s.username },
            submittedAt: s.submittedAt
        }));
    res.json(topicScores);
});

// Login Route
app.post('/api/users/login', loginLimiter, (req, res) => {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'Invalid input: email and password required.' });
    }
    
    if (email.length > 254 || password.length > 128) {
        return res.status(400).json({ message: 'Invalid input: email or password too long.' });
    }
    
    // Allow login with either email or username
    const user = users.find(u => u.email === email || u.username === email);
    
    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials.' });
    }
    
    // Compare password with hashed password
    bcryptjs.compare(password, user.password, (err, isMatch) => {
        if (err || !isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        // Generate JWT token
        const token = jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '1d' });
        
        // Set HttpOnly cookie
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: false, // In production, set to true (HTTPS only)
            sameSite: 'lax', // 'lax' still prevents CSRF but works across localhost navigations
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        
        res.json({
            userId: user._id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin
        });
    });
});

// Register Route
app.post('/api/users/register', loginLimiter, (req, res) => {
    const { username, email, password } = req.body;
    
    // Input validation
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }
    
    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'Invalid input format.' });
    }
    
    if (username.length < 3 || username.length > 50) {
        return res.status(400).json({ message: 'Username must be 3-50 characters.' });
    }
    
    if (email.length > 254 || !email.includes('@')) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }
    
    if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ message: 'Password must be 8-128 characters.' });
    }
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'Email already in use.' });
    }

    if (users.find(u => u.username === username)) {
        return res.status(400).json({ message: 'Username already in use.' });
    }
    
    // Hash password before storing
    bcryptjs.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ message: 'Error processing password.' });
        }
        
        const newUser = { 
            _id: Date.now().toString(), 
            username, 
            email, 
            password: hashedPassword, 
            isAdmin: false, 
            createdAt: new Date() 
        };
        users.push(newUser);
        saveData();
        res.status(201).json({ message: 'User registered successfully.' });
    });
});

// Get Users (for Admin Panel)
app.get('/api/users', adminAuth, (req, res) => {
    // Basic search and pagination for the mock
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = (req.query.search || '').toLowerCase();

    let filteredUsers = users;
    if (search) {
        filteredUsers = users.filter(u => u.username.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
    }

    const totalPages = Math.ceil(filteredUsers.length / limit);
    const paginatedUsers = filteredUsers.slice((page - 1) * limit, page * limit);

    // Never expose password hashes
    const safeUsers = paginatedUsers.map(({ password, resetToken, resetTokenExpiry, ...u }) => u);
    res.json({ users: safeUsers, currentPage: page, totalPages: totalPages });
});

app.post('/api/users/promote', adminAuth, (req, res) => {
    const user = users.find(u => u.email === req.body.email);
    if (user) {
        user.isAdmin = true;
        saveData();
        res.json({ message: 'User promoted' });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
});

app.post('/api/users/change-password', adminAuth, (req, res) => {
    const { userId, newPassword } = req.body;
    
    if (!userId || !newPassword) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }
    
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    
    const user = users.find(u => u._id === userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }
    
    bcryptjs.hash(newPassword, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ message: 'Error processing password.' });
        }
        user.password = hashedPassword;
        saveData();
        res.json({ message: 'Password updated successfully.' });
    });
});

// Forgot Password Routes - with REAL EMAIL
let transporter;
let emailServiceReady = false;

try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER || 'your-email@gmail.com',
            pass: process.env.EMAIL_PASS || 'your-app-password'
        }
    });
    emailServiceReady = true;
} catch (error) {
    console.warn('⚠️ Nodemailer not found or configured. Password reset will log to console only.');
    console.warn('👉 Run: npm install nodemailer');
}

app.post('/api/users/forgot-password', (req, res) => {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
        return res.status(400).json({ message: 'Valid email required' });
    }
    
    const user = users.find(u => u.email === email);
    if (!user) {
        // Don't reveal if email exists (security)
        return res.json({ message: 'If email exists, reset link sent (check spam folder)' });
    }
    
    // Generate secure token (48 chars)
    const token = require('crypto').randomBytes(24).toString('hex');
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour
    
    user.resetToken = token;
    user.resetTokenExpiry = expiry;
    saveData();
    
    // Send real email
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
    
    if (emailServiceReady && transporter) {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@mcqlala.com',
            to: email,
            subject: 'mcqlala Password Reset',
            html: `
                <h2>Reset Your mcqlala Password</h2>
                <p>Click the link below to reset your password (expires in 1 hour):</p>
                <a href="${resetUrl}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
                <p>Or copy this link: <code>${resetUrl}</code></p>
                <p>If you didn't request this, ignore this email.</p>
                <p>Best,<br>mcqlala Team</p>
            `
        };
        
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('[EMAIL ERROR]', error);
                return res.json({ message: 'Reset link generated! Token in console (email failed - check .env)' });
            }
            console.log(`[RESET EMAIL SENT] ${email}: ${token}`);
            res.json({ message: 'Reset link sent to your email! Check inbox/spam.' });
        });
    } else {
        console.log(`\n[DEV MODE] Password Reset Token for ${email}: ${token}\n`);
        res.json({ message: 'Email service unavailable. Reset token logged to server console.' });
    }
});

app.post('/api/users/reset-password', (req, res) => {
    const { token, password } = req.body;
    
    if (!token || !password || password.length < 8) {
        return res.status(400).json({ message: 'Invalid token or password' });
    }
    
    const user = users.find(u => 
        u.resetToken === token && 
        u.resetTokenExpiry > Date.now()
    );
    
    if (!user) {
        return res.status(400).json({ message: 'Invalid or expired token' });
    }
    
    bcryptjs.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ message: 'Error resetting password' });
        }
        
        user.password = hashedPassword;
        delete user.resetToken;
        delete user.resetTokenExpiry;
        saveData();
        
        console.log(`[RESET COMPLETE] Password reset for ${user.email}`);
        res.json({ message: 'Password reset successful! You can now login.' });
    });
});

// Fallback to index.html for any other requests (useful for SPA, though this is a multi-page site)
app.get('*', (req, res) => {
    const frontendDir = path.join(__dirname, '..', 'frontend');
    const filePath = path.join(frontendDir, req.path === '/' ? 'index.html' : req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\nError: Port ${PORT} is already in use!`);
        console.error('Please stop the other server instance or run: taskkill /F /IM node.exe');
        process.exit(1);
    }
});

// Graceful shutdown logic to release port immediately
const shutdown = () => {
    server.close(() => {
        console.log('\nServer stopped and port released.');
        process.exit(0);
    });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);