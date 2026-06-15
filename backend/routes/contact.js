const express = require('express');
const router = express.Router();
const { Message } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { getDbStatus } = require('../config/database');

router.get('/', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.json([]);
    }
    try {
        const messages = await Message.find().sort({ date: -1 });
        res.json(messages);
    } catch (err) {
        res.json([]);
    }
});

router.post('/', async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        await Message.create({ ...req.body, date: new Date(), read: false });
        res.json({ message: 'Sent' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id/read', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const msg = await Message.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
        if (msg) {
            res.json(msg);
        } else {
            res.status(404).json({ message: 'Message not found' });
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
        await Message.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/bulk-delete', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const { ids } = req.body;
        if (Array.isArray(ids)) {
            await Message.deleteMany({ _id: { $in: ids } });
            res.json({ message: 'Messages deleted' });
        } else {
            res.status(400).json({ message: 'Invalid request' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
