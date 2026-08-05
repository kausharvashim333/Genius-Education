const FB = {
    'Computer Basics': { icon: 'fa-desktop', questions: [
        { type:'mcq', q:'CPU ka full form?', options:['Central Processing Unit','Computer Personal Unit','Central Print Unit','Control Processing Unit'], answer:0, difficulty:'easy', explanation:'CPU = Central Processing Unit. Computer ka brain.' },
        { type:'mcq', q:'RAM ka full form?', options:['Read Access Memory','Random Access Memory','Read Available Memory','Random Available Memory'], answer:1, difficulty:'easy', explanation:'RAM = Random Access Memory. Volatile memory.' },
        { type:'mcq', q:'1 Byte me kitne bits?', options:['4','8','16','32'], answer:1, difficulty:'easy', explanation:'1 Byte = 8 bits.' },
        { type:'descriptive', q:'RAM aur ROM me difference batayein.', keywords:['ram','random','volatile','temporary','rom','read only','non-volatile','permanent','data','power'], minKeywords:4, modelAnswer:'RAM volatile/temporary memory hai, ROM non-volatile/permanent memory hai. RAM data power off pe delete ho jata hai, ROM me data permanently stored rehta hai.', difficulty:'medium', explanation:'RAM=volatile, ROM=non-volatile.' }
    ]},
    'MS Office': { icon:'fa-file-word', questions: [
        { type:'mcq', q:'MS Word me new document shortcut?', options:['Ctrl+N','Ctrl+O','Ctrl+S','Ctrl+P'], answer:0, difficulty:'easy', explanation:'Ctrl+N = New document.' },
        { type:'mcq', q:'Excel me SUM function ka kaam?', options:['Count','Add','Average','Max'], answer:1, difficulty:'easy', explanation:'SUM numbers ko add karta hai.' },
        { type:'descriptive', q:'Excel me formula aur function ka difference batayein.', keywords:['formula','function','calculation','sum','average','predefined','custom','operator','cell'], minKeywords:4, modelAnswer:'Formula custom calculation hai jo user likhta hai (=A1+B1). Function predefined hai (=SUM(A1:A10)).', difficulty:'medium', explanation:'Formula=custom, Function=predefined.' }
    ]},
    'Tally': { icon:'fa-calculator', questions: [
        { type:'mcq', q:'Tally me company banane ka key?', options:['Alt+F1','Alt+F3','Ctrl+F3','F1'], answer:1, difficulty:'easy', explanation:'Alt+F3 = Company creation.' },
        { type:'mcq', q:'Double Entry system ka matlab?', options:['Do baar entry','Debit aur credit dono','Do accounts','Do baar save'], answer:1, difficulty:'medium', explanation:'Har transaction me debit aur credit dono hote hain.' },
        { type:'descriptive', q:'Accounting ke Golden Rules batayein.', keywords:['debit','credit','real','personal','nominal','assets','expenses','income','what comes in','receiver','giver'], minKeywords:5, modelAnswer:'3 Golden Rules: Real Account (Debit what comes in, Credit what goes out), Personal Account (Debit receiver, Credit giver), Nominal Account (Debit expenses/losses, Credit incomes/gains).', difficulty:'hard', explanation:'Real, Personal, Nominal - 3 golden rules.' }
    ]},
    'Web Development': { icon:'fa-code', questions: [
        { type:'mcq', q:'HTML ka full form?', options:['Hyper Text Markup Language','High Text Machine Language','Hyper Tabular Markup Language','None'], answer:0, difficulty:'easy', explanation:'HTML = Hyper Text Markup Language.' },
        { type:'mcq', q:'CSS ka full form?', options:['Computer Style Sheets','Cascading Style Sheets','Colorful Style Sheets','Creative Style Sheets'], answer:1, difficulty:'easy', explanation:'CSS = Cascading Style Sheets.' },
        { type:'descriptive', q:'HTML aur CSS ka difference batayein.', keywords:['html','structure','content','css','style','design','presentation','markup','layout','colors'], minKeywords:4, modelAnswer:'HTML web page ka structure/content define karta hai. CSS styling/presentation handle karta hai (colors, fonts, layout). HTML skeleton hai, CSS decoration.', difficulty:'easy', explanation:'HTML=structure, CSS=style.' }
    ]},
    'General HR': { icon:'fa-user-tie', questions: [
        { type:'mcq', q:'Tell me about yourself - best answer?', options:['Personal life','Professional background + skills','Sirf education','Sirf hobbies'], answer:1, difficulty:'easy', explanation:'Professional background, skills, career interest briefly.' },
        { type:'mcq', q:'Why do you want this job?', options:['Money','Company positive + role interest','Koi reason nahi','Experience ke liye'], answer:1, difficulty:'medium', explanation:'Company research karke positive point batao.' },
        { type:'descriptive', q:'"Tell me about yourself" ka answer kaise dena chahiye? Apna answer likhein.', keywords:['name','education','experience','skills','background','career','interest','qualification','work','professional'], minKeywords:4, modelAnswer:'My name is [Name]. I have completed my [degree] from [institute]. I have [X] years of experience in [field]. My key skills are [skills]. I am interested in [career area] and want to grow my career in this field.', difficulty:'easy', explanation:'Name, education, experience, skills, career interest - briefly cover karo.' },
        { type:'descriptive', q:'"What are your strengths and weaknesses?" ka answer kaise dena chahiye?', keywords:['strength','weakness','honest','positive','improve','hardworking','dedicated','quick learner','overcome','effort','genuine'], minKeywords:4, modelAnswer:'Strengths: I am hardworking, dedicated, and a quick learner. Weaknesses: I sometimes focus too much on details, but I am learning to prioritize tasks better. Always mention a real weakness and how you are improving it.', difficulty:'medium', explanation:'Real strengths + genuine weakness with improvement effort.' }
    ]}
};

