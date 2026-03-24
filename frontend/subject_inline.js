
        function escapeHtml(text) {
            if (typeof text !== 'string') return text || '';
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        window.addEventListener('DOMContentLoaded', async () => {
            checkAuth();
            loadNavLinks();
            
            const params = new URLSearchParams(window.location.search);
            const subjectName = params.get('subject');
            
            if (!subjectName) {
                window.location.href = 'index.html';
                return;
            }

            document.getElementById('username').textContent = localStorage.getItem('username') || 'User';

            try {
                const response = await fetch(`${API_BASE_URL}/subjects`);
                if (!response.ok) throw new Error('Failed to fetch subjects');
                const subjects = await response.json();
                
                const subject = subjects.find(s => s.name === subjectName);
                
                if (!subject) {
                    document.getElementById('topicsList').innerHTML = '<div class="no-topics">Subject not found</div>';
                    return;
                }

                document.getElementById('subjectName').textContent = subject.name;
                document.getElementById('subjectDesc').textContent = subject.description || 'View all topics for this subject';

                const topicsList = document.getElementById('topicsList');
                
                if (subject.topics && subject.topics.length > 0) {
                    topicsList.innerHTML = subject.topics.map(topic => `
                        <div class="topic-card" data-onclick="startQuiz" data-args="[&quot;${topic.name.replace(/"/g, '&quot;')}&quot;, &quot;${subject.name.replace(/"/g, '&quot;')}&quot;]">
                            <h3>${escapeHtml(topic.name)}</h3>
                            <p>${escapeHtml(topic.description || 'Click to start quiz')}</p>
                            <span class="start-btn"><i class="fa-solid fa-play"></i> Start Quiz</span>
                        </div>
                    `).join('');
                } else {
                    topicsList.innerHTML = '<div class="no-topics">No topics available for this subject yet.</div>';
                }

            } catch (error) {
                console.error('Error loading topics:', error);
                document.getElementById('topicsList').innerHTML = '<div class="no-topics">Failed to load topics. Please try again.</div>';
            }
        });
    
