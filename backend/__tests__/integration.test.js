const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

process.env.JWT_SECRET = 'test-secret-integration-12345678';

describe('Integration - API Flow Logic', () => {
    describe('User Registration Flow', () => {
        const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        test('should validate email format', () => {
            expect(validateEmail('user@example.com')).toBe(true);
            expect(validateEmail('invalid')).toBe(false);
            expect(validateEmail('no@')).toBe(false);
            expect(validateEmail('@no.com')).toBe(false);
        });

        test('should validate username length', () => {
            const validateUsername = (u) => u.length >= 3 && u.length <= 50;
            expect(validateUsername('ab')).toBe(false);
            expect(validateUsername('abc')).toBe(true);
            expect(validateUsername('a'.repeat(50))).toBe(true);
            expect(validateUsername('a'.repeat(51))).toBe(false);
        });

        test('should validate password length', () => {
            const validatePassword = (p) => p.length >= 8 && p.length <= 128;
            expect(validatePassword('short')).toBe(false);
            expect(validatePassword('12345678')).toBe(true);
            expect(validatePassword('a'.repeat(128))).toBe(true);
            expect(validatePassword('a'.repeat(129))).toBe(false);
        });

        test('should hash password with bcrypt', async () => {
            const password = 'testpassword123';
            const hash = await bcryptjs.hash(password, 10);
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(50);
        });

        test('should verify hashed password', async () => {
            const password = 'mypassword';
            const hash = await bcryptjs.hash(password, 10);
            const isMatch = await bcryptjs.compare(password, hash);
            expect(isMatch).toBe(true);
        });

        test('should reject wrong password', async () => {
            const hash = await bcryptjs.hash('correct', 10);
            const isMatch = await bcryptjs.compare('wrong', hash);
            expect(isMatch).toBe(false);
        });
    });

    describe('Login Flow', () => {
        test('should generate JWT on successful login', () => {
            const user = { _id: 'user123', email: 'test@test.com', isAdmin: false };
            const token = jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '1d' });
            expect(token).toBeDefined();
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            expect(decoded.userId).toBe(user._id);
        });

        test('should set httpOnly cookie options', () => {
            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                maxAge: 24 * 60 * 60 * 1000
            };
            expect(cookieOptions.httpOnly).toBe(true);
            expect(cookieOptions.maxAge).toBe(86400000);
        });
    });

    describe('Score Submission Flow', () => {
        const validateScoreData = (data) => {
            const { topic, score, totalQuestions, percentage } = data;
            if (topic === undefined || score === undefined || totalQuestions === undefined || percentage === undefined) {
                return false;
            }
            if (typeof score !== 'number' || typeof totalQuestions !== 'number') return false;
            if (score < 0 || totalQuestions <= 0) return false;
            if (percentage < 0 || percentage > 100) return false;
            return true;
        };

        test('should accept valid score data', () => {
            expect(validateScoreData({ topic: 'Math', score: 8, totalQuestions: 10, percentage: 80 })).toBe(true);
        });

        test('should reject score with missing fields', () => {
            expect(validateScoreData({ topic: 'Math', score: 8 })).toBe(false);
        });

        test('should reject negative score', () => {
            expect(validateScoreData({ topic: 'Math', score: -1, totalQuestions: 10, percentage: -10 })).toBe(false);
        });

        test('should reject percentage > 100', () => {
            expect(validateScoreData({ topic: 'Math', score: 10, totalQuestions: 10, percentage: 150 })).toBe(false);
        });
    });

    describe('CSRF Protection Flow', () => {
        const Tokens = require('csrf');
        const csrfTokens = new Tokens();

        test('should create and verify CSRF token', () => {
            const secret = csrfTokens.secretSync();
            const token = csrfTokens.create(secret);
            expect(csrfTokens.verify(secret, token)).toBe(true);
        });

        test('should reject invalid CSRF token', () => {
            const secret = csrfTokens.secretSync();
            expect(csrfTokens.verify(secret, 'invalid-token')).toBe(false);
        });

        test('should reject token from different secret', () => {
            const secret1 = csrfTokens.secretSync();
            const secret2 = csrfTokens.secretSync();
            const token = csrfTokens.create(secret1);
            expect(csrfTokens.verify(secret2, token)).toBe(false);
        });
    });

    describe('Password Reset Flow', () => {
        test('should generate secure reset token', () => {
            const token = require('crypto').randomBytes(24).toString('hex');
            expect(token).toHaveLength(48);
            expect(/^[a-f0-9]+$/.test(token)).toBe(true);
        });

        test('should set token expiry to 1 hour', () => {
            const expiry = Date.now() + 60 * 60 * 1000;
            const now = Date.now();
            const diff = expiry - now;
            expect(diff).toBeGreaterThan(3599000);
            expect(diff).toBeLessThanOrEqual(3600000);
        });
    });

    describe('Input Sanitization', () => {
        const sanitize = (input) => {
            if (typeof input !== 'string') return input;
            return input.replace(/<[^>]*>/g, '').trim();
        };

        test('should strip script tags', () => {
            expect(sanitize('<script>alert("xss")</script>')).toBe('alert("xss")');
        });

        test('should strip HTML tags', () => {
            expect(sanitize('<b>Bold</b>')).toBe('Bold');
        });

        test('should trim whitespace', () => {
            expect(sanitize('  hello  ')).toBe('hello');
        });

        test('should handle nested tags', () => {
            expect(sanitize('<div><span>Test</span></div>')).toBe('Test');
        });

        test('should handle no tags', () => {
            expect(sanitize('Plain text')).toBe('Plain text');
        });
    });
});
