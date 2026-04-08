// API Base URL - uses relative path (Vercel proxies to backend)
const API_BASE_URL = '/api';

// CSRF Token Management
let csrfToken = null;

async function getCSRFToken() {
    if (csrfToken) return csrfToken;
    try {
        const response = await originalFetch(`${API_BASE_URL}/csrf-token`, {
            credentials: 'include'
        });
        const data = await response.json();
        csrfToken = data.csrfToken;
        return csrfToken;
    } catch (error) {
        console.error('Failed to get CSRF token:', error);
        return null;
    }
}

// Globally override fetch to strictly include credentials (JWT cookie) and CSRF token
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    // Send standard CORS cookies along with requests
    options.credentials = 'include';
    
    // Add CSRF token for state-changing requests
    const method = options.method ? options.method.toUpperCase() : 'GET';
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const token = await getCSRFToken();
        if (token) {
            options.headers = {
                ...options.headers,
                'X-CSRF-Token': token
            };
        }
    }
    
    return originalFetch(url, options);
};

// Session Management
function isLoggedIn() {
    return localStorage.getItem('userId') !== null;
}

function getCurrentUser() {
    return {
        userId: localStorage.getItem('userId'),
        username: localStorage.getItem('username'),
        email: localStorage.getItem('email'),
        isAdmin: localStorage.getItem('isAdmin') === 'true'
    };
}

async function logout() {
    try {
        await fetch(`${API_BASE_URL}/users/logout`, { method: 'POST', credentials: 'include' });
    } catch(e) { console.error(e); }
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    localStorage.removeItem('isAdmin');
    window.location.href = 'login.html';
}

// Helper function to check authentication
function checkAuth() {
    const isLogged = isLoggedIn();
    const path = window.location.pathname;
    const page = path.split('/').pop();
    const user = getCurrentUser();

    console.log('🔍 checkAuth() called');
    
    // Pages that require login
    const protectedPages = ['admin.html', 'profile.html'];

    // Only redirect if NOT logged in AND trying to access a protected page
    if (!isLogged && protectedPages.includes(page)) {
        console.log('❌ Restricted Access - redirecting to login');
        sessionStorage.setItem('authRedirect', 'Please log in to access that page.');
        window.location.href = 'login.html';
    } else if (page === 'admin.html' && !user.isAdmin) {
        console.log('❌ Admin Access Denied - redirecting to home');
        window.location.href = 'index.html';
    } else {
        console.log('   ✅ Access granted:', localStorage.getItem('username') || 'Guest');
    }
}

// Shared UI Functions
function toggleChildButtons(element) {
    const card = element.closest('.card');
    if (!card) return;

    const childButtons = card.querySelector('.child-buttons');
    if (!childButtons) {
        console.warn('Child buttons container not found in this card');
        return; 
    }
    
    const icon = card.querySelector('.expand-icon') || card.querySelector('.fa-chevron-down, .fa-chevron-up');

    if (childButtons.style.display === 'none' || childButtons.style.display === '') {
        childButtons.style.display = 'flex';
        if (icon) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
    } else {
        childButtons.style.display = 'none';
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    }
}

async function loadNavLinks() {
    const navLinksContainer = document.querySelector('.nav-links');
    if (!navLinksContainer) {
        console.log('Nav container not found');
        return;
    }

    navLinksContainer.innerHTML = '';

    // Always add Home and Study Materials first
    const defaultLinks = [
        { text: 'Home', icon: 'fa-solid fa-house', link: 'index.html' },
        { text: 'Study Materials', icon: 'fa-solid fa-book', link: 'pdfs.html' }
    ];

    defaultLinks.forEach(item => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = item.link;
        link.style.textDecoration = 'none';
        link.style.color = 'inherit';
        link.style.display = 'flex';
        link.style.alignItems = 'center';
        
        const icon = document.createElement('i');
        icon.className = item.icon;
        icon.style.marginRight = '8px';
        icon.style.fontSize = '16px';
        icon.style.color = '#667eea';
        
        const text = document.createElement('span');
        text.textContent = item.text;
        
        link.appendChild(icon);
        link.appendChild(text);
        li.appendChild(link);
        navLinksContainer.appendChild(li);
    });

    // Track added links to avoid duplicates
    const addedLinks = ['index.html', 'pdfs.html'];

    try {
        const response = await fetch(`${API_BASE_URL}/navitems`);
        if (!response.ok) throw new Error('Failed to fetch nav items');
        const items = await response.json();
        
        items.forEach(item => {
            const itemLink = String(item.link || item.path || item.url || '#').substring(0, 2048);
            // Skip if already added
            if (addedLinks.includes(itemLink)) return;
            addedLinks.push(itemLink);

            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = itemLink;
            link.style.textDecoration = 'none';
            link.style.color = 'inherit';
            link.style.display = 'flex';
            link.style.alignItems = 'center';
            
            const icon = document.createElement('i');
            icon.className = String(item.icon || 'fa fa-link').substring(0, 100);
            icon.style.marginRight = '8px';
            icon.style.fontSize = '16px';
            icon.style.color = '#667eea';
            
            const text = document.createElement('span');
            text.textContent = String(item.text || item.name || item.title || 'Link').substring(0, 200);
            
            link.appendChild(icon);
            link.appendChild(text);
            li.appendChild(link);
            navLinksContainer.appendChild(li);
        });

    } catch (error) {
        console.error('Error loading navigation links:', error);
    }
}

