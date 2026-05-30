// ============== ENTRANCE EXAM ADMIN FUNCTIONS ==============

let entranceExamsCache = [];
let entranceShiftCounter = 0;
let entranceCurrentResults = [];

// ---------- Helpers ----------
function entApi(url, opts) {
    return fetch(url, opts).then(r => r.json());
}

function entShowToast(msg, type) {
    if (typeof showNotification === 'function') {
        showNotification(msg, type || 'success');
    } else {
        alert(msg);
    }
}

function entFmtDateTime(iso) {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
}

// ---------- Settings (Enable/Disable) ----------
async function loadEntranceSettings() {
    try {
        const data = await entApi('/api/entrance-settings');
        const toggle = document.getElementById('entranceEnableToggle');
        const slider = document.getElementById('entranceToggleSlider');
        const info = document.getElementById('entranceSettingsInfo');
        if (!toggle) return;
        toggle.checked = !!data.enabled;
        if (slider) {
            slider.style.background = data.enabled ? '#10b981' : '#374151';
            slider.innerHTML = '<span style="position:absolute;top:4px;left:' + (data.enabled ? '32px' : '4px') + ';width:24px;height:24px;background:#fff;border-radius:50%;transition:.3s;"></span>';
        }
        if (info) {
            info.innerHTML = data.enabled
                ? '<i class="fas fa-check-circle" style="color:#10b981;"></i> <strong>Feature is currently ENABLED.</strong><br>Enabled at: ' + entFmtDateTime(data.enabledAt) + (data.enabledBy ? ' by ' + data.enabledBy : '')
                : '<i class="fas fa-times-circle" style="color:#ef4444;"></i> <strong>Feature is currently DISABLED.</strong><br>Students cannot access the entrance portal and the homepage button is hidden.';
        }
    } catch (e) { console.error(e); }
    
    // Load submission settings
    loadEntranceSubmissionSettings();
}

async function toggleEntranceFeature() {
    try {
        await entApi('/api/entrance-settings/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminName: localStorage.getItem('adminUser') || 'admin' })
        });
        await loadEntranceSettings();
        entShowToast('Settings updated', 'success');
    } catch (e) { entShowToast('Error updating settings', 'error'); }
}

// ---------- Dashboard ----------
async function loadEntranceDashboard() {
    try {
        const [exams, regs, questions, results, settings] = await Promise.all([
            entApi('/api/entrance-exams'),
            entApi('/api/entrance-registrations'),
            entApi('/api/entrance-questions'),
            entApi('/api/entrance-results'),
            entApi('/api/entrance-settings')
        ]);
        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText('entStatExams', exams.length);
        setText('entStatRegs', regs.length);
        setText('entStatQuestions', questions.length);
        setText('entStatAttempts', results.length);

        const status = document.getElementById('entFeatureStatus');
        if (status) {
            status.innerHTML = settings.enabled
                ? '<i class="fas fa-check-circle" style="color:#10b981;"></i> Entrance Exam feature is <strong>ENABLED</strong>. Portal: <a href="/entrance-portal.html" target="_blank" style="color:#fbbf24;">/entrance-portal.html</a>'
                : '<i class="fas fa-times-circle" style="color:#ef4444;"></i> Entrance Exam feature is <strong>DISABLED</strong>. Enable it in Settings to allow students to access the portal.';
        }
    } catch (e) { console.error(e); }
}

// ---------- Exam Management ----------
async function loadEntranceExams() {
    try {
        const exams = await entApi('/api/entrance-exams');
        entranceExamsCache = exams;
        const tbody = document.querySelector('#entranceExamsTable tbody');
        if (!tbody) return;
        if (!exams.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No entrance exams created yet</td></tr>';
        } else {
            tbody.innerHTML = exams.map(e =>
                '<tr>' +
                '<td>' + (e.name || '') + '</td>' +
                '<td>' + (e.examCode || '') + '</td>' +
                '<td>' + (e.course || '-') + '</td>' +
                '<td>' + ((e.shifts || []).length) + '</td>' +
                '<td>' + (e.totalMarks || 0) + '</td>' +
                '<td><span class="badge">' + (e.status || 'Draft') + '</span></td>' +
                '<td>' +
                '<button class="action-btn" onclick="editEntranceExam(' + e.id + ')"><i class="fas fa-edit"></i></button> ' +
                '<button class="action-btn" onclick="deleteEntranceExam(' + e.id + ')"><i class="fas fa-trash"></i></button>' +
                '</td>' +
                '</tr>'
            ).join('');
        }
        // Populate exam dropdowns
        populateExamDropdowns(exams);
    } catch (e) { console.error(e); }
}

function populateExamDropdowns(exams) {
    const ids = ['entQbExam', 'entRegExam', 'entMonitorExam', 'entResultExam', 'entRegExamSel'];
    ids.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '<option value="">Select Exam</option>' + exams.map(e => '<option value="' + e.id + '">' + e.name + '</option>').join('');
        if (cur) sel.value = cur;
    });
}

function openEntranceExamModal() {
    document.getElementById('entranceExamModalTitle').innerHTML = '<i class="fas fa-clipboard-list" style="color:#667eea;margin-right:8px;"></i> Create Entrance Exam';
    document.getElementById('entExamId').value = '';
    document.getElementById('entExamName').value = '';
    document.getElementById('entExamCourse').value = '';
    document.getElementById('entExamDesc').value = '';
    document.getElementById('entExamMarks').value = 100;
    document.getElementById('entExamQuestionCount').value = 0;
    document.getElementById('entExamStatus').value = 'Draft';
    document.getElementById('entExamRandomize').checked = false;
    document.getElementById('entExamInstructions').value = 'Read all questions carefully. Do not switch tabs or windows during the exam. Your answers are auto-saved. The exam will auto-submit when time ends.';
    document.getElementById('entExamShiftsContainer').innerHTML = '';
    entranceShiftCounter = 0;
    addEntranceShift();
    document.getElementById('entranceExamModal').classList.add('active');
}

