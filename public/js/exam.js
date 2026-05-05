// Exam Interface JavaScript
let examData = null;
let currentQuestionIndex = 0;
let answers = {};
let markedQuestions = [];
let timerInterval = null;
let timeRemaining = 0;
let examSecurity = null;

// Initialize exam
async function initExam() {
    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    
    if (!examId) {
        alert('Invalid exam');
        window.location.href = '/';
        return;
    }
    
    try {
        const response = await fetch('/api/online-exams/' + examId);
        const data = await response.json();
        
        if (!data || !data.questions || data.questions.length === 0) {
            alert('Exam not found or no questions available');
            window.location.href = '/';
            return;
        }
        
        examData = data;
        examSecurity = data.security || {};
        
        // Check if exam is within schedule
        if (data.startDate && data.endDate) {
            const now = new Date();
            const startDate = new Date(data.startDate);
            const endDate = new Date(data.endDate);
            
            if (now < startDate) {
                alert('Exam has not started yet');
                window.location.href = '/';
                return;
            }
            
            if (now > endDate) {
                alert('Exam has ended');
                window.location.href = '/';
                return;
            }
        }
        
        // Setup exam UI
        document.getElementById('examTitle').textContent = data.name;
        document.getElementById('instructionsText').textContent = data.instructions || 'No specific instructions for this exam.';
        
        if (data.instructions) {
            document.getElementById('instructions').style.display = 'block';
        }
        
        // Initialize timer
        timeRemaining = data.duration * 60;
        startTimer();
        
        // Apply security settings
        applySecuritySettings();
        
        // Load first question
        loadQuestion(0);
        
        // Initialize palette
        initPalette();
        
    } catch (error) {
        console.error('Error loading exam:', error);
        alert('Error loading exam');
        window.location.href = '/';
    }
}

// Apply security settings
function applySecuritySettings() {
    if (examSecurity.disableCopyPaste) {
        document.addEventListener('copy', preventDefault);
        document.addEventListener('paste', preventDefault);
        document.addEventListener('cut', preventDefault);
    }
    
    if (examSecurity.disableRightClick) {
        document.addEventListener('contextmenu', preventDefault);
    }
    
    if (examSecurity.enforceFullscreen) {
        try {
            document.documentElement.requestFullscreen();
        } catch (e) {
            console.log('Fullscreen not supported');
        }
    }
    
    if (examSecurity.disableTabSwitch) {
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }
}

function preventDefault(e) {
    e.preventDefault();
    return false;
}

function handleVisibilityChange() {
    if (document.hidden && examSecurity.disableTabSwitch) {
        alert('Tab switching detected! Exam will be auto-submitted.');
        submitExam();
    }
}

// Timer functionality
function startTimer() {
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert('Time is up! Submitting your exam.');
            submitExam();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    const seconds = timeRemaining % 60;
    
    const timerElement = document.getElementById('timer');
    timerElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Add warning classes
    timerElement.classList.remove('warning', 'danger');
    if (timeRemaining <= 300) { // 5 minutes
        timerElement.classList.add('warning');
    }
    if (timeRemaining <= 60) { // 1 minute
        timerElement.classList.add('danger');
    }
}