function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

function filterCards() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    const searchValue = searchInput.value.toLowerCase();
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        const titleEl = card.querySelector('.card-title');
        if (!titleEl) return;
        const title = titleEl.textContent.toLowerCase();
        card.style.display = title.includes(searchValue) ? 'flex' : 'none';
    });
}

function toggleContactPopup() {
    const popup = document.getElementById('contactPopup');
    const icon = document.querySelector('.footer-contact-btn i');
    if (!popup) return;
    
    if (popup.style.display === 'block') {
        popup.style.display = 'none';
        if (icon) {
            icon.classList.replace('fa-times', 'fa-envelope');
        }
    } else {
        popup.style.display = 'block';
        if (icon) {
            icon.classList.replace('fa-envelope', 'fa-times');
        }
    }
}

async function submitContactForm(event) {
    event.preventDefault();
    const form = event.target;
    const name = form.querySelector('input[type="text"]').value;
    const email = form.querySelector('input[type="email"]').value;
    const message = form.querySelector('textarea').value;
    
    // Robust button selection (handles <button> and <input type="submit">)
    const btn = form.querySelector('button[type="submit"]') || form.querySelector('button') || form.querySelector('input[type="submit"]');
    let originalText = '';

    if (btn) {
        originalText = btn.tagName === 'INPUT' ? btn.value : btn.textContent;
        btn.disabled = true;
        if (btn.tagName === 'INPUT') btn.value = 'Sending...'; else btn.textContent = 'Sending...';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, message })
        });
        
        if (response.ok) {
            alert('Message sent successfully!');
            form.reset();
        } else {
            alert('Failed to send message.');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message.');
    } finally {
        if (btn) {
            btn.disabled = false;
            if (btn.tagName === 'INPUT') btn.value = originalText; else btn.textContent = originalText;
        }
    }
}

async function forgotPassword(email) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            // If response isn't JSON, return the text as the error message
            console.error('Server returned non-JSON:', text);
            return { message: text || `Server Error: ${response.status}` };
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        return { error: 'Network error. Please check if server is running.' };
    }
}

async function resetPassword(token, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Reset password error:', error);
        return { error: 'Network error' };
    }
}

window.loadProfileStats = async function() {
    const user = getCurrentUser();
    if (!user.userId) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('profileUsername').textContent = user.username;

    try {
        const res = await fetch(`${API_BASE_URL}/scores/user/${user.userId}`);
        if (!res.ok) throw new Error('Failed to load scores');
        const scores = await res.json();

        // Calculate Stats
        const totalQuizzes = scores.length;
        const avgScore = totalQuizzes > 0 
            ? (scores.reduce((acc, curr) => acc + curr.percentage, 0) / totalQuizzes).toFixed(1) 
            : 0;

        document.getElementById('totalQuizzes').textContent = totalQuizzes;
        document.getElementById('avgScore').textContent = avgScore + '%';

        // Render History Table
        const tbody = document.getElementById('quizHistoryBody');
        tbody.innerHTML = scores.map(s => `
            <tr>
                <td>${s.topic || 'General'}</td>
                <td>${new Date(s.submittedAt).toLocaleDateString()}</td>
                <td><span style="font-weight:bold; color: ${s.percentage >= 50 ? '#21cc12' : '#ff6b6b'}">${s.percentage.toFixed(0)}%</span></td>
            </tr>
        `).join('') || '<tr><td colspan="3">No quizzes taken yet.</td></tr>';

    } catch (e) { console.error('Error loading stats:', e); }
};

// Settings Functions
function renderSettingsUI() {
    // Try to find the container
    let container = document.getElementById('setting-section') || document.getElementById('settings-section') || document.getElementById('setting');
    
    // If not found, create it dynamically
    if (!container) {
        container = document.createElement('div');
        container.id = 'settings-section';
        container.className = 'section admin-section';
        container.style.display = 'none';
        
        const parent = document.querySelector('.main-content') || document.querySelector('.main-container') || document.body;
        parent.appendChild(container);
    }

    // Only render if empty to avoid wiping out manual changes
    if (container.innerHTML.trim() === '') {
        container.innerHTML = `
            <div class="card" style="max-width: 600px; margin: 0 auto; cursor: default;">
                <h3><i class="fa fa-cogs"></i> Website Settings</h3>
                <form id="settingsForm" onsubmit="window.saveSiteSettings(event)">
                    <div class="form-group">
                        <label for="siteTitle">Website Title</label>
                        <input type="text" id="siteTitle" name="siteTitle" class="form-control" placeholder="e.g. MCQLala" style="width: 100%; padding: 10px; margin-bottom: 15px;" required>
                    </div>
                    <div class="form-group">
                        <label for="siteFooter">Footer Text</label>
                        <input type="text" id="siteFooter" name="siteFooter" class="form-control" placeholder="e.g. © 2026 Company Name" style="width: 100%; padding: 10px; margin-bottom: 15px;">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">Save Changes</button>
                </form>
            </div>
        `;
    }
    
    window.loadSiteSettings();
}

