const express = require('express');
const router = express.Router();
const { Score, Badge } = require('../models');
const { getDbStatus } = require('../config/database');
const { auth } = require('../middleware/auth');

router.post('/scores', auth, async (req, res) => {
    const { topic, score, totalQuestions, percentage } = req.body;
    if (topic === undefined || score === undefined || totalQuestions === undefined || percentage === undefined) {
        return res.status(400).json({ message: 'Missing required score fields.' });
    }
    if (typeof score !== 'number' || typeof totalQuestions !== 'number' || typeof percentage !== 'number') {
        return res.status(400).json({ message: 'Invalid score data types.' });
    }
    if (score < 0 || totalQuestions < 0 || percentage < 0 || percentage > 100) {
        return res.status(400).json({ message: 'Invalid score values.' });
    }
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }

    try {
        const scoreData = await Score.create({
            userId: req.user._id.toString(),
            username: req.user.username,
            topic: String(topic).substring(0, 200),
            category: String(req.body.category || '').substring(0, 200),
            score,
            totalQuestions,
            percentage,
            answers: Array.isArray(req.body.answers) ? req.body.answers.slice(0, 1000) : [],
            timeTaken: typeof req.body.timeTaken === 'number' ? req.body.timeTaken : null,
            examMode: String(req.body.examMode || 'none').substring(0, 50)
        });
        res.json(scoreData);
    } catch (err) {
        res.status(500).json({ message: 'Failed to save score.' });
    }
});

router.get('/scores/user/:userId', auth, async (req, res) => {
    if (!getDbStatus()) {
        return res.json([]);
    }
    try {
        const userScores = await Score.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(100);
        res.json(userScores);
    } catch (err) {
        res.json([]);
    }
});

router.post('/badges', auth, async (req, res) => {
    if (!getDbStatus()) {
        return res.json({ success: true });
    }
    try {
        const { badges } = req.body;
        if (!Array.isArray(badges) || badges.length === 0) {
            return res.status(400).json({ message: 'Invalid badges data.' });
        }
        const sanitizedBadges = badges.map(b => String(b).substring(0, 50)).filter(Boolean).slice(0, 50);
        const userId = req.user._id.toString();
        const userBadge = await Badge.findOne({ userId });
        if (userBadge) {
            const newBadges = sanitizedBadges.filter(b => !userBadge.badges.includes(b));
            if (newBadges.length > 0) {
                userBadge.badges.push(...newBadges);
                userBadge.earnedAt = new Date();
                await userBadge.save();
            }
        } else {
            await Badge.create({ userId, badges: sanitizedBadges });
        }
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false });
    }
});

router.get('/badges/:userId', auth, async (req, res) => {
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
        const topic = decodeURIComponent(req.params.topic);
        const topicScores = await Score.find({ topic })
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
