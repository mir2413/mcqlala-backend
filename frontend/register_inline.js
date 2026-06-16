
        window.addEventListener('DOMContentLoaded', () => {
            if (typeof loadNavLinks === 'function') loadNavLinks();
            
            const registerForm = document.getElementById('registerForm');
            if (!registerForm) return;
            
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                
                if (password !== confirmPassword) {
                    if (typeof showToast === 'function') { showToast('Passwords do not match!', 'error'); } else { alert('Passwords do not match!'); }
                    return;
                }
                
                try {
                    const response = await fetch(`${API_BASE_URL}/users/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, email, password })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        if (typeof showToast === 'function') { showToast('Registration successful! Redirecting to login...', 'success'); }
                        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
                    } else {
                        if (typeof showToast === 'function') { showToast(data.message || 'Registration failed', 'error'); } else { alert(data.message || 'Registration failed'); }
                    }
                } catch (error) {
                    console.error('Error:', error);
                    if (typeof showToast === 'function') { showToast('An error occurred during registration', 'error'); } else { alert('An error occurred during registration'); }
                }
            });
        });
    