function editEntranceExam(id) {
    const exam = entranceExamsCache.find(e => e.id == id);
    if (!exam) return;
    document.getElementById('entranceExamModalTitle').innerHTML = '<i class="fas fa-edit" style="color:#667eea;margin-right:8px;"></i> Edit Entrance Exam';
    document.getElementById('entExamId').value = exam.id;
    document.getElementById('entExamName').value = exam.name || '';
    document.getElementById('entExamCourse').value = exam.course || '';
    document.getElementById('entExamDesc').value = exam.description || '';
    document.getElementById('entExamMarks').value = exam.totalMarks || 100;
    document.getElementById('entExamQuestionCount').value = exam.questionsPerStudent || 0;
    document.getElementById('entExamStatus').value = exam.status || 'Draft';
    document.getElementById('entExamRandomize').checked = !!exam.randomize;
    document.getElementById('entExamInstructions').value = exam.instructions || '';
    document.getElementById('entExamShiftsContainer').innerHTML = '';
    entranceShiftCounter = 0;
    (exam.shifts || []).forEach(s => addEntranceShift(s));
    if (!(exam.shifts || []).length) addEntranceShift();
    document.getElementById('entranceExamModal').classList.add('active');
}

function addEntranceShift(shift) {
    const id = 'shift_' + (entranceShiftCounter++);
    const container = document.getElementById('entExamShiftsContainer');
    const div = document.createElement('div');
    div.className = 'entrance-shift-row';
    div.dataset.id = shift && shift.id ? shift.id : id;
    div.style.cssText = 'display:grid;grid-template-columns:1fr 1.5fr 1.5fr 100px auto;gap:10px;align-items:end;margin-bottom:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;';
    div.innerHTML =
        '<div><label style="font-weight:600;color:#fff;font-size:12px;">Shift Name</label><input class="ent-shift-name" type="text" placeholder="Morning Shift" value="' + ((shift && shift.name) || '') + '" style="width:100%;height:38px;padding:0 10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);border-radius:6px;color:#fff;"></div>' +
        '<div><label style="font-weight:600;color:#fff;font-size:12px;">Start Time</label><input class="ent-shift-start" type="datetime-local" value="' + ((shift && shift.scheduledStart) ? shift.scheduledStart.slice(0,16) : '') + '" style="width:100%;height:38px;padding:0 10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);border-radius:6px;color:#fff;"></div>' +
        '<div><label style="font-weight:600;color:#fff;font-size:12px;">End Time</label><input class="ent-shift-end" type="datetime-local" value="' + ((shift && shift.scheduledEnd) ? shift.scheduledEnd.slice(0,16) : '') + '" style="width:100%;height:38px;padding:0 10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);border-radius:6px;color:#fff;"></div>' +
        '<div><label style="font-weight:600;color:#fff;font-size:12px;">Duration (min)</label><input class="ent-shift-duration" type="number" value="' + ((shift && shift.duration) || 60) + '" style="width:100%;height:38px;padding:0 10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);border-radius:6px;color:#fff;"></div>' +
        '<div><button class="btn btn-danger" type="button" onclick="this.closest(\'.entrance-shift-row\').remove()" style="height:38px;padding:0 12px;"><i class="fas fa-times"></i></button></div>';
    container.appendChild(div);
}

async function saveEntranceExam() {
    const id = document.getElementById('entExamId').value;
    const shifts = [];
    document.querySelectorAll('#entExamShiftsContainer .entrance-shift-row').forEach(row => {
        const name = row.querySelector('.ent-shift-name').value.trim();
        const start = row.querySelector('.ent-shift-start').value;
        const end = row.querySelector('.ent-shift-end').value;
        const duration = parseInt(row.querySelector('.ent-shift-duration').value) || 60;
        if (name && start && end) {
            shifts.push({
                id: row.dataset.id || ('shift_' + Date.now() + Math.random().toString(36).slice(2, 6)),
                name,
                scheduledStart: start,
                scheduledEnd: end,
                duration
            });
        }
    });

    const body = {
        name: document.getElementById('entExamName').value.trim(),
        course: document.getElementById('entExamCourse').value.trim(),
        description: document.getElementById('entExamDesc').value.trim(),
        totalMarks: parseInt(document.getElementById('entExamMarks').value) || 100,
        questionsPerStudent: parseInt(document.getElementById('entExamQuestionCount').value) || 0,
        status: document.getElementById('entExamStatus').value,
        randomize: document.getElementById('entExamRandomize').checked,
        instructions: document.getElementById('entExamInstructions').value,
        shifts
    };

    if (!body.name) return entShowToast('Exam name is required', 'error');
    if (!shifts.length) return entShowToast('At least one shift is required', 'error');

    try {
        const url = id ? '/api/entrance-exams/' + id : '/api/entrance-exams';
        const data = await entApi(url, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (data.success) {
            entShowToast('Exam saved', 'success');
            closeModal('entranceExamModal');
            loadEntranceExams();
        } else {
            entShowToast(data.message || 'Error saving exam', 'error');
        }
    } catch (e) { entShowToast('Network error', 'error'); }
}

async function deleteEntranceExam(id) {
    if (!confirm('Are you sure you want to delete this exam? This will also remove all related questions, registrations, and results.')) return;
    try {
        const data = await entApi('/api/entrance-exams/' + id, { method: 'DELETE' });
        if (data.success) {
            entShowToast('Exam deleted', 'success');
            loadEntranceExams();
        }
    } catch (e) { entShowToast('Error deleting exam', 'error'); }
}

// ---------- Question Bank ----------
async function loadEntranceQuestions() {
    const examId = document.getElementById('entQbExam').value;
    const tbody = document.querySelector('#entranceQuestionsTable tbody');
    if (!tbody) return;
    if (!examId) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Please select an exam first</td></tr>';
        return;
    }
    try {
        const questions = await entApi('/api/entrance-questions?examId=' + examId);
        if (!questions.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No questions yet. Add some or use bulk upload.</td></tr>';
            return;
        }
        tbody.innerHTML = questions.map((q, idx) =>
            '<tr>' +
            '<td><input type="checkbox" class="ent-q-check" value="' + q.id + '"></td>' +
            '<td>' + (idx + 1) + '</td>' +
            '<td>' + escapeHtmlAdmin(q.question) + '</td>' +
            '<td>' + (q.subject || '-') + '</td>' +
            '<td>' + (q.difficulty || '-') + '</td>' +
            '<td>' + (q.marks || 1) + '</td>' +
            '<td>' +
            '<button class="action-btn" onclick="editEntranceQuestion(' + q.id + ')"><i class="fas fa-edit"></i></button> ' +
            '<button class="action-btn" onclick="deleteEntranceQuestion(' + q.id + ')"><i class="fas fa-trash"></i></button>' +
            '</td>' +
            '</tr>'
        ).join('');
        const sa = document.getElementById('entQSelectAll');
        if (sa) sa.checked = false;
    } catch (e) { console.error(e); }
}