// Load question
function loadQuestion(index) {
    currentQuestionIndex = index;
    const question = examData.questions[index];
    
    document.getElementById('questionNumber').textContent = `Question ${index + 1}`;
    document.getElementById('questionMarks').textContent = `Marks: ${question.marks || 1}`;
    document.getElementById('questionText').textContent = question.text;
    
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    if (question.type === 'MCQ') {
        question.options.forEach((option, i) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            optionDiv.onclick = () => selectOption(i);
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'answer';
            radio.value = i;
            if (answers[index] === i) {
                radio.checked = true;
                optionDiv.classList.add('selected');
            }
            
            const text = document.createElement('span');
            text.className = 'option-text';
            text.textContent = option;
            
            optionDiv.appendChild(radio);
            optionDiv.appendChild(text);
            optionsContainer.appendChild(optionDiv);
        });
    } else if (question.type === 'TrueFalse') {
        const options = ['True', 'False'];
        options.forEach((option, i) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            optionDiv.onclick = () => selectOption(i);
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'answer';
            radio.value = i;
            if (answers[index] === i) {
                radio.checked = true;
                optionDiv.classList.add('selected');
            }
            
            const text = document.createElement('span');
            text.className = 'option-text';
            text.textContent = option;
            
            optionDiv.appendChild(radio);
            optionDiv.appendChild(text);
            optionsContainer.appendChild(optionDiv);
        });
    } else if (question.type === 'ShortAnswer') {
        const textarea = document.createElement('textarea');
        textarea.className = 'short-answer-input';
        textarea.placeholder = 'Enter your answer...';
        textarea.value = answers[index] || '';
        textarea.oninput = (e) => saveAnswer(e.target.value);
        optionsContainer.appendChild(textarea);
    } else if (question.type === 'Essay') {
        const textarea = document.createElement('textarea');
        textarea.className = 'essay-textarea';
        textarea.placeholder = 'Write your answer here...';
        textarea.value = answers[index] || '';
        textarea.oninput = (e) => saveAnswer(e.target.value);
        optionsContainer.appendChild(textarea);
    }
    
    // Update navigation buttons
    document.getElementById('prevBtn').disabled = index === 0;
    document.getElementById('nextBtn').textContent = index === examData.questions.length - 1 ? 'Submit' : 'Next';
    document.getElementById('nextBtn').onclick = index === examData.questions.length - 1 ? submitExam : nextQuestion;
    
    // Update palette
    updatePalette();
}

// Select option for MCQ/TrueFalse
function selectOption(index) {
    answers[currentQuestionIndex] = index;
    
    const options = document.querySelectorAll('.option');
    options.forEach((opt, i) => {
        opt.classList.remove('selected');
        if (i === index) {
            opt.classList.add('selected');
            opt.querySelector('input').checked = true;
        }
    });
    
    updatePalette();
}

// Save answer for text-based questions
function saveAnswer(value) {
    answers[currentQuestionIndex] = value;
    updatePalette();
}

// Navigation
function nextQuestion() {
    if (currentQuestionIndex < examData.questions.length - 1) {
        loadQuestion(currentQuestionIndex + 1);
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        loadQuestion(currentQuestionIndex - 1);
    }
}

function markForReview() {
    const index = markedQuestions.indexOf(currentQuestionIndex);
    if (index === -1) {
        markedQuestions.push(currentQuestionIndex);
    } else {
        markedQuestions.splice(index, 1);
    }
    updatePalette();
}

// Palette functionality
function initPalette() {
    const paletteGrid = document.getElementById('paletteGrid');
    paletteGrid.innerHTML = '';
    
    for (let i = 0; i < examData.questions.length; i++) {
        const item = document.createElement('div');
        item.className = 'palette-item not-visited';
        item.textContent = i + 1;
        item.onclick = () => loadQuestion(i);
        item.id = `palette-${i}`;
        paletteGrid.appendChild(item);
    }
    
    updatePalette();
}

function updatePalette() {
    for (let i = 0; i < examData.questions.length; i++) {
        const item = document.getElementById(`palette-${i}`);
        if (!item) continue;
        
        item.className = 'palette-item';
        
        if (i === currentQuestionIndex) {
            item.classList.add('current');
        }
        
        if (markedQuestions.includes(i)) {
            item.classList.add('marked');
        } else if (answers[i] !== undefined && answers[i] !== '') {
            item.classList.add('answered');
        } else {
            item.classList.add('not-visited');
        }
    }
}

// Submit exam
function submitExam() {
    document.getElementById('submitModal').classList.add('active');
}

function closeSubmitModal() {
    document.getElementById('submitModal').classList.remove('active');
}

function confirmSubmit() {
    closeSubmitModal();
    calculateAndSubmitResult();
}

