
        window.addEventListener('DOMContentLoaded', () => {
            if (typeof loadNavLinks === 'function') loadNavLinks();
        });

        const resetForm = document.getElementById('resetForm');
        
        // Check for token
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (!token) {
            alert('Invalid or missing reset token.');
            window.location.href = 'login.html';
        }
        
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }
            
            const result = await resetPassword(token, password);
            
            if (result.message) {
                alert(result.message);
                window.location.href = 'login.html';
            } else {
                alert(result.error || 'Failed to reset password');
            }
        });
    
