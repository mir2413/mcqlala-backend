
        window.addEventListener('DOMContentLoaded', () => {
            if (typeof loadNavLinks === 'function') loadNavLinks();

            // Show redirect message if user was sent here from a protected page
            const redirectMsg = sessionStorage.getItem('authRedirect');
            if (redirectMsg) {
                sessionStorage.removeItem('authRedirect');
                const msgEl = document.createElement('div');
                msgEl.style.cssText = 'background:#fff3cd;border:1px solid #ffc107;color:#856404;padding:10px 15px;border-radius:6px;margin-bottom:15px;font-size:14px;';
                msgEl.textContent = redirectMsg;
                document.querySelector('.auth-card').insertBefore(msgEl, document.querySelector('#loginForm'));
            }

            const loginForm = document.getElementById('loginForm');
            if (!loginForm) return;

            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value;
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Logging in...'; }

                try {
                    const response = await fetch(`${API_BASE_URL}/users/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        localStorage.setItem('userId', data.userId);
                        localStorage.setItem('username', data.username);
                        localStorage.setItem('isAdmin', data.isAdmin);
                        window.location.href = 'index.html';
                    } else {
                        alert(data.message || 'Login failed');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('Network error. Please check your connection.');
                } finally {
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
                }
            });
        });
    