function escapeHtmlAdmin(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function openEntranceQuestionModal() {
    const examId = document.getElementById('entQbExam').value;
    if (!examId) return entShowToast('Please select an exam first', 'error');
    document.getElementById('entQuestionId').value = '';
    document.getElementById('entQText').value = '';
    document.getElementById('entQTextHindi').value = '';
    document.getElementById('entOptA').value = '';
    document.getElementById('entOptAHindi').value = '';
    document.getElementById('entOptB').value = '';
    document.getElementById('entOptBHindi').value = '';
    document.getElementById('entOptC').value = '';
    document.getElementById('entOptCHindi').value = '';
    document.getElementById('entOptD').value = '';
    document.getElementById('entOptDHindi').value = '';
    document.getElementById('entCorrect').value = 1;
    document.getElementById('entMarks').value = 1;
    document.getElementById('entSubject').value = '';
    document.getElementById('entDifficulty').value = 'Medium';
    document.getElementById('entranceQuestionModal').classList.add('active');
}

async function editEntranceQuestion(id) {
    try {
        const examId = document.getElementById('entQbExam').value;
        const questions = await entApi('/api/entrance-questions?examId=' + examId);
        const q = questions.find(qq => qq.id == id);
        if (!q) return;
        document.getElementById('entQuestionId').value = q.id;
        document.getElementById('entQText').value = q.question || '';
        document.getElementById('entQTextHindi').value = q.questionHindi || '';
        document.getElementById('entOptA').value = (q.options || [])[0] || '';
        document.getElementById('entOptAHindi').value = (q.optionsHindi || [])[0] || '';
        document.getElementById('entOptB').value = (q.options || [])[1] || '';
        document.getElementById('entOptBHindi').value = (q.optionsHindi || [])[1] || '';
        document.getElementById('entOptC').value = (q.options || [])[2] || '';
        document.getElementById('entOptCHindi').value = (q.optionsHindi || [])[2] || '';
        document.getElementById('entOptD').value = (q.options || [])[3] || '';
        document.getElementById('entOptDHindi').value = (q.optionsHindi || [])[3] || '';
        document.getElementById('entCorrect').value = (q.correctAnswer || 0) + 1;
        document.getElementById('entMarks').value = q.marks || 1;
        document.getElementById('entSubject').value = q.subject || '';
        document.getElementById('entDifficulty').value = q.difficulty || 'Medium';
        document.getElementById('entranceQuestionModal').classList.add('active');
    } catch (e) { console.error(e); }
}

async function saveEntranceQuestion() {
    const examId = document.getElementById('entQbExam').value;
    if (!examId) return entShowToast('Please select an exam first', 'error');

    const text = document.getElementById('entQText').value.trim();
    const textHindi = document.getElementById('entQTextHindi').value.trim();

    // Validation: English question is required
    if (!text) {
        return entShowToast('English question is required', 'error');
    }

    // English options
    const opts = [
        document.getElementById('entOptA').value.trim(),
        document.getElementById('entOptB').value.trim(),
        document.getElementById('entOptC').value.trim(),
        document.getElementById('entOptD').value.trim()
    ].filter(o => o);

    // Hindi options (optional)
    const optsHindi = [
        document.getElementById('entOptAHindi').value.trim(),
        document.getElementById('entOptBHindi').value.trim(),
        document.getElementById('entOptCHindi').value.trim(),
        document.getElementById('entOptDHindi').value.trim()
    ].filter(o => o);

    // At least 2 English options required
    if (opts.length < 2) {
        return entShowToast('At least 2 English options required', 'error');
    }

    // If Hindi question is provided, Hindi options must be provided
    if (textHindi && optsHindi.length < 2) {
        return entShowToast('At least 2 Hindi options required when Hindi question is provided', 'error');
    }

    const correct = parseInt(document.getElementById('entCorrect').value);
    if (isNaN(correct) || correct < 1 || correct > 4) return entShowToast('Correct answer must be 1-4', 'error');
    if (correct > opts.length) return entShowToast('Correct answer exceeds available options', 'error');

    const body = {
        examId: parseInt(examId),
        question: text,
        questionHindi: textHindi || '',
        options: opts,
        optionsHindi: optsHindi,
        correctAnswer: correct - 1,
        marks: parseInt(document.getElementById('entMarks').value) || 1,
        subject: document.getElementById('entSubject').value.trim(),
        difficulty: document.getElementById('entDifficulty').value
    };
    const id = document.getElementById('entQuestionId').value;
    try {
        const url = id ? '/api/entrance-questions/' + id : '/api/entrance-questions';
        const data = await entApi(url, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (data.success) {
            entShowToast('Question saved', 'success');
            closeModal('entranceQuestionModal');
            loadEntranceQuestions();
        }
    } catch (e) { entShowToast('Error saving question', 'error'); }
}

async function deleteEntranceQuestion(id) {
    if (!confirm('Delete this question?')) return;
    await entApi('/api/entrance-questions/' + id, { method: 'DELETE' });
    loadEntranceQuestions();
}

function toggleAllEntranceQuestions() {
    const checked = document.getElementById('entQSelectAll').checked;
    document.querySelectorAll('.ent-q-check').forEach(c => c.checked = checked);
}

async function deleteSelectedEntranceQuestions() {
    const ids = Array.from(document.querySelectorAll('.ent-q-check:checked')).map(c => c.value);
    if (!ids.length) return entShowToast('Select at least one question', 'error');
    if (!confirm('Delete ' + ids.length + ' selected question(s)?')) return;
    try {
        const data = await entApi('/api/entrance-questions/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        if (data.success) {
            entShowToast('Deleted ' + data.deleted + ' question(s)', 'success');
            loadEntranceQuestions();
        } else {
            entShowToast(data.message || 'Error', 'error');
        }
    } catch (e) { entShowToast('Network error', 'error'); }
}

// ---------- Bulk Upload ----------
function openBulkQuestionModal() {
    const examId = document.getElementById('entQbExam').value;
    if (!examId) return entShowToast('Please select an exam first', 'error');
    document.getElementById('entBulkFile').value = '';
    document.getElementById('entBulkResult').innerHTML = '';
    document.getElementById('entranceBulkModal').classList.add('active');
}

async function uploadBulkQuestions() {
    const examId = document.getElementById('entQbExam').value;
    const file = document.getElementById('entBulkFile').files[0];
    
    if (!examId) return entShowToast('Please select an exam first', 'error');
    if (!file) return entShowToast('Please select a CSV file', 'error');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('examId', examId);

    try {
        const res = await fetch('/api/entrance-questions/bulk-upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
            const errs = data.errors || [];
            let message = 'Imported ' + data.added + ' questions';
            if (errs.length) message += ' (' + errs.length + ' errors skipped)';
            entShowToast(message, 'success');
            if (errs.length) {
                // Show errors briefly before closing
                document.getElementById('entBulkResult').innerHTML =
                    '<div style="padding:12px;background:rgba(239,68,68,0.2);border-radius:8px;color:#fff;max-height:200px;overflow-y:auto;font-size:12px;"><strong>Errors (skipped):</strong><br>' + errs.join('<br>') + '</div>';
                setTimeout(() => closeModal('entranceBulkModal'), 2500);
            } else {
                closeModal('entranceBulkModal');
            }
            loadEntranceQuestions();
        } else {
            entShowToast(data.message || 'Upload failed', 'error');
        }
    } catch (e) { entShowToast('Upload error', 'error'); }
}

function downloadQuestionTemplate() {
    const csv = 'question,question_hindi,option_a,option_a_hindi,option_b,option_b_hindi,option_c,option_c_hindi,option_d,option_d_hindi,correct_answer,marks,subject,difficulty\n' +
        '"What is the full form of CPU?","CPU का पूरा नाम क्या है?","Central Processing Unit","सेंट्रल प्रोसेसिंग यूनिट","Computer Personal Unit","कंप्यूटर पर्सनल यूनिट","Central Program Unit","सेंट्रल प्रोग्राम यूनिट","None of the above","इनमें से कोई नहीं",1,1,Computer Science,Easy\n' +
        '"Which is a programming language?","निम्न में से कौन सी प्रोग्रामिंग भाषा है?","HTML","HTML","Python","Python","CSS","CSS","XML","XML",2,1,Computer Science,Medium\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'entrance-questions-template.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function updateFileLabel(inputId, labelId) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    if (input.files && input.files[0]) {
        label.innerHTML = '<i class="fas fa-check"></i> ' + input.files[0].name;
        label.style.background = '#10b981';
    } else {
        label.innerHTML = '<i class="fas fa-folder-open"></i> Choose File';
        label.style.background = '#4ade80';
    }
}

// ---------- Registrations ----------
async function loadEntranceRegistrations() {
    const examId = document.getElementById('entRegExam').value;
    const tbody = document.querySelector('#entranceRegsTable tbody');
    if (!tbody) return;
    if (!examId) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;">Please select an exam</td></tr>';
        return;
    }
    try {
        const regs = await entApi('/api/entrance-registrations?examId=' + examId);
        const exam = entranceExamsCache.find(e => e.id == examId);
        const shiftMap = {};
        (exam && exam.shifts || []).forEach(s => shiftMap[s.id] = s.name);

        // Populate assign-shift dropdown
        const assignSel = document.getElementById('entAssignShift');
        if (assignSel && exam) {
            assignSel.innerHTML = '<option value="">Select Shift</option>' + (exam.shifts || []).map(s => '<option value="' + s.id + '">' + s.name + '</option>').join('');
        }

        if (!regs.length) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;">No registrations yet</td></tr>';
            return;
        }
        tbody.innerHTML = regs.map(r => {
            const statusBadge = r.suspended
                ? '<span class="badge" style="background:#dc2626;color:#fff;" title="' + (r.suspendReason || '') + '"><i class="fas fa-ban"></i> Suspended</span>'
                : '<span class="badge">' + (r.status || '') + '</span>';
            return '<tr' + (r.suspended ? ' style="background:rgba(220,38,38,0.08);"' : '') + '>' +
                '<td><input type="checkbox" class="ent-reg-check" value="' + r.id + '"></td>' +
                '<td>' + (r.registrationNo || '') + '</td>' +
                '<td>' + (r.studentName || '') + '</td>' +
                '<td>' + (r.phone || '') + '</td>' +
                '<td>' + (r.course || '-') + '</td>' +
                '<td>' + (shiftMap[r.shiftId] || '<span style="color:#fbbf24;">Not Assigned</span>') + '</td>' +
                '<td><code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;">' + (r.loginPassword || '') + '</code></td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' +
                '<button class="action-btn" title="Edit" onclick="editEntranceRegistration(' + JSON.stringify(r).replace(/"/g, '&quot;') + ')" style="color:#3b82f6;"><i class="fas fa-edit"></i></button> ' +
                (r.suspended
                    ? '<button class="action-btn" title="Unsuspend" onclick="toggleSuspendStudent(' + r.id + ', false)" style="color:#10b981;"><i class="fas fa-unlock"></i></button> '
                    : '<button class="action-btn" title="Suspend ID" onclick="toggleSuspendStudent(' + r.id + ', true)" style="color:#fbbf24;"><i class="fas fa-ban"></i></button> ') +
                '<button class="action-btn" onclick="deleteEntranceRegistration(' + r.id + ')"><i class="fas fa-trash"></i></button>' +
                '</td>' +
                '</tr>';
        }).join('');
    } catch (e) { console.error(e); }
}

function toggleAllEntranceRegs() {
    const checked = document.getElementById('entRegSelectAll').checked;
    document.querySelectorAll('.ent-reg-check').forEach(c => c.checked = checked);
}

function openEntranceRegistrationModal() {
    document.getElementById('entRegId').value = '';
    ['entRegIdNo','entRegName','entRegFather','entRegPhone','entRegQualification','entRegCourse'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    // Populate exam dropdown
    const sel = document.getElementById('entRegExamSel');
    sel.innerHTML = '<option value="">Select Exam</option>' + entranceExamsCache.map(e => '<option value="' + e.id + '">' + e.name + '</option>').join('');
    document.getElementById('entRegShiftSel').innerHTML = '<option value="">Select Shift</option>';
    document.querySelector('#entranceRegModal h3').innerHTML = '<i class="fas fa-user-plus" style="color:#667eea;"></i> Register Student for Entrance Exam';
    document.getElementById('entranceRegModal').classList.add('active');
}

function editEntranceRegistration(reg) {
    document.getElementById('entRegId').value = reg.id;
    document.getElementById('entRegIdNo').value = reg.registrationNo || '';
    document.getElementById('entRegName').value = reg.studentName || '';
    document.getElementById('entRegFather').value = reg.fatherName || '';
    document.getElementById('entRegGender').value = reg.gender || 'Male';
    document.getElementById('entRegPhone').value = reg.phone || '';
    document.getElementById('entRegQualification').value = reg.qualification || '';
    document.getElementById('entRegCourse').value = reg.course || '';
    
    // Populate exam dropdown
    const sel = document.getElementById('entRegExamSel');
    sel.innerHTML = '<option value="">Select Exam</option>' + entranceExamsCache.map(e => '<option value="' + e.id + '">' + e.name + '</option>').join('');
    sel.value = reg.examId || '';
    
    // Populate shift dropdown
    const shiftSel = document.getElementById('entRegShiftSel');
    const exam = entranceExamsCache.find(e => e.id == reg.examId);
    if (exam && exam.shifts) {
        shiftSel.innerHTML = '<option value="">No Shift</option>' + exam.shifts.map(s => '<option value="' + s.id + '">' + s.name + '</option>').join('');
        shiftSel.value = reg.shiftId || '';
    }
    
    document.querySelector('#entranceRegModal h3').innerHTML = '<i class="fas fa-edit" style="color:#667eea;"></i> Edit Registration';
    document.getElementById('entranceRegModal').classList.add('active');
}

function loadShiftsForRegistration() {
    const examId = document.getElementById('entRegExamSel').value;
    const exam = entranceExamsCache.find(e => e.id == examId);
    const sel = document.getElementById('entRegShiftSel');
    if (!exam) { sel.innerHTML = '<option value="">Select Shift</option>'; return; }
    sel.innerHTML = '<option value="">Select Shift</option>' + (exam.shifts || []).map(s => '<option value="' + s.id + '">' + s.name + ' (' + new Date(s.scheduledStart).toLocaleString() + ')</option>').join('');
}

function autoFillCourse() {
    const qual = document.getElementById('entRegQualification').value;
    const courseInput = document.getElementById('entRegCourse');
    if (qual === '12th') {
        courseInput.value = 'DCA';
    } else if (qual === 'Graduate' || qual === 'Post Graduate') {
        courseInput.value = 'PGDCA';
    } else {
        courseInput.value = '';
    }
}

async function saveEntranceRegistration() {
    const regId = document.getElementById('entRegId').value;
    const regIdNo = document.getElementById('entRegIdNo').value.trim();
    const body = {
        registrationNo: regIdNo,
        examId: document.getElementById('entRegExamSel').value,
        shiftId: document.getElementById('entRegShiftSel').value || null,
        studentName: document.getElementById('entRegName').value.trim(),
        fatherName: document.getElementById('entRegFather').value.trim(),
        gender: document.getElementById('entRegGender').value,
        phone: document.getElementById('entRegPhone').value.trim(),
        qualification: document.getElementById('entRegQualification').value.trim(),
        course: document.getElementById('entRegCourse').value.trim()
    };
    if (!body.registrationNo) return entShowToast('Registration ID is required', 'error');
    if (!body.examId) return entShowToast('Select an exam', 'error');
    if (!body.studentName) return entShowToast('Student name is required', 'error');
    if (!body.phone) return entShowToast('Phone is required', 'error');

    try {
        const isEdit = !!regId;
        const url = isEdit ? '/api/entrance-registrations/' + regId : '/api/entrance-registrations';
        const method = isEdit ? 'PUT' : 'POST';
        
        const data = await entApi(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (data.success) {
            if (!isEdit) {
                const r = data.registration;
                alert('Registration successful!\n\nRegistration No: ' + r.registrationNo + '\nLogin Password: ' + r.loginPassword + '\n\nShare these credentials with the student.');
            } else {
                entShowToast('Registration updated', 'success');
            }
            closeModal('entranceRegModal');
            // Set filter to this exam
            document.getElementById('entRegExam').value = body.examId;
            loadEntranceRegistrations();
        } else {
            entShowToast(data.message || 'Error', 'error');
        }
    } catch (e) { entShowToast('Network error', 'error'); }
}

async function deleteEntranceRegistration(id) {
    if (!confirm('Delete this registration?')) return;
    await entApi('/api/entrance-registrations/' + id, { method: 'DELETE' });
    loadEntranceRegistrations();
}

async function toggleSuspendStudent(id, suspend) {
    let reason = '';
    if (suspend) {
        reason = prompt('Reason for suspending this student:', 'Suspicious activity / Cheating');
        if (reason === null) return;
        if (!reason.trim()) reason = 'Suspicious activity';
        if (!confirm('Suspend this student?\n\nReason: ' + reason + '\n\nThey will be immediately blocked from logging in or continuing the exam.')) return;
    } else {
        if (!confirm('Unsuspend this student? They will be able to log in again.')) return;
    }
    try {
        const data = await entApi('/api/entrance-registrations/' + id + '/toggle-suspend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason, adminName: localStorage.getItem('adminUser') || 'admin' })
        });
        if (data.success) {
            entShowToast(data.registration.suspended ? 'Student suspended' : 'Student unsuspended', 'success');
            loadEntranceRegistrations();
            // If on monitor page, refresh that too
            if (typeof loadEntranceMonitor === 'function') loadEntranceMonitor();
        }
    } catch (e) { entShowToast('Error', 'error'); }
}

function openShiftAssignModal() {
    const selected = Array.from(document.querySelectorAll('.ent-reg-check:checked')).map(c => parseInt(c.value));
    if (!selected.length) return entShowToast('Select at least one student', 'error');
    document.getElementById('entAssignCount').textContent = selected.length + ' students selected';
    document.getElementById('entranceShiftAssignModal').classList.add('active');
}

async function confirmShiftAssignment() {
    const shiftId = document.getElementById('entAssignShift').value;
    if (!shiftId) return entShowToast('Select a shift', 'error');
    const selected = Array.from(document.querySelectorAll('.ent-reg-check:checked')).map(c => parseInt(c.value));
    try {
        const data = await entApi('/api/entrance-registrations/assign-shift', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationIds: selected, shiftId })
        });
        if (data.success) {
            entShowToast('Assigned ' + data.updated + ' students', 'success');
            closeModal('entranceShiftAssignModal');
            loadEntranceRegistrations();
        }
    } catch (e) { entShowToast('Error', 'error'); }
}

