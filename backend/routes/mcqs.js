const express = require('express');
const router = express.Router();
const { MCQ } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { getDbStatus } = require('../config/database');

router.get('/all', async (req, res) => {
    if (!getDbStatus()) {
        if (req.query.page) {
            return res.json({ mcqs: [], currentPage: 1, totalPages: 0, total: 0 });
        }
        return res.json([]);
    }
    try {
        const page = parseInt(req.query.page);
        if (!page) {
            const mcqs = await MCQ.find();
            return res.json(mcqs);
        }
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const category = req.query.category || '';
        const topic = req.query.topic || '';
        const query = {};
        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { question: { $regex: escapedSearch, $options: 'i' } },
                { category: { $regex: escapedSearch, $options: 'i' } },
                { topic: { $regex: escapedSearch, $options: 'i' } }
            ];
        }
        if (category) {
            query.category = category;
        }
        if (topic) {
            query.topic = topic;
        }
        const total = await MCQ.countDocuments(query);
        const mcqs = await MCQ.find(query).skip((page - 1) * limit).limit(limit);
        res.json({ mcqs, currentPage: page, totalPages: Math.ceil(total / limit), total });
    } catch (err) {
        if (req.query.page) {
            return res.json({ mcqs: [], currentPage: 1, totalPages: 0, total: 0 });
        }
        res.json([]);
    }
});

router.get('/stats', async (req, res) => {
    if (!getDbStatus()) {
        return res.json({ error: 'Database not connected' });
    }
    try {
        const stats = await MCQ.aggregate([
            { $group: { _id: { topic: '$topic', category: '$category' }, count: { $sum: 1 } } },
            { $sort: { '_id.category': 1, '_id.topic': 1 } }
        ]);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const { topic, category } = req.query;
        const query = {};
        if (category) {
            query.category = category;
        }
        if (topic) {
            query.topic = topic;
        }
        const results = await MCQ.find(query);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const mcq = await MCQ.findById(req.params.id);
        if (!mcq) {
            return res.status(404).json({ message: 'MCQ not found' });
        }
        res.json(mcq);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const mcq = await MCQ.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!mcq) {
            return res.status(404).json({ message: 'MCQ not found' });
        }
        res.json(mcq);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const newMcq = await MCQ.create(req.body);
        res.json(newMcq);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const result = await MCQ.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ message: 'MCQ not found' });
        }
        res.json({ message: 'Deleted successfully' });
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
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Invalid request' });
        }
        const result = await MCQ.deleteMany({ _id: { $in: ids } });
        res.json({ message: `${result.deletedCount} questions deleted`, deletedCount: result.deletedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
