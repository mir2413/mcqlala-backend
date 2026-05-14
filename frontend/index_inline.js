// Define API_BASE_URL if not already defined (app.js may define it)
if (typeof API_BASE_URL === 'undefined') {
    var API_BASE_URL = '/api';
}

window.addEventListener('DOMContentLoaded', async function() {
    // Load subjects
    await loadSubjectsAndRender();
    
    // Setup category change listener
    var categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
        categorySelect.addEventListener('change', loadTopicsForFilter);
    }
});

function escapeHtml(text) {
    if (typeof text !== 'string') return text || '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadSubjectsAndRender() {
    var grid = document.getElementById('cardGrid');
    if (!grid) return;
    
    try {
        var response = await fetch(API_BASE_URL + '/subjects');
        if (!response.ok) throw new Error('Failed to fetch subjects');
        var subjects = await response.json();
        cachedSubjects = subjects;

        if (subjects.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">No subjects available.</div>';
            return subjects;
        }

        var html = '';
        for (var i = 0; i < subjects.length; i++) {
            var subject = subjects[i];
            var topicCount = subject.topics && subject.topics.length > 0 ? subject.topics.length : 0;
            html += '<div class="card">';
            html += '<div class="card-info" data-href="subject.html?subject=' + encodeURIComponent(subject.name) + '" data-target="_blank">';
            html += '<div class="card-title">' + escapeHtml(subject.name) + '</div>';
            html += '<div class="card-meta">' + escapeHtml(subject.description || '') + ' <span style="color:#667eea; font-size:12px;">(' + topicCount + ' topics)</span></div>';
            html += '</div></div>';
        }
        grid.innerHTML = html;

        populateDropdowns(subjects);
        return subjects;
    } catch (error) {
        console.error('Error loading subjects:', error);
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Failed to load subjects. Please check API connection.</div>';
        return [];
    }
}

function populateDropdowns(subjects) {
    var categorySelect = document.getElementById('categorySelect');
    if (!categorySelect) return;
    
    var options = '<option value="">Select Category</option>';
    for (var i = 0; i < subjects.length; i++) {
        options += '<option value="' + subjects[i].name + '">' + subjects[i].name + '</option>';
    }
    categorySelect.innerHTML = options;
}

var cachedSubjects = [];

function loadTopicsForFilter() {
    var selectedCategory = document.getElementById('categorySelect').value;
    var topicSelect = document.getElementById('topicSelect');
    if (!topicSelect) return;
    
    topicSelect.innerHTML = '<option value="">Select Topic</option>';

    if (!selectedCategory) return;

    for (var i = 0; i < cachedSubjects.length; i++) {
        if (cachedSubjects[i].name === selectedCategory && cachedSubjects[i].topics) {
            for (var j = 0; j < cachedSubjects[i].topics.length; j++) {
                var topicName = cachedSubjects[i].topics[j].name || cachedSubjects[i].topics[j];
                var option = document.createElement('option');
                option.value = topicName;
                option.textContent = topicName;
                topicSelect.appendChild(option);
            }
            break;
        }
    }
}