const express = require('express');
const router = express.Router();
const { NavItem } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { getDbStatus } = require('../config/database');

router.get('/', async (req, res) => {
    if (!getDbStatus()) {
        return res.json([]);
    }
    try {
        const items = await NavItem.find();
        res.json(items);
    } catch (err) {
        res.json([]);
    }
});

router.post('/', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const item = await NavItem.create(req.body);
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const item = await NavItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ message: 'Nav item not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        await NavItem.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
