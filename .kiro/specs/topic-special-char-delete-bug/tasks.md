# Implementation Plan

## Overview

This bugfix addresses a critical issue where topics with special characters (such as &, %, +, spaces, etc.) fail to delete from the database despite returning a success response. The root cause is a string comparison mismatch in the DELETE route handler where URL-decoded topic names fail to match against stored topic names. The fix implements string normalization to ensure consistent comparison regardless of special characters.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Special Character Topic Deletion Fails
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test implementation details from Bug Condition in design:
    - Create topics with special characters: "History & Geography", "Math + Science", "50% Discount", "Q&A: 100% Free!"
    - Attempt to delete each topic via DELETE /api/subjects/:subjectId/topics/:topicId
    - Assert that isBugCondition(topicName) returns true for these inputs
  - The test assertions should match the Expected Behavior Properties from design:
    - Assert HTTP 200 OK response
    - Assert topic is removed from database (topicRemovedFromDatabase = true)
    - Assert topic does not reappear after page refresh (topicNotInList = true)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause:
    - Which special characters cause failures?
    - Does the API return 200 but topic remains in database?
    - Are there encoding/decoding mismatches in the comparison logic?
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Normal Topic Deletion and Other Operations
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Create topics with alphanumeric names: "Mathematics", "Science", "History123"
    - Delete these topics via DELETE /api/subjects/:subjectId/topics/:topicId
    - Observe that deletion works correctly (HTTP 200, topic removed from database)
    - Test other admin operations: add topic, edit topic, add/edit/delete subjects
    - Observe that all operations work correctly on unfixed code
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all topics where NOT isBugCondition(topicName), deletion succeeds
    - For all alphanumeric topic names, deleteTopic(X) removes topic from database
    - For all subject operations, behavior is unchanged
    - For all topic add/edit operations, behavior is unchanged
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for topic deletion with special characters

  - [x] 3.1 Add normalizeTopicName() helper function
    - Create helper function in backend/server.js before the DELETE route
    - Implement string normalization logic:
      - Trim whitespace from both ends
      - Collapse multiple spaces to single space using .replace(/\s+/g, ' ')
      - Apply Unicode normalization using .normalize('NFC')
    - Add JSDoc comment explaining the function's purpose
    - Example implementation:
      ```javascript
      /**
       * Normalizes topic name for consistent comparison
       * Handles whitespace, Unicode encoding, and special characters
       */
      function normalizeTopicName(name) {
        if (!name || typeof name !== 'string') return '';
        return name.trim().replace(/\s+/g, ' ').normalize('NFC');
      }
      ```
    - _Bug_Condition: isBugCondition(input) where input.topicName contains special characters ['&', '%', '+', ' ', '#', '?', '=', '/', '\\', '<', '>', '"', "'", '@', '!', '$', '^', '*', '(', ')', '[', ']', '{', '}', '|', '~', '`', ',', ';', ':']_
    - _Expected_Behavior: normalizeTopicName() produces consistent string representation for comparison, eliminating encoding artifacts and whitespace inconsistencies_
    - _Preservation: Helper function is pure and does not modify existing behavior_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Update DELETE route to use normalized comparison
    - Locate the DELETE route in backend/server.js (line ~625)
    - Apply normalization to the incoming topicId parameter:
      ```javascript
      const topicId = req.params.topicId.trim();
      const normalizedTopicId = normalizeTopicName(topicId);
      ```
    - Update the topic filtering logic to use normalized comparison:
      ```javascript
      subject.topics = subject.topics.filter(t => {
        if (typeof t === 'string') {
          return normalizeTopicName(t) !== normalizedTopicId;
        }
        const matchesId = t._id && t._id.toString() === topicId;
        const matchesName = t.name && normalizeTopicName(t.name) === normalizedTopicId;
        return !matchesId && !matchesName;
      });
      ```
    - Ensure both string-based topics and object-based topics are handled correctly
    - _Bug_Condition: isBugCondition(input) where topicId contains special characters_
    - _Expected_Behavior: Normalized comparison matches topics with special characters correctly, enabling successful deletion_
    - _Preservation: Alphanumeric topic deletion continues to work identically_
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [x] 3.3 Add defensive decoding and error handling
    - Add try-catch block around decodeURIComponent to handle malformed encoded strings
    - Add validation to ensure topicId is not empty after normalization
    - Return appropriate error responses (400 for invalid input, 404 for not found)
    - Example implementation:
      ```javascript
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
      ```
    - _Bug_Condition: isBugCondition(input) where topicId may be double-encoded or malformed_
    - _Expected_Behavior: Graceful handling of edge cases without crashes_
    - _Preservation: Existing error handling behavior is enhanced, not changed_
    - _Requirements: 2.3_

  - [x] 3.4 Add logging for debugging
    - Add conditional logging (development mode only) to help diagnose encoding issues
    - Log the raw req.params.topicId value
    - Log the normalized value used for comparison
    - Log the topic names being compared against
    - Example implementation:
      ```javascript
      if (process.env.NODE_ENV === 'development') {
        console.log('DELETE topic request:', {
          raw: req.params.topicId,
          decoded: decodedTopicId,
          normalized: normalizedTopicId,
          existingTopics: subject.topics.map(t => typeof t === 'string' ? t : t.name)
        });
      }
      ```
    - _Bug_Condition: Not directly related to bug condition, but aids in debugging_
    - _Expected_Behavior: Logging provides visibility into encoding/decoding process_
    - _Preservation: Logging does not affect functionality_
    - _Requirements: N/A (debugging aid)_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Special Character Topic Deletion Succeeds
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify all special character test cases pass:
      - "History & Geography" deletes successfully
      - "Math + Science" deletes successfully
      - "50% Discount" deletes successfully
      - "Q&A: 100% Free!" deletes successfully
    - Verify topics do not reappear after page refresh
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Normal Topic Deletion and Other Operations
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Verify all preservation test cases pass:
      - Alphanumeric topic deletion works identically
      - Subject operations (add/edit/delete) are unaffected
      - Topic add/edit operations are unaffected
      - Admin authentication requirements remain enforced
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the complete test suite (bug condition + preservation tests)
  - Verify all tests pass without errors
  - Manually test the fix in the UI:
    - Login as admin
    - Create a subject
    - Add topics with special characters: "History & Geography", "Math + Science", "50% Discount"
    - Delete each topic and verify it's removed from the list
    - Refresh the page and verify topics remain deleted
    - Add and delete alphanumeric topics to verify preservation
  - If any issues arise, document them and ask the user for guidance
  - Mark complete when all automated and manual tests pass


## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1: Exploration and Preservation Tests",
      "tasks": [
        "1. Write bug condition exploration test",
        "2. Write preservation property tests (BEFORE implementing fix)"
      ]
    },
    {
      "name": "Wave 2: Implementation",
      "tasks": [
        "3.1 Add normalizeTopicName() helper function",
        "3.2 Update DELETE route to use normalized comparison",
        "3.3 Add defensive decoding and error handling",
        "3.4 Add logging for debugging"
      ]
    },
    {
      "name": "Wave 3: Verification",
      "tasks": [
        "3.5 Verify bug condition exploration test now passes",
        "3.6 Verify preservation tests still pass"
      ]
    },
    {
      "name": "Wave 4: Final Checkpoint",
      "tasks": [
        "4. Checkpoint - Ensure all tests pass"
      ]
    }
  ]
}
```

## Notes

- **Test-First Approach**: Tasks 1 and 2 MUST be completed BEFORE implementing the fix (task 3)
- **Expected Test Failures**: Bug condition test (task 1) is EXPECTED to fail on unfixed code - this confirms the bug exists
- **Preservation Tests**: Preservation tests (task 2) should PASS on unfixed code - this establishes the baseline behavior to preserve
- **String Normalization**: The fix uses a `normalizeTopicName()` helper function to ensure consistent comparison
- **No Frontend Changes**: The fix only modifies `backend/server.js` - frontend code remains unchanged
- **Property-Based Testing**: Recommended for preservation tests to generate many test cases and catch edge cases
