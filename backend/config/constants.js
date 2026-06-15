const path = require('path');

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3004',
    'https://mcqlala.in',
    'https://www.mcqlala.in'
];

if (process.env.CORS_ORIGIN) {
    process.env.CORS_ORIGIN.split(',').forEach(origin => {
        const trimmed = origin.trim();
        if (trimmed && !allowedOrigins.includes(trimmed)) {
            allowedOrigins.push(trimmed);
        }
    });
}

const pdfStorageDir = path.join(__dirname, '..', 'pdfs');
const VERIFICATION_CHECKPOINT = path.join(__dirname, '..', 'verification_checkpoint.json');
const VERIFICATION_REPORT = path.join(__dirname, '..', 'verification_report.json');
const VERIFICATION_SUMMARY = path.join(__dirname, '..', 'verification_summary.txt');
const BATCH_SIZE = 5;

module.exports = {
    allowedOrigins,
    pdfStorageDir,
    VERIFICATION_CHECKPOINT,
    VERIFICATION_REPORT,
    VERIFICATION_SUMMARY,
    BATCH_SIZE
};
