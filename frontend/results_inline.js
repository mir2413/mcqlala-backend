
        window.addEventListener('DOMContentLoaded', () => {
            const params = new URLSearchParams(window.location.search);
            const score = parseInt(params.get('score')) || 0;
            const total = parseInt(params.get('total')) || 0;
            const percentage = parseFloat(params.get('percentage')) || 0;

            if (typeof loadNavLinks === 'function') {
                loadNavLinks();
            }

            const username = localStorage.getItem('username');
            document.getElementById('username').textContent = username;

            document.getElementById('scoreText').textContent = `${score}/${total}`;
            document.getElementById('percentageText').textContent = `${percentage.toFixed(2)}%`;
            document.getElementById('correctCount').textContent = score;
            document.getElementById('wrongCount').textContent = total - score;
            document.getElementById('accuracyText').textContent = `${percentage.toFixed(2)}%`;

            let message = '';
            if (percentage >= 80) {
                message = '🎉 Excellent! You have mastered this topic!';
            } else if (percentage >= 60) {
                message = '👍 Good Job! Keep practicing to improve further!';
            } else if (percentage >= 40) {
                message = '📚 Average Performance! Review the topics and try again!';
            } else {
                message = '💪 Keep Trying! Practice more to improve your score!';
            }
            document.getElementById('resultMessage').textContent = message;
        });

        function viewLeaderboard() {
            const topic = new URLSearchParams(window.location.search).get('topic') || 'General Knowledge';
            window.location.href = `leaderboard.html?topic=${topic}`;
        }

        function retakeQuiz() {
            const params = new URLSearchParams(window.location.search);
            const topic = params.get('topic') || 'General Knowledge';
            const category = params.get('category') || 'General';
            window.location.href = `quiz.html?topic=${topic}&category=${category}`;
        }

        function goHome() {
            window.location.href = 'index.html';
        }
    