let QUESTION_BANK = {};
let currentCategory = null;
let currentQuestions = [];
let currentQIndex = 0;
let selectedOption = null;
let descAnswer = '';
let score = 0;
let answered = false;
let currentMode = 'mcq';
let resultBreakdown = [];

async function init() {
    try {
        const res = await fetch('/api/interview-questions');
        const data = await res.json();
        if (data.categories && data.categories.length > 0) {
            data.categories.forEach(cat => {
                QUESTION_BANK[cat.name] = { icon: cat.icon || 'fa-question-circle', questions: cat.questions || [] };
            });
        } else { QUESTION_BANK = FB; }
    } catch (err) { QUESTION_BANK = FB; }
    renderCategories();
}

function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.ip-mode-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.mode === mode);
    });
    renderCategories();
}

function renderCategories() {
    const container = document.getElementById('categories');
    if (!container) return;
    let html = '';
    for (const [name, data] of Object.entries(QUESTION_BANK)) {
        let count;
        if (currentMode === 'mcq') count = data.questions.filter(q => q.type !== 'descriptive').length;
        else if (currentMode === 'descriptive') count = data.questions.filter(q => q.type === 'descriptive').length;
        else count = data.questions.length;
        if (count === 0) continue;
        html += `<div class="ip-cat-card" onclick="startQuiz('${name.replace(/'/g,"\\'")}')">
            <div class="ip-cat-icon"><i class="fas ${data.icon}"></i></div>
            <div class="ip-cat-name">${name}</div>
            <div class="ip-cat-count">${count} Questions</div>
        </div>`;
    }
    container.innerHTML = html;
}

function startQuiz(category) {
    currentCategory = category;
    let allQs = [...QUESTION_BANK[category].questions];
    if (currentMode === 'mcq') currentQuestions = allQs.filter(q => q.type !== 'descriptive');
    else if (currentMode === 'descriptive') currentQuestions = allQs.filter(q => q.type === 'descriptive');
    else currentQuestions = allQs;
    currentQIndex = 0;
    score = 0;
    resultBreakdown = [];
    document.getElementById('categories').style.display = 'none';
    document.getElementById('quizArea').classList.add('active');
    renderQuestion();
}