window.loadSiteSettings = async function() {
    try {
        const res = await fetch(`${API_BASE_URL}/settings`);
        if (!res.ok) return;
        const data = await res.json();
        const titleInput = document.getElementById('siteTitle');
        const footerInput = document.getElementById('siteFooter');
        
        if (titleInput && data.title) titleInput.value = data.title;
        if (footerInput && data.footer) footerInput.value = data.footer;
        
        // Update live elements
        if (data.title) document.title = data.title;
        const footerEl = document.querySelector('footer p') || document.querySelector('.footer-content p');
        if (footerEl && data.footer) footerEl.textContent = data.footer;

    } catch (e) {
        console.error('Error loading settings', e);
    }
};

window.saveSiteSettings = async function(e) {
    e.preventDefault();
    const title = document.getElementById('siteTitle').value;
    const footer = document.getElementById('siteFooter').value;
    const btn = e.target.querySelector('button');
    const user = getCurrentUser();
    
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': user.userId },
            body: JSON.stringify({ title, footer })
        });
        if (res.ok) {
            alert('Settings saved successfully!');
            window.loadSiteSettings(); // Refresh
        } else alert('Failed to save settings.');
    } catch (err) { console.error(err); alert('Error saving settings.'); } 
    finally { btn.textContent = originalText; btn.disabled = false; }
};

// Navigation Management Functions (Fix for Manage Navigation)
function renderNavigationUI() {
    let container = document.getElementById('navigation-section');
    if (!container) {
        container = document.createElement('div');
        container.id = 'navigation-section';
        container.className = 'section admin-section';
        container.style.display = 'none';
        
        const parent = document.querySelector('.main-content') || document.querySelector('.main-container') || document.body;
        parent.appendChild(container);
    }

    if (container.innerHTML.trim() === '') {
        container.innerHTML = `
            <div class="card">
                <h3><i class="fa fa-compass"></i> Manage Navigation Menu</h3>
                <div class="table-responsive">
                    <table class="table" style="width:100%; margin-bottom: 20px;">
                        <thead><tr><th>Text</th><th>Path</th><th>Icon</th><th>Action</th></tr></thead>
                        <tbody id="navItemsTableBody"></tbody>
                    </table>
                </div>
                
                <h4 style="margin-top:20px; border-top:1px solid #eee; padding-top:10px;">Add New Menu Item</h4>
                <form onsubmit="window.addNavItem(event)" style="display: grid; gap: 10px; grid-template-columns: 1fr 1fr 1fr auto;">
                    <input type="text" id="navText" placeholder="Link Text (e.g. Home)" class="form-control" required>
                    <input type="text" id="navPath" placeholder="URL (e.g. /index.html)" class="form-control" required>
                    <input type="text" id="navIcon" placeholder="Icon (e.g. fa fa-home)" class="form-control">
                    <button type="submit" class="btn btn-primary"><i class="fa fa-plus"></i> Add</button>
                </form>
            </div>
        `;
    }
    window.loadNavItemsAdmin();
}

window.loadNavItemsAdmin = async function() {
    const tbody = document.getElementById('navItemsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
    
    try {
        const res = await fetch(`${API_BASE_URL}/navitems`);
        if (!res.ok) throw new Error('Failed to load nav items');
        const items = await res.json();
        
        tbody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.text || item.name}</td>
                <td>${item.path || item.link}</td>
                <td><i class="${item.icon}"></i> ${item.icon}</td>
                <td>
                    <button class="btn btn-danger btn-sm" data-onclick="deleteNavItem" data-args="[&quot;${item._id}&quot;]">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4">Error loading items</td></tr>';
    }
};

window.addNavItem = async function(e) {
    e.preventDefault();
    const text = document.getElementById('navText').value;
    const path = document.getElementById('navPath').value;
    const icon = document.getElementById('navIcon').value;
    const user = getCurrentUser();

    try {
        const res = await fetch(`${API_BASE_URL}/navitems`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': user.userId },
            body: JSON.stringify({ name: text, path, icon })
        });
        if (res.ok) {
            e.target.reset();
            window.loadNavItemsAdmin();
            loadNavLinks(); // Refresh main menu
        }
    } catch (e) { alert('Error adding item'); }
};

