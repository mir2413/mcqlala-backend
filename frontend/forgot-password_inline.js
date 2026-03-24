
        window.addEventListener('DOMContentLoaded', () => {
            if (typeof loadNavLinks === 'function') loadNavLinks();
        });

        const forgotForm = document.getElementById('forgotForm');
        
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            
            btn.disabled = true;
            btn.textContent = 'Sending...';

            const result = await forgotPassword(email);
            
            btn.disabled = false;
            btn.textContent = originalText;

            alert(result.message || result.error);
        });
    
