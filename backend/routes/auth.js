const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { User } = require('../models');
const { auth, adminAuth } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const { getDbStatus } = require('../config/database');
const { sendResetEmail, isEmailReady } = require('../utils/email');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;

router.get('/users/me', auth, (req, res) => {
    res.json({
        userId: req.user._id,
        username: req.user.username,
        email: req.user.email,
        isAdmin: req.user.isAdmin
    });
});

router.post('/users/logout', (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('jwt', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax'
    });
    res.json({ message: 'Logged out successfully' });
});

router.get('/auth/check', auth, (req, res) => {
    res.json({
        authenticated: true,
        userId: req.user._id,
        username: req.user.username,
        email: req.user.email,
        isAdmin: req.user.isAdmin
    });
});

router.post('/users/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'Invalid input: email and password required.' });
    }
    if (email.length > 254 || password.length > 128) {
        return res.status(400).json({ message: 'Invalid input: email or password too long.' });
    }
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }

    try {
        const user = await User.findOne({ $or: [{ email }, { username: email }] });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '1d' });
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
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

router.post('/users/register', loginLimiter, async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }
    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'Invalid input format.' });
    }
    if (username.length < 3 || username.length > 50) {
        return res.status(400).json({ message: 'Username must be 3-50 characters.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.length > 254 || !emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }
    if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ message: 'Password must be 8-128 characters.' });
    }
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ message: 'Email already in use.' });
            }
            return res.status(400).json({ message: 'Username already in use.' });
        }
        const hashedPassword = await bcryptjs.hash(password, 10);
        await User.create({ username, email, password: hashedPassword, isAdmin: false });
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/users', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.json({ users: [], currentPage: 1, totalPages: 0 });
    }
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

router.post('/users/promote', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
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

router.post('/users/change-password', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
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

router.post('/users/forgot-password', async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    const { email } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ message: 'Valid email required' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ message: 'If email exists, reset link sent (check spam folder)' });
        }

        const token = crypto.randomBytes(24).toString('hex');
        const expiry = Date.now() + 60 * 60 * 1000;
        user.resetToken = token;
        user.resetTokenExpiry = expiry;
        await user.save();

        const frontendUrl = process.env.FRONTEND_URL || 'https://mcqlala.in';
        const resetUrl = `${frontendUrl}/reset-password.html?token=${token}`;

        if (isEmailReady()) {
            const result = await sendResetEmail(email, resetUrl);
            if (result.success) {
                res.json({ message: 'Reset link sent to your email! Check inbox/spam.' });
            } else {
                res.json({ message: 'Reset link generated! Check server console.' });
            }
        } else {
            res.json({ message: 'Reset link generated! Check server console.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error processing request' });
    }
});

router.post('/users/reset-password', async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    const { token, password } = req.body;
    if (!token || !password || password.length < 8) {
        return res.status(400).json({ message: 'Invalid token or password' });
    }

    try {
        const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        const hashedPassword = await bcryptjs.hash(password, 10);
        user.password = hashedPassword;
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();
        res.json({ message: 'Password reset successful! You can now login.' });
    } catch (err) {
        res.status(500).json({ message: 'Error resetting password' });
    }
});

module.exports = router;
