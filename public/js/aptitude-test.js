var questions = {
  quant: [
    { q: 'What is 15% of 200?', qHi: '200 का 15% क्या है?', options: ['20', '30', '25', '35'], answer: 1 },
    { q: 'If the cost price is Rs. 500 and selling price is Rs. 600, what is the profit percentage?', qHi: 'यदि क्रय मूल्य Rs. 500 है और विक्रय मूल्य Rs. 600 है, तो लाभ प्रतिशत क्या है?', options: ['15%', '20%', '25%', '10%'], answer: 1 },
    { q: 'A train travels 60 km in 1.5 hours. What is its speed?', qHi: 'एक ट्रेन 1.5 घंटे में 60 किमी यात्रा करती है। इसकी गति क्या है?', options: ['30 km/h', '40 km/h', '45 km/h', '50 km/h'], answer: 1 },
    { q: 'What is the value of 2^3 + 3^2?', qHi: '2^3 + 3^2 का मान क्या है?', options: ['12', '17', '15', '13'], answer: 1 },
    { q: 'If x + 5 = 12, what is x?', qHi: 'यदि x + 5 = 12 है, तो x क्या है?', options: ['5', '6', '7', '8'], answer: 2 },
    { q: 'The average of 10, 20, 30, 40, 50 is:', qHi: '10, 20, 30, 40, 50 का औसत क्या है:', options: ['25', '30', '35', '28'], answer: 1 },
    { q: 'What is the simple interest on Rs. 1000 at 5% per annum for 2 years?', qHi: 'Rs. 1000 पर 5% वार्षिक दर से 2 वर्ष का साधारण ब्याज क्या होगा?', options: ['Rs. 50', 'Rs. 100', 'Rs. 150', 'Rs. 200'], answer: 1 },
    { q: 'If a:b = 2:3 and b:c = 4:5, find a:c?', qHi: 'यदि a:b = 2:3 और b:c = 4:5 है, तो a:c ज्ञात करें?', options: ['8:15', '2:5', '8:12', '5:8'], answer: 0 },
    { q: 'The LCM of 12 and 18 is:', qHi: '12 और 18 का लघुत्तम समापवर्त्य (LCM) क्या है:', options: ['24', '36', '48', '72'], answer: 1 },
    { q: 'A shopkeeper sells an item for Rs. 450 with a loss of 10%. What was the cost price?', qHi: 'एक दुकानदार Rs. 450 में 10% की हानि पर सामान बेचता है। क्रय मूल्य क्या था?', options: ['Rs. 480', 'Rs. 500', 'Rs. 520', 'Rs. 550'], answer: 1 }
  ],
  reasoning: [
    { q: 'Find the next number: 2, 6, 12, 20, 30, ?', qHi: 'अगला नंबर ज्ञात करें: 2, 6, 12, 20, 30, ?', options: ['40', '42', '44', '46'], answer: 1 },
    { q: 'If CAT is coded as 24, DOG is coded as 26, what is RAT?', qHi: 'यदि CAT को 24 के रूप में कोडित किया जाता है, DOG को 26, तो RAT क्या होगा?', options: ['18', '20', '22', '24'], answer: 0 },
    { q: 'Complete the analogy: Book is to Read as Food is to ?', qHi: 'समानता पूर्ण करें: पुस्तक है पढ़ने के लिए, जैसे भोजन है ___ के लिए', options: ['Cook', 'Eat', 'Buy', 'Store'], answer: 1 },
    { q: 'Find the odd one out:', qHi: 'अजीब/अलग वाला चुनें:', options: ['Apple', 'Mango', 'Carrot', 'Banana'], answer: 2 },
    { q: 'If MONDAY is coded as NPOEBZ, how is FRIDAY coded?', qHi: 'यदि MONDAY को NPOEBZ के रूप में कोडित किया जाता है, तो FRIDAY को कैसे कोडित किया जाएगा?', options: ['GSJEBZ', 'GSJEAZ', 'GSJFBZ', 'GSJEBY'], answer: 0 },
    { q: 'Which number does not belong: 3, 5, 7, 9, 11, 13?', qHi: 'कौन सा नंबर नहीं आता: 3, 5, 7, 9, 11, 13?', options: ['3', '5', '9', '11'], answer: 2 },
    { q: 'Complete the series: A, C, E, G, ?, K', qHi: 'श्रृंखला पूर्ण करें: A, C, E, G, ?, K', options: ['H', 'I', 'J', 'F'], answer: 1 },
    { q: 'If all roses are flowers and some flowers fade quickly, can we say all roses fade quickly?', qHi: 'यदि सभी गुलाब फूल हैं और कुछ फूल जल्दी मुरझाते हैं, क्या हम कह सकते हैं कि सभी गुलाब जल्दी मुरझाते हैं?', options: ['Yes', 'No', 'Cannot be determined', 'Only some roses'], answer: 1 },
    { q: 'Find the next: 1, 4, 9, 16, 25, ?', qHi: 'अगला ज्ञात करें: 1, 4, 9, 16, 25, ?', options: ['30', '36', '42', '49'], answer: 1 },
    { q: 'Pointing to a photo, Raj said "She is my mother\'s only daughter." Who is in the photo?', qHi: 'एक फोटो की ओर इशारा करते हुए राज ने कहा "वह मेरी माँ की इकलौती बेटी है।" फोटो में कौन है?', options: ['His sister', 'Himself', 'His mother', 'His daughter'], answer: 1 }
  ],
  verbal: [
    { q: 'Choose the synonym of "Abundant":', qHi: '"Abundant" का पर्यायवाची चुनें:', options: ['Scarce', 'Plentiful', 'Empty', 'Limited'], answer: 1 },
    { q: 'Choose the antonym of "Ancient":', qHi: '"Ancient" का विलोम चुनें:', options: ['Old', 'Modern', 'Historic', 'Classic'], answer: 1 },
    { q: 'Choose the synonym of "Diligent":', qHi: '"Diligent" का पर्यायवाची चुनें:', options: ['Lazy', 'Hardworking', 'Careless', 'Slow'], answer: 1 },
    { q: 'Choose the antonym of "Generous":', qHi: '"Generous" का विलोम चुनें:', options: ['Kind', 'Stingy', 'Helpful', 'Friendly'], answer: 1 },
    { q: 'Fill in the blank: "She is good ___ math."', qHi: 'रिक्त स्थान भरें: "She is good ___ math."', options: ['in', 'at', 'on', 'for'], answer: 1 },
    { q: 'Choose the correctly spelled word:', qHi: 'सही वर्तनी वाला शब्द चुनें:', options: ['Recieve', 'Receive', 'Receeve', 'Receve'], answer: 1 },
    { q: 'What is the meaning of "Benevolent"?', qHi: '"Benevolent" का अर्थ क्या है?', options: ['Cruel', 'Kind', 'Selfish', 'Angry'], answer: 1 },
    { q: 'Choose the synonym of "Ephemeral":', qHi: '"Ephemeral" का पर्यायवाची चुनें:', options: ['Permanent', 'Temporary', 'Long-lasting', 'Eternal'], answer: 1 },
    { q: 'Fill in the blank: "Neither John nor his friends ___ coming."', qHi: 'रिक्त स्थान भरें: "Neither John nor his friends ___ coming."', options: ['is', 'are', 'was', 'has'], answer: 1 },
    { q: 'Choose the antonym of "Transparent":', qHi: '"Transparent" का विलोम चुनें:', options: ['Clear', 'Opaque', 'Visible', 'Bright'], answer: 1 }
  ]
};

