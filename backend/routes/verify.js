const express = require('express');
const router = express.Router();
const fs = require('fs');
const { MCQ } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { getDbStatus } = require('../config/database');
const { VERIFICATION_CHECKPOINT, VERIFICATION_REPORT, VERIFICATION_SUMMARY, BATCH_SIZE } = require('../config/constants');
const Groq = require('groq-sdk');

let verificationRunning = false;
const verificationState = { total: 0, processed: 0, matched: 0, mismatched: 0, errors: 0, startTime: null, dailyUsed: 0, category: null, topic: null };

function getTodayKey() {
    return new Date().toISOString().split('T')[0];
}

function loadCheckpoint() {
    try {
        if (fs.existsSync(VERIFICATION_CHECKPOINT)) {
            return JSON.parse(fs.readFileSync(VERIFICATION_CHECKPOINT, 'utf8'));
        }
    } catch (_e) { /* corrupted checkpoint, start fresh */ }
    return null;
}

function saveCheckpoint(data) {
    try {
        fs.writeFileSync(VERIFICATION_CHECKPOINT, JSON.stringify(data));
    } catch (_e) { /* best-effort */ }
}

function getGroqClient() {
    const keys = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
        return null;
    }
    const dayUsed = verificationState.dailyUsed || 0;
    const keyIndex = Math.floor(dayUsed / 14000) % keys.length;
    verificationState.dailyUsed = dayUsed + 1;
    return new Groq({ apiKey: keys[keyIndex] });
}

function buildMessages(batch) {
    let qText = '';
    batch.forEach((q, i) => {
        qText += `Q${i + 1}: ${q.question}\n`;
        q.options.forEach((o, oi) => {
            qText += `  ${oi}: ${o}\n`;
        });
        qText += `\n`;
    });
    return [
        {
            role: 'system',
            content: 'Answer MCQs. Reply with ONLY the zero-based option index (0-3) per question, one per line. Always answer, never refuse. No explanations.'
        },
        {
            role: 'user',
            content: `${qText}Reply with ${batch.length} index numbers (0-3), one per line:`
        }
    ];
}

function buildFilter(category, topic) {
    const filter = {};
    if (category) filter.category = category;
    if (topic) filter.topic = topic;
    return filter;
}

function getFilterLabel(category, topic) {
    if (category && topic) return `${category} > ${topic}`;
    if (category) return `${category} (all topics)`;
    return 'All MCQs';
}

