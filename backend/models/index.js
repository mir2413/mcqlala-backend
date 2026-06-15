const mongoose = require('mongoose');

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
    percentage: Number,
    answers: [Number],
    timeTaken: Number,
    examMode: { type: String, default: 'none' },
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
    userId: String,
    badges: [String],
    earnedAt: { type: Date, default: Date.now }
});

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
