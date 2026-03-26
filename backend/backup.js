const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

class DatabaseBackup {
    constructor() {
        this.backupDir = path.join(__dirname, '..', 'backups');
        this.maxBackups = 7; // Keep last 7 backups
    }

    // Create backup directory if it doesn't exist
    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    // Generate backup filename with timestamp
    getBackupFilename() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `backup-${timestamp}.json`;
    }

    // Export all collections to JSON
    async exportDatabase() {
        try {
            this.ensureBackupDir();
            
            const filename = this.getBackupFilename();
            const filepath = path.join(this.backupDir, filename);
            
            // Get all collections
            const collections = await mongoose.connection.db.listCollections().toArray();
            const backupData = {
                timestamp: new Date().toISOString(),
                collections: {}
            };

            // Export each collection
            for (const collection of collections) {
                const collectionName = collection.name;
                const data = await mongoose.connection.db.collection(collectionName).find({}).toArray();
                backupData.collections[collectionName] = data;
            }

            // Write to file
            fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
            
            console.log(`[BACKUP] ✅ Database backup created: ${filename}`);
            console.log(`[BACKUP] 📁 Location: ${filepath}`);
            
            // Clean up old backups
            await this.cleanOldBackups();
            
            return { success: true, filename, filepath };
        } catch (error) {
            console.error('[BACKUP] ❌ Backup failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Clean up old backups (keep only maxBackups)
    async cleanOldBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
                .map(file => ({
                    name: file,
                    path: path.join(this.backupDir, file),
                    time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Newest first

            // Delete old backups
            if (files.length > this.maxBackups) {
                const filesToDelete = files.slice(this.maxBackups);
                for (const file of filesToDelete) {
                    fs.unlinkSync(file.path);
                    console.log(`[BACKUP] 🗑️  Deleted old backup: ${file.name}`);
                }
            }
        } catch (error) {
            console.error('[BACKUP] ⚠️  Error cleaning old backups:', error.message);
        }
    }

    // Restore database from backup
    async restoreDatabase(filename) {
        try {
            const filepath = path.join(this.backupDir, filename);
            
            if (!fs.existsSync(filepath)) {
                throw new Error(`Backup file not found: ${filename}`);
            }

            const backupData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            
            // Restore each collection
            for (const [collectionName, data] of Object.entries(backupData.collections)) {
                if (data.length > 0) {
                    // Drop existing collection
                    await mongoose.connection.db.dropCollection(collectionName).catch(() => {});
                    
                    // Insert backup data
                    await mongoose.connection.db.collection(collectionName).insertMany(data);
                    console.log(`[RESTORE] ✅ Restored ${data.length} documents to ${collectionName}`);
                }
            }

            console.log(`[RESTORE] ✅ Database restored from: ${filename}`);
            return { success: true, filename };
        } catch (error) {
            console.error('[RESTORE] ❌ Restore failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // List available backups
    listBackups() {
        try {
            this.ensureBackupDir();
            const files = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
                .map(file => {
                    const stats = fs.statSync(path.join(this.backupDir, file));
                    return {
                        filename: file,
                        size: `${(stats.size / 1024).toFixed(2)} KB`,
                        created: stats.mtime.toISOString()
                    };
                })
                .sort((a, b) => new Date(b.created) - new Date(a.created));

            return files;
        } catch (error) {
            console.error('[BACKUP] Error listing backups:', error.message);
            return [];
        }
    }

    // Schedule automatic backups
    scheduleBackup(cronExpression = '0 2 * * *') { // Default: 2 AM daily
        console.log(`[BACKUP] 📅 Scheduled automatic backup: ${cronExpression}`);
        
        cron.schedule(cronExpression, async () => {
            console.log('[BACKUP] ⏰ Running scheduled backup...');
            await this.exportDatabase();
        });
    }
}

module.exports = DatabaseBackup;