function exportEntranceRegistrations() {
    const examId = document.getElementById('entRegExam').value;
    if (!examId) return entShowToast('Select an exam', 'error');
    fetch('/api/entrance-registrations?examId=' + examId).then(r => r.json()).then(regs => {
        const exam = entranceExamsCache.find(e => e.id == examId);
        const shiftMap = {};
        (exam && exam.shifts || []).forEach(s => shiftMap[s.id] = s.name);
        const rows = regs.map(r => ({
            'Reg No': r.registrationNo,
            'Name': r.studentName,
            'Father Name': r.fatherName || '',
            'DOB': r.dob || '',
            'Gender': r.gender || '',
            'Phone': r.phone || '',
            'Email': r.email || '',
            'Category': r.category || '',
            'Course': r.course || '',
            'Shift': shiftMap[r.shiftId] || '',
            'Password': r.loginPassword,
            'Status': r.status
        }));
        if (typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Registrations');
            XLSX.writeFile(wb, 'entrance-registrations.xlsx');
        }
    });
}

// ---------- Live Monitoring ----------
let entMonitorTimer = null;
async function loadEntranceMonitor() {
    const examId = document.getElementById('entMonitorExam').value;
    const tbody = document.querySelector('#entMonitorTable tbody');
    if (!tbody) return;
    if (!examId) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Please select an exam</td></tr>';
        return;
    }
    try {
        const data = await entApi('/api/entrance/monitor/' + examId);
        const inProg = data.filter(d => !d.submitted).length;
        const sub = data.filter(d => d.submitted).length;
        document.getElementById('entMonStarted').textContent = data.length;
        document.getElementById('entMonProgress').textContent = inProg;
        document.getElementById('entMonSubmitted').textContent = sub;

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">No active sessions yet</td></tr>';
        } else {
            tbody.innerHTML = data.map(a => {
                let statusBadge;
                if (a.suspended) statusBadge = '<span class="badge" style="background:#dc2626;color:#fff;"><i class="fas fa-ban"></i> Suspended</span>';
                else if (a.submitted) statusBadge = '<span class="badge" style="background:#10b981;color:#fff;">Submitted</span>';
                else statusBadge = '<span class="badge" style="background:#f59e0b;color:#fff;">In Progress</span>';
                const action = a.submitted
                    ? '<span style="opacity:0.4;">-</span>'
                    : (a.suspended
                        ? '<button class="action-btn" title="Unsuspend" onclick="toggleSuspendStudent(' + a.registrationId + ', false)" style="color:#10b981;"><i class="fas fa-unlock"></i></button>'
                        : '<button class="action-btn" title="Suspend ID" onclick="toggleSuspendStudent(' + a.registrationId + ', true)" style="color:#dc2626;"><i class="fas fa-ban"></i> Suspend</button>');
                return '<tr' + (a.suspended ? ' style="background:rgba(220,38,38,0.08);"' : '') + '>' +
                    '<td>' + (a.registrationNo || '') + '</td>' +
                    '<td>' + (a.studentName || '') + '</td>' +
                    '<td>' + entFmtDateTime(a.startedAt) + '</td>' +
                    '<td>' + statusBadge + '</td>' +
                    '<td>' + (a.submitted ? (a.marksObtained + ' / ' + a.totalMarks) : '-') + '</td>' +
                    '<td>' + action + '</td>' +
                    '</tr>';
            }).join('');
        }
    } catch (e) { console.error(e); }
}

