
        // Ensure API_BASE_URL is defined
        if (typeof API_BASE_URL === 'undefined') {
            window.API_BASE_URL = window.location.origin + '/api';
        }
        
        // Store original fetch
        const adminOriginalFetch = window.fetch;
        
        // Ensure credentials are included
        window.fetch = function(url, options) {
            options = options || {};
            options.credentials = 'include';
            return adminOriginalFetch(url, options);
        };

        // SECURITY: Escape HTML to prevent XSS
        function escapeHtml(text) {
            if (typeof text !== 'string') return text;
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        let allMCQs = [];
        let siteStructure = {};
        let subjectIdMap = {};
        let editingId = null;
        let editingSubjectId = null;
        let currentUserPage = 1;

        window.addEventListener('DOMContentLoaded', async () => {
            // Pre-flight check: Ensure app.js loaded correctly
            if (typeof API_BASE_URL === 'undefined') {
                alert('CRITICAL ERROR: app.js failed to load. The admin panel will not work.\n\nPlease press F12 to open the developer console and check for errors in red.');
                document.getElementById('adminPanel').innerHTML = '<h2 style="color: red; text-align: center; padding: 40px;">Admin Panel failed to load. Check console for errors (F12).</h2>';
                document.getElementById('adminPanel').style.display = 'block';
                return;
            }

            // Verify authentication server-side via JWT cookie
            let authUser;
            try {
                const authRes = await fetch(API_BASE_URL + '/auth/check', { credentials: 'include' });
                if (!authRes.ok) {
                    alert('Access Denied: Please log in first.');
                    window.location.href = 'login.html';
                    return;
                }
                authUser = await authRes.json();
                if (!authUser.isAdmin) {
                    alert('Access Denied: Admin access required.');
                    window.location.href = 'index.html';
                    return;
                }
                localStorage.setItem('userId', authUser.userId);
                localStorage.setItem('username', authUser.username);
                localStorage.setItem('email', authUser.email);
                localStorage.setItem('isAdmin', String(authUser.isAdmin));
            } catch (e) {
                alert('Could not verify session. Please log in again.');
                window.location.href = 'login.html';
                return;
            }

            // Only show the panel if the user is an Admin
            document.getElementById('adminPanel').style.display = 'block';

            // Load site structure first so categories/topics are available
            await loadSiteStructure();

            loadMCQs();
            loadStats();
            loadCategories();
            loadSubjects();
            loadNavItems();
            loadUsers();
            loadMessages();

            document.getElementById('searchMCQ').addEventListener('keyup', applyFilters);
            document.getElementById('filterCategory').addEventListener('change', loadTopicsForFilter);
            document.getElementById('filterTopic').addEventListener('change', applyFilters);
            document.getElementById('userSearchInput').addEventListener('keyup', () => loadUsers(1));
        });

        function switchTab(e, tabName) {
            // Hide all tabs
            const tabs = document.querySelectorAll('.tab-content');
            tabs.forEach(tab => tab.classList.remove('active'));

            // Remove active class from all buttons
            const buttons = document.querySelectorAll('.tab-btn');
            buttons.forEach(btn => btn.classList.remove('active'));

            // Show selected tab
            const targetTab = document.getElementById(tabName);
            if (!targetTab) {
                console.error('Tab not found:', tabName);
                return;
            }
            targetTab.classList.add('active');

            // Add active class to clicked button
            if (e && e.target) {
                const btn = e.target.closest('.tab-btn');
                if (btn) btn.classList.add('active');
            }

            // Load PDFs when switching to manage-pdfs tab
            if (tabName === 'manage-pdfs') {
                loadPdfs();
            }
        }

        async function loadStats() {
            try {
                const response = await fetch(`${API_BASE_URL}/mcqs-category/all`);
                const mcqs = await response.json();
                
                const statsHtml = `
                    <div class="stat-card">
                        <h3>${mcqs.length || 0}</h3>
                        <p>Total Questions</p>
                    </div>
                    <div class="stat-card">
                        <h3>${new Set(mcqs.map(m => m.category)).size || 0}</h3>
                        <p>Categories</p>
                    </div>
                    <div class="stat-card">
                        <h3>${new Set(mcqs.map(m => m.topic)).size || 0}</h3>
                        <p>Topics</p>
                    </div>
                `;
                document.getElementById('statsGrid').innerHTML = statsHtml;
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }

        async function loadMCQs() {
            const mcqList = document.getElementById('mcqList');
            if (!mcqList) return;
            
            mcqList.innerHTML = '<p style="text-align: center; color: #999;">Loading questions...</p>';
            try {
                const response = await fetch(`${API_BASE_URL}/mcqs/all`);
                if (!response.ok) throw new Error('Failed to fetch MCQs');
                const data = await response.json();
                
                if (!Array.isArray(data)) {
                    throw new Error('Invalid data format');
                }
                
                allMCQs = data;
                displayMCQs(allMCQs);
            } catch (error) {
                console.error('Error loading MCQs:', error);
                mcqList.innerHTML = '<li style="color: red;">Error loading questions</li>';
            }
        }

        function displayMCQs(mcqs) {
            const mcqList = document.getElementById('mcqList');
            
            if (mcqs.length === 0) {
                mcqList.innerHTML = '<li style="text-align: center; color: #999; padding: 20px;">No questions found</li>';
                return;
            }

            mcqList.innerHTML = mcqs.map(mcq => `
                <li class="mcq-item">
                    <h4>${escapeHtml(mcq.question)}</h4>
                    <p><strong>Category:</strong> ${escapeHtml(mcq.category)}</p>
                    <p><strong>Topic:</strong> ${escapeHtml(mcq.topic)}</p>
                    <p><strong>Difficulty:</strong> <span style="color: ${mcq.difficulty === 'easy' ? '#21cc12' : mcq.difficulty === 'medium' ? '#ff9800' : '#ff6b6b'}">${escapeHtml(mcq.difficulty)}</span></p>
                    <p><strong>Options:</strong> ${mcq.options.length}</p>
                    <div class="mcq-item-actions">
                        <button class="edit-btn" data-onclick="editMCQ" data-args="['${mcq._id}']" title="Edit"><i class="fa-solid fa-edit"></i> Edit</button>
                        <button class="delete-btn" data-onclick="confirmDeleteMCQ" data-args="['${mcq._id}']" title="Delete"><i class="fa-solid fa-trash"></i> Delete</button>
                    </div>
                </li>
            `).join('');
        }

        function applyFilters() {
            const searchTerm = document.getElementById('searchMCQ').value.toLowerCase();
            const categoryFilter = document.getElementById('filterCategory').value;
            const topicFilter = document.getElementById('filterTopic').value;

            const filtered = allMCQs.filter(mcq => {
                const searchMatch = mcq.question.toLowerCase().includes(searchTerm) ||
                                    mcq.category.toLowerCase().includes(searchTerm) ||
                                    mcq.topic.toLowerCase().includes(searchTerm);
                
                const categoryMatch = !categoryFilter || mcq.category === categoryFilter;
                const topicMatch = !topicFilter || mcq.topic === topicFilter;

                return searchMatch && categoryMatch && topicMatch;
            });
            displayMCQs(filtered);
        }

        function addOption() {
            const container = document.getElementById('optionsContainer');
            const optionNum = container.children.length + 1;
            const html = `
                <div class="option-item">
                    <input type="text" id="option${optionNum}" name="option" class="option-input" placeholder="Option ${optionNum}" required>
                    <button type="button" data-onclick="removeOption" data-args="[this]">Remove</button>
                </div>
            `;
            const div = document.createElement('div');
            div.innerHTML = html;
            container.appendChild(div.firstElementChild);
        }

        function removeOption(btn) {
            const container = document.getElementById('optionsContainer');
            if (container.children.length > 2) {
                btn.parentElement.remove();
            } else {
                alert('You must have at least 2 options');
            }
        }

        window.submitMCQ = async function(e) {
            if (e && e.preventDefault) e.preventDefault();

            const submitBtn = document.getElementById('submitMCQBtn');

            const options = Array.from(document.querySelectorAll('#optionsContainer .option-input'))
                .map(input => input.value.trim())
                .filter(val => val !== '');

            if (options.length < 2) {
                showError('Please provide at least 2 options.');
                return;
            }

            const correctAnswerRaw = document.getElementById('correctAnswer').value.trim();
            const correctAnswer = parseInt(correctAnswerRaw);
            if (correctAnswerRaw === '' || isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
                showError(`Correct answer must be between 0 and ${options.length - 1}.`);
                return;
            }

            const category = document.getElementById('category').value;
            if (!category) {
                showError('Please select a category.');
                return;
            }

            let topicValue = document.getElementById('topic').value;
            let isNewTopic = false;
            if (topicValue === '__NEW__') {
                topicValue = document.getElementById('newTopicInput').value.trim();
                isNewTopic = true;
            }
            if (!topicValue) {
                showError('Please select or enter a topic.');
                return;
            }

            if (isNewTopic && topicValue) {
                const subjectId = subjectIdMap[category];
                if (subjectId) {
                    try {
                        await fetch(`${API_BASE_URL}/subjects/${subjectId}/topics`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: topicValue })
                        });
                    } catch (err) {
                        console.error('Error adding topic:', err);
                    }
                }
            }

            const mcqData = {
                category,
                topic: topicValue,
                question: document.getElementById('question').value.trim(),
                options,
                correctAnswer,
                explanation: document.getElementById('explanation').value.trim(),
                difficulty: document.getElementById('difficulty').value
            };

            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Adding...'; }

            const userId = localStorage.getItem('userId');
            if (!userId) {
                alert('ERROR: Not logged in!');
                window.location.href = 'login.html';
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/mcqs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mcqData)
                });

                if (response.ok) {
                    showSuccess('MCQ added successfully!');
                    document.getElementById('addMCQForm').reset();
                    loadCategories();
                    loadMCQs();
                    loadStats();
                } else {
                    const err = await response.json().catch(() => ({}));
                    showError('Failed: ' + (err.message || `Error ${response.status}`));
                }
            } catch (error) {
                showError('Network error: ' + error.message);
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add MCQ'; }
            }
        }

        async function confirmDeleteMCQ(id) {
            if (!confirm('Are you sure you want to delete this question?')) return;

            try {
                const response = await fetch(`${API_BASE_URL}/mcqs/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    showSuccess('Question deleted successfully!');
                    loadMCQs();
                    loadStats();
                } else {
                    showError('Failed to delete question');
                }
            } catch (error) {
                showError('Error: ' + error.message);
            }
        }

        function editMCQ(id) {
            alert('Edit feature coming soon! MCQ ID: ' + id);
        }

        async function seedData() {
            // Removed for security - the /api/seed endpoint has been disabled
            // Use the MCQ addition form to add data manually instead
            alert('❌ Seed endpoint has been removed for security.\n\nTo add MCQs:\n1. Go to "MCQ Management" tab\n2. Fill the form and click "Add MCQ"\n3. Or import from CSV');
        }

        function showSuccess(message) {
            const div = document.getElementById('successMessage');
            div.textContent = message;
            div.style.display = 'block';
            setTimeout(() => div.style.display = 'none', 5000);
        }

        function showError(message) {
            const div = document.getElementById('errorMessage');
            div.textContent = message;
            div.style.display = 'block';
            setTimeout(() => div.style.display = 'none', 5000);
        }

        async function loadSiteStructure() {
            try {
                const response = await fetch(`${API_BASE_URL}/subjects`);
                if (!response.ok) throw new Error('Failed to fetch subjects');
                const subjects = await response.json();

                const structure = {};
                subjectIdMap = {};
                subjects.forEach(subject => {
                    structure[subject.name] = subject.topics ? subject.topics.map(t => t.name) : [];
                    subjectIdMap[subject.name] = subject._id;
                });

                siteStructure = structure;
            } catch (error) {
                console.error('Error loading site structure:', error);
            }
        }

        async function loadCategories() {
            const categorySelect = document.getElementById('category');
            const filterCategorySelect = document.getElementById('filterCategory');

            categorySelect.innerHTML = '<option value="">Loading...</option>';
            filterCategorySelect.innerHTML = '<option value="">Loading...</option>';

            if (Object.keys(siteStructure).length === 0) {
                await loadSiteStructure();
            }

            categorySelect.innerHTML = '<option value="">Select Category</option>';
            filterCategorySelect.innerHTML = '<option value="">All Categories</option>';

            const categories = Object.keys(siteStructure).sort();

            if (categories.length === 0) {
                const option = new Option('No categories found — add a Subject first', '');
                option.disabled = true;
                categorySelect.add(option);
                return;
            }

            categories.forEach(category => {
                categorySelect.add(new Option(category, category));
                filterCategorySelect.add(new Option(category, category));
            });

            // Refresh topics if a category is already selected
            if (categorySelect.value) loadTopics();
        }

        function loadTopics() {
            const category = document.getElementById('category').value;
            const topicSelect = document.getElementById('topic');
            
            // Reset select but keep the "Add New" option
            topicSelect.innerHTML = '<option value="">Select Topic</option><option value="__NEW__" style="font-weight: bold; color: #667eea;">+ Add New Topic</option>';
            
            // Hide new topic input
            document.getElementById('newTopicInput').style.display = 'none';

            if (!category || !siteStructure[category]) return;

            const topics = siteStructure[category].sort();
            topics.forEach(topic => {
                const option = document.createElement('option');
                option.value = topic;
                option.textContent = topic;
                topicSelect.insertBefore(option, topicSelect.lastElementChild);
            });
        }

        function loadTopicsForFilter() {
            const category = document.getElementById('filterCategory').value;
            const topicSelect = document.getElementById('filterTopic');
            topicSelect.innerHTML = '<option value="">All Topics</option>';

            if (!category || !siteStructure[category]) return;

            const topics = siteStructure[category].sort();
            topics.forEach(topic => {
                topicSelect.add(new Option(topic, topic));
            });
            
            applyFilters();
        }

        function checkNewTopic(select) {
            const input = document.getElementById('newTopicInput');
            const label = document.querySelector('label[for="newTopicInput"]');
            if (select.value === '__NEW__') {
                input.style.display = 'block';
                if (label) label.style.display = 'block';
                input.required = true;
                input.focus();
            } else {
                input.style.display = 'none';
                if (label) label.style.display = 'none';
                input.required = false;
            }
        }

        function updateFileName() {
            const input = document.getElementById('csvFileInput');
            const span = document.getElementById('fileName');
            if (input.files.length > 0) {
                span.textContent = input.files[0].name;
            } else {
                span.textContent = 'No file selected';
            }
        }

        function downloadTemplate() {
            const headers = ['Category', 'Topic', 'Question', 'Option1', 'Option2', 'Option3', 'Option4', 'CorrectAnswerIndex', 'Difficulty', 'Explanation'];
            const sample = ['General Knowledge', 'Science', 'What is H2O?', 'Water', 'Gold', 'Silver', 'Iron', '0', 'easy', 'H2O is the chemical formula for water.'];
            const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + sample.join(",");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "mcq_template.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function triggerCsvUpload() {
            document.getElementById('csvFileInput').click();
        }

        function uploadBulkMCQs() {
            const input = document.getElementById('csvFileInput');
            if (input.files.length === 0) {
                showError('Please select a CSV file first.');
                return;
            }

            const file = input.files[0];
            
            // Reset UI
            document.getElementById('bulkProgress').style.display = 'block';
            document.getElementById('processedCount').textContent = '0';
            document.getElementById('totalCount').textContent = '...';
            document.getElementById('bulkProgressBar').style.width = '0%';
            const log = document.getElementById('bulkLog');
            log.innerHTML = '';

            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async function(results) {
                    const data = results.data;
                    const total = data.length;
                    document.getElementById('totalCount').textContent = total;
                    
                    let successCount = 0;
                    let failCount = 0;

                    for (let i = 0; i < total; i++) {
                        const row = data[i];
                        try {
                            // Validate and format
                            if (!row.Question || !row.Option1 || !row.Option2) {
                                throw new Error('Missing required fields');
                            }

                            const options = [row.Option1, row.Option2];
                            if (row.Option3) options.push(row.Option3);
                            if (row.Option4) options.push(row.Option4);

                            const mcqData = {
                                category: row.Category || 'Uncategorized',
                                topic: row.Topic || 'General',
                                question: row.Question,
                                options: options,
                                correctAnswer: parseInt(row.CorrectAnswerIndex) || 0,
                                difficulty: row.Difficulty || 'medium',
                                explanation: row.Explanation || ''
                            };

                            // API Call
                            const response = await fetch(`${API_BASE_URL}/mcqs`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(mcqData)
                            });

                            if (!response.ok) throw new Error('API Error');
                            
                            successCount++;
                            log.innerHTML += `<div style="color: green;">✓ Row ${i+1}: Added "${row.Question.substring(0, 30)}..."</div>`;

                        } catch (err) {
                            failCount++;
                            log.innerHTML += `<div style="color: red;">✗ Row ${i+1}: ${err.message}</div>`;
                        }

                        // Update Progress
                        const percent = ((i + 1) / total) * 100;
                        document.getElementById('bulkProgressBar').style.width = `${percent}%`;
                        document.getElementById('processedCount').textContent = i + 1;
                    }

                    log.innerHTML += `<div style="font-weight: bold; margin-top: 10px;">Completed: ${successCount} successful, ${failCount} failed.</div>`;
                    
                    // Refresh lists
                    loadCategories();
                    loadMCQs();
                    loadStats();
                },
                error: function(err) {
                    showError('Error parsing CSV: ' + err.message);
                }
            });
        }

        // Add event listener for category change
        document.getElementById('category').addEventListener('change', loadTopics);

        function goBack() {
            window.location.href = 'index.html';
        }

        async function loadSubjects() {
            const container = document.getElementById('subjectsListContainer');
            if (!container) return;
            container.innerHTML = '<p style="text-align: center; color: #999;">Loading subjects...</p>';
            try {
                const response = await fetch(`${API_BASE_URL}/subjects`);
                if (!response.ok) throw new Error('Failed to fetch subjects');
                const subjects = await response.json();

                if (!subjects || subjects.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #999;">No subjects found. Add one above.</p>';
                    return;
                }

                container.innerHTML = subjects.map(subject => `
                    <div class="subject-item">
                        <div class="subject-header">
                            <div>
                                <strong style="font-size: 1.1em;">${escapeHtml(subject.name)}</strong>
                                <div style="font-size: 0.9em; color: #666;">${escapeHtml(subject.description || '')}</div>
                            </div>
                            <div>
                                <button data-onclick="editSubject" data-args="['${subject._id}']" class="edit-btn" style="padding: 5px 10px; font-size: 12px; margin-right: 5px;">Edit</button>
                                <button data-onclick="deleteSubject" data-args="['${subject._id}']" class="delete-btn" style="padding: 5px 10px; font-size: 12px;">Delete</button>
                            </div>
                        </div>
                        <div class="topic-list">
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <input type="text" id="topic-input-${subject._id}" placeholder="New Topic Name" style="padding: 5px; border: 1px solid #ddd; border-radius: 4px; flex: 1;">
                                <button data-onclick="addTopic" data-args="['${subject._id}']" class="btn-secondary" style="padding: 5px 10px; font-size: 12px;">Add Topic</button>
                            </div>
                            ${subject.topics && subject.topics.length > 0 ? subject.topics.map(topic => `
                                <div class="topic-item" id="topic-item-${topic._id || topic.name}">
                                    <span class="topic-name">${escapeHtml(topic.name)}</span>
                                    <div>
                                        <button data-onclick="enableEditTopic" data-args="['${subject._id}', '${topic._id || topic.name}']" style="color: #4ecdc4; background: none; border: none; cursor: pointer; margin-right: 5px;"><i class="fa-solid fa-pen"></i></button>
                                        <button data-onclick="deleteTopic" data-args="['${subject._id}', '${topic._id || topic.name}']" style="color: #ff6b6b; background: none; border: none; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            `).join('') : '<div style="color: #999; font-size: 0.9em; font-style: italic;">No topics yet</div>'}
                        </div>
                    </div>
                `).join('');
            } catch (error) {
                console.error('Error loading subjects:', error);
                container.innerHTML = `<p style="text-align: center; color: red;">Could not load subjects: ${error.message}</p>`;
            }
        }

        async function addSubject() {
            const name = document.getElementById('newSubjectName').value;
            const description = document.getElementById('newSubjectDesc').value;
            if (!name) return alert('Subject name is required');

            const url = editingSubjectId ? `${API_BASE_URL}/subjects/${editingSubjectId}` : `${API_BASE_URL}/subjects`;
            const method = editingSubjectId ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description })
                });
                if (response.ok) {
                    showSuccess(editingSubjectId ? 'Subject updated successfully' : 'Subject added successfully');
                    resetSubjectForm();
                    loadSubjects();
                } else {
                    showError(editingSubjectId ? 'Failed to update subject' : 'Failed to add subject');
                }
            } catch (e) { showError(e.message); }
        }

        async function editSubject(id) {
            try {
                const response = await fetch(`${API_BASE_URL}/subjects/${id}`);
                if (!response.ok) throw new Error('Subject not found');
                const subject = await response.json();

                document.getElementById('newSubjectName').value = subject.name;
                document.getElementById('newSubjectDesc').value = subject.description || '';
                editingSubjectId = id;

                const addButton = document.querySelector('#manage-subjects button[data-onclick="addSubject"]');
                if (addButton) {
                    addButton.innerHTML = '<i class="fa-solid fa-save"></i> Update Subject';
                }

                if (!document.getElementById('cancelSubjectEditBtn')) {
                    const cancelBtn = document.createElement('button');
                    cancelBtn.id = 'cancelSubjectEditBtn';
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.className = 'btn-secondary';
                    cancelBtn.style.marginLeft = '10px';
                    cancelBtn.onclick = resetSubjectForm;
                    if (addButton && addButton.parentNode) {
                        addButton.parentNode.appendChild(cancelBtn);
                    }
                }

                document.getElementById('newSubjectName').focus();
                document.getElementById('manage-subjects').scrollIntoView({ behavior: 'smooth' });
            } catch (error) {
                showError('Failed to load subject for editing: ' + error.message);
            }
        }

        function resetSubjectForm() {
            document.getElementById('newSubjectName').value = '';
            document.getElementById('newSubjectDesc').value = '';
            editingSubjectId = null;

            const addButton = document.querySelector('#manage-subjects .btn-primary');
            addButton.innerHTML = '<i class="fa-solid fa-plus"></i> Add Subject';

            const cancelBtn = document.getElementById('cancelSubjectEditBtn');
            if (cancelBtn) cancelBtn.remove();
        }

        async function deleteSubject(id) {
            if (!confirm('Delete this subject and all its topics?')) return;
            try {
                await fetch(`${API_BASE_URL}/subjects/${id}`, { method: 'DELETE' });
                loadSubjects();
            } catch (e) { showError(e.message); }
        }

        async function addTopic(subjectId) {
            const input = document.getElementById(`topic-input-${subjectId}`);
            const name = input.value;
            if (!name) return;

            try {
                await fetch(`${API_BASE_URL}/subjects/${subjectId}/topics`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                input.value = '';
                loadSubjects();
            } catch (e) { showError(e.message); }
        }

        async function deleteTopic(subjectId, topicId) {
            if (!confirm('Delete this topic?')) return;
            try {
                await fetch(`${API_BASE_URL}/subjects/${subjectId}/topics/${topicId}`, { method: 'DELETE' });
                loadSubjects();
            } catch (e) { showError(e.message); }
        }

        function enableEditTopic(subjectId, topicId) {
            const item = document.getElementById(`topic-item-${topicId}`);
            const currentName = item.querySelector('.topic-name').textContent;
            
            item.innerHTML = `
                <input type="text" id="edit-topic-input-${topicId}" value="${currentName}" style="padding: 5px; border: 1px solid #ddd; border-radius: 4px; flex: 1;">
                <div>
                    <button data-onclick="saveEditTopic" data-args="['${subjectId}', '${topicId}']" style="color: #21cc12; background: none; border: none; cursor: pointer; margin-right: 5px;"><i class="fa-solid fa-check"></i></button>
                    <button data-onclick="loadSubjects" style="color: #ff6b6b; background: none; border: none; cursor: pointer;"><i class="fa-solid fa-times"></i></button>
                </div>
            `;
            setTimeout(() => document.getElementById(`edit-topic-input-${topicId}`).focus(), 0);
        }

        async function saveEditTopic(subjectId, topicId) {
            const input = document.getElementById(`edit-topic-input-${topicId}`);
            const name = input.value;
            if (!name) return;

            try {
                const response = await fetch(`${API_BASE_URL}/subjects/${subjectId}/topics/${topicId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                
                if (response.ok) {
                    loadSubjects();
                } else {
                    const data = await response.json();
                    showError(data.message || 'Failed to update topic');
                }
            } catch (e) { showError(e.message); }
        }

        // --- NAVIGATION MANAGEMENT FUNCTIONS ---

        async function loadNavItems() {
            const container = document.getElementById('navItemsListContainer');
            container.innerHTML = '<p style="text-align: center; color: #999;">Loading navigation items...</p>';
            try {
                const response = await fetch(`${API_BASE_URL}/navitems`);
                if (!response.ok) throw new Error('Failed to fetch');
                const items = await response.json();

                if (!items || items.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #999;">No navigation links found. Add one above.</p>';
                    return;
                }

                container.innerHTML = items.map(item => `
                    <div class="subject-item">
                        <div class="subject-header">
                            <div>
                                <strong style="font-size: 1.1em;"><i class="${item.icon}"></i> ${item.name}</strong>
                                <div style="font-size: 0.9em; color: #666;">Path: ${item.path}</div>
                            </div>
                            <div>
                                <button data-onclick="editNavItem" data-args="['${item._id}', '${item.name}', '${item.icon}', '${item.path}', 0]" class="edit-btn" style="padding: 5px 10px; font-size: 12px; margin-right: 5px;">Edit</button>
                                <button data-onclick="deleteNavItem" data-args="['${item._id}']" class="delete-btn" style="padding: 5px 10px; font-size: 12px;">Delete</button>
                            </div>
                        </div>
                    </div>
                `).join('');
            } catch (error) {
                console.error('Error loading nav items:', error);
                container.innerHTML = '<p style="text-align: center; color: red;">Could not load navigation links.</p>';
            }
        }

        function resetNavForm() {
            document.getElementById('navItemId').value = '';
            document.getElementById('navItemText').value = '';
            document.getElementById('navItemIcon').value = '';
            document.getElementById('navItemLink').value = '';
            document.getElementById('navItemOrder').value = '';
            document.getElementById('saveNavItemBtn').innerHTML = '<i class="fa-solid fa-plus"></i> Add Link';
            document.getElementById('cancelNavEditBtn').style.display = 'none';
        }

        function editNavItem(id, text, icon, link, order) {
            document.getElementById('navItemId').value = id;
            document.getElementById('navItemText').value = text;
            document.getElementById('navItemIcon').value = icon;
            document.getElementById('navItemLink').value = link;
            document.getElementById('navItemOrder').value = order;
            document.getElementById('saveNavItemBtn').innerHTML = '<i class="fa-solid fa-save"></i> Update Link';
            document.getElementById('cancelNavEditBtn').style.display = 'inline-block';
            document.getElementById('manage-nav').scrollIntoView({ behavior: 'smooth' });
        }

        async function saveNavItem() {
            const id = document.getElementById('navItemId').value;
            const data = {
                text: document.getElementById('navItemText').value,
                icon: document.getElementById('navItemIcon').value,
                link: document.getElementById('navItemLink').value,
                order: Number(document.getElementById('navItemOrder').value) || 0
            };
            if (!data.text || !data.icon || !data.link) return showError('Text, Icon, and Link are required.');
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_BASE_URL}/navitems/${id}` : `${API_BASE_URL}/navitems`;
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (response.ok) { showSuccess(`Link ${id ? 'updated' : 'added'}.`); resetNavForm(); loadNavItems(); } else { showError(`Failed to ${id ? 'update' : 'add'} link.`); }
        }

        async function deleteNavItem(id) {
            if (!confirm('Delete this navigation link?')) return;
            const response = await fetch(`${API_BASE_URL}/navitems/${id}`, { method: 'DELETE' });
            if (response.ok) { showSuccess('Link deleted.'); loadNavItems(); } else { showError('Failed to delete link.'); }
        }

        // --- USER MANAGEMENT FUNCTIONS ---

        async function loadUsers(page = 1) {
            const tbody = document.getElementById('usersListBody');
            const search = document.getElementById('userSearchInput').value;
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Loading...</td></tr>';

            try {
                const response = await fetch(`${API_BASE_URL}/users?page=${page}&limit=10&search=${encodeURIComponent(search)}`);
                if (!response.ok) throw new Error('Failed to fetch users');
                const data = await response.json();
                const users = data.users;
                currentUserPage = data.currentPage;

                if (users.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">No users found</td></tr>';
                    return;
                }

                tbody.innerHTML = users.map(user => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px;">${user.username}</td>
                        <td style="padding: 12px;">${user.email}</td>
                        <td style="padding: 12px;">
                            <span style="background: ${user.isAdmin ? '#d4edda' : '#e2e3e5'}; color: ${user.isAdmin ? '#155724' : '#383d41'}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                ${user.isAdmin ? 'Admin' : 'User'}
                            </span>
                        </td>
                        <td style="padding: 12px;">${new Date(user.createdAt).toLocaleDateString()}</td>
                        <td style="padding: 12px;">
                            ${!user.isAdmin ? `<button data-onclick="promoteUser" data-args="['${user.email}']" class="btn-secondary" style="padding: 5px 10px; font-size: 12px;">Promote</button>` : ''}
                        </td>
                    </tr>
                `).join('');

                updateUserPagination(data.currentPage, data.totalPages);
            } catch (error) {
                console.error('Error loading users:', error);
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red; padding: 20px;">Error loading users</td></tr>';
            }
        }

        function updateUserPagination(current, total) {
            document.getElementById('userPageInfo').textContent = `Page ${current} of ${total}`;
            document.getElementById('prevUserPage').disabled = current <= 1;
            document.getElementById('prevUserPage').onclick = () => loadUsers(current - 1);
            document.getElementById('nextUserPage').disabled = current >= total;
            document.getElementById('nextUserPage').onclick = () => loadUsers(current + 1);
        }

        async function promoteUser(email) {
            if(!confirm(`Are you sure you want to promote ${email} to Admin?`)) return;
            try {
                const response = await fetch(`${API_BASE_URL}/users/promote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                if(response.ok) {
                    showSuccess('User promoted successfully');
                    loadUsers(currentUserPage);
                } else {
                    showError('Failed to promote user');
                }
            } catch(e) {
                showError(e.message);
            }
        }

        // --- MESSAGE FUNCTIONS ---
        async function loadMessages() {
            const container = document.getElementById('messagesContainer');
            try {
                const response = await fetch(`${API_BASE_URL}/contact`);
                const messages = await response.json();

                updateBadgeCount(messages);
                
                if (messages.length === 0) {
                    container.innerHTML = '<p style="text-align:center; color:#999;">No messages found.</p>';
                    return;
                }

                container.innerHTML = messages.map(msg => `
                    <div style="background:${msg.read ? '#f9f9f9' : '#eef2ff'}; border:1px solid ${msg.read ? '#eee' : '#c7d2fe'}; border-left: 4px solid ${msg.read ? 'transparent' : '#667eea'}; padding:15px; margin-bottom:10px; border-radius:5px; display: flex; gap: 15px;">
                        <div style="display: flex; align-items: flex-start; padding-top: 5px;">
                            <input type="checkbox" class="message-checkbox" name="messageIds" value="${msg._id}" style="width: 18px; height: 18px; cursor: pointer;">
                        </div>
                        <div style="flex: 1;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <strong>${escapeHtml(msg.name)} <span style="color:#666; font-weight:normal;">(${escapeHtml(msg.email)})</span></strong>
                                <small style="color:#999;">${new Date(msg.date).toLocaleString()}</small>
                            </div>
                            <p style="margin:10px 0; color:#333;">${escapeHtml(msg.message)}</p>
                            <div style="display:flex; gap:10px;">
                                ${!msg.read ? `<button data-onclick="markAsRead" data-args="['${msg._id}']" class="btn-secondary" style="padding:5px 10px; font-size:12px; background:#fff; border:1px solid #ccc;">Mark as Read</button>` : ''}
                                <a href="mailto:${escapeHtml(msg.email)}?subject=Re: Inquiry via mcqlala&body=Hi ${encodeURIComponent(msg.name)},%0D%0A%0D%0ARegarding your message:%0D%0A%22${encodeURIComponent(msg.message)}%22%0D%0A%0D%0A" class="btn-secondary" style="padding:5px 10px; font-size:12px; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; background:#667eea; color:white; border:none;"><i class="fa-solid fa-reply" style="margin-right:5px;"></i> Reply</a>
                                <button data-onclick="deleteMessage" data-args="['${msg._id}']" class="delete-btn" style="padding:5px 10px; font-size:12px;">Delete</button>
                            </div>
                        </div>
                    </div>
                `).join('');
            } catch (e) { container.innerHTML = '<p style="color:red">Error loading messages</p>'; }
        }

        function updateBadgeCount(messages) {
            const unread = messages.filter(m => !m.read).length;
            const badge = document.getElementById('msgBadge');
            if (unread > 0) {
                badge.textContent = unread;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        async function markAsRead(id) {
            await fetch(`${API_BASE_URL}/contact/${id}/read`, { method: 'PUT' });
            loadMessages();
        }

        async function deleteMessage(id) {
            if(!confirm('Delete this message?')) return;
            await fetch(`${API_BASE_URL}/contact/${id}`, { method: 'DELETE' });
            loadMessages();
        }

        function toggleSelectAllMessages(checkbox) {
            const checkboxes = document.querySelectorAll('.message-checkbox');
            checkboxes.forEach(cb => cb.checked = checkbox.checked);
        }

        async function deleteSelectedMessages() {
            const checkboxes = document.querySelectorAll('.message-checkbox:checked');
            const ids = Array.from(checkboxes).map(cb => cb.value);
            
            if (ids.length === 0) {
                alert('Please select messages to delete.');
                return;
            }

            if (!confirm(`Are you sure you want to delete ${ids.length} messages?`)) return;

            try {
                const response = await fetch(`${API_BASE_URL}/contact/bulk-delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids })
                });

                if (response.ok) {
                    showSuccess('Messages deleted successfully');
                    document.getElementById('selectAllMessages').checked = false;
                    loadMessages();
                } else {
                    showError('Failed to delete messages');
                }
            } catch (e) {
                showError(e.message);
            }
        }

        async function changeAdminPassword() {
            const newPassword = document.getElementById('newAdminPassword').value;
            if (!newPassword) return alert('Please enter a new password');
            
            const userId = localStorage.getItem('userId');
            
            try {
                const response = await fetch(`${API_BASE_URL}/users/change-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, newPassword })
                });
                
                const data = await response.json();
                if (response.ok) {
                    showSuccess('Password updated successfully');
                    document.getElementById('newAdminPassword').value = '';
                } else {
                    showError(data.message || 'Failed to update password');
                }
            } catch (e) {
                showError(e.message);
            }
        }

        async function loadPdfs() {
            try {
                const response = await fetch(`${API_BASE_URL}/pdfs?t=${Date.now()}`);
                const pdfs = await response.json();
                const container = document.getElementById('pdfsList');
                if (pdfs.length === 0) {
                    container.innerHTML = '<p style="color: #999;">No PDFs uploaded yet</p>';
                    return;
                }
                container.innerHTML = pdfs.map(pdf => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 10px; background: #fff;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="fa-solid fa-file-pdf" style="color: #e74c3c; font-size: 24px;"></i>
                            <div>
                                <a href="${pdf.url}" target="_blank" style="color: #333; font-weight: 500; text-decoration: none;">${pdf.name}</a>
                                <p style="color: #666; font-size: 12px; margin: 0;">${new Date(pdf.uploadedAt).toLocaleString()}</p>
                            </div>
                        </div>
                        <button data-onclick="deletePdf" data-args="['${pdf._id}']" class="delete-btn" style="padding: 6px 12px;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `).join('');
            } catch (e) {
                document.getElementById('pdfsList').innerHTML = '<p style="color: red;">Failed to load PDFs</p>';
            }
        }

        async function deletePdf(id) {
            if (!confirm('Delete this PDF?')) return;
            try {
                const response = await fetch(`${API_BASE_URL}/pdfs/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    showSuccess('PDF deleted');
                    loadPdfs();
                } else {
                    showError('Failed to delete');
                }
            } catch (e) {
                showError(e.message);
            }
        }

        // PDF Upload Function
        window.uploadPdf = async function() {
            const fileInput = document.getElementById('pdfFile');
            const file = fileInput.files[0];
            
            if (!file) {
                showError('Please select a PDF file first');
                return;
            }

            if (file.type !== 'application/pdf') {
                showError('Only PDF files are allowed');
                return;
            }
            
            const formData = new FormData();
            formData.append('pdf', file);
            
            const submitBtn = document.querySelector('#uploadPdfForm .btn-primary');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Uploading...';
            }
            
            try {
                const response = await fetch(`${API_BASE_URL}/pdfs`, {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json().catch(() => ({ message: 'Invalid response' }));
                
                if (response.ok) {
                    showSuccess('PDF uploaded successfully');
                    fileInput.value = '';
                    loadPdfs();
                } else {
                    showError(result.message || 'Upload failed (Status: ' + response.status + ')');
                }
            } catch (e) {
                showError('Upload error: ' + e.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Upload PDF';
                }
            }
        };

        document.querySelector('button[data-args*="manage-pdfs"]')?.addEventListener('click', loadPdfs);
    
