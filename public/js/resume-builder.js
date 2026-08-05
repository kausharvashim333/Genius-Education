let currentTemplate = 'modern';
let currentColor = '#667eea';
let currentSidebarColor = '#1a1a2e';
let currentTextColor = '#333333';
let currentBorderColor = '#667eea';
let currentAccentColor = '#667eea';
let currentFont = 'sans';
let zoomLevel = 100;
let currentTab = 'personal';
let expCount = 0, eduCount = 0, certCount = 0, projCount = 0, langCount = 0, hobbyCount = 0, achieveCount = 0;
let photoData = null;
let sections = { summary: true, experience: true, education: true, skills: true, certifications: true, projects: true, languages: true, hobbies: true, achievements: true, declaration: true };
let sectionOrder = ['summary','experience','education','skills','certifications','projects','languages','hobbies','achievements','declaration'];
let sectionIcons = { summary:'fa-align-left', experience:'fa-briefcase', education:'fa-graduation-cap', skills:'fa-star', certifications:'fa-certificate', projects:'fa-project-diagram', languages:'fa-language', hobbies:'fa-heart', achievements:'fa-trophy', declaration:'fa-file-signature' };
let currentResumeId = 'default';
let savedResumes = {};

const FONTS = {
    sans: "'Segoe UI', Tahoma, Geneva, sans-serif",
    serif: "'Times New Roman', Times, serif",
    modern: "'Trebuchet MS', 'Helvetica Neue', sans-serif",
    classic: "Georgia, 'Times New Roman', serif"
};

const COLORS = ['#667eea','#764ba2','#1a1a2e','#0d9488','#dc2626','#f59e0b','#3b82f6','#6366f1'];
const SIDEBAR_COLORS = ['#1a1a2e','#667eea','#764ba2','#0d9488','#dc2626','#1e293b','#0f172a','#312e81'];
const TEXT_COLORS = ['#333333','#1a1a2e','#444444','#222222','#1e293b','#374151'];
const BORDER_COLORS = ['#667eea','#764ba2','#0d9488','#dc2626','#f59e0b','#3b82f6','#6366f1','#333333'];

