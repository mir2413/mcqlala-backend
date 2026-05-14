
        let quizData = [];
        let currentPage = 1;
        let questionsPerPage = 10;
        let selectedAnswers = {};
        let topic = '';
        let category = '';
        let totalQuestionLimit = 0;
        let timePerQuestion = 0;
        let perQuestionTimer = null;
        let currentQuestionStartTime = 0;

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
            topic = params.get('topic') || 'General Knowledge';
            category = params.get('category') || 'General';
            
            // Get quiz settings from URL
            const mode = params.get('mode') || 'none';
            const limit = parseInt(params.get('limit') || '0');
            const timeQ = parseInt(params.get('timePerQ') || '0');
            
            if (limit > 0) totalQuestionLimit = limit;
            if (timeQ > 0) timePerQuestion = timeQ;

            // Disable right-click on quiz questions
            const questionsContainer = document.getElementById('questionsContainer');
            if (questionsContainer) {
                questionsContainer.addEventListener('contextmenu', (e) => e.preventDefault());
            }

            if (typeof loadNavLinks === 'function') {
                loadNavLinks();
            }

            const userId = localStorage.getItem('userId');
            const username = localStorage.getItem('username');

            document.getElementById('username').textContent = username || 'Guest';
            document.getElementById('topicTitle').textContent = `${category} - ${topic}`;
            
            // Show mode indicator
            const modeText = {
                'none': 'Practice Mode',
                'quick': 'Quick Test (5 min)',
                'standard': 'Standard Test (30 min)',
                'exam': 'Exam Simulation (60 min)'
            };
            if (mode !== 'none') {
                const topicTitle = document.getElementById('topicTitle');
                if (topicTitle) {
                    topicTitle.textContent += ` - ${modeText[mode] || mode}`;
                }
            }

            // Initialize exam timer if in exam mode
            initializeExamTimer();

            await loadQuestions();
            if (quizData.length > 0) {
                displayPage();
                populatePageJump();
                
                // Attach Event Listeners
                document.getElementById('prevBtn').addEventListener('click', previousPage);
                document.getElementById('nextBtn').addEventListener('click', () => {
                    const totalPages = Math.ceil(quizData.length / questionsPerPage);
                    if (currentPage === totalPages) {
                        submitQuiz();
                    } else {
                        nextPage();
                    }
                });
                
                // Page jump dropdown
                document.getElementById('pageJump').addEventListener('change', function() {
                    const page = parseInt(this.value);
                    const totalPages = Math.ceil(quizData.length / questionsPerPage);
                    if (page >= 1 && page <= totalPages) {
                        currentPage = page;
                        displayPage();
                        updatePageJumpSelection();
                        scrollToTopWithEffect();
                        
                        // Reset dropdown to default after selection to prevent arrow key issues
                        this.blur();
                        this.value = '';
                    }
                });
            }
        });

        async function loadQuestions() {
            const questionsContainer = document.getElementById('questionsContainer');
            const paginationControls = document.getElementById('paginationControls');
            const quizActions = document.getElementById('quizActions');
            const loadingSpinner = document.getElementById('loadingSpinner');

            try {
                const response = await fetch(`${API_BASE_URL}/mcqs?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`);
                if (!response.ok) throw new Error(`Server error: ${response.status}`);
                let questions = await response.json();
                
                // Apply question limit if set
                if (totalQuestionLimit > 0 && totalQuestionLimit < questions.length) {
                    questions = questions.slice(0, totalQuestionLimit);
                }
                
                quizData = questions;
                document.getElementById('totalQuestions').textContent = quizData.length;
                
                if (quizData.length === 0) {
                    questionsContainer.innerHTML = `
                        <div style="text-align: center; padding: 60px 20px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border);">
                            <i class="fa-solid fa-inbox" style="font-size: 64px; color: var(--text-muted); margin-bottom: 20px;"></i>
                            <h3 style="color: var(--text); margin-bottom: 10px;">No Questions Available</h3>
                            <p style="color: var(--text-muted); margin-bottom: 25px; font-size: 15px;">We don't have any questions for this topic yet. Check back later or select a different topic.</p>
                            <a href="index.html" style="display: inline-block; background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                                <i class="fa-solid fa-arrow-left"></i> Back to Home
                            </a>
                        </div>
                    `;
                    questionsContainer.style.display = 'block';
                    quizActions.style.display = 'flex';
                    paginationControls.style.display = 'none';
                    document.getElementById('pageInfo').textContent = 'No questions found';
                } else {
                    questionsContainer.style.display = 'grid';
                    paginationControls.style.display = 'flex';
                    quizActions.style.display = 'flex';
                }
            } catch (error) {
                console.error('Error loading questions:', error);
                questionsContainer.innerHTML = '<p style="text-align: center; color: #d9534f; font-weight: 600;">Failed to load questions. Please try again later.</p>';
                questionsContainer.style.display = 'block';
                quizActions.style.display = 'flex';
            } finally {
                loadingSpinner.style.display = 'none';
            }
        }

        function displayPage() {
            const startIndex = (currentPage - 1) * questionsPerPage;
            const endIndex = Math.min(startIndex + questionsPerPage, quizData.length);
            const pageQuestions = quizData.slice(startIndex, endIndex);

            // Update page info
            const totalPages = Math.ceil(quizData.length / questionsPerPage);
            document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages} | Showing questions ${startIndex + 1} to ${endIndex}`;
            document.getElementById('pageIndicator').textContent = `${currentPage} / ${totalPages}`;
            
            // Start per-question timer if enabled
            if (timePerQuestion > 0) {
                startPerQuestionTimer();
            }

            // Render questions
            const container = document.getElementById('questionsContainer');
            container.innerHTML = pageQuestions.map((question, index) => {
                const questionNumber = startIndex + index + 1;
                const questionId = startIndex + index;
                const userAnswer = selectedAnswers[questionId];
                const isAnswered = userAnswer !== undefined;
                
                // FIX: Ensure correct answer is a valid number for comparison
                let correctAns = parseInt(question.correctAnswer); 
                if (isNaN(correctAns)) correctAns = 0;

                return `
                    <div class="quiz-question">
                        <div class="quiz-question-number">Question ${questionNumber}</div>
                        <h4>${escapeHtml(question.question)}</h4>
                        <div class="quiz-options">
                            ${question.options.map((option, optIndex) => {
                                let optionClass = 'quiz-option';
                                if (isAnswered) {
                                    if (optIndex === correctAns) {
                                        optionClass += ' correct';
                                    } else if (optIndex === userAnswer) {
                                        optionClass += ' wrong';
                                    }
                                }

                                return `
                                <label class="${optionClass}">
                                    <input type="radio"
                                           name="question_${questionId}"
                                           value="${optIndex}"
                                           ${userAnswer === optIndex ? 'checked' : ''}
                                           ${isAnswered ? 'disabled' : ''}
                                           data-onchange="saveAnswer" data-args="[${questionId}, ${optIndex}]">
                                    <span>${escapeHtml(option)}</span>
                                    ${isAnswered && optIndex === correctAns ? '<i class="fa-solid fa-check" style="color: #22C55E; margin-left: 10px;"></i>' : ''}
                                    ${isAnswered && optIndex === userAnswer && optIndex !== correctAns ? '<i class="fa-solid fa-times" style="color: #EF4444; margin-left: 10px;"></i>' : ''}
                                </label>
                            `}).join('')}
                        </div>
                        ${isAnswered ? `
                            <div style="margin-top: 20px; padding: 15px; background: #1E293B; border: 1px solid #334155; border-radius: 8px;">
                                <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 10px; color: ${userAnswer === correctAns ? '#22C55E' : '#EF4444'};">
                                    ${userAnswer === correctAns ? '<i class="fa-solid fa-circle-check"></i> Correct!' : '<i class="fa-solid fa-circle-xmark"></i> Incorrect'}
                                </div>
                                
                                ${userAnswer !== correctAns ? `<div style="margin-bottom: 12px; font-size: 0.95em; color: #E5E7EB; background: rgba(239, 68, 68, 0.1); padding: 8px 12px; border-radius: 4px; border-left: 3px solid #EF4444;"><strong>Correct Answer:</strong> ${escapeHtml(question.options[correctAns])}</div>` : ''}

                                ${question.explanation ? `<div style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3B82F6; padding: 12px; border-radius: 4px; font-size: 0.95em; color: #E5E7EB;">
                                    <div style="font-weight: bold; color: #3B82F6; margin-bottom: 5px;"><i class="fa-solid fa-circle-info"></i> Explanation:</div>${escapeHtml(question.explanation)}</div>` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            // Update buttons
            document.getElementById('prevBtn').disabled = currentPage === 1;
            
            const nextBtn = document.getElementById('nextBtn');
            nextBtn.innerText = 'Next →';
            nextBtn.classList.remove('submit-btn');
            nextBtn.style.display = currentPage === totalPages ? 'none' : 'inline-block';
            document.getElementById('prevBtn').style.display = currentPage === 1 ? 'none' : 'inline-block';
            

            // Update answered count
            updateAnsweredCount();
            updateProgressText();
        }

        // FIX: Make function global to ensure HTML onchange attribute can find it
        window.saveAnswer = function(questionIndex, optionIndex) {
            selectedAnswers[questionIndex] = optionIndex;
            updateAnsweredCount();
            updateProgressText();
            displayPage(); // Re-render to show immediate feedback (Green/Red colors)
        };

        function updateAnsweredCount() {
            const answered = Object.keys(selectedAnswers).length;
            document.getElementById('answeredCount').textContent = answered;
        }

        function updateProgressText() {
            const answered = Object.keys(selectedAnswers).length;
            
            if (answered === quizData.length) {
                document.getElementById('progressText').textContent = '✅ All questions answered!';
                document.getElementById('progressText').style.color = '#21cc12';
            } else {
                document.getElementById('progressText').textContent = `📝 ${answered} of ${quizData.length} questions answered`;
                document.getElementById('progressText').style.color = '#ff9800';
            }
        }

        function showSaveIndicator() {
            const saveDiv = document.getElementById('saveProgress');
            saveDiv.style.display = 'block';
setTimeout(() => {
                saveDiv.style.display = 'none';
            }, 2000);
        }

        function nextPage() {
            clearPerQuestionTimer();
            const totalPages = Math.ceil(quizData.length / questionsPerPage);
            if (currentPage < totalPages && totalPages > 0) {
                currentPage++;
                displayPage();
                updatePageJumpSelection();
                scrollToTopWithEffect();
            }
        }

        function previousPage() {
            clearPerQuestionTimer();
            if (currentPage > 1) {
                currentPage--;
                displayPage();
                updatePageJumpSelection();
                scrollToTopWithEffect();
            }
        }
        
        function scrollToTopWithEffect() {
            const container = document.getElementById('questionsContainer');
            
            // Add flash effect
            container.style.transition = 'opacity 0.15s ease-out';
            container.style.opacity = '0.3';
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            setTimeout(() => {
                container.style.opacity = '1';
            }, 150);
            
            // Flash the page indicator
            const pageIndicator = document.getElementById('pageIndicator');
            if (pageIndicator) {
                pageIndicator.style.transition = 'transform 0.2s ease';
                pageIndicator.style.transform = 'scale(1.3)';
                setTimeout(() => {
                    pageIndicator.style.transform = 'scale(1)';
                }, 200);
            }
        }

        function populatePageJump() {
            const pageJumpSelect = document.getElementById('pageJump');
            const totalPages = Math.ceil(quizData.length / questionsPerPage);
            
            // Clear existing options except first
            pageJumpSelect.innerHTML = '<option value="">Go to page</option>';
            
            // Add page options
            for (let i = 1; i <= totalPages; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Page ${i}`;
                pageJumpSelect.appendChild(option);
            }
        }
        
        function updatePageJumpSelection() {
            const pageJumpSelect = document.getElementById('pageJump');
            if (pageJumpSelect) {
                pageJumpSelect.value = currentPage;
            }
        }
        
        async function submitQuiz() {
            // Check for unanswered questions
            // Removed confirmation to allow users to finish partial quizzes (Practice Mode)
            // e.g., answering 50 out of 1000 questions and stopping.

            // Calculate score
            let score = 0;
            const answers = [];
            
            quizData.forEach((question, index) => {
                const selectedOption = selectedAnswers[index];
                answers.push(selectedOption);
                
                if (selectedOption === parseInt(question.correctAnswer)) {
                    score++;
                }
            });

            const userId = localStorage.getItem('userId');
            const percentage = quizData.length > 0 ? (score / quizData.length) * 100 : 0;

            try {
                const response = await fetch(`${API_BASE_URL}/scores`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        topic,
                        category,
                        score,
                        totalQuestions: quizData.length,
                        percentage,
                        answers: answers
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    window.location.href = `results.html?scoreId=${data._id}&score=${data.score}&total=${data.totalQuestions}&percentage=${data.percentage.toFixed(2)}&topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`;
                } else {
                    alert('Failed to submit quiz');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred while submitting the quiz');
            }
        }

        function goHome() {
            if (quizData.length > 0 && Object.keys(selectedAnswers).length > 0) {
                if (!confirm('You have unanswered or incomplete answers. Are you sure you want to leave?')) {
                    return;
                }
            }
            window.location.href = 'index.html';
        }

        // === Exam Timer System ===
        let timerInterval = null;
        
        function initializeExamTimer() {
            const mode = sessionStorage.getItem('examMode');
            const duration = parseInt(sessionStorage.getItem('examDuration') || '0');
            const startTime = parseInt(sessionStorage.getItem('examStartTime') || '0');
            
            if (!mode || mode === 'none' || !duration || !startTime) {
                return; // Practice mode, no timer
            }
            
            const examTimer = document.getElementById('examTimer');
            const timerDisplay = document.getElementById('timerDisplay');
            
            if (examTimer && timerDisplay) {
                examTimer.style.display = 'flex';
            }
            
            timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const remaining = duration - elapsed;
                
                if (remaining <= 0) {
                    clearInterval(timerInterval);
                    showToast('Time is up! Submitting your quiz...', 'warning');
                    setTimeout(() => submitQuiz(), 2000);
                    return;
                }
                
                const mins = Math.floor(remaining / 60);
                const secs = remaining % 60;
                timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                
                // Warning when 5 minutes left
                if (remaining === 300) {
                    showToast('5 minutes remaining!', 'warning');
                }
                
                // Warning when 1 minute left
                if (remaining === 60) {
                    showToast('1 minute remaining!', 'error');
                }
                
                // Warning when 30 seconds left
                if (remaining === 30) {
                    showToast('30 seconds remaining!', 'error');
                }
            }, 1000);
        }

        // Per-question timer system
        function startPerQuestionTimer() {
            clearPerQuestionTimer();
            currentQuestionStartTime = Date.now();
            
            const timerDisplay = document.getElementById('timerDisplay');
            if (!timerDisplay) return;
            
            timerDisplay.style.color = '#22C55E';
            timerDisplay.textContent = `Q-Time: ${timePerQuestion}s`;
            
            perQuestionTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - currentQuestionStartTime) / 1000);
                const remaining = timePerQuestion - elapsed;
                
                if (remaining <= 0) {
                    clearPerQuestionTimer();
                    showToast('Time for this question is up! Moving to next.', 'warning');
                    // Auto-select nothing and move to next page
                    nextPage();
                    return;
                }
                
                timerDisplay.textContent = `Q-Time: ${remaining}s`;
                
                // Warning at 25% time left
                if (remaining === Math.floor(timePerQuestion * 0.25)) {
                    timerDisplay.style.color = '#f59e0b';
                }
                
                // Warning at 10% time left
                if (remaining === Math.floor(timePerQuestion * 0.1)) {
                    timerDisplay.style.color = '#ef4444';
                }
            }, 1000);
        }

        function clearPerQuestionTimer() {
            if (perQuestionTimer) {
                clearInterval(perQuestionTimer);
                perQuestionTimer = null;
            }
        }

        // Track time taken for badge system
        function getTimeTaken() {
            const startTime = sessionStorage.getItem('examStartTime');
            if (!startTime) return null;
            return Math.floor((Date.now() - parseInt(startTime)) / 1000);
        }

        async function submitQuiz() {
            // Calculate score
            let score = 0;
            const answers = [];
            
            quizData.forEach((question, index) => {
                const selectedOption = selectedAnswers[index];
                answers.push(selectedOption);
                
                if (selectedOption === parseInt(question.correctAnswer)) {
                    score++;
                }
            });

            const userId = localStorage.getItem('userId');
            const percentage = quizData.length > 0 ? (score / quizData.length) * 100 : 0;
            const timeTaken = getTimeTaken();

            try {
                const response = await fetch(`${API_BASE_URL}/scores`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        topic,
                        category,
                        score,
                        totalQuestions: quizData.length,
                        percentage,
                        answers: answers,
                        timeTaken: timeTaken,
                        examMode: sessionStorage.getItem('examMode') || 'none'
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    window.location.href = `results.html?scoreId=${data._id}&score=${data.score}&total=${data.totalQuestions}&percentage=${data.percentage.toFixed(2)}&topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`;
                } else {
                    alert('Failed to submit quiz');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred while submitting the quiz');
            }
        }
    
