const { unescapeEntity, normalizeTopicName } = require('../utils/helpers');

describe('Utils - Helpers', () => {
    describe('unescapeEntity', () => {
        test('should unescape &amp; to &', () => {
            expect(unescapeEntity('Q&amp;A')).toBe('Q&A');
        });

        test('should unescape &lt; and &gt;', () => {
            expect(unescapeEntity('a&lt;b&gt;c')).toBe('a<b>c');
        });

        test('should unescape &quot;', () => {
            expect(unescapeEntity('he said &quot;hello&quot;')).toBe('he said "hello"');
        });

        test('should unescape &#x27; and &#39;', () => {
            expect(unescapeEntity('it&#x27;s')).toBe("it's");
            expect(unescapeEntity('it&#39;s')).toBe("it's");
        });

        test('should handle multiple entities', () => {
            expect(unescapeEntity('Q&amp;A: 100% &lt; 200 &gt; 50')).toBe('Q&A: 100% < 200 > 50');
        });

        test('should return empty string for null/undefined', () => {
            expect(unescapeEntity(null)).toBe('');
            expect(unescapeEntity(undefined)).toBe('');
        });

        test('should return empty string for non-string input', () => {
            expect(unescapeEntity(123)).toBe('');
            expect(unescapeEntity({})).toBe('');
        });

        test('should return unchanged string with no entities', () => {
            expect(unescapeEntity('Hello World')).toBe('Hello World');
        });
    });

    describe('normalizeTopicName', () => {
        test('should trim whitespace', () => {
            expect(normalizeTopicName('  History  ')).toBe('History');
        });

        test('should collapse multiple spaces', () => {
            expect(normalizeTopicName('Math   Science')).toBe('Math Science');
        });

        test('should handle tabs and newlines', () => {
            expect(normalizeTopicName('Math\tScience')).toBe('Math Science');
            expect(normalizeTopicName('Math\nScience')).toBe('Math Science');
        });

        test('should normalize Unicode (NFC)', () => {
            // é as combining characters vs single character
            expect(normalizeTopicName('café')).toBe('café');
        });

        test('should return empty string for null/undefined', () => {
            expect(normalizeTopicName(null)).toBe('');
            expect(normalizeTopicName(undefined)).toBe('');
        });

        test('should return empty string for non-string input', () => {
            expect(normalizeTopicName(123)).toBe('');
        });

        test('should handle empty string', () => {
            expect(normalizeTopicName('')).toBe('');
        });

        test('should handle special characters', () => {
            expect(normalizeTopicName('History & Geography')).toBe('History & Geography');
            expect(normalizeTopicName('50% Discount')).toBe('50% Discount');
        });

        test('should normalize consistently for comparison', () => {
            const name1 = '  Multiple   Spaces  ';
            const name2 = 'Multiple Spaces';
            expect(normalizeTopicName(name1)).toBe(normalizeTopicName(name2));
        });
    });
});