function startMonitorAutoRefresh() {
    stopMonitorAutoRefresh();
    entMonitorTimer = setInterval(loadEntranceMonitor, 10000);
}
function stopMonitorAutoRefresh() {
    if (entMonitorTimer) { clearInterval(entMonitorTimer); entMonitorTimer = null; }
}

// ---------- Results ----------
async function loadEntranceResults() {
    const examId = document.getElementById('entResultExam').value;
    const tbody = document.querySelector('#entranceResultsTable tbody');
    if (!tbody) return;
    if (!examId) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;">Please select an exam</td></tr>';
        return;
    }
    try {
        const results = await entApi('/api/entrance-results?examId=' + examId);
        entranceCurrentResults = results;
        if (!results.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;">No results yet</td></tr>';
            return;
        }
        tbody.innerHTML = results.map(r =>
            '<tr>' +
            '<td>' + (r.registrationNo || '') + '</td>' +
            '<td>' + (r.studentName || '') + (r.manuallyEdited ? ' <span title="Marks manually edited" style="color:#fbbf24;font-size:11px;">(edited)</span>' : '') + '</td>' +
            '<td>' + r.marksObtained + '</td>' +
            '<td>' + r.totalMarks + '</td>' +
            '<td>' + r.percentage + '%</td>' +
            '<td>' + entFmtDateTime(r.submittedAt) + '</td>' +
            '<td><span class="badge" style="background:' + (r.published ? '#10b981' : '#6b7280') + ';color:#fff;cursor:pointer;" onclick="toggleEntranceResultPublish(' + r.id + ')" title="Click to toggle">' + (r.published ? 'Published' : 'Hidden') + '</span></td>' +
            '<td>' +
            '<button class="action-btn" title="Preview PDF" onclick="previewEntranceResultPDF(' + r.id + ')"><i class="fas fa-eye"></i></button> ' +
            '<button class="action-btn" title="Download PDF" onclick="downloadEntranceResultPDF(' + r.id + ')"><i class="fas fa-file-pdf"></i></button> ' +
            '<button class="action-btn" title="Edit Marks" onclick="editEntranceResultMarks(' + r.id + ')"><i class="fas fa-edit"></i></button> ' +
            '<button class="action-btn" title="Toggle Publish" onclick="toggleEntranceResultPublish(' + r.id + ')"><i class="fas fa-' + (r.published ? 'eye-slash' : 'check') + '"></i></button> ' +
            '<button class="action-btn" title="Delete & Allow Retake" onclick="deleteEntranceResult(' + r.id + ', true)" style="color:#fca5a5;"><i class="fas fa-redo"></i></button> ' +
            '<button class="action-btn" title="Delete Permanently" onclick="deleteEntranceResult(' + r.id + ', false)" style="color:#f87171;"><i class="fas fa-trash"></i></button>' +
            '</td>' +
            '</tr>'
        ).join('');
    } catch (e) { console.error(e); }
}

