
        // Check if user is logged in
        window.addEventListener('DOMContentLoaded', async () => {
            checkAuth();
            loadNavLinks();
            const user = getCurrentUser();
            if (user.username) {
                document.getElementById('username').textContent = user.username;
                const isAdmin = localStorage.getItem('isAdmin') === 'true';

                // Show Admin Button ONLY for admin users
                if (isAdmin) {
                    const adminBtn = document.createElement('button');
                    adminBtn.className = 'btn-secondary admin-btn'; // Use a different class
                    adminBtn.style.backgroundColor = '#4ecdc4';
                    adminBtn.style.marginRight = '10px';
                    adminBtn.textContent = 'Admin Panel';
                    adminBtn.onclick = () => window.location.href = 'admin.html';
                    document.getElementById('userProfile').insertBefore(adminBtn, document.querySelector('#userProfile .logout-btn'));
                }
            }
            
            // Load subjects for all users (logged in or not)
            await loadSubjectsAndRender();
            document.getElementById('categorySelect').addEventListener('change', loadTopicsForFilter);
        });

        function escapeJs(str) {
            if (str === null || str === undefined) return '';
            return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
        }

        function escapeHtml(text) {
            if (typeof text !== 'string') return text || '';
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function escapeAttr(str) {
            if (str === null || str === undefined) return '';
            return String(str).replace(/"/g, "&quot;");
        }

        function toggleChildButtons_unused(card) {
            const childButtons = card.querySelector('.child-buttons');
            const icon = card.querySelector('.expand-icon');
            
            if (childButtons.style.display === 'none' || childButtons.style.display === '') {
                childButtons.style.display = 'block';
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            } else {
                childButtons.style.display = 'none';
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        }

        async function loadSubjectsAndRender() {
            const grid = document.getElementById('cardGrid');
            try {
                const response = await fetch(`${API_BASE_URL}/subjects`);
                if (!response.ok) throw new Error('Failed to fetch subjects');
                const subjects = await response.json();
                cachedSubjects = subjects;

                if (subjects.length === 0) {
                    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">No subjects available.</div>';
                    return subjects;
                }

                grid.innerHTML = subjects.map(subject => `
                    <div class="card">
                        <div class="card-info" data-href="subject.html?subject=${encodeURIComponent(subject.name)}" data-target="_blank">
                            <div class="card-title">${escapeHtml(subject.name)}</div>
                            <div class="card-meta">${escapeHtml(subject.description || '')} ${subject.topics && subject.topics.length > 0 ? `<span style="color:#667eea; font-size:12px;">(${subject.topics.length} topics)</span>` : ''}</div>
                        </div>
                    </div>
                `).join('');

                populateDropdowns(subjects);
                return subjects;
            } catch (error) {
                console.error('Error loading subjects:', error);
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: red;">Failed to load subjects. Please check API connection.<br><small>${error.message}</small></div>`;
                return [];
            }
        }

        function populateDropdowns(subjects) {
            const categorySelect = document.getElementById('categorySelect');
            categorySelect.innerHTML = '<option value="">Select Category</option>';
            
            subjects.forEach(subject => {
                const option = new Option(subject.name, subject.name);
                categorySelect.appendChild(option);
            });
        }

        let cachedSubjects = [];

        function loadTopicsForFilter() {
            const selectedCategory = document.getElementById('categorySelect').value;
            const topicSelect = document.getElementById('topicSelect');
            topicSelect.innerHTML = '<option value="">Select Topic</option>';

            if (!selectedCategory) return;

            const subject = cachedSubjects.find(s => s.name === selectedCategory);
            if (subject && subject.topics) {
                subject.topics.forEach(topic => {
                    const option = new Option(topic.name, topic.name);
                    topicSelect.appendChild(option);
                });
            }
        }
    
