// === AI Talking Partner for Spoken English ===

const SE_AI_TOPICS = [
    'Daily Routine',
    'My Family',
    'Introducing Myself',
    'At the Shop',
    'Asking Directions',
    'Job Interview',
    'At the Bank',
    'Talking to a Doctor',
    'My Hometown',
    'Hobbies & Free Time',
    'Ordering Food',
    'Phone Conversation'
];

let seAiTopic = '';
let seAiLevel = '';
let seAiConversation = [];
let seAiScores = [];
let seAiTurns = 0;
let seAiWaiting = false;
let seAiEnded = false;
let seAiAutoSpeak = true;
let seAiRecognition = null;
let seAiRecording = false;

function seEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function seEscAttr(s) {
    return seEsc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function seRenderAiTopics() {
    const box = document.getElementById('seAiTopics');
    if (!box) return;
    box.innerHTML = SE_AI_TOPICS.map(function (t) {
        return '<div class="se-ai-topic" data-topic="' + seEscAttr(t) + '" onclick="seSelectTopic(this)">' + seEsc(t) + '</div>';
    }).join('');
}

function seSelectTopic(el) {
    seAiTopic = el.dataset.topic;
    document.querySelectorAll('#seAiTopics .se-ai-topic').forEach(function (t) { t.classList.remove('selected'); });
    el.classList.add('selected');
    const custom = document.getElementById('seAiCustomTopic');
    if (custom) custom.value = '';
    seUpdateStartBtn();
}

function seOnCustomTopic() {
    const v = document.getElementById('seAiCustomTopic').value.trim();
    if (v) {
        seAiTopic = v;
        document.querySelectorAll('#seAiTopics .se-ai-topic').forEach(function (t) { t.classList.remove('selected'); });
    } else {
        seAiTopic = '';
    }
    seUpdateStartBtn();
}

function seSelectLevel(level) {
    seAiLevel = level;
    document.querySelectorAll('#seAiLevels .se-ai-level').forEach(function (el) {
        el.classList.toggle('selected', el.dataset.level === level);
    });
    seUpdateStartBtn();
}

function seUpdateStartBtn() {
    const btn = document.getElementById('seAiStartBtn');
    if (btn) btn.disabled = !(seAiTopic && seAiLevel);
}

function seOpenAITalk() {
    seRenderAiTopics();
    document.getElementById('seAiBanner').style.display = 'none';
    document.getElementById('categories').style.display = 'none';
    document.getElementById('lessonArea').classList.remove('active');
    document.getElementById('seAiSetup').classList.add('active');
}

function seCloseAITalk() {
    seStopMic();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    document.getElementById('seAiSetup').classList.remove('active');
    document.getElementById('seAiChatArea').classList.remove('active');
    document.getElementById('seAiBanner').style.display = 'flex';
    document.getElementById('categories').style.display = 'grid';
    seAiTopic = '';
    seAiLevel = '';
    seAiConversation = [];
    seAiScores = [];
    seAiTurns = 0;
    seAiWaiting = false;
    seAiEnded = false;
    document.querySelectorAll('#seAiTopics .se-ai-topic, #seAiLevels .se-ai-level').forEach(function (el) { el.classList.remove('selected'); });
    const custom = document.getElementById('seAiCustomTopic');
    if (custom) custom.value = '';
    seUpdateStartBtn();
}

async function seStartAITalk() {
    if (!seAiTopic || !seAiLevel) return;

    seAiConversation = [];
    seAiScores = [];
    seAiTurns = 0;
    seAiEnded = false;

    document.getElementById('seAiSetup').classList.remove('active');
    document.getElementById('seAiChatArea').classList.add('active');
    document.getElementById('seAiChatTopic').textContent = seAiTopic;
    document.getElementById('seAiChatMeta').textContent = seAiLevel.charAt(0).toUpperCase() + seAiLevel.slice(1) + ' level';
    document.getElementById('seAiChat').innerHTML = '';
    document.getElementById('seAiInputArea').style.display = 'none';

    seShowAiTyping();
    seAiWaiting = true;

    try {
        const res = await fetch('/api/ai/spoken-english-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: seAiTopic, level: seAiLevel, conversation: [], isFirst: true })
        });
        const data = await res.json();
        seRemoveAiTyping();
        seAiWaiting = false;
        if (data.success && data.response && data.response.message) {
            seHandleAiReply(data.response);
        } else {
            seShowAiRetry(data.message || 'AI se response nahi mila', 'seStartAITalk');
        }
    } catch {
        seRemoveAiTyping();
        seAiWaiting = false;
        seShowAiRetry('Connection error. Internet check karo.', 'seStartAITalk');
    }
}

