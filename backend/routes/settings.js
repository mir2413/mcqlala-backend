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
        let settings = await Setting.findOne();
        if (!settings) {
            settings = await Setting.create(req.body);
        } else {
            if (req.body.title) {
                settings.title = req.body.title;
            }
            if (req.body.footer) {
                settings.footer = req.body.footer;
            }
            await settings.save();
        }
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
