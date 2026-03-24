
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
            const params = new URLSearchParams(window.location.search);
            const topic = params.get('topic') || 'General Knowledge';

            if (typeof loadNavLinks === 'function') {
                loadNavLinks();
            }

            const username = localStorage.getItem('username');
            document.getElementById('username').textContent = username;
            document.getElementById('topicName').textContent = `${topic} - Top Performers`;

            await loadLeaderboard(topic);
        });

        async function loadLeaderboard(topic) {
            try {
                const response = await fetch(`${API_BASE_URL}/leaderboard/${topic}`);
                const scores = await response.json();

                const tbody = document.getElementById('leaderboardBody');
                tbody.innerHTML = '';

                if (scores.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">No scores yet</td></tr>';
                    return;
                }

                scores.forEach((score, index) => {
                    const date = new Date(score.submittedAt).toLocaleDateString();
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${escapeHtml(score.user ? score.user.username : 'Unknown User')}</td>
                        <td>${score.score}/${score.totalQuestions}</td>
                        <td>${score.percentage.toFixed(2)}%</td>
                        <td>${date}</td>
                    `;
                    tbody.appendChild(row);
                });
            } catch (error) {
                console.error('Error loading leaderboard:', error);
                document.getElementById('leaderboardBody').innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Failed to load leaderboard</td></tr>';
            }
        }

        function goHome() {
            window.location.href = 'index.html';
        }
    