function init() {
    const panel = document.getElementById('formPanel');
    panel.innerHTML = `
        <div class="rb-progress">
            <div class="rb-progress-label"><span>Resume Completion</span><span id="progressPct">0%</span></div>
            <div class="rb-progress-bar"><div class="rb-progress-fill" id="progressFill" style="width:0%"></div></div>
        </div>
        <div class="rb-score-box" id="resumeScoreBox">
            <div class="rb-score-header"><i class="fas fa-chart-line"></i> Resume Score</div>
            <div class="rb-score-circle" id="scoreCircle">0</div>
            <div class="rb-score-tips" id="scoreTips"></div>
        </div>
        <div class="rb-resume-bar">
            <span class="rb-color-label">Resume:</span>
            <select id="resumeSelect" onchange="switchResume(this.value)"></select>
            <button class="rb-resume-btn" onclick="saveCurrentResume()" title="Save"><i class="fas fa-save"></i></button>
            <button class="rb-resume-btn" onclick="deleteCurrentResume()" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
        <div class="rb-tabs">
            <button class="rb-tab active" data-tab="personal" onclick="switchTab('personal')"><i class="fas fa-user"></i> Personal</button>
            <button class="rb-tab" data-tab="content" onclick="switchTab('content')"><i class="fas fa-file-alt"></i> Content</button>
            <button class="rb-tab" data-tab="design" onclick="switchTab('design')"><i class="fas fa-palette"></i> Design</button>
            <button class="rb-tab" data-tab="actions" onclick="switchTab('actions')"><i class="fas fa-download"></i> Export</button>
        </div>
        <div class="rb-tab-content active" id="tab-personal">
        <div class="rb-section-title"><i class="fas fa-user"></i> Personal Info</div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Apna naam, job title aur contact details bharo.</div>
        <div class="rb-photo-upload">
            <div class="rb-photo-preview" id="photoPreview" onclick="document.getElementById('photoInput').click()">
                <i class="fas fa-camera" id="photoIcon"></i>
            </div>
            <div class="rb-photo-btns">
                <button class="rb-photo-btn" onclick="document.getElementById('photoInput').click()"><i class="fas fa-upload"></i> Upload Photo</button>
                <button class="rb-photo-btn" onclick="removePhoto()" id="removePhotoBtn" style="display:none"><i class="fas fa-trash"></i> Remove</button>
            </div>
            <input type="file" id="photoInput" accept="image/*" style="display:none" onchange="handlePhoto(event)">
        </div>
        <div class="rb-field"><label>Full Name *</label><input type="text" id="rName" placeholder="John Doe" oninput="updatePreview()"></div>
        <div class="rb-field"><label>Job Title</label><input type="text" id="rJobTitle" placeholder="Computer Operator" oninput="updatePreview()"></div>
        <div class="rb-two-col">
            <div class="rb-field"><label>Email</label><input type="email" id="rEmail" placeholder="john@example.com" oninput="updatePreview()"></div>
            <div class="rb-field"><label>Phone</label><input type="text" id="rPhone" placeholder="+91 9876543210" oninput="updatePreview()"></div>
        </div>
        <div class="rb-two-col">
            <div class="rb-field"><label>Location</label><input type="text" id="rLocation" placeholder="Vashim, Maharashtra" oninput="updatePreview()"></div>
            <div class="rb-field"><label>LinkedIn</label><input type="text" id="rLinkedin" placeholder="linkedin.com/in/johndoe" oninput="updatePreview()"></div>
        </div>
        <div class="rb-two-col">
            <div class="rb-field"><label>GitHub (optional)</label><input type="text" id="rGithub" placeholder="github.com/johndoe" oninput="updatePreview()"></div>
            <div class="rb-field"><label>Website (optional)</label><input type="text" id="rWebsite" placeholder="myportfolio.com" oninput="updatePreview()"></div>
        </div>
        <div class="rb-section-title"><i class="fas fa-align-left"></i> Summary <div class="rb-toggle-switch on" id="toggleSummary" onclick="toggleSection('summary')"></div></div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Apne baare me 2-3 lines me likho.</div>
        <button class="rb-ai-btn" onclick="openAISummaryModal()"><i class="fas fa-magic"></i> Write with AI</button>
        <div class="rb-field"><textarea id="rSummary" placeholder="Brief about yourself - 2-3 lines..." oninput="updatePreview()"></textarea></div>
        </div>
        <div class="rb-tab-content" id="tab-content">
        <div class="rb-section-title"><i class="fas fa-briefcase"></i> Work Experience <div class="rb-toggle-switch on" id="toggleExperience" onclick="toggleSection('experience')"></div></div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Apne purane kaam ki jankari add karo - role kya tha, kis company me, kab se kab tak, aur kya kaam kiya.</div>
        <div id="experienceContainer"></div>
        <button class="rb-add-btn" onclick="addExperience()"><i class="fas fa-plus"></i> Add Experience</button>
        <div class="rb-section-title"><i class="fas fa-graduation-cap"></i> Education <div class="rb-toggle-switch on" id="toggleEducation" onclick="toggleSection('education')"></div></div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Apni padhai ki details add karo - degree/diploma ka naam, institute ka naam, saal aur percentage.</div>
        <div id="educationContainer"></div>
        <button class="rb-add-btn" onclick="addEducation()"><i class="fas fa-plus"></i> Add Education</button>
        <div class="rb-section-title"><i class="fas fa-star"></i> Skills <div class="rb-toggle-switch on" id="toggleSkills" onclick="toggleSection('skills')"></div></div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Technical Skills me computer/software skills likho (MS Office, Tally, HTML). Soft Skills me personality skills likho (Communication, Teamwork).</div>
        <div class="rb-field"><label><i class="fas fa-laptop-code" style="color:#a5b4fc;margin-right:4px"></i> Technical Skills</label><textarea id="rTechSkills" placeholder="Comma separated - e.g: MS Office, Tally Prime, HTML, CSS, Photoshop" oninput="updatePreview()"></textarea></div>
        <div class="rb-field"><label><i class="fas fa-users" style="color:#4ade80;margin-right:4px"></i> Soft Skills</label><textarea id="rSoftSkills" placeholder="Comma separated - e.g: Communication, Teamwork, Time Management, Leadership" oninput="updatePreview()"></textarea></div>
        <div class="rb-section-title"><i class="fas fa-certificate"></i> Certifications <div class="rb-toggle-switch on" id="toggleCertifications" onclick="toggleSection('certifications')"></div></div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Jo bhi certificate course kiye ho - course ka naam, institute aur saal add karo.</div>
        <div id="certContainer"></div>
        <button class="rb-add-btn" onclick="addCert()"><i class="fas fa-plus"></i> Add Certification</button>
        <div class="rb-section-title"><i class="fas fa-project-diagram"></i> Projects <div class="rb-toggle-switch on" id="toggleProjects" onclick="toggleSection('projects')"></div></div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Agar koi project banaya ho (website, app, etc.) toh uska naam, description aur link add karo.</div>
        <div id="projectContainer"></div>
        <button class="rb-add-btn" onclick="addProject()"><i class="fas fa-plus"></i> Add Project</button>
        <div class="rb-section-title"><i class="fas fa-language"></i> Languages <div class="rb-toggle-switch on" id="toggleLanguages" onclick="toggleSection('languages')"></div></div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Jo bhi languages aate ho unhe add karo - Hindi, English, Marathi, etc. Level bhi batao (Native, Fluent, Basic).</div>
        <div id="langContainer"></div>
        <button class="rb-add-btn" onclick="addLang()"><i class="fas fa-plus"></i> Add Language</button>
        <div class="rb-section-title"><i class="fas fa-heart"></i> Hobbies <div class="rb-toggle-switch on" id="toggleHobbies" onclick="toggleSection('hobbies')"></div></div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Apne shauk add karo - Reading, Cricket, Photography, etc. Ye resume me achha impression banate hain.</div>
        <div id="hobbyContainer"></div>
        <button class="rb-add-btn" onclick="addHobby()"><i class="fas fa-plus"></i> Add Hobby</button>
        <div class="rb-section-title"><i class="fas fa-trophy"></i> Achievements <div class="rb-toggle-switch on" id="toggleAchievements" onclick="toggleSection('achievements')"></div></div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Jo bhi achievements ho - competition prize, award, certificate of merit, etc. add karo.</div>
        <div id="achieveContainer"></div>
        <button class="rb-add-btn" onclick="addAchieve()"><i class="fas fa-plus"></i> Add Achievement</button>
        <div class="rb-section-title"><i class="fas fa-file-signature"></i> Declaration <div class="rb-toggle-switch on" id="toggleDeclaration" onclick="toggleSection('declaration')"></div></div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Ye ek formal statement hai jo kehta hai ki aapki di gayi jankari sahi hai. Place aur date bhi bharo.</div>
        <div class="rb-field"><textarea id="rDeclaration" placeholder="I hereby declare that the information provided above is true and correct to the best of my knowledge and belief..." oninput="updatePreview()"></textarea></div>
        <div class="rb-field"><label>Place</label><input type="text" id="rDeclPlace" placeholder="Vashim" oninput="updatePreview()"></div>
        <div class="rb-field"><label>Date</label><input type="text" id="rDeclDate" placeholder="31 Jul 2026" oninput="updatePreview()"></div>
        <div class="rb-section-title"><i class="fas fa-sort"></i> Section Order</div>
        <div class="rb-hint"><i class="fas fa-info-circle"></i> Sections ko drag karke ya upar/down buttons se reorder karo. Resume me sections isi order me dikhenge.</div>
        <div id="sectionOrderList" class="rb-order-list"></div>
        </div>
        <div class="rb-tab-content" id="tab-design">
            <div class="rb-section-title"><i class="fas fa-file-alt"></i> Template</div>
            <div class="rb-hint"><i class="fas fa-info-circle"></i> Apna pasand ka resume template choose karo.</div>
            <div class="rb-template-bar">
                <button class="rb-template-btn active" data-template="modern" onclick="switchTemplate('modern')">Modern</button>
                <button class="rb-template-btn" data-template="classic" onclick="switchTemplate('classic')">Classic</button>
                <button class="rb-template-btn" data-template="sidebar" onclick="switchTemplate('sidebar')">Sidebar</button>
                <button class="rb-template-btn" data-template="minimal" onclick="switchTemplate('minimal')">Minimal</button>
                <button class="rb-template-btn" data-template="professional" onclick="switchTemplate('professional')">Professional</button>
                <button class="rb-template-btn" data-template="creative" onclick="switchTemplate('creative')">Creative</button>
            </div>
            <div class="rb-section-title"><i class="fas fa-palette"></i> Theme Color</div>
            <div class="rb-hint"><i class="fas fa-info-circle"></i> Resume ka main color. Headings, borders aur accents me use hoga.</div>
            <div class="rb-color-bar">
                <span class="rb-color-label">Theme:</span>
                ${COLORS.map(c => `<div class="rb-color-dot${c===currentColor?' active':''}" style="background:${c}" onclick="setColor('${c}')"></div>`).join('')}
            </div>
            <div class="rb-section-title"><i class="fas fa-columns"></i> Sidebar Color</div>
            <div class="rb-hint"><i class="fas fa-info-circle"></i> Sidebar aur Professional template ke header ka background.</div>
            <div class="rb-color-bar">
                <span class="rb-color-label">Sidebar:</span>
                ${SIDEBAR_COLORS.map(c => `<div class="rb-color-dot${c===currentSidebarColor?' active':''}" style="background:${c}" onclick="setSidebarColor('${c}')"></div>`).join('')}
            </div>
            <div class="rb-section-title"><i class="fas fa-font"></i> Text Color</div>
            <div class="rb-hint"><i class="fas fa-info-circle"></i> Resume ka main text color. Dark colors recommended.</div>
            <div class="rb-color-bar">
                <span class="rb-color-label">Text:</span>
                ${TEXT_COLORS.map(c => `<div class="rb-color-dot${c===currentTextColor?' active':''}" style="background:${c}" onclick="setTextColor('${c}')"></div>`).join('')}
            </div>
            <div class="rb-section-title"><i class="fas fa-border-style"></i> Border Color</div>
            <div class="rb-hint"><i class="fas fa-info-circle"></i> Section headings ke niche aur borders ka color.</div>
            <div class="rb-color-bar">
                <span class="rb-color-label">Border:</span>
                ${BORDER_COLORS.map(c => `<div class="rb-color-dot${c===currentBorderColor?' active':''}" style="background:${c}" onclick="setBorderColor('${c}')"></div>`).join('')}
            </div>
            <div class="rb-section-title"><i class="fas fa-magic"></i> Accent Color</div>
            <div class="rb-hint"><i class="fas fa-info-circle"></i> Job title, subtitles aur highlights ka color.</div>
            <div class="rb-color-bar">
                <span class="rb-color-label">Accent:</span>
                ${BORDER_COLORS.map(c => `<div class="rb-color-dot${c===currentAccentColor?' active':''}" style="background:${c}" onclick="setAccentColor('${c}')"></div>`).join('')}
            </div>
            <div class="rb-section-title"><i class="fas fa-text-height"></i> Font Family</div>
            <div class="rb-hint"><i class="fas fa-info-circle"></i> Resume ka font style choose karo.</div>
            <div class="rb-font-bar">
                <button class="rb-font-btn${currentFont==='sans'?' active':''}" onclick="setFont('sans')">Sans</button>
                <button class="rb-font-btn${currentFont==='serif'?' active':''}" onclick="setFont('serif')">Serif</button>
                <button class="rb-font-btn${currentFont==='modern'?' active':''}" onclick="setFont('modern')">Modern</button>
                <button class="rb-font-btn${currentFont==='classic'?' active':''}" onclick="setFont('classic')">Classic</button>
            </div>
        </div>
        <div class="rb-tab-content" id="tab-actions">
            <div class="rb-section-title"><i class="fas fa-download"></i> Download & Print</div>
            <div class="rb-hint"><i class="fas fa-info-circle"></i> Sab fields bharne ke baad PDF download ya print karo.</div>
            <button class="rb-btn rb-btn-primary" style="width:100%;justify-content:center;margin-bottom:10px" onclick="downloadPDF()"><i class="fas fa-download"></i> Download PDF</button>
            <button class="rb-btn rb-btn-secondary" style="width:100%;justify-content:center;margin-bottom:10px" onclick="printResume()"><i class="fas fa-print"></i> Print Resume</button>
            <div class="rb-section-title"><i class="fas fa-magic"></i> Quick Actions</div>
            <button class="rb-btn rb-btn-secondary" style="width:100%;justify-content:center;margin-bottom:10px" onclick="loadSampleData()"><i class="fas fa-magic"></i> Sample Fill</button>
            <button class="rb-btn rb-btn-secondary" style="width:100%;justify-content:center;margin-bottom:10px" onclick="clearAll()"><i class="fas fa-eraser"></i> Clear All</button>
            <div class="rb-section-title"><i class="fas fa-file-import"></i> Export / Import</div>
            <div class="rb-hint"><i class="fas fa-info-circle"></i> Export se data file download karo. Import se wapas load karo.</div>
            <button class="rb-btn rb-btn-secondary" style="width:100%;justify-content:center;margin-bottom:10px" onclick="exportData()"><i class="fas fa-file-export"></i> Export Data</button>
            <button class="rb-btn rb-btn-secondary" style="width:100%;justify-content:center;margin-bottom:10px" onclick="document.getElementById('importInput').click()"><i class="fas fa-file-import"></i> Import Data</button>
            <input type="file" id="importInput" accept=".json" style="display:none" onchange="importData(event)">
        </div>`;
    updatePreview();
    renderSectionOrder();
    loadSavedResumes();
    autoSave();
}