window.deleteNavItem = async function(id) {
    if(!confirm('Delete this menu item?')) return;
    const user = getCurrentUser();
    try {
        await fetch(`${API_BASE_URL}/navitems/${id}`, {
            method: 'DELETE',
            headers: { 'X-User-ID': user.userId }
        });
        window.loadNavItemsAdmin();
        loadNavLinks();
    } catch (e) { alert('Error deleting item'); }
};

// Subject Management Functions (Fix for Manage Subject)
function renderSubjectUI() {
    let container = document.getElementById('manage-subject-section');
    if (!container) {
        container = document.createElement('div');
        container.id = 'manage-subject-section';
        container.className = 'section admin-section';
        container.style.display = 'none';
        
        const parent = document.querySelector('.main-content') || document.querySelector('.main-container') || document.body;
        parent.appendChild(container);
    }

    if (container.innerHTML.trim() === '') {
        container.innerHTML = `
            <div class="card">
                <h3><i class="fa fa-book"></i> Manage Subjects</h3>
                <div class="table-responsive">
                    <table class="table" style="width:100%; margin-bottom: 20px;">
                        <thead><tr><th>Name</th><th>Description</th><th>Topics</th><th>Action</th></tr></thead>
                        <tbody id="subjectsTableBody"></tbody>
                    </table>
                </div>
                
                <h4 style="margin-top:20px; border-top:1px solid #eee; padding-top:10px;">Add New Subject</h4>
                <form onsubmit="window.addSubject(event)" style="display: grid; gap: 10px; grid-template-columns: 1fr 2fr auto;">
                    <input type="text" id="subjectName" placeholder="Subject Name (e.g. History)" class="form-control" required>
                    <input type="text" id="subjectDesc" placeholder="Description" class="form-control">
                    <button type="submit" class="btn btn-primary"><i class="fa fa-plus"></i> Add</button>
                </form>
            </div>
        `;
    }
    window.loadSubjectsAdmin();
}

window.loadSubjectsAdmin = async function() {
    const tbody = document.getElementById('subjectsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
    
    try {
        const res = await fetch(`${API_BASE_URL}/subjects`);
        if (!res.ok) throw new Error('Failed to load subjects');
        const items = await res.json();
        
        tbody.innerHTML = '';
        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No subjects found.</td></tr>';
            return;
        }

        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.name}</td>
                <td>${item.description || '-'}</td>
                <td>${item.topics ? item.topics.length : 0} topics</td>
                <td>
                    <button class="btn btn-danger btn-sm" data-onclick="deleteSubject" data-args="[&quot;${item._id}&quot;]">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4">Error loading subjects</td></tr>';
    }
};

