const express = require('express');
const router = express.Router();
const { Visitor } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { getDbStatus } = require('../config/database');

router.post('/track', async (req, res) => {
    if (!getDbStatus()) {
        return res.json({ success: false });
    }
    try {
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        const page = req.body.page || '/';
        await Visitor.create({ ip, userAgent, page });
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false });
    }
});

router.get('/stats', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.json({ total: 0, today: 0, week: 0, month: 0, recent: [] });
    }
    try {
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        const weekStart = new Date(now.setDate(now.getDate() - 7));
        const monthStart = new Date(now.setMonth(now.getMonth() - 1));
        const total = await Visitor.countDocuments();
        const today = await Visitor.countDocuments({ visitedAt: { $gte: todayStart } });
        const week = await Visitor.countDocuments({ visitedAt: { $gte: weekStart } });
        const month = await Visitor.countDocuments({ visitedAt: { $gte: monthStart } });
        const recent = await Visitor.find().sort({ visitedAt: -1 }).limit(20).select('ip userAgent page visitedAt');
        res.json({ total, today, week, month, recent });
    } catch (err) {
        res.json({ total: 0, today: 0, week: 0, month: 0, recent: [] });
    }
});

module.exports = router;