function openAISummaryModal() {
    const modal = document.getElementById('aiSummaryModal');
    if (!modal) return;
    // Pre-fill from existing form data
    const jobTitle = document.getElementById('rJobTitle').value;
    const techSkills = document.getElementById('rTechSkills').value;
    if (jobTitle) document.getElementById('aiRole').value = jobTitle;
    if (techSkills) document.getElementById('aiSkills').value = techSkills.split(',').slice(0, 4).join(', ');
    modal.classList.add('active');
}

function closeAISummaryModal() {
    document.getElementById('aiSummaryModal').classList.remove('active');
}

function generateAISummary() {
    const role = document.getElementById('aiRole').value.trim();
    const experience = document.getElementById('aiExperience').value.trim();
    const skills = document.getElementById('aiSkills').value.trim();
    const qualification = document.getElementById('aiQualification').value.trim();
    const goal = document.getElementById('aiGoal').value;

    if (!role) { alert('Role/job naam zaroori hai!'); return; }

    let summary = '';

    // Build summary based on experience level
    const isFresher = experience.toLowerCase().includes('fresher') || experience.toLowerCase().includes('0') || !experience;

    if (isFresher) {
        summary = `${role}`;
        if (qualification) summary += ` with ${qualification}`;
        if (skills) summary += `. Skilled in ${skills}`;
        summary += `. `;
        if (goal) summary += goal + '.';
        else summary += 'Eager to start my career and contribute to the organization.';
    } else {
        summary = `Detail-oriented ${role}`;
        if (experience) summary += ` with ${experience} experience`;
        if (skills) summary += ` in ${skills}`;
        summary += `. `;
        if (qualification) summary += `Completed ${qualification}. `;
        if (goal) summary += goal + '.';
        else summary += 'Seeking a challenging role to utilize my skills and contribute to organizational growth.';
    }

    // Clean up multiple spaces
    summary = summary.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim();

    document.getElementById('rSummary').value = summary;
    updatePreview();
    closeAISummaryModal();
}

function toggleSection(sec) {
    sections[sec] = !sections[sec];
    const toggle = document.getElementById('toggle' + sec.charAt(0).toUpperCase() + sec.slice(1));
    if (toggle) toggle.classList.toggle('on', sections[sec]);
    updatePreview();
}

function setColor(c) {
    currentColor = c;
    event.target.classList.add('active');
    event.target.parentElement.querySelectorAll('.rb-color-dot').forEach(d => { if(d!==event.target) d.classList.remove('active'); });
    updatePreview();
}

function setSidebarColor(c) {
    currentSidebarColor = c;
    event.target.classList.add('active');
    event.target.parentElement.querySelectorAll('.rb-color-dot').forEach(d => { if(d!==event.target) d.classList.remove('active'); });
    updatePreview();
}

function setTextColor(c) {
    currentTextColor = c;
    event.target.classList.add('active');
    event.target.parentElement.querySelectorAll('.rb-color-dot').forEach(d => { if(d!==event.target) d.classList.remove('active'); });
    updatePreview();
}

function setBorderColor(c) {
    currentBorderColor = c;
    event.target.classList.add('active');
    event.target.parentElement.querySelectorAll('.rb-color-dot').forEach(d => { if(d!==event.target) d.classList.remove('active'); });
    updatePreview();
}

function setAccentColor(c) {
    currentAccentColor = c;
    event.target.classList.add('active');
    event.target.parentElement.querySelectorAll('.rb-color-dot').forEach(d => { if(d!==event.target) d.classList.remove('active'); });
    updatePreview();
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.rb-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.rb-tab[data-tab="' + tab + '"]').classList.add('active');
    document.querySelectorAll('.rb-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
}

function setFont(f) {
    currentFont = f;
    document.querySelectorAll('.rb-font-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    updatePreview();
}

function switchTemplate(t) {
    currentTemplate = t;
    document.querySelectorAll('.rb-template-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.rb-template-btn[data-template="' + t + '"]').classList.add('active');
    updatePreview();
}

function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        photoData = ev.target.result;
        const preview = document.getElementById('photoPreview');
        preview.innerHTML = '<img src="' + photoData + '">';
        document.getElementById('removePhotoBtn').style.display = 'block';
        updatePreview();
    };
    reader.readAsDataURL(file);
}

function removePhoto() {
    photoData = null;
    document.getElementById('photoPreview').innerHTML = '<i class="fas fa-camera" id="photoIcon"></i>';
    document.getElementById('removePhotoBtn').style.display = 'none';
    document.getElementById('photoInput').value = '';
    updatePreview();
}

