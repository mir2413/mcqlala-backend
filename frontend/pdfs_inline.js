
        window.addEventListener('DOMContentLoaded', () => {
            loadNavLinks();
            loadPdfs();
        });

        async function loadPdfs() {
            try {
                const response = await fetch(`${API_BASE_URL}/pdfs`);
                const pdfs = await response.json();
                const container = document.getElementById('pdfsGrid');
                
                if (pdfs.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1/-1;">No study materials available yet.</p>';
                    return;
                }
                
                container.innerHTML = pdfs.map(pdf => `
                    <div class="pdf-card">
                        <i class="fa-solid fa-file-pdf pdf-icon"></i>
                        <div class="pdf-info">
                            <h4>${pdf.name}</h4>
                            <p>Uploaded: ${new Date(pdf.uploadedAt).toLocaleDateString()}</p>
                            <a href="${pdf.url}" target="_blank" class="pdf-download"><i class="fa-solid fa-download"></i> Download</a>
                        </div>
                    </div>
                `).join('');
            } catch (e) {
                document.getElementById('pdfsGrid').innerHTML = '<p style="text-align: center; color: red; grid-column: 1/-1;">Failed to load PDFs</p>';
            }
        }
    