var catNames = { quant: 'Quantitative Aptitude', reasoning: 'Logical Reasoning', verbal: 'Verbal Ability' };
var currentCat = null;
var currentQ = 0;
var answers = [];
var timer = null;
var timeLeft = 600;

function startQuiz(cat) {
  currentCat = cat;
  currentQ = 0;
  answers = new Array(questions[cat].length).fill(null);
  timeLeft = 600;
  document.getElementById('aptHome').style.display = 'none';
  document.getElementById('aptResult').classList.remove('active');
  document.getElementById('aptQuiz').classList.add('active');
  document.getElementById('aptQuizTitle').textContent = catNames[cat];
  startTimer();
  renderQ();
}

function startTimer() {
  clearInterval(timer);
  updateTimerDisplay();
  timer = setInterval(function() {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timer);
      finishQuiz();
    }
  }, 1000);
}

function updateTimerDisplay() {
  var m = Math.floor(timeLeft / 60);
  var s = timeLeft % 60;
  var el = document.getElementById('aptTimerText');
  var timerEl = document.getElementById('aptTimer');
  el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  if (timeLeft < 60) timerEl.classList.add('warn');
  else timerEl.classList.remove('warn');
}

function renderQ() {
  var qs = questions[currentCat];
  var q = qs[currentQ];
  var card = document.getElementById('aptQCard');
  var html = '<div class="apt-q-num">Question ' + (currentQ + 1) + ' of ' + qs.length + '</div>';
  html += '<div class="apt-q-text">' + q.q + '</div>';
  if (q.qHi) html += '<div style="font-size:.92rem;color:rgba(255,255,255,.55);margin-bottom:16px;line-height:1.5">' + q.qHi + '</div>';
  html += '<div class="apt-options">';
  var letters = ['A', 'B', 'C', 'D'];
  for (var i = 0; i < q.options.length; i++) {
    var sel = answers[currentQ] === i ? ' selected' : '';
    html += '<div class="apt-opt' + sel + '" onclick="selectOpt(' + i + ')"><div class="apt-opt-letter">' + letters[i] + '</div><span>' + q.options[i] + '</span></div>';
  }
  html += '</div>';
  card.innerHTML = html;

  document.getElementById('aptProgress').style.width = ((currentQ + 1) / qs.length * 100) + '%';
  document.getElementById('aptPrev').disabled = currentQ === 0;
  var nextBtn = document.getElementById('aptNext');
  if (currentQ === qs.length - 1) {
    nextBtn.innerHTML = 'Submit <i class="fas fa-check"></i>';
  } else {
    nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
  }
}

