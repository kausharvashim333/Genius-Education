var STORAGE_KEY = 'genius_mcq_quizzes_v1';
var questionCount = 0;

function switchPanel(panel) {
  document.querySelectorAll('.mcq-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.mcq-panel').forEach(function(p) { p.classList.remove('active'); });
  event.target.classList.add('active');
  document.getElementById('panel-' + panel).classList.add('active');
  if (panel === 'myquizzes') renderSavedQuizzes();
}

function addQuestion() {
  questionCount++;
  var container = document.getElementById('questionsContainer');
  var div = document.createElement('div');
  div.className = 'mcq-q-block';
  div.id = 'qblock-' + questionCount;
  div.innerHTML =
    '<div class="mcq-q-header">' +
    '<span class="mcq-q-num">Question ' + questionCount + '</span>' +
    '<div class="mcq-q-del" onclick="this.parentElement.parentElement.remove()"><i class="fas fa-trash"></i></div>' +
    '</div>' +
    '<input type="text" class="mcq-input" placeholder="Enter question..." style="margin-bottom:10px">' +
    '<div class="mcq-opts">' +
    '<div class="mcq-opt-row"><input type="radio" name="q' + questionCount + '" value="0" class="mcq-opt-radio"><input type="text" class="mcq-opt-input" placeholder="Option A"></div>' +
    '<div class="mcq-opt-row"><input type="radio" name="q' + questionCount + '" value="1" class="mcq-opt-radio"><input type="text" class="mcq-opt-input" placeholder="Option B"></div>' +
    '<div class="mcq-opt-row"><input type="radio" name="q' + questionCount + '" value="2" class="mcq-opt-radio"><input type="text" class="mcq-opt-input" placeholder="Option C"></div>' +
    '<div class="mcq-opt-row"><input type="radio" name="q' + questionCount + '" value="3" class="mcq-opt-radio"><input type="text" class="mcq-opt-input" placeholder="Option D"></div>' +
    '</div>' +
    '<div style="font-size:.75rem;color:#64748b;margin-top:6px">Select the correct answer radio button</div>';
  container.appendChild(div);
}

function saveQuiz() {
  var title = document.getElementById('quizTitle').value.trim();
  if (!title) { alert('Quiz title zaroori hai!'); return; }
  var desc = document.getElementById('quizDesc').value.trim();
  var blocks = document.querySelectorAll('.mcq-q-block');
  if (blocks.length === 0) { alert('Kam se kam ek question add karo!'); return; }

  var quiz = { id: 'q' + Date.now(), title: title, desc: desc, questions: [], created: new Date().toISOString() };

  for (var i = 0; i < blocks.length; i++) {
    var qInput = blocks[i].querySelector('input[type="text"]');
    var qText = qInput.value.trim();
    if (!qText) { alert('Question ' + (i + 1) + ' ka text empty hai!'); return; }
    var optInputs = blocks[i].querySelectorAll('.mcq-opt-input');
    var radios = blocks[i].querySelectorAll('.mcq-opt-radio');
    var options = [];
    var answer = -1;
    for (var j = 0; j < optInputs.length; j++) {
      var optText = optInputs[j].value.trim();
      if (!optText) { alert('Question ' + (i + 1) + ' ke saare options bharo!'); return; }
      options.push(optText);
      if (radios[j].checked) answer = j;
    }
    if (answer === -1) { alert('Question ' + (i + 1) + ' ka correct answer select karo!'); return; }
    quiz.questions.push({ q: qText, options: options, answer: answer });
  }

  var quizzes = getQuizzes();
  quizzes.push(quiz);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes));

  alert('Quiz saved successfully!');
  document.getElementById('quizTitle').value = '';
  document.getElementById('quizDesc').value = '';
  document.getElementById('questionsContainer').innerHTML = '';
  questionCount = 0;
  switchPanel('myquizzes');
  renderSavedQuizzes();
}

function getQuizzes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) { return []; }
}