function seShowAiTyping() {
    const chat = document.getElementById('seAiChat');
    chat.insertAdjacentHTML('beforeend',
        '<div class="se-ai-msg se-ai-msg-bot" id="seAiTypingMsg"><div class="se-ai-avatar"><i class="fas fa-user-tie"></i></div>' +
        '<div class="se-ai-bubble"><div class="se-ai-typing"><span></span><span></span><span></span></div></div></div>');
    chat.scrollTop = chat.scrollHeight;
}

function seRemoveAiTyping() {
    const el = document.getElementById('seAiTypingMsg');
    if (el) el.remove();
}

function seHandleAiReply(resp) {
    const chat = document.getElementById('seAiChat');

    if (typeof resp.score === 'number') seAiScores.push(resp.score);

    // Feedback block for the learner's previous sentence
    if (resp.correction || resp.tip || typeof resp.score === 'number') {
        let fb = '';
        if (resp.correction) {
            fb += '<div class="se-ai-correction"><div class="se-ai-correction-label">Better way to say it</div>' +
                  '<div class="se-ai-correction-text">' + seEsc(resp.correction) + '</div></div>';
        }
        if (resp.tip) {
            fb += '<div class="se-ai-tip"><i class="fas fa-lightbulb"></i><span>' + seEsc(resp.tip) + '</span></div>';
        }
        if (typeof resp.score === 'number') {
            const col = resp.score >= 80 ? '#4ade80' : resp.score >= 50 ? '#fbbf24' : '#f87171';
            fb += '<div class="se-ai-score" style="color:' + col + '">' + resp.score + '/100</div>';
        }
        if (fb) {
            chat.insertAdjacentHTML('beforeend',
                '<div class="se-ai-msg se-ai-msg-bot"><div class="se-ai-avatar"><i class="fas fa-clipboard-check"></i></div>' +
                '<div class="se-ai-bubble">' + fb + '</div></div>');
        }
    }

    // Partner's reply
    seAiConversation.push({ role: 'partner', text: resp.message });
    chat.insertAdjacentHTML('beforeend',
        '<div class="se-ai-msg se-ai-msg-bot"><div class="se-ai-avatar"><i class="fas fa-user-tie"></i></div>' +
        '<div class="se-ai-bubble">' + seEsc(resp.message) +
        '<button class="se-ai-listen" data-say="' + seEscAttr(resp.message) + '" onclick="seSpeakAi(this)">' +
        '<i class="fas fa-volume-up"></i> Listen</button></div></div>');
    chat.scrollTop = chat.scrollHeight;

    if (seAiAutoSpeak) seSpeakPlain(resp.message);

    if (resp.isClosing) {
        seAiEnded = true;
        document.getElementById('seAiInputArea').style.display = 'none';
        setTimeout(seShowAiResults, 2500);
        return;
    }

    const ia = document.getElementById('seAiInputArea');
    ia.style.display = 'flex';
    const ta = document.getElementById('seAiTextarea');
    ta.value = '';
    ta.style.height = 'auto';
    ta.disabled = false;
    document.getElementById('seAiSendBtn').disabled = true;
    ta.focus();
}

function seOnAiInput(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 130) + 'px';
    document.getElementById('seAiSendBtn').disabled = ta.value.trim().length < 2;
}

function seOnAiKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!document.getElementById('seAiSendBtn').disabled) seSendAiAnswer();
    }
}