function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function updatePreview() {
    const name = esc(document.getElementById('rName').value) || 'Your Name';
    const title = esc(document.getElementById('rJobTitle').value) || 'Job Title';
    const email = esc(document.getElementById('rEmail').value);
    const phone = esc(document.getElementById('rPhone').value);
    const loc = esc(document.getElementById('rLocation').value);
    const linkedin = esc(document.getElementById('rLinkedin').value);
    const github = esc(document.getElementById('rGithub').value);
    const website = esc(document.getElementById('rWebsite').value);
    const summary = esc(document.getElementById('rSummary').value);
    const techSkillsRaw = document.getElementById('rTechSkills').value;
    const techSkills = techSkillsRaw ? techSkillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const softSkillsRaw = document.getElementById('rSoftSkills').value;
    const softSkills = softSkillsRaw ? softSkillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    let contactHtml = '<div class="r-contact">';
    if (email) contactHtml += '<span><i class="fas fa-envelope"></i> ' + email + '</span>';
    if (phone) contactHtml += '<span><i class="fas fa-phone"></i> ' + phone + '</span>';
    if (loc) contactHtml += '<span><i class="fas fa-map-marker-alt"></i> ' + loc + '</span>';
    if (linkedin) contactHtml += '<span><i class="fab fa-linkedin"></i> ' + linkedin + '</span>';
    if (github) contactHtml += '<span><i class="fab fa-github"></i> ' + github + '</span>';
    if (website) contactHtml += '<span><i class="fas fa-globe"></i> ' + website + '</span>';
    contactHtml += '</div>';

    let skillsHtml = '';
    if (techSkills.length) skillsHtml += '<div class="r-skill-cat"><span class="r-skill-cat-label"><i class="fas fa-laptop-code"></i> Technical:</span> <span class="r-skill-list">' + techSkills.map(esc).join(', ') + '</span></div>';
    if (softSkills.length) skillsHtml += '<div class="r-skill-cat"><span class="r-skill-cat-label"><i class="fas fa-users"></i> Soft:</span> <span class="r-skill-list">' + softSkills.map(esc).join(', ') + '</span></div>';

    let expHtml = '';
    for (let i = 1; i <= expCount; i++) {
        const el = document.getElementById('expRole' + i); if (!el) continue;
        const role = esc(el.value), company = esc(document.getElementById('expCompany' + i).value);
        const dates = esc(document.getElementById('expDates' + i).value), desc = esc(document.getElementById('expDesc' + i).value);
        if (!role && !company) continue;
        expHtml += '<div class="r-item"><div class="r-item-header"><span class="r-item-title">' + (role || '') + '</span><span class="r-item-date">' + (dates || '') + '</span></div><div class="r-item-subtitle">' + (company || '') + '</div>' + (desc ? '<div class="r-item-desc">' + desc.replace(/\n/g, '<br>') + '</div>' : '') + '</div>';
    }

    let eduHtml = '';
    for (let i = 1; i <= eduCount; i++) {
        const el = document.getElementById('eduDegree' + i); if (!el) continue;
        const degree = esc(el.value), inst = esc(document.getElementById('eduInst' + i).value);
        const year = esc(document.getElementById('eduYear' + i).value), pct = esc(document.getElementById('eduPct' + i).value);
        if (!degree && !inst) continue;
        eduHtml += '<div class="r-item"><div class="r-item-header"><span class="r-item-title">' + (degree || '') + '</span><span class="r-item-date">' + (year || '') + '</span></div><div class="r-item-subtitle">' + (inst || '') + '</div>' + (pct ? '<div class="r-item-desc">Percentage: ' + pct + '%</div>' : '') + '</div>';
    }

    let certHtml = '';
    for (let i = 1; i <= certCount; i++) {
        const el = document.getElementById('certName' + i); if (!el) continue;
        const cname = esc(el.value), corg = esc(document.getElementById('certOrg' + i).value), cyear = esc(document.getElementById('certYear' + i).value);
        if (!cname) continue;
        certHtml += '<div class="r-item"><div class="r-item-header"><span class="r-item-title">' + cname + '</span><span class="r-item-date">' + (cyear || '') + '</span></div>' + (corg ? '<div class="r-item-subtitle">' + corg + '</div>' : '') + '</div>';
    }

    let projHtml = '';
    for (let i = 1; i <= projCount; i++) {
        const el = document.getElementById('projName' + i); if (!el) continue;
        const pname = esc(el.value), pdesc = esc(document.getElementById('projDesc' + i).value), plink = esc(document.getElementById('projLink' + i).value);
        if (!pname) continue;
        projHtml += '<div class="r-item"><div class="r-item-title">' + pname + '</div>' + (pdesc ? '<div class="r-item-desc">' + pdesc.replace(/\n/g, '<br>') + '</div>' : '') + (plink ? '<div class="r-item-desc"><a href="' + plink + '" style="color:' + currentColor + ';">' + plink + '</a></div>' : '') + '</div>';
    }

    let langHtml = '';
    for (let i = 1; i <= langCount; i++) {
        const el = document.getElementById('langName' + i); if (!el) continue;
        const lname = esc(el.value), llevel = esc(document.getElementById('langLevel' + i).value);
        if (!lname) continue;
        langHtml += (langHtml ? ', ' : '') + lname + (llevel ? ' (' + llevel + ')' : '');
    }

    let hobbyHtml = '';
    for (let i = 1; i <= hobbyCount; i++) {
        const el = document.getElementById('hobbyName' + i); if (!el) continue;
        const hname = esc(el.value);
        if (!hname) continue;
        hobbyHtml += (hobbyHtml ? ', ' : '') + hname;
    }

    let achieveHtml = '';
    for (let i = 1; i <= achieveCount; i++) {
        const el = document.getElementById('achieveName' + i); if (!el) continue;
        const aname = esc(el.value);
        if (!aname) continue;
        achieveHtml += '<div class="r-achieve">' + aname + '</div>';
    }

    const photoHtml = photoData ? '<img class="r-photo" src="' + photoData + '">' : '';

    // Declaration HTML
    const declText = esc(document.getElementById('rDeclaration').value);
    const declPlace = esc(document.getElementById('rDeclPlace').value);
    const declDate = esc(document.getElementById('rDeclDate').value);
    let declHtml = '';
    if (declText && sections.declaration) {
        declHtml = '<div class="r-section"><div class="r-section-title"><i class="fas ' + sectionIcons.declaration + '"></i> Declaration</div><div class="r-declaration">' + declText.replace(/\n/g, '<br>') + '</div>';
        declHtml += '<div class="r-decl-meta"><div class="r-decl-left">';
        if (declPlace) declHtml += '<div class="r-decl-place"><strong>Place:</strong> ' + declPlace + '</div>';
        if (declDate) declHtml += '<div class="r-decl-date"><strong>Date:</strong> ' + declDate + '</div>';
        declHtml += '</div><div class="r-decl-right">';
        if (name && name !== 'Your Name') declHtml += '<div class="r-decl-sign">' + name + '</div>';
        declHtml += '</div></div>';
        declHtml += '</div>';
    }

    // Build section HTML based on sectionOrder
    const hasSkills = techSkills.length || softSkills.length;
    const sectionMap = {
        summary: (summary && sections.summary) ? '<div class="r-section"><div class="r-section-title"><i class="fas ' + sectionIcons.summary + '"></i> Summary</div><div class="r-summary">' + summary.replace(/\n/g, '<br>') + '</div></div>' : '',
        experience: (expHtml && sections.experience) ? '<div class="r-section"><div class="r-section-title"><i class="fas ' + sectionIcons.experience + '"></i> Work Experience</div>' + expHtml + '</div>' : '',
        education: (eduHtml && sections.education) ? '<div class="r-section"><div class="r-section-title"><i class="fas ' + sectionIcons.education + '"></i> Education</div>' + eduHtml + '</div>' : '',
        skills: (hasSkills && sections.skills) ? '<div class="r-section"><div class="r-section-title"><i class="fas ' + sectionIcons.skills + '"></i> Skills</div>' + skillsHtml + '</div>' : '',
        certifications: (certHtml && sections.certifications) ? '<div class="r-section"><div class="r-section-title"><i class="fas ' + sectionIcons.certifications + '"></i> Certifications</div>' + certHtml + '</div>' : '',
        projects: (projHtml && sections.projects) ? '<div class="r-section"><div class="r-section-title"><i class="fas ' + sectionIcons.projects + '"></i> Projects</div>' + projHtml + '</div>' : '',
        languages: (langHtml && sections.languages) ? '<div class="r-section"><div class="r-section-title"><i class="fas ' + sectionIcons.languages + '"></i> Languages</div><div class="r-lang-list">' + langHtml + '</div></div>' : '',
        hobbies: (hobbyHtml && sections.hobbies) ? '<div class="r-section"><div class="r-section-title"><i class="fas ' + sectionIcons.hobbies + '"></i> Hobbies</div><div class="r-hobby-list">' + hobbyHtml + '</div></div>' : '',
        achievements: (achieveHtml && sections.achievements) ? '<div class="r-section"><div class="r-section-title"><i class="fas ' + sectionIcons.achievements + '"></i> Achievements</div>' + achieveHtml + '</div>' : '',
        declaration: declHtml
    };

    // Build ordered content
    const orderedContent = sectionOrder.map(s => sectionMap[s] || '').join('');

    const tpl = document.getElementById('resumeTemplate');
    tpl.className = 'rt rt-' + currentTemplate;
    tpl.style.setProperty('--rb-color', currentColor);
    tpl.style.fontFamily = FONTS[currentFont] || FONTS.sans;

    const headerHtml = photoHtml + '<div class="r-name">' + name + '</div><div class="r-title">' + title + '</div>' + contactHtml;

    if (currentTemplate === 'sidebar') {
        // Split sections: sidebar gets skills, languages, hobbies, certs; main gets rest
        const sidebarSecs = ['skills','languages','hobbies','certifications'].map(s => sectionMap[s] || '').join('');
        const mainSecs = ['summary','experience','education','projects','achievements','declaration'].map(s => sectionMap[s] || '').join('');
        tpl.innerHTML = '<div class="r-sidebar">' + photoHtml + '<div class="r-name">' + name + '</div><div class="r-title">' + title + '</div>' + contactHtml + sidebarSecs + '</div><div class="r-main">' + mainSecs + '</div>';
    } else if (currentTemplate === 'professional') {
        tpl.innerHTML = '<div class="r-header">' + headerHtml + '</div><div class="r-body">' + orderedContent + '</div>';
    } else if (currentTemplate === 'creative') {
        const leftSecs = ['skills','languages','hobbies','certifications','achievements'].map(s => sectionMap[s] || '').join('');
        const rightSecs = ['summary','experience','education','projects','declaration'].map(s => sectionMap[s] || '').join('');
        const creativeHeader = '<div class="r-creative-header">' +
            (photoData ? '<div class="r-creative-photo">' + photoHtml + '</div>' : '') +
            '<div class="r-creative-info"><div class="r-name">' + name + '</div><div class="r-title">' + title + '</div>' + contactHtml + '</div></div>';
        tpl.innerHTML = creativeHeader + '<div class="r-creative-body"><div class="r-creative-left">' + leftSecs + '</div><div class="r-creative-right">' + rightSecs + '</div></div>';
    } else {
        tpl.innerHTML = headerHtml + orderedContent;
    }

    applyColor();
    updateProgress();
    updateScore();
    autoSave();
}