async function publishEntranceResults(publish) {
    const examId = document.getElementById('entResultExam').value;
    if (!examId) return entShowToast('Select an exam', 'error');
    if (!confirm((publish ? 'Publish' : 'Unpublish') + ' all results for this exam?')) return;
    try {
        const data = await entApi('/api/entrance-results/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examId, publish })
        });
        if (data.success) {
            entShowToast('Updated ' + data.updated + ' results', 'success');
            loadEntranceResults();
        }
    } catch (e) { entShowToast('Error', 'error'); }
}

async function toggleEntranceResultPublish(id) {
    try {
        const data = await entApi('/api/entrance-results/' + id + '/toggle-publish', { method: 'POST' });
        if (data.success) {
            entShowToast('Result ' + (data.result.published ? 'published' : 'unpublished'), 'success');
            loadEntranceResults();
        }
    } catch (e) { entShowToast('Error', 'error'); }
}

async function editEntranceResultMarks(id) {
    const r = entranceCurrentResults.find(x => x.id == id);
    if (!r) return;
    const newMarks = prompt('Edit marks for ' + r.studentName + '\n\nCurrent: ' + r.marksObtained + ' / ' + r.totalMarks + '\n\nEnter new marks (0 - ' + r.totalMarks + '):', r.marksObtained);
    if (newMarks === null) return;
    const m = parseFloat(newMarks);
    if (isNaN(m) || m < 0 || m > r.totalMarks) return entShowToast('Invalid marks', 'error');
    try {
        const data = await entApi('/api/entrance-results/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marksObtained: m })
        });
        if (data.success) {
            entShowToast('Marks updated', 'success');
            loadEntranceResults();
        } else {
            entShowToast(data.message || 'Error', 'error');
        }
    } catch (e) { entShowToast('Network error', 'error'); }
}