async function seSendAiAnswer() {
    if (seAiWaiting || seAiEnded) return;
    const ta = document.getElementById('seAiTextarea');
    const answer = ta.value.trim();
    if (answer.length < 2) return;

    seStopMic();
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    const chat = document.getElementById('seAiChat');
    chat.insertAdjacentHTML('beforeend',
        '<div class="se-ai-msg se-ai-msg-user"><div class="se-ai-avatar-user"><i class="fas fa-user"></i></div>' +
        '<div class="se-ai-bubble-user">' + seEsc(answer) + '</div></div>');
    chat.scrollTop = chat.scrollHeight;

    seAiConversation.push({ role: 'learner', text: answer });
    seAiTurns++;
    ta.value = '';
    ta.style.height = 'auto';

    await seSendToAiPartner();
}

async function seSendToAiPartner() {
    seAiWaiting = true;
    document.getElementById('seAiInputArea').style.display = 'none';
    seShowAiTyping();

    try {
        const res = await fetch('/api/ai/spoken-english-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic: seAiTopic,
                level: seAiLevel,
                conversation: seAiConversation,
                isFirst: false
            })
        });
        const data = await res.json();
        seRemoveAiTyping();
        seAiWaiting = false;
        if (data.success && data.response && data.response.message) {
            seHandleAiReply(data.response);
        } else {
            seShowAiRetry(data.message || 'AI se response nahi mila', 'seSendToAiPartner');
        }
    } catch {
        seRemoveAiTyping();
        seAiWaiting = false;
        seShowAiRetry('Connection error. Internet check karo.', 'seSendToAiPartner');
    }
}

function seShowAiRetry(reason, retryFn) {
    const chat = document.getElementById('seAiChat');
    document.getElementById('seAiInputArea').style.display = 'none';
    const endBtn = seAiScores.length
        ? '<button class="se-ai-result-btn se-ai-result-btn-secondary" onclick="seEndAITalk()"><i class="fas fa-flag-checkered"></i> End &amp; See Result</button>'
        : '<button class="se-ai-result-btn se-ai-result-btn-secondary" onclick="seCloseAITalk()"><i class="fas fa-times"></i> Close</button>';
    chat.insertAdjacentHTML('beforeend',
        '<div class="se-ai-msg se-ai-msg-bot" id="seAiRetryBox"><div class="se-ai-avatar" style="background:rgba(248,113,113,.25)"><i class="fas fa-exclamation-circle" style="color:#f87171"></i></div>' +
        '<div class="se-ai-bubble"><div>Reply load nahi ho paya.</div>' +
        '<div style="font-size:.78rem;color:rgba(255,255,255,.45);margin-top:5px">' + seEsc(reason) + '</div>' +
        '<div class="se-ai-retry-actions">' +
        '<button class="se-ai-result-btn se-ai-result-btn-primary" onclick="seRetryAi(\'' + retryFn + '\')"><i class="fas fa-redo"></i> Retry</button>' +
        endBtn + '</div></div></div>');
    chat.scrollTop = chat.scrollHeight;
}

function seRetryAi(fnName) {
    const box = document.getElementById('seAiRetryBox');
    if (box) box.remove();
    if (fnName === 'seStartAITalk') seStartAITalk();
    else seSendToAiPartner();
}

function seEndAITalk() {
    seStopMic();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (!seAiScores.length) { seCloseAITalk(); return; }
    seShowAiResults();
}

function seShowAiResults() {
    const box = document.getElementById('seAiRetryBox');
    if (box) box.remove();
    if (!seAiScores.length) { seCloseAITalk(); return; }

    seAiEnded = true;
    const avg = Math.round(seAiScores.reduce(function (a, b) { return a + b; }, 0) / seAiScores.length);
    const msg = avg >= 80 ? 'Excellent! Aapki English bahut acchi hai. Aise hi practice karte raho.'
        : avg >= 60 ? 'Good job! Thodi si grammar par dhyan do aur aap fluent ho jaoge.'
        : avg >= 40 ? 'Acchi shuruaat! Roz 10 minute practice karo, jaldi improvement dikhega.'
        : 'Practice jaari rakho. Pehle simple sentences par focus karo.';

    const chat = document.getElementById('seAiChat');
    document.getElementById('seAiInputArea').style.display = 'none';
    chat.insertAdjacentHTML('beforeend',
        '<div class="se-ai-msg se-ai-msg-bot" style="max-width:100%"><div class="se-ai-avatar"><i class="fas fa-trophy"></i></div>' +
        '<div class="se-ai-bubble" style="flex:1"><div class="se-ai-result">' +
        '<div class="se-ai-result-score">' + avg + '/100</div>' +
        '<div class="se-ai-result-label">Average Score</div>' +
        '<div class="se-ai-result-msg">' + msg + '</div>' +
        '<div class="se-ai-result-msg" style="margin-top:8px;font-size:.78rem">You spoke ' + seAiTurns + ' times on "' + seEsc(seAiTopic) + '"</div>' +
        '<div class="se-ai-result-actions">' +
        '<button class="se-ai-result-btn se-ai-result-btn-primary" onclick="seStartAITalk()"><i class="fas fa-redo"></i> Same Topic Again</button>' +
        '<button class="se-ai-result-btn se-ai-result-btn-secondary" onclick="seNewAiTopic()"><i class="fas fa-list"></i> New Topic</button>' +
        '</div></div></div></div>');
    chat.scrollTop = chat.scrollHeight;
}

