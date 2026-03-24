# ⏱️ 5-Minute Login Prompt Feature

## What This Does

After a visitor has been on your website for **5 minutes without logging in**, a friendly modal dialog appears encouraging them to login or register.

---

## How It Works

### Flow:
1. **User visits the site** (not logged in)
2. **Timer starts** for 5 minutes
3. **After 5 minutes** → Modal popup appears with:
   - Welcome message
   - "Login / Register" button → Links to login page
   - "Continue Browsing" button → Resets timer for another 5 minutes

### Activity Reset:
- **Clicking** anywhere on the page resets the timer
- **Typing** (keypress) resets the timer
- **Scrolling** resets the timer
- Each interaction gives another 5-minute window

### Smart Behavior:
- ✅ **Does NOT show** for logged-in users
- ✅ **Does NOT show** for admin panel
- ✅ **Resets** when user reaches login/register page
- ✅ **Dismissible** - Users can keep browsing if they click "Continue"

---

## How to Customize

### Change the Timeout Duration:

**In `app.js`, line 42:**
```javascript
let sessionTimeoutMillis = 5 * 60 * 1000; // ← Change 5 to any number (in minutes)
```

**Examples:**
- 2 minutes: `let sessionTimeoutMillis = 2 * 60 * 1000;`
- 10 minutes: `let sessionTimeoutMillis = 10 * 60 * 1000;`
- 1 hour: `let sessionTimeoutMillis = 60 * 60 * 1000;`

### Change the Modal Message:

**In `app.js`, around line 65:**
```javascript
modal.innerHTML = `
    <div>
        <h2>⏱️ Welcome to MCQLala</h2>
        <p>You've been browsing for 5 minutes...</p>
        <!-- Modify this text -->
    </div>
`;
```

### Change the Modal Styling:

The modal uses inline CSS. You can modify colors, size, spacing, etc:
```javascript
modal.style.cssText = `
    /* Change background darkness (0.7 = 70% opacity) */
    background: rgba(0, 0, 0, 0.7);
    /* ... other properties ... */
`;
```

---

## User Experience

### Visitor Journey:

```
Opens Website
    ↓
[5 minutes pass with activity]
    ↓
Modal appears with friendly message
    ↓
User chooses:
  Option 1: ✅ Login / Register → Goes to login page
  Option 2: Continue Browsing → Resets timer for 5 more minutes
    ↓
If Continue: Timer resets for another 5 minutes
```

---

## Code Location

- **File**: [app.js](app.js) 
- **Lines**: 42-108
- **Functions**:
  - `resetSessionTimeout()` - Manages timer
  - `showSessionTimeoutModal()` - Creates and shows modal
  - `dismissSessionModal()` - Closes modal and resets timer

---

## Features

| Feature | Status |
|---------|--------|
| 5-minute countdown | ✅ Active |
| Auto-reset on activity | ✅ Click, type, scroll |
| Skip for logged-in users | ✅ Smart |
| Customizable duration | ✅ Easy to change |
| Customizable message | ✅ Easy to change |
| Dismissible modal | ✅ Users can skip |
| Mobile responsive | ✅ YES |

---

## Testing the Feature

### Testing on Local Machine:

1. **Open**: `http://localhost:3004`
2. **Do NOT login**
3. **Wait 5 minutes** (or modify the timeout to 10 seconds to test faster)
4. **Modal should appear** with login prompt
5. **Click "Continue Browsing"** to test reset
6. **Try clicking anywhere** - timer resets

### Quick Test (Change timeout to 10 seconds):

Edit `app.js` line 42:
```javascript
let sessionTimeoutMillis = 10 * 1000; // 10 seconds for testing
```

Then:
1. Open website (not logged in)
2. Wait 10 seconds
3. Modal appears automatically

---

## Best Practices

✅ **DO**:
- Use reasonable timeouts (5-15 minutes)
- Make the message friendly and non-annoying
- Allow users to dismiss and continue browsing
- Don't show for logged-in users (already implemented)
- Reset on any user activity

❌ **DON'T**:
- Use very short timeouts (1-2 minutes)
- Use aggressive blocking (let users still browse)
- Show to already logged-in users
- Use dark, scary messaging styles
- Force login on first visit (just suggest after 5 min)

---

## Analytics Tip

You can track how many users convert from this modal:
```javascript
// Add this to the login button click handler:
const loginBtn = modal.querySelector('button:first-child');
loginBtn.addEventListener('click', () => {
    console.log('User clicked login from 5-min timeout modal');
    // You could track this with Google Analytics or your own tracking
});
```

---

## Troubleshooting

### Modal not appearing?
1. Make sure you're **not logged in** 
2. Check console for errors: Press `F12` → Console
3. Verify `app.js` line 40+ is not commented out

### Modal appearing too quickly?
- Increase the timeout value in `app.js` line 42

### Users can't dismiss?
- Make sure you click "Continue Browsing" button, not outside the modal
- The continue button triggers `dismissSessionModal()`

---

**Feature Status**: ✅ **ACTIVE AND READY**  
**Tests**: ✅ Server running  
**Mobile**: ✅ Responsive design  
