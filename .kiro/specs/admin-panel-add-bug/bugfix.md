# Bugfix Requirements Document

## Introduction

The admin panel has multiple function name conflicts between `admin.html`'s inline script and the globally-registered functions in `app.js`. Because `onclick` attribute handlers resolve names from the global (`window`) scope, the `app.js` versions are called instead of the local functions defined inside `admin.html`'s `<script>` block. This affects adding subjects, deleting subjects, and deleting navigation items — causing operations to silently fail or leave the UI in a stale state. Additionally, the `editSubject` function calls a server route (`GET /api/subjects/:id`) that does not exist, causing a 404 error when attempting to edit a subject.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an admin fills in the "New Subject Name" and "Description" fields and clicks "Add Subject" THEN the system calls `window.addSubject` from `app.js` (which reads from `#subjectName` and `#subjectDesc`) instead of the local function, resulting in empty values being sent and the subject not being added

1.2 WHEN an admin clicks "Delete" on a subject in the admin panel THEN the system calls `window.deleteSubject` from `app.js` (which calls `window.loadSubjectsAdmin()` targeting `#subjectsTableBody`) instead of the local function, so after deletion the subjects list in `#subjectsListContainer` does not refresh

1.3 WHEN an admin clicks "Delete" on a navigation item in the admin panel THEN the system calls `window.deleteNavItem` from `app.js` (which calls `window.loadNavItemsAdmin()` targeting `#navItemsTableBody`) instead of the local function, so after deletion the nav list in `#navItemsListContainer` does not refresh

1.4 WHEN an admin clicks "Edit" on a subject THEN the system sends `GET /api/subjects/:id` to the server, which has no such route, resulting in a 404 error and a broken edit flow

1.5 WHEN `window.addSubject` from `app.js` fires with empty field values THEN the system sends a POST request with an empty or missing `name` field, which either gets rejected by the server or creates a blank entry

### Expected Behavior (Correct)

2.1 WHEN an admin fills in the "New Subject Name" and "Description" fields and clicks "Add Subject" THEN the system SHALL read values from `#newSubjectName` and `#newSubjectDesc`, send a valid POST request to `POST /api/subjects`, and display the new subject in the list

2.2 WHEN an admin clicks "Delete" on a subject THEN the system SHALL call the admin-panel-specific delete function, send `DELETE /api/subjects/:id`, and refresh `#subjectsListContainer` to reflect the removal

2.3 WHEN an admin clicks "Delete" on a navigation item THEN the system SHALL call the admin-panel-specific delete function, send `DELETE /api/navitems/:id`, and refresh `#navItemsListContainer` to reflect the removal

2.4 WHEN an admin clicks "Edit" on a subject THEN the system SHALL successfully fetch the subject's data from the server via `GET /api/subjects/:id` and populate the edit form without errors

2.5 WHEN a subject or nav item is successfully added or deleted THEN the system SHALL refresh the respective list and show a success message without a page reload

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `window.addSubject` is called from pages other than `admin.html` (e.g., any page that uses `app.js` standalone) THEN the system SHALL CONTINUE TO read from `#subjectName` and `#subjectDesc` as before

3.2 WHEN `window.addNavItem` is called from pages other than `admin.html` THEN the system SHALL CONTINUE TO read from `#navText`, `#navPath`, and `#navIcon` as before

3.3 WHEN `window.deleteSubject` or `window.deleteNavItem` are called from pages other than `admin.html` THEN the system SHALL CONTINUE TO call `window.loadSubjectsAdmin()` and `window.loadNavItemsAdmin()` respectively

3.4 WHEN an admin adds an MCQ question through the "Add MCQ" tab THEN the system SHALL CONTINUE TO save the question correctly

3.5 WHEN an admin fills in the navigation link fields and clicks "Add Link" (via `saveNavItem`) THEN the system SHALL CONTINUE TO add the nav item correctly, as this function name does not conflict with `app.js`

3.6 WHEN a non-admin user visits `admin.html` THEN the system SHALL CONTINUE TO redirect them away from the admin panel

3.7 WHEN `GET /api/subjects` is called THEN the system SHALL CONTINUE TO return all subjects as before
