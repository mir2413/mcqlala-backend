
        // Check if user is logged in
function startQuiz(topic, category) {
            window.location.href = `quiz.html?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`;
        }

        function startSelectedQuiz() {
            const category = document.getElementById('categorySelect').value;
            const topic = document.getElementById('topicSelect').value;
            if (category && topic) {
                startQuiz(topic, category);
            } else {
                alert('Please select both a Category and a Topic.');
            }
        }

        window.addEventListener('DOMContentLoaded', async () => {
            checkAuth();
            loadNavLinks();
            const user = getCurrentUser();
            if (user.username) {
                document.getElementById('username').textContent = user.username;
                await loadSubjectsAndRender();
                document.getElementById('categorySelect').addEventListener('change', loadTopicsForFilter);
            }
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

        async function loadSubjectsAndRender() {
            const grid = document.getElementById('cardGrid');
            try {
                const response = await fetch(`${API_BASE_URL}/subjects`);
                if (!response.ok) throw new Error('Failed to fetch subjects');
                const subjects = await response.json();

                if (subjects.length === 0) {
                    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">No subjects available.</div>';
                    return;
                }

                grid.innerHTML = subjects.map(subject => `
                    <div class="card">
                        <div class="card-info" data-onclick="toggleChildButtonsWrapper">
                            <div class="card-title">${escapeHtml(subject.name)}</div>
                            <div class="card-meta">${escapeHtml(subject.description || '')}</div>
                            <i class="fa-solid fa-chevron-down expand-icon"></i>
                        </div>
                        <div class="child-buttons" style="display:none;">
                            ${subject.topics && subject.topics.length > 0 ? 
                                subject.topics.map(topic => `<button class="child-btn" data-topic="${escapeAttr(topic.name)}" data-category="${escapeAttr(subject.name)}" onclick="startQuiz('${escapeJs(topic.name)}', '${escapeJs(subject.name)}')">${escapeHtml(topic.name)}</button>`).join('') 
                                : '<div style="padding:10px; font-size:12px; color:#999;">No topics yet</div>'}
                        </div>
                    </div>
                `).join('');

                loadCategories(); // Refresh dropdowns based on new DOM
            } catch (error) {
                console.error('Error loading subjects:', error);
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: red;">Failed to load subjects. Please check API connection.<br><small>${error.message}</small></div>`;
            }
        }

        function loadCategories() {
            const select = document.getElementById('categorySelect');
            select.innerHTML = '<option value="">Select Category</option>';

            const categories = new Set();
            const buttons = document.querySelectorAll('.child-btn');

            buttons.forEach(button => {
                const category = button.getAttribute('data-category');
                if (category) {
                    categories.add(category);
                }
            });

            if (categories.size === 0) {
                const option = new Option('No categories found', '');
                option.disabled = true;
                select.add(option);
                return;
            }

            categories.forEach(cat => {
                const option = new Option(cat, cat);
                select.appendChild(option);
            });
        }

        function loadTopicsForFilter() {
            const selectedCategory = document.getElementById('categorySelect').value;
            const topicSelect = document.getElementById('topicSelect');
            topicSelect.innerHTML = '<option value="">Select Topic</option>';
            
            if (!selectedCategory) return;

            const topics = new Set();
            const buttons = document.querySelectorAll('.child-btn');

            buttons.forEach(button => {
                const category = button.getAttribute('data-category');
                const topic = button.getAttribute('data-topic');
                if (category === selectedCategory && topic) {
                    topics.add(topic);
                }
            });

            topics.forEach(topic => {
                const option = new Option(topic, topic);
                topicSelect.appendChild(option);
            });
        }

        function startSelectedQuiz() {
            const category = document.getElementById('categorySelect').value;
            const topic = document.getElementById('topicSelect').value;
            if (category && topic) {
                startQuiz(topic, category);
            } else {
                alert('Please select both a Category and a Topic.');
            }
        }

        function startQuiz(topic, category) {
            window.location.href = `quiz.html?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`;
        }
    
