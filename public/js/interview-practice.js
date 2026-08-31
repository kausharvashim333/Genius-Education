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
let currentDifficulty = 'all';
let qTimer = null;
let qTimeLeft = 0;
let quizStartTime = 0;
const TIMER_MCQ = 30;
const TIMER_DESC = 120;
const HISTORY_KEY = 'ipHistory';

// === AI Interview QnA State ===
let onboardStep = 1;
let selectedRole = '';
let selectedLang = '';
let selectedExp = '';
let aiQuestions = [];
let aiQIndex = 0;
let aiScore = 0;
let aiAnswered = false;
let aiSelectedOpt = null;
let aiResultBreakdown = [];

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}

function saveAttempt(attempt) {
    const history = getHistory();
    history.push(attempt);
    if (history.length > 100) history.shift();
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
}

function switchTopMode(mode) {
    document.querySelectorAll('.ip-top-mode').forEach(t => t.classList.toggle('active', t.dataset.topmode === mode));
    const ob = document.getElementById('onboardSection'), qna = document.getElementById('qnaSection'), pr = document.getElementById('practiceSection');
    if (mode === 'ai') { ob.classList.add('active'); qna.classList.remove('active'); pr.style.display = 'none'; }
    else { ob.classList.remove('active'); qna.classList.remove('active'); pr.style.display = 'block'; renderCategories(); }
}
function selectRole(el, role) {
    document.querySelectorAll('.ip-role-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected'); selectedRole = role;
    document.getElementById('roleInput').value = '';
    document.getElementById('step1Next').disabled = false;
}
function selectLang(el, lang) {
    document.querySelectorAll('#langOptions .ip-lang-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); selectedLang = lang;
    document.getElementById('step2Next').disabled = false;
}
function selectExp(el, exp) {
    document.querySelectorAll('#expOptions .ip-exp-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); selectedExp = exp;
    document.getElementById('step3Next').disabled = false;
}
function goStep(step) {
    onboardStep = step;
    document.querySelectorAll('.ip-onboard-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step' + step).classList.add('active');
    document.querySelectorAll('.ip-onboard-dot').forEach((d, i) => d.classList.toggle('active', i < step));
}

async function startAIInterview() {
    if (!selectedRole) return;
    document.getElementById('onboardSection').classList.remove('active');
    document.getElementById('qnaSection').classList.add('active');
    const chat = document.getElementById('qnaChat');
    chat.innerHTML = '<div class="ip-qna-loading"><i class="fas fa-robot fa-bounce"></i><p>AI aapke liye "' + esc(selectedRole) + '" role ke liye questions generate kar raha hai...</p></div>';
    document.getElementById('qnaInputArea').style.display = 'none';
    document.getElementById('qnaInfo').innerHTML = '<strong>' + esc(selectedRole) + '</strong> · ' + (selectedExp||'fresher') + ' · ' + (selectedLang||'hinglish');
    try {
        const res = await fetch('/api/ai/generate-questions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({jobRole:selectedRole, experience:selectedExp, language:selectedLang, numQuestions:8}) });
        const data = await res.json();
        aiQuestions = (data.success && data.questions && data.questions.length > 0) ? data.questions : getFallbackQuestions();
    } catch { aiQuestions = getFallbackQuestions(); }
    aiQIndex = 0; aiScore = 0; aiResultBreakdown = [];
    renderQnAQuestion();
}

function getFallbackQuestions() {
    const all = [];
    for (const [n, d] of Object.entries(QUESTION_BANK)) all.push(...d.questions);
    return shuffleArray(all).slice(0, 8);
}

function renderQnAQuestion() {
    if (aiQIndex >= aiQuestions.length) { showQnAResults(); return; }
    const q = aiQuestions[aiQIndex];
    aiAnswered = false; aiSelectedOpt = null;
    document.getElementById('qnaProgress').style.width = (aiQIndex/aiQuestions.length*100) + '%';
    const isMCQ = q.type === 'mcq' || (q.options && q.options.length > 0);
    const dc = q.difficulty==='easy'?'ip-diff-easy':q.difficulty==='hard'?'ip-diff-hard':'ip-diff-medium';
    const db = q.difficulty ? '<span class="ip-qna-diff '+dc+'">'+q.difficulty+'</span>' : '';
    let opts = '';
    if (isMCQ && q.options) opts = '<div class="ip-qna-mcq-opts" id="qnaMcqOpts">' + q.options.map((o,i)=>'<div class="ip-qna-mcq-opt" onclick="selectQnAMcq('+i+')">'+String.fromCharCode(65+i)+'. '+esc(o)+'</div>').join('') + '</div>';
    document.getElementById('qnaChat').innerHTML = '<div class="ip-qna-msg ip-qna-msg-bot"><div class="ip-qna-avatar"><i class="fas fa-robot"></i></div><div class="ip-qna-bubble"><div class="ip-qna-q">Q'+(aiQIndex+1)+'/'+aiQuestions.length+': '+esc(q.q)+' '+db+'</div>'+opts+'</div></div>';
    const ia = document.getElementById('qnaInputArea');
    if (isMCQ && q.options) { ia.style.display = 'none'; }
    else { ia.style.display = 'flex'; const ta = document.getElementById('qnaTextarea'); ta.value=''; ta.disabled=false; document.getElementById('qnaSendBtn').disabled=true; ta.focus(); }
    document.getElementById('qnaChat').scrollTop = 999999;
}

function selectQnAMcq(i) {
    if (aiAnswered) return;
    aiSelectedOpt = i;
    document.querySelectorAll('#qnaMcqOpts .ip-qna-mcq-opt').forEach((o,idx)=>{o.classList.remove('selected');if(idx===i)o.classList.add('selected');});
    setTimeout(()=>submitQnAMcq(), 300);
}

function submitQnAMcq() {
    if (aiAnswered || aiSelectedOpt === null) return;
    aiAnswered = true;
    const q = aiQuestions[aiQIndex];
    const opts = document.querySelectorAll('#qnaMcqOpts .ip-qna-mcq-opt');
    opts.forEach(o => o.style.cursor = 'default');
    const correct = aiSelectedOpt === q.answer;
    if (correct) aiScore++;
    aiResultBreakdown.push({q:q.q, result:correct?'correct':'wrong', score:correct?100:0});
    opts.forEach((o,idx)=>{if(idx===q.answer)o.classList.add('correct');else if(idx===aiSelectedOpt)o.classList.add('wrong');});
    const chat = document.getElementById('qnaChat');
    chat.querySelector('.ip-qna-bubble').insertAdjacentHTML('beforeend','<div class="ip-qna-eval"><div class="ip-qna-eval-score" style="color:'+(correct?'#4ade80':'#f87171')+'">'+(correct?'✓ Correct!':'✗ Wrong')+'</div><div class="ip-qna-eval-feedback">'+esc(q.explanation||'')+'</div></div>');
    chat.scrollTop = 999999;
    setTimeout(()=>{aiQIndex++;renderQnAQuestion();}, 2500);
}

function onQnAInput(ta) {
    document.getElementById('qnaSendBtn').disabled = ta.value.trim().split(/\s+/).filter(w=>w.length>0).length < 3;
}

async function submitQnAAnswer() {
    if (aiAnswered) return;
    const ta = document.getElementById('qnaTextarea');
    const answer = ta.value.trim();
    if (answer.length < 3) return;
    aiAnswered = true; ta.disabled = true; document.getElementById('qnaSendBtn').disabled = true;
    const chat = document.getElementById('qnaChat');
    const q = aiQuestions[aiQIndex];
    chat.insertAdjacentHTML('beforeend','<div class="ip-qna-msg ip-qna-msg-user"><div class="ip-qna-avatar-user"><i class="fas fa-user"></i></div><div class="ip-qna-bubble-user">'+esc(answer)+'</div></div>');
    chat.insertAdjacentHTML('beforeend','<div class="ip-qna-msg ip-qna-msg-bot" id="qnaTypingMsg"><div class="ip-qna-avatar"><i class="fas fa-robot"></i></div><div class="ip-qna-bubble"><div class="ip-qna-typing"><span></span><span></span><span></span></div></div></div>');
    chat.scrollTop = 999999;
    let ev = null;
    try {
        const res = await fetch('/api/ai/evaluate-answer', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q.q, modelAnswer:q.modelAnswer||'', studentAnswer:answer})});
        const data = await res.json();
        if (data.success && data.evaluation) ev = data.evaluation;
    } catch {}
    document.getElementById('qnaTypingMsg')?.remove();
    if (ev) {
        if (ev.score >= 50) aiScore++;
        aiResultBreakdown.push({q:q.q, result:ev.verdict, score:ev.score});
        const sc = ev.score>=80?'#4ade80':ev.score>=50?'#fbbf24':'#f87171';
        chat.insertAdjacentHTML('beforeend','<div class="ip-qna-msg ip-qna-msg-bot"><div class="ip-qna-avatar"><i class="fas fa-robot"></i></div><div class="ip-qna-bubble"><div class="ip-qna-eval"><div class="ip-qna-eval-score" style="color:'+sc+'">Score: '+ev.score+'/100</div><div class="ip-qna-eval-feedback">'+esc(ev.feedback||'')+'</div>'+(ev.improvedAnswer?'<div class="ip-qna-eval-improved"><strong>Behtar Answer:</strong> '+esc(ev.improvedAnswer)+'</div>':'')+'</div></div></div>');
    } else {
        const al = answer.toLowerCase();
        const kws = q.keywords || [];
        const found = kws.filter(k => al.includes(k.toLowerCase()));
        const passed = found.length >= (q.minKeywords || Math.ceil(kws.length * 0.5));
        if (passed) aiScore++;
        aiResultBreakdown.push({q:q.q, result:passed?'partial':'wrong', score:Math.round((kws.length?found.length/kws.length:0.5)*100)});
        chat.insertAdjacentHTML('beforeend','<div class="ip-qna-msg ip-qna-msg-bot"><div class="ip-qna-avatar"><i class="fas fa-robot"></i></div><div class="ip-qna-bubble"><div class="ip-qna-eval"><div class="ip-qna-eval-score" style="color:'+(passed?'#4ade80':'#f87171')+'">'+(passed?'✓ Passed':'✗ Needs Work')+'</div><div class="ip-qna-eval-feedback">'+found.length+'/'+kws.length+' keywords matched.</div>'+(q.modelAnswer?'<div class="ip-qna-eval-improved"><strong>Model Answer:</strong> '+esc(q.modelAnswer)+'</div>':'')+'</div></div></div>');
    }
    chat.scrollTop = 999999;
    setTimeout(()=>{aiQIndex++;renderQnAQuestion();}, 4000);
}

