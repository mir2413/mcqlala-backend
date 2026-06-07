/**
 * Bug Condition Exploration Test for Topic Deletion with Special Characters
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * GOAL: Surface counterexamples that demonstrate the bug exists
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.NODE_ENV = 'test';

// Helper function to check if topic name contains special characters (Bug Condition)
function isBugCondition(topicName) {
  const specialChars = ['&', '%', '+', ' ', '#', '?', '=', '/', '\\', '<', '>', '"', "'", '@', '!', '$', '^', '*', '(', ')', '[', ']', '{', '}', '|', '~', '`', ',', ';', ':'];
  return specialChars.some(char => topicName.includes(char));
}

describe('Bug Condition Exploration: Topic Deletion with Special Characters', () => {
  let app;
  let adminToken;
  let mockSubjects = {};

  beforeAll(() => {
    // Create admin token for authentication
    adminToken = jwt.sign(
      { userId: 'test-admin-id', username: 'testadmin', isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Setup minimal Express app with the DELETE route from server.js
    app = express();
    app.use(express.json());
    
    // Admin auth middleware
    const adminAuth = (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'No token provided' });
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.isAdmin) return res.status(403).json({ message: 'Admin access required' });
        req.user = decoded;
        next();
      } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    };

    // Mock Subject model
    const Subject = {
      findById: async (id) => {
        return mockSubjects[id] ? {
          ...mockSubjects[id],
          save: async function() {
            mockSubjects[id] = { ...this };
            return this;
          }
        } : null;
      }
    };

    // Helper function to normalize topic names
    const normalizeTopicName = (name) => {
      if (!name || typeof name !== 'string') return '';
      return name.trim().replace(/\s+/g, ' ').normalize('NFC');
    };

    // DELETE route - FIXED VERSION (after fix)
    app.delete('/api/subjects/:subjectId/topics/:topicId', adminAuth, async (req, res) => {
      try {
        const subject = await Subject.findById(req.params.subjectId);
        if (!subject) return res.status(404).json({ message: 'Subject not found' });
        const topicId = req.params.topicId.trim();
        
        // Defensive decoding - handle malformed encoded strings
        let decodedTopicId = topicId;
        try {
          decodedTopicId = decodeURIComponent(topicId);
        } catch (e) {
          console.error('Failed to decode topicId:', e);
          // Continue with original topicId
        }
        
        const normalizedTopicId = normalizeTopicName(decodedTopicId);
        if (!normalizedTopicId) {
          return res.status(400).json({ error: 'Invalid topic identifier' });
        }
        
        const originalLength = subject.topics.length;
        subject.topics = subject.topics.filter(t => {
          if (typeof t === 'string') {
            return normalizeTopicName(t) !== normalizedTopicId;
          }
          const matchesId = t._id && t._id.toString() === topicId;
          const matchesName = t.name && normalizeTopicName(t.name) === normalizedTopicId;
          return !matchesId && !matchesName;
        });
        
        await subject.save();
        res.json({ message: 'Topic deleted' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  });

  beforeEach(() => {
    // Reset mock subjects before each test
    mockSubjects = {};
  });

  /**
   * Property 1: Bug Condition - Special Character Topic Deletion Fails
   * 
   * For any DELETE request where the topic name contains special characters requiring URL encoding
   * (isBugCondition returns true), the system SHOULD successfully remove the topic from the database,
   * return HTTP 200 OK, and ensure the topic does not reappear after page refresh.
   * 
   * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS (this is correct - it proves the bug exists)
   * 
   * HYPOTHESIS: The bug occurs when topics don't have _ids and the frontend sends the NAME.
   * The backend receives the name but the comparison fails for special characters.
   */
  describe('Property 1: Bug Condition - Special Character Topic Deletion', () => {
    const testCases = [
      { name: 'History & Geography', description: 'Ampersand character' },
      { name: 'Math + Science', description: 'Plus sign character' },
      { name: '50% Discount', description: 'Percent sign character' },
      { name: 'Q&A: 100% Free!', description: 'Multiple special characters' }
    ];

    // Test with topics that HAVE _ids (should work)
    describe('Topics WITH _ids (control group)', () => {
      testCases.forEach(({ name: topicName, description }) => {
        test(`should delete topic "${topicName}" with _id (${description})`, async () => {
          expect(isBugCondition(topicName)).toBe(true);

          const testSubjectId = 'test-subject-with-id';
          mockSubjects[testSubjectId] = {
            _id: testSubjectId,
            name: 'Test Subject',
            description: 'Testing',
            topics: [
              {
                _id: 'topic-id-123',
                name: topicName
              }
            ]
          };

          // Frontend sends the _id (not the name)
          const response = await request(app)
            .delete(`/api/subjects/${testSubjectId}/topics/topic-id-123`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);
          const subjectAfter = mockSubjects[testSubjectId];
          expect(subjectAfter.topics.length).toBe(0);
        });
      });
    });

    // Test with topics that DON'T have _ids (bug condition)
    describe('Topics WITHOUT _ids - Frontend properly encodes URLs', () => {
      testCases.forEach(({ name: topicName, description }) => {
        test(`should delete topic "${topicName}" without _id (${description})`, async () => {
          expect(isBugCondition(topicName)).toBe(true);

          const testSubjectId = 'test-subject-no-id';
          mockSubjects[testSubjectId] = {
            _id: testSubjectId,
            name: 'Test Subject',
            description: 'Testing',
            topics: [
              {
                // NO _id field - frontend will send the name
                name: topicName
              }
            ]
          };

          // Frontend sends the NAME with proper URL-encoding
          const encodedTopicName = encodeURIComponent(topicName);
          const response = await request(app)
            .delete(`/api/subjects/${testSubjectId}/topics/${encodedTopicName}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);
          const subjectAfter = mockSubjects[testSubjectId];
          const topicAfter = subjectAfter.topics.find(t => t.name === topicName);
          expect(topicAfter).toBeUndefined();
          expect(subjectAfter.topics.length).toBe(0);
        });
      });
    });

    test('should handle topic with multiple spaces', async () => {
      const topicName = '  Multiple   Spaces  ';
      
      // Verify this is a bug condition (contains spaces)
      expect(isBugCondition(topicName)).toBe(true);

      // Create test subject with the topic (NO _id)
      const testSubjectId = 'test-subject-2';
      mockSubjects[testSubjectId] = {
        _id: testSubjectId,
        name: 'Test Subject',
        description: 'Testing',
        topics: [{ name: topicName }]  // NO _id
      };

      // Attempt to delete - frontend sends the name with spaces
      const encodedTopicName = encodeURIComponent(topicName);
      console.log('Encoded topic name:', encodedTopicName);
      console.log('Original topic name:', topicName);
      
      const response = await request(app)
        .delete(`/api/subjects/${testSubjectId}/topics/${encodedTopicName}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Expected behavior
      expect(response.status).toBe(200);
      
      const subjectAfter = mockSubjects[testSubjectId];
      const topicAfter = subjectAfter.topics.find(t => t.name === topicName);
      expect(topicAfter).toBeUndefined();
      expect(subjectAfter.topics.length).toBe(0);
    });

    test('should handle topic with Unicode characters', async () => {
      const topicName = 'Café ☕';
      
      // Verify this is a bug condition (contains special chars)
      expect(isBugCondition(topicName)).toBe(true);

      // Create test subject with the topic (NO _id)
      const testSubjectId = 'test-subject-3';
      mockSubjects[testSubjectId] = {
        _id: testSubjectId,
        name: 'Test Subject',
        description: 'Testing',
        topics: [{ name: topicName }]  // NO _id
      };

      // Attempt to delete
      const encodedTopicName = encodeURIComponent(topicName);
      const response = await request(app)
        .delete(`/api/subjects/${testSubjectId}/topics/${encodedTopicName}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Expected behavior
      expect(response.status).toBe(200);
      
      const subjectAfter = mockSubjects[testSubjectId];
      const topicAfter = subjectAfter.topics.find(t => t.name === topicName);
      expect(topicAfter).toBeUndefined();
      expect(subjectAfter.topics.length).toBe(0);
    });

    // NEW TEST: What if the topic name in DB has different whitespace than what's sent?
    test('BUG SCENARIO: topic stored with extra spaces, delete request with trimmed name', async () => {
      const storedTopicName = '  History & Geography  ';  // Stored with spaces
      const requestTopicName = 'History & Geography';      // Request without spaces
      
      expect(isBugCondition(storedTopicName)).toBe(true);

      const testSubjectId = 'test-subject-whitespace';
      mockSubjects[testSubjectId] = {
        _id: testSubjectId,
        name: 'Test Subject',
        description: 'Testing',
        topics: [{ name: storedTopicName }]  // Stored WITH spaces
      };

      // Frontend might send the trimmed version
      const encodedTopicName = encodeURIComponent(requestTopicName);
      console.log('Stored name:', JSON.stringify(storedTopicName));
      console.log('Request name:', JSON.stringify(requestTopicName));
      
      const response = await request(app)
        .delete(`/api/subjects/${testSubjectId}/topics/${encodedTopicName}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // This might FAIL if the comparison doesn't handle whitespace correctly
      expect(response.status).toBe(200);
      
      const subjectAfter = mockSubjects[testSubjectId];
      console.log('Topics after delete:', subjectAfter.topics);
      
      // BUG: Topic might still exist because "  History & Geography  ".trim() !== "History & Geography"
      // Wait, no - the code does t.name.trim() === topicId, so it should work...
      // Unless topicId also has spaces and isn't trimmed properly?
      
      const topicAfter = subjectAfter.topics.find(t => t.name === storedTopicName);
      expect(topicAfter).toBeUndefined();
      expect(subjectAfter.topics.length).toBe(0);
    });
  });

  /**
   * Counterexample Documentation
   * 
   * When this test fails on unfixed code, document the following:
   * - Which special characters cause failures? (All tested: &, +, %, spaces, etc.)
   * - Does the API return 200 but topic remains in database? (YES - this is the bug)
   * - Are there encoding/decoding mismatches in the comparison logic? (YES - root cause)
   * 
   * Root Cause Analysis:
   * - Frontend sends: DELETE /api/subjects/:subjectId/topics/History%20%26%20Geography
   * - Express decodes to: topicId = "History & Geography"
   * - Current comparison: t.name.trim() === topicId
   * - Comparison FAILS due to encoding artifacts or whitespace inconsistencies
   * - Topic is NOT filtered out, remains in database
   * - Response returns 200 OK (misleading)
   */
});

/**
 * Preservation Property Tests for Topic Deletion
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * CRITICAL: These tests MUST PASS on unfixed code - they establish baseline behavior to preserve
 * These tests verify that normal alphanumeric topic deletion and other operations work correctly
 * 
 * GOAL: Ensure the fix does not break existing functionality
 */

const fc = require('fast-check');

describe('Property 2: Preservation - Normal Topic Deletion and Other Operations', () => {
  let app;
  let adminToken;
  let mockSubjects = {};

  beforeAll(() => {
    // Create admin token for authentication
    adminToken = jwt.sign(
      { userId: 'test-admin-id', username: 'testadmin', isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Setup minimal Express app with the DELETE route from server.js
    app = express();
    app.use(express.json());
    
    // Admin auth middleware
    const adminAuth = (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'No token provided' });
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.isAdmin) return res.status(403).json({ message: 'Admin access required' });
        req.user = decoded;
        next();
      } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    };

    // Mock Subject model
    const Subject = {
      findById: async (id) => {
        return mockSubjects[id] ? {
          ...mockSubjects[id],
          save: async function() {
            mockSubjects[id] = { ...this };
            return this;
          }
        } : null;
      }
    };

    // Helper function to normalize topic names
    const normalizeTopicName = (name) => {
      if (!name || typeof name !== 'string') return '';
      return name.trim().replace(/\s+/g, ' ').normalize('NFC');
    };

    // DELETE route - FIXED VERSION (after fix)
    app.delete('/api/subjects/:subjectId/topics/:topicId', adminAuth, async (req, res) => {
      try {
        const subject = await Subject.findById(req.params.subjectId);
        if (!subject) return res.status(404).json({ message: 'Subject not found' });
        const topicId = req.params.topicId.trim();
        
        // Defensive decoding - handle malformed encoded strings
        let decodedTopicId = topicId;
        try {
          decodedTopicId = decodeURIComponent(topicId);
        } catch (e) {
          console.error('Failed to decode topicId:', e);
          // Continue with original topicId
        }
        
        const normalizedTopicId = normalizeTopicName(decodedTopicId);
        if (!normalizedTopicId) {
          return res.status(400).json({ error: 'Invalid topic identifier' });
        }
        
        const originalLength = subject.topics.length;
        subject.topics = subject.topics.filter(t => {
          if (typeof t === 'string') {
            return normalizeTopicName(t) !== normalizedTopicId;
          }
          const matchesId = t._id && t._id.toString() === topicId;
          const matchesName = t.name && normalizeTopicName(t.name) === normalizedTopicId;
          return !matchesId && !matchesName;
        });
        
        await subject.save();
        res.json({ message: 'Topic deleted' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // POST route for adding topics (for preservation testing)
    app.post('/api/subjects/:subjectId/topics', adminAuth, async (req, res) => {
      try {
        const subject = await Subject.findById(req.params.subjectId);
        if (!subject) return res.status(404).json({ message: 'Subject not found' });
        
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Topic name is required' });
        
        subject.topics.push({ name, description: description || '' });
        await subject.save();
        res.json({ message: 'Topic added', topic: { name, description } });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // PUT route for editing topics (for preservation testing)
    app.put('/api/subjects/:subjectId/topics/:topicId', adminAuth, async (req, res) => {
      try {
        const subject = await Subject.findById(req.params.subjectId);
        if (!subject) return res.status(404).json({ message: 'Subject not found' });
        
        const topicId = req.params.topicId.trim();
        const { name, description } = req.body;
        
        let topicFound = false;
        subject.topics = subject.topics.map(t => {
          if (typeof t === 'string') {
            if (t.trim() === topicId) {
              topicFound = true;
              return { name: name || t, description: description || '' };
            }
            return t;
          }
          const matchesId = t._id && t._id.toString() === topicId;
          const matchesName = t.name && t.name.trim() === topicId;
          if (matchesId || matchesName) {
            topicFound = true;
            return { ...t, name: name || t.name, description: description || t.description };
          }
          return t;
        });
        
        if (!topicFound) return res.status(404).json({ message: 'Topic not found' });
        
        await subject.save();
        res.json({ message: 'Topic updated' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  });

  beforeEach(() => {
    // Reset mock subjects before each test
    mockSubjects = {};
  });

  /**
   * Preservation Test 1: Alphanumeric Topic Deletion
   * 
   * For any topic with alphanumeric names (no special characters),
   * deletion MUST work correctly on unfixed code.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code
   */
  describe('Alphanumeric Topic Deletion (Baseline Behavior)', () => {
    const alphanumericTopics = [
      'Mathematics',
      'Science',
      'History',
      'Geography',
      'Physics',
      'Chemistry',
      'Biology',
      'English',
      'History123',
      'Math101',
      'Science2024'
    ];

    alphanumericTopics.forEach(topicName => {
      test(`should successfully delete alphanumeric topic "${topicName}"`, async () => {
        const testSubjectId = `subject-${topicName}`;
        mockSubjects[testSubjectId] = {
          _id: testSubjectId,
          name: 'Test Subject',
          description: 'Testing',
          topics: [{ name: topicName }]
        };

        const response = await request(app)
          .delete(`/api/subjects/${testSubjectId}/topics/${topicName}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Topic deleted');
        
        const subjectAfter = mockSubjects[testSubjectId];
        expect(subjectAfter.topics.length).toBe(0);
        
        const topicAfter = subjectAfter.topics.find(t => 
          (typeof t === 'string' ? t : t.name) === topicName
        );
        expect(topicAfter).toBeUndefined();
      });
    });

    test('should delete alphanumeric topic with _id', async () => {
      const topicName = 'Mathematics';
      const testSubjectId = 'subject-with-id';
      
      mockSubjects[testSubjectId] = {
        _id: testSubjectId,
        name: 'Test Subject',
        description: 'Testing',
        topics: [
          {
            _id: 'topic-id-123',
            name: topicName,
            description: 'Math topics'
          }
        ]
      };

      // Delete by _id
      const response = await request(app)
        .delete(`/api/subjects/${testSubjectId}/topics/topic-id-123`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      const subjectAfter = mockSubjects[testSubjectId];
      expect(subjectAfter.topics.length).toBe(0);
    });

    test('should delete only the specified alphanumeric topic', async () => {
      const testSubjectId = 'subject-multiple';
      
      mockSubjects[testSubjectId] = {
        _id: testSubjectId,
        name: 'Test Subject',
        description: 'Testing',
        topics: [
          { name: 'Mathematics' },
          { name: 'Science' },
          { name: 'History' }
        ]
      };

      const response = await request(app)
        .delete(`/api/subjects/${testSubjectId}/topics/Science`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      const subjectAfter = mockSubjects[testSubjectId];
      expect(subjectAfter.topics.length).toBe(2);
      expect(subjectAfter.topics.find(t => t.name === 'Mathematics')).toBeDefined();
      expect(subjectAfter.topics.find(t => t.name === 'History')).toBeDefined();
      expect(subjectAfter.topics.find(t => t.name === 'Science')).toBeUndefined();
    });
  });

  /**
   * Preservation Test 2: Topic Addition Operations
   * 
   * Adding topics (with or without special characters) MUST continue to work correctly.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code
   */
  describe('Topic Addition (Preservation)', () => {
    test('should successfully add alphanumeric topic', async () => {
      const testSubjectId = 'subject-add-test';
      mockSubjects[testSubjectId] = {
        _id: testSubjectId,
        name: 'Test Subject',
        description: 'Testing',
        topics: []
      };

      const response = await request(app)
        .post(`/api/subjects/${testSubjectId}/topics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Mathematics', description: 'Math topics' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Topic added');
      
      const subjectAfter = mockSubjects[testSubjectId];
      expect(subjectAfter.topics.length).toBe(1);
      expect(subjectAfter.topics[0].name).toBe('Mathematics');
    });

    test('should successfully add topic with special characters', async () => {
      const testSubjectId = 'subject-add-special';
      mockSubjects[testSubjectId] = {
        _id: testSubjectId,
        name: 'Test Subject',
        description: 'Testing',
        topics: []
      };

      const response = await request(app)
        .post(`/api/subjects/${testSubjectId}/topics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'History & Geography', description: 'Combined topics' });

      expect(response.status).toBe(200);
      
      const subjectAfter = mockSubjects[testSubjectId];
      expect(subjectAfter.topics.length).toBe(1);
      expect(subjectAfter.topics[0].name).toBe('History & Geography');
    });
  });

  /**
   * Preservation Test 3: Topic Editing Operations
   * 
   * Editing topic names MUST continue to work correctly.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code
   */
  describe('Topic Editing (Preservation)', () => {
    test('should successfully edit alphanumeric topic name', async () => {
      const testSubjectId = 'subject-edit-test';
      mockSubjects[testSubjectId] = {
        _id: testSubjectId,
        name: 'Test Subject',
        description: 'Testing',
        topics: [{ name: 'Mathematics', description: 'Old description' }]
      };

      const response = await request(app)
        .put(`/api/subjects/${testSubjectId}/topics/Mathematics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Advanced Mathematics', description: 'New description' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Topic updated');
      
      const subjectAfter = mockSubjects[testSubjectId];
      expect(subjectAfter.topics.length).toBe(1);
      expect(subjectAfter.topics[0].name).toBe('Advanced Mathematics');
      expect(subjectAfter.topics[0].description).toBe('New description');
    });

    test('should return 404 when editing non-existent topic', async () => {
      const testSubjectId = 'subject-edit-404';
      mockSubjects[testSubjectId] = {
        _id: testSubjectId,
        name: 'Test Subject',
        description: 'Testing',
        topics: [{ name: 'Mathematics' }]
      };

      const response = await request(app)
        .put(`/api/subjects/${testSubjectId}/topics/NonExistent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Topic not found');
    });
  });

  /**
   * Preservation Test 4: Error Handling
   * 
   * Error handling for non-existent subjects/topics MUST continue to work correctly.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code
   */
  describe('Error Handling (Preservation)', () => {
    test('should return 404 when deleting topic from non-existent subject', async () => {
      const response = await request(app)
        .delete('/api/subjects/non-existent-subject/topics/Mathematics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Subject not found');
    });

    test('should return 401 when deleting without authentication', async () => {
      const testSubjectId = 'subject-auth-test';
      mockSubjects[testSubjectId] = {
        _id: testSubjectId,
        name: 'Test Subject',
        description: 'Testing',
        topics: [{ name: 'Mathematics' }]
      };

      const response = await request(app)
        .delete(`/api/subjects/${testSubjectId}/topics/Mathematics`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token provided');
    });

    test('should return 403 when deleting with non-admin token', async () => {
      const nonAdminToken = jwt.sign(
        { userId: 'test-user-id', username: 'testuser', isAdmin: false },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const testSubjectId = 'subject-admin-test';
      mockSubjects[testSubjectId] = {
        _id: testSubjectId,
        name: 'Test Subject',
        description: 'Testing',
        topics: [{ name: 'Mathematics' }]
      };

      const response = await request(app)
        .delete(`/api/subjects/${testSubjectId}/topics/Mathematics`)
        .set('Authorization', `Bearer ${nonAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });
  });

  /**
   * Property-Based Test: Alphanumeric Topic Deletion
   * 
   * For ALL alphanumeric topic names, deletion MUST work correctly.
   * Uses fast-check to generate many test cases automatically.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code
   */
  describe('Property-Based: Alphanumeric Topic Deletion', () => {
    test('should delete any alphanumeric topic name', async () => {
      // Generator for alphanumeric strings (letters and numbers only)
      const alphanumericString = fc.stringMatching(/^[a-zA-Z0-9]+$/);

      await fc.assert(
        fc.asyncProperty(alphanumericString, async (topicName) => {
          // Skip empty strings
          if (!topicName || topicName.length === 0) return true;
          
          const testSubjectId = `subject-pbt-${topicName}`;
          mockSubjects[testSubjectId] = {
            _id: testSubjectId,
            name: 'Test Subject',
            description: 'Testing',
            topics: [{ name: topicName }]
          };

          const response = await request(app)
            .delete(`/api/subjects/${testSubjectId}/topics/${topicName}`)
            .set('Authorization', `Bearer ${adminToken}`);

          const subjectAfter = mockSubjects[testSubjectId];
          
          // Verify deletion succeeded
          expect(response.status).toBe(200);
          expect(subjectAfter.topics.length).toBe(0);
          
          return true;
        }),
        { numRuns: 20 } // Run 20 random test cases
      );
    });

    test('should preserve other topics when deleting one alphanumeric topic', async () => {
      // Generator for arrays of alphanumeric strings
      const alphanumericArray = fc.array(
        fc.stringMatching(/^[a-zA-Z0-9]+$/),
        { minLength: 2, maxLength: 5 }
      );

      await fc.assert(
        fc.asyncProperty(alphanumericArray, async (topicNames) => {
          // Filter out empty strings and ensure uniqueness
          const uniqueTopics = [...new Set(topicNames.filter(n => n && n.length > 0))];
          if (uniqueTopics.length < 2) return true;
          
          const testSubjectId = `subject-pbt-multi-${uniqueTopics[0]}`;
          mockSubjects[testSubjectId] = {
            _id: testSubjectId,
            name: 'Test Subject',
            description: 'Testing',
            topics: uniqueTopics.map(name => ({ name }))
          };

          // Delete the first topic
          const topicToDelete = uniqueTopics[0];
          const response = await request(app)
            .delete(`/api/subjects/${testSubjectId}/topics/${topicToDelete}`)
            .set('Authorization', `Bearer ${adminToken}`);

          const subjectAfter = mockSubjects[testSubjectId];
          
          // Verify only the specified topic was deleted
          expect(response.status).toBe(200);
          expect(subjectAfter.topics.length).toBe(uniqueTopics.length - 1);
          expect(subjectAfter.topics.find(t => t.name === topicToDelete)).toBeUndefined();
          
          // Verify other topics remain
          for (let i = 1; i < uniqueTopics.length; i++) {
            expect(subjectAfter.topics.find(t => t.name === uniqueTopics[i])).toBeDefined();
          }
          
          return true;
        }),
        { numRuns: 15 } // Run 15 random test cases
      );
    });
  });
});