async function deleteEntranceResult(id, allowRetake) {
    const msg = allowRetake
        ? 'Delete this result AND allow the student to retake the exam?\n\nThis removes their attempt completely.'
        : 'Delete this result permanently?\n\nThe student will keep their submitted attempt locked.';
    if (!confirm(msg)) return;
    try {
        const data = await entApi('/api/entrance-results/' + id + '?allowRetake=' + (allowRetake ? 'true' : 'false'), { method: 'DELETE' });
        if (data.success) {
            entShowToast(allowRetake ? 'Result deleted, retake allowed' : 'Result deleted', 'success');
            loadEntranceResults();
        }
    } catch (e) { entShowToast('Error', 'error'); }
}

async function reEvaluateEntranceResults() {
    const examId = document.getElementById('entResultExam').value;
    if (!examId) return entShowToast('Select an exam', 'error');
    if (!confirm('Re-evaluate all results for this exam using current correct answers?\n\nThis will overwrite any manually edited marks.')) return;
    try {
        const data = await entApi('/api/entrance-results/re-evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examId })
        });
        if (data.success) {
            entShowToast('Re-evaluated ' + data.updated + ' result(s)', 'success');
            loadEntranceResults();
        }
    } catch (e) { entShowToast('Error', 'error'); }
}