function showQnAResults() {
    document.getElementById('qnaProgress').style.width = '100%';
    const total = aiQuestions.length, pct = Math.round((aiScore/total)*100);
    let msg = pct>=80?'Excellent! Aap interview ke liye fully ready ho.':pct>=60?'Good! Thoda aur practice karo.':pct>=40?'Average. Topics revise karo.':'Aur study karna padega.';
    saveAttempt({category:'AI: '+selectedRole, mode:'ai', difficulty:selectedExp, score:aiScore, total, pct, date:new Date().toISOString()});
    const bh = aiResultBreakdown.map((r,i)=>{const c=r.result==='correct'?'ip-bd-correct':r.result==='partial'?'ip-bd-partial':'ip-bd-wrong';const ic=r.result==='correct'?'fa-check-circle':r.result==='partial'?'fa-circle-half-stroke':'fa-times-circle';const lb=r.result==='correct'?'Correct':r.result==='partial'?r.score+'%':'Wrong';return '<div class="ip-breakdown-item"><span class="ip-bd-q">Q'+(i+1)+': '+esc(r.q.substring(0,50))+(r.q.length>50?'...':'')+'</span><span class="ip-bd-result '+c+'"><i class="fas '+ic+'"></i> '+lb+'</span></div>';}).join('');
    document.getElementById('qnaChat').innerHTML = '<div class="ip-qna-msg ip-qna-msg-bot"><div class="ip-qna-avatar"><i class="fas fa-trophy"></i></div><div class="ip-qna-bubble"><div class="ip-result-score">'+aiScore+'/'+total+'</div><div class="ip-result-label">You scored '+pct+'%</div><div class="ip-result-msg">'+msg+'</div><div class="ip-result-breakdown">'+bh+'</div><div class="ip-result-actions"><button class="ip-btn ip-btn-primary" onclick="startAIInterview()"><i class="fas fa-redo"></i> Retry</button><button class="ip-btn ip-btn-secondary" onclick="shareResult('+aiScore+','+total+','+pct+')"><i class="fas fa-share-nodes"></i> Share</button><button class="ip-btn ip-btn-secondary" onclick="exitQnA()"><i class="fas fa-th-large"></i> New Interview</button></div></div></div>';
    document.getElementById('qnaInputArea').style.display = 'none';
    if (pct >= 80) launchConfetti();
}