function renderQuestion() {
    if (currentQIndex >= currentQuestions.length) { showResults(); return; }
    const q = currentQuestions[currentQIndex];
    selectedOption = null;
    descAnswer = '';
    answered = false;
    const progress = (currentQIndex / currentQuestions.length) * 100;
    const isDesc = q.type === 'descriptive';
    const typeBadge = isDesc
        ? '<span class="ip-q-type-badge ip-type-desc"><i class="fas fa-pen-to-square"></i> Descriptive</span>'
        : '<span class="ip-q-type-badge ip-type-mcq"><i class="fas fa-list-ul"></i> MCQ</span>';

    let bodyHtml = '';
    if (isDesc) {
        bodyHtml = `
            <div class="ip-desc-hint"><i class="fas fa-lightbulb"></i> Apne words me answer likhein. System keywords check karega.</div>
            <div class="ip-desc-area">
                <textarea class="ip-desc-textarea" id="descTextarea" placeholder="Yahan apna answer likhein..." oninput="onDescInput(this)"></textarea>
                <div class="ip-desc-meta">
                    <span><i class="fas fa-key"></i> ${q.keywords.length} keywords to include</span>
                    <span id="wordCount">0 words</span>
                </div>
            </div>
            <div class="ip-keyword-feedback" id="keywordFeedback"></div>`;
    } else {
        bodyHtml = `
            <div class="ip-options" id="optionsContainer">
                ${(q.options||[]).map((opt,i) => `<div class="ip-option" onclick="selectOption(${i})"><span class="ip-opt-letter">${String.fromCharCode(65+i)}</span>${esc(opt)}</div>`).join('')}
            </div>
            <div class="ip-explanation" id="explanation"><strong>Explanation:</strong> ${esc(q.explanation||'')}</div>`;
    }

    document.getElementById('quizArea').innerHTML = `
        <div class="ip-quiz-header">
            <div class="ip-quiz-title"><i class="fas ${QUESTION_BANK[currentCategory].icon}"></i> ${currentCategory}</div>
            <button class="ip-back-btn" onclick="backToCategories()"><i class="fas fa-arrow-left"></i> Back</button>
        </div>
        <div class="ip-progress-bar"><div class="ip-progress-fill" style="width:${progress}%"></div></div>
        <div class="ip-quiz-progress">Question ${currentQIndex+1} of ${currentQuestions.length}</div>
        <div class="ip-question">${typeBadge} ${esc(q.q)} <span class="ip-difficulty ip-diff-${q.difficulty}">${q.difficulty}</span></div>
        ${bodyHtml}
        <div class="ip-quiz-actions">
            <button class="ip-btn ip-btn-primary" id="nextBtn" onclick="nextQuestion()" disabled>${isDesc?'Submit Answer':'Next'} <i class="fas ${isDesc?'fa-check':'fa-arrow-right'}"></i></button>
        </div>`;
}

function onDescInput(ta) {
    descAnswer = ta.value;
    const wc = ta.value.trim().split(/\s+/).filter(w => w.length > 0).length;
    const wcEl = document.getElementById('wordCount');
    if (wcEl) wcEl.textContent = wc + ' words';
    const btn = document.getElementById('nextBtn');
    if (btn) btn.disabled = wc < 3;
}

function selectOption(i) {
    if (answered) return;
    selectedOption = i;
    document.querySelectorAll('.ip-option').forEach((o, idx) => {
        o.classList.remove('selected');
        if (idx === i) o.classList.add('selected');
    });
    document.getElementById('nextBtn').disabled = false;
}

function checkDescriptive() {
    const q = currentQuestions[currentQIndex];
    const answerLower = descAnswer.toLowerCase();
    const found = [], missed = [];
    q.keywords.forEach(kw => {
        if (answerLower.includes(kw.toLowerCase())) found.push(kw);
        else missed.push(kw);
    });
    const ratio = found.length / q.keywords.length;
    const passed = found.length >= (q.minKeywords || Math.ceil(q.keywords.length * 0.5));
    if (passed) score++;
    resultBreakdown.push({ q: q.q, result: passed ? (ratio === 1 ? 'correct' : 'partial') : 'wrong', score: Math.round(ratio * 100) });

    const fb = document.getElementById('keywordFeedback');
    if (fb) {
        fb.classList.add('active');
        fb.innerHTML = `
            <div class="ip-kf-title"><i class="fas fa-spell-check"></i> Keyword Analysis</div>
            <div class="ip-kf-tags">
                ${found.map(k => `<span class="ip-kf-tag found"><i class="fas fa-check"></i> ${esc(k)}</span>`).join('')}
                ${missed.map(k => `<span class="ip-kf-tag missed"><i class="fas fa-times"></i> ${esc(k)}</span>`).join('')}
            </div>
            <div class="ip-kf-score">You included <strong>${found.length}</strong> out of <strong>${q.keywords.length}</strong> keywords. ${passed ? '<span style="color:#4ade80">Passed!</span>' : '<span style="color:#f87171">Try to include more keywords.</span>'}</div>
            <div class="ip-model-answer"><strong>Model Answer:</strong> ${esc(q.modelAnswer || q.explanation || '')}</div>`;
    }
}

