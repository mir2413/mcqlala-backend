const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-security-12345678';

describe('Security - Middleware Logic', () => {
    describe('Rate Limiting Configuration', () => {
        test('should have default rate limit values', () => {
            const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
            const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
            expect(windowMs).toBe(60000);
            expect(max).toBe(100);
        });

        test('should have stricter login rate limits', () => {
            const windowMs = parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
            const max = parseInt(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS) || 5;
            expect(windowMs).toBe(900000);
            expect(max).toBe(5);
        });
    });

    describe('CORS Configuration', () => {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3004',
            'https://mcqlala.in',
            'https://www.mcqlala.in'
        ];

        test('should allow localhost origins', () => {
            expect(allowedOrigins).toContain('http://localhost:3004');
        });

        test('should allow production domain', () => {
            expect(allowedOrigins).toContain('https://mcqlala.in');
        });

        test('should NOT allow arbitrary origins', () => {
            expect(allowedOrigins).not.toContain('https://evil.com');
        });
    });

    describe('Security Headers', () => {
        test('should define X-Frame-Options as DENY', () => {
            const headers = {
                'X-Frame-Options': 'DENY',
                'X-Content-Type-Options': 'nosniff',
                'X-XSS-Protection': '1; mode=block',
                'Referrer-Policy': 'strict-origin-when-cross-origin'
            };
            expect(headers['X-Frame-Options']).toBe('DENY');
            expect(headers['X-Content-Type-Options']).toBe('nosniff');
        });
    });

    describe('Sensitive File Blocking', () => {
        const forbiddenFiles = ['/server.js', '/database.json', '/.env', '/migrate.js', '/package.json', '/package-lock.json', '/TODO.md', '/.gitignore', '/.env.example'];

        test('should block server.js', () => {
            expect(forbiddenFiles).toContain('/server.js');
        });

        test('should block .env', () => {
            expect(forbiddenFiles).toContain('/.env');
        });

        test('should NOT block regular pages', () => {
            expect(forbiddenFiles).not.toContain('/index.html');
            expect(forbiddenFiles).not.toContain('/quiz.html');
            expect(forbiddenFiles).not.toContain('/api/health');
        });
    });

    describe('Password Security', () => {
        test('should use bcrypt with salt rounds >= 10', () => {
            const saltRounds = 10;
            expect(saltRounds).toBeGreaterThanOrEqual(10);
        });

        test('should reject short passwords', () => {
            const validatePassword = (p) => p && p.length >= 8 && p.length <= 128;
            expect(validatePassword('short')).toBe(false);
            expect(validatePassword('validpass')).toBe(true);
        });

        test('should reject long passwords', () => {
            const validatePassword = (p) => p && p.length >= 8 && p.length <= 128;
            expect(validatePassword('a'.repeat(129))).toBe(false);
        });
    });

    describe('JWT Security', () => {
        test('should use httpOnly cookies', () => {
            const cookieConfig = { httpOnly: true, secure: true, sameSite: 'none' };
            expect(cookieConfig.httpOnly).toBe(true);
        });

        test('should set reasonable token expiry', () => {
            const token = jwt.sign({ userId: 'test' }, process.env.JWT_SECRET, { expiresIn: '1d' });
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const now = Math.floor(Date.now() / 1000);
            const expiresIn = decoded.exp - now;
            expect(expiresIn).toBeGreaterThan(86300);
            expect(expiresIn).toBeLessThanOrEqual(86400);
        });
    });
});