function exitQnA() {
    document.getElementById('qnaSection').classList.remove('active');
    document.getElementById('onboardSection').classList.add('active');
    aiQuestions=[]; aiQIndex=0; aiScore=0; aiResultBreakdown=[];
    goStep(1); selectedRole=''; selectedLang=''; selectedExp='';
    document.querySelectorAll('.ip-role-chip,.ip-lang-opt,.ip-exp-opt').forEach(el=>el.classList.remove('selected'));
    document.getElementById('roleInput').value='';
    document.getElementById('step1Next').disabled=true;
    document.getElementById('step2Next').disabled=true;
    document.getElementById('step3Next').disabled=true;
}

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
    const roleInput = document.getElementById('roleInput');
    if (roleInput) {
        roleInput.addEventListener('input', function() {
            document.querySelectorAll('.ip-role-chip').forEach(c => c.classList.remove('selected'));
            selectedRole = this.value.trim();
            document.getElementById('step1Next').disabled = selectedRole.length < 2;
        });
    }
}

function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.ip-mode-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.mode === mode);
    });
    renderCategories();
}

function switchDifficulty(diff) {
    currentDifficulty = diff;
    document.querySelectorAll('.ip-diff-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.diff === diff);
    });
    renderCategories();
}

function filterQuestions(questions) {
    let qs = questions;
    if (currentMode === 'mcq') qs = qs.filter(q => q.type !== 'descriptive');
    else if (currentMode === 'descriptive') qs = qs.filter(q => q.type === 'descriptive');
    if (currentDifficulty !== 'all') qs = qs.filter(q => q.difficulty === currentDifficulty);
    return qs;
}