function renderSavedQuizzes() {
  var quizzes = getQuizzes();
  var container = document.getElementById('savedQuizzes');
  if (quizzes.length === 0) {
    container.innerHTML = '<div class="mcq-empty"><i class="fas fa-clipboard-list"></i><p>No quizzes yet. Create your first quiz!</p></div>';
    return;
  }
  var html = '';
  for (var i = 0; i < quizzes.length; i++) {
    var q = quizzes[i];
    html += '<div class="mcq-saved-item">';
    html += '<div class="mcq-saved-info"><h3>' + escapeHtml(q.title) + '</h3>';
    html += '<div class="mcq-saved-meta"><span><i class="fas fa-question-circle"></i> ' + q.questions.length + ' Questions</span>';
    var date = new Date(q.created);
    html += '<span><i class="fas fa-calendar"></i> ' + date.toLocaleDateString() + '</span></div></div>';
    html += '<div class="mcq-saved-actions">';
    html += '<button class="mcq-saved-btn play" onclick="playQuiz(\'' + q.id + '\')"><i class="fas fa-play"></i> Play</button>';
    html += '<button class="mcq-saved-btn share" onclick="shareQuiz(\'' + q.id + '\')"><i class="fas fa-share"></i> Share</button>';
    html += '<button class="mcq-saved-btn del" onclick="deleteQuiz(\'' + q.id + '\')"><i class="fas fa-trash"></i></button>';
    html += '</div></div>';
  }
  container.innerHTML = html;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function deleteQuiz(id) {
  if (!confirm('Quiz delete karna hai?')) return;
  var quizzes = getQuizzes().filter(function(q) { return q.id !== id; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes));
  renderSavedQuizzes();
}

function shareQuiz(id) {
  var quiz = getQuizzes().find(function(q) { return q.id === id; });
  if (!quiz) return;
  var data = btoa(unescape(encodeURIComponent(JSON.stringify(quiz))));
  var url = window.location.origin + window.location.pathname + '?quiz=' + data;
  navigator.clipboard.writeText(url).then(function() {
    alert('Share link copied to clipboard!');
  }).catch(function() {
    prompt('Copy this link:', url);
  });
}

var playQuizData = null;
var playIdx = 0;
var playAnswers = [];

function playQuiz(id) {
  var quiz = getQuizzes().find(function(q) { return q.id === id; });
  if (!quiz) return;
  playQuizData = quiz;
  playIdx = 0;
  playAnswers = new Array(quiz.questions.length).fill(null);
  document.querySelectorAll('.mcq-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.mcq-panel').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('panel-play').classList.add('active');
  document.getElementById('mcqQuizView').classList.add('active');
  document.getElementById('mcqResult').classList.remove('active');
  renderPlayQ();
}

function renderPlayQ() {
  var qs = playQuizData.questions;
  var q = qs[playIdx];
  var card = document.getElementById('mcqQCard');
  var letters = ['A', 'B', 'C', 'D'];
  var html = '<div class="mcq-q-num">Question ' + (playIdx + 1) + ' of ' + qs.length + '</div>';
  html += '<div class="mcq-q-text">' + escapeHtml(q.q) + '</div>';
  html += '<div class="mcq-options">';
  for (var i = 0; i < q.options.length; i++) {
    var sel = playAnswers[playIdx] === i ? ' selected' : '';
    html += '<div class="mcq-opt' + sel + '" onclick="selectMcqOpt(' + i + ')"><div class="mcq-opt-letter">' + letters[i] + '</div><span>' + escapeHtml(q.options[i]) + '</span></div>';
  }
  html += '</div>';
  card.innerHTML = html;
  document.getElementById('mcqProgress').style.width = ((playIdx + 1) / qs.length * 100) + '%';
  document.getElementById('mcqPrev').disabled = playIdx === 0;
  var nextBtn = document.getElementById('mcqNext');
  if (playIdx === qs.length - 1) nextBtn.innerHTML = 'Submit <i class="fas fa-check"></i>';
  else nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
}

function selectMcqOpt(i) {
  playAnswers[playIdx] = i;
  renderPlayQ();
}

function mcqPrev() {
  if (playIdx > 0) { playIdx--; renderPlayQ(); }
}

function mcqNext() {
  var qs = playQuizData.questions;
  if (playIdx < qs.length - 1) { playIdx++; renderPlayQ(); }
  else { finishMcqQuiz(); }
}

function finishMcqQuiz() {
  var qs = playQuizData.questions;
  var correct = 0;
  for (var i = 0; i < qs.length; i++) {
    if (playAnswers[i] === qs[i].answer) correct++;
  }
  var score = Math.round((correct / qs.length) * 100);
  var scoreEl = document.getElementById('mcqScore');
  scoreEl.textContent = score + '%';
  scoreEl.className = 'mcq-result-score ' + (score >= 70 ? '' : '');
  scoreEl.style.color = score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171';
  document.getElementById('mcqScoreMsg').textContent = score >= 70 ? 'Excellent! 🎉' : score >= 40 ? 'Good try! 👍' : 'Keep practicing! 💪';
  document.getElementById('mcqQuizView').classList.remove('active');
  document.getElementById('mcqResult').classList.add('active');
}

function backToList() {
  document.querySelectorAll('.mcq-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.mcq-panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelector('.mcq-tab').classList.add('active');
  document.getElementById('panel-myquizzes').classList.add('active');
  renderSavedQuizzes();
}

// Check for shared quiz in URL
(function() {
  var params = new URLSearchParams(window.location.search);
  var shared = params.get('quiz');
  if (shared) {
    try {
      var quiz = JSON.parse(decodeURIComponent(escape(atob(shared))));
      playQuizData = quiz;
      playIdx = 0;
      playAnswers = new Array(quiz.questions.length).fill(null);
      document.querySelectorAll('.mcq-tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.mcq-panel').forEach(function(p) { p.classList.remove('active'); });
      document.getElementById('panel-play').classList.add('active');
      document.getElementById('mcqQuizView').classList.add('active');
      renderPlayQ();
    } catch (e) {}
  }
})();

// Init with one question
addQuestion();

var hb = document.querySelector('.hamburger');
var nm = document.querySelector('.nav-menu');
if (hb && nm) hb.addEventListener('click', function() { nm.classList.toggle('active'); });