function selectOpt(i) {
  answers[currentQ] = i;
  renderQ();
}

function prevQ() {
  if (currentQ > 0) {
    currentQ--;
    renderQ();
  }
}

function nextQ() {
  var qs = questions[currentCat];
  if (currentQ < qs.length - 1) {
    currentQ++;
    renderQ();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  clearInterval(timer);
  var qs = questions[currentCat];
  var correct = 0, wrong = 0, skipped = 0;
  var reviewHtml = '';
  for (var i = 0; i < qs.length; i++) {
    if (answers[i] === null) {
      skipped++;
    } else if (answers[i] === qs[i].answer) {
      correct++;
    } else {
      wrong++;
    }
    reviewHtml += '<div class="apt-review-item">';
    reviewHtml += '<div class="apt-review-q">Q' + (i + 1) + ': ' + qs[i].q + '</div>';
    if (qs[i].qHi) reviewHtml += '<div style="font-size:.82rem;color:rgba(255,255,255,.4);margin-bottom:6px">' + qs[i].qHi + '</div>';
    if (answers[i] !== null) {
      var isCorrect = answers[i] === qs[i].answer;
      reviewHtml += '<span class="apt-review-a ' + (isCorrect ? 'right' : 'wrong') + '">Your: ' + qs[i].options[answers[i]] + '</span>';
      if (!isCorrect) {
        reviewHtml += '<span class="apt-review-a ans">Correct: ' + qs[i].options[qs[i].answer] + '</span>';
      }
    } else {
      reviewHtml += '<span class="apt-review-a wrong">Not attempted</span>';
      reviewHtml += '<span class="apt-review-a ans">Correct: ' + qs[i].options[qs[i].answer] + '</span>';
    }
    reviewHtml += '</div>';
  }

  var score = Math.round((correct / qs.length) * 100);
  var scoreEl = document.getElementById('aptScore');
  scoreEl.textContent = score + '%';
  scoreEl.className = 'apt-result-score ' + (score >= 70 ? 'good' : score >= 40 ? 'avg' : 'bad');
  document.getElementById('aptScoreMsg').textContent = score >= 70 ? 'Excellent work! 🎉' : score >= 40 ? 'Good attempt, keep practicing! 👍' : 'Need more practice, don\'t give up! 💪';
  document.getElementById('aptCorrect').textContent = correct;
  document.getElementById('aptWrong').textContent = wrong;
  document.getElementById('aptSkipped').textContent = skipped;
  document.getElementById('aptReview').innerHTML = reviewHtml;

  document.getElementById('aptQuiz').classList.remove('active');
  document.getElementById('aptResult').classList.add('active');
}

function goHome() {
  document.getElementById('aptResult').classList.remove('active');
  document.getElementById('aptQuiz').classList.remove('active');
  document.getElementById('aptHome').style.display = 'block';
  currentCat = null;
  currentQ = 0;
  answers = [];
}