let instituteSettings = null;

// Load institute settings for logo
async function loadInstituteSettings() {
    try {
        instituteSettings = await fetch('/api/settings').then(r => r.json());
    } catch (e) {
        console.error('Failed to load institute settings', e);
    }
}

// Download entrance result PDF
function downloadEntranceResultPDF(id) {
    window.location.href = '/api/entrance-result-pdf/' + id;
}

// Preview entrance result PDF
window.previewEntranceResultPDF = async function(id) {
    try {
        const response = await fetch('/api/entrance-result-pdf/' + id);
        if (!response.ok) {
            throw new Error('Failed to generate PDF');
        }
        const blob = await response.blob();
        const pdfUrl = URL.createObjectURL(blob);
        
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
        modal.id = 'pdfPreviewModal';
        modal.innerHTML = `
            <div style="max-width:900px;width:90%;height:90vh;background:#fff;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:20px;border-bottom:1px solid #e5e7eb;">
                    <h2 style="margin:0;color:#1e3a8a;">Result PDF Preview</h2>
                    <button onclick="window.closePdfPreview()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#6b7280;padding:5px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="flex:1;overflow:auto;border:1px solid #e5e7eb;background:#f3f4f6;">
                    <iframe src="${pdfUrl}" style="width:100%;height:100%;border:none;"></iframe>
                </div>
                <div style="display:flex;gap:10px;padding:20px;border-top:1px solid #e5e7eb;justify-content:flex-end;">
                    <button onclick="window.closePdfPreview()" style="padding:10px 20px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;">
                        <i class="fas fa-times"></i> Close
                    </button>
                    <button onclick="window.printPdfPreview('${pdfUrl}')" style="padding:10px 20px;background:#1e3a8a;color:#fff;border:none;border-radius:6px;cursor:pointer;">
                        <i class="fas fa-print"></i> Print
                    </button>
                    <button onclick="window.downloadEntranceResultPDF(${id})" style="padding:10px 20px;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error previewing PDF:', error);
        entShowToast('Failed to preview PDF', 'error');
    }
};

window.closePdfPreview = function() {
    const modal = document.getElementById('pdfPreviewModal');
    if (modal) {
        modal.remove();
    }
};

window.printPdfPreview = function(pdfUrl) {
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
        printWindow.onload = function() {
            printWindow.print();
        };
    }
};


async function saveEntranceSubmissionSettings() {
    const settings = {
        resultPublishDate: document.getElementById('entResultPublishDate').value,
        autoLogout: document.getElementById('entAutoLogout').checked,
        showScore: document.getElementById('entShowScore').checked,
        confirmMessage: document.getElementById('entConfirmMessage').value
    };
    
    try {
        await entApi('/api/entrance-submission-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        entShowToast('Submission settings saved', 'success');
    } catch (e) {
        entShowToast('Error saving settings', 'error');
    }
}

async function loadEntranceSubmissionSettings() {
    try {
        const settings = await entApi('/api/entrance-submission-settings');
        document.getElementById('entResultPublishDate').value = settings.resultPublishDate || '';
        document.getElementById('entAutoLogout').checked = settings.autoLogout || false;
        document.getElementById('entShowScore').checked = settings.showScore || false;
        document.getElementById('entConfirmMessage').value = settings.confirmMessage || '';
        
        // Update toggle sliders
        updateToggleSlider('entAutoLogout', 'entAutoLogoutSlider');
        updateToggleSlider('entShowScore', 'entShowScoreSlider');
    } catch (e) {
        console.error('Error loading submission settings', e);
    }
}

function updateToggleSlider(checkboxId, sliderId) {
    const checkbox = document.getElementById(checkboxId);
    const slider = document.getElementById(sliderId);
    if (!checkbox || !slider) return;
    
    const isChecked = checkbox.checked;
    slider.style.background = isChecked ? '#10b981' : '#374151';
    slider.innerHTML = '<span style="position:absolute;top:2px;left:' + (isChecked ? '26px' : '2px') + ';width:24px;height:24px;background:#fff;border-radius:50%;transition:.3s;"></span>';
}

function exportEntranceResults() {
    if (!entranceCurrentResults.length) return entShowToast('No results loaded', 'error');
    const rows = entranceCurrentResults.map(r => ({
        'Reg No': r.registrationNo,
        'Name': r.studentName,
        'Marks': r.marksObtained,
        'Total': r.totalMarks,
        'Percentage': r.percentage,
        'Submitted At': r.submittedAt,
        'Published': r.published ? 'Yes' : 'No'
    }));
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Results');
        XLSX.writeFile(wb, 'entrance-results.xlsx');
    }
}

// ---------- Page Hooks ----------
// Hook into existing showPage navigation (data-page attribute clicks)
document.addEventListener('DOMContentLoaded', function () {
    // Load institute settings for logo
    loadInstituteSettings();
    
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', function () {
            setTimeout(() => {
                const page = this.getAttribute('data-page');
                if (page === 'entrance-dashboard') loadEntranceDashboard();
                else if (page === 'entrance-exams') loadEntranceExams();
                else if (page === 'entrance-questions') { loadEntranceExams(); loadEntranceQuestions(); }
                else if (page === 'entrance-registrations') { loadEntranceExams(); loadEntranceRegistrations(); }
                else if (page === 'entrance-monitor') { loadEntranceExams(); loadEntranceMonitor(); startMonitorAutoRefresh(); }
                else if (page === 'entrance-results') { loadEntranceExams(); loadEntranceResults(); }
                else if (page === 'entrance-settings') loadEntranceSettings();
                else stopMonitorAutoRefresh();
            }, 50);
        });
    });
});
