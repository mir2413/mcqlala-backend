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

// Force IPv4 DNS resolution (Render free tier doesn't support IPv6 outbound)
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ ERROR: JWT_SECRET environment variable is not set.');
    console.error('👉 Please set a strong random JWT_SECRET in your Render environment variables.');
}

// MongoDB Setup
let mongoose;
try {
    mongoose = require('mongoose');
} catch (e) {
    console.error('\n❌ ERROR: The "mongoose" module is missing.');
    console.error('👉 Please run: npm install mongoose\n');
    process.exit(1);
}

let bcryptjs;
try {
    bcryptjs = require('bcryptjs');
} catch (e) {
    console.error('\n❌ ERROR: The "bcryptjs" module is missing.');
    console.error('👉 Please run: npm install bcryptjs\n');
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

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI environment variable is not set.');
    console.error('👉 Please set MONGODB_URI in your Render environment variables.');
    console.error('   Example: mongodb+srv://username:password@cluster.mongodb.net/dbname');
}

// Mongoose Schemas
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    resetToken: String,
    resetTokenExpiry: Number
});

const subjectSchema = new mongoose.Schema({
    name: String,
    description: String,
    topics: [{ _id: mongoose.Schema.Types.ObjectId, name: String }]
});

const mcqSchema = new mongoose.Schema({
    category: String,
    topic: String,
    question: String,
    options: [String],
    correctAnswer: Number,
    explanation: String,
    difficulty: String,
    createdAt: { type: Date, default: Date.now }
});

const scoreSchema = new mongoose.Schema({
    userId: String,
    username: String,
    topic: String,
    category: String,
    score: Number,
    totalQuestions: Number,
    answers: [Number],
    createdAt: { type: Date, default: Date.now }
});

const navItemSchema = new mongoose.Schema({
    name: String,
    path: String,
    icon: String
});

const messageSchema = new mongoose.Schema({
    name: String,
    email: String,
    message: String,
    date: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});

const settingSchema = new mongoose.Schema({
    title: String,
    footer: String
});

