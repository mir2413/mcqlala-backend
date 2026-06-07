# Bugfix Requirements Document

## Introduction

This document specifies the requirements for fixing a critical bug in the topic deletion functionality. Topics with special characters (such as &, %, +, spaces, etc.) in their names can be successfully added but fail to delete. When an admin attempts to delete such topics, the UI displays a success message ("Topic deleted"), but the topic persists in the database and reappears after page refresh.

The root cause is a mismatch in the DELETE route's string comparison logic. The frontend URL-encodes the topic ID using `encodeURIComponent()`, Express automatically decodes the URL parameter, but the server-side comparison (`t.name.trim() === topicId`) fails for topics with special characters due to encoding/decoding inconsistencies or whitespace handling issues.

This bug prevents proper content management and creates confusion for administrators who believe topics have been deleted when they have not.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an admin attempts to delete a topic with special characters (e.g., "History & Geography", "Math + Science", "50% Discount") THEN the system returns HTTP 200 OK but does NOT remove the topic from the database

1.2 WHEN an admin deletes a topic with special characters and refreshes the page THEN the system displays the topic in the list as if deletion never occurred

1.3 WHEN the DELETE route receives a URL-encoded topic identifier THEN the system fails to match it against topic names in the database due to comparison logic issues

### Expected Behavior (Correct)

2.1 WHEN an admin attempts to delete a topic with special characters (e.g., "History & Geography", "Math + Science", "50% Discount") THEN the system SHALL successfully remove the topic from the database and return HTTP 200 OK

2.2 WHEN an admin deletes a topic with special characters and refreshes the page THEN the system SHALL NOT display the deleted topic in the list

2.3 WHEN the DELETE route receives a URL-encoded topic identifier THEN the system SHALL correctly match it against the corresponding topic in the database regardless of special characters present

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an admin deletes a topic with normal alphanumeric names (e.g., "Mathematics", "Science", "History") THEN the system SHALL CONTINUE TO successfully remove the topic from the database

3.2 WHEN an admin adds a new topic with special characters THEN the system SHALL CONTINUE TO successfully create the topic

3.3 WHEN an admin edits a topic name (with or without special characters) THEN the system SHALL CONTINUE TO successfully update the topic

3.4 WHEN an admin performs other operations (add/edit/delete subjects, manage questions) THEN the system SHALL CONTINUE TO function correctly without any side effects from the topic deletion fix

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type TopicDeleteRequest
  OUTPUT: boolean
  
  // Returns true when the topic name contains special characters
  // that require URL encoding (characters other than alphanumeric, hyphen, underscore, dot)
  RETURN X.topicName CONTAINS_ANY_OF ['&', '%', '+', ' ', '#', '?', '=', '/', '\\', '<', '>', '"', "'", '@', '!', '$', '^', '*', '(', ')', '[', ']', '{', '}', '|', '~', '`', ',', ';', ':']
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - Special Character Topic Deletion
FOR ALL X WHERE isBugCondition(X) DO
  result ← deleteTopic'(X)
  ASSERT result.statusCode = 200 
    AND topicRemovedFromDatabase(X.topicName) = true
    AND topicNotInList(X.topicName) = true
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - Normal Topic Deletion
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT deleteTopic(X) = deleteTopic'(X)
END FOR
```

**Key Definitions:**
- **deleteTopic**: The original (unfixed) deletion function
- **deleteTopic'**: The fixed deletion function
- **isBugCondition(X)**: Returns true when topic name contains special characters requiring URL encoding
- **Counterexample**: Attempting to delete topic "History & Geography" returns 200 OK but topic remains in database
