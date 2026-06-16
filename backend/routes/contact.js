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
        const { name, email, message } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ message: 'Name, email, and message are required.' });
        }
        if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
            return res.status(400).json({ message: 'Invalid input format.' });
        }
        if (name.length > 100 || email.length > 254 || message.length > 5000) {
            return res.status(400).json({ message: 'Input too long.' });
        }
        await Message.create({
            name: name.substring(0, 100),
            email: email.substring(0, 254),
            message: message.substring(0, 5000),
            date: new Date(),
            read: false
        });
        res.json({ message: 'Sent' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to send message.' });
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
        if (Array.isArray(ids) && ids.length <= 500) {
            await Message.deleteMany({ _id: { $in: ids } });
            res.json({ message: 'Messages deleted' });
        } else {
            res.status(400).json({ message: 'Invalid request' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete messages.' });
    }
});

module.exports = router;
