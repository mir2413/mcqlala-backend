const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const DatabaseBackup = require('../backup');
const { adminAuth } = require('../middleware/auth');
const { getDbStatus } = require('../config/database');

const backupManager = new DatabaseBackup();

router.post('/create', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const result = await backupManager.exportDatabase();
        if (result.success) {
            console.log(`[BACKUP] Admin ${req.user.username} created backup: ${result.filename}`);
            res.json({ message: 'Backup created successfully', filename: result.filename });
        } else {
            res.status(500).json({ message: 'Backup failed', error: result.error });
        }
    } catch (err) {
        res.status(500).json({ message: 'Backup failed', error: err.message });
    }
});

router.get('/list', adminAuth, (req, res) => {
    const backups = backupManager.listBackups();
    res.json({ backups });
});

router.post('/restore/:filename', adminAuth, async (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ message: 'Database not connected' });
    }
    try {
        const result = await backupManager.restoreDatabase(req.params.filename);
        if (result.success) {
            console.log(`[BACKUP] Admin ${req.user.username} restored from: ${req.params.filename}`);
            res.json({ message: 'Database restored successfully', filename: req.params.filename });
        } else {
            res.status(500).json({ message: 'Restore failed', error: result.error });
        }
    } catch (err) {
        res.status(500).json({ message: 'Restore failed', error: err.message });
    }
});

router.get('/download/:filename', adminAuth, (req, res) => {
    const filepath = path.join(__dirname, '..', '..', 'backups', path.basename(req.params.filename));
    if (fs.existsSync(filepath)) {
        res.download(filepath);
    } else {
        res.status(404).json({ message: 'Backup file not found' });
    }
});

module.exports = router;
