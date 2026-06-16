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
        const { name, path, icon } = req.body;
        if (!name || !path) {
            return res.status(400).json({ message: 'Name and path are required.' });
        }
        const item = await NavItem.create({
            name: String(name).substring(0, 100),
            path: String(path).substring(0, 200),
            icon: String(icon || '').substring(0, 100)
        });
        res.json(item);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create nav item.' });
    }
});

router.put('/:id', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const { name, path, icon } = req.body;
        const allowedFields = {};
        if (name !== undefined) allowedFields.name = String(name).substring(0, 100);
        if (path !== undefined) allowedFields.path = String(path).substring(0, 200);
        if (icon !== undefined) allowedFields.icon = String(icon).substring(0, 100);
        const item = await NavItem.findByIdAndUpdate(req.params.id, allowedFields, { new: true });
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ message: 'Nav item not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Failed to update nav item.' });
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
        res.status(500).json({ message: 'Failed to delete nav item.' });
    }
});

module.exports = router;
