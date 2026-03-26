# 💾 Automated Database Backup System

## Overview
Automatic daily backups for your MongoDB database with easy restore functionality.

## Features

- ✅ **Automatic Daily Backups** - Runs at 2 AM every day
- ✅ **Manual Backup Creation** - Create backups on-demand via API
- ✅ **Easy Restore** - Restore database from any backup
- ✅ **Backup Download** - Download backup files
- ✅ **Auto Cleanup** - Keeps only last 7 backups
- ✅ **Admin Only** - All backup operations require admin access

## API Endpoints

### Create Manual Backup
```
POST /api/backup/create
Headers: Cookie (JWT) or Authorization
```

**Response:**
```json
{
    "message": "Backup created successfully",
    "filename": "backup-2026-03-26T02-00-00-000Z.json"
}
```

### List All Backups
```
GET /api/backup/list
Headers: Cookie (JWT) or Authorization
```

**Response:**
```json
{
    "backups": [
        {
            "filename": "backup-2026-03-26T02-00-00-000Z.json",
            "size": "125.45 KB",
            "created": "2026-03-26T02:00:00.000Z"
        }
    ]
}
```

### Restore from Backup
```
POST /api/backup/restore/:filename
Headers: Cookie (JWT) or Authorization
```

**Example:**
```
POST /api/backup/restore/backup-2026-03-26T02-00-00-000Z.json
```

**Response:**
```json
{
    "message": "Database restored successfully",
    "filename": "backup-2026-03-26T02-00-00-000Z.json"
}
```

### Download Backup File
```
GET /api/backup/download/:filename
Headers: Cookie (JWT) or Authorization
```

## Backup Schedule

**Default Schedule:** Daily at 2 AM

**Cron Expression:** `0 2 * * *`

### Customize Schedule

Edit `backend/server.js`:
```javascript
// Change schedule to every 12 hours
backupManager.scheduleBackup('0 */12 * * *');

// Change schedule to weekly on Sunday at 3 AM
backupManager.scheduleBackup('0 3 * * 0');

// Change schedule to every 6 hours
backupManager.scheduleBackup('0 */6 * * *');
```

## Backup Storage

**Location:** `backups/` folder in project root

**Format:** JSON files with timestamp

**Example:** `backup-2026-03-26T02-00-00-000Z.json`

**Max Backups:** 7 (oldest automatically deleted)

## Backup File Structure

```json
{
    "timestamp": "2026-03-26T02:00:00.000Z",
    "collections": {
        "users": [...],
        "subjects": [...],
        "mcqs": [...],
        "scores": [...],
        "navitems": [...],
        "messages": [...],
        "settings": [...],
        "pdfs": [...]
    }
}
```

## Security

- ✅ All backup endpoints require admin authentication
- ✅ Backup files contain sensitive data (passwords are hashed)
- ✅ Backup files stored on server (not exposed publicly)
- ✅ Download endpoint requires admin auth

## Manual Backup via Server Console

If you need to create a backup manually from the server console:

```javascript
const DatabaseBackup = require('./backup');
const backup = new DatabaseBackup();

// Create backup
await backup.exportDatabase();

// List backups
console.log(backup.listBackups());

// Restore from backup
await backup.restoreDatabase('backup-2026-03-26T02-00-00-000Z.json');
```

## Cloud Backup (Optional)

For production, consider backing up to cloud storage:

### AWS S3
```bash
npm install aws-sdk
```

### Google Cloud Storage
```bash
npm install @google-cloud/storage
```

### Azure Blob Storage
```bash
npm install @azure/storage-blob
```

## Troubleshooting

### Backup not running?
- Check server logs for `[BACKUP]` messages
- Verify MongoDB connection
- Check disk space

### Restore failed?
- Ensure backup file exists
- Check file permissions
- Verify MongoDB connection

### Too many backups?
- Adjust `maxBackups` in `backup.js`
- Manually delete old backups from `backups/` folder

## Monitoring

Check backup status in server logs:
```
[BACKUP] 📅 Scheduled automatic backup: 0 2 * * *
[BACKUP] ⏰ Running scheduled backup...
[BACKUP] ✅ Database backup created: backup-2026-03-26T02-00-00-000Z.json
[BACKUP] 📁 Location: /path/to/backups/backup-2026-03-26T02-00-00-000Z.json
```

---

**Last Updated:** March 26, 2026
**Status:** ✅ Automated Backups Enabled