function getCategoryStats(name) {
    const attempts = getHistory().filter(h => h.category === name);
    if (attempts.length === 0) return null;
    const best = Math.max(...attempts.map(a => a.pct));
    const avg = Math.round(attempts.reduce((s, a) => s + a.pct, 0) / attempts.length);
    return { attempts: attempts.length, best, avg };
}

function renderCategories() {
    const container = document.getElementById('categories');
    if (!container) return;
    let html = '';
    for (const [name, data] of Object.entries(QUESTION_BANK)) {
        const count = filterQuestions(data.questions).length;
        if (count === 0) continue;
        const stats = getCategoryStats(name);
        let statsHtml = '';
        if (stats) {
            const weakClass = stats.avg < 60 ? ' ip-stat-weak' : '';
            statsHtml = `<div class="ip-cat-stats${weakClass}">
                <span title="Best score"><i class="fas fa-trophy"></i> ${stats.best}%</span>
                <span title="Average"><i class="fas fa-chart-line"></i> ${stats.avg}%</span>
                ${stats.avg < 60 ? '<span class="ip-weak-tag"><i class="fas fa-exclamation-triangle"></i> Practice more</span>' : ''}
            </div>`;
        }
        html += `<div class="ip-cat-card" onclick="startQuiz('${name.replace(/'/g,"\\'")}')">
            <div class="ip-cat-icon"><i class="fas ${data.icon}"></i></div>
            <div class="ip-cat-name">${name}</div>
            <div class="ip-cat-count">${count} Questions</div>
            ${statsHtml}
        </div>`;
    }
    container.innerHTML = html;
    renderProgressSummary();
}

