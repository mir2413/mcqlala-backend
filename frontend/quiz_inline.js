
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
        let customQuizConfig = null;

        function escapeHtml(text) {
            if (typeof text !== 'string') return text || '';
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
        
        function shuffleArray(array) {
            const newArray = [...array];
            for (let i = newArray.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
            }
            return newArray;
        }
        
        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        window.addEventListener('DOMContentLoaded', async () => {
            const params = new URLSearchParams(window.location.search);
            
            // Check for custom quiz mode
            const isCustomQuiz = params.get('custom') === 'true';
            
            if (isCustomQuiz) {
                // Load custom quiz configuration from sessionStorage
                const configStr = sessionStorage.getItem('customQuizConfig');
                if (configStr) {
                    customQuizConfig = JSON.parse(configStr);
                    console.log('Custom quiz config loaded:', customQuizConfig);
                }
            }
            
            // Only set topic/category from URL if NOT a custom quiz
            if (!customQuizConfig || !customQuizConfig.isCustomQuiz) {
                topic = params.get('topic') || 'General Knowledge';
                category = params.get('category') || 'General';
            }
            
            // Get quiz settings from URL
            const mode = params.get('mode') || 'none';
            const limit = parseInt(params.get('limit') || '0');
            const timeQ = parseInt(params.get('timePerQ') || '0');
            
            if (limit > 0) totalQuestionLimit = limit;
            if (timeQ > 0) timePerQuestion = timeQ;
            
            // If custom quiz config exists, use it
            if (customQuizConfig && customQuizConfig.isCustomQuiz) {
                if (customQuizConfig.timePerQuestion) {
                    timePerQuestion = customQuizConfig.timePerQuestion;
                }
                if (customQuizConfig.totalTime > 0) {
                    sessionStorage.setItem('examMode', 'custom');
                    sessionStorage.setItem('examDuration', customQuizConfig.totalTime);
                    sessionStorage.setItem('examStartTime', Date.now().toString());
                }
            }

            // Only show exam timer for custom quizzes with time set
            const shouldShowTimer = customQuizConfig && customQuizConfig.isCustomQuiz && 
                                    customQuizConfig.totalTime > 0;

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
            
            if (isCustomQuiz && customQuizConfig) {
                document.getElementById('topicTitle').textContent = 'Custom Quiz';
            } else {
                document.getElementById('topicTitle').textContent = `${category} - ${topic}`;
            }
            
            // Show mode indicator
            const modeText = {
                'none': 'Practice Mode',
                'quick': 'Quick Test (5 min)',
                'standard': 'Standard Test (30 min)',
                'exam': 'Exam Simulation (60 min)',
                'custom': 'Custom Quiz'
            };
            if (mode !== 'none') {
                const topicTitle = document.getElementById('topicTitle');
                if (topicTitle) {
                    topicTitle.textContent += ` - ${modeText[mode] || mode}`;
                }
            }

            // Only initialize exam timer for custom quizzes with time set
            if (shouldShowTimer) {
                initializeExamTimer();
            }

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
            
            // Initialize CBT mode if custom quiz
            if (customQuizConfig && customQuizConfig.isCustomQuiz) {
                initializeCBTMode();
            }
        });

        // CBT Mode Functions
        let cbtCurrentIndex = 0;
        
        function initializeCBTMode() {
            const cbtNavigator = document.getElementById('cbtNavigator');
            const cbtControls = document.getElementById('cbtControls');
            const paginationControls = document.getElementById('paginationControls');
            
            if (cbtNavigator) cbtNavigator.style.display = 'block';
            if (cbtControls) cbtControls.style.display = 'flex';
            if (paginationControls) paginationControls.style.display = 'none';
            
            // Create question grid
            const grid = document.getElementById('cbtQuestionsGrid');
            if (grid && quizData.length > 0) {
                grid.innerHTML = '';
                for (let i = 0; i < quizData.length; i++) {
                    const btn = document.createElement('button');
                    btn.className = 'cbt-q-btn';
                    btn.textContent = i + 1;
                    btn.onclick = () => goToQuestion(i);
                    grid.appendChild(btn);
                }
            }
            
            // Attach CBT control buttons
            document.getElementById('cbtPrevBtn').onclick = cbtPrevQuestion;
            document.getElementById('cbtNextBtn').onclick = cbtNextQuestion;
            document.getElementById('cbtSubmitBtn').onclick = cbtSubmitQuiz;
            
            updateCBTUI();
        }
        
        function updateCBTUI() {
            if (!customQuizConfig || !customQuizConfig.isCustomQuiz) return;
            
            // Update question buttons
            const buttons = document.querySelectorAll('.cbt-q-btn');
            buttons.forEach((btn, index) => {
                btn.classList.remove('current', 'answered', 'not-answered');
                if (index === cbtCurrentIndex) {
                    btn.classList.add('current');
                } else if (selectedAnswers[index] !== undefined) {
                    btn.classList.add('answered');
                }
            });
            
            // Update page info
            document.getElementById('pageInfo').textContent = `Question ${cbtCurrentIndex + 1} of ${quizData.length}`;
            
            // Update answered count
            const answeredCount = Object.keys(selectedAnswers).length;
            document.getElementById('answeredCount').textContent = answeredCount;
            
            // Update navigation buttons
            document.getElementById('cbtPrevBtn').disabled = cbtCurrentIndex === 0;
            document.getElementById('cbtNextBtn').disabled = cbtCurrentIndex === quizData.length - 1;
        }
        
        function goToQuestion(index) {
            if (index >= 0 && index < quizData.length) {
                cbtCurrentIndex = index;
                displayPage();
                updateCBTUI();
                scrollToTop();
            }
        }
        
        function cbtPrevQuestion() {
            if (cbtCurrentIndex > 0) {
                goToQuestion(cbtCurrentIndex - 1);
            }
        }
        
        function cbtNextQuestion() {
            if (cbtCurrentIndex < quizData.length - 1) {
                goToQuestion(cbtCurrentIndex + 1);
            }
        }
        
        function cbtSubmitQuiz() {
            const unanswered = quizData.length - Object.keys(selectedAnswers).length;
            if (unanswered > 0) {
                if (!confirm(`You have ${unanswered} unanswered question(s). Are you sure you want to submit?`)) {
                    return;
                }
            }
            submitQuiz();
        }

        async function loadQuestions() {
            const questionsContainer = document.getElementById('questionsContainer');
            const paginationControls = document.getElementById('paginationControls');
            const quizActions = document.getElementById('quizActions');
            const loadingSpinner = document.getElementById('loadingSpinner');

            try {
                let questions = [];
                
                if (customQuizConfig && customQuizConfig.subjects && customQuizConfig.subjects.length > 0) {
                    // Custom quiz: load from multiple subjects/topics
                    for (const subject of customQuizConfig.subjects) {
                        if (subject.topics && subject.topics.length > 0) {
                            for (const topicConfig of subject.topics) {
                                try {
                                    const response = await fetch(`${API_BASE_URL}/mcqs?topic=${encodeURIComponent(topicConfig.name)}&category=${encodeURIComponent(subject.name)}`);
                                    if (response.ok) {
                                        const topicQuestions = await response.json();
                                        // Take only the requested count
                                        const selectedQuestions = topicQuestions.slice(0, topicConfig.count);
                                        selectedQuestions.forEach(q => {
                                            q._customTopic = topicConfig.name;
                                            q._customCategory = subject.name;
                                        });
                                        questions.push(...selectedQuestions);
                                    }
                                } catch (e) {
                                    console.error(`Error loading questions for ${topicConfig.name}:`, e);
                                }
                            }
                        }
                    }
                } else {
                    // Normal quiz: load from single topic
                    const response = await fetch(`${API_BASE_URL}/mcqs?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`);
                    if (!response.ok) throw new Error(`Server error: ${response.status}`);
                    questions = await response.json();
                }
                
                // Apply question limit if set (for non-custom quiz)
                if (totalQuestionLimit > 0 && totalQuestionLimit < questions.length && !customQuizConfig) {
                    questions = questions.slice(0, totalQuestionLimit);
                }
                
                // Shuffle questions for custom quiz
                if (customQuizConfig) {
                    questions = shuffleArray(questions);
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
            // For CBT mode, show single question
            if (customQuizConfig && customQuizConfig.isCustomQuiz) {
                displaySingleQuestion(cbtCurrentIndex);
                return;
            }
            
            // Normal mode with pagination
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

        function displaySingleQuestion(index) {
            const question = quizData[index];
            const userAnswer = selectedAnswers[index];
            
            const container = document.getElementById('questionsContainer');
            container.innerHTML = `
                <div class="quiz-question">
                    <div class="cbt-question-number">
                        <span class="quiz-question-number">Question ${index + 1}</span>
                    </div>
                    <h4>${escapeHtml(question.question)}</h4>
                    <div class="quiz-options">
                        ${question.options.map((option, optIndex) => {
                            let optionClass = 'quiz-option';
                            if (userAnswer !== undefined) {
                                if (optIndex === userAnswer) optionClass += ' selected';
                            }
                            return `
                                <div class="${optionClass}" onclick="cbtSelectOption(${index}, ${optIndex})">
                                    <span class="option-letter">${String.fromCharCode(65 + optIndex)}</span>
                                    <span class="option-text">${escapeHtml(option)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        
        window.cbtSelectOption = function(questionIndex, optionIndex) {
            selectedAnswers[questionIndex] = optionIndex;
            updateAnsweredCount();
            updateProgressText();
            
            // Update UI immediately
            const options = document.querySelectorAll('.quiz-option');
            options.forEach((opt, idx) => {
                opt.classList.remove('selected');
                if (idx === optionIndex) {
                    opt.classList.add('selected');
                }
            });
            
            updateCBTUI();
        };

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

            const percentage = quizData.length > 0 ? (score / quizData.length) * 100 : 0;
            
            // Save config for retake BEFORE clearing (use the in-memory variable)
            if (customQuizConfig && customQuizConfig.isCustomQuiz) {
                sessionStorage.setItem('lastQuizConfig', JSON.stringify(customQuizConfig));
            }
            
            // Clear session storage
            sessionStorage.removeItem('customQuizConfig');
            
            // Redirect to results page with score data (no database save)
            window.location.href = `results.html?score=${score}&total=${quizData.length}&percentage=${percentage.toFixed(2)}&topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`;
        }

        function goHome() {
            // Only show confirmation for custom quizzes (started from setup page)
            const isCustomQuiz = sessionStorage.getItem('customQuizConfig');
            
            if (isCustomQuiz && quizData.length > 0 && Object.keys(selectedAnswers).length > 0) {
                if (!confirm('You have unanswered or incomplete answers. Are you sure you want to leave?')) {
                    return;
                }
            }
            
            // Clear session storage (keep lastQuizConfig for retake)
            sessionStorage.removeItem('customQuizConfig');
            window.location.href = 'index.html';
        }

        // === Exam Timer System ===
        let timerInterval = null;
        
        function initializeExamTimer() {
            // Only show timer for custom quizzes (not URL mode parameter)
            const configStr = sessionStorage.getItem('customQuizConfig');
            if (!configStr) return;
            
            const config = JSON.parse(configStr);
            if (!config.isCustomQuiz || config.totalTime <= 0) return;
            
            sessionStorage.setItem('examMode', 'custom');
            sessionStorage.setItem('examDuration', config.totalTime);
            sessionStorage.setItem('examStartTime', Date.now().toString());
            
            const examTimer = document.getElementById('examTimer');
            const timerDisplay = document.getElementById('timerDisplay');
            
            if (examTimer && timerDisplay) {
                examTimer.style.display = 'flex';
            }
            
            timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - parseInt(sessionStorage.getItem('examStartTime'))) / 1000);
                const remaining = config.totalTime - elapsed;
                
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
    
