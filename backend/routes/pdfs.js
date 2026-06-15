const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { PDF } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { getDbStatus } = require('../config/database');
const { pdfStorageDir } = require('../config/constants');

if (!fs.existsSync(pdfStorageDir)) {
    fs.mkdirSync(pdfStorageDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, pdfStorageDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDFs allowed'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    if (!getDbStatus()) {
        return res.json([]);
    }
    try {
        const pdfs = await PDF.find().sort({ uploadedAt: -1 });
        const files = pdfs.map(p => ({
            _id: p._id, name: p.name, url: `/api/pdfs/file/${p._id}`,
            size: p.size, uploadedAt: p.uploadedAt
        }));
        res.json(files);
    } catch (err) {
        res.json([]);
    }
});

router.get('/file/:id', async (req, res) => {
    if (!getDbStatus()) {
        return res.status(404).json({ message: 'Not found' });
    }
    try {
        const pdf = await PDF.findById(req.params.id);
        if (!pdf) {
            return res.status(404).json({ message: 'PDF not found' });
        }
        const filePath = path.join(pdfStorageDir, pdf.filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'PDF file not found on disk' });
        }
        res.set('Content-Type', pdf.contentType);
        res.set('Content-Disposition', `inline; filename="${pdf.name}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        res.status(500).json({ message: 'Error loading PDF' });
    }
});

router.post('/', adminAuth, upload.single('pdf'), async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    try {
        const newPdf = await PDF.create({
            name: req.file.originalname, filename: req.file.filename,
            contentType: req.file.mimetype, size: req.file.size
        });
        res.json({ message: 'PDF uploaded successfully', id: newPdf._id, name: newPdf.name });
    } catch (err) {
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (_e) { /* already deleted or inaccessible */ }
        }
        res.status(500).json({ message: 'Failed to save PDF' });
    }
});

router.delete('/:id', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const pdf = await PDF.findById(req.params.id);
        if (!pdf) {
            return res.status(404).json({ message: 'PDF not found' });
        }
        const filePath = path.join(pdfStorageDir, pdf.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        await PDF.findByIdAndDelete(req.params.id);
        res.json({ message: 'PDF deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting PDF' });
    }
});

router.post('/migrate', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const pdfs = await PDF.find({ data: { $exists: true } });
        if (pdfs.length === 0) {
            return res.json({ message: 'No PDFs to migrate', migrated: 0 });
        }
        let migrated = 0, errors = 0;
        for (const pdf of pdfs) {
            try {
                const safeName = pdf.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${safeName}`;
                fs.writeFileSync(path.join(pdfStorageDir, filename), pdf.data);
                await PDF.findByIdAndUpdate(pdf._id, { filename, $unset: { data: '' } });
                migrated++;
            } catch (e) {
                console.error(`[MIGRATION] Failed to migrate PDF ${pdf.name}:`, e.message);
                errors++;
            }
        }
        res.json({ message: `Migration complete: ${migrated} migrated, ${errors} errors`, migrated, errors });
    } catch (err) {
        res.status(500).json({ message: 'Migration failed', error: err.message });
    }
});

module.exports = router;