function renderProgressSummary() {
    const el = document.getElementById('progressSummary');
    if (!el) return;
    const history = getHistory();
    if (history.length === 0) { el.innerHTML = ''; return; }
    const totalAttempts = history.length;
    const avgScore = Math.round(history.reduce((s, a) => s + a.pct, 0) / totalAttempts);
    const recent = history.slice(-5).reverse();
    const weak = [];
    const catMap = {};
    history.forEach(h => {
        if (!catMap[h.category]) catMap[h.category] = [];
        catMap[h.category].push(h.pct);
    });
    for (const [cat, scores] of Object.entries(catMap)) {
        const avg = scores.reduce((s, p) => s + p, 0) / scores.length;
        if (avg < 60) weak.push(cat);
    }
    el.innerHTML = `
        <div class="ip-progress-card">
            <div class="ip-progress-title"><i class="fas fa-chart-simple"></i> Your Progress</div>
            <div class="ip-progress-stats">
                <div class="ip-ps-item"><strong>${totalAttempts}</strong><span>Attempts</span></div>
                <div class="ip-ps-item"><strong>${avgScore}%</strong><span>Avg Score</span></div>
                <div class="ip-ps-item"><strong>${weak.length}</strong><span>Weak Areas</span></div>
            </div>
            ${weak.length > 0 ? `<div class="ip-weak-areas"><i class="fas fa-bullseye"></i> Focus on: ${weak.map(w => `<span>${esc(w)}</span>`).join(' ')}</div>` : ''}
            <div class="ip-recent-attempts">
                ${recent.map(r => `<div class="ip-ra-item"><span>${esc(r.category)}</span><span class="${r.pct >= 60 ? 'ip-ra-good' : 'ip-ra-bad'}">${r.pct}%</span></div>`).join('')}
            </div>
        </div>`;
}

function startQuiz(category) {
    currentCategory = category;
    currentQuestions = shuffleArray(filterQuestions(QUESTION_BANK[category].questions));
    currentQIndex = 0;
    score = 0;
    resultBreakdown = [];
    quizStartTime = Date.now();
    const summaryEl = document.getElementById('progressSummary');
    if (summaryEl) summaryEl.style.display = 'none';
    document.getElementById('categories').style.display = 'none';
    document.getElementById('quizArea').classList.add('active');
    renderQuestion();
}

