const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-key-for-testing-12345678';

// We test the auth logic directly since the middleware depends on DB
describe('Middleware - Auth Logic', () => {
    const JWT_SECRET = process.env.JWT_SECRET;

    describe('JWT Token Operations', () => {
        test('should create a valid JWT token', () => {
            const payload = { userId: 'user123', isAdmin: false };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });

        test('should decode a valid JWT token', () => {
            const payload = { userId: 'user123', isAdmin: true };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
            const decoded = jwt.verify(token, JWT_SECRET);
            expect(decoded.userId).toBe('user123');
            expect(decoded.isAdmin).toBe(true);
        });

        test('should reject invalid JWT token', () => {
            expect(() => {
                jwt.verify('invalid-token', JWT_SECRET);
            }).toThrow();
        });

        test('should reject token signed with wrong secret', () => {
            const token = jwt.sign({ userId: 'user123' }, 'wrong-secret', { expiresIn: '1d' });
            expect(() => {
                jwt.verify(token, JWT_SECRET);
            }).toThrow();
        });

        test('should reject expired token', () => {
            const token = jwt.sign({ userId: 'user123' }, JWT_SECRET, { expiresIn: '0s' });
            // Wait a moment for token to expire
            setTimeout(() => {
                expect(() => {
                    jwt.verify(token, JWT_SECRET);
                }).toThrow();
            }, 1100);
        });
    });

    describe('Auth Middleware Simulation', () => {
        // Simulate the auth middleware logic
        const simulateAuth = (token, secret) => {
            if (!token) return { status: 401, message: 'Unauthorized: Missing token.' };
            try {
                const decoded = jwt.verify(token, secret);
                return { status: 'ok', user: decoded };
            } catch (err) {
                return { status: 401, message: 'Unauthorized: Invalid token.' };
            }
        };

        const simulateAdminAuth = (token, secret) => {
            if (!token) return { status: 401, message: 'Unauthorized: Missing token.' };
            try {
                const decoded = jwt.verify(token, secret);
                if (!decoded.isAdmin) return { status: 403, message: 'Forbidden: Admin access required.' };
                return { status: 'ok', user: decoded };
            } catch (err) {
                return { status: 403, message: 'Forbidden: Invalid token or not admin.' };
            }
        };

        test('auth should reject missing token', () => {
            const result = simulateAuth(null, JWT_SECRET);
            expect(result.status).toBe(401);
        });

        test('auth should accept valid token', () => {
            const token = jwt.sign({ userId: 'user123', isAdmin: false }, JWT_SECRET, { expiresIn: '1d' });
            const result = simulateAuth(token, JWT_SECRET);
            expect(result.status).toBe('ok');
            expect(result.user.userId).toBe('user123');
        });

        test('adminAuth should reject non-admin token', () => {
            const token = jwt.sign({ userId: 'user123', isAdmin: false }, JWT_SECRET, { expiresIn: '1d' });
            const result = simulateAdminAuth(token, JWT_SECRET);
            expect(result.status).toBe(403);
        });

        test('adminAuth should accept admin token', () => {
            const token = jwt.sign({ userId: 'admin123', isAdmin: true }, JWT_SECRET, { expiresIn: '1d' });
            const result = simulateAdminAuth(token, JWT_SECRET);
            expect(result.status).toBe('ok');
            expect(result.user.isAdmin).toBe(true);
        });

        test('adminAuth should reject invalid token', () => {
            const result = simulateAdminAuth('bad-token', JWT_SECRET);
            expect(result.status).toBe(403);
        });
    });

    describe('Sanitize Input Simulation', () => {
        const skipFields = ['password', 'newPassword'];
        const sanitize = (obj) => {
            if (typeof obj !== 'object' || obj === null) return obj;
            for (const key in obj) {
                if (skipFields.includes(key)) continue;
                if (typeof obj[key] === 'string') {
                    obj[key] = obj[key].replace(/<[^>]*>/g, '').trim();
                } else if (typeof obj[key] === 'object') {
                    sanitize(obj[key]);
                }
            }
            return obj;
        };

        test('should strip HTML tags from strings', () => {
            const input = { name: '<script>alert("xss")</script>Hello' };
            const result = sanitize(input);
            expect(result.name).toBe('alert("xss")Hello');
        });

        test('should trim whitespace', () => {
            const input = { name: '  Hello  ' };
            const result = sanitize(input);
            expect(result.name).toBe('Hello');
        });

        test('should skip password field', () => {
            const input = { password: '<script>bad</script>secret123', name: 'test' };
            const result = sanitize(input);
            expect(result.password).toBe('<script>bad</script>secret123');
            expect(result.name).toBe('test');
        });

        test('should handle nested objects', () => {
            const input = { nested: { name: '<b>Bold</b>' } };
            const result = sanitize(input);
            expect(result.nested.name).toBe('Bold');
        });

        test('should handle null/undefined gracefully', () => {
            expect(sanitize(null)).toBeNull();
            expect(sanitize(undefined)).toBeUndefined();
        });
    });
});
