const request = require('supertest');
const express = require('express');

process.env.JWT_SECRET = 'test-secret-for-subjects-12345678';
process.env.NODE_ENV = 'test';

const mockSubjects = {};
let mockDbConnected = true;

jest.mock('../config/database', () => ({
    getDbStatus: () => mockDbConnected,
    connectDB: jest.fn()
}));

jest.mock('../models', () => ({
    Subject: {
        find: jest.fn().mockResolvedValue([]),
        findById: jest.fn().mockImplementation((id) => {
            if (mockSubjects[id]) {
                const subj = mockSubjects[id];
                return Promise.resolve({
                    _id: subj._id,
                    name: subj.name,
                    description: subj.description,
                    topics: [...subj.topics],
                    save: jest.fn().mockImplementation(function() {
                        mockSubjects[id].topics = [...this.topics];
                        return Promise.resolve(this);
                    })
                });
            }
            return Promise.resolve(null);
        }),
        countDocuments: jest.fn().mockResolvedValue(0),
        create: jest.fn()
    },
    User: {}, MCQ: {}, Score: {}, NavItem: {}, Message: {},
    Setting: {}, PDF: {}, Visitor: {}, Badge: {}
}));

jest.mock('../middleware/auth', () => ({
    auth: (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Unauthorized' });
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = { _id: decoded.userId, isAdmin: decoded.isAdmin };
            next();
        } catch (err) {
            return res.status(401).json({ message: 'Invalid token' });
        }
    },
    adminAuth: (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Unauthorized' });
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (!decoded.isAdmin) return res.status(403).json({ message: 'Forbidden' });
            req.user = { _id: decoded.userId, isAdmin: true };
            next();
        } catch (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
    }
}));

const subjectsRouter = require('../routes/subjects');

describe('Routes - Subjects', () => {
    let app;
    let adminToken;
    let nonAdminToken;

    beforeAll(() => {
        const jwt = require('jsonwebtoken');
        adminToken = jwt.sign({ userId: 'admin-id', isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
        nonAdminToken = jwt.sign({ userId: 'user-id', isAdmin: false }, process.env.JWT_SECRET, { expiresIn: '1h' });

        app = express();
        app.use(express.json());
        app.use('/api/subjects', subjectsRouter);
    });

    beforeEach(() => {
        Object.keys(mockSubjects).forEach(key => delete mockSubjects[key]);
        mockDbConnected = true;
    });

    describe('GET /api/subjects', () => {
        test('should return 503 when DB is not connected', async () => {
            mockDbConnected = false;
            const response = await request(app).get('/api/subjects');
            expect(response.status).toBe(503);
        });
    });

    describe('POST /api/subjects', () => {
        test('should require admin authentication', async () => {
            const response = await request(app)
                .post('/api/subjects')
                .send({ name: 'Test Subject' });
            expect(response.status).toBe(401);
        });

        test('should reject non-admin users', async () => {
            const response = await request(app)
                .post('/api/subjects')
                .set('Authorization', `Bearer ${nonAdminToken}`)
                .send({ name: 'Test Subject' });
            expect(response.status).toBe(403);
        });
    });

    describe('DELETE /api/subjects', () => {
        test('should require admin authentication', async () => {
            const response = await request(app).delete('/api/subjects/some-id');
            expect(response.status).toBe(401);
        });
    });

    describe('DELETE /api/subjects/:subjectId/topics/:topicId', () => {
        test('should return 404 for non-existent subject', async () => {
            const response = await request(app)
                .delete('/api/subjects/nonexistent/topics/Math')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.status).toBe(404);
        });

        test('should delete topic by name', async () => {
            mockSubjects['subj1'] = {
                _id: 'subj1',
                name: 'Science',
                description: 'Science subjects',
                topics: [{ name: 'Physics' }, { name: 'Chemistry' }]
            };

            const response = await request(app)
                .delete('/api/subjects/subj1/topics/Physics')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
            expect(mockSubjects['subj1'].topics.length).toBe(1);
        });

        test('should handle URL-encoded topic names', async () => {
            mockSubjects['subj2'] = {
                _id: 'subj2',
                name: 'General',
                description: 'General',
                topics: [{ name: 'History & Geography' }]
            };

            const response = await request(app)
                .delete(`/api/subjects/subj2/topics/${encodeURIComponent('History & Geography')}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
            expect(mockSubjects['subj2'].topics.length).toBe(0);
        });

        test('should return 404 when topic not found', async () => {
            mockSubjects['subj3'] = {
                _id: 'subj3',
                name: 'Science',
                description: 'Science',
                topics: [{ name: 'Physics' }]
            };

            const response = await request(app)
                .delete('/api/subjects/subj3/topics/NonExistent')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.status).toBe(404);
        });
    });
});