// Calculate and submit result
async function calculateAndSubmitResult() {
    clearInterval(timerInterval);
    
    let score = 0;
    let totalMarks = 0;
    
    examData.questions.forEach((question, index) => {
        const questionMarks = question.marks || 1;
        totalMarks += questionMarks;
        
        if (question.type === 'MCQ' || question.type === 'TrueFalse') {
            const userAnswer = answers[index];
            
            // Handle different correctAnswer formats
            let correctAnswer = null;
            
            console.log(`=== Question ${index + 1} Analysis ===`);
            console.log(`Question text: ${question.text}`);
            console.log(`Question type: ${question.type}`);
            console.log(`Options:`, question.options);
            console.log(`User answer: ${userAnswer} (type: ${typeof userAnswer})`);
            console.log(`Raw correctAnswer field:`, question.correctAnswer);
            console.log(`Raw answer field:`, question.answer);
            
            // Try to get correctAnswer from multiple possible fields
            if (question.correctAnswer !== undefined && question.correctAnswer !== null) {
                const rawCorrectAnswer = question.correctAnswer;
                console.log(`Processing correctAnswer: ${rawCorrectAnswer} (type: ${typeof rawCorrectAnswer})`);
                
                if (typeof rawCorrectAnswer === 'string') {
                    // First try to parse as number (handles string indices like "0", "1", "2")
                    const parsed = parseInt(rawCorrectAnswer);
                    if (!isNaN(parsed)) {
                        correctAnswer = parsed;
                        console.log(`Parsed correctAnswer string as number: ${parsed}`);
                    } else if (question.options && Array.isArray(question.options)) {
                        // If not a number, try to find as option text
                        const optionIndex = question.options.indexOf(rawCorrectAnswer);
                        if (optionIndex !== -1) {
                            correctAnswer = optionIndex;
                            console.log(`Found correct answer at index: ${optionIndex}`);
                        } else {
                            // Try case-insensitive comparison
                            const lowerCaseIndex = question.options.findIndex(opt => 
                                opt.toLowerCase() === rawCorrectAnswer.toLowerCase()
                            );
                            if (lowerCaseIndex !== -1) {
                                correctAnswer = lowerCaseIndex;
                                console.log(`Found correct answer at index (case-insensitive): ${lowerCaseIndex}`);
                            }
                        }
                    }
                } else if (typeof rawCorrectAnswer === 'number') {
                    correctAnswer = rawCorrectAnswer;
                    console.log(`Correct answer is numeric: ${rawCorrectAnswer}`);
                }
            }
            
            // If no correctAnswer found, try to infer from answer field
            if (correctAnswer === null && question.answer !== undefined) {
                const rawAnswer = question.answer;
                console.log(`Trying answer field: ${rawAnswer} (type: ${typeof rawAnswer})`);
                
                if (typeof rawAnswer === 'string') {
                    // First try to parse as number
                    const parsed = parseInt(rawAnswer);
                    if (!isNaN(parsed)) {
                        correctAnswer = parsed;
                        console.log(`Parsed answer string as number: ${parsed}`);
                    } else if (question.options && Array.isArray(question.options)) {
                        const optionIndex = question.options.indexOf(rawAnswer);
                        if (optionIndex !== -1) {
                            correctAnswer = optionIndex;
                            console.log(`Found answer at index: ${optionIndex}`);
                        } else {
                            const lowerCaseIndex = question.options.findIndex(opt => 
                                opt.toLowerCase() === rawAnswer.toLowerCase()
                            );
                            if (lowerCaseIndex !== -1) {
                                correctAnswer = lowerCaseIndex;
                                console.log(`Found answer at index (case-insensitive): ${lowerCaseIndex}`);
                            }
                        }
                    }
                } else if (typeof rawAnswer === 'number') {
                    correctAnswer = rawAnswer;
                    console.log(`Answer is numeric: ${rawAnswer}`);
                }
            }
            
            console.log(`Final correct answer index: ${correctAnswer}`);
            console.log(`Comparison: userAnswer(${userAnswer}) === correctAnswer(${correctAnswer}) = ${userAnswer === correctAnswer}`);
            
            if (userAnswer !== undefined && userAnswer !== null && correctAnswer !== null && userAnswer === correctAnswer) {
                score += questionMarks;
                console.log(`✓ CORRECT! Added ${questionMarks} marks`);
            } else {
                console.log(`✗ INCORRECT or NO ANSWER`);
            }
        } else if (question.type === 'ShortAnswer' || question.type === 'Essay') {
            // For subjective questions, marks will be assigned manually
            // For now, we'll give partial marks for any answer
            if (answers[index] && answers[index].trim() !== '') {
                score += Math.floor(questionMarks * 0.5);
            }
        }
    });
    
    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const passed = percentage >= examData.passingMarks;
    
    console.log(`=== FINAL RESULT ===`);
    console.log(`Score: ${score}/${totalMarks}`);
    console.log(`Percentage: ${percentage}%`);
    console.log(`Passed: ${passed}`);
    
    // Get student ID from sessionStorage
    const storedStudent = sessionStorage.getItem('portalStudent');
    const student = storedStudent ? JSON.parse(storedStudent) : null;
    const studentId = student ? student.id : 'current_student';
    
    // Generate fixed reference number per student-exam combination
    // Use exam reference number + student ID (no timestamp) for consistency
    const examRef = examData.referenceNumber || 'EXAM';
    // Create a simple hash from examData.id + studentId for consistent reference number
    const combinedString = `${examData.id}-${studentId}`;
    let hash = 0;
    for (let i = 0; i < combinedString.length; i++) {
        hash = ((hash << 5) - hash) + combinedString.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    const hashPart = Math.abs(hash).toString(36).toUpperCase().substring(0, 6);
    const referenceNumber = `${examRef}-${studentId}-${hashPart}`;
    
    // Save attempt
    const attemptData = {
        examId: examData.id,
        examName: examData.name,
        course: examData.course,
        studentId: studentId,
        answers: answers,
        score: score,
        totalMarks: totalMarks,
        percentage: percentage,
        passed: passed,
        referenceNumber: referenceNumber,
        submittedAt: new Date().toISOString()
    };
    
    try {
        const response = await fetch('/api/exam-attempts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attemptData)
        });
        const result = await response.json();
    } catch (error) {
        console.error('Error saving attempt:', error);
    }
    
    // Show result
    console.log(`Show result immediately: ${examData.showResultImmediately}`);
    if (examData.showResultImmediately !== false) {
        console.log('Calling showResult function...');
        showResult(score, totalMarks, percentage, passed, referenceNumber);
    } else {
        alert(`Exam submitted successfully!\n\nReference Number: ${referenceNumber}\n\nResults will be announced later.`);
        window.location.href = '/';
    }
}

