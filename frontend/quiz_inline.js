
        let quizData = [];
        let currentPage = 1;
        let questionsPerPage = 10;
        let selectedAnswers = {};
        let topic = '';
        let category = '';

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

            if (typeof loadNavLinks === 'function') {
                loadNavLinks();
            }

            const userId = localStorage.getItem('userId');
            const username = localStorage.getItem('username');

            document.getElementById('username').textContent = username || 'Guest';
            document.getElementById('topicTitle').textContent = `${category} - ${topic}`;

            await loadQuestions();
            if (quizData.length > 0) {
                displayPage();
                
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
                quizData = await response.json();
                document.getElementById('totalQuestions').textContent = quizData.length;
                
                if (quizData.length === 0) {
                    questionsContainer.innerHTML = '<p style="text-align: center; color: #999;">No questions available for this topic.</p>';
                    questionsContainer.style.display = 'block';
                    quizActions.style.display = 'flex';
                    document.getElementById('pageInfo').textContent = 'Page 0 of 0';
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
            const totalPages = Math.ceil(quizData.length / questionsPerPage);
            if (currentPage < totalPages && totalPages > 0) {
                currentPage++;
                displayPage();
                window.scrollTo(0, 0);
            }
        }

        function previousPage() {
            if (currentPage > 1) {
                currentPage--;
                displayPage();
                window.scrollTo(0, 0);
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
    
