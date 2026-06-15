const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Score, Badge, User } = require('../models');
const { getDbStatus } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;

router.post('/scores', async (req, res) => {
    const { userId, topic, score, totalQuestions, percentage } = req.body;
    if (topic === undefined || score === undefined || totalQuestions === undefined || percentage === undefined) {
        return res.status(400).json({ message: 'Missing required score fields.' });
    }
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }

    try {
        let username = 'Guest';
        let dbUserId = userId || 'guest';
        const token = req.cookies.jwt;
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const user = await User.findById(decoded.userId);
                if (user) {
                    username = user.username; dbUserId = user._id.toString();
                }
            } catch (_e) { /* token invalid or user not found */ }
        }
        const scoreData = await Score.create({
            userId: dbUserId, username, topic,
            category: req.body.category || '',
            score, totalQuestions, percentage,
            answers: req.body.answers || [],
            timeTaken: req.body.timeTaken || null,
            examMode: req.body.examMode || 'none'
        });
        res.json(scoreData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/scores/user/:userId', async (req, res) => {
    if (!getDbStatus()) {
        return res.json([]);
    }
    try {
        const userScores = await Score.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.json(userScores);
    } catch (err) {
        res.json([]);
    }
});

router.post('/badges', async (req, res) => {
    if (!getDbStatus()) {
        return res.json({ success: true });
    }
    try {
        const { userId, badges } = req.body;
        const userBadge = await Badge.findOne({ userId });
        if (userBadge) {
            const newBadges = badges.filter(b => !userBadge.badges.includes(b));
            if (newBadges.length > 0) {
                userBadge.badges.push(...newBadges);
                userBadge.earnedAt = new Date();
                await userBadge.save();
            }
        } else {
            await Badge.create({ userId, badges });
        }
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

router.get('/badges/:userId', async (req, res) => {
    if (!getDbStatus()) {
        return res.json({ badges: [] });
    }
    try {
        const userBadge = await Badge.findOne({ userId: req.params.userId });
        res.json({ badges: userBadge ? userBadge.badges : [] });
    } catch (err) {
        res.json({ badges: [] });
    }
});

router.get('/leaderboard/:topic', async (req, res) => {
    if (!getDbStatus()) {
        return res.json([]);
    }
    try {
        const topicScores = await Score.find({ topic: req.params.topic })
            .sort({ percentage: -1 }).limit(10)
            .select('username score totalQuestions percentage createdAt');
        const formattedScores = topicScores.map(s => ({
            _id: s._id, score: s.score, totalQuestions: s.totalQuestions,
            percentage: s.percentage, user: { username: s.username }, submittedAt: s.createdAt
        }));
        res.json(formattedScores);
    } catch (err) {
        res.json([]);
    }
});

module.exports = router;