function showResult(score, totalMarks, percentage, passed, referenceNumber) {
    console.log('showResult called with:', { score, totalMarks, percentage, passed, referenceNumber });
    
    const examInterface = document.getElementById('examInterface');
    const resultContainer = document.getElementById('resultContainer');
    
    console.log('examInterface element:', examInterface);
    console.log('resultContainer element:', resultContainer);
    
    if (examInterface) {
        examInterface.style.display = 'none';
        console.log('Hidden exam interface');
    } else {
        console.error('examInterface element not found');
    }
    
    if (resultContainer) {
        resultContainer.style.display = 'block';
        console.log('Shown result container');
    } else {
        console.error('resultContainer element not found');
    }
    
    const resultScore = document.getElementById('resultScore');
    const resultPercentage = document.getElementById('resultPercentage');
    const resultStatus = document.getElementById('resultStatus');
    
    console.log('Result elements:', { resultScore, resultPercentage, resultStatus });
    
    if (resultScore) resultScore.textContent = `${score} / ${totalMarks}`;
    if (resultPercentage) resultPercentage.textContent = `Percentage: ${percentage}%`;
    
    if (resultStatus) {
        resultStatus.textContent = passed ? 'PASS' : 'FAIL';
        resultStatus.className = 'result-status ' + (passed ? 'pass' : 'fail');
    }
    
    // Add reference number display
    const refNumberElement = document.createElement('p');
    refNumberElement.style.fontSize = '16px';
    refNumberElement.style.fontWeight = '600';
    refNumberElement.style.marginTop = '15px';
    refNumberElement.style.color = '#667eea';
    refNumberElement.innerHTML = `Reference Number: <span style="font-size:18px;">${referenceNumber}</span>`;
    
    // Insert reference number before the close button
    if (resultContainer) {
        const closeButton = resultContainer.querySelector('button');
        if (closeButton) {
            resultContainer.insertBefore(refNumberElement, closeButton);
        } else {
            resultContainer.appendChild(refNumberElement);
        }
    }
    
    // Hide submit button from header
    const submitButtons = document.querySelectorAll('.exam-header button');
    submitButtons.forEach(btn => {
        if (btn.textContent.includes('Submit')) {
            btn.style.display = 'none';
        }
    });
    
    console.log('showResult completed');
}

function closeExam() {
    window.location.href = '/';
}

// Initialize on page load
window.onload = initExam;

// Warn before leaving
window.onbeforeunload = function() {
    if (timeRemaining > 0) {
        return 'Are you sure you want to leave? Your progress will be lost.';
    }
};
