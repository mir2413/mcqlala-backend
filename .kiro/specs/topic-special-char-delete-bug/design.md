# Topic Special Character Delete Bug - Design Document

## Overview

This design addresses a critical bug where topics with special characters (e.g., "History & Geography", "Math + Science", "50% Discount") fail to delete from the database despite returning a success response. The bug occurs due to a string comparison mismatch in the DELETE route handler. The frontend URL-encodes topic names using `encodeURIComponent()`, Express automatically decodes the URL parameter, but the server-side comparison logic (`t.name.trim() === topicId`) fails to match topics with special characters.

The fix will normalize the comparison logic to handle URL-decoded strings correctly, ensuring that topics with special characters can be deleted while preserving all existing functionality for normal alphanumeric topic names.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a topic name contains special characters requiring URL encoding (e.g., &, %, +, spaces, #, etc.)
- **Property (P)**: The desired behavior when deleting topics with special characters - the topic should be successfully removed from the database and not reappear after page refresh
- **Preservation**: Existing deletion behavior for alphanumeric topic names and all other admin operations must remain unchanged
- **deleteTopic**: The DELETE route handler in `backend/server.js` (line ~625) that processes topic deletion requests
- **topicId**: The URL parameter received by the DELETE route, automatically decoded by Express from the URL-encoded value sent by the frontend
- **URL Encoding**: The process of converting special characters to percent-encoded format (e.g., "&" becomes "%26", " " becomes "%20")
- **String Normalization**: The process of ensuring consistent string representation for comparison (trimming whitespace, handling case sensitivity, etc.)

## Bug Details

### Bug Condition

The bug manifests when an admin attempts to delete a topic whose name contains special characters that require URL encoding. The `deleteTopic` function in `backend/server.js` receives the decoded topic name from Express but fails to match it against the topic names stored in the database due to inconsistent string comparison logic.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type TopicDeleteRequest { subjectId: string, topicId: string }
  OUTPUT: boolean
  
  RETURN input.topicId CONTAINS_ANY_OF ['&', '%', '+', ' ', '#', '?', '=', '/', '\\', '<', '>', '"', "'", '@', '!', '$', '^', '*', '(', ')', '[', ']', '{', '}', '|', '~', '`', ',', ';', ':']
         AND topicExistsInDatabase(input.subjectId, input.topicId)
         AND NOT topicSuccessfullyDeleted(input.subjectId, input.topicId)
END FUNCTION
```

### Examples

- **Example 1**: Deleting topic "History & Geography"
  - Frontend sends: `DELETE /api/subjects/123/topics/History%20%26%20Geography`
  - Express decodes to: `topicId = "History & Geography"`
  - Current comparison: `t.name.trim() === "History & Geography"` (may fail due to encoding artifacts)
  - Expected: Topic should be removed from database
  - Actual: Topic remains in database, returns 200 OK

- **Example 2**: Deleting topic "Math + Science"
  - Frontend sends: `DELETE /api/subjects/123/topics/Math%20%2B%20Science`
  - Express decodes to: `topicId = "Math + Science"`
  - Current comparison: `t.name.trim() === "Math + Science"` (may fail)
  - Expected: Topic should be removed from database
  - Actual: Topic remains in database, returns 200 OK

- **Example 3**: Deleting topic "50% Discount"
  - Frontend sends: `DELETE /api/subjects/123/topics/50%25%20Discount`
  - Express decodes to: `topicId = "50% Discount"`
  - Current comparison: `t.name.trim() === "50% Discount"` (may fail)
  - Expected: Topic should be removed from database
  - Actual: Topic remains in database, returns 200 OK

- **Edge Case**: Deleting topic with only spaces "   " (trimmed to empty string)
  - Expected: Should handle gracefully, possibly return 404 or validation error
  - Current behavior: May cause unexpected matching issues

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Deleting topics with normal alphanumeric names (e.g., "Mathematics", "Science", "History") must continue to work exactly as before
- Adding new topics with special characters must continue to work correctly
- Editing topic names (with or without special characters) must continue to work correctly
- All other admin operations (add/edit/delete subjects, manage questions) must remain unaffected
- The DELETE route must continue to return appropriate HTTP status codes (200 for success, 404 for not found, 500 for errors)
- The route must continue to require admin authentication via the `adminAuth` middleware

**Scope:**
All inputs that do NOT involve deleting topics with special characters should be completely unaffected by this fix. This includes:
- Deletion of topics with alphanumeric names only
- All subject-level operations (add, edit, delete subjects)
- All MCQ operations (add, edit, delete questions)
- User authentication and authorization flows
- Other API endpoints and their functionality

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Inconsistent String Comparison**: The current comparison logic `t.name.trim() === topicId` performs a strict equality check that may fail due to:
   - Hidden Unicode characters or encoding artifacts introduced during URL encoding/decoding
   - Different whitespace characters (regular space vs. non-breaking space, tabs, etc.)
   - Case sensitivity issues (though less likely for this specific bug)

2. **Double Encoding/Decoding Issues**: Although Express automatically decodes URL parameters, there may be edge cases where:
   - The frontend double-encodes certain characters
   - Express doesn't fully decode all special character sequences
   - The stored topic name in the database has a different encoding than the decoded parameter

3. **Whitespace Normalization Inconsistency**: The comparison uses `.trim()` on the topic name from the database but the incoming `topicId` is only trimmed once at the beginning:
   - `const topicId = req.params.topicId.trim();`
   - The filter compares `t.name.trim() === topicId`
   - If there are multiple spaces or different whitespace characters, this may cause mismatches

4. **Mixed Matching Strategy**: The current code attempts to match both by MongoDB ObjectId and by name:
   - `const matchesId = t._id && t._id.toString() === topicId;`
   - `const matchesName = t.name && t.name.trim() === topicId;`
   - This dual strategy may cause confusion when the topicId is a name with special characters that looks like it could be an ObjectId

## Correctness Properties

Property 1: Bug Condition - Special Character Topic Deletion

_For any_ DELETE request where the topic name contains special characters requiring URL encoding (isBugCondition returns true), the fixed deleteTopic function SHALL successfully remove the topic from the database, return HTTP 200 OK, and ensure the topic does not reappear after page refresh.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Normal Topic Deletion and Other Operations

_For any_ DELETE request where the topic name does NOT contain special characters (isBugCondition returns false), the fixed deleteTopic function SHALL produce exactly the same behavior as the original function, successfully removing alphanumeric topics and preserving all other admin operations (add/edit topics, subject management, question management).

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the primary issue is inconsistent string comparison logic.

**File**: `backend/server.js`

**Function**: `app.delete('/api/subjects/:subjectId/topics/:topicId', ...)` (line ~625)

**Specific Changes**:

1. **Improve String Normalization**: Enhance the normalization of both the incoming `topicId` and the stored topic names before comparison
   - Apply consistent whitespace normalization (trim, collapse multiple spaces)
   - Consider Unicode normalization (NFC or NFD) to handle encoding artifacts
   - Ensure both sides of the comparison undergo identical normalization

2. **Add Defensive Decoding**: Although Express decodes URL parameters automatically, add explicit decoding as a safety measure
   - Use `decodeURIComponent()` on the already-decoded parameter to catch any double-encoding edge cases
   - Wrap in try-catch to handle malformed encoded strings gracefully

3. **Implement Robust Comparison Function**: Create a helper function that performs normalized string comparison
   ```javascript
   function normalizeTopicName(name) {
     return name
       .trim()
       .replace(/\s+/g, ' ')  // Collapse multiple spaces to single space
       .normalize('NFC');      // Unicode normalization
   }
   ```

4. **Update Filter Logic**: Modify the topic filtering logic to use the normalized comparison
   ```javascript
   const normalizedTopicId = normalizeTopicName(topicId);
   subject.topics = subject.topics.filter(t => {
     if (typeof t === 'string') {
       return normalizeTopicName(t) !== normalizedTopicId;
     }
     const matchesId = t._id && t._id.toString() === topicId;
     const matchesName = t.name && normalizeTopicName(t.name) === normalizedTopicId;
     return !matchesId && !matchesName;
   });
   ```

5. **Add Logging for Debugging**: Include debug logging to help diagnose any future encoding issues
   - Log the raw `req.params.topicId` value
   - Log the normalized value used for comparison
   - Log the topic names being compared against
   - This logging should be conditional (only in development) or use a proper logging framework

**Alternative Approach (Recommended for Long-Term)**: 
Instead of relying on name-based matching, always use MongoDB ObjectId for topic identification:
- Modify the frontend to pass the topic's `_id` instead of its name
- Update the DELETE route to only match by ObjectId
- This eliminates all encoding/decoding issues and is a database best practice
- However, this requires frontend changes and may be out of scope for this bugfix

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write integration tests that create topics with special characters, attempt to delete them via the API, and verify whether they are actually removed from the database. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Ampersand Test**: Create topic "History & Geography", attempt to delete it (will fail on unfixed code - topic remains in database)
2. **Plus Sign Test**: Create topic "Math + Science", attempt to delete it (will fail on unfixed code - topic remains in database)
3. **Percent Sign Test**: Create topic "50% Discount", attempt to delete it (will fail on unfixed code - topic remains in database)
4. **Multiple Special Chars Test**: Create topic "Q&A: 100% Free!", attempt to delete it (will fail on unfixed code - topic remains in database)
5. **Space Handling Test**: Create topic "  Multiple   Spaces  ", attempt to delete it (may fail on unfixed code due to whitespace normalization issues)
6. **Unicode Test**: Create topic with Unicode characters "Café ☕", attempt to delete it (may fail on unfixed code due to encoding issues)

**Expected Counterexamples**:
- Topics with special characters return HTTP 200 OK but remain in the database after deletion attempt
- Possible causes: string comparison fails due to encoding artifacts, whitespace inconsistencies, or Unicode normalization differences

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (topics with special characters), the fixed function produces the expected behavior (successful deletion).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  // Create a topic with special characters
  topicId := createTopic(input.subjectId, input.topicNameWithSpecialChars)
  
  // Attempt to delete it using the fixed function
  result := deleteTopic_fixed(input.subjectId, topicId)
  
  // Verify expected behavior
  ASSERT result.statusCode = 200
  ASSERT topicNotInDatabase(input.subjectId, topicId)
  ASSERT topicNotInUIList(input.subjectId, topicId)
END FOR
```

**Test Cases**:
1. Delete topic "History & Geography" - verify HTTP 200 and topic removed from database
2. Delete topic "Math + Science" - verify HTTP 200 and topic removed from database
3. Delete topic "50% Discount" - verify HTTP 200 and topic removed from database
4. Delete topic "Q&A: 100% Free!" - verify HTTP 200 and topic removed from database
5. Delete topic with multiple spaces - verify HTTP 200 and topic removed from database
6. Delete topic with Unicode characters - verify HTTP 200 and topic removed from database

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (topics with alphanumeric names only), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // Test with alphanumeric topic names
  ASSERT deleteTopic_original(input) = deleteTopic_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for alphanumeric topic deletion, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Alphanumeric Deletion Preservation**: Create and delete topics with names like "Mathematics", "Science", "History123" - verify deletion works identically before and after fix
2. **Subject Operations Preservation**: Verify that adding, editing, and deleting subjects continues to work correctly
3. **Topic Addition Preservation**: Verify that adding topics (with or without special characters) continues to work correctly
4. **Topic Editing Preservation**: Verify that editing topic names continues to work correctly
5. **MCQ Operations Preservation**: Verify that question management operations are unaffected
6. **Authentication Preservation**: Verify that admin authentication requirements remain enforced

### Unit Tests

- Test the `normalizeTopicName()` helper function with various inputs (spaces, special chars, Unicode)
- Test topic deletion with alphanumeric names (e.g., "Math", "Science", "History")
- Test topic deletion with special characters (e.g., "&", "+", "%", spaces)
- Test edge cases (empty string after trim, very long names, null/undefined handling)
- Test that non-existent topics return 404
- Test that unauthorized requests are rejected (adminAuth middleware)

### Property-Based Tests

- Generate random topic names with varying combinations of alphanumeric and special characters, verify deletion works correctly
- Generate random subject IDs and topic names, verify that deletion only affects the specified topic
- Generate random sequences of add/delete operations, verify database consistency
- Test that for any topic successfully added, it can be successfully deleted (round-trip property)

### Integration Tests

- Test full workflow: login as admin → create subject → add topic with special chars → delete topic → verify removal
- Test multiple topics with special characters in the same subject, delete them one by one
- Test that deleting a topic with special characters doesn't affect other topics in the same subject
- Test concurrent deletion requests for topics with special characters
- Test that page refresh after deletion shows the topic is gone