function applyColor() {
    const tpl = document.getElementById('resumeTemplate');
    if (tpl) {
        tpl.style.setProperty('--rb-color', currentColor);
        tpl.style.setProperty('--rb-color-light', currentColor + '1a');
        tpl.style.setProperty('--rb-color-border', currentBorderColor);
        tpl.style.setProperty('--rb-sidebar-bg', currentSidebarColor);
        tpl.style.setProperty('--rb-text', currentTextColor);
        tpl.style.setProperty('--rb-accent', currentAccentColor);
        // Darken color for gradients
        const c = currentColor.replace('#','');
        const r = Math.max(0, parseInt(c.substr(0,2),16) - 30);
        const g = Math.max(0, parseInt(c.substr(2,2),16) - 30);
        const b = Math.max(0, parseInt(c.substr(4,2),16) - 30);
        tpl.style.setProperty('--rb-color-dark', '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0'));
    }
}

function updateProgress() {
    let filled = 0, total = 10;
    if (document.getElementById('rName').value) filled++;
    if (document.getElementById('rJobTitle').value) filled++;
    if (document.getElementById('rEmail').value) filled++;
    if (document.getElementById('rPhone').value) filled++;
    if (document.getElementById('rLocation').value) filled++;
    if (document.getElementById('rSummary').value) filled++;
    if (document.getElementById('rTechSkills').value || document.getElementById('rSoftSkills').value) filled++;
    if (expCount > 0 && document.getElementById('expRole1') && document.getElementById('expRole1').value) filled++;
    if (eduCount > 0 && document.getElementById('eduDegree1') && document.getElementById('eduDegree1').value) filled++;
    if (photoData) filled++;
    const pct = Math.round((filled / total) * 100);
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressPct').textContent = pct + '%';
}

function updateScore() {
    let score = 0;
    const tips = [];

    if (document.getElementById('rName').value) score += 10; else tips.push('Add your Full Name');
    if (document.getElementById('rJobTitle').value) score += 8; else tips.push('Add a Job Title');
    if (document.getElementById('rEmail').value) score += 5; else tips.push('Add Email');
    if (document.getElementById('rPhone').value) score += 5; else tips.push('Add Phone number');
    if (document.getElementById('rLocation').value) score += 5; else tips.push('Add Location');
    if (photoData) score += 7; else tips.push('Add a professional photo');
    if (document.getElementById('rSummary').value) {
        const sumLen = document.getElementById('rSummary').value.length;
        if (sumLen > 50) score += 10; else { score += 5; tips.push('Make Summary more detailed (50+ characters)'); }
    } else tips.push('Add a professional Summary');
    if (document.getElementById('rTechSkills').value || document.getElementById('rSoftSkills').value) score += 10; else tips.push('Add Technical & Soft Skills');
    if (expCount > 0 && document.getElementById('expRole1') && document.getElementById('expRole1').value) score += 15; else tips.push('Add Work Experience');
    if (eduCount > 0 && document.getElementById('eduDegree1') && document.getElementById('eduDegree1').value) score += 10; else tips.push('Add Education details');
    if (certCount > 0 && document.getElementById('certName1') && document.getElementById('certName1').value) score += 5; else tips.push('Add Certifications');
    if (langCount > 0 && document.getElementById('langName1') && document.getElementById('langName1').value) score += 5; else tips.push('Add Languages');
    if (document.getElementById('rDeclaration').value) score += 5; else tips.push('Add a Declaration');

    const scoreEl = document.getElementById('scoreCircle');
    const tipsEl = document.getElementById('scoreTips');
    if (scoreEl) scoreEl.textContent = score;
    if (scoreEl) {
        scoreEl.className = 'rb-score-circle';
        if (score >= 80) scoreEl.classList.add('good');
        else if (score >= 50) scoreEl.classList.add('ok');
        else scoreEl.classList.add('low');
    }
    if (tipsEl) {
        if (tips.length === 0) {
            tipsEl.innerHTML = '<div class="rb-score-tip good"><i class="fas fa-check-circle"></i> Great! Your resume looks complete.</div>';
        } else {
            tipsEl.innerHTML = tips.slice(0, 5).map(t => '<div class="rb-score-tip"><i class="fas fa-arrow-right"></i> ' + t + '</div>').join('');
        }
    }
}

function moveSection(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sectionOrder.length) return;
    const tmp = sectionOrder[idx];
    sectionOrder[idx] = sectionOrder[newIdx];
    sectionOrder[newIdx] = tmp;
    updatePreview();
    renderSectionOrder();
}

function renderSectionOrder() {
    const container = document.getElementById('sectionOrderList');
    if (!container) return;
    const labels = { summary:'Summary', experience:'Work Experience', education:'Education', skills:'Skills', certifications:'Certifications', projects:'Projects', languages:'Languages', hobbies:'Hobbies', achievements:'Achievements', declaration:'Declaration' };
    container.innerHTML = sectionOrder.map((s, i) => 
        '<div class="rb-order-item" draggable="true" ondragstart="dragSection(event,' + i + ')" ondragover="event.preventDefault()" ondrop="dropSection(event,' + i + ')">' +
        '<i class="fas fa-grip-vertical"></i> ' +
        '<i class="fas ' + sectionIcons[s] + '"></i> ' + labels[s] +
        '<button class="rb-order-up" onclick="moveSection(' + i + ',-1)"' + (i===0?' disabled':'') + '><i class="fas fa-chevron-up"></i></button>' +
        '<button class="rb-order-down" onclick="moveSection(' + i + ',1)"' + (i===sectionOrder.length-1?' disabled':'') + '><i class="fas fa-chevron-down"></i></button>' +
        '</div>'
    ).join('');
}

let _dragIdx = null;
function dragSection(e, idx) { _dragIdx = idx; }
function dropSection(e, idx) {
    e.preventDefault();
    if (_dragIdx === null || _dragIdx === idx) return;
    const moved = sectionOrder.splice(_dragIdx, 1)[0];
    sectionOrder.splice(idx, 0, moved);
    _dragIdx = null;
    updatePreview();
    renderSectionOrder();
}

function saveCurrentResume() {
    const name = prompt('Resume ka naam do (e.g: Computer Operator Resume):');
    if (!name) return;
    const id = 'resume_' + Date.now();
    savedResumes[id] = { name: name, data: collectData() };
    try {
        localStorage.setItem('rb_saved_resumes', JSON.stringify(savedResumes));
        currentResumeId = id;
        refreshResumeSelect();
        alert('Resume "' + name + '" save ho gaya!');
    } catch(e) { alert('Save nahi hua: ' + e.message); }
}

function switchResume(id) {
    if (id === 'default') {
        currentResumeId = 'default';
        clearAll();
        return;
    }
    if (!savedResumes[id]) return;
    currentResumeId = id;
    restoreData(savedResumes[id].data);
}

function deleteCurrentResume() {
    if (currentResumeId === 'default') { alert('Default resume delete nahi ho sakta'); return; }
    if (!confirm('Ye resume delete karna hai?')) return;
    delete savedResumes[currentResumeId];
    try { localStorage.setItem('rb_saved_resumes', JSON.stringify(savedResumes)); } catch(e) {}
    currentResumeId = 'default';
    refreshResumeSelect();
    clearAll();
}

function refreshResumeSelect() {
    const sel = document.getElementById('resumeSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="default">Default Resume</option>';
    Object.keys(savedResumes).forEach(id => {
        sel.innerHTML += '<option value="' + id + '"' + (id===currentResumeId?' selected':'') + '>' + savedResumes[id].name + '</option>';
    });
}

function loadSavedResumes() {
    try {
        const saved = localStorage.getItem('rb_saved_resumes');
        if (saved) savedResumes = JSON.parse(saved) || {};
    } catch(e) { savedResumes = {}; }
    refreshResumeSelect();
}

function addExperience() {
    expCount++;
    const c = document.getElementById('experienceContainer');
    const d = document.createElement('div');
    d.className = 'rb-entry-block';
    d.id = 'expBlock' + expCount;
    d.innerHTML = '<button class="rb-remove-btn" onclick="this.parentElement.remove();updatePreview()"><i class="fas fa-times"></i></button><div class="rb-field"><label>Role / Position</label><input type="text" id="expRole' + expCount + '" placeholder="Data Entry Operator" oninput="updatePreview()"></div><div class="rb-field"><label>Company</label><input type="text" id="expCompany' + expCount + '" placeholder="ABC Company" oninput="updatePreview()"></div><div class="rb-field"><label>Duration</label><input type="text" id="expDates' + expCount + '" placeholder="Jan 2024 - Present" oninput="updatePreview()"></div><div class="rb-field"><label>Description</label><textarea id="expDesc' + expCount + '" placeholder="Key responsibilities and achievements..." oninput="updatePreview()"></textarea></div>';
    c.appendChild(d);
    updatePreview();
}

function addEducation() {
    eduCount++;
    const c = document.getElementById('educationContainer');
    const d = document.createElement('div');
    d.className = 'rb-entry-block';
    d.id = 'eduBlock' + eduCount;
    d.innerHTML = '<button class="rb-remove-btn" onclick="this.parentElement.remove();updatePreview()"><i class="fas fa-times"></i></button><div class="rb-field"><label>Degree / Qualification</label><input type="text" id="eduDegree' + eduCount + '" placeholder="B.Com" oninput="updatePreview()"></div><div class="rb-field"><label>Institute / School</label><input type="text" id="eduInst' + eduCount + '" placeholder="College Name" oninput="updatePreview()"></div><div class="rb-two-col"><div class="rb-field"><label>Year</label><input type="text" id="eduYear' + eduCount + '" placeholder="2023" oninput="updatePreview()"></div><div class="rb-field"><label>Percentage</label><input type="text" id="eduPct' + eduCount + '" placeholder="75" oninput="updatePreview()"></div></div>';
    c.appendChild(d);
    updatePreview();
}

function addCert() {
    certCount++;
    const c = document.getElementById('certContainer');
    const d = document.createElement('div');
    d.className = 'rb-entry-block';
    d.id = 'certBlock' + certCount;
    d.innerHTML = '<button class="rb-remove-btn" onclick="this.parentElement.remove();updatePreview()"><i class="fas fa-times"></i></button><div class="rb-field"><label>Certificate Name</label><input type="text" id="certName' + certCount + '" placeholder="DCA - Diploma in Computer Applications" oninput="updatePreview()"></div><div class="rb-two-col"><div class="rb-field"><label>Organization</label><input type="text" id="certOrg' + certCount + '" placeholder="Genius Computer Education" oninput="updatePreview()"></div><div class="rb-field"><label>Year</label><input type="text" id="certYear' + certCount + '" placeholder="2024" oninput="updatePreview()"></div></div>';
    c.appendChild(d);
    updatePreview();
}

function addProject() {
    projCount++;
    const c = document.getElementById('projectContainer');
    const d = document.createElement('div');
    d.className = 'rb-entry-block';
    d.id = 'projBlock' + projCount;
    d.innerHTML = '<button class="rb-remove-btn" onclick="this.parentElement.remove();updatePreview()"><i class="fas fa-times"></i></button><div class="rb-field"><label>Project Name</label><input type="text" id="projName' + projCount + '" placeholder="School Management System" oninput="updatePreview()"></div><div class="rb-field"><label>Description</label><textarea id="projDesc' + projCount + '" placeholder="Brief about the project..." oninput="updatePreview()"></textarea></div><div class="rb-field"><label>Link (optional)</label><input type="text" id="projLink' + projCount + '" placeholder="github.com/..." oninput="updatePreview()"></div>';
    c.appendChild(d);
    updatePreview();
}

function addLang() {
    langCount++;
    const c = document.getElementById('langContainer');
    const d = document.createElement('div');
    d.className = 'rb-entry-block';
    d.id = 'langBlock' + langCount;
    d.innerHTML = '<button class="rb-remove-btn" onclick="this.parentElement.remove();updatePreview()"><i class="fas fa-times"></i></button><div class="rb-two-col"><div class="rb-field"><label>Language</label><input type="text" id="langName' + langCount + '" placeholder="Hindi" oninput="updatePreview()"></div><div class="rb-field"><label>Proficiency</label><select id="langLevel' + langCount + '" onchange="updatePreview()"><option value="">Select</option><option>Beginner</option><option>Intermediate</option><option>Fluent</option><option>Native</option></select></div></div>';
    c.appendChild(d);
    updatePreview();
}

function addHobby() {
    hobbyCount++;
    const c = document.getElementById('hobbyContainer');
    const d = document.createElement('div');
    d.className = 'rb-entry-block';
    d.id = 'hobbyBlock' + hobbyCount;
    d.innerHTML = '<button class="rb-remove-btn" onclick="this.parentElement.remove();updatePreview()"><i class="fas fa-times"></i></button><div class="rb-field"><label>Hobby / Interest</label><input type="text" id="hobbyName' + hobbyCount + '" placeholder="Reading, Cricket, Photography" oninput="updatePreview()"></div>';
    c.appendChild(d);
    updatePreview();
}

function addAchieve() {
    achieveCount++;
    const c = document.getElementById('achieveContainer');
    const d = document.createElement('div');
    d.className = 'rb-entry-block';
    d.id = 'achieveBlock' + achieveCount;
    d.innerHTML = '<button class="rb-remove-btn" onclick="this.parentElement.remove();updatePreview()"><i class="fas fa-times"></i></button><div class="rb-field"><label>Achievement</label><textarea id="achieveName' + achieveCount + '" placeholder="First prize in district level coding competition..." oninput="updatePreview()"></textarea></div>';
    c.appendChild(d);
    updatePreview();
}

function zoomIn() { zoomLevel = Math.min(zoomLevel + 10, 200); applyZoom(); }
function zoomOut() { zoomLevel = Math.max(zoomLevel - 10, 50); applyZoom(); }
function zoomReset() { zoomLevel = 100; applyZoom(); }
function applyZoom() {
    const el = document.getElementById('resumePreview');
    el.style.transform = 'scale(' + zoomLevel / 100 + ')';
    el.style.transformOrigin = 'top center';
    document.getElementById('zoomLabel').textContent = zoomLevel + '%';
}

function downloadPDF() {
    const el = document.getElementById('resumePreview');
    const name = (document.getElementById('rName').value || 'resume').replace(/\s+/g, '_');
    const originalTransform = el.style.transform;
    const originalOverflow = el.style.overflow;
    const originalWidth = el.style.width;
    el.style.transform = 'scale(1)';
    el.style.overflow = 'visible';

    const PX_PER_MM = 3.7795;
    const a4WidthMm = 210, a4HeightMm = 297, marginMm = 5;
    const usableWidthMm = a4WidthMm - 2 * marginMm;
    const usableHeightMm = a4HeightMm - 2 * marginMm;
    const usableWidthPx = usableWidthMm * PX_PER_MM;

    // Set element to A4 usable width
    el.style.width = usableWidthPx + 'px';

    // Levels from biggest to smallest
    const allLevels = ['expand-2', 'expand-1', '', 'compact-1', 'compact-2', 'compact-3'];

    // Find the biggest level that fits, or smallest if none fit
    let bestLevel = '';
    let bestHeightPx = 0;

    for (const lvl of allLevels) {
        // Remove all level classes first
        allLevels.forEach(c => { if (c) el.classList.remove(c); });
        // Apply current level
        if (lvl) el.classList.add(lvl);

        const hPx = el.offsetHeight;
        const hMm = hPx / PX_PER_MM;

        if (hMm <= usableHeightMm) {
            // Fits! Pick the one with most content (biggest that fits)
            if (hPx > bestHeightPx) {
                bestHeightPx = hPx;
                bestLevel = lvl;
            }
        }
    }

    // If nothing fit, use compact-3 (smallest)
    if (!bestLevel && bestHeightPx === 0) {
        bestLevel = 'compact-3';
    }

    // Apply best level
    allLevels.forEach(c => { if (c) el.classList.remove(c); });
    if (bestLevel) el.classList.add(bestLevel);

    html2canvas(el, {
        scale: 2,
        useCORS: true,
        scrollY: 0,
        backgroundColor: '#ffffff'
    }).then(function(canvas) {
        const contentWidthMm = (canvas.width / 2) / PX_PER_MM;
        const contentHeightMm = (canvas.height / 2) / PX_PER_MM;

        // Scale to FILL the A4 page (scale up or down)
        let scale = Math.min(usableWidthMm / contentWidthMm, usableHeightMm / contentHeightMm);
        // Limit scale-up to 1.5x for readability
        scale = Math.min(scale, 1.5);

        const finalWidth = contentWidthMm * scale;
        const finalHeight = contentHeightMm * scale;
        const offsetX = (a4WidthMm - finalWidth) / 2;
        const offsetY = (a4HeightMm - finalHeight) / 2;

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData, 'JPEG', offsetX, offsetY, finalWidth, finalHeight);
        pdf.save(name + '_Resume.pdf');

        // Cleanup
        allLevels.forEach(c => { if (c) el.classList.remove(c); });
        el.style.transform = originalTransform;
        el.style.overflow = originalOverflow;
        el.style.width = originalWidth;
    });
}

function printResume() {
    const el = document.getElementById('resumePreview');
    const printContainer = document.getElementById('printContainer');
    const PX_PER_MM = 3.7795;
    const a4WidthMm = 210, a4HeightMm = 297, marginMm = 5; // Same as PDF
    const a4WidthPx = a4WidthMm * PX_PER_MM;
    const a4HeightPx = a4HeightMm * PX_PER_MM;
    const marginPx = marginMm * PX_PER_MM;
    const usableWidthPx = (a4WidthMm - 2 * marginMm) * PX_PER_MM;
    const usableHeightPx = (a4HeightMm - 2 * marginMm) * PX_PER_MM;

    // printContainer = full A4 page
    printContainer.innerHTML = '';
    printContainer.style.cssText = 'display:block;width:' + a4WidthPx + 'px;height:' + a4HeightPx + 'px;margin:0;padding:0;background:#fff;overflow:hidden;box-sizing:border-box;';

    // Wrapper: same margin as PDF (5mm all sides)
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;height:100%;padding:' + marginPx + 'px;box-sizing:border-box;overflow:hidden;';

    // Inner: usable area for the scaled content, centered
    const inner = document.createElement('div');
    inner.style.cssText = 'width:' + usableWidthPx + 'px;height:' + usableHeightPx + 'px;overflow:hidden;position:relative;margin:0 auto;';

    // Clone resume — same as PDF: set width to usable width
    const clone = el.cloneNode(true);
    clone.style.transform = 'none';
    clone.style.width = usableWidthPx + 'px';
    clone.style.margin = '0';
    clone.style.padding = '';
    inner.appendChild(clone);
    wrapper.appendChild(inner);
    printContainer.appendChild(wrapper);

    // Show off-screen to measure
    printContainer.style.position = 'fixed';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '0';

    // Same level selection as PDF
    const allLevels = ['expand-2', 'expand-1', '', 'compact-1', 'compact-2', 'compact-3'];
    const usableHeightMm = a4HeightMm - 2 * marginMm;

    let bestLevel = '';
    let bestHeightPx = 0;

    for (const lvl of allLevels) {
        allLevels.forEach(c => { if (c) clone.classList.remove(c); });
        if (lvl) clone.classList.add(lvl);
        const hPx = clone.offsetHeight;
        const hMm = hPx / PX_PER_MM;
        if (hMm <= usableHeightMm && hPx > bestHeightPx) {
            bestHeightPx = hPx;
            bestLevel = lvl;
        }
    }

    if (!bestLevel && bestHeightPx === 0) {
        bestLevel = 'compact-3';
    }

    // Apply best level
    allLevels.forEach(c => { if (c) clone.classList.remove(c); });
    if (bestLevel) clone.classList.add(bestLevel);

    // Same scaling as PDF: scale to fill, limit 1.5x, center on page
    const finalHeightPx = clone.offsetHeight;
    const finalWidthPx = clone.offsetWidth;
    const finalHeightMm = finalHeightPx / PX_PER_MM;
    const finalWidthMm = finalWidthPx / PX_PER_MM;

    let scale = Math.min(usableWidthPx / finalWidthPx, usableHeightPx / finalHeightPx);
    scale = Math.min(scale, 1.5);
    scale = Math.max(scale, 0.3);

    // Calculate centered position (same as PDF offsetX/offsetY)
    const scaledWidthPx = finalWidthPx * scale;
    const scaledHeightPx = finalHeightPx * scale;
    const offsetXPx = (usableWidthPx - scaledWidthPx) / 2;
    const offsetYPx = (usableHeightPx - scaledHeightPx) / 2;

    clone.style.transform = 'scale(' + scale + ')';
    clone.style.transformOrigin = 'top left';
    clone.style.position = 'absolute';
    clone.style.top = offsetYPx + 'px';
    clone.style.left = offsetXPx + 'px';

    // Reset position for print
    printContainer.style.position = '';
    printContainer.style.left = '';
    printContainer.style.top = '';

    document.body.classList.add('printing');

    const cleanup = function() {
        document.body.classList.remove('printing');
        printContainer.innerHTML = '';
        printContainer.style.cssText = 'display:none';
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();

    setTimeout(cleanup, 1000);
}

function collectData() {
    return {
        template: currentTemplate, color: currentColor, sidebarColor: currentSidebarColor, textColor: currentTextColor, borderColor: currentBorderColor, accentColor: currentAccentColor, font: currentFont, photo: photoData,
        name: val('rName'), jobTitle: val('rJobTitle'), email: val('rEmail'), phone: val('rPhone'),
        location: val('rLocation'), linkedin: val('rLinkedin'), github: val('rGithub'), website: val('rWebsite'),
        summary: val('rSummary'), techSkills: val('rTechSkills'), softSkills: val('rSoftSkills'),
        declaration: val('rDeclaration'), declPlace: val('rDeclPlace'), declDate: val('rDeclDate'),
        experience: collectEntries('exp', expCount, ['Role','Company','Dates','Desc']),
        education: collectEntries('edu', eduCount, ['Degree','Inst','Year','Pct']),
        certifications: collectEntries('cert', certCount, ['Name','Org','Year']),
        projects: collectEntries('proj', projCount, ['Name','Desc','Link']),
        languages: collectEntries('lang', langCount, ['Name','Level']),
        hobbies: collectEntries('hobby', hobbyCount, ['Name']),
        achievements: collectEntries('achieve', achieveCount, ['Name']),
        sections: sections, sectionOrder: sectionOrder
    };
}

function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function collectEntries(prefix, count, fields) {
    const arr = [];
    for (let i = 1; i <= count; i++) {
        const entry = {};
        let hasData = false;
        fields.forEach(f => {
            const el = document.getElementById(prefix + f + i);
            if (el && el.value) { entry[f.toLowerCase()] = el.value; hasData = true; }
            else entry[f.toLowerCase()] = '';
        });
        if (hasData) arr.push(entry);
    }
    return arr;
}

function exportData() {
    const data = collectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'resume_data.json'; a.click();
    URL.revokeObjectURL(url);
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const d = JSON.parse(ev.target.result);
            restoreData(d);
        } catch(err) { alert('Invalid resume data file'); }
    };
    reader.readAsText(file);
}

