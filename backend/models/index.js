const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, maxlength: 254 },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    resetToken: String,
    resetTokenExpiry: Number
});

const subjectSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    topics: [{ _id: mongoose.Schema.Types.ObjectId, name: { type: String, maxlength: 200 } }]
});

const mcqSchema = new mongoose.Schema({
    category: { type: String, required: true, maxlength: 200 },
    topic: { type: String, required: true, maxlength: 200 },
    question: { type: String, required: true, maxlength: 2000 },
    options: [{ type: String, maxlength: 500 }],
    correctAnswer: { type: Number, required: true, min: 0, max: 5 },
    explanation: { type: String, maxlength: 2000 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    createdAt: { type: Date, default: Date.now }
});

const scoreSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    topic: { type: String, required: true, maxlength: 200 },
    category: { type: String, maxlength: 200 },
    score: { type: Number, required: true, min: 0 },
    totalQuestions: { type: Number, required: true, min: 0 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    answers: [Number],
    timeTaken: Number,
    examMode: { type: String, default: 'none', maxlength: 50 },
    createdAt: { type: Date, default: Date.now }
});

const navItemSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 100 },
    path: { type: String, required: true, maxlength: 200 },
    icon: { type: String, maxlength: 100 }
});

const messageSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, maxlength: 254 },
    message: { type: String, required: true, maxlength: 5000 },
    date: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});

const settingSchema = new mongoose.Schema({
    title: { type: String, required: true, maxlength: 200 },
    footer: { type: String, maxlength: 500 }
});

const pdfSchema = new mongoose.Schema({
    name: String,
    filename: String,
    contentType: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
});

const visitorSchema = new mongoose.Schema({
    ip: String,
    userAgent: String,
    page: String,
    visitedAt: { type: Date, default: Date.now }
});

const badgeSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    badges: [String],
    earnedAt: { type: Date, default: Date.now }
});

scoreSchema.index({ userId: 1, createdAt: -1 });
scoreSchema.index({ topic: 1, percentage: -1 });
mcqSchema.index({ category: 1, topic: 1 });
visitorSchema.index({ visitedAt: -1 });
badgeSchema.index({ userId: 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Subject = mongoose.models.Subject || mongoose.model('Subject', subjectSchema);
const MCQ = mongoose.models.MCQ || mongoose.model('MCQ', mcqSchema);
const Score = mongoose.models.Score || mongoose.model('Score', scoreSchema);
const NavItem = mongoose.models.NavItem || mongoose.model('NavItem', navItemSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
const PDF = mongoose.models.PDF || mongoose.model('PDF', pdfSchema);
const Visitor = mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);
const Badge = mongoose.models.Badge || mongoose.model('Badge', badgeSchema);

module.exports = { User, Subject, MCQ, Score, NavItem, Message, Setting, PDF, Visitor, Badge };
