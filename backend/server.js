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
    createdAt: { type: Date, default: Date.now }
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

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Subject = mongoose.models.Subject || mongoose.model('Subject', subjectSchema);
const MCQ = mongoose.models.MCQ || mongoose.model('MCQ', mcqSchema);
const Score = mongoose.models.Score || mongoose.model('Score', scoreSchema);
const NavItem = mongoose.models.NavItem || mongoose.model('NavItem', navItemSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

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
        
        // Create default nav items if none exist
        const navCount = await NavItem.countDocuments();
        if (navCount === 0) {
            await NavItem.create([
                { name: 'Home', path: '/', icon: 'fa fa-home' },
                { name: 'Admin Panel', path: '/admin.html', icon: 'fa fa-cogs' },
                { name: 'Quiz', path: '/quiz.html', icon: 'fa fa-question-circle' },
                { name: 'Leaderboard', path: '/leaderboard.html', icon: 'fa fa-trophy' }
            ]);
        }
        
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
            query = { $or: [{ username: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] };
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

app.post('/api/users/change-password', adminAuth, async (req, res) => {
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