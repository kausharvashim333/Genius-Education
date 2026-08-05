let seCategories = [];
let seCurrentCategory = null;
let seLessons = [];

async function seInit() {
    try {
        const res = await fetch('/api/spoken-english');
        const data = await res.json();
        seCategories = data.categories || [];
        renderHeroStats();
        renderCategories();
    } catch (err) {
        console.error('Error loading spoken english:', err);
        document.getElementById('categories').innerHTML = '<div class="se-empty"><i class="fas fa-exclamation-circle"></i><p>Failed to load content. Please try again later.</p></div>';
    }
}

function renderHeroStats() {
    const el = document.getElementById('seHeroStats');
    if (!el) return;
    const totalLessons = seCategories.reduce((sum, c) => sum + (c.lessons ? c.lessons.length : 0), 0);
    el.innerHTML = `
        <div class="se-stat"><div class="se-stat-num">${seCategories.length}</div><div class="se-stat-label">Categories</div></div>
        <div class="se-stat"><div class="se-stat-num">${totalLessons}</div><div class="se-stat-label">Lessons</div></div>
        <div class="se-stat"><div class="se-stat-num"><i class="fas fa-volume-up"></i></div><div class="se-stat-label">Audio</div></div>
    `;
}

function renderCategories() {
    const container = document.getElementById('categories');
    if (!seCategories.length) {
        container.innerHTML = '<div class="se-empty"><i class="fas fa-book-open"></i><p>No lessons available yet. Please check back soon.</p></div>';
        return;
    }
    container.innerHTML = seCategories.map(cat => `
        <div class="se-cat-card" onclick="seOpenCategory('${cat.id}')">
            <div class="se-cat-icon-wrap"><div class="se-cat-icon"><i class="fas ${cat.icon || 'fa-book'}"></i></div></div>
            <div class="se-cat-name">${esc(cat.name)}</div>
            <div class="se-cat-count"><i class="fas fa-play-circle"></i> ${cat.lessons ? cat.lessons.length : 0} Lessons</div>
            <div class="se-cat-arrow"><i class="fas fa-arrow-right"></i></div>
        </div>`).join('');
}

async function seOpenCategory(catId) {
    seCurrentCategory = seCategories.find(c => c.id === catId);
    if (!seCurrentCategory) return;
    seLessons = seCurrentCategory.lessons || [];
    document.getElementById('categories').style.display = 'none';
    document.getElementById('lessonArea').classList.add('active');
    renderLessons();
}

function renderLessons() {
    const area = document.getElementById('lessonArea');
    let html = `<div class="se-lesson-header">
        <div class="se-lesson-title"><i class="fas ${seCurrentCategory.icon || 'fa-book'}"></i> ${esc(seCurrentCategory.name)}</div>
        <button class="se-back-btn" onclick="seBackToCategories()"><i class="fas fa-arrow-left"></i> Back to Categories</button>
    </div>`;
    if (!seLessons.length) {
        html += '<div class="se-empty"><i class="fas fa-book"></i><p>No lessons in this category yet.</p></div>';
        area.innerHTML = html;
        return;
    }
    html += '<div class="se-lessons">';
    seLessons.forEach((lesson, i) => {
        html += renderLessonCard(lesson, i);
    });
    html += '</div>';
    area.innerHTML = html;
}

function renderLessonCard(lesson, idx) {
    let html = `<div class="se-lesson-card" id="lesson-${idx}">`;
    html += `<div class="se-lesson-card-header" onclick="seToggleLesson(${idx})">
        <div class="se-lesson-num">${idx + 1}</div>
        <div style="flex:1">
            <div class="se-lesson-card-title">${esc(lesson.title)}</div>
            ${lesson.description ? `<div class="se-lesson-card-desc">${esc(lesson.description)}</div>` : ''}
        </div>
        <div class="se-lesson-toggle"><i class="fas fa-chevron-down"></i></div>
    </div>`;
    html += '<div class="se-lesson-body"><div class="se-lesson-body-inner">';

    // Dialogues
    if (lesson.dialogues && lesson.dialogues.length) {
        html += '<div class="se-section-label"><i class="fas fa-comments"></i> Dialogues</div>';
        html += '<div class="se-dialogue">';
        lesson.dialogues.forEach(d => {
            const isA = d.speaker === 'A' || d.speaker === 'a';
            const cls = isA ? 'speaker-a' : 'speaker-b';
            const avatarCls = isA ? 'a' : 'b';
            const avatarText = esc(d.speaker).charAt(0).toUpperCase();
            html += `<div class="se-dialogue-line ${cls}">
                <div class="se-speaker-avatar ${avatarCls}">${avatarText}</div>
                <div class="se-dialogue-content">
                    <div class="se-speaker-name">${esc(d.speaker)}</div>
                    <div class="se-speaker-text">${esc(d.text)}</div>
                </div>
                <button class="se-speak-btn" onclick="speakText(this, '${esc(d.text).replace(/'/g, "\\'")}')"><i class="fas fa-volume-up"></i> Listen</button>
            </div>`;
        });
        html += '</div>';
    }

    // Vocabulary
    if (lesson.vocabulary && lesson.vocabulary.length) {
        html += '<div class="se-section-label"><i class="fas fa-book"></i> Vocabulary</div>';
        html += '<div class="se-vocab-list">';
        lesson.vocabulary.forEach(v => {
            html += `<div class="se-vocab-item">
                <div class="se-vocab-info">
                    <div class="se-vocab-word">${esc(v.word)}</div>
                    <div class="se-vocab-meaning">${esc(v.meaning)}</div>
                </div>
                <button class="se-vocab-speak" onclick="speakText(this, '${esc(v.word).replace(/'/g, "\\'")}')"><i class="fas fa-volume-up"></i></button>
            </div>`;
        });
        html += '</div>';
    }

    // Tips
    if (lesson.tips && lesson.tips.length) {
        html += '<div class="se-section-label"><i class="fas fa-lightbulb"></i> Tips</div>';
        html += '<div class="se-tips"><ul class="se-tips-list">';
        lesson.tips.forEach(t => { html += `<li>${esc(t)}</li>`; });
        html += '</ul></div>';
    }

    // Practice Questions
    if (lesson.practice && lesson.practice.length) {
        html += '<div class="se-section-label"><i class="fas fa-microphone"></i> Practice - Say These Aloud</div>';
        html += '<div class="se-practice"><ul class="se-practice-questions">';
        lesson.practice.forEach(p => {
            html += `<li onclick="speakText(this, '${esc(p).replace(/'/g, "\\'")}')">${esc(p)}</li>`;
        });
        html += '</ul></div>';
    }

    // Listen All & Translation
    if (lesson.dialogues && lesson.dialogues.length) {
        const allText = lesson.dialogues.map(d => d.text).join('. ');
        html += `<div class="se-lesson-actions">
            <button class="se-action-btn se-action-btn-listen" onclick="speakText(this, '${esc(allText).replace(/'/g, "\\'")}')"><i class="fas fa-headphones"></i> Listen All</button>`;
        if (lesson.translation) {
            html += `<button class="se-action-btn se-action-btn-translate" id="trans-btn-${idx}" onclick="seToggleTranslation(${idx})"><i class="fas fa-language"></i> Hindi Translation</button>`;
        }
        html += '</div>';
    } else if (lesson.translation) {
        html += `<div class="se-lesson-actions">
            <button class="se-action-btn se-action-btn-translate" id="trans-btn-${idx}" onclick="seToggleTranslation(${idx})"><i class="fas fa-language"></i> Hindi Translation</button>
        </div>`;
    }

    if (lesson.translation) {
        html += `<div class="se-translation" id="trans-${idx}">
            <div class="se-translation-label"><i class="fas fa-translation"></i> Hindi Translation</div>
            <div class="se-translation-text">${esc(lesson.translation)}</div>
        </div>`;
    }

    html += '</div></div></div>';
    return html;
}

function seToggleLesson(idx) {
    const card = document.getElementById('lesson-' + idx);
    if (card) card.classList.toggle('expanded');
}

function seToggleTranslation(idx) {
    const el = document.getElementById('trans-' + idx);
    const btn = document.getElementById('trans-btn-' + idx);
    if (el) el.classList.toggle('active');
    if (btn) btn.classList.toggle('active');
}

function speakText(btn, text) {
    if (!window.speechSynthesis) { alert('Speech not supported in this browser'); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.8;
    utter.lang = 'en-US';
    const orig = btn.innerHTML;
    btn.classList.add('speaking');
    btn.innerHTML = '<i class="fas fa-volume-up"></i> Speaking...';
    utter.onend = () => { btn.classList.remove('speaking'); btn.innerHTML = orig; };
    utter.onerror = () => { btn.classList.remove('speaking'); btn.innerHTML = orig; };
    window.speechSynthesis.speak(utter);
}

function seBackToCategories() {
    document.getElementById('lessonArea').classList.remove('active');
    document.getElementById('categories').style.display = 'grid';
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

seInit();