function nextQuestion() {
    const q = currentQuestions[currentQIndex];
    const isDesc = q.type === 'descriptive';
    if (isDesc) {
        if (descAnswer.trim().length < 3) return;
        if (!answered) {
            answered = true;
            checkDescriptive();
            document.getElementById('descTextarea').disabled = true;
            const btn = document.getElementById('nextBtn');
            btn.innerHTML = currentQIndex + 1 < currentQuestions.length ? 'Next <i class="fas fa-arrow-right"></i>' : 'See Results <i class="fas fa-trophy"></i>';
        } else { currentQIndex++; renderQuestion(); }
    } else {
        if (selectedOption === null) return;
        if (!answered) {
            answered = true;
            const opts = document.querySelectorAll('.ip-option');
            opts.forEach((o, idx) => {
                o.style.cursor = 'default';
                if (idx === q.answer) o.classList.add('correct');
                else if (idx === selectedOption) o.classList.add('wrong');
            });
            const correct = selectedOption === q.answer;
            if (correct) score++;
            resultBreakdown.push({ q: q.q, result: correct ? 'correct' : 'wrong', score: correct ? 100 : 0 });
            const expl = document.getElementById('explanation');
            if (expl) expl.classList.add('active');
            document.getElementById('nextBtn').innerHTML = currentQIndex + 1 < currentQuestions.length ? 'Next <i class="fas fa-arrow-right"></i>' : 'See Results <i class="fas fa-trophy"></i>';
        } else { currentQIndex++; renderQuestion(); }
    }
}

function showResults() {
    const total = currentQuestions.length;
    const pct = Math.round((score / total) * 100);
    let msg = '';
    if (pct >= 80) msg = 'Excellent! Aap interview ke liye fully ready ho.';
    else if (pct >= 60) msg = 'Good! Thoda aur practice karo.';
    else if (pct >= 40) msg = 'Average. Topics revise karo aur dobara try karo.';
    else msg = 'Aur study karna padega. Revision karo.';

    const breakdownHtml = resultBreakdown.map((r, i) => {
        const cls = r.result === 'correct' ? 'ip-bd-correct' : r.result === 'partial' ? 'ip-bd-partial' : 'ip-bd-wrong';
        const icon = r.result === 'correct' ? 'fa-check-circle' : r.result === 'partial' ? 'fa-circle-half-stroke' : 'fa-times-circle';
        const label = r.result === 'correct' ? 'Correct' : r.result === 'partial' ? r.score + '%' : 'Wrong';
        return `<div class="ip-breakdown-item"><span class="ip-bd-q">Q${i+1}: ${esc(r.q.substring(0, 60))}${r.q.length > 60 ? '...' : ''}</span><span class="ip-bd-result ${cls}"><i class="fas ${icon}"></i> ${label}</span></div>`;
    }).join('');

    document.getElementById('quizArea').innerHTML = `
        <div class="ip-results active">
            <div class="ip-result-score">${score}/${total}</div>
            <div class="ip-result-label">You scored ${pct}%</div>
            <div class="ip-result-msg">${msg}</div>
            <div class="ip-result-breakdown">${breakdownHtml}</div>
            <div class="ip-result-actions">
                <button class="ip-btn ip-btn-primary" onclick="startQuiz('${currentCategory.replace(/'/g,"\\'")}')"><i class="fas fa-redo"></i> Retry</button>
                <button class="ip-btn ip-btn-secondary" onclick="backToCategories()"><i class="fas fa-th-large"></i> Other Categories</button>
            </div>
        </div>`;
}

function backToCategories() {
    document.getElementById('quizArea').classList.remove('active');
    document.getElementById('categories').style.display = 'grid';
}

function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

init();
