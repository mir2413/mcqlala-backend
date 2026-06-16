const express = require('express');
const router = express.Router();
const { Setting } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { getDbStatus } = require('../config/database');

router.get('/', async (req, res) => {
    if (!getDbStatus()) {
        return res.json({ title: 'MCQLala', footer: '© 2026 MCQLala' });
    }
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

router.post('/', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const { title, footer } = req.body;
        let settings = await Setting.findOne();
        if (!settings) {
            settings = await Setting.create({
                title: String(title || 'MCQLala').substring(0, 200),
                footer: String(footer || '').substring(0, 500)
            });
        } else {
            if (title) {
                settings.title = String(title).substring(0, 200);
            }
            if (footer) {
                settings.footer = String(footer).substring(0, 500);
            }
            await settings.save();
        }
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update settings.' });
    }
});

module.exports = router;