const pdfSchema = new mongoose.Schema({
    name: String,
    data: Buffer,
    contentType: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Subject = mongoose.models.Subject || mongoose.model('Subject', subjectSchema);
const MCQ = mongoose.models.MCQ || mongoose.model('MCQ', mcqSchema);
const Score = mongoose.models.Score || mongoose.model('Score', scoreSchema);
const NavItem = mongoose.models.NavItem || mongoose.model('NavItem', navItemSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
const PDF = mongoose.models.PDF || mongoose.model('PDF', pdfSchema);

let isDbConnected = false;

// Connect to MongoDB
async function connectDB() {
    if (!MONGODB_URI) {
        console.log('⚠️  Running without MongoDB - data will not persist!');
        return;
    }
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB connected successfully!');
        isDbConnected = true;
        
        // Create default subjects if none exist
        const subjectCount = await Subject.countDocuments();
        if (subjectCount === 0) {
            await Subject.create({
                name: 'General Knowledge',
                description: 'Basic GK',
                topics: [{ name: 'History' }, { name: 'Geography' }]
            });
        }
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
    }
}

// Call connect before starting server
connectDB();

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

// Multer for file uploads (memory storage for MongoDB)
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage, fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDFs allowed'), false);
}, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

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

// Note: Database is now MongoDB (set up above)
// Data is persisted in MongoDB, not in JSON file

// General Authentication Middleware using JWT
const auth = async (req, res, next) => {
    const token = req.cookies.jwt;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Missing token.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (!isDbConnected) {
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
};

// Admin Authentication Middleware using JWT
const adminAuth = async (req, res, next) => {
    const token = req.cookies.jwt;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Missing token.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (!isDbConnected) {
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
};

// Route to get current user from token securely
app.get('/api/users/me', auth, async (req, res) => {
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
        secure: process.env.NODE_ENV === 'production',
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

// Basic API Routes using MongoDB
app.get('/api/subjects', async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const subjects = await Subject.find();
        res.json(subjects);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/subjects/:id', async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).json({ message: 'Subject not found' });
        res.json(subject);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/subjects', adminAuth, async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const newSubject = await Subject.create({ ...req.body, topics: [] });
        res.json(newSubject);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/subjects/:id', adminAuth, async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!subject) return res.status(404).json({ message: 'Subject not found' });
        res.json(subject);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/subjects/:id', adminAuth, async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        await Subject.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Topic Routes
app.post('/api/subjects/:id/topics', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        const subject = await Subject.findById(req.params.id);
        if (subject) {
            subject.topics.push({ name: req.body.name });
            await subject.save();
            res.json(subject.topics[subject.topics.length - 1]);
        } else {
            res.status(404).json({ message: 'Subject not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/subjects/:subjectId/topics/:topicId', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        const subject = await Subject.findById(req.params.subjectId);
        if (subject) {
            const topic = subject.topics.id(req.params.topicId);
            if (topic) {
                topic.name = req.body.name || topic.name;
                await subject.save();
                res.json(topic);
            } else {
                res.status(404).json({ message: 'Topic not found' });
            }
        } else {
            res.status(404).json({ message: 'Subject not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/subjects/:subjectId/topics/:topicId', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        const subject = await Subject.findById(req.params.subjectId);
        if (!subject) return res.status(404).json({ message: 'Subject not found' });
        subject.topics = subject.topics.filter(t => t._id.toString() !== req.params.topicId);
        await subject.save();
        res.json({ message: 'Topic deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MCQ Routes
app.get('/api/mcqs/all', async (req, res) => {
    if (!isDbConnected) return res.json([]);
    try {
        const mcqs = await MCQ.find();
        res.json(mcqs);
    } catch (err) {
        res.json([]);
    }
});

// MCQs category endpoint (for admin stats)
app.get('/api/mcqs-category/all', async (req, res) => {
    if (!isDbConnected) return res.json([]);
    try {
        const mcqs = await MCQ.find();
        res.json(mcqs);
    } catch (err) {
        res.json([]);
    }
});

// Filtered MCQs (Used by quiz.html)
app.get('/api/mcqs', async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const { topic, category } = req.query;
        console.log(`[API] Fetching MCQs for Topic: "${topic}", Category: "${category}"`);
        let query = {};
        if (category) query.category = category;
        if (topic) query.topic = topic;
        const results = await MCQ.find(query);
        console.log(`[API] Found ${results.length} questions.`);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/mcqs', adminAuth, async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const newMcq = await MCQ.create(req.body);
        console.log(`[MCQ Added] Topic: ${newMcq.topic}, Question: ${newMcq.question}`);
        res.json(newMcq);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/mcqs/:id', adminAuth, async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        await MCQ.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Seed Data Route (For Admin Panel - REMOVED FOR SECURITY)
// This endpoint has been removed. Use the admin panel to add data instead.

// Contact/Message Routes
app.get('/api/contact', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.json([]);
    try {
        const messages = await Message.find().sort({ date: -1 });
        res.json(messages);
    } catch (err) {
        res.json([]);
    }
});

app.post('/api/contact', async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        await Message.create({ ...req.body, date: new Date(), read: false });
        res.json({ message: 'Sent' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/contact/:id/read', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        const msg = await Message.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
        if (msg) res.json(msg);
        else res.status(404).json({ message: 'Message not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/contact/:id', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        await Message.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contact/bulk-delete', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        const { ids } = req.body;
        if (Array.isArray(ids)) {
            await Message.deleteMany({ _id: { $in: ids } });
            res.json({ message: 'Messages deleted' });
        } else {
            res.status(400).json({ message: 'Invalid request' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Settings Routes
app.get('/api/settings', async (req, res) => {
    if (!isDbConnected) return res.json({ title: 'MCQLala', footer: '© 2026 MCQLala' });
    try {
        const settings = await Setting.findOne();
        if (!settings) {
            const defaultSettings = await Setting.create({ title: 'MCQLala', footer: '© 2026 MCQLala' });
            return res.json(defaultSettings);
        }
        res.json(settings);
    } catch (err) {
        res.json({ title: 'MCQLala', footer: '© 2026 MCQLala' });
    }
});

app.post('/api/settings', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        let settings = await Setting.findOne();
        if (!settings) {
            settings = await Setting.create(req.body);
        } else {
            if (req.body.title) settings.title = req.body.title;
            if (req.body.footer) settings.footer = req.body.footer;
            await settings.save();
        }
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PDF Routes (MongoDB-based)
app.get('/api/pdfs', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    if (!isDbConnected) return res.json([]);
    try {
        const pdfs = await PDF.find().select('-data').sort({ uploadedAt: -1 });
        const files = pdfs.map(p => ({
            _id: p._id,
            name: p.name,
            url: `/api/pdfs/file/${p._id}`,
            size: p.size,
            uploadedAt: p.uploadedAt
        }));
        res.json(files);
    } catch (err) {
        res.json([]);
    }
});

app.get('/api/pdfs/file/:id', async (req, res) => {
    if (!isDbConnected) return res.status(404).json({ message: 'Not found' });
    try {
        const pdf = await PDF.findById(req.params.id);
        if (!pdf) return res.status(404).json({ message: 'PDF not found' });
        res.set('Content-Type', pdf.contentType);
        res.set('Content-Disposition', `inline; filename="${pdf.name}"`);
        res.send(pdf.data);
    } catch (err) {
        res.status(500).json({ message: 'Error loading PDF' });
    }
});

app.post('/api/pdfs', adminAuth, upload.single('pdf'), async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    try {
        const newPdf = await PDF.create({
            name: req.file.originalname,
            data: req.file.buffer,
            contentType: req.file.mimetype,
            size: req.file.size
        });
        res.json({ message: 'PDF uploaded successfully', id: newPdf._id, name: newPdf.name });
    } catch (err) {
        res.status(500).json({ message: 'Failed to save PDF' });
    }
});

app.delete('/api/pdfs/:id', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        const result = await PDF.findByIdAndDelete(req.params.id);
        if (result) res.json({ message: 'PDF deleted' });
        else res.status(404).json({ message: 'PDF not found' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting PDF' });
    }
});

// Nav Items Routes
app.get('/api/navitems', async (req, res) => {
    if (!isDbConnected) {
        return res.json([]);
    }
    try {
        const items = await NavItem.find();
        res.json(items);
    } catch (err) {
        res.json([]);
    }
});

app.post('/api/navitems', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        const item = await NavItem.create(req.body);
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/navitems/:id', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        const item = await NavItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (item) res.json(item);
        else res.status(404).json({ message: 'Nav item not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/navitems/:id', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        await NavItem.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Scores Routes
app.post('/api/scores', auth, async (req, res) => {
    const { topic, score, totalQuestions, percentage } = req.body;
    const userId = req.user._id;

    if (!userId || topic === undefined || score === undefined || totalQuestions === undefined || percentage === undefined) {
        return res.status(400).json({ message: 'Missing required score fields.' });
    }

    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }

    try {
        const scoreData = await Score.create({
            userId,
            username: req.user.username,
            topic,
            category: req.body.category,
            score,
            totalQuestions,
            percentage,
            answers: req.body.answers || []
        });
        console.log(`[SCORE] ${scoreData.username}: ${scoreData.score}/${scoreData.totalQuestions} (${scoreData.percentage}%) - ${scoreData.topic}`);
        res.json(scoreData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/scores/user/:userId', async (req, res) => {
    if (!isDbConnected) return res.json([]);
    try {
        const userScores = await Score.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.json(userScores);
    } catch (err) {
        res.json([]);
    }
});

app.get('/api/leaderboard/:topic', async (req, res) => {
    if (!isDbConnected) return res.json([]);
    try {
        const topicScores = await Score.find({ topic: req.params.topic })
            .sort({ percentage: -1 })
            .limit(10)
            .select('username score totalQuestions percentage createdAt');
        
        const formattedScores = topicScores.map(s => ({
            _id: s._id,
            score: s.score,
            totalQuestions: s.totalQuestions,
            percentage: s.percentage,
            user: { username: s.username },
            submittedAt: s.createdAt
        }));
        
        res.json(formattedScores);
    } catch (err) {
        res.json([]);
    }
});

// Login Route
app.post('/api/users/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'Invalid input: email and password required.' });
    }
    
    if (email.length > 254 || password.length > 128) {
        return res.status(400).json({ message: 'Invalid input: email or password too long.' });
    }
    
    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    
    try {
        // Allow login with either email or username
        const user = await User.findOne({ $or: [{ email }, { username: email }] });
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        // Compare password with hashed password
        const isMatch = await bcryptjs.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        // Generate JWT token
        const token = jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '1d' });
        
        // Set HttpOnly cookie
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });
        
        res.json({
            userId: user._id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Register Route
app.post('/api/users/register', loginLimiter, async (req, res) => {
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
    
    if (!isDbConnected) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    
    try {
        // Check if email or username already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ message: 'Email already in use.' });
            }
            return res.status(400).json({ message: 'Username already in use.' });
        }
        
        // Hash password before storing
        const hashedPassword = await bcryptjs.hash(password, 10);
        
        const newUser = await User.create({ 
            username, 
            email, 
            password: hashedPassword, 
            isAdmin: false 
        });
        
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Users (for Admin Panel)
app.get('/api/users', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.json({ users: [], currentPage: 1, totalPages: 0 });
    
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        
        let query = {};
        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query = { $or: [{ username: { $regex: escapedSearch, $options: 'i' } }, { email: { $regex: escapedSearch, $options: 'i' } }] };
        }
        
        const totalUsers = await User.countDocuments(query);
        const users = await User.find(query).skip((page - 1) * limit).limit(limit).select('-password');
        
        res.json({ users, currentPage: page, totalPages: Math.ceil(totalUsers / limit) });
    } catch (err) {
        res.json({ users: [], currentPage: 1, totalPages: 0 });
    }
});

app.post('/api/users/promote', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    try {
        const user = await User.findOneAndUpdate({ email: req.body.email }, { isAdmin: true }, { new: true });
        if (user) {
            res.json({ message: 'User promoted' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin promotion removed for security - use CLI or env vars to bootstrap admin

app.post('/api/users/change-password', adminAuth, async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    const { userId, newPassword } = req.body;
    
    if (!userId || !newPassword) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }
    
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    
    try {
        const hashedPassword = await bcryptjs.hash(newPassword, 10);
        const user = await User.findByIdAndUpdate(userId, { password: hashedPassword });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ message: 'Password updated successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating password.' });
    }
});

// Forgot Password Routes - using Resend (free, reliable for cloud hosting)
let emailServiceReady = false;

async function sendResetEmail(email, resetUrl) {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    
    if (!gmailUser || !gmailPass) {
        console.log(`[DEV] Reset link for ${email}: ${resetUrl}`);
        return { success: false, message: 'Reset link logged to console' };
    }
    
    console.log(`[EMAIL] Attempting to send reset email to: ${email}`);
    
    try {
        const nodemailer = require('nodemailer');
        const net = require('net');
        
        // Resolve Gmail SMTP to IPv4 manually
        const gmailIPv4 = await new Promise((resolve, reject) => {
            const dns = require('dns');
            dns.resolve4('smtp.gmail.com', (err, addresses) => {
                if (err || !addresses.length) reject(new Error('DNS lookup failed'));
                else resolve(addresses[0]);
            });
        });
        
        console.log(`[EMAIL] Using SMTP IP: ${gmailIPv4}`);
        
        const transporter = nodemailer.createTransport({
            host: gmailIPv4,
            port: 587,
            secure: false,
            requireTLS: true,
            tls: { servername: 'smtp.gmail.com' },
            connectionTimeout: 15000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
            auth: {
                user: gmailUser,
                pass: gmailPass
            }
        });

        const info = await transporter.sendMail({
            from: `"mcqlala" <${gmailUser}>`,
            to: email,
            subject: 'mcqlala - Reset Your Password',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #3B82F6;">Reset Your mcqlala Password</h2>
                    <p>Click the button below to reset your password (expires in 1 hour):</p>
                    <a href="${resetUrl}" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Reset Password</a>
                    <p style="color: #666; font-size: 14px;">Or copy this link:</p>
                    <p style="color: #3B82F6; word-break: break-all;">${resetUrl}</p>
                    <p style="color: #999; font-size: 12px;">If you didn't request this, ignore this email.</p>
                </div>
            `
        });

        console.log(`[EMAIL SENT] Reset email sent to ${email}:`, info.messageId);
        return { success: true };
    } catch (err) {
        console.error('[EMAIL ERROR]', err.message);
        return { success: false, message: err.message };
    }
}

// Check if email is configured
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    emailServiceReady = true;
    console.log('✅ Email service configured (Gmail SMTP)');
} else {
    console.warn('⚠️ GMAIL_USER and GMAIL_APP_PASSWORD not set - emails will be logged to console only');
}

app.post('/api/users/forgot-password', async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
        return res.status(400).json({ message: 'Valid email required' });
    }
    
    try {
        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal if email exists (security)
            return res.json({ message: 'If email exists, reset link sent (check spam folder)' });
        }
        
        // Generate secure token (48 chars)
        const token = require('crypto').randomBytes(24).toString('hex');
        const expiry = Date.now() + 60 * 60 * 1000; // 1 hour
        
        user.resetToken = token;
        user.resetTokenExpiry = expiry;
        await user.save();
        
        // Send email - link to frontend, not backend
        const frontendUrl = process.env.FRONTEND_URL || 'https://mcqlala.in';
        const resetUrl = `${frontendUrl}/reset-password.html?token=${token}`;
        
        if (emailServiceReady) {
            const result = await sendResetEmail(email, resetUrl);
            if (result.success) {
                res.json({ message: 'Reset link sent to your email! Check inbox/spam.' });
            } else {
                res.json({ message: 'Reset link generated! Check server console.' });
            }
        } else {
            console.log(`\n[DEV] Reset link for ${email}: ${resetUrl}\n`);
            res.json({ message: 'Reset link generated! Check server console.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error processing request' });
    }
});

app.post('/api/users/reset-password', async (req, res) => {
    if (!isDbConnected) return res.status(503).json({ message: 'Database not connected' });
    const { token, password } = req.body;
    
    if (!token || !password || password.length < 8) {
        return res.status(400).json({ message: 'Invalid token or password' });
    }
    
    try {
        const user = await User.findOne({ 
            resetToken: token, 
            resetTokenExpiry: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }
        
        const hashedPassword = await bcryptjs.hash(password, 10);
        user.password = hashedPassword;
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();
        
        console.log(`[RESET COMPLETE] Password reset for ${user.email}`);
        res.json({ message: 'Password reset successful! You can now login.' });
    } catch (err) {
        res.status(500).json({ message: 'Error resetting password' });
    }
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