const express = require('express');
const router = express.Router();
const { Subject } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { getDbStatus } = require('../config/database');
const { unescapeEntity, normalizeTopicName } = require('../utils/helpers');

router.get('/', async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const subjects = await Subject.find();
        res.json(subjects);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }
        res.json(subject);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Subject name is required.' });
        }
        const newSubject = await Subject.create({
            name: String(name).substring(0, 200),
            description: String(description || '').substring(0, 1000),
            topics: []
        });
        res.json(newSubject);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create subject.' });
    }
});

router.put('/:id', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const { name, description } = req.body;
        const allowedFields = {};
        if (name !== undefined) allowedFields.name = String(name).substring(0, 200);
        if (description !== undefined) allowedFields.description = String(description).substring(0, 1000);
        const subject = await Subject.findByIdAndUpdate(req.params.id, allowedFields, { new: true });
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }
        res.json(subject);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update subject.' });
    }
});

router.delete('/:id', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        await Subject.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete subject.' });
    }
});

router.post('/:id/topics', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ message: 'Topic name is required.' });
        }
        const subject = await Subject.findById(req.params.id);
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }
        subject.topics.push({ name: String(name).substring(0, 200) });
        await subject.save();
        res.json(subject.topics[subject.topics.length - 1]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to add topic.' });
    }
});

router.put('/:subjectId/topics/:topicId', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const subject = await Subject.findById(req.params.subjectId);
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }
        const topicId = req.params.topicId.trim();
        let topic = subject.topics.id(topicId);
        if (!topic) {
            topic = subject.topics.find(t => (typeof t === 'string' && t.trim() === topicId) || (t.name && t.name.trim() === topicId));
        }
        if (!topic) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        if (typeof topic === 'string') {
            const idx = subject.topics.indexOf(topic);
            subject.topics[idx] = { name: req.body.name || topic };
        } else {
            topic.name = req.body.name || topic.name;
        }
        await subject.save();
        res.json(topic);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:subjectId/topics/:topicId', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const subject = await Subject.findById(req.params.subjectId);
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }

        const topicParam = decodeURIComponent(req.params.topicId).trim();
        if (!topicParam) {
            return res.status(400).json({ error: 'Invalid topic identifier' });
        }

        const normalizedParam = normalizeTopicName(topicParam);

        // Build list of topics to keep (those that DON'T match the delete target)
        const originalLength = subject.topics.length;
        subject.topics = subject.topics.filter(t => {
            // Match by _id (if it's a valid ObjectId string)
            if (t._id && t._id.toString() === topicParam) {
                return false;
            }

            // Match by name (normalized comparison)
            const topicName = typeof t === 'string' ? t : t.name;
            if (!topicName) {
                return true;
            }

            const normalized = normalizeTopicName(topicName);
            if (normalized === normalizedParam) {
                return false;
            }

            // Also check unescaped version for legacy data
            const unescaped = normalizeTopicName(unescapeEntity(topicName));
            if (unescaped === normalizedParam) {
                return false;
            }

            // Case-insensitive fallback
            if (normalized.toLowerCase() === normalizedParam.toLowerCase()) {
                return false;
            }
            if (unescaped.toLowerCase() === normalizedParam.toLowerCase()) {
                return false;
            }

            return true;
        });

        if (subject.topics.length === originalLength) {
            return res.status(404).json({ message: 'Topic not found' });
        }

        await subject.save();
        res.json({ message: 'Topic deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