window.addSubject = async function(e) {
    e.preventDefault();
    const name = document.getElementById('subjectName').value;
    const description = document.getElementById('subjectDesc').value;
    const user = getCurrentUser();

    try {
        const res = await fetch(`${API_BASE_URL}/subjects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': user.userId },
            body: JSON.stringify({ name, description })
        });
        if (res.ok) {
            e.target.reset();
            window.loadSubjectsAdmin();
        } else {
            alert('Failed to add subject');
        }
    } catch (e) { alert('Error adding subject'); }
};

window.deleteSubject = async function(id) {
    if(!confirm('Delete this subject?')) return;
    const user = getCurrentUser();
    try {
        await fetch(`${API_BASE_URL}/subjects/${id}`, {
            method: 'DELETE',
            headers: { 'X-User-ID': user.userId }
        });
        window.loadSubjectsAdmin();
    } catch (e) { alert('Error deleting subject'); }
};

// Function to switch Admin Panel sections (Fixes 'Manage' buttons)
// Attached to window to ensure global access
window.showSection = function(sectionId) {
    if (!sectionId) return;
    
    // Clean up the sectionId
    let cleanId = sectionId.toLowerCase().trim();
    
    // Admin panel specific mappings
    const adminTabMap = {
        'add-mcq': 'add-mcq',
        'view-mcqs': 'view-mcqs', 
        'create-mcq': 'add-mcq',
        'bulk-upload': 'bulk-upload',
        'bulk': 'bulk-upload',
        'manage-nav': 'manage-nav',
        'manage-subjects': 'manage-subjects',
        'manage-users': 'manage-users',
        'view-messages': 'view-messages',
        'messages': 'view-messages',
        'settings': 'settings',
        'manage-user': 'manage-users',
        'manage-user': 'manage-users',
        'manage-subject': 'manage-subjects'
    };
    
    let targetId = adminTabMap[cleanId] || cleanId;
    let activeSection = document.getElementById(targetId);
    
    // Try exact match first, then fuzzy match
    if (!activeSection) {
        activeSection = document.getElementById(targetId) || 
                        document.getElementById(targetId + 's') || 
                        document.querySelector(`[id*="${targetId}"]`) ||
                        document.querySelector(`.${targetId}-section`);
    }

    if (activeSection) {
        // 1. HIDE SIBLINGS (Fixes content stacking/overlap issues)
        // This ensures that whatever container we are in, only the target section is visible
        if (activeSection.parentElement) {
            const siblings = activeSection.parentElement.children;
            for (let i = 0; i < siblings.length; i++) {
                const sibling = siblings[i];
                if (sibling !== activeSection && 
                    sibling.tagName !== 'SCRIPT' && 
                    sibling.tagName !== 'STYLE' && 
                    sibling.tagName !== 'NAV' && 
                    !sibling.classList.contains('navbar') && 
                    !sibling.classList.contains('sidebar')) {
                    sibling.style.display = 'none';
                }
            }
        }

        // 2. Hide Dashboard Explicitly (if it's not a sibling)
        const dashboard = document.getElementById('dashboard') || document.getElementById('admin-dashboard');
        if (dashboard && dashboard !== activeSection && !dashboard.contains(activeSection)) {
            dashboard.style.display = 'none';
        }
        
        // 3. Hide any loose card containers found
        document.querySelectorAll('.card').forEach(c => {
            if (c.parentElement && c.parentElement !== activeSection && !activeSection.contains(c.parentElement) && c.parentElement.tagName !== 'BODY') {
                c.parentElement.style.display = 'none';
            }
        });

        activeSection.style.display = 'block';

        // Auto-inject "Back to Dashboard" button for sub-sections
        // Checks if current section is NOT the dashboard
        const isDashboard = (activeSection === dashboard) || 
                            (activeSection.id && activeSection.id.toLowerCase().includes('dashboard')) || 
                            activeSection.id === 'main';
        
        if (!isDashboard && !activeSection.querySelector('.go-back-btn')) {
            const backBtn = document.createElement('button');
            backBtn.className = 'btn-secondary go-back-btn';
            backBtn.innerHTML = '<i class="fa fa-arrow-left"></i> Back to Dashboard';
            backBtn.style.marginBottom = '20px';
            backBtn.style.display = 'inline-flex';
            backBtn.style.alignItems = 'center';
            backBtn.style.gap = '8px';
            
            // Tries to find dashboard section, falls back to page reload
            backBtn.onclick = () => {
                const dashboard = document.getElementById('dashboard') || document.getElementById('admin-dashboard');
                if (dashboard) {
                    activeSection.style.display = 'none';
                    dashboard.style.display = 'block';
                    // Re-trigger specific ID show if possible
                    if (dashboard.id) window.showSection(dashboard.id);
                } else {
                    window.location.reload(); 
                }
            };
            
            // Insert at the very top of the section
            activeSection.insertBefore(backBtn, activeSection.firstChild);
        }
    } else {
        console.error('Section ID not found:', sectionId);
        // Optional: alert('Error: Section ' + sectionId + ' not found.'); 
    }
};

// FIX: Ensure Start Quiz functions are available globally
// This fixes issues where the button functions might be undefined
window.startSelectedQuiz = function() {
    const categorySelect = document.getElementById('categorySelect');
    const topicSelect = document.getElementById('topicSelect');
    
    console.log('🚀 Start Quiz Requested');

    if (categorySelect && topicSelect && categorySelect.value && topicSelect.value) {
        window.location.href = `quiz.html?topic=${encodeURIComponent(topicSelect.value)}&category=${encodeURIComponent(categorySelect.value)}`;
    } else if (categorySelect && topicSelect) {
         alert('Please select both a Category and a Topic.');
    } else {
         window.location.href = 'quiz.html';
    }
};

window.startQuiz = function(topic, category) {
    window.location.href = `quiz.html?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`;
};

function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = element.querySelector('h3');
    
    if (header) {
        header.style.cursor = 'move';
        header.addEventListener('mousedown', dragMouseDown);
    } else {
        element.addEventListener('mousedown', dragMouseDown);
    }

    function dragMouseDown(e) {
        e = e || window.event; // Keep legacy support just in case
        e.preventDefault();
        
        // Get current position and switch to top/left positioning
        const rect = element.getBoundingClientRect();
        element.style.top = rect.top + "px";
        element.style.left = rect.left + "px";
        element.style.bottom = "auto";
        element.style.right = "auto";
        element.style.transform = "none"; // Disable transform to prevent conflicts
        element.style.animation = "none"; // Disable animation

        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// Initialize draggable popup
document.addEventListener('DOMContentLoaded', () => {
    loadNavLinks();
    window.loadSiteSettings(); // Load title/footer on startup
    const popup = document.getElementById('contactPopup');
    if (popup) {
        makeDraggable(popup);
    }
    
    // FIX: Search Bar Event Listener
    // Ensures filtering works immediately when typing
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterCards);
    }

    // FIX: Directly attach listener to the "Start Quiz" button on Home Page
    // This fixes the issue where the generic listener might miss the button click
    const startQuizBtn = document.getElementById('startQuizBtn');
    if (startQuizBtn) {
        startQuizBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Stop other generic listeners from firing
            window.startSelectedQuiz();
        });
    }

    // AUTO-FIX: Attach listeners to Admin Buttons based on text content
    // This guarantees buttons work even if HTML onclick="" is missing or broken
    const adminActions = {
        'manage user': 'manage-user',
        'manage subject': 'manage-subject',
        'view mcq': 'view-mcqs',
        'create mcq': 'add-mcq',
        'add mcq': 'add-mcq',
        'bulk upload': 'bulk-upload',
        'csv upload': 'bulk-upload',
        'import': 'bulk-upload',
        'manage navigation': 'manage-nav',
        'nav': 'manage-nav',
        'message': 'view-messages',
        'inbox': 'view-messages',
        'setting': 'settings',
        'config': 'settings',
        'pdf': 'manage-pdfs',
        'manage pdf': 'manage-pdfs'
    };

    document.querySelectorAll('button, .btn, a').forEach(btn => {
        const text = btn.innerText ? btn.innerText.toLowerCase().trim() : '';
        
        // FIX: Go Back to Site Button
        if (text.includes('back to site') || text.includes('go back to website') || text.includes('visit site') || text.includes('exit admin')) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/';
            });
            return; // Skip other logic for this button
        }

        Object.keys(adminActions).forEach(key => {
            if (text.includes(key)) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault(); // Prevent default link jumps
                    
                    // Inject Settings Form if needed
                    if (key === 'setting' || key === 'config') renderSettingsUI();

                    // Inject Navigation UI if needed (Fix for "Manage Navigation")
                    if (key === 'manage navigation' || key === 'nav') renderNavigationUI();

                    // Inject Subject UI (Fix for "Manage Subject")
                    if (key === 'manage subject') renderSubjectUI();
                    
                    // HIGHLIGHT ACTIVE BUTTON (Blue Color Logic)
                    // 1. Reset all other buttons
                    document.querySelectorAll('button, .btn, a').forEach(b => {
                        b.classList.remove('active');
                        // If you use Bootstrap's btn-primary for active state:
                        if (b.classList.contains('btn-primary') && !b.classList.contains('login-btn')) {
                            b.classList.replace('btn-primary', 'btn-secondary'); // Revert to grey/default
                        }
                    });

                    // 2. Set clicked button to active/blue
                    btn.classList.add('active');
                    if (btn.classList.contains('btn-secondary')) btn.classList.replace('btn-secondary', 'btn-primary');
                    else btn.classList.add('btn-primary');

                    window.showSection(adminActions[key]);
                });
            }
        });
    });

    // GLOBAL EVENT LISTENER: Fixes Home Page Buttons (Subject, Logout, Quiz, Login)
    // This ensures buttons work even if onclick="" attributes are missing in HTML
    document.body.addEventListener('click', function(e) {
        // Find the clickable element (button, link, or closest parent with relevant class)
        const target = e.target.closest('button, a, .btn, .expand-btn, .logout-btn, .card-info, .child-btn');
        if (!target) return;

        const text = target.innerText ? target.innerText.toLowerCase().trim() : '';

        // FIX: Admin Panel Button (prevent it from being treated as logout)
        if (text.includes('admin')) {
             return; 
        }

        // FIX: Sub-topic Buttons (Child Buttons) - Fixes "Sub topic not showing MCQ page"
        if (target.classList.contains('child-btn')) {
            e.preventDefault();
            const topic = target.getAttribute('data-topic');
            const category = target.getAttribute('data-category');
            if (topic) {
                window.startQuiz(topic, category || 'General');
            }
            return;
        }

        // 1. Subject Expand Button (Fixes "Subject button not working")
        if (target.classList.contains('expand-btn') || target.classList.contains('card-info')) {
            e.preventDefault();
            toggleChildButtons(target);
            return;
        }

        // 2. Logout Button
        if (text === 'logout' || target.classList.contains('logout-btn')) {
            e.preventDefault();
            logout();
            return;
        }

        // 3. Start Quiz & Login Buttons (Navigation fallbacks)
        // Only acts if it's a button (links usually work naturally, unless broken)
        if (target.tagName === 'BUTTON' || target.getAttribute('href') === '#' || !target.getAttribute('href')) {
            // FIX: Don't intercept submit buttons (prevents breaking the login form)
            if (target.type === 'submit') return;

            if (text === 'login' || text === 'sign in') {
                e.preventDefault();
                window.location.href = 'login.html';
            } else if (text.includes('start quiz') || text.includes('take quiz')) {
                // FIX: If button has explicit onclick (e.g. startSelectedQuiz), let it run.
                // If not, we handle it here as a fallback.
                // Removed inline onclick check to force this logic to run, ensuring consistency
                
                e.preventDefault();
                if (document.getElementById('categorySelect')) {
                    window.startSelectedQuiz();
                } else {
                    window.location.href = 'quiz.html';
                }
            }
        }
    });
});

// --- QUIZ ENGINE (Fixes Missing Quiz Logic) ---

let currentQuizQuestions = [];
let currentQuizIndex = 0;
let quizUserAnswers = {}; 

// Finish quiz and redirect to results
window.finishQuiz = async function() {
    let score = 0;
    const answers = [];

    currentQuizQuestions.forEach((question, index) => {
        const selected = quizUserAnswers[question._id];
        answers.push(selected !== undefined ? selected : null);
        if (selected === parseInt(question.correctAnswer)) score++;
    });

    const total = currentQuizQuestions.length;
    const percentage = total > 0 ? (score / total) * 100 : 0;
    const userId = localStorage.getItem('userId');

    const urlParams = new URLSearchParams(window.location.search);
    const topic = urlParams.get('topic') || 'General';
    const category = urlParams.get('category') || 'General';

    try {
        const response = await fetch(`${API_BASE_URL}/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, topic, category, score, totalQuestions: total, percentage, answers })
        });

        if (response.ok) {
            const data = await response.json();
            window.location.href = `results.html?scoreId=${data._id}&score=${data.score}&total=${data.totalQuestions}&percentage=${data.percentage.toFixed(2)}&topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`;
        } else {
            alert('Failed to submit quiz. Please try again.');
        }
    } catch (error) {
        console.error('Error submitting quiz:', error);
        alert('Network error while submitting quiz.');
    }
};