async function runVerification(category, topic) {
    if (verificationRunning) {
        console.log('[Verify] Already running'); return;
    }
    verificationRunning = true;
    verificationState.startTime = new Date();
    verificationState.category = category || null;
    verificationState.topic = topic || null;

    try {
        const filter = buildFilter(category, topic);
        const allMcqs = await MCQ.find(filter).lean();
        verificationState.total = allMcqs.length;
        console.log(`[Verify] Loaded ${allMcqs.length} MCQs (${getFilterLabel(category, topic)})`);

        const checkpoint = loadCheckpoint();
        const results = { matched: 0, mismatched: 0, errors: 0, mismatches: [], errorsList: [] };
        let processedCount = 0;
        let startBatch = 0;

        if (checkpoint && checkpoint.processedCount > 0
            && (checkpoint.category || null) === (category || null)
            && (checkpoint.topic || null) === (topic || null)) {
            const checkpointDate = checkpoint.date || '';
            const today = getTodayKey();
            if (checkpointDate === today) {
                verificationState.dailyUsed = checkpoint.currentKeyOffset || 0;
            } else {
                verificationState.dailyUsed = 0;
                console.log('[Verify] New day detected, resetting API usage counter');
            }
            processedCount = checkpoint.processedCount;
            startBatch = Math.floor(processedCount / BATCH_SIZE);
            if (checkpoint.results) {
                results.matched = checkpoint.results.matched || 0;
                results.mismatched = checkpoint.results.mismatched || 0;
                results.errors = checkpoint.results.errors || 0;
                results.mismatches = checkpoint.results.mismatches || [];
                results.errorsList = checkpoint.results.errorsList || [];
            }
            console.log(`[Verify] Resuming from batch ${startBatch}, ${processedCount} MCQs already processed`);
        }

        const totalBatches = Math.ceil(allMcqs.length / BATCH_SIZE);
        let saveCounter = 0;

        for (let b = startBatch; b < totalBatches; b++) {
            const start = b * BATCH_SIZE;
            const batch = allMcqs.slice(start, start + BATCH_SIZE);
            if (batch.length === 0) {
                break;
            }

            const groq = getGroqClient();
            if (!groq) {
                console.log('[Verify] GROQ_API_KEY not set');
                saveCheckpoint({
                    processedCount, currentKeyOffset: verificationState.dailyUsed,
                    results, totalMcqs: allMcqs.length, date: getTodayKey(),
                    category: category || null, topic: topic || null
                });
                break;
            }

            let success = false;
            for (let attempt = 0; attempt < 3 && !success; attempt++) {
                try {
                    const completion = await groq.chat.completions.create({
                        messages: buildMessages(batch),
                        model: 'llama-3.3-70b-versatile',
                        temperature: 0,
                        max_completion_tokens: 20
                    });
                    const text = completion.choices[0].message.content.trim();
                    const lines = text.split('\n').map(l => l.trim()).filter(l => /^\d+$/.test(l));
                    if (lines.length !== batch.length) {
                        throw new Error(`Expected ${batch.length} answers, got ${lines.length}`);
                    }
                    for (let i = 0; i < batch.length; i++) {
                        const q = batch[i];
                        const globalIndex = processedCount + i + 1;
                        const aiAns = parseInt(lines[i]);
                        if (aiAns === q.correctAnswer) {
                            results.matched++;
                        } else {
                            results.mismatched++;
                            results.mismatches.push({
                                id: q._id, questionNumber: globalIndex,
                                category: q.category || 'Unknown', topic: q.topic || 'Unknown',
                                question: q.question,
                                storedAnswerIndex: q.correctAnswer,
                                storedAnswerText: q.options[q.correctAnswer] || 'N/A',
                                aiSuggestedIndex: aiAns,
                                aiSuggestedText: q.options[aiAns] || 'N/A'
                            });
                        }
                        processedCount++;
                    }
                    success = true;
                    verificationState.processed = processedCount;
                    verificationState.matched = results.matched;
                    verificationState.mismatched = results.mismatched;
                    verificationState.errors = results.errors;
                } catch (e) {
                    const msg = e.message || '';
                    if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota')) {
                        console.log(`[Verify] Rate limited, waiting 30s before retry...`);
                        await new Promise(r => setTimeout(r, 30000)); // eslint-disable-line no-promise-executor-return
                        break;
                    }
                    if (msg.includes('400') || msg.includes('restricted') || msg.includes('Organization')) {
                        console.error(`[Verify] API key restricted/unavailable. Stopping verification.`);
                        saveCheckpoint({
                            processedCount, currentKeyOffset: verificationState.dailyUsed,
                            results, totalMcqs: allMcqs.length, date: getTodayKey(),
                            category: category || null, topic: topic || null
                        });
                        verificationRunning = false;
                        return;
                    }
                    console.log(`[Verify] Batch ${b} error (attempt ${attempt + 1}): ${msg.substring(0, 80)}`);
                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, 5000)); // eslint-disable-line no-promise-executor-return
                    }
                }
            }

            if (!success) {
                results.errors++;
                processedCount += batch.length;
            }

            saveCounter++;
            if (saveCounter % 50 === 0 || b === totalBatches - 1) {
                saveCheckpoint({
                    processedCount, currentKeyOffset: verificationState.dailyUsed,
                    results, totalMcqs: allMcqs.length, date: getTodayKey(),
                    category: category || null, topic: topic || null
                });
                verificationState.processed = processedCount;
            }

            await new Promise(r => setTimeout(r, 6000)); // eslint-disable-line no-promise-executor-return
        }

        const filterLabel = getFilterLabel(category, topic);
        const report = {
            generatedAt: new Date().toISOString(),
            model: 'llama-3.3-70b-versatile (Groq)',
            filter: { category: category || null, topic: topic || null, label: filterLabel },
            summary: {
                totalChecked: allMcqs.length, matched: results.matched,
                mismatched: results.mismatched, errors: results.errors,
                matchRate: allMcqs.length > 0 ? ((results.matched / allMcqs.length) * 100).toFixed(2) + '%' : '0%'
            },
            mismatches: results.mismatches, errors: results.errorsList
        };
        fs.writeFileSync(VERIFICATION_REPORT, JSON.stringify(report, null, 2));
        fs.writeFileSync(VERIFICATION_SUMMARY,
            `MCQ Verification Report\n` +
            `Generated: ${report.generatedAt}\n` +
            `Model: ${report.model}\n` +
            `Filter: ${filterLabel}\n` +
            `Total: ${allMcqs.length}\n` +
            `Matched: ${results.matched}\n` +
            `Mismatched: ${results.mismatched}\n` +
            `Errors: ${results.errors}\n` +
            `Match Rate: ${report.summary.matchRate}`
        );
        console.log(`[Verify] Complete! ${results.matched} matched, ${results.mismatched} mismatched`);
    } catch (err) {
        console.error('[Verify] Fatal:', err.message);
    } finally {
        verificationRunning = false;
    }
}