function startTimer(seconds) {
    clearInterval(qTimer);
    qTimeLeft = seconds;
    updateTimerDisplay();
    qTimer = setInterval(() => {
        qTimeLeft--;
        updateTimerDisplay();
        if (qTimeLeft <= 0) {
            clearInterval(qTimer);
            onTimeUp();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const el = document.getElementById('qTimer');
    if (!el) return;
    const m = Math.floor(qTimeLeft / 60);
    const s = qTimeLeft % 60;
    el.textContent = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
    el.classList.toggle('ip-timer-warning', qTimeLeft <= 10);
}

function onTimeUp() {
    if (answered) return;
    const q = currentQuestions[currentQIndex];
    answered = true;
    if (q.type === 'descriptive') {
        if (descAnswer.trim().length >= 3) {
            checkDescriptive();
        } else {
            resultBreakdown.push({ q: q.q, result: 'wrong', score: 0 });
            const fb = document.getElementById('keywordFeedback');
            if (fb) {
                fb.classList.add('active');
                fb.innerHTML = `<div class="ip-kf-title"><i class="fas fa-clock"></i> Time's up!</div><div class="ip-model-answer"><strong>Model Answer:</strong> ${esc(q.modelAnswer || q.explanation || '')}</div>`;
            }
        }
        const ta = document.getElementById('descTextarea');
        if (ta) ta.disabled = true;
    } else {
        const opts = document.querySelectorAll('.ip-option');
        opts.forEach((o, idx) => {
            o.style.cursor = 'default';
            if (idx === q.answer) o.classList.add('correct');
        });
        resultBreakdown.push({ q: q.q, result: 'wrong', score: 0 });
        const expl = document.getElementById('explanation');
        if (expl) expl.classList.add('active');
    }
    const btn = document.getElementById('nextBtn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = currentQIndex + 1 < currentQuestions.length ? 'Next <i class="fas fa-arrow-right"></i>' : 'See Results <i class="fas fa-trophy"></i>';
    }
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
        <div class="ip-quiz-meta-row">
            <div class="ip-quiz-progress">Question ${currentQIndex+1} of ${currentQuestions.length}</div>
            <div class="ip-timer" id="qTimerWrap"><i class="fas fa-clock"></i> <span id="qTimer"></span></div>
        </div>
        <div class="ip-question">${typeBadge} ${esc(q.q)} <span class="ip-difficulty ip-diff-${q.difficulty}">${q.difficulty}</span></div>
        ${bodyHtml}
        <div class="ip-quiz-actions">
            <button class="ip-btn ip-btn-primary" id="nextBtn" onclick="nextQuestion()" disabled>${isDesc?'Submit Answer':'Next'} <i class="fas ${isDesc?'fa-check':'fa-arrow-right'}"></i></button>
        </div>`;
    startTimer(isDesc ? TIMER_DESC : TIMER_MCQ);
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

async function checkDescriptive() {
    const q = currentQuestions[currentQIndex];
    const fb = document.getElementById('keywordFeedback');
    const btn = document.getElementById('nextBtn');
    if (fb) {
        fb.classList.add('active');
        fb.innerHTML = '<div class="ip-kf-title"><i class="fas fa-robot"></i> AI aapka answer check kar raha hai... <i class="fas fa-spinner fa-spin"></i></div>';
    }
    if (btn) btn.disabled = true;

    let ai = null;
    try {
        const res = await fetch('/api/ai/evaluate-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q.q, modelAnswer: q.modelAnswer || '', studentAnswer: descAnswer })
        });
        const data = await res.json();
        if (data.success && data.evaluation) ai = data.evaluation;
    } catch {}

    if (ai) {
        const passed = ai.score >= 50;
        if (passed) score++;
        resultBreakdown.push({ q: q.q, result: ai.verdict, score: ai.score });
        if (fb) {
            const scoreColor = ai.score >= 80 ? '#4ade80' : ai.score >= 50 ? '#fbbf24' : '#f87171';
            fb.innerHTML = `
                <div class="ip-kf-title"><i class="fas fa-robot"></i> AI Evaluation</div>
                <div class="ip-ai-score" style="color:${scoreColor}">Score: ${ai.score}/100</div>
                <div class="ip-ai-feedback">${esc(ai.feedback || '')}</div>
                ${ai.improvedAnswer ? `<div class="ip-model-answer"><strong>Improved Answer:</strong> ${esc(ai.improvedAnswer)}</div>` : ''}
                <div class="ip-model-answer"><strong>Model Answer:</strong> ${esc(q.modelAnswer || q.explanation || '')}</div>`;
        }
    } else {
        // Fallback: keyword matching
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
        if (fb) {
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
    if (btn) btn.disabled = false;
}

function nextQuestion() {
    const q = currentQuestions[currentQIndex];
    const isDesc = q.type === 'descriptive';
    if (isDesc) {
        if (!answered && descAnswer.trim().length < 3) return;
        if (!answered) {
            answered = true;
            clearInterval(qTimer);
            checkDescriptive();
            document.getElementById('descTextarea').disabled = true;
            const btn = document.getElementById('nextBtn');
            btn.innerHTML = currentQIndex + 1 < currentQuestions.length ? 'Next <i class="fas fa-arrow-right"></i>' : 'See Results <i class="fas fa-trophy"></i>';
        } else { currentQIndex++; renderQuestion(); }
    } else {
        if (!answered && selectedOption === null) return;
        if (!answered) {
            answered = true;
            clearInterval(qTimer);
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
    clearInterval(qTimer);
    const total = currentQuestions.length;
    const pct = Math.round((score / total) * 100);
    const timeTaken = Math.round((Date.now() - quizStartTime) / 1000);
    const timeStr = timeTaken >= 60 ? `${Math.floor(timeTaken/60)}m ${timeTaken%60}s` : `${timeTaken}s`;
    let msg = '';
    if (pct >= 80) msg = 'Excellent! Aap interview ke liye fully ready ho.';
    else if (pct >= 60) msg = 'Good! Thoda aur practice karo.';
    else if (pct >= 40) msg = 'Average. Topics revise karo aur dobara try karo.';
    else msg = 'Aur study karna padega. Revision karo.';

    saveAttempt({ category: currentCategory, mode: currentMode, difficulty: currentDifficulty, score, total, pct, date: new Date().toISOString() });

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
            <div class="ip-result-time"><i class="fas fa-stopwatch"></i> Time: ${timeStr}</div>
            <div class="ip-result-msg">${msg}</div>
            <div class="ip-result-breakdown">${breakdownHtml}</div>
            <div class="ip-result-actions">
                <button class="ip-btn ip-btn-primary" onclick="startQuiz('${currentCategory.replace(/'/g,"\\'")}')"><i class="fas fa-redo"></i> Retry</button>
                <button class="ip-btn ip-btn-secondary" onclick="shareResult(${score}, ${total}, ${pct})"><i class="fas fa-share-nodes"></i> Share</button>
                <button class="ip-btn ip-btn-secondary" onclick="backToCategories()"><i class="fas fa-th-large"></i> Other Categories</button>
            </div>
        </div>`;

    if (pct >= 80) launchConfetti();
}

function shareResult(s, t, p) {
    const text = `Maine Genius Computer Education ke Interview Practice me "${currentCategory}" category me ${s}/${t} (${p}%) score kiya! 🎯 Aap bhi try karo:`;
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({ title: 'Interview Practice Result', text, url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text + ' ' + url).then(() => {
            alert('Result copied to clipboard!');
        }).catch(() => {});
    }
}

function launchConfetti() {
    const colors = ['#667eea', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#38bdf8'];
    const container = document.createElement('div');
    container.className = 'ip-confetti-container';
    for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.className = 'ip-confetti';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = (Math.random() * 1.5) + 's';
        piece.style.animationDuration = (2 + Math.random() * 2) + 's';
        piece.style.width = (6 + Math.random() * 6) + 'px';
        piece.style.height = (6 + Math.random() * 6) + 'px';
        container.appendChild(piece);
    }
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 5000);
}

function backToCategories() {
    clearInterval(qTimer);
    document.getElementById('quizArea').classList.remove('active');
    document.getElementById('categories').style.display = 'grid';
    const summaryEl = document.getElementById('progressSummary');
    if (summaryEl) summaryEl.style.display = 'block';
    renderCategories();
}

function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

init();