// Initialize Quiz if we are on the quiz page
function initQuizPage() {
    const questionTextEl = document.getElementById('questionText');
    if (!questionTextEl) return; // Not on quiz page

    console.log('📝 Quiz Page Detected, initializing...');
    
    const urlParams = new URLSearchParams(window.location.search);
    const topic = urlParams.get('topic');
    const category = urlParams.get('category');

    if (!topic) {
        questionTextEl.textContent = "Please select a topic from the home page.";
        return;
    }

    loadQuizQuestions(topic, category);
}

async function loadQuizQuestions(topic, category) {
    try {
        let url = `${API_BASE_URL}/mcqs?topic=${encodeURIComponent(topic)}`;
        if (category) url += `&category=${encodeURIComponent(category)}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const questions = await response.json();
        
        if (!questions || questions.length === 0) {
            document.getElementById('questionText').textContent = "No questions found for this topic.";
            return;
        }

        currentQuizQuestions = questions;
        currentQuizIndex = 0;
        quizUserAnswers = {};
        
        // Setup Header info
        const title = document.querySelector('.quiz-header h2');
        if (title) title.textContent = `${topic} Quiz`;

        renderQuizQuestion();
        attachQuizControlListeners();

    } catch (error) {
        console.error('Error loading quiz:', error);
        document.getElementById('questionText').textContent = "Error loading questions. Please check API connection.";
    }
}

function renderQuizQuestion() {
    const question = currentQuizQuestions[currentQuizIndex];
    const qText = document.getElementById('questionText');
    const optionsContainer = document.querySelector('.options-container');
    const answerBox = document.querySelector('.answer-box');
    const progressFill = document.getElementById('progressFill');
    
    // Update Question
    qText.textContent = `${currentQuizIndex + 1}. ${question.question}`;
    
    // Update Progress
    if (progressFill) {
        const percent = ((currentQuizIndex + 1) / currentQuizQuestions.length) * 100;
        progressFill.style.width = `${percent}%`;
    }

    // Hide Answer Box
    if (answerBox) {
        answerBox.style.display = 'none';
        answerBox.innerHTML = '';
    }

    // Render Options
    optionsContainer.innerHTML = '';
    question.options.forEach((opt, index) => {
        const label = document.createElement('label');
        label.className = 'option-label';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'qOption';
        radio.value = index;
        if (quizUserAnswers[question._id] === index) radio.checked = true;
        
        // Event for selecting option
        radio.onchange = () => {
            quizUserAnswers[question._id] = index;
            
            const correct = parseInt(question.correctAnswer);
            const selected = index;
            const labels = optionsContainer.querySelectorAll('.option-label');
            
            // Immediate Feedback Logic
            labels.forEach((lbl, idx) => {
                const inp = lbl.querySelector('input');
                inp.disabled = true; // Disable further changes

                // Reset styles
                lbl.style.borderColor = '#ddd';
                lbl.style.backgroundColor = '#f9f9f9';

                // Highlight Correct
                if (idx === correct) {
                    lbl.style.backgroundColor = '#d4edda'; // Green bg
                    lbl.style.borderColor = '#28a745';     // Green border
                } 
                // Highlight Wrong (if selected)
                else if (idx === selected) {
                    lbl.style.backgroundColor = '#f8d7da'; // Red bg
                    lbl.style.borderColor = '#dc3545';     // Red border
                }
            });
            
            // Show Explanation immediately if available
            if (answerBox && question.explanation) {
                answerBox.style.display = 'block';
                answerBox.innerHTML = `
                    <div style="font-weight:bold; color:${selected === correct ? 'green' : 'red'}; margin-bottom:5px;">
                        ${selected === correct ? 'Correct!' : 'Incorrect!'}
                    </div>
                    <strong>Correct Answer:</strong> ${question.options[correct]} <br>
                    <hr style="margin: 8px 0; border:0; border-top:1px solid #cce5ff;">
                    <strong>Explanation:</strong> ${question.explanation}
                `;
            }
        };

        const span = document.createElement('span');
        span.textContent = opt;

        label.appendChild(radio);
        label.appendChild(span);
        optionsContainer.appendChild(label);
        
        // Restore styling if checked
        if (radio.checked) {
            label.style.borderColor = '#667eea';
            label.style.backgroundColor = '#eef2ff';
        }
    });
}

function attachQuizControlListeners() {
    // FIX: "View Answer" Button Logic
    const viewAnswerBtn = document.querySelector('.view-answer-btn');
    if (viewAnswerBtn) {
        const newBtn = viewAnswerBtn.cloneNode(true);
        viewAnswerBtn.parentNode.replaceChild(newBtn, viewAnswerBtn);
        
        newBtn.addEventListener('click', () => {
            const question = currentQuizQuestions[currentQuizIndex];
            const answerBox = document.querySelector('.answer-box');
            if (answerBox) {
                const correctOpt = question.options[question.correctAnswer];
                answerBox.style.display = 'block';
                answerBox.innerHTML = `
                    <strong>Correct Answer:</strong> ${correctOpt} <br>
                    <hr style="margin: 8px 0; border:0; border-top:1px solid #cce5ff;">
                    <strong>Explanation:</strong> ${question.explanation || 'No explanation available.'}
                `;
            }
        });
    }

    // Navigation Buttons
    const controls = document.querySelectorAll('.quiz-controls button');
    let prevBtn, nextBtn;
    
    controls.forEach(btn => {
        const txt = btn.innerText.toLowerCase();
        if (txt.includes('prev')) prevBtn = btn;
        if (txt.includes('next') || txt.includes('finish') || txt.includes('submit')) nextBtn = btn;
    });

    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentQuizIndex > 0) {
                currentQuizIndex--;
                renderQuizQuestion();
            }
        };
    }

    if (nextBtn) {
        nextBtn.onclick = () => {
            if (currentQuizIndex < currentQuizQuestions.length - 1) {
                currentQuizIndex++;
                renderQuizQuestion();
            } else {
                window.finishQuiz();
            }
        };
    }
}

// Ensure quiz initializes on load
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initQuizPage);
else initQuizPage();

// FIX: CSP - Replace inline event handlers with addEventListener
document.addEventListener('DOMContentLoaded', () => {
    // Nav brand click
    const navBrand = document.getElementById('navBrand');
    if (navBrand) navBrand.addEventListener('click', () => window.location.href = 'index.html');
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    
    // Hamburger menu
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    if (hamburgerBtn) hamburgerBtn.addEventListener('click', toggleMobileMenu);
    
    // Search input keyup
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('keyup', filterCards);
    
    // Contact popup toggle
    const contactBtn = document.getElementById('contactBtn');
    if (contactBtn) contactBtn.addEventListener('click', toggleContactPopup);
    
    // Contact form submit
    const contactForm = document.getElementById('contactForm');
    if (contactForm) contactForm.addEventListener('submit', submitContactForm);
});


// --- Universal Event Delegator for CSP Compliance ---
window.toggleChildButtonsWrapper = function(e) {
    const target = e.target.closest('.card-info');
    if (target) toggleChildButtons(target.parentElement);
};

['click', 'submit', 'keyup', 'change'].forEach(eventType => {
    document.addEventListener(eventType, function(e) {
        if (eventType === 'click') {
            const linkTarget = e.target.closest('[data-href]');
            if (linkTarget) {
                window.location.href = linkTarget.getAttribute('data-href');
                return;
            }
        }

        const attrName = 'data-on' + eventType;
        const target = e.target.closest('[' + attrName + ']');
        if (target) {
            if (eventType === 'submit') e.preventDefault();
            
            const funcName = target.getAttribute(attrName);
            let args = [];
            
            if (target.hasAttribute('data-args')) {
                try {
                    let argsStr = target.getAttribute('data-args');
                    // Handle [this] special case
                    if (argsStr.trim() === '[this]') {
                        args = [target];
                    } else {
                        // Replace single quotes and unquoted keywords
                        argsStr = argsStr
                            .replace(/'/g, '"')
                            .replace(/\bevent\b/g, '"event"')
                            .replace(/\bthis\b/g, '"this"');
                        args = JSON.parse(argsStr);
                        args = args.map(arg => arg === 'event' ? e : (arg === 'this' ? target : arg));
                    }
                } catch(err) {
                    console.error('Error parsing data-args', err);
                }
            }
            
            if (funcName === 'submitContactForm' || funcName === 'saveMCQ') {
                args = [e];
            } else if (args.length === 0 && eventType === 'keyup') {
                args = [e];
            }

            if (typeof window[funcName] === 'function') {
                window[funcName].apply(null, args);
            }
        }
    });
});
