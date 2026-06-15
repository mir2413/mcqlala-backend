const mongoose = require('mongoose');
const { Subject, MCQ } = require('../models');

let isDbConnected = false;

function unescapeEntity(name) {
    if (!name || typeof name !== 'string') {
        return '';
    }
    return name
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'");
}

async function fixLegacyEntityEncoding() {
    try {
        const subjects = await Subject.find({});
        let fixedSubjects = 0;
        for (const subject of subjects) {
            let changed = false;
            subject.topics = subject.topics.map(t => {
                if (typeof t === 'object' && t.name) {
                    const decoded = unescapeEntity(t.name);
                    if (decoded !== t.name) {
                        changed = true; t.name = decoded;
                    }
                }
                return t;
            });
            if (changed) {
                await subject.save(); fixedSubjects++;
            }
        }
        if (fixedSubjects > 0) {
            console.log(`[MIGRATION] Fixed ${fixedSubjects} subject(s) with encoded entity characters`);
        }

        const mcqs = await MCQ.find({
            $or: [
                { question: /&amp;|&lt;|&gt;|&quot;|&#x27;|&#39;/ },
                { category: /&amp;|&lt;|&gt;|&quot;|&#x27;|&#39;/ },
                { topic: /&amp;|&lt;|&gt;|&quot;|&#x27;|&#39;/ },
                { explanation: /&amp;|&lt;|&gt;|&quot;|&#x27;|&#39;/ }
            ]
        });
        let fixedMCQs = 0;
        for (const mcq of mcqs) {
            let changed = false;
            if (mcq.question) {
                const d = unescapeEntity(mcq.question); if (d !== mcq.question) {
                    mcq.question = d; changed = true;
                }
            }
            if (mcq.category) {
                const d = unescapeEntity(mcq.category); if (d !== mcq.category) {
                    mcq.category = d; changed = true;
                }
            }
            if (mcq.topic) {
                const d = unescapeEntity(mcq.topic); if (d !== mcq.topic) {
                    mcq.topic = d; changed = true;
                }
            }
            if (mcq.explanation) {
                const d = unescapeEntity(mcq.explanation); if (d !== mcq.explanation) {
                    mcq.explanation = d; changed = true;
                }
            }
            if (changed) {
                await mcq.save(); fixedMCQs++;
            }
        }
        if (fixedMCQs > 0) {
            console.log(`[MIGRATION] Fixed ${fixedMCQs} MCQ(s) with encoded entity characters`);
        }
    } catch (err) {
        console.warn('[MIGRATION] Non-critical error during legacy data fix:', err.message);
    }
}

async function connectDB() {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        console.log('⚠️  Running without MongoDB - data will not persist!');
        return;
    }
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB connected successfully!');
        isDbConnected = true;

        const subjectCount = await Subject.countDocuments();
        if (subjectCount === 0) {
            await Subject.create({
                name: 'General Knowledge',
                description: 'Basic GK',
                topics: [{ name: 'History' }, { name: 'Geography' }]
            });
        }

        await fixLegacyEntityEncoding();
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
    }
}

function getDbStatus() {
    return isDbConnected;
}

module.exports = { connectDB, getDbStatus, fixLegacyEntityEncoding };