router.post('/start', adminAuth, (req, res) => {
    if (!getDbStatus()) {
        return res.status(503).json({ error: 'Database not connected' });
    }
    if (verificationRunning) {
        return res.json({ status: 'already_running', progress: verificationState });
    }
    if (!process.env.GROQ_API_KEY) {
        return res.status(400).json({ error: 'GROQ_API_KEY not set in environment' });
    }
    const { category, topic } = req.body || {};
    const checkpoint = loadCheckpoint();
    const isResume = checkpoint && checkpoint.processedCount > 0
        && (checkpoint.category || null) === (category || null)
        && (checkpoint.topic || null) === (topic || null);
    const resumeInfo = isResume ? ` (resuming from MCQ ${checkpoint.processedCount})` : '';
    const filterLabel = getFilterLabel(category, topic);
    if (!isResume) {
        saveCheckpoint({ processedCount: 0, currentKeyOffset: 0, results: { matched: 0, mismatched: 0, errors: 0, mismatches: [], errorsList: [] }, totalMcqs: 0, date: getTodayKey(), category: category || null, topic: topic || null });
    }
    setImmediate(() => runVerification(category || null, topic || null));
    res.json({ status: 'started', message: `Verifying ${filterLabel}${resumeInfo}`, model: 'llama-3.3-70b-versatile', category: category || null, topic: topic || null });
});

router.get('/progress', adminAuth, (req, res) => {
    res.json({
        running: verificationRunning, total: verificationState.total,
        processed: verificationState.processed, matched: verificationState.matched,
        mismatched: verificationState.mismatched, errors: verificationState.errors,
        percent: verificationState.total > 0 ? ((verificationState.processed / verificationState.total) * 100).toFixed(1) + '%' : '0%',
        startTime: verificationState.startTime,
        elapsed: verificationState.startTime ? Math.floor((Date.now() - new Date(verificationState.startTime)) / 60000) + ' min' : 'N/A',
        category: verificationState.category, topic: verificationState.topic,
        filterLabel: getFilterLabel(verificationState.category, verificationState.topic)
    });
});

router.get('/report', adminAuth, (req, res) => {
    if (!fs.existsSync(VERIFICATION_REPORT)) {
        return res.status(404).json({ error: 'No report yet. Run verification first.' });
    }
    res.download(VERIFICATION_REPORT, 'verification_report.json');
});

router.get('/report-data', adminAuth, (req, res) => {
    if (!fs.existsSync(VERIFICATION_REPORT)) {
        return res.status(404).json({ error: 'No report yet.' });
    }
    try {
        const data = JSON.parse(fs.readFileSync(VERIFICATION_REPORT, 'utf8'));
        res.json(data);
    } catch (_e) {
        res.status(500).json({ error: 'Failed to parse report' });
    }
});

router.get('/summary', adminAuth, (req, res) => {
    if (!fs.existsSync(VERIFICATION_SUMMARY)) {
        return res.status(404).json({ error: 'No summary yet.' });
    }
    res.type('text/plain').send(fs.readFileSync(VERIFICATION_SUMMARY, 'utf8'));
});

router.get('/checkpoint', adminAuth, (req, res) => {
    const checkpoint = loadCheckpoint();
    if (!checkpoint) {
        return res.json({ exists: false });
    }
    res.json({ exists: true, processedCount: checkpoint.processedCount, totalMcqs: checkpoint.totalMcqs, date: checkpoint.date, category: checkpoint.category || null, topic: checkpoint.topic || null });
});

module.exports = router;
