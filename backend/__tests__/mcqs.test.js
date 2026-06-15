const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-for-mcq-validation';

describe('Routes - MCQs Validation Logic', () => {
    describe('MCQ Data Validation', () => {
        const validateMCQ = (mcq) => {
            const errors = [];
            if (!mcq.question || typeof mcq.question !== 'string') errors.push('Question is required');
            if (!mcq.options || !Array.isArray(mcq.options) || mcq.options.length < 2) errors.push('At least 2 options required');
            if (mcq.correctAnswer === undefined || mcq.correctAnswer < 0) errors.push('Valid correctAnswer required');
            if (!mcq.category || typeof mcq.category !== 'string') errors.push('Category is required');
            if (!mcq.topic || typeof mcq.topic !== 'string') errors.push('Topic is required');
            return errors;
        };

        test('should accept valid MCQ', () => {
            const mcq = {
                question: 'What is 2+2?',
                options: ['3', '4', '5', '6'],
                correctAnswer: 1,
                category: 'Math',
                topic: 'Arithmetic'
            };
            expect(validateMCQ(mcq)).toHaveLength(0);
        });

        test('should reject MCQ without question', () => {
            const mcq = { options: ['a', 'b'], correctAnswer: 0, category: 'Math', topic: 'Test' };
            const errors = validateMCQ(mcq);
            expect(errors).toContain('Question is required');
        });

        test('should reject MCQ with less than 2 options', () => {
            const mcq = { question: 'Test?', options: ['a'], correctAnswer: 0, category: 'Math', topic: 'Test' };
            const errors = validateMCQ(mcq);
            expect(errors).toContain('At least 2 options required');
        });

        test('should reject MCQ with invalid correctAnswer', () => {
            const mcq = { question: 'Test?', options: ['a', 'b'], correctAnswer: -1, category: 'Math', topic: 'Test' };
            const errors = validateMCQ(mcq);
            expect(errors).toContain('Valid correctAnswer required');
        });

        test('should reject MCQ without category', () => {
            const mcq = { question: 'Test?', options: ['a', 'b'], correctAnswer: 0, topic: 'Test' };
            const errors = validateMCQ(mcq);
            expect(errors).toContain('Category is required');
        });

        test('should reject MCQ without topic', () => {
            const mcq = { question: 'Test?', options: ['a', 'b'], correctAnswer: 0, category: 'Math' };
            const errors = validateMCQ(mcq);
            expect(errors).toContain('Topic is required');
        });

        test('should reject multiple invalid fields', () => {
            const mcq = {};
            const errors = validateMCQ(mcq);
            expect(errors.length).toBeGreaterThan(1);
        });
    });

    describe('Score Calculation', () => {
        const calculateScore = (answers, correctAnswers) => {
            let correct = 0;
            answers.forEach((answer, i) => {
                if (answer === correctAnswers[i]) correct++;
            });
            return {
                score: correct,
                totalQuestions: answers.length,
                percentage: answers.length > 0 ? (correct / answers.length) * 100 : 0
            };
        };

        test('should calculate perfect score', () => {
            const answers = [0, 1, 2, 3];
            const correct = [0, 1, 2, 3];
            const result = calculateScore(answers, correct);
            expect(result.score).toBe(4);
            expect(result.percentage).toBe(100);
        });

        test('should calculate zero score', () => {
            const answers = [0, 0, 0];
            const correct = [1, 1, 1];
            const result = calculateScore(answers, correct);
            expect(result.score).toBe(0);
            expect(result.percentage).toBe(0);
        });

        test('should calculate partial score', () => {
            const answers = [0, 1, 2, 3];
            const correct = [0, 0, 2, 2];
            const result = calculateScore(answers, correct);
            expect(result.score).toBe(2);
            expect(result.percentage).toBe(50);
        });

        test('should handle empty answers', () => {
            const result = calculateScore([], []);
            expect(result.score).toBe(0);
            expect(result.percentage).toBe(0);
        });
    });

    describe('Quiz Mode Configuration', () => {
        const examModes = {
            none: { name: 'Practice Mode', duration: 0 },
            quick: { name: 'Quick Test', duration: 5 * 60 },
            standard: { name: 'Standard Test', duration: 30 * 60 },
            exam: { name: 'Exam Simulation', duration: 60 * 60 }
        };

        test('should have correct durations', () => {
            expect(examModes.none.duration).toBe(0);
            expect(examModes.quick.duration).toBe(300);
            expect(examModes.standard.duration).toBe(1800);
            expect(examModes.exam.duration).toBe(3600);
        });

        test('should have valid mode names', () => {
            Object.values(examModes).forEach(mode => {
                expect(mode.name).toBeTruthy();
                expect(typeof mode.name).toBe('string');
            });
        });
    });
});