function seNewAiTopic() {
    seStopMic();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    seAiConversation = [];
    seAiScores = [];
    seAiTurns = 0;
    seAiEnded = false;
    document.getElementById('seAiChatArea').classList.remove('active');
    document.getElementById('seAiSetup').classList.add('active');
}

// === Voice output ===
function seToggleAutoSpeak() {
    seAiAutoSpeak = !seAiAutoSpeak;
    const btn = document.getElementById('seAiSpeakToggle');
    if (btn) {
        btn.classList.toggle('off', !seAiAutoSpeak);
        btn.innerHTML = seAiAutoSpeak ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>';
    }
    if (!seAiAutoSpeak && window.speechSynthesis) window.speechSynthesis.cancel();
}

function seSpeakPlain(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(String(text).replace(/\([^)]*\)/g, ''));
    utter.rate = 0.85;
    utter.lang = 'en-US';
    window.speechSynthesis.speak(utter);
}

function seSpeakAi(btn) {
    if (!window.speechSynthesis) { alert('Speech not supported in this browser'); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(String(btn.dataset.say || '').replace(/\([^)]*\)/g, ''));
    utter.rate = 0.85;
    utter.lang = 'en-US';
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-volume-up"></i> Speaking...';
    utter.onend = function () { btn.innerHTML = orig; };
    utter.onerror = function () { btn.innerHTML = orig; };
    window.speechSynthesis.speak(utter);
}

// === Voice input ===
function seToggleMic() {
    if (seAiRecording) { seStopMic(); return; }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        alert('Aapka browser voice input support nahi karta. Chrome use karo, ya type karke jawab do.');
        return;
    }

    if (window.speechSynthesis) window.speechSynthesis.cancel();

    seAiRecognition = new SR();
    seAiRecognition.lang = 'en-IN';
    seAiRecognition.interimResults = true;
    seAiRecognition.continuous = false;

    const ta = document.getElementById('seAiTextarea');
    const btn = document.getElementById('seAiMicBtn');
    const before = ta.value.trim();

    seAiRecognition.onstart = function () {
        seAiRecording = true;
        btn.classList.add('recording');
    };

    seAiRecognition.onresult = function (e) {
        let text = '';
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        ta.value = (before ? before + ' ' : '') + text;
        seOnAiInput(ta);
    };

    seAiRecognition.onerror = function (e) {
        seAiRecording = false;
        btn.classList.remove('recording');
        if (e.error === 'not-allowed') {
            alert('Mic ki permission deni padegi. Browser settings me microphone allow karo.');
        } else if (e.error === 'no-speech') {
            alert('Kuch sunai nahi diya. Dobara try karo.');
        }
    };

    seAiRecognition.onend = function () {
        seAiRecording = false;
        btn.classList.remove('recording');
    };

    try {
        seAiRecognition.start();
    } catch {
        seAiRecording = false;
        btn.classList.remove('recording');
    }
}

function seStopMic() {
    if (seAiRecognition && seAiRecording) {
        try { seAiRecognition.stop(); } catch {}
    }
    seAiRecording = false;
    const btn = document.getElementById('seAiMicBtn');
    if (btn) btn.classList.remove('recording');
}