function restoreData(d) {
    currentTemplate = d.template || 'modern';
    currentColor = d.color || '#667eea';
    currentSidebarColor = d.sidebarColor || '#1a1a2e';
    currentTextColor = d.textColor || '#333333';
    currentBorderColor = d.borderColor || '#667eea';
    currentAccentColor = d.accentColor || '#667eea';
    currentFont = d.font || 'sans';
    photoData = d.photo || null;
    sections = d.sections || sections;
    if (d.sectionOrder && d.sectionOrder.length) sectionOrder = d.sectionOrder;
    setVal('rName', d.name); setVal('rJobTitle', d.jobTitle); setVal('rEmail', d.email);
    setVal('rPhone', d.phone); setVal('rLocation', d.location); setVal('rLinkedin', d.linkedin);
    setVal('rGithub', d.github); setVal('rWebsite', d.website); setVal('rSummary', d.summary);
    if (d.techSkills) setVal('rTechSkills', d.techSkills);
    if (d.softSkills) setVal('rSoftSkills', d.softSkills);
    if (!d.techSkills && d.skills) setVal('rTechSkills', d.skills);
    setVal('rDeclaration', d.declaration); setVal('rDeclPlace', d.declPlace); setVal('rDeclDate', d.declDate);
    restoreEntries('exp', d.experience, ['Role','Company','Dates','Desc'], addExperience, 'exp');
    restoreEntries('edu', d.education, ['Degree','Inst','Year','Pct'], addEducation, 'edu');
    restoreEntries('cert', d.certifications, ['Name','Org','Year'], addCert, 'cert');
    restoreEntries('proj', d.projects, ['Name','Desc','Link'], addProject, 'proj');
    restoreEntries('lang', d.languages, ['Name','Level'], addLang, 'lang');
    restoreEntries('hobby', d.hobbies, ['Name'], addHobby, 'hobby');
    restoreEntries('achieve', d.achievements, ['Name'], addAchieve, 'achieve');
    if (photoData) {
        document.getElementById('photoPreview').innerHTML = '<img src="' + photoData + '">';
        document.getElementById('removePhotoBtn').style.display = 'block';
    }
    document.querySelectorAll('.rb-template-btn').forEach(b => b.classList.remove('active'));
    const tBtn = document.querySelector('.rb-template-btn[data-template="' + currentTemplate + '"]');
    if (tBtn) tBtn.classList.add('active');
    document.querySelectorAll('.rb-font-btn').forEach(b => b.classList.remove('active'));
    const fBtn = document.querySelector('.rb-font-btn[onclick*="' + currentFont + '"]');
    if (fBtn) fBtn.classList.add('active');
    renderSectionOrder();
    updatePreview();
}

function setVal(id, v) { const el = document.getElementById(id); if (el && v) el.value = v; }
function restoreEntries(prefix, arr, fields, addFn, idPrefix) {
    if (!arr || !arr.length) return;
    const container = document.getElementById(idPrefix + 'Container');
    if (container) container.innerHTML = '';
    arr.forEach(entry => {
        addFn();
        const i = idPrefix === 'exp' ? expCount : idPrefix === 'edu' ? eduCount : idPrefix === 'cert' ? certCount : idPrefix === 'proj' ? projCount : idPrefix === 'lang' ? langCount : idPrefix === 'hobby' ? hobbyCount : achieveCount;
        fields.forEach(f => {
            const el = document.getElementById(prefix + f + i);
            if (el && entry[f.toLowerCase()]) el.value = entry[f.toLowerCase()];
        });
    });
}

function autoSave() {
    try { localStorage.setItem('rb_autosave', JSON.stringify(collectData())); } catch(e) {}
}

function loadAutoSave() {
    try {
        const saved = localStorage.getItem('rb_autosave');
        if (saved) { const d = JSON.parse(saved); if (d && d.name && d.name.length > 0) restoreData(d); }
    } catch(e) {}
}

function loadSampleData() {
    const data = {
        template: 'modern', color: '#667eea', sidebarColor: '#1a1a2e', textColor: '#333333', borderColor: '#667eea', accentColor: '#667eea', font: 'sans',
        name: 'Rahul Sharma', jobTitle: 'Computer Operator & Data Entry Specialist',
        email: 'rahul.sharma@example.com', phone: '+91 9876543210', location: 'Vashim, Maharashtra',
        linkedin: 'linkedin.com/in/rahulsharma', github: '', website: '',
        summary: 'Detail-oriented Computer Operator with 2+ years experience in data entry, MS Office, and Tally. Completed DCA from Genius Computer Education. Seeking a challenging role to utilize my computer skills.',
        techSkills: 'MS Office, Tally Prime, Data Entry, Photoshop, HTML, CSS, Internet, Typing (40 WPM)',
        softSkills: 'Communication, Teamwork, Time Management, Problem Solving, Quick Learner',
        experience: [{ role: 'Data Entry Operator', company: 'Sharma Enterprises, Vashim', dates: 'Jun 2023 - Present', desc: '- Managing daily data entry operations using MS Excel and Tally\n- Maintaining digital records of 500+ transactions daily\n- Preparing reports and presentations using MS Office' }],
        education: [{ degree: 'DCA (Diploma in Computer Applications)', inst: 'Genius Computer Education, Vashim', year: '2023', pct: '85' }],
        certifications: [{ name: 'Tally Prime with GST', org: 'Genius Computer Education', year: '2023' }],
        projects: [], languages: [{ name: 'Hindi', level: 'Native' }, { name: 'English', level: 'Fluent' }, { name: 'Marathi', level: 'Fluent' }],
        hobbies: [{ name: 'Reading' }, { name: 'Cricket' }, { name: 'Photography' }],
        achievements: [{ name: 'First prize in district level typing competition' }],
        declaration: 'I hereby declare that the information provided above is true and correct to the best of my knowledge and belief. I take full responsibility for the correctness of the above-mentioned particulars.',
        declPlace: 'Vashim', declDate: '31 Jul 2026',
        sections: sections
    };
    restoreData(data);
}

function clearAll() {
    ['rName','rJobTitle','rEmail','rPhone','rLocation','rLinkedin','rGithub','rWebsite','rSummary','rTechSkills','rSoftSkills','rDeclaration','rDeclPlace','rDeclDate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    expCount = 0; eduCount = 0; certCount = 0; projCount = 0; langCount = 0; hobbyCount = 0; achieveCount = 0;
    ['experienceContainer','educationContainer','certContainer','projectContainer','langContainer','hobbyContainer','achieveContainer'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    removePhoto();
    localStorage.removeItem('rb_autosave');
    updatePreview();
}

init();
loadAutoSave();
