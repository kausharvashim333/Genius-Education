let currentPage = 'dashboard';
let galleryImageFile = null;
let carouselImageFile = null;

// Global formatDate function for DD-MMM-YYYY format (with month name)
function formatDate(date) {
    if (!date) return '';
    try {
        let d = new Date(date);
        // If date is in DD/MM/YYYY format, parse it correctly
        if (typeof date === 'string' && date.includes('/')) {
            const parts = date.split('/');
            if (parts.length === 3) {
                // Check if it's DD/MM/YYYY format
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
                const year = parseInt(parts[2]);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    d = new Date(year, month, day);
                }
            }
        }
        if (isNaN(d)) return date;
        const day = String(d.getDate()).padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[d.getMonth()];
        const year = String(d.getFullYear());
        return `${day}-${month}-${year}`;
    } catch { return date; }
}

// Global formatDateTime function for DD-MMM-YYYY HH:MM format
function formatDateTime(date) {
    if (!date) return '';
    try {
        let d = new Date(date);
        // If date is in DD/MM/YYYY format, parse it correctly
        if (typeof date === 'string' && date.includes('/')) {
            const parts = date.split('/');
            if (parts.length === 3) {
                // Check if it's DD/MM/YYYY format
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
                const year = parseInt(parts[2]);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    d = new Date(year, month, day);
                }
            }
        }
        if (isNaN(d)) return date;
        const day = String(d.getDate()).padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[d.getMonth()];
        const year = String(d.getFullYear());
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}-${month}-${year} ${hours}:${minutes}`;
    } catch { return date; }
}

function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- Admit Cards ---
async function loadAdmitCards() {
    try {
        const [admitRes, studentsRes] = await Promise.all([
            fetch('/api/admit-cards'),
            fetch('/api/students')
        ]);
        const data = await admitRes.json();
        const studentsData = await studentsRes.json();
        const students = Array.isArray(studentsData) ? studentsData : (studentsData.students || []);
        const studentsMap = {};
        students.forEach(s => { studentsMap[s.id] = s; });
        const grid = document.getElementById('admitCardsGrid');
        const noAdmitCards = document.getElementById('noAdmitCards');
        
        if (data.success && data.admitCards && data.admitCards.length > 0) {
            const formatTime = (t) => {
                if (!t) return 'N/A';
                const [h, m] = t.split(':');
                if (!h) return t;
                const hr = parseInt(h);
                const ampm = hr >= 12 ? 'PM' : 'AM';
                const h12 = hr % 12 || 12;
                return `${h12}:${m || '00'} ${ampm}`;
            };
            
            grid.innerHTML = data.admitCards.map(ac => {
                const student = studentsMap[ac.studentId];
                const studentIdDisplay = student && student.rollNo ? student.rollNo : (ac.rollNo || 'N/A');
                return `<div class="admit-card-preview">
                    <div class="admit-card-header">
                        <img src="${ac.instituteLogo || '/uploads/logo/logo.png'}" alt="Logo" class="admit-card-logo">
                        <div class="admit-card-title">
                            <h3>${ac.instituteName || 'Genius Computer Education'}</h3>
                            <p>Admit Card</p>
                        </div>
                    </div>
                    <div class="admit-card-body">
                        <div class="admit-card-photo-section">
                            <img src="${ac.studentPhoto || '/uploads/students/default.png'}" alt="Student" class="admit-card-photo">
                            <div class="admit-card-student-info">
                                <h4>${ac.studentName}</h4>
                                <div style="font-size:11px;color:#64748b;margin-top:4px;">Roll No: ${ac.rollNo || 'N/A'}</div>
                                <div style="display:inline-block;background:#1e3a8a;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-top:6px;">
                                    <i class="fas fa-id-badge" style="margin-right:4px;"></i> Student ID: ${studentIdDisplay}
                                </div>
                            </div>
                        </div>
                        <div class="admit-card-exam-info">
                            <div class="admit-card-row">
                                <span>Exam:</span>
                                <strong>${ac.examName}</strong>
                            </div>
                            <div class="admit-card-row">
                                <span>Date:</span>
                                <strong>${formatDate(ac.examDate)}</strong>
                            </div>
                            <div class="admit-card-row">
                                <span>Time:</span>
                                <strong>${formatTime(ac.examTime)}</strong>
                            </div>
                            <div class="admit-card-row">
                                <span>Duration:</span>
                                <strong>${ac.duration} mins</strong>
                            </div>
                            <div class="admit-card-row">
                                <span>Venue:</span>
                                <strong>${ac.venue}</strong>
                            </div>
                            <div class="admit-card-row">
                                <span>Total Marks:</span>
                                <strong>${ac.totalMarks}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="admit-card-footer">
                        <button class="btn btn-primary" onclick="printAdmitCard(${ac.id})"><i class="fas fa-print"></i> Print</button>
                        <button class="btn btn-danger" onclick="deleteAdmitCard(${ac.id})"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            `;
        }).join('');
            noAdmitCards.style.display = 'none';
        } else {
            grid.innerHTML = '';
            noAdmitCards.style.display = 'block';
        }
    } catch (e) {
        console.error('Error loading admit cards:', e);
    }
}

async function deleteAdmitCard(id) {
    if (!confirm('Are you sure you want to delete this admit card?')) return;
    try {
        const res = await fetch('/api/admit-cards/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showNotification('Admit card deleted!', 'success');
            loadAdmitCards();
        } else {
            showNotification('Error deleting admit card', 'error');
        }
    } catch (e) {
        console.error('Error deleting admit card:', e);
        showNotification('Error deleting admit card', 'error');
    }
}

function printAdmitCard(id) {
    const admitCards = document.querySelectorAll('.admit-card-preview');
    admitCards.forEach(card => {
        const printBtn = card.querySelector('.admit-card-footer');
        if (printBtn) printBtn.style.display = 'none';
    });
    
    const cardElement = document.querySelector(`button[onclick="printAdmitCard(${id})"]`).closest('.admit-card-preview');
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Admit Card</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; padding: 20px; }
                .admit-card { max-width: 800px; margin: 0 auto; border: 2px solid #333; }
                .admit-card-header { display: flex; align-items: center; padding: 20px; border-bottom: 2px solid #333; }
                .admit-card-logo { width: 80px; height: 80px; object-fit: contain; margin-right: 20px; }
                .admit-card-title h3 { font-size: 24px; margin-bottom: 5px; }
                .admit-card-title p { font-size: 18px; color: #666; }
                .admit-card-body { padding: 20px; display: flex; gap: 20px; }
                .admit-card-photo-section { text-align: center; }
                .admit-card-photo { width: 120px; height: 150px; object-fit: cover; border: 2px solid #333; }
                .admit-card-student-info { margin-top: 10px; }
                .admit-card-student-info h4 { font-size: 18px; margin-bottom: 5px; }
                .admit-card-student-info p { font-size: 14px; }
                .admit-card-exam-info { flex: 1; }
                .admit-card-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                .admit-card-row span { font-size: 14px; color: #666; }
                .admit-card-row strong { font-size: 16px; }
                .admit-card-footer { padding: 15px 20px; border-top: 2px solid #333; text-align: center; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04;"><img src="/uploads/logo/logo.png" style="max-width: 300px; max-height: 300px;" onerror="this.parentElement.style.display='none'"></div>
            ${cardElement.innerHTML.replace(/<div class="admit-card-footer">.*?<\/div>/s, '')}
            <div class="admit-card-footer">
                <p>This is a computer-generated admit card. Signature not required.</p>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
    
    admitCards.forEach(card => {
        const printBtn = card.querySelector('.admit-card-footer');
        if (printBtn) printBtn.style.display = 'flex';
    });
}

// Request Admin Credentials
async function requestAdminCredentials() {
    const btn = document.getElementById('requestCredentialsBtn');
    const statusEl = document.getElementById('credentialsStatus');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    statusEl.textContent = 'Sending credentials to your email...';
    
    try {
        const res = await fetch('/api/admin/generate-credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        
        if (data.success) {
            btn.style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
            statusEl.textContent = 'Credentials sent! Check your email and enter them below.';
            statusEl.style.color = '#16a34a';
        } else {
            statusEl.textContent = data.message || 'Failed to send credentials';
            statusEl.style.color = '#dc2626';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-envelope"></i> Request Login Credentials';
        }
    } catch (err) {
        console.error('Error requesting credentials:', err);
        statusEl.textContent = 'Network error. Please try again.';
        statusEl.style.color = '#dc2626';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-envelope"></i> Request Login Credentials';
    }
}

// Session check on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Load institute logo and name for login navbar
    try {
        const settings = await fetch('/api/settings').then(r => r.json());
        if (settings.logo) {
            const logoImg = document.getElementById('loginLogoImg');
            const logoIcon = document.getElementById('loginLogoIcon');
            const loginBoxLogo = document.getElementById('loginBoxLogo');
            if (logoImg && logoIcon) {
                logoImg.src = settings.logo;
                logoImg.style.display = 'inline-block';
                logoIcon.style.display = 'none';
            }
            if (loginBoxLogo) {
                loginBoxLogo.src = settings.logo;
                loginBoxLogo.style.display = 'block';
            }
        }
        if (settings.name) {
            const nameEl = document.getElementById('loginInstituteName');
            if (nameEl) nameEl.textContent = settings.name;
        }
    } catch (err) { console.error(err); }

    // Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log('Login form found, attaching event listener');
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Login form submitted');
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            console.log('Attempting login with username:', username);
            try {
                const res = await fetch('/api/admin/verify-credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                console.log('Login response:', data);
                if (data.success) {
                    localStorage.setItem('adminSession', 'active');
                    showDashboard();
                } else {
                    showNotification(data.message || 'Invalid credentials!', 'error');
                }
            } catch (err) { 
                console.error('Login error:', err);
                showNotification('Login failed!', 'error'); 
            }
        });
    } else {
        console.error('Login form not found!');
    }

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('adminSession');
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('dashboardSection').classList.add('hidden');
    });

    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                }
            }
        });
    }

    // Navigation
    document.querySelectorAll('.sidebar-menu a[data-page]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            
            // Update active state
            document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Show page
            document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
            document.getElementById('page-' + page).classList.remove('hidden');
            document.getElementById('pageTitle').textContent = page.charAt(0).toUpperCase() + page.slice(1);
            
            // Save current page to localStorage
            localStorage.setItem('currentAdminPage', page);
            
            // Load page data
            if (page === 'dashboard') loadDashboard();
            if (page === 'courses') loadCoursesTable();
            if (page === 'enquiries') loadEnquiriesTable();
            if (page === 'faculty') loadFacultyTable();
            if (page === 'gallery') loadGalleryTable();
            if (page === 'payments') loadPaymentsTable();
            if (page === 'certificates') loadCertificatesTable();
            if (page === 'exam-results') loadExamResultsTable();
            if (page === 'faculty') loadFacultyTable();
            if (page === 'notices') loadNoticesTable();
            if (page === 'students') loadStudentsTable();
            if (page === 'gallery') loadGalleryTable();
            if (page === 'carousel') loadCarouselAdmin();
            if (page === 'about') loadAbout();
            if (page === 'settings') loadSettings();
            if (page === 'batches') loadBatchesTable();
            if (page === 'study-materials') loadStudyMaterialsTable();
            if (page === 'attendance') loadAttendancePage();
            if (page === 'exam-calendar') loadExamCalendarTable();
            if (page === 'holidays') loadHolidaysTable();
            if (page === 'blog') loadBlogTable();
            if (page === 'announcements') loadAnnouncementsTable();
            if (page === 'tests') loadTestsTable();
            if (page === 'fees') loadFeesTable();
            if (page === 'payments') loadPaymentsTable();
            if (page === 'notifications') loadNotificationsTable();
            if (page === 'exam-management') loadExamManagementTable();
            if (page === 'question-bank') loadQuestionBankTable();
            if (page === 'exam-schedule') loadExamScheduleTable();
            if (page === 'exam-registration') loadExamRegistrationTable();
            if (page === 'admit-cards') loadAdmitCards();
            if (page === 'online-exam') loadOnlineExamTable();
            if (page === 'exam-grading') loadExamGradingTable();
            if (page === 'exam-reports') loadExamReportsTable();
            if (page === 'online-exam-results') loadOnlineExamResults();
            if (page === 'manual-grading') loadPendingGrading();
            if (page === 'exam-analytics') loadAnalyticsPage();
            if (page === 're-evaluation') loadReEvaluationTable();
            if (page === 'videos') { loadVideosTable(); loadChaptersTable(); }
            if (page === 'video-comments') loadAdminVideoComments();
            if (page === 'video-analytics') loadVideoAnalytics();
            if (page === 'assignments') loadAssignmentsTable();
            if (page === 'alumni') loadAlumniTable();
            if (page === 'helpdesk') loadTicketsTable();
            if (page === 'backup') loadBackupsList();
            if (page === 'roles') loadRolesTable();
        });
    });

    // Dropdown toggle functionality
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            const dropdown = this.closest('.dropdown');
            dropdown.classList.toggle('open');
        });
    });

    // Load data for current page on initial load
    const currentPage = localStorage.getItem('currentAdminPage');
    if (currentPage === 'online-exam-results') {
        loadOnlineExamResults();
    }

    // Gallery file preview
    document.getElementById('galleryFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        galleryImageFile = file;

        if (!file.type.startsWith('image/')) {
            showNotification('Please select a valid image file!', 'error');
            galleryImageFile = null;
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showNotification('Image too large! Max 10MB allowed.', 'error');
            galleryImageFile = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('galleryPreviewImg').src = event.target.result;
            document.getElementById('galleryPreviewImg').style.display = 'block';
            document.getElementById('galleryPlaceholder').style.display = 'none';
            showNotification('Image loaded!', 'success');
        };
        reader.readAsDataURL(file);
    });

    // Carousel file preview
    document.getElementById('carouselFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showNotification('Valid image select karo!', 'error'); return; }
        carouselImageFile = file;
        const reader = new FileReader();
        reader.onload = function(ev) {
            document.getElementById('carouselPreviewImg').src = ev.target.result;
            document.getElementById('carouselPreviewImg').style.display = 'block';
            document.getElementById('carouselPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(file);
    });

    // Logo file upload
    document.getElementById('logoFile').addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('logo', file);
        try {
            const res = await fetch('/api/logo', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                loadLogoPreview();
                loadAdminLogo();
                showNotification('Logo uploaded!', 'success');
            } else {
                showNotification(data.message || 'Logo upload failed!', 'error');
            }
        } catch (err) { showNotification('Logo upload failed!', 'error'); }
    });

    // Signature file upload
    document.getElementById('signatureFile').addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('signature', file);
        try {
            const res = await fetch('/api/signature', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                loadSignaturePreview();
                showNotification('Signature uploaded!', 'success');
            } else {
                showNotification(data.message || 'Signature upload failed!', 'error');
            }
        } catch (err) { showNotification('Signature upload failed!', 'error'); }
    });

    // Check if already logged in
    if (localStorage.getItem('adminSession') === 'active') {
        showDashboard();
    }

    // Add event listeners for admin admission form validation
    const phoneInput = document.getElementById('sPhone');
    const emailInput = document.getElementById('sEmail');
    const aadharInput = document.getElementById('sAadhar');

    if (phoneInput) {
        phoneInput.addEventListener('blur', checkAdminDuplicateMobile);
    }
    if (emailInput) {
        emailInput.addEventListener('blur', checkAdminDuplicateEmail);
    }
    if (aadharInput) {
        aadharInput.addEventListener('blur', checkAdminDuplicateAadhar);
    }

    const admissionForm = document.getElementById('admissionForm');
    if (admissionForm) {
        admissionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Check for duplicates before submission
            const isDuplicateMobile = await checkAdminDuplicateMobile();
            const isDuplicateEmail = await checkAdminDuplicateEmail();
            const isDuplicateAadhar = await checkAdminDuplicateAadhar();
            
            if (isDuplicateMobile || isDuplicateEmail || isDuplicateAadhar) {
                showNotification('Please use a different mobile number, email, or Aadhar that is not already registered.', 'error');
                return;
            }
            
            const btn = this.querySelector('[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Processing...';
            try {
                // Validation
                const phone = document.getElementById('sPhone').value;
                if (phone.length !== 10 || !/^[6-9]/.test(phone)) { showNotification('Valid 10-digit mobile number chahiye (6-9 se shuru ho)!', 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-graduate"></i> Complete Admission & Generate Slip'; return; }
                const aadhar = document.getElementById('sAadhar').value;
                if (aadhar && aadhar.length !== 12) { showNotification('Aadhar number 12 digits ka hona chahiye!', 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-graduate"></i> Complete Admission & Generate Slip'; return; }
                const pincode = document.getElementById('sPincode').value;
                if (pincode && pincode.length !== 6) { showNotification('PIN code 6 digits ka hona chahiye!', 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-graduate"></i> Complete Admission & Generate Slip'; return; }
                if (!document.getElementById('decl1').checked || !document.getElementById('decl2').checked || !document.getElementById('decl3').checked) {
                    showNotification('Declaration ke sabhi boxes check karna zaroori hai!', 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-graduate"></i> Complete Admission & Generate Slip'; return;
                }
                const formData = new FormData();
                formData.append('name', document.getElementById('sName').value);
                formData.append('dob', document.getElementById('sDob').value);
                formData.append('gender', document.getElementById('sGender').value);
                formData.append('category', document.getElementById('sCategory').value);
                formData.append('bloodGroup', document.getElementById('sBloodGroup').value);
                formData.append('fatherName', document.getElementById('sFatherName').value);
                formData.append('motherName', document.getElementById('sMotherName').value);
                formData.append('phone', document.getElementById('sPhone').value);
                formData.append('email', document.getElementById('sEmail').value);
                formData.append('aadhar', document.getElementById('sAadhar').value);
                formData.append('address', document.getElementById('sAddress').value);
                formData.append('city', document.getElementById('sCity').value);
                formData.append('state', document.getElementById('sState').value);
                formData.append('pincode', document.getElementById('sPincode').value);
                formData.append('course', document.getElementById('sCourse').value);
                formData.append('batch', document.getElementById('sBatch').value);
                formData.append('fees', document.getElementById('sFees').value);
                formData.append('photo', studentPhotoFile);
                formData.append('sign', studentSignFile);

                const res = await fetch('/api/students', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success) {
                    closeModal('admissionModal');
                    studentPhotoFile = null;
                    studentSignFile = null;
                    loadStudentsTable();
                    loadDashboard();
                    showNotification('Admission successful!', 'success');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-user-graduate"></i> Complete Admission & Generate Slip';
                } else {
                    showNotification(data.message || 'Admission failed!', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-user-graduate"></i> Complete Admission & Generate Slip';
                }
            } catch (err) { showNotification('Error submitting form!', 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-graduate"></i> Complete Admission & Generate Slip'; }
        });
    }
});

function showDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    loadDashboard();
    loadAdminLogo();
    
    // Restore saved page from localStorage
    const savedPage = localStorage.getItem('currentAdminPage');
    if (savedPage && savedPage !== 'dashboard') {
        const pageLink = document.querySelector(`.sidebar-menu a[data-page="${savedPage}"]`);
        if (pageLink) pageLink.click();
    }
}

// ===== Dashboard =====
async function loadDashboard() {
    try {
        const [coursesData, students, enquiries, faculty, gallery, paymentsData, batches, onlineExams, certsData, materialsData, admitCardsData] = await Promise.all([
            fetch('/api/courses').then(r => r.json()).catch(() => []),
            fetch('/api/students').then(r => r.json()).catch(() => []),
            fetch('/api/enquiries').then(r => r.json()).catch(() => []),
            fetch('/api/faculty').then(r => r.json()).catch(() => []),
            fetch('/api/gallery').then(r => r.json()).catch(() => []),
            fetch('/api/payments').then(r => r.json()).catch(() => ({ payments: [] })),
            fetch('/api/batches').then(r => r.json()).catch(() => []),
            fetch('/api/online-exams').then(r => r.json()).catch(() => []),
            fetch('/api/certificates').then(r => r.json()).catch(() => ({ certificates: [] })),
            fetch('/api/study-materials').then(r => r.json()).catch(() => ({ materials: [] })),
            fetch('/api/admit-cards').then(r => r.json()).catch(() => ({ admitCards: [] }))
        ]);

        // Normalize API responses (some return {success, data} objects, some return arrays)
        const courses = Array.isArray(coursesData) ? coursesData : (coursesData.courses || coursesData.data || []);
        const payments = Array.isArray(paymentsData) ? paymentsData : (paymentsData.payments || paymentsData.data || []);
        const certificates = Array.isArray(certsData) ? certsData : (certsData.certificates || certsData.data || []);
        const materials = Array.isArray(materialsData) ? materialsData : (materialsData.materials || materialsData.data || []);
        const admitCards = Array.isArray(admitCardsData) ? admitCardsData : (admitCardsData.admitCards || admitCardsData.data || []);

        // Row 1
        document.getElementById('totalStudents').textContent = students.length;
        document.getElementById('totalCourses').textContent = courses.length;
        document.getElementById('totalFaculty').textContent = faculty.length;
        document.getElementById('totalEnquiries').textContent = enquiries.length;

        // Row 2
        const pendingEnq = enquiries.filter(e => !e.replied).length;
        document.getElementById('totalPendingEnquiries').textContent = pendingEnq;

        // Sidebar badge
        const badge = document.getElementById('sidebarEnqBadge');
        if (badge) {
            if (pendingEnq > 0) {
                badge.textContent = pendingEnq;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        const totalRevenue = payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        document.getElementById('totalRevenue').textContent = '₹' + totalRevenue.toLocaleString('en-IN');

        const totalDues = students.reduce((sum, s) => sum + (s.fees && s.fees.dueAmount ? parseFloat(s.fees.dueAmount) : 0), 0);
        document.getElementById('totalDues').textContent = '₹' + totalDues.toLocaleString('en-IN');

        document.getElementById('totalBatches').textContent = batches.length;

        // Row 3
        document.getElementById('totalOnlineExams').textContent = onlineExams.length;
        document.getElementById('totalCertificates').textContent = certificates.length;
        document.getElementById('totalMaterials').textContent = materials.length;
        document.getElementById('totalGallery').textContent = gallery.length;

        // Recent Admissions (last 5)
        const recentStudents = [...students].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5);
        const admTbody = document.querySelector('#recentAdmissionsTable tbody');
        if (recentStudents.length > 0) {
            admTbody.innerHTML = recentStudents.map(s => `<tr>
                <td style="font-weight:600;">${s.name || '-'}</td>
                <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.course || '-'}</td>
                <td>${s.admissionDate ? formatDate(s.admissionDate) : '-'}</td>
            </tr>`).join('');
        } else {
            admTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:20px;">No admissions yet</td></tr>';
        }

        // Recent Payments (last 5)
        const recentPay = [...payments].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5);
        const payTbody = document.querySelector('#recentPaymentsTable tbody');
        if (recentPay.length > 0) {
            payTbody.innerHTML = recentPay.map(p => {
                const badgeClass = p.status === 'approved' ? 'pay-badge-approved' : p.status === 'denied' ? 'pay-badge-denied' : 'pay-badge-pending';
                return `<tr>
                    <td style="font-weight:600;">${p.studentName || '-'}</td>
                    <td>₹${(p.amount || 0).toLocaleString('en-IN')}</td>
                    <td>${p.date ? formatDate(p.date) : '-'}</td>
                    <td><span class="enq-badge ${badgeClass}">${p.status || 'pending'}</span></td>
                </tr>`;
            }).join('');
        } else {
            payTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px;">No payments yet</td></tr>';
        }

        // Recent Enquiries (last 5) - pending first
        const recentEnq = [...enquiries].sort((a, b) => {
            // Pending enquiries first, then by id desc
            if (!a.replied && b.replied) return -1;
            if (a.replied && !b.replied) return 1;
            return (b.id || 0) - (a.id || 0);
        }).slice(0, 5);
        const enqTbody = document.querySelector('#recentEnquiriesTable tbody');
        if (recentEnq.length > 0) {
            enqTbody.innerHTML = recentEnq.map(e => {
                const statusBadge = e.replied
                    ? '<span class="enq-badge enq-badge-replied">Replied</span>'
                    : '<span class="enq-badge enq-badge-pending">Pending</span>';
                const safeMsg = (e.message || '-').replace(/"/g, '&quot;');
                return `<tr>
                    <td style="font-weight:600;">${e.name || '-'}</td>
                    <td style="font-size:13px;">${e.email || '-'}</td>
                    <td style="font-size:13px;">${e.phone || '-'}</td>
                    <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;" title="${safeMsg}">${e.message || '-'}</td>
                    <td style="font-size:13px;">${e.date || '-'}</td>
                    <td>${statusBadge}</td>
                    <td><button class="action-btn edit-btn" onclick="openEnquiryReply(${e.id})" title="Reply" style="padding:5px 10px;font-size:12px;"><i class="fas fa-reply"></i> ${e.replied ? 'View' : 'Reply'}</button></td>
                </tr>`;
            }).join('');
        } else {
            enqTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">No enquiries yet</td></tr>';
        }
    } catch (err) { console.error('Dashboard error:', err.message || err); }
}

async function loadAdminLogo() {
    try {
        const settings = await fetch('/api/settings').then(r => r.json());
        const adminLogo = document.getElementById('adminLogo');
        const adminDefaultIcon = document.getElementById('adminDefaultIcon');
        const adminSiteName = document.getElementById('adminSiteName');
        if (settings.logo && adminLogo) {
            adminLogo.src = settings.logo;
            adminLogo.style.display = 'block';
            if (adminDefaultIcon) adminDefaultIcon.style.display = 'none';
        }
        if (adminSiteName && settings.name) adminSiteName.textContent = settings.name;
        // Also update qualification section icon
        const qualImg = document.getElementById('adminQualLogo');
        const qualIcon = document.getElementById('adminQualIcon');
        if (settings.logo && qualImg && qualIcon) {
            qualImg.src = settings.logo;
            qualImg.style.display = 'inline-block';
            qualIcon.style.display = 'none';
        }
    } catch (err) { console.error(err); }
}

// ===== Courses =====
async function loadCoursesTable() {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const tbody = document.querySelector('#coursesTable tbody');
        let html = '';
        courses.forEach((c, index, arr) => {
            html += '<tr data-id="' + c.id + '">';
            html += '<td>' + c.name + '</td>';
            html += '<td>' + c.duration + '</td>';
            html += '<td>' + c.price + '</td>';
            html += '<td>' + (c.eligibility || '—') + '</td>';
            html += '<td>';
            html += '<button class="action-btn reorder-btn" onclick="moveCourseUp(' + c.id + ')" ' + (index === 0 ? 'disabled' : '') + ' title="Move Up">';
            html += '<i class="fas fa-arrow-up"></i>';
            html += '</button>';
            html += '<button class="action-btn reorder-btn" onclick="moveCourseDown(' + c.id + ')" ' + (index === arr.length - 1 ? 'disabled' : '') + ' title="Move Down">';
            html += '<i class="fas fa-arrow-down"></i>';
            html += '</button>';
            html += '<button class="action-btn edit-btn" onclick="editCourse(' + c.id + ')">Edit</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteCourse(' + c.id + ')">Delete</button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (err) { console.error(err); }
}

async function moveCourseUp(id) {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const index = courses.findIndex(c => c.id === id);
        if (index <= 0) return;
        // Swap with previous
        [courses[index], courses[index - 1]] = [courses[index - 1], courses[index]];
        // Save new order
        await fetch('/api/courses/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: courses.map(c => c.id) })
        });
        loadCoursesTable();
        showNotification('Course order updated!', 'success');
    } catch (err) { showNotification('Error updating order!', 'error'); }
}

async function moveCourseDown(id) {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const index = courses.findIndex(c => c.id === id);
        if (index < 0 || index >= courses.length - 1) return;
        // Swap with next
        [courses[index], courses[index + 1]] = [courses[index + 1], courses[index]];
        // Save new order
        await fetch('/api/courses/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: courses.map(c => c.id) })
        });
        loadCoursesTable();
        showNotification('Course order updated!', 'success');
    } catch (err) { showNotification('Error updating order!', 'error'); }
}

function openCourseModal() {
    document.getElementById('courseForm').reset();
    document.getElementById('courseId').value = '';
    document.getElementById('courseModalTitle').textContent = 'Add Course';
    document.getElementById('courseModal').classList.add('active');
}

async function editCourse(id) {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const course = courses.find(c => c.id === id);
        if (course) {
            document.getElementById('courseId').value = course.id;
            document.getElementById('courseName').value = course.name;
            document.getElementById('courseDuration').value = course.duration;
            document.getElementById('coursePrice').value = course.price;
            document.getElementById('courseDesc').value = course.description || '';
            document.getElementById('courseEligibility').value = course.eligibility || '';
            document.getElementById('courseModalTitle').textContent = 'Edit Course';
            document.getElementById('courseModal').classList.add('active');
        }
    } catch (err) { console.error(err); }
}

document.getElementById('courseForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('courseId').value;
    const data = {
        name: document.getElementById('courseName').value,
        duration: document.getElementById('courseDuration').value,
        price: parseInt(document.getElementById('coursePrice').value),
        eligibility: document.getElementById('courseEligibility').value,
        description: document.getElementById('courseDesc').value
    };
    try {
        if (id) {
            await fetch('/api/courses/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        } else {
            await fetch('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        }
        closeModal('courseModal');
        loadCoursesTable();
        loadDashboard();
        showNotification('Course saved!', 'success');
    } catch (err) { showNotification('Error saving course!', 'error'); }
});

async function deleteCourse(id) {
    if (!confirm('Delete this course?')) return;
    try {
        await fetch('/api/courses/' + id, { method: 'DELETE' });
        loadCoursesTable();
        showNotification('Course deleted!', 'success');
    } catch (err) { showNotification('Error deleting course!', 'error'); }
}

async function aiWriteCourseDesc() {
    const courseName = document.getElementById('courseName').value.trim();
    if (!courseName) { showNotification('Pehle Course Name likhein!', 'error'); return; }
    const duration = document.getElementById('courseDuration').value.trim();
    const price = document.getElementById('coursePrice').value;
    const btn = document.getElementById('aiWriteBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Writing...';
    try {
        const res = await fetch('/api/ai/course-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseName, duration, price })
        });
        const data = await res.json();
        if (data.success) {
            const textarea = document.getElementById('courseDesc');
            textarea.value = '';
            // Typing animation effect
            let i = 0;
            const txt = data.description;
            const speed = 8;
            function typeChar() {
                if (i < txt.length) {
                    textarea.value += txt.charAt(i);
                    textarea.scrollTop = textarea.scrollHeight;
                    i++;
                    setTimeout(typeChar, speed);
                } else {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-magic"></i> Write with AI';
                    showNotification('AI description ready! Edit kar sakte hain.', 'success');
                }
            }
            typeChar();
        } else {
            showNotification(data.error || 'AI generation failed!', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-magic"></i> Write with AI';
        }
    } catch (err) {
        showNotification('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-magic"></i> Write with AI';
    }
}

// ===== Enquiries =====
async function loadEnquiriesTable() {
    try {
        const enquiries = await fetch('/api/enquiries').then(r => r.json());
        const tbody = document.querySelector('#enquiriesTable tbody');
        if (enquiries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No enquiries yet</td></tr>';
            return;
        }
        let html = '';
        enquiries.forEach(e => {
            const statusBadge = e.replied
                ? '<span class="enq-badge enq-badge-replied">Replied</span>'
                : '<span class="enq-badge enq-badge-pending">Pending</span>';
            html += '<tr>';
            html += '<td><input type="checkbox" class="enquiry-checkbox" data-id="' + e.id + '"></td>';
            html += '<td>' + (e.name || '-') + '</td>';
            html += '<td>' + (e.email || '-') + '</td>';
            html += '<td>' + (e.phone || '-') + '</td>';
            html += '<td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + (e.message || '').replace(/"/g, '&quot;') + '">' + (e.message || '-') + '</td>';
            html += '<td>' + (e.date || '-') + '</td>';
            html += '<td>' + statusBadge + '</td>';
            html += '<td><button class="action-btn edit-btn" onclick="openEnquiryReply(' + e.id + ')" title="Reply"><i class="fas fa-reply"></i> Reply</button></td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (err) { console.error(err); }
}

function openEnquiryReply(id) {
    fetch('/api/enquiries').then(r => r.json()).then(enquiries => {
        const enq = enquiries.find(e => e.id == id);
        if (!enq) { showNotification('Enquiry not found', 'error'); return; }
        document.getElementById('replyEnqId').value = enq.id;
        document.getElementById('replyEnqName').textContent = enq.name || '-';
        document.getElementById('replyEnqEmail').textContent = enq.email || '-';
        document.getElementById('replyEnqPhone').textContent = enq.phone || '-';
        document.getElementById('replyEnqDate').textContent = enq.date || '-';
        document.getElementById('replyEnqMessage').textContent = enq.message || '-';
        document.getElementById('replyEnqText').value = '';
        // Show previous reply if exists
        const prevSection = document.getElementById('previousReplySection');
        if (enq.replied && enq.replyMessage) {
            prevSection.style.display = 'block';
            document.getElementById('previousReplyText').textContent = enq.replyMessage;
            document.getElementById('previousReplyDate').textContent = 'Replied on: ' + (enq.repliedAt || '-');
        } else {
            prevSection.style.display = 'none';
        }
        document.getElementById('enquiryReplyModal').classList.add('active');
    }).catch(() => showNotification('Error loading enquiry', 'error'));
}

async function sendEnquiryReply() {
    const id = document.getElementById('replyEnqId').value;
    const reply = document.getElementById('replyEnqText').value.trim();
    if (!reply) { showNotification('Please type a reply message', 'error'); return; }
    const btn = document.getElementById('sendReplyBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    try {
        const res = await fetch('/api/enquiries/' + id + '/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply })
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Reply sent successfully via email!', 'success');
            closeModal('enquiryReplyModal');
            loadEnquiriesTable();
            loadDashboard();
        } else {
            showNotification(data.error || 'Failed to send reply', 'error');
        }
    } catch (err) {
        showNotification('Error sending reply: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reply via Email';
    }
}

function openReplyLatestEnquiry() {
    fetch('/api/enquiries').then(r => r.json()).then(enquiries => {
        if (!enquiries || enquiries.length === 0) {
            showNotification('No enquiries found', 'warning');
            return;
        }
        // Find latest pending enquiry first, otherwise latest overall
        const pending = enquiries.filter(e => !e.replied);
        const target = pending.length > 0
            ? pending.sort((a, b) => (b.id || 0) - (a.id || 0))[0]
            : enquiries.sort((a, b) => (b.id || 0) - (a.id || 0))[0];
        openEnquiryReply(target.id);
    }).catch(() => showNotification('Error loading enquiries', 'error'));
}

function toggleAllEnquiryCheckboxes() {
    const selectAll = document.getElementById('selectAllEnquiries').checked;
    const checkboxes = document.querySelectorAll('.enquiry-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedEnquiries() {
    const checkboxes = document.querySelectorAll('.enquiry-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one enquiry to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} enquiry(ies)?`)) return;
    
    const enquiryIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const enquiryId of enquiryIds) {
            const res = await fetch('/api/enquiries/' + enquiryId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === enquiryIds.length) {
            showNotification(`${deletedCount} enquiry(ies) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${enquiryIds.length} enquiry(ies) deleted`, 'warning');
        }
        
        document.getElementById('selectAllEnquiries').checked = false;
        loadEnquiriesTable();
    } catch (e) {
        console.error('Error deleting enquiries:', e);
        showNotification('Error deleting enquiries', 'error');
    }
}

// ===== Faculty =====
function openFacultyModal() {
    document.getElementById('facultyForm').reset();
    document.getElementById('facultyModal').classList.add('active');
}

document.getElementById('facultyForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('facultyName').value,
        email: document.getElementById('facultyEmail').value,
        subject: document.getElementById('facultySubject').value,
        experience: document.getElementById('facultyExperience').value,
        role: document.getElementById('facultyRole').value
    };
    try {
        const res = await fetch('/api/faculty', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await res.json();
        closeModal('facultyModal');
        loadFacultyTable();
        loadDashboard();
        showNotification(result.message || 'Faculty added!', 'success');
    } catch (err) { showNotification('Error adding faculty!', 'error'); }
});

async function deleteFaculty(id) {
    if (!confirm('Delete this faculty?')) return;
    try {
        await fetch('/api/faculty/' + id, { method: 'DELETE' });
        loadFacultyTable();
        showNotification('Faculty deleted!', 'success');
    } catch (err) { showNotification('Error!', 'error'); }
}

async function loadFacultyTable() {
    try {
        const faculty = await fetch('/api/faculty').then(r => r.json());
        const tbody = document.querySelector('#facultyTable tbody');
        if (!tbody) return;
        
        if (faculty.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No faculty members</td></tr>';
            return;
        }
        
        tbody.innerHTML = faculty.map(f => {
            let html = '';
            html += '<tr>';
            html += '<td><input type="checkbox" class="faculty-checkbox" data-id="' + f.id + '"></td>';
            html += '<td>' + f.name + '</td>';
            html += '<td>' + (f.email || '-') + '</td>';
            html += '<td>' + f.subject + '</td>';
            html += '<td>' + f.experience + '</td>';
            html += '<td>' + (f.role || 'Faculty') + '</td>';
            html += '<td>';
            html += '<button class="action-btn delete-btn" onclick="deleteFaculty(' + f.id + ')"><i class="fas fa-trash"></i></button>';
            html += '</td>';
            html += '</tr>';
            return html;
        }).join('');
    } catch (err) {
        console.error('Error loading faculty:', err);
    }
}

function toggleAllFacultyCheckboxes() {
    const selectAll = document.getElementById('selectAllFaculty').checked;
    const checkboxes = document.querySelectorAll('.faculty-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedFaculty() {
    const checkboxes = document.querySelectorAll('.faculty-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one faculty member to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} faculty member(s)?`)) return;
    
    const facultyIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const facultyId of facultyIds) {
            const res = await fetch('/api/faculty/' + facultyId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === facultyIds.length) {
            showNotification(`${deletedCount} faculty member(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${facultyIds.length} faculty member(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllFaculty').checked = false;
        loadFacultyTable();
        loadDashboard();
    } catch (e) {
        console.error('Error deleting faculty:', e);
        showNotification('Error deleting faculty', 'error');
    }
}

// ===== Gallery =====
async function loadGalleryTable() {
    try {
        const gallery = await fetch('/api/gallery').then(r => r.json());
        const tbody = document.querySelector('#galleryTable tbody');
        let html = '';
        gallery.forEach(item => {
            html += '<tr>';
            html += '<td><input type="checkbox" class="gallery-checkbox" data-id="' + item.id + '"></td>';
            html += '<td><img src="' + item.image + '" alt="' + item.title + '" style="width:100px;height:60px;object-fit:cover;"></td>';
            html += '<td>' + item.title + '</td>';
            html += '<td>';
            html += '<button class="btn" onclick="deleteGalleryItem(\'' + item.id + '\')"><i class="fas fa-trash"></i></button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (err) { console.error(err); }
}

function toggleAllGalleryCheckboxes() {
    const selectAll = document.getElementById('selectAllGallery').checked;
    const checkboxes = document.querySelectorAll('.gallery-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedGalleryItems() {
    const checkboxes = document.querySelectorAll('.gallery-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one gallery item to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} gallery item(s)?`)) return;
    
    const galleryIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const galleryId of galleryIds) {
            const res = await fetch('/api/gallery/' + galleryId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === galleryIds.length) {
            showNotification(`${deletedCount} gallery item(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${galleryIds.length} gallery item(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllGallery').checked = false;
        loadGalleryTable();
        loadDashboard();
    } catch (e) {
        console.error('Error deleting gallery items:', e);
        showNotification('Error deleting gallery items', 'error');
    }
}

function openGalleryModal() {
    document.getElementById('galleryForm').reset();
    galleryImageFile = null;
    document.getElementById('galleryPreviewImg').style.display = 'none';
    document.getElementById('galleryPlaceholder').style.display = 'block';
    document.getElementById('galleryFile').value = '';
    document.getElementById('galleryModal').classList.add('active');
}

async function saveGalleryItem() {
    const title = document.getElementById('galleryTitle').value.trim();
    if (!title) { showNotification('Please enter a title!', 'error'); return; }
    if (!galleryImageFile) { showNotification('Please select an image!', 'error'); return; }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('image', galleryImageFile);

    try {
        const res = await fetch('/api/gallery', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            closeModal('galleryModal');
            galleryImageFile = null;
            loadGalleryTable();
            loadDashboard();
            showNotification('Gallery item added!', 'success');
        } else {
            showNotification(data.message || 'Upload failed!', 'error');
        }
    } catch (err) { showNotification('Error uploading image!', 'error'); }
}

async function deleteGalleryItem(id) {
    if (!confirm('Delete this item?')) return;
    try {
        await fetch('/api/gallery/' + id, { method: 'DELETE' });
        loadGalleryTable();
        showNotification('Deleted!', 'success');
    } catch (err) { showNotification('Error!', 'error'); }
}

// ===== Notices =====
const NOTICE_CATEGORY_COLORS = { General:'#64748b', Exam:'#7c3aed', Fee:'#dc2626', Holiday:'#16a34a', Event:'#0284c7', Result:'#d97706' };

async function loadNoticesTable() {
    try {
        const notices = await fetch('/api/notices').then(r => r.json());
        const tbody = document.querySelector('#noticesTable tbody');
        if (notices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#999;">Koi notice nahi hai. "Add Notice" karein.</td></tr>';
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        let html = '';
        notices.forEach((n, i) => {
            const expired = n.expiry && n.expiry < today;
            const catColor = NOTICE_CATEGORY_COLORS[n.category] || '#64748b';
            html += '<tr style="' + (expired ? 'opacity:0.5;' : '') + '">';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td>';
            if (n.isPinned) html += '<i class="fas fa-thumbtack" title="Pinned" style="color:#f59e0b;margin-right:5px;"></i>';
            if (n.isImportant) html += '<span class="notice-badge-imp">IMPORTANT</span> ';
            html += '<strong>' + n.title + '</strong>';
            if (expired) html += ' <span style="color:#dc2626;font-size:.75rem;">(Expired)</span>';
            html += '</td>';
            html += '<td><span class="notice-cat-badge" style="background:' + catColor + '">' + (n.category || 'General') + '</span></td>';
            html += '<td>' + n.date + '</td>';
            html += '<td>' + (n.expiry ? '<span style="color:' + (expired ? '#dc2626' : '#16a34a') + ';">' + n.expiry + '</span>' : '<span style="color:#aaa;">-</span>') + '</td>';
            html += '<td>' + (n.file ? '<a href="' + n.file + '" target="_blank" class="notice-file-link"><i class="fas fa-' + (n.fileType && n.fileType.includes('pdf') ? 'file-pdf' : 'file-image') + '"></i> View</a>' : '<span style="color:#aaa;">No file</span>') + '</td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editNotice(' + n.id + ')" title="Edit"><i class="fas fa-pen"></i></button>';
            html += '<button class="action-btn delete-btn" onclick="deleteNotice(' + n.id + ')" title="Delete"><i class="fas fa-trash"></i></button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (err) { showNotification('Notices load error!', 'error'); }
}

let editingNoticeId = null;

function openNoticeModal() {
    editingNoticeId = null;
    document.querySelector('#noticeModal h3').innerHTML = '<i class="fas fa-bell"></i> Add Notice';
    document.getElementById('noticeTitle').value = '';
    document.getElementById('noticeCategory').value = 'General';
    document.getElementById('noticeExpiry').value = '';
    document.getElementById('noticeImportant').checked = false;
    document.getElementById('noticePinned').checked = false;
    document.getElementById('noticeFile').value = '';
    document.getElementById('noticeFileName').textContent = 'Click to attach PDF or image';
    document.getElementById('noticeCurrentFile').style.display = 'none';
    document.getElementById('noticeModal').classList.add('active');
}

async function editNotice(id) {
    try {
        const notices = await fetch('/api/notices').then(r => r.json());
        const n = notices.find(x => x.id == id);
        if (!n) return;
        editingNoticeId = id;
        document.querySelector('#noticeModal h3').innerHTML = '<i class="fas fa-pen"></i> Edit Notice';
        document.getElementById('noticeTitle').value = n.title || '';
        document.getElementById('noticeCategory').value = n.category || 'General';
        document.getElementById('noticeExpiry').value = n.expiry || '';
        document.getElementById('noticeImportant').checked = !!n.isImportant;
        document.getElementById('noticePinned').checked = !!n.isPinned;
        document.getElementById('noticeFile').value = '';
        document.getElementById('noticeFileName').textContent = 'Choose new file to replace (optional)';
        const curFile = document.getElementById('noticeCurrentFile');
        if (n.file) {
            curFile.style.display = 'inline-flex';
            curFile.href = n.file;
            curFile.innerHTML = '<i class="fas fa-' + (n.fileType && n.fileType.includes('pdf') ? 'file-pdf' : 'file-image') + '" style="margin-right:5px;"></i> Current file';
        } else { curFile.style.display = 'none'; }
        document.getElementById('noticeModal').classList.add('active');
    } catch (err) { showNotification('Load error!', 'error'); }
}

function showNoticeFileName(input) {
    const file = input.files[0];
    document.getElementById('noticeFileName').textContent = file ? '📎 ' + file.name : 'Click to attach PDF or image';
}

async function saveNotice() {
    const title = document.getElementById('noticeTitle').value.trim();
    if (!title) { showNotification('Notice title likhna zaroori hai!', 'error'); return; }
    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', document.getElementById('noticeCategory').value);
    formData.append('expiry', document.getElementById('noticeExpiry').value);
    formData.append('isImportant', document.getElementById('noticeImportant').checked ? 'true' : 'false');
    formData.append('isPinned', document.getElementById('noticePinned').checked ? 'true' : 'false');
    const file = document.getElementById('noticeFile').files[0];
    if (file) formData.append('file', file);
    const isEdit = !!editingNoticeId;
    const url = isEdit ? '/api/notices/' + editingNoticeId : '/api/notices';
    const method = isEdit ? 'PUT' : 'POST';
    try {
        const res = await fetch(url, { method, body: formData });
        const data = await res.json();
        if (data.success) {
            closeModal('noticeModal');
            loadNoticesTable();
            showNotification(isEdit ? 'Notice updated!' : 'Notice added!', 'success');
        } else { showNotification('Error!', 'error'); }
    } catch (err) { showNotification('Notice save error!', 'error'); }
}

async function deleteNotice(id) {
    if (!confirm('Is notice ko delete karein?')) return;
    try {
        await fetch('/api/notices/' + id, { method: 'DELETE' });
        loadNoticesTable();
        showNotification('Notice deleted!', 'success');
    } catch (err) { showNotification('Error!', 'error'); }
}

// ===== Batch Management =====
let editingBatchId = null;

async function loadBatchesTable() {
    try {
        const data = await fetch('/api/batches/seats').then(r => r.json());
        const tbody = document.querySelector('#batchesTable tbody');
        if (!data.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#999;">Koi batch nahi hai. "Create Batch" karein.</td></tr>'; return; }
        let html = '';
        data.forEach((b, i) => {
            html += '<tr>';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td><strong>' + b.name + '</strong></td>';
            html += '<td>' + (b.timing || '-') + '</td>';
            html += '<td>' + (b.startDate || '-') + '</td>';
            html += '<td>' + b.totalSeats + '</td>';
            html += '<td>' + b.enrolled + '</td>';
            html += '<td><span class="seats-badge ' + (b.available > 5 ? 'seats-ok' : b.available > 0 ? 'seats-low' : 'seats-full') + '">' + (b.available > 0 ? b.available + ' seats' : 'FULL') + '</span></td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editBatch(' + b.id + ')" title="Edit"><i class="fas fa-pen"></i></button>';
            html += '<button class="action-btn delete-btn" onclick="deleteBatch(' + b.id + ')" title="Delete"><i class="fas fa-trash"></i></button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch(e) { showNotification('Batches load error!', 'error'); }
}

async function openBatchModal() {
    editingBatchId = null;
    document.getElementById('batchModalTitle').innerHTML = '<i class="fas fa-layer-group"></i> Create Batch';
    document.getElementById('batchName').value = '';
    document.getElementById('batchTiming').value = '';
    document.getElementById('batchStartDate').value = '';
    document.getElementById('batchTotalSeats').value = '';
    document.getElementById('batchModal').classList.add('active');
}

async function editBatch(id) {
    const batches = await fetch('/api/batches').then(r => r.json());
    const b = batches.find(x => x.id == id); if (!b) return;
    editingBatchId = id;
    document.getElementById('batchModalTitle').innerHTML = '<i class="fas fa-pen"></i> Edit Batch';
    document.getElementById('batchName').value = b.name || '';
    document.getElementById('batchTiming').value = b.timing || '';
    document.getElementById('batchStartDate').value = b.startDate || '';
    document.getElementById('batchTotalSeats').value = b.totalSeats || '';
    document.getElementById('batchModal').classList.add('active');
}

async function saveBatch() {
    const name = document.getElementById('batchName').value.trim();
    const seats = document.getElementById('batchTotalSeats').value;
    if (!name || !seats) { showNotification('Batch name aur seats zaroori hain!', 'error'); return; }
    const body = { name, timing: document.getElementById('batchTiming').value, startDate: document.getElementById('batchStartDate').value, totalSeats: seats };
    const url = editingBatchId ? '/api/batches/' + editingBatchId : '/api/batches';
    const method = editingBatchId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('batchModal'); loadBatchesTable(); showNotification(editingBatchId ? 'Batch updated!' : 'Batch created!', 'success'); }
    else showNotification('Error!', 'error');
}

async function deleteBatch(id) {
    if (!confirm('Is batch ko delete karein?')) return;
    await fetch('/api/batches/' + id, { method: 'DELETE' });
    loadBatchesTable(); showNotification('Batch deleted!', 'success');
}

// ===== Announcements =====
async function loadAnnouncementsTable() {
    try {
        const res = await fetch('/api/announcements');
        const data = await res.json();
        const tbody = document.getElementById('announcementsTable').querySelector('tbody');
        if (data.success && data.announcements) {
            let html = '';
            data.announcements.forEach(a => {
                html += '<tr>';
                html += '<td><input type="checkbox" class="announcement-checkbox" data-id="' + a.id + '"></td>';
                html += '<td><strong>' + a.title + '</strong></td>';
                html += '<td><span class="announcement-badge category-' + a.category + '">' + a.category + '</span></td>';
                html += '<td><span class="announcement-badge priority-' + a.priority + '">' + a.priority + '</span></td>';
                html += '<td>' + (a.target === 'all' ? 'All Students' : a.target === 'course' ? a.course : a.target === 'batch' ? a.batch : 'Specific Student') + '</td>';
                html += '<td>' + (a.expiryDate ? formatDate(a.expiryDate) : 'No expiry') + '</td>';
                html += '<td>' + (a.readCount || 0) + '</td>';
                html += '<td>';
                html += '<button class="btn" onclick="deleteAnnouncement(\'' + a.id + '\')"><i class="fas fa-trash"></i></button>';
                html += '</td>';
                html += '</tr>';
            });
            tbody.innerHTML = html;
        }
    } catch (err) { console.error(err); }
}

function toggleAllAnnouncementCheckboxes() {
    const selectAll = document.getElementById('selectAllAnnouncements').checked;
    const checkboxes = document.querySelectorAll('.announcement-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedAnnouncements() {
    const checkboxes = document.querySelectorAll('.announcement-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one announcement to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} announcement(s)?`)) return;
    
    const announcementIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const announcementId of announcementIds) {
            const res = await fetch('/api/announcements/' + announcementId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === announcementIds.length) {
            showNotification(`${deletedCount} announcement(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${announcementIds.length} announcement(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllAnnouncements').checked = false;
        loadAnnouncementsTable();
    } catch (e) {
        console.error('Error deleting announcements:', e);
        showNotification('Error deleting announcements', 'error');
    }
}

function openAnnouncementModal() {
    document.getElementById('announcementModalTitle').textContent = 'Add Announcement';
    document.getElementById('announcementId').value = '';
    document.getElementById('announcementTitle').value = '';
    document.getElementById('announcementContent').value = '';
    document.getElementById('announcementCategory').value = 'general';
    document.getElementById('announcementPriority').value = 'normal';
    document.getElementById('announcementTarget').value = 'all';
    document.getElementById('announcementExpiry').value = '';
    document.getElementById('announcementAttachment').value = '';
    handleTargetChange();
    loadCoursesForAnnouncement();
    loadBatchesForAnnouncement();
    loadStudentsForAnnouncement();
    document.getElementById('announcementModal').classList.add('active');
}

function handleTargetChange() {
    const target = document.getElementById('announcementTarget').value;
    document.getElementById('courseSelectGroup').style.display = target === 'course' ? 'block' : 'none';
    document.getElementById('batchSelectGroup').style.display = target === 'batch' ? 'block' : 'none';
    document.getElementById('studentSelectGroup').style.display = target === 'student' ? 'block' : 'none';
}

async function loadCoursesForAnnouncement() {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    const select = document.getElementById('announcementCourse');
    select.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
}

async function loadBatchesForAnnouncement() {
    const res = await fetch('/api/batches');
    const batches = await res.json();
    const select = document.getElementById('announcementBatch');
    select.innerHTML = '<option value="">Select Batch</option>' + batches.map(b => '<option>' + b.name + '</option>').join('');
}

async function loadStudentsForAnnouncement() {
    const res = await fetch('/api/students');
    const students = await res.json();
    const select = document.getElementById('announcementStudent');
    select.innerHTML = '<option value="">Select Student</option>' + students.map(s => '<option value="' + s.id + '">' + s.name + ' (' + s.rollNo + ')</option>').join('');
}

async function saveAnnouncement() {
    const target = document.getElementById('announcementTarget').value;
    const data = {
        title: document.getElementById('announcementTitle').value,
        content: document.getElementById('announcementContent').value,
        category: document.getElementById('announcementCategory').value,
        priority: document.getElementById('announcementPriority').value,
        target: target,
        course: target === 'course' ? document.getElementById('announcementCourse').value : '',
        batch: target === 'batch' ? document.getElementById('announcementBatch').value : '',
        studentId: target === 'student' ? document.getElementById('announcementStudent').value : null,
        expiryDate: document.getElementById('announcementExpiry').value,
        attachment: document.getElementById('announcementAttachment').value
    };
    try {
        await fetch('/api/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeModal('announcementModal');
        loadAnnouncementsTable();
        showNotification('Announcement added!', 'success');
    } catch (e) { showNotification('Error!', 'error'); }
}

async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return;
    try {
        await fetch('/api/announcements/' + id, { method: 'DELETE' });
        loadAnnouncementsTable();
        showNotification('Announcement deleted!', 'success');
    } catch (e) { showNotification('Error!', 'error'); }
}

// ===== Tests =====
let questionCounter = 0;

async function loadTestsTable() {
    try {
        const res = await fetch('/api/tests');
        const data = await res.json();
        const tbody = document.getElementById('testsTable').querySelector('tbody');
        if (data.success && data.tests) {
            let html = '';
            data.tests.forEach(t => {
                html += '<tr>';
                html += '<td><input type="checkbox" class="test-checkbox" data-id="' + t.id + '"></td>';
                html += '<td><strong>' + t.title + '</strong></td>';
                html += '<td>' + (t.course || 'All') + '</td>';
                html += '<td>' + (t.questions ? t.questions.length : 0) + '</td>';
                html += '<td>' + (t.timeLimit ? t.timeLimit + ' min' : 'No limit') + '</td>';
                html += '<td>' + t.passingMarks + '/' + t.totalMarks + '</td>';
                html += '<td>' + (t.target === 'all' ? 'All Students' : t.target === 'course' ? t.course : t.batch) + '</td>';
                html += '<td>';
                html += '<button class="btn" onclick="deleteTest(\'' + t.id + '\')"><i class="fas fa-trash"></i></button>';
                html += '</td>';
                html += '</tr>';
            });
            tbody.innerHTML = html;
        }
    } catch (e) {}
}

function toggleAllTestCheckboxes() {
    const selectAll = document.getElementById('selectAllTests').checked;
    const checkboxes = document.querySelectorAll('.test-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedTests() {
    const checkboxes = document.querySelectorAll('.test-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one test to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} test(s)?`)) return;
    
    const testIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const testId of testIds) {
            const res = await fetch('/api/tests/' + testId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === testIds.length) {
            showNotification(`${deletedCount} test(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${testIds.length} test(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllTests').checked = false;
        loadTestsTable();
    } catch (e) {
        console.error('Error deleting tests:', e);
        showNotification('Error deleting tests', 'error');
    }
}

function openTestModal() {
    document.getElementById('testModalTitle').textContent = 'Add Test';
    document.getElementById('testId').value = '';
    document.getElementById('testTitle').value = '';
    document.getElementById('testDescription').value = '';
    document.getElementById('testCourse').value = '';
    document.getElementById('testBatch').value = '';
    document.getElementById('testTarget').value = 'all';
    document.getElementById('testTimeLimit').value = '30';
    document.getElementById('testTotalMarks').value = '100';
    document.getElementById('testPassingMarks').value = '40';
    document.getElementById('testStartDate').value = '';
    document.getElementById('testEndDate').value = '';
    document.getElementById('testRandomize').checked = false;
    document.getElementById('testShowAnswers').checked = false;
    document.getElementById('testAllowRetake').checked = false;
    document.getElementById('testMaxAttempts').value = '1';
    document.getElementById('testQuestionsContainer').innerHTML = '';
    questionCounter = 0;
    loadCoursesForTest();
    loadBatchesForTest();
    document.getElementById('testModal').classList.add('active');
}

async function loadCoursesForTest() {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    const select = document.getElementById('testCourse');
    select.innerHTML = '<option value="">All Courses</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
}

async function loadBatchesForTest() {
    const res = await fetch('/api/batches');
    const batches = await res.json();
    const select = document.getElementById('testBatch');
    select.innerHTML = '<option value="">All Batches</option>' + batches.map(b => '<option>' + b.name + '</option>').join('');
}

function addQuestionField() {
    const container = document.getElementById('testQuestionsContainer');
    const questionId = questionCounter++;
    let html = '';
    html += '<div class="question-field" id="question-' + questionId + '" style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #e2e8f0;">';
    html += '<div style="display: flex; justify-content: space-between; margin-bottom: 10px;">';
    html += '<h5 style="margin: 0;">Question ' + (questionId + 1) + '</h5>';
    html += '<button type="button" class="btn" onclick="removeQuestion(' + questionId + ')" style="padding: 4px 8px; font-size: 12px;"><i class="fas fa-times"></i></button>';
    html += '</div>';
    html += '<div class="form-group"><label>Question *</label><input type="text" class="question-text" placeholder="Enter question..." required></div>';
    html += '<div class="form-group"><label>Question Type</label>';
    html += '<select class="question-type" onchange="updateQuestionOptions(' + questionId + ', this.value)">';
    html += '<option value="mcq-single">Multiple Choice (Single)</option>';
    html += '<option value="mcq-multiple">Multiple Choice (Multiple)</option>';
    html += '<option value="true-false">True/False</option>';
    html += '<option value="short-answer">Short Answer</option>';
    html += '</select>';
    html += '</div>';
    html += '<div class="form-group"><label>Marks</label><input type="number" class="question-marks" value="1" min="1"></div>';
    html += '<div class="question-options" id="options-' + questionId + '">';
    html += '<div class="form-group"><label>Option A</label><input type="text" class="option-text" placeholder="Option A"></div>';
    html += '<div class="form-group"><label>Option B</label><input type="text" class="option-text" placeholder="Option B"></div>';
    html += '<div class="form-group"><label>Option C</label><input type="text" class="option-text" placeholder="Option C"></div>';
    html += '<div class="form-group"><label>Option D</label><input type="text" class="option-text" placeholder="Option D"></div>';
    html += '<div class="form-group"><label>Correct Answer</label>';
    html += '<select class="correct-answer">';
    html += '<option value="0">Option A</option>';
    html += '<option value="1">Option B</option>';
    html += '<option value="2">Option C</option>';
    html += '<option value="3">Option D</option>';
    html += '</select>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    container.insertAdjacentHTML('beforeend', html);
}

function removeQuestion(questionId) {
    document.getElementById('question-' + questionId).remove();
}

function updateQuestionOptions(questionId, type) {
    const optionsContainer = document.getElementById('options-' + questionId);
    
    if (type === 'true-false') {
        let html = '';
        html += '<div class="form-group"><label>Correct Answer</label>';
        html += '<select class="correct-answer">';
        html += '<option value="true">True</option>';
        html += '<option value="false">False</option>';
        html += '</select>';
        html += '</div>';
        optionsContainer.innerHTML = html;
    } else if (type === 'short-answer') {
        let html = '';
        html += '<div class="form-group"><label>Correct Answer</label>';
        html += '<input type="text" class="correct-answer" placeholder="Enter correct answer">';
        html += '</div>';
        optionsContainer.innerHTML = html;
    } else if (type === 'mcq-multiple') {
        let html = '';
        html += '<div class="form-group"><label>Option A</label><input type="text" class="option-text" placeholder="Option A"></div>';
        html += '<div class="form-group"><label>Option B</label><input type="text" class="option-text" placeholder="Option B"></div>';
        html += '<div class="form-group"><label>Option C</label><input type="text" class="option-text" placeholder="Option C"></div>';
        html += '<div class="form-group"><label>Option D</label><input type="text" class="option-text" placeholder="Option D"></div>';
        html += '<div class="form-group"><label>Correct Answers (select multiple)</label>';
        html += '<div style="display:flex;gap:10px;">';
        html += '<label><input type="checkbox" class="correct-checkbox" value="0"> A</label>';
        html += '<label><input type="checkbox" class="correct-checkbox" value="1"> B</label>';
        html += '<label><input type="checkbox" class="correct-checkbox" value="2"> C</label>';
        html += '<label><input type="checkbox" class="correct-checkbox" value="3"> D</label>';
        html += '</div>';
        html += '</div>';
        optionsContainer.innerHTML = html;
    } else {
        let html = '';
        html += '<div class="form-group"><label>Option A</label><input type="text" class="option-text" placeholder="Option A"></div>';
        html += '<div class="form-group"><label>Option B</label><input type="text" class="option-text" placeholder="Option B"></div>';
        html += '<div class="form-group"><label>Option C</label><input type="text" class="option-text" placeholder="Option C"></div>';
        html += '<div class="form-group"><label>Option D</label><input type="text" class="option-text" placeholder="Option D"></div>';
        html += '<div class="form-group"><label>Correct Answer</label>';
        html += '<select class="correct-answer">';
        html += '<option value="0">Option A</option>';
        html += '<option value="1">Option B</option>';
        html += '<option value="2">Option C</option>';
        html += '<option value="3">Option D</option>';
        html += '</select>';
        html += '</div>';
        optionsContainer.innerHTML = html;
    }
}

async function saveTest() {
    const questionFields = document.querySelectorAll('.question-field');
    const questions = [];
    
    questionFields.forEach((field, index) => {
        const type = field.querySelector('.question-type').value;
        const question = {
            text: field.querySelector('.question-text').value,
            type: type,
            marks: parseInt(field.querySelector('.question-marks').value) || 1
        };
        
        if (type === 'mcq-single' || type === 'mcq-multiple') {
            const options = Array.from(field.querySelectorAll('.option-text')).map(input => input.value);
            const correctAnswer = field.querySelector('.correct-answer').value;
            question.options = options.map((opt, i) => ({ text: opt }));
            question.correctAnswer = parseInt(correctAnswer);
        } else if (type === 'true-false') {
            question.correctAnswer = field.querySelector('.correct-answer').value;
        } else {
            question.correctAnswer = field.querySelector('.correct-answer').value;
        }
        
        questions.push(question);
    });
    
    const target = document.getElementById('testTarget').value;
    const data = {
        title: document.getElementById('testTitle').value,
        description: document.getElementById('testDescription').value,
        course: target === 'course' ? document.getElementById('testCourse').value : '',
        batch: target === 'batch' ? document.getElementById('testBatch').value : '',
        target: target,
        timeLimit: parseInt(document.getElementById('testTimeLimit').value),
        totalMarks: parseInt(document.getElementById('testTotalMarks').value),
        passingMarks: parseInt(document.getElementById('testPassingMarks').value),
        startDate: document.getElementById('testStartDate').value,
        endDate: document.getElementById('testEndDate').value,
        randomizeQuestions: document.getElementById('testRandomize').checked,
        showAnswers: document.getElementById('testShowAnswers').checked,
        allowRetake: document.getElementById('testAllowRetake').checked,
        maxAttempts: parseInt(document.getElementById('testMaxAttempts').value),
        questions: questions
    };
    
    try {
        await fetch('/api/tests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeModal('testModal');
        loadTestsTable();
        showNotification('Test added!', 'success');
    } catch (e) { showNotification('Error!', 'error'); }
}

async function deleteTest(id) {
    if (!confirm('Delete this test?')) return;
    try {
        await fetch('/api/tests/' + id, { method: 'DELETE' });
        loadTestsTable();
        showNotification('Test deleted!', 'success');
    } catch (e) { showNotification('Error!', 'error'); }
}

// ===== Fees Management =====
async function loadFeesTable() {
    try {
        const res = await fetch('/api/students');
        const students = await res.json();
        const tbody = document.getElementById('feesTable').querySelector('tbody');
        
        if (students && students.length > 0) {
            let html = '';
            students.forEach(s => {
                const fees = s.fees || { totalFees: 0, paidAmount: 0, dueAmount: 0 };
                html += '<tr>';
                html += '<td><strong>' + s.name + '</strong><br><small>' + s.rollNo + '</small></td>';
                html += '<td>' + s.course + '</td>';
                html += '<td>' + (s.batch || '-') + '</td>';
                html += '<td>₹' + (fees.totalFees || 0) + '</td>';
                html += '<td style="color:#16a34a;">₹' + (fees.paidAmount || 0) + '</td>';
                html += '<td style="color:' + (fees.dueAmount > 0 ? '#dc2626' : '#16a34a') + ';">₹' + (fees.dueAmount || 0) + '</td>';
                html += '<td>';
                html += '<button class="btn btn-primary" onclick="openFeeModal(\'' + s.id + '\')" style="padding:4px 8px;font-size:12px;">Add Payment</button>';
                html += '</td>';
                html += '</tr>';
            });
            tbody.innerHTML = html;
        }
    } catch (e) {
        console.error('Error loading fees:', e);
    }
}

async function loadPaymentsTable() {
    try {
        const res = await fetch('/api/payments');
        const data = await res.json();
        const tbody = document.getElementById('paymentsTable').querySelector('tbody');
        
        if (data.success && data.payments) {
            let html = '';
            data.payments.forEach(p => {
                const utr = p.utr || p.transactionId || p.utrNo || '-';
                html += '<tr>';
                html += '<td><strong>' + p.studentName + '</strong></td>';
                html += '<td>₹' + p.amount + '</td>';
                html += '<td>' + p.mode + '</td>';
                html += '<td>' + formatDate(p.date) + '</td>';
                html += '<td>' + utr + '</td>';
                html += '<td>';
                html += '<span style="padding:4px 8px;border-radius:12px;font-size:12px;font-weight:600;background:' + (p.status === 'approved' ? '#dcfce7' : p.status === 'denied' ? '#fee2e2' : '#fef3c7') + ';color:' + (p.status === 'approved' ? '#16a34a' : p.status === 'denied' ? '#dc2626' : '#d97706') + ';">';
                html += p.status;
                html += '</span>';
                html += '</td>';
                html += '<td>';
                if (p.status === 'pending') {
                    html += '<button class="btn btn-success" onclick="approvePayment(\'' + p.id + '\')" style="padding:4px 8px;font-size:12px;">Approve</button>';
                    html += '<button class="btn" onclick="denyPayment(\'' + p.id + '\')" style="padding:4px 8px;font-size:12px;background:#fee2e2;color:#dc2626;">Deny</button>';
                } else {
                    html += '-';
                }
                html += '</td>';
                html += '</tr>';
            });
            tbody.innerHTML = html;
        }
    } catch (e) {
        console.error('Error loading payments:', e);
    }
}

function openFeeModal(studentId = '') {
    document.getElementById('feeModalTitle').textContent = 'Add Fee Payment';
    document.getElementById('feeStudentId').value = studentId;
    document.getElementById('feeAmount').value = '';
    document.getElementById('feeMode').value = 'Cash';
    document.getElementById('feeUtr').value = '';
    
    if (studentId) {
        fetch('/api/students').then(r => r.json()).then(students => {
            const student = students.find(s => s.id == studentId);
            if (student) {
                document.getElementById('feeStudentName').value = student.name;
            }
        });
    } else {
        document.getElementById('feeStudentName').value = '';
    }
    
    document.getElementById('feeModal').classList.add('active');
}

async function saveFee() {
    const studentId = document.getElementById('feeStudentId').value;
    const amount = document.getElementById('feeAmount').value;
    const mode = document.getElementById('feeMode').value;
    const utr = document.getElementById('feeUtr').value;
    
    if (!studentId || !amount) {
        showNotification('Student and amount required!', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/students');
        const students = await res.json();
        const student = students.find(s => s.id == studentId);
        
        if (student) {
            // Update student fees
            student.fees.paidAmount += parseInt(amount);
            student.fees.dueAmount = Math.max(0, student.fees.dueAmount - parseInt(amount));
            
            // Add payment record
            const payment = {
                id: Date.now(),
                studentId: parseInt(studentId),
                studentName: student.name,
                amount: parseInt(amount),
                mode: mode,
                utr: utr,
                date: new Date().toISOString(),
                status: 'approved'
            };
            
            // Save to payments.json
            const paymentsRes = await fetch('/api/payments');
            const paymentsData = await paymentsRes.json();
            const payments = paymentsData.payments || [];
            payments.unshift(payment);
            
            await fetch('/api/payments', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ payments }) 
            });
            
            // Update student
            await fetch('/api/students/' + studentId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(student)
            });
            
            closeModal('feeModal');
            loadFeesTable();
            showNotification('Payment added successfully!', 'success');
        }
    } catch (e) {
        showNotification('Error adding payment!', 'error');
    }
}

async function approvePayment(paymentId) {
    try {
        await fetch('/api/payments/' + paymentId + '/approve', { method: 'POST' });
        loadPaymentsTable();
        showNotification('Payment approved!', 'success');
    } catch (e) { showNotification('Error approving payment!', 'error'); }
}

async function denyPayment(paymentId) {
    try {
        await fetch('/api/payments/' + paymentId + '/deny', { method: 'POST' });
        loadPaymentsTable();
        showNotification('Payment denied!', 'success');
    } catch (e) { showNotification('Error denying payment!', 'error'); }
}

// ===== Attendance =====
async function loadAttendancePage() {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const courseSelect = document.getElementById('attendanceCourse');
        courseSelect.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
        
        document.getElementById('attendanceDate').value = new Date().toISOString().split('T')[0];
        
        // Clear stats and table initially
        document.getElementById('attendanceStats').innerHTML = '';
        document.getElementById('attendanceTable').querySelector('tbody').innerHTML = '';
        document.getElementById('attendanceBatch').innerHTML = '<option value="">All Batches</option>';
        
        // Add event listener to date input
        document.getElementById('attendanceDate').addEventListener('change', loadHolidaysForDate);
        
        // Load holidays for the selected date
        loadHolidaysForDate();
    } catch (e) {}
}

async function loadHolidaysForDate() {
    try {
        const date = document.getElementById('attendanceDate').value;
        if (!date) return;
        
        const res = await fetch('/api/holidays/by-date/' + date);
        const data = await res.json();
        
        if (data.success && data.holiday) {
            const holidayDiv = document.getElementById('holidayInfo');
            const holiday = data.holiday;
            
            let html = '';
            html += '<div style="background:#fef3c7;padding:12px;border-radius:8px;margin-bottom:15px;border-left:4px solid #f59e0b;">';
            html += '<div style="font-weight:600;color:#d97706;margin-bottom:4px;">';
            html += '<i class="fas fa-calendar-alt"></i> ' + (holiday.type === 'holiday' ? 'Holiday' : holiday.type === 'event' ? 'Event' : 'Festival') + ': ' + holiday.title;
            html += '</div>';
            html += '<div style="font-size:13px;color:#b45309;">' + (holiday.description || '') + '</div>';
            html += '<button onclick="markAllAsHoliday(\'' + date + '\')" style="margin-top:8px;padding:6px 12px;background:#f59e0b;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">';
            html += 'Mark All as Holiday';
            html += '</button>';
            html += '</div>';
            holidayDiv.innerHTML = html;
            holidayDiv.style.display = 'block';
        } else {
            holidayDiv.innerHTML = '';
            holidayDiv.style.display = 'none';
        }
    } catch (e) {
        console.error('Error loading holidays:', e);
        const holidayDiv = document.getElementById('holidayInfo');
        holidayDiv.innerHTML = '';
        holidayDiv.style.display = 'none';
    }
}

async function markAllAsHoliday(date) {
    if (!confirm('Are you sure you want to mark all students as holiday for this date?')) return;
    
    try {
        const course = document.getElementById('attendanceCourse').value;
        const batch = document.getElementById('attendanceBatch').value;
        
        if (!course || !date) {
            showNotification('Please select course and date!', 'error');
            return;
        }
        
        const res = await fetch('/api/students?course=' + encodeURIComponent(course) + '&batch=' + encodeURIComponent(batch || ''));
        const data = await res.json();
        
        const students = Array.isArray(data) ? data : (data.students || []);
        
        if (students.length > 0) {
            let savedCount = 0;
            for (const student of students) {
                await fetch('/api/attendance', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ studentId: student.id, date, status: 'holiday', course, batch }) 
                });
                savedCount++;
            }
            showNotification('Marked ' + savedCount + ' students as holiday!', 'success');
            loadAttendanceTable();
        }
    } catch (e) { 
        showNotification('Error marking holiday!', 'error');
    }
}

// Holiday Management Functions
function openHolidayModal() {
    document.getElementById('holidayModalTitle').textContent = 'Add Holiday';
    document.getElementById('holidayId').value = '';
    document.getElementById('holidayDate').value = '';
    document.getElementById('holidayTitle').value = '';
    document.getElementById('holidayType').value = 'holiday';
    document.getElementById('holidayDescription').value = '';
    document.getElementById('holidayModal').style.display = 'block';
}

function closeHolidayModal() {
    document.getElementById('holidayModal').style.display = 'none';
}

async function saveHoliday() {
    const id = document.getElementById('holidayId').value;
    const date = document.getElementById('holidayDate').value;
    const title = document.getElementById('holidayTitle').value;
    const type = document.getElementById('holidayType').value;
    const description = document.getElementById('holidayDescription').value;
    
    if (!date || !title) {
        showNotification('Date and title are required!', 'error');
        return;
    }
    
    try {
        const url = id ? '/api/holidays/' + id : '/api/holidays';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, title, type, description })
        });
        
        const data = await res.json();
        
        if (data.success) {
            showNotification(id ? 'Holiday updated!' : 'Holiday added!', 'success');
            closeHolidayModal();
            loadHolidaysForDate();
        } else {
            showNotification(data.message || 'Error saving holiday!', 'error');
        }
    } catch (e) {
        showNotification('Error saving holiday!', 'error');
    }
}

// Exam Calendar Management Functions
async function createScheduleFromCalendar(examId) {
    try {
        const res = await fetch('/api/exam-calendar');
        const data = await res.json();
        
        if (data.success && data.examCalendar) {
            const exam = data.examCalendar.find(e => e.id === examId);
            if (!exam) {
                showNotification('Exam not found!', 'error');
                return;
            }
            
            const scheduleData = {
                exam: exam.title,
                course: exam.course || 'All',
                batch: exam.batch || 'All',
                date: exam.date,
                time: exam.time || '09:00',
                duration: 60,
                totalMarks: 100,
                venue: 'TBA',
                status: 'Scheduled',
                description: exam.description || ''
            };
            
            const res = await fetch('/api/exam-schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduleData)
            });
            
            const result = await res.json();
            
            if (result.success) {
                showNotification('Schedule created successfully!', 'success');
                loadExamScheduleTable();
            } else {
                showNotification('Error creating schedule!', 'error');
            }
        }
    } catch (e) {
        console.error('Error creating schedule:', e);
        showNotification('Error creating schedule!', 'error');
    }
}

async function loadExamCalendarTable() {
    try {
        const res = await fetch('/api/exam-calendar');
        const data = await res.json();
        const tbody = document.querySelector('#examCalendarTable tbody');
        if (!tbody) {
            console.error('Table body not found!');
            return;
        }
        let html = '';
        data.examCalendar.forEach(exam => {
            html += '<tr>';
            html += '<td><input type="checkbox" class="exam-checkbox" data-id="' + exam.id + '"></td>';
            html += '<td>' + exam.date + '</td>';
            html += '<td>' + (exam.time || '-') + '</td>';
            html += '<td><strong>' + exam.title + '</strong></td>';
            html += '<td>' + (exam.course || 'All') + '</td>';
            html += '<td>' + (exam.batch || 'All') + '</td>';
            html += '<td>' + (exam.description || '-') + '</td>';
            html += '<td>';
            html += '<button class="btn btn-warning" onclick="editExam(' + exam.id + ')" style="padding:4px 8px;font-size:12px;margin-right:4px;">Edit</button>';
            html += '<button class="btn btn-primary" onclick="createScheduleFromCalendar(' + exam.id + ')" style="padding:4px 8px;font-size:12px;margin-right:4px;">Create Schedule</button>';
            html += '<button class="btn btn-secondary" onclick="deleteExam(' + exam.id + ')" style="padding:4px 8px;font-size:12px;">Delete</button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
        console.log('Exam calendar loaded successfully');
    } catch (e) {
        console.error('Error loading exam calendar:', e);
    }
}

function toggleAllExamCheckboxes() {
    const selectAll = document.getElementById('selectAllExams').checked;
    const checkboxes = document.querySelectorAll('.exam-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedExams() {
    const checkboxes = document.querySelectorAll('.exam-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one exam to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} exam(s)?`)) return;
    
    const examIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const examId of examIds) {
            const res = await fetch('/api/exam-calendar/' + examId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === examIds.length) {
            showNotification(`${deletedCount} exam(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${examIds.length} exam(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllExams').checked = false;
        loadExamCalendarTable();
    } catch (e) {
        console.error('Error deleting exams:', e);
        showNotification('Error deleting exams', 'error');
    }
}

function openExamModal() {
    document.getElementById('examModalTitle').textContent = 'Add Exam';
    document.getElementById('examId').value = '';
    document.getElementById('examTitle').value = '';
    document.getElementById('examModalDate').value = '';
    document.getElementById('examTime').value = '';
    document.getElementById('examCourse').value = '';
    document.getElementById('examBatch').value = '';
    document.getElementById('examDescription').value = '';
    document.getElementById('autoCreateSchedule').checked = false;
    document.getElementById('examModal').style.display = 'block';
    
    // Load courses
    fetch('/api/courses').then(r => r.json()).then(courses => {
        const courseSelect = document.getElementById('examCourse');
        courseSelect.innerHTML = '<option value="">All Courses</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
    });
}

async function editExam(examId) {
    try {
        const res = await fetch('/api/exam-calendar');
        const data = await res.json();
        const exam = data.examCalendar.find(e => e.id == examId);
        
        if (!exam) {
            showNotification('Exam not found', 'error');
            return;
        }
        
        document.getElementById('examModalTitle').textContent = 'Edit Exam';
        document.getElementById('examId').value = exam.id;
        document.getElementById('examTitle').value = exam.title || '';
        document.getElementById('examModalDate').value = exam.date || '';
        document.getElementById('examTime').value = exam.time || '';
        document.getElementById('examDescription').value = exam.description || '';
        document.getElementById('autoCreateSchedule').checked = false;
        
        // Load courses and select the current one
        fetch('/api/courses').then(r => r.json()).then(courses => {
            const courseSelect = document.getElementById('examCourse');
            courseSelect.innerHTML = '<option value="">All Courses</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
            courseSelect.value = exam.course || '';
        });
        
        document.getElementById('examModal').style.display = 'block';
    } catch (e) {
        console.error('Error loading exam:', e);
        showNotification('Error loading exam', 'error');
    }
}

function closeExamModal() {
    document.getElementById('examModal').style.display = 'none';
}

async function saveExam() {
    const examId = document.getElementById('examId').value;
    const title = document.getElementById('examTitle').value;
    const date = document.getElementById('examModalDate').value;
    const time = document.getElementById('examTime').value;
    const course = document.getElementById('examCourse').value;
    const batch = document.getElementById('examBatch').value;
    const description = document.getElementById('examDescription').value;
    const autoCreateSchedule = document.getElementById('autoCreateSchedule').checked;
    
    console.log('saveExam called with:', { examId, title, date, time, course, batch, description, autoCreateSchedule });
    
    if (!title || title.trim() === '') {
        showNotification('Title is required!', 'error');
        return;
    }
    
    if (!date || date.trim() === '') {
        showNotification('Date is required!', 'error');
        return;
    }
    
    try {
        let res, data;
        
        if (examId) {
            // Update existing exam
            res = await fetch('/api/exam-calendar/' + examId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, date, time, course, batch, description })
            });
            data = await res.json();
            
            if (data.success) {
                showNotification('Exam updated!', 'success');
            }
        } else {
            // Add new exam
            res = await fetch('/api/exam-calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, date, time, course, batch, description })
            });
            data = await res.json();
            
            if (data.success) {
                showNotification('Exam added!', 'success');
            }
        }
        
        console.log('Response status:', res.status);
        console.log('Response data:', data);
        
        if (data.success) {
            closeExamModal();
            loadExamCalendarTable();
            
            if (!examId && autoCreateSchedule) {
                const scheduleData = {
                    exam: title,
                    course: course || 'All',
                    batch: batch || 'All',
                    date: date,
                    time: time || '09:00',
                    duration: 60,
                    totalMarks: 100,
                    venue: 'TBA',
                    status: 'Scheduled',
                    description: description || ''
                };
                
                await fetch('/api/exam-schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(scheduleData)
                });
                
                loadExamScheduleTable();
                showNotification('Schedule created automatically!', 'success');
            }
        } else {
            showNotification(data.message || 'Error adding exam!', 'error');
        }
    } catch (e) {
        console.error('Error saving exam:', e);
        showNotification('Error adding exam!', 'error');
    }
}

async function deleteExam(examId) {
    if (!confirm('Are you sure you want to delete this exam?')) return;
    
    try {
        const res = await fetch('/api/exam-calendar/' + examId, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Exam deleted!', 'success');
            loadExamCalendarTable();
        } else {
            showNotification('Error deleting exam!', 'error');
        }
    } catch (e) {
        showNotification('Error deleting exam!', 'error');
    }
}

// Holidays Management Functions
async function loadHolidaysTable() {
    try {
        const res = await fetch('/api/holidays');
        const data = await res.json();
        
        if (data.success && data.holidays) {
            const tbody = document.querySelector('#holidaysTable tbody');
            tbody.innerHTML = data.holidays.map(holiday => {
                let html = '';
                html += '<tr>';
                html += '<td><input type="checkbox" class="holiday-checkbox" data-id="' + holiday.id + '"></td>';
                html += '<td>' + holiday.date + '</td>';
                html += '<td><strong>' + holiday.title + '</strong></td>';
                html += '<td>' + (holiday.type || 'General') + '</td>';
                html += '<td>' + (holiday.description || '-') + '</td>';
                html += '<td>';
                html += '<button class="btn btn-secondary" onclick="deleteHoliday(' + holiday.id + ')" style="padding:4px 8px;font-size:12px;">Delete</button>';
                html += '</td>';
                html += '</tr>';
                return html;
            }).join('');
        }
    } catch (e) {
        console.error('Error loading holidays:', e);
    }
}

function toggleAllHolidayCheckboxes() {
    const selectAll = document.getElementById('selectAllHolidays').checked;
    const checkboxes = document.querySelectorAll('.holiday-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedHolidays() {
    const checkboxes = document.querySelectorAll('.holiday-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one holiday to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} holiday(s)?`)) return;
    
    const holidayIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const holidayId of holidayIds) {
            const res = await fetch('/api/holidays/' + holidayId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === holidayIds.length) {
            showNotification(`${deletedCount} holiday(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${holidayIds.length} holiday(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllHolidays').checked = false;
        loadHolidaysTable();
    } catch (e) {
        console.error('Error deleting holidays:', e);
        showNotification('Error deleting holidays', 'error');
    }
}

async function deleteHoliday(holidayId) {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    
    try {
        const res = await fetch('/api/holidays/' + holidayId, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Holiday deleted!', 'success');
            loadHolidaysTable();
        } else {
            showNotification('Error deleting holiday!', 'error');
        }
    } catch (e) {
        showNotification('Error deleting holiday!', 'error');
    }
}

// Blog Management Functions
async function loadBlogTable() {
    try {
        const res = await fetch('/api/blogs');
        const data = await res.json();
        
        if (data.success && data.blogs) {
            const tbody = document.querySelector('#blogTable tbody');
            tbody.innerHTML = data.blogs.map(blog => {
                let html = '';
                html += '<tr>';
                html += '<td><input type="checkbox" class="blog-checkbox" data-id="' + blog.id + '"></td>';
                html += '<td><strong>' + blog.title + '</strong></td>';
                html += '<td>' + blog.category + '</td>';
                html += '<td>' + blog.author + '</td>';
                html += '<td>' + formatDate(blog.createdAt) + '</td>';
                html += '<td>' + (blog.published ? '<span style="color:#16a34a;font-weight:600;">Published</span>' : '<span style="color:#dc2626;font-weight:600;">Draft</span>') + '</td>';
                html += '<td>';
                html += '<button class="btn btn-secondary" onclick="deleteBlog(' + blog.id + ')" style="padding:4px 8px;font-size:12px;">Delete</button>';
                html += '</td>';
                html += '</tr>';
                return html;
            }).join('');
        }
    } catch (e) {
        console.error('Error loading blogs:', e);
    }
}

function toggleAllBlogPostCheckboxes() {
    const selectAll = document.getElementById('selectAllBlogPosts').checked;
    const checkboxes = document.querySelectorAll('.blog-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedBlogPosts() {
    const checkboxes = document.querySelectorAll('.blog-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one blog post to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} blog post(s)?`)) return;
    
    const blogIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const blogId of blogIds) {
            const res = await fetch('/api/blogs/' + blogId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === blogIds.length) {
            showNotification(`${deletedCount} blog post(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${blogIds.length} blog post(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllBlogPosts').checked = false;
        loadBlogTable();
    } catch (e) {
        console.error('Error deleting blog posts:', e);
        showNotification('Error deleting blog posts', 'error');
    }
}

function openBlogModal() {
    document.getElementById('blogModalTitle').textContent = 'Add Blog Post';
    document.getElementById('blogId').value = '';
    document.getElementById('blogTitle').value = '';
    document.getElementById('blogCategory').value = 'General';
    document.getElementById('blogAuthor').value = '';
    document.getElementById('blogContent').value = '';
    document.getElementById('blogModal').style.display = 'block';
}

function closeBlogModal() {
    document.getElementById('blogModal').style.display = 'none';
}

async function saveBlog() {
    const title = document.getElementById('blogTitle').value;
    const category = document.getElementById('blogCategory').value;
    const author = document.getElementById('blogAuthor').value;
    const content = document.getElementById('blogContent').value;
    
    if (!title || !content) {
        showNotification('Title and content are required!', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/blogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, author, content })
        });
        
        const data = await res.json();
        
        if (data.success) {
            showNotification('Blog post added!', 'success');
            closeBlogModal();
            loadBlogTable();
        } else {
            showNotification(data.message || 'Error saving blog!', 'error');
        }
    } catch (e) {
        showNotification('Error saving blog!', 'error');
    }
}

async function deleteBlog(blogId) {
    if (!confirm('Are you sure you want to delete this blog post?')) return;
    
    try {
        const res = await fetch('/api/blogs/' + blogId, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Blog post deleted!', 'success');
            loadBlogTable();
        } else {
            showNotification('Error deleting blog!', 'error');
        }
    } catch (e) {
        showNotification('Error deleting blog!', 'error');
    }
}

async function loadAttendanceTable() {
    try {
        const course = document.getElementById('attendanceCourse').value;
        const batch = document.getElementById('attendanceBatch').value;
        const date = document.getElementById('attendanceDate').value;
        
        if (!course) {
            // Clear if no course selected
            document.getElementById('attendanceStats').innerHTML = '';
            document.getElementById('attendanceTable').querySelector('tbody').innerHTML = '';
            return;
        }
        
        // Load batches for selected course
        const batches = await fetch('/api/batches?course=' + encodeURIComponent(course)).then(r => r.json());
        const batchSelect = document.getElementById('attendanceBatch');
        batchSelect.innerHTML = '<option value="">All Batches</option>' + batches.map(b => '<option value="' + b.name + '">' + b.name + '</option>').join('');
        
        // If batch was previously selected, restore the selection
        if (batch) {
            batchSelect.value = batch;
        }
        
        // Load students (course-wise, filtered by batch if selected)
        const res = await fetch('/api/students?course=' + encodeURIComponent(course) + '&batch=' + encodeURIComponent(batch || ''));
        const data = await res.json();
        const tbody = document.getElementById('attendanceTable').querySelector('tbody');
        
        const students = Array.isArray(data) ? data : (data.students || []);
        
        if (students.length > 0) {
            // Load existing attendance for this date
            const attendanceRes = await fetch('/api/attendance');
            const attendanceData = await attendanceRes.json();
            const attendanceMap = {};
            if (attendanceData.success && attendanceData.attendance) {
                attendanceData.attendance.forEach(a => {
                    if (a.date === date) {
                        attendanceMap[a.studentId] = a.status;
                    }
                });
            }
            
            tbody.innerHTML = students.map(s => {
                const attendanceId = attendanceMap[s.id] ? attendanceData.attendance.find(a => a.studentId == s.id && a.date === date)?.id : null;
                let html = '';
                html += '<tr>';
                html += '<td>' + s.rollNo + '</td>';
                html += '<td>' + s.name + '</td>';
                html += '<td>' + s.course + '</td>';
                html += '<td>' + (s.batch || '-') + '</td>';
                html += '<td>';
                html += '<select id="att_' + s.id + '" style="padding:6px;border-radius:4px;border:1px solid #e2e8f0;height:40px;">';
                html += '<option value="">Select Status</option>';
                html += '<option value="present" ' + (attendanceMap[s.id] === 'present' ? 'selected' : '') + '>Present</option>';
                html += '<option value="absent" ' + (attendanceMap[s.id] === 'absent' ? 'selected' : '') + '>Absent</option>';
                html += '<option value="late" ' + (attendanceMap[s.id] === 'late' ? 'selected' : '') + '>Late</option>';
                html += '</select>';
                html += '</td>';
                html += '<td>';
                html += '<button class="btn btn-primary" onclick="saveAttendance(\'' + s.id + '\', \'' + date + '\')">Save</button>';
                html += (attendanceId ? '<button class="btn" onclick="deleteAttendance(\'' + attendanceId + '\', \'' + date + '\')" style="padding:6px 12px;background:#fee2e2;color:#dc2626;margin-left:5px;">Delete</button>' : '');
                html += '</td>';
                html += '</tr>';
                return html;
            }).join('');
            
            // Calculate statistics
            const stats = {
                total: students.length,
                marked: Object.keys(attendanceMap).length,
                present: Object.values(attendanceMap).filter(s => s === 'present').length,
                absent: Object.values(attendanceMap).filter(s => s === 'absent').length,
                late: Object.values(attendanceMap).filter(s => s === 'late').length
            };
            
            let statsHtml = '';
            statsHtml += '<div style="background:#f0f9ff;padding:16px;border-radius:8px;text-align:center;">';
            statsHtml += '<div style="font-size:24px;font-weight:700;color:#2563eb;">' + stats.total + '</div>';
            statsHtml += '<div style="font-size:13px;color:#64748b;">Total Students</div>';
            statsHtml += '</div>';
            statsHtml += '<div style="background:#dcfce7;padding:16px;border-radius:8px;text-align:center;">';
            statsHtml += '<div style="font-size:24px;font-weight:700;color:#16a34a;">' + stats.present + '</div>';
            statsHtml += '<div style="font-size:13px;color:#64748b;">Present</div>';
            statsHtml += '</div>';
            statsHtml += '<div style="background:#fee2e2;padding:16px;border-radius:8px;text-align:center;">';
            statsHtml += '<div style="font-size:24px;font-weight:700;color:#dc2626;">' + stats.absent + '</div>';
            statsHtml += '<div style="font-size:13px;color:#64748b;">Absent</div>';
            statsHtml += '</div>';
            statsHtml += '<div style="background:#fef3c7;padding:16px;border-radius:8px;text-align:center;">';
            statsHtml += '<div style="font-size:24px;font-weight:700;color:#f59e0b;">' + stats.late + '</div>';
            statsHtml += '<div style="font-size:13px;color:#64748b;">Late</div>';
            statsHtml += '</div>';
            document.getElementById('attendanceStats').innerHTML = statsHtml;
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">No students found for this course/batch.</td></tr>';
            document.getElementById('attendanceStats').innerHTML = '';
        }
    } catch (e) {}
}

async function saveAttendance(studentId, date) {
    const status = document.getElementById('att_' + studentId).value;
    if (!status) return;
    
    const course = document.getElementById('attendanceCourse').value;
    const batch = document.getElementById('attendanceBatch').value;
    
    try {
        await fetch('/api/attendance', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ studentId, date, status, course, batch }) 
        });
        showNotification('Attendance saved!', 'success');
        loadAttendanceTable(); // Refresh to update stats
    } catch (e) { showNotification('Error!', 'error'); }
}

async function deleteAttendance(attendanceId, date) {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    
    try {
        const res = await fetch('/api/attendance/' + attendanceId, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Attendance deleted successfully!', 'success');
            loadAttendanceTable(); // Refresh to update stats
        } else {
            showNotification('Error deleting attendance!', 'error');
        }
    } catch (e) { 
        showNotification('Error deleting attendance!', 'error');
    }
}

async function markAllPresent() {
    const course = document.getElementById('attendanceCourse').value;
    const batch = document.getElementById('attendanceBatch').value;
    const date = document.getElementById('attendanceDate').value;
    
    if (!course || !date) {
        showNotification('Please select course and date!', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/students?course=' + encodeURIComponent(course) + '&batch=' + encodeURIComponent(batch || ''));
        const students = await res.json();
        
        if (students && students.length > 0) {
            let savedCount = 0;
            for (const student of students) {
                await fetch('/api/attendance', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ studentId: student.id, date, status: 'present' }) 
                });
                savedCount++;
            }
            showNotification('Marked ' + savedCount + ' students as present!', 'success');
            loadAttendanceTable();
        }
    } catch (e) { showNotification('Error marking attendance!', 'error'); }
}

async function downloadAttendanceReport() {
    const course = document.getElementById('attendanceCourse').value;
    const batch = document.getElementById('attendanceBatch').value;
    const date = document.getElementById('attendanceDate').value;
    
    if (!course || !date) {
        showNotification('Please select course and date!', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/students?course=' + encodeURIComponent(course) + '&batch=' + encodeURIComponent(batch || ''));
        const students = await res.json();
        const attendanceRes = await fetch('/api/attendance');
        const attendanceData = await attendanceRes.json();
        
        if (students && students.length > 0) {
            const attendanceMap = {};
            if (attendanceData && attendanceData.attendance) {
                attendanceData.attendance.forEach(a => {
                    if (a.date === date) {
                        attendanceMap[a.studentId] = a.status;
                    }
                });
            }
            
            let csv = 'Roll No,Name,Course,Batch,Status\n';
            students.forEach(s => {
                const status = attendanceMap[s.id] || 'Not Marked';
                csv += s.rollNo + ',"' + s.name + '",' + s.course + ',' + (s.batch || '-') + ',' + status + '\n';
            });
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'attendance_' + course + '_' + date + '.csv';
            a.click();
            window.URL.revokeObjectURL(url);
            showNotification('Attendance report downloaded!', 'success');
        }
    } catch (e) { showNotification('Error downloading report!', 'error'); }
}

async function saveAllAttendance() {
    const course = document.getElementById('attendanceCourse').value;
    const batch = document.getElementById('attendanceBatch').value;
    const date = document.getElementById('attendanceDate').value;
    
    if (!course || !date) {
        showNotification('Please select course and date!', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/students?course=' + encodeURIComponent(course) + '&batch=' + encodeURIComponent(batch || ''));
        const students = await res.json();
        
        if (students && students.length > 0) {
            let savedCount = 0;
            let errorCount = 0;
            
            for (const student of students) {
                const status = document.getElementById('att_' + student.id).value;
                if (status) {
                    await fetch('/api/attendance', { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ studentId: student.id, date, status }) 
                    });
                    savedCount++;
                } else {
                    errorCount++;
                }
            }
            
            showNotification('Saved ' + savedCount + ' attendance records! ' + errorCount + ' unmarked.', 'success');
            loadAttendanceTable();
        }
    } catch (e) { showNotification('Error saving attendance!', 'error'); }
}

// ===== Study Materials =====
async function loadStudyMaterialsTable() {
    try {
        const res = await fetch('/api/study-materials');
        const data = await res.json();
        const tbody = document.getElementById('studyMaterialsTable').querySelector('tbody');
        if (data.success && data.materials) {
            tbody.innerHTML = data.materials.map(m => {
                let html = '';
                html += '<tr>';
                html += '<td><input type="checkbox" class="study-material-checkbox" data-id="' + m.id + '"></td>';
                html += '<td><strong>' + m.title + '</strong></td>';
                html += '<td>' + m.course + '</td>';
                html += '<td>' + (m.category || 'General') + '</td>';
                html += '<td>' + m.type.toUpperCase() + '</td>';
                html += '<td>' + (m.author || 'Admin') + '</td>';
                html += '<td>' + (m.viewCount || 0) + '</td>';
                html += '<td>' + (m.downloadCount || 0) + '</td>';
                html += '<td>';
                html += '<button class="btn" onclick="deleteStudyMaterial(\'' + m.id + '\')"><i class="fas fa-trash"></i></button>';
                html += '</td>';
                html += '</tr>';
                return html;
            }).join('');
        }
    } catch (e) {}
}

function toggleAllStudyMaterialCheckboxes() {
    const selectAll = document.getElementById('selectAllStudyMaterials').checked;
    const checkboxes = document.querySelectorAll('.study-material-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedStudyMaterials() {
    const checkboxes = document.querySelectorAll('.study-material-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one study material to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} study material(s)?`)) return;
    
    const materialIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const materialId of materialIds) {
            const res = await fetch('/api/study-materials/' + materialId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === materialIds.length) {
            showNotification(`${deletedCount} study material(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${materialIds.length} study material(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllStudyMaterials').checked = false;
        loadStudyMaterialsTable();
    } catch (e) {
        console.error('Error deleting study materials:', e);
        showNotification('Error deleting study materials', 'error');
    }
}

function openStudyMaterialModal() {
    document.getElementById('studyMaterialModalTitle').textContent = 'Add Study Material';
    document.getElementById('materialId').value = '';
    document.getElementById('materialTitle').value = '';
    document.getElementById('materialFile').value = '';
    document.getElementById('materialDescription').value = '';
    document.getElementById('materialAuthor').value = '';
    document.getElementById('materialCategory').value = 'General';
    document.getElementById('materialDifficulty').value = 'Beginner';
    document.getElementById('materialTags').value = '';
    document.getElementById('materialBatch').value = '';
    document.getElementById('materialType').value = '';
    loadCoursesForMaterialModal();
    loadBatchesForMaterialModal();
    document.getElementById('studyMaterialModal').classList.add('active');
}

async function loadCoursesForMaterialModal() {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    const select = document.getElementById('materialCourse');
    select.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
}

async function loadBatchesForMaterialModal() {
    const res = await fetch('/api/batches');
    const batches = await res.json();
    const select = document.getElementById('materialBatch');
    select.innerHTML = '<option value="">All Batches</option>' + batches.map(b => '<option>' + b.name + '</option>').join('');
}

document.getElementById('studyMaterialForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    await saveStudyMaterial();
});

function updateMaterialFileInput() {
    const type = document.getElementById('materialType').value;
    const fileInput = document.getElementById('materialFile');
    
    const acceptTypes = {
        'pdf': '.pdf',
        'video': '.mp4,.avi,.mov,.mkv',
        'doc': '.doc,.docx,.ppt,.pptx,.txt',
        'image': '.jpg,.jpeg,.png,.gif,.bmp'
    };
    
    fileInput.accept = acceptTypes[type] || '*';
}

async function saveStudyMaterial() {
    try {
        const fileInput = document.getElementById('materialFile');
        const file = fileInput.files[0];
        
        if (!file) {
            showNotification('Please select a file', 'error');
            return;
        }
        
        const title = document.getElementById('materialTitle').value;
        const course = document.getElementById('materialCourse').value;
        const type = document.getElementById('materialType').value;
        
        if (!title || !course || !type) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('course', course);
        formData.append('type', type);
        formData.append('description', document.getElementById('materialDescription').value);
        formData.append('author', document.getElementById('materialAuthor').value);
        formData.append('category', document.getElementById('materialCategory').value);
        formData.append('difficulty', document.getElementById('materialDifficulty').value);
        formData.append('tags', document.getElementById('materialTags').value);
        formData.append('batch', document.getElementById('materialBatch').value);
        
        const res = await fetch('/api/study-materials', { 
            method: 'POST', 
            body: formData 
        });
        const result = await res.json();
        
        if (result.success) {
            closeModal('studyMaterialModal');
            loadStudyMaterialsTable();
            showNotification('Material added!', 'success');
        } else {
            showNotification('Error adding material: ' + (result.message || 'Unknown error'), 'error');
        }
    } catch (e) { 
        console.error('Error:', e);
        showNotification('Error: ' + e.message, 'error'); 
    }
}

async function deleteStudyMaterial(id) {
    if (!confirm('Delete this material?')) return;
    try {
        await fetch('/api/study-materials/' + id, { method: 'DELETE' });
        loadStudyMaterialsTable();
        showNotification('Material deleted!', 'success');
    } catch (e) { showNotification('Error!', 'error'); }
}

// ===== Videos (Video Learning Platform) =====
async function loadVideosTable() {
    try {
        const res = await fetch('/api/videos');
        const videos = await res.json();
        const tbody = document.getElementById('videosTable').querySelector('tbody');

        if (videos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;">No videos found</td></tr>';
            return;
        }

        const [courses, chapters] = await Promise.all([
            fetch('/api/courses').then(r => r.json()),
            fetch('/api/chapters').then(r => r.json())
        ]);
        const courseMap = {};
        courses.forEach(c => courseMap[c.id] = c.name);
        const chapterMap = {};
        chapters.forEach(ch => chapterMap[ch.id] = ch.name);

        tbody.innerHTML = videos.map(v => {
            let html = '';
            html += '<tr>';
            html += '<td><input type="checkbox" class="video-checkbox" data-id="' + v.id + '"></td>';
            html += '<td>' + (v.thumbnail ? '<img src="' + v.thumbnail + '" style="width:60px;height:40px;object-fit:cover;border-radius:4px;">' : '<span style="color:#94a3b8;">No thumbnail</span>') + '</td>';
            html += '<td><strong>' + v.title + '</strong></td>';
            html += '<td>' + (courseMap[v.courseId] || 'N/A') + '</td>';
            html += '<td>' + (chapterMap[v.chapterId] || '-') + '</td>';
            html += '<td>' + v.category + '</td>';
            html += '<td>' + (v.duration ? v.duration + ' min' : '-') + '</td>';
            html += '<td>' + v.views + '</td>';
            const scheduleText = (v.availabilityStart || v.availabilityEnd)
                ? [
                    v.availabilityStart ? ('From: ' + formatDateTime(v.availabilityStart)) : '',
                    v.availabilityEnd ? ('To: ' + formatDateTime(v.availabilityEnd)) : ''
                ].filter(Boolean).join('<br>')
                : '-';
            html += '<td style="font-size:12px;line-height:1.4;">' + scheduleText + '</td>';
            html += '<td>' + ((v.expiryDays || 0) > 0 ? (v.expiryDays + ' day(s)') : 'No expiry') + '</td>';
            html += '<td>' + (v.enforceSingleSession ? '<span style="color:#dc2626;font-weight:600;">Yes</span>' : '<span style="color:#16a34a;">No</span>') + '</td>';
            html += '<td style="font-size:12px;line-height:1.35;">' + (v.lastNotifiedAt ? ('<span title="' + esc(v.lastNotifiedAt) + '">' + formatDateTime(v.lastNotifiedAt) + '</span><br><span style="color:#64748b;">' + (v.lastNotificationSent || 0) + ' sent</span>') : '<span style="color:#94a3b8;">Never</span>') + '</td>';
            html += '<td>' + formatDate(v.uploadedAt) + '</td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editVideo(' + v.id + ')">Edit</button>';
            html += '<button class="action-btn" style="background:#8b5cf6;color:#fff;" onclick="openQuizManager(' + v.id + ',\'' + (v.title || '').replace(/\'/g, "\\'") + '\')">Quiz</button>';
            html += '<button class="action-btn" style="background:#10b981;color:#fff;" onclick="openResourcesManager(' + v.id + ',\'' + (v.title || '').replace(/\'/g, "\\'") + '\')">Files</button>';
            html += '<button class="action-btn" style="background:#0ea5e9;color:#fff;" onclick="openHotspotManager(' + v.id + ',\'' + (v.title || '').replace(/\'/g, "\\'") + '\')">Hotspots</button>';
            html += '<button class="action-btn" style="background:#f59e0b;color:#fff;" onclick="notifyVideoAvailability(' + v.id + ')">Notify</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteVideo(' + v.id + ')">Delete</button>';
            html += '</td>';
            html += '</tr>';
            return html;
        }).join('');
    } catch (e) {
        console.error('Error loading videos:', e);
        showNotification('Error loading videos', 'error');
    }
}

function openVideoModal() {
    document.getElementById('videoModalTitle').textContent = 'Add Video';
    document.getElementById('videoId').value = '';
    document.getElementById('videoTitle').value = '';
    document.getElementById('videoDescription').value = '';
    document.getElementById('videoUrl').value = '';
    document.getElementById('videoThumbnail').value = '';
    document.getElementById('videoDuration').value = '';
    document.getElementById('videoCategory').value = 'General';
    document.getElementById('videoSubtitleUrl').value = '';
    document.getElementById('videoWatermarkText').value = '';
    document.getElementById('videoAvailabilityStart').value = '';
    document.getElementById('videoAvailabilityEnd').value = '';
    document.getElementById('videoExpiryDays').value = '0';
    document.getElementById('videoSingleSession').checked = false;
    document.getElementById('videoFile').value = '';
    document.getElementById('thumbnailFile').value = '';
    document.getElementById('videoChapter').innerHTML = '<option value="">No Chapter</option>';
    document.getElementById('thumbnailPreview').style.display = 'none';
    document.getElementById('thumbnailPreviewImg').src = '';
    loadCoursesForVideoModal();
    document.getElementById('videoModal').classList.add('active');
}

function validateThumbnail(input) {
    const preview = document.getElementById('thumbnailPreview');
    const img = document.getElementById('thumbnailPreviewImg');
    const resText = document.getElementById('thumbnailResText');
    const file = input.files[0];
    
    // Clear previous validation state
    input.dataset.invalid = 'false';
    input.setCustomValidity('');

    if (!file) { preview.style.display = 'none'; return; }
    
    if (!file.type.startsWith('image/')) {
        preview.style.display = 'none';
        input.dataset.invalid = 'true';
        showNotification('Invalid thumbnail image file!', 'error');
        return;
    }

    const image = new Image();
    image.onload = function() {
        const w = this.naturalWidth, h = this.naturalHeight, ratio = w / h;
        img.src = this.src;
        preview.style.display = 'block';
        let msg = w + ' x ' + h + ' px';
        if (w < 640 || h < 360) { 
            msg += ' — <span style="color:#eab308">Warning: Too small. Min 640x360 recommended.</span>'; 
        }
        else if (ratio < 1.6 || ratio > 1.86) { 
            msg += ' — <span style="color:#eab308">Warning: Not 16:9 ratio.</span>'; 
        }
        else { 
            msg += ' — <span style="color:#16a34a">Perfect (16:9)</span>'; 
        }
        resText.innerHTML = msg;
    };
    image.onerror = function() { 
        preview.style.display = 'none'; 
        input.dataset.invalid = 'true'; 
        showNotification('Invalid thumbnail image file!', 'error');
    };
    image.src = URL.createObjectURL(file);
}

async function loadCoursesForVideoModal() {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    const select = document.getElementById('videoCourse');
    select.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('');
    // Also populate chapter course filter
    const filterSelect = document.getElementById('chapterCourseFilter');
    if (filterSelect) {
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Courses</option>' + courses.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('');
        filterSelect.value = currentVal;
    }
}

async function loadChaptersForVideoModal() {
    const courseId = document.getElementById('videoCourse').value;
    const select = document.getElementById('videoChapter');
    if (!courseId) {
        select.innerHTML = '<option value="">No Chapter</option>';
        return;
    }
    try {
        const res = await fetch('/api/chapters?courseId=' + courseId);
        const chapters = await res.json();
        select.innerHTML = '<option value="">No Chapter</option>' + chapters.map(ch => '<option value="' + ch.id + '">' + ch.name + '</option>').join('');
    } catch (e) {
        select.innerHTML = '<option value="">No Chapter</option>';
    }
}

async function saveVideo() {
    const videoId = document.getElementById('videoId').value;
    const videoFile = document.getElementById('videoFile').files[0];
    const thumbInput = document.getElementById('thumbnailFile');
    const thumbFile = thumbInput.files[0];
    const thumbUrl = document.getElementById('videoThumbnail').value.trim();
    const videoUrl = document.getElementById('videoUrl').value.trim();

    // Only check invalid state if a file is actually selected
    if (thumbFile && thumbInput.dataset.invalid === 'true') {
        showNotification('Please provide a valid thumbnail image.', 'error');
        return;
    }

    // Validate required fields
    const title = document.getElementById('videoTitle').value.trim();
    const courseId = document.getElementById('videoCourse').value;
    if (!title) {
        showNotification('Video title is required.', 'error');
        return;
    }
    if (!courseId) {
        showNotification('Course is required.', 'error');
        return;
    }
    if (!videoFile && !videoUrl) {
        showNotification('Please provide a video file or video URL.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', document.getElementById('videoDescription').value);
    formData.append('courseId', courseId);
    formData.append('chapterId', document.getElementById('videoChapter').value);
    formData.append('category', document.getElementById('videoCategory').value);
    formData.append('videoUrl', videoUrl);
    formData.append('duration', document.getElementById('videoDuration').value);
    formData.append('subtitleUrl', document.getElementById('videoSubtitleUrl').value);
    formData.append('watermarkText', document.getElementById('videoWatermarkText').value);
    formData.append('availabilityStart', document.getElementById('videoAvailabilityStart').value);
    formData.append('availabilityEnd', document.getElementById('videoAvailabilityEnd').value);
    formData.append('expiryDays', document.getElementById('videoExpiryDays').value || '0');
    formData.append('enforceSingleSession', document.getElementById('videoSingleSession').checked ? 'true' : 'false');

    if (videoFile) {
        formData.append('video', videoFile);
    }

    if (thumbFile) {
        formData.append('thumbnail', thumbFile);
    } else if (thumbUrl) {
        formData.append('thumbnail', thumbUrl);
    }

    try {
        const url = videoId ? '/api/videos/' + videoId : '/api/videos';
        const method = videoId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            body: formData
        });

        const raw = await res.text();
        let data = null;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (parseErr) {
            data = null;
        }

        if (!res.ok) {
            const msg = (data && data.message) || (data && data.error) || ('Upload failed (HTTP ' + res.status + ')');
            showNotification(msg, 'error');
            return;
        }

        if (data && data.success) {
            closeModal('videoModal');
            loadVideosTable();
            showNotification(videoId ? 'Video updated!' : 'Video added!', 'success');
        } else {
            showNotification((data && data.message) || 'Error saving video!', 'error');
        }
    } catch (e) {
        console.error('Error saving video:', e);
        showNotification('Error saving video!', 'error');
    }
}

async function editVideo(id) {
    try {
        const res = await fetch('/api/videos/' + id);
        const video = await res.json();

        const toDateTimeLocal = (value) => {
            if (!value) return '';
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return '';
            const pad = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        document.getElementById('videoModalTitle').textContent = 'Edit Video';
        document.getElementById('videoId').value = video.id;
        document.getElementById('videoTitle').value = video.title;
        document.getElementById('videoDescription').value = video.description || '';
        document.getElementById('videoUrl').value = video.videoUrl || '';
        document.getElementById('videoThumbnail').value = video.thumbnail || '';
        document.getElementById('videoDuration').value = video.duration || '';
        document.getElementById('videoCategory').value = video.category || 'General';
        document.getElementById('videoSubtitleUrl').value = video.subtitleUrl || '';
        document.getElementById('videoWatermarkText').value = video.watermarkText || '';
        document.getElementById('videoAvailabilityStart').value = toDateTimeLocal(video.availabilityStart);
        document.getElementById('videoAvailabilityEnd').value = toDateTimeLocal(video.availabilityEnd);
        document.getElementById('videoExpiryDays').value = video.expiryDays || 0;
        document.getElementById('videoSingleSession').checked = !!video.enforceSingleSession;
        document.getElementById('thumbnailFile').value = '';
        const preview = document.getElementById('thumbnailPreview');
        const img = document.getElementById('thumbnailPreviewImg');
        if (video.thumbnail) {
            img.src = video.thumbnail;
            preview.style.display = 'block';
            document.getElementById('thumbnailResText').textContent = 'Current thumbnail (upload new to replace)';
        } else {
            preview.style.display = 'none';
            img.src = '';
        }

        loadCoursesForVideoModal().then(async () => {
            document.getElementById('videoCourse').value = video.courseId || '';
            await loadChaptersForVideoModal();
            document.getElementById('videoChapter').value = video.chapterId || '';
        });

        document.getElementById('videoModal').classList.add('active');
    } catch (e) {
        console.error('Error loading video:', e);
        showNotification('Error loading video!', 'error');
    }
}

async function deleteVideo(id) {
    if (!confirm('Delete this video?')) return;
    try {
        await fetch('/api/videos/' + id, { method: 'DELETE' });
        loadVideosTable();
        loadChaptersTable();
        showNotification('Video deleted!', 'success');
    } catch (e) {
        console.error('Error deleting video:', e);
        showNotification('Error deleting video!', 'error');
    }
}

// ===== Chapters =====
async function loadChaptersTable() {
    try {
        const courseFilter = document.getElementById('chapterCourseFilter');
        const courseId = courseFilter ? courseFilter.value : '';
        const url = courseId ? '/api/chapters?courseId=' + courseId : '/api/chapters';
        const res = await fetch(url);
        const chapters = await res.json();
        const tbody = document.getElementById('chaptersTable').querySelector('tbody');

        if (chapters.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No chapters found</td></tr>';
            return;
        }

        const [courses, videos] = await Promise.all([
            fetch('/api/courses').then(r => r.json()),
            fetch('/api/videos').then(r => r.json())
        ]);
        const courseMap = {};
        courses.forEach(c => courseMap[c.id] = c.name);

        tbody.innerHTML = chapters.map(ch => {
            const videoCount = videos.filter(v => v.chapterId == ch.id).length;
            return '<tr>' +
                '<td>' + ch.order + '</td>' +
                '<td><strong>' + ch.name + '</strong></td>' +
                '<td>' + (courseMap[ch.courseId] || 'N/A') + '</td>' +
                '<td>' + videoCount + '</td>' +
                '<td>' +
                '<button class="action-btn edit-btn" onclick="editChapter(' + ch.id + ')">Edit</button>' +
                '<button class="action-btn delete-btn" onclick="deleteChapter(' + ch.id + ')">Delete</button>' +
                '</td>' +
                '</tr>';
        }).join('');
    } catch (e) {
        console.error('Error loading chapters:', e);
    }
}

function openChapterModal() {
    document.getElementById('chapterModalTitle').textContent = 'Add Chapter';
    document.getElementById('chapterId').value = '';
    document.getElementById('chapterName').value = '';
    document.getElementById('chapterOrder').value = '1';
    loadCoursesForChapterModal();
    document.getElementById('chapterModal').classList.add('active');
}

async function loadCoursesForChapterModal() {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    const select = document.getElementById('chapterCourse');
    select.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('');
}

async function saveChapter() {
    const chapterId = document.getElementById('chapterId').value;
    const body = {
        courseId: document.getElementById('chapterCourse').value,
        name: document.getElementById('chapterName').value,
        order: parseInt(document.getElementById('chapterOrder').value) || 1
    };
    if (!body.courseId || !body.name) {
        showNotification('Course and name are required', 'error');
        return;
    }
    try {
        const url = chapterId ? '/api/chapters/' + chapterId : '/api/chapters';
        const method = chapterId ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            closeModal('chapterModal');
            loadChaptersTable();
            showNotification(chapterId ? 'Chapter updated!' : 'Chapter added!', 'success');
        } else {
            showNotification('Error saving chapter', 'error');
        }
    } catch (e) {
        console.error('Error saving chapter:', e);
        showNotification('Error saving chapter', 'error');
    }
}

async function editChapter(id) {
    try {
        const res = await fetch('/api/chapters');
        const chapters = await res.json();
        const chapter = chapters.find(c => c.id == id);
        if (!chapter) return;
        document.getElementById('chapterModalTitle').textContent = 'Edit Chapter';
        document.getElementById('chapterId').value = chapter.id;
        document.getElementById('chapterName').value = chapter.name;
        document.getElementById('chapterOrder').value = chapter.order;
        loadCoursesForChapterModal().then(() => {
            document.getElementById('chapterCourse').value = chapter.courseId || '';
        });
        document.getElementById('chapterModal').classList.add('active');
    } catch (e) {
        console.error('Error loading chapter:', e);
    }
}

async function deleteChapter(id) {
    if (!confirm('Delete this chapter? Videos in this chapter will become ungrouped.')) return;
    try {
        await fetch('/api/chapters/' + id, { method: 'DELETE' });
        loadChaptersTable();
        loadVideosTable();
        showNotification('Chapter deleted!', 'success');
    } catch (e) {
        console.error('Error deleting chapter:', e);
        showNotification('Error deleting chapter', 'error');
    }
}

function toggleAllVideoCheckboxes() {
    const selectAll = document.getElementById('selectAllVideos').checked;
    const checkboxes = document.querySelectorAll('.video-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedVideos() {
    const checkboxes = document.querySelectorAll('.video-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one video to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} video(s)?`)) return;
    
    const videoIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const videoId of videoIds) {
            const res = await fetch('/api/videos/' + videoId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === videoIds.length) {
            showNotification(`${deletedCount} video(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${videoIds.length} video(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllVideos').checked = false;
        loadVideosTable();
    } catch (e) {
        console.error('Error deleting videos:', e);
        showNotification('Error deleting videos', 'error');
    }
}

// ===== Assignments =====
async function loadAssignmentsTable() {
    try {
        const res = await fetch('/api/assignments');
        const assignments = await res.json();
        const tbody = document.getElementById('assignmentsTable').querySelector('tbody');
        
        if (assignments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No assignments found</td></tr>';
            return;
        }
        
        const courses = await fetch('/api/courses').then(r => r.json());
        const courseMap = {};
        courses.forEach(c => courseMap[c.id] = c.name);
        
        tbody.innerHTML = assignments.map(a => {
            let html = '';
            html += '<tr>';
            html += '<td><input type="checkbox" class="assignment-checkbox" data-id="' + a.id + '"></td>';
            html += '<td><strong>' + a.title + '</strong></td>';
            html += '<td>' + (courseMap[a.courseId] || 'N/A') + '</td>';
            html += '<td>' + a.target.charAt(0).toUpperCase() + a.target.slice(1) + '</td>';
            html += '<td>' + (a.dueDate ? formatDate(a.dueDate) : '-') + '</td>';
            html += '<td>' + (a.maxMarks || '-') + '</td>';
            html += '<td>' + (a.submissions ? a.submissions.length : 0) + '</td>';
            html += '<td>' + formatDate(a.createdAt) + '</td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editAssignment(' + a.id + ')">Edit</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteAssignment(' + a.id + ')">Delete</button>';
            html += '</td>';
            html += '</tr>';
            return html;
        }).join('');
    } catch (e) {
        console.error('Error loading assignments:', e);
        showNotification('Error loading assignments', 'error');
    }
}

function openAssignmentModal() {
    document.getElementById('assignmentModalTitle').textContent = 'Add Assignment';
    document.getElementById('assignmentId').value = '';
    document.getElementById('assignmentTitle').value = '';
    document.getElementById('assignmentDescription').value = '';
    document.getElementById('assignmentUrl').value = '';
    document.getElementById('assignmentDueDate').value = '';
    document.getElementById('assignmentMaxMarks').value = '';
    document.getElementById('assignmentTarget').value = 'all';
    document.getElementById('assignmentFile').value = '';
    loadCoursesForAssignmentModal();
    loadBatchesForAssignmentModal();
    loadStudentsForAssignmentModal();
    document.getElementById('assignmentModal').classList.add('active');
}

async function loadCoursesForAssignmentModal() {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    const select = document.getElementById('assignmentCourse');
    select.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('');
}

async function loadBatchesForAssignmentModal() {
    const res = await fetch('/api/batches');
    const batches = await res.json();
    const select = document.getElementById('assignmentBatch');
    select.innerHTML = '<option value="">All Batches</option>' + batches.map(b => '<option value="' + b.id + '">' + b.name + '</option>').join('');
}

async function loadStudentsForAssignmentModal() {
    const res = await fetch('/api/students');
    const students = await res.json();
    const select = document.getElementById('assignmentStudent');
    select.innerHTML = '<option value="">Select Student</option>' + students.map(s => '<option value="' + s.id + '">' + s.name + ' (' + s.rollNo + ')</option>').join('');
}

async function saveAssignment() {
    const assignmentId = document.getElementById('assignmentId').value;
    const assignmentFile = document.getElementById('assignmentFile').files[0];
    
    const formData = new FormData();
    formData.append('title', document.getElementById('assignmentTitle').value);
    formData.append('description', document.getElementById('assignmentDescription').value);
    formData.append('courseId', document.getElementById('assignmentCourse').value);
    formData.append('target', document.getElementById('assignmentTarget').value);
    formData.append('batchId', document.getElementById('assignmentBatch').value);
    formData.append('studentId', document.getElementById('assignmentStudent').value);
    formData.append('fileUrl', document.getElementById('assignmentUrl').value);
    formData.append('dueDate', document.getElementById('assignmentDueDate').value);
    formData.append('maxMarks', document.getElementById('assignmentMaxMarks').value);
    
    if (assignmentFile) {
        formData.append('file', assignmentFile);
    }
    
    try {
        const url = assignmentId ? '/api/assignments/' + assignmentId : '/api/assignments';
        const method = assignmentId ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            body: formData
        });
        
        const data = await res.json();
        
        if (data.success) {
            closeModal('assignmentModal');
            loadAssignmentsTable();
            showNotification(assignmentId ? 'Assignment updated!' : 'Assignment added!', 'success');
        } else {
            showNotification('Error saving assignment!', 'error');
        }
    } catch (e) {
        console.error('Error saving assignment:', e);
        showNotification('Error saving assignment!', 'error');
    }
}

async function editAssignment(id) {
    try {
        const res = await fetch('/api/assignments/' + id);
        const assignment = await res.json();
        
        document.getElementById('assignmentModalTitle').textContent = 'Edit Assignment';
        document.getElementById('assignmentId').value = assignment.id;
        document.getElementById('assignmentTitle').value = assignment.title;
        document.getElementById('assignmentDescription').value = assignment.description || '';
        document.getElementById('assignmentUrl').value = assignment.fileUrl || '';
        document.getElementById('assignmentDueDate').value = assignment.dueDate || '';
        document.getElementById('assignmentMaxMarks').value = assignment.maxMarks || '';
        document.getElementById('assignmentTarget').value = assignment.target || 'all';
        
        loadCoursesForAssignmentModal().then(() => {
            document.getElementById('assignmentCourse').value = assignment.courseId || '';
        });
        
        loadBatchesForAssignmentModal().then(() => {
            document.getElementById('assignmentBatch').value = assignment.batchId || '';
        });
        
        loadStudentsForAssignmentModal().then(() => {
            document.getElementById('assignmentStudent').value = assignment.studentId || '';
        });
        
        document.getElementById('assignmentModal').classList.add('active');
    } catch (e) {
        console.error('Error loading assignment:', e);
        showNotification('Error loading assignment!', 'error');
    }
}

async function deleteAssignment(id) {
    if (!confirm('Delete this assignment?')) return;
    try {
        await fetch('/api/assignments/' + id, { method: 'DELETE' });
        loadAssignmentsTable();
        showNotification('Assignment deleted!', 'success');
    } catch (e) {
        console.error('Error deleting assignment:', e);
        showNotification('Error deleting assignment!', 'error');
    }
}

function toggleAllAssignmentCheckboxes() {
    const selectAll = document.getElementById('selectAllAssignments').checked;
    const checkboxes = document.querySelectorAll('.assignment-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedAssignments() {
    const checkboxes = document.querySelectorAll('.assignment-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one assignment to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} assignment(s)?`)) return;
    
    const assignmentIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const assignmentId of assignmentIds) {
            const res = await fetch('/api/assignments/' + assignmentId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === assignmentIds.length) {
            showNotification(`${deletedCount} assignment(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${assignmentIds.length} assignment(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllAssignments').checked = false;
        loadAssignmentsTable();
    } catch (e) {
        console.error('Error deleting assignments:', e);
        showNotification('Error deleting assignments', 'error');
    }
}

// ===== Alumni =====
async function loadAlumniTable() {
    try {
        const res = await fetch('/api/alumni');
        const alumni = await res.json();
        const tbody = document.getElementById('alumniTable').querySelector('tbody');
        
        if (alumni.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No alumni found</td></tr>';
            return;
        }
        
        tbody.innerHTML = alumni.map(a => {
            let html = '';
            html += '<tr>';
            html += '<td><input type="checkbox" class="alumni-checkbox" data-id="' + a.id + '"></td>';
            html += '<td>' + (a.photo ? '<img src="' + a.photo + '" style="width:40px;height:40px;object-fit:cover;border-radius:50%;">' : '<span style="color:#94a3b8;">No photo</span>') + '</td>';
            html += '<td><strong>' + a.name + '</strong><br><small>' + a.email + '</small></td>';
            html += '<td>' + a.course + '</td>';
            html += '<td>' + a.batch + '</td>';
            html += '<td>' + a.graduationYear + '</td>';
            html += '<td>' + (a.currentCompany || '-') + '</td>';
            html += '<td>' + (a.designation || '-') + '</td>';
            html += '<td>' + (a.isVerified ? '<span style="color:green;">✓ Verified</span>' : '<span style="color:orange;">Pending</span>') + '</td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editAlumni(' + a.id + ')">Edit</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteAlumni(' + a.id + ')">Delete</button>';
            html += '</td>';
            html += '</tr>';
            return html;
        }).join('');
    } catch (e) {
        console.error('Error loading alumni:', e);
        showNotification('Error loading alumni', 'error');
    }
}

function openAlumniModal() {
    document.getElementById('alumniModalTitle').textContent = 'Add Alumni';
    document.getElementById('alumniId').value = '';
    document.getElementById('alumniName').value = '';
    document.getElementById('alumniEmail').value = '';
    document.getElementById('alumniPhone').value = '';
    document.getElementById('alumniGradYear').value = '';
    document.getElementById('alumniCompany').value = '';
    document.getElementById('alumniDesignation').value = '';
    document.getElementById('alumniLocation').value = '';
    document.getElementById('alumniLinkedin').value = '';
    document.getElementById('alumniBio').value = '';
    document.getElementById('alumniAchievements').value = '';
    document.getElementById('alumniPhoto').value = '';
    loadCoursesForAlumniModal();
    loadBatchesForAlumniModal();
    document.getElementById('alumniModal').classList.add('active');
}

async function loadCoursesForAlumniModal() {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    const select = document.getElementById('alumniCourse');
    select.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
}

async function loadBatchesForAlumniModal() {
    const res = await fetch('/api/batches');
    const batches = await res.json();
    const select = document.getElementById('alumniBatch');
    select.innerHTML = '<option value="">Select Batch</option>' + batches.map(b => '<option>' + b.name + '</option>').join('');
}

async function saveAlumni() {
    const alumniId = document.getElementById('alumniId').value;
    const alumniPhoto = document.getElementById('alumniPhoto').files[0];
    
    const formData = new FormData();
    formData.append('name', document.getElementById('alumniName').value);
    formData.append('email', document.getElementById('alumniEmail').value);
    formData.append('phone', document.getElementById('alumniPhone').value);
    formData.append('course', document.getElementById('alumniCourse').value);
    formData.append('batch', document.getElementById('alumniBatch').value);
    formData.append('graduationYear', document.getElementById('alumniGradYear').value);
    formData.append('currentCompany', document.getElementById('alumniCompany').value);
    formData.append('designation', document.getElementById('alumniDesignation').value);
    formData.append('location', document.getElementById('alumniLocation').value);
    formData.append('linkedin', document.getElementById('alumniLinkedin').value);
    formData.append('bio', document.getElementById('alumniBio').value);
    formData.append('achievements', document.getElementById('alumniAchievements').value);
    
    if (alumniPhoto) {
        formData.append('photo', alumniPhoto);
    }
    
    try {
        const url = alumniId ? '/api/alumni/' + alumniId : '/api/alumni';
        const method = alumniId ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            body: formData
        });
        
        const data = await res.json();
        
        if (data.success) {
            closeModal('alumniModal');
            loadAlumniTable();
            showNotification(alumniId ? 'Alumni updated!' : 'Alumni added!', 'success');
        } else {
            showNotification('Error saving alumni!', 'error');
        }
    } catch (e) {
        console.error('Error saving alumni:', e);
        showNotification('Error saving alumni!', 'error');
    }
}

async function editAlumni(id) {
    try {
        const res = await fetch('/api/alumni/' + id);
        const alumnus = await res.json();
        
        document.getElementById('alumniModalTitle').textContent = 'Edit Alumni';
        document.getElementById('alumniId').value = alumnus.id;
        document.getElementById('alumniName').value = alumnus.name;
        document.getElementById('alumniEmail').value = alumnus.email;
        document.getElementById('alumniPhone').value = alumnus.phone || '';
        document.getElementById('alumniGradYear').value = alumnus.graduationYear;
        document.getElementById('alumniCompany').value = alumnus.currentCompany || '';
        document.getElementById('alumniDesignation').value = alumnus.designation || '';
        document.getElementById('alumniLocation').value = alumnus.location || '';
        document.getElementById('alumniLinkedin').value = alumnus.linkedin || '';
        document.getElementById('alumniBio').value = alumnus.bio || '';
        document.getElementById('alumniAchievements').value = alumnus.achievements ? alumnus.achievements.join(', ') : '';
        
        loadCoursesForAlumniModal().then(() => {
            document.getElementById('alumniCourse').value = alumnus.course || '';
        });
        
        loadBatchesForAlumniModal().then(() => {
            document.getElementById('alumniBatch').value = alumnus.batch || '';
        });
        
        document.getElementById('alumniModal').classList.add('active');
    } catch (e) {
        console.error('Error loading alumni:', e);
        showNotification('Error loading alumni!', 'error');
    }
}

async function deleteAlumni(id) {
    if (!confirm('Delete this alumni?')) return;
    try {
        await fetch('/api/alumni/' + id, { method: 'DELETE' });
        loadAlumniTable();
        showNotification('Alumni deleted!', 'success');
    } catch (e) {
        console.error('Error deleting alumni:', e);
        showNotification('Error deleting alumni!', 'error');
    }
}

async function verifyAlumni(id, isVerified) {
    try {
        await fetch('/api/alumni/' + id + '/verify', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isVerified })
        });
        loadAlumniTable();
        showNotification(isVerified ? 'Alumni verified!' : 'Alumni unverified!', 'success');
    } catch (e) {
        console.error('Error verifying alumni:', e);
        showNotification('Error verifying alumni!', 'error');
    }
}

function toggleAllAlumniCheckboxes() {
    const selectAll = document.getElementById('selectAllAlumni').checked;
    const checkboxes = document.querySelectorAll('.alumni-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedAlumni() {
    const checkboxes = document.querySelectorAll('.alumni-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one alumni to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} alumni?`)) return;
    
    const alumniIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const alumniId of alumniIds) {
            const res = await fetch('/api/alumni/' + alumniId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === alumniIds.length) {
            showNotification(`${deletedCount} alumni deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${alumniIds.length} alumni deleted`, 'warning');
        }
        
        document.getElementById('selectAllAlumni').checked = false;
        loadAlumniTable();
    } catch (e) {
        console.error('Error deleting alumni:', e);
        showNotification('Error deleting alumni', 'error');
    }
}

// ===== Helpdesk/Tickets =====
async function loadTicketsTable() {
    try {
        const res = await fetch('/api/tickets');
        const tickets = await res.json();
        const tbody = document.getElementById('ticketsTable').querySelector('tbody');
        
        if (tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No tickets found</td></tr>';
            return;
        }
        
        tbody.innerHTML = tickets.map(t => {
            let html = '';
            html += '<tr>';
            html += '<td><input type="checkbox" class="ticket-checkbox" data-id="' + t.id + '"></td>';
            html += '<td><strong>' + t.subject + '</strong></td>';
            html += '<td>' + t.studentName + '</td>';
            html += '<td>' + t.category + '</td>';
            html += '<td>' + t.priority + '</td>';
            html += '<td>' + t.status + '</td>';
            html += '<td>' + formatDate(t.createdAt) + '</td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editTicket(' + t.id + ')">Edit</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteTicket(' + t.id + ')">Delete</button>';
            html += '</td>';
            html += '</tr>';
            return html;
        }).join('');
    } catch (e) {
        console.error('Error loading tickets:', e);
        showNotification('Error loading tickets', 'error');
    }
}

function openTicketModal() {
    document.getElementById('ticketModalTitle').textContent = 'Create Ticket';
    document.getElementById('ticketId').value = '';
    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketDescription').value = '';
    document.getElementById('ticketCategory').value = 'General';
    document.getElementById('ticketPriority').value = 'Medium';
    document.getElementById('ticketStatus').value = 'Open';
    document.getElementById('ticketAssignedTo').value = '';
    document.getElementById('ticketModal').classList.add('active');
}

async function saveTicket() {
    const ticketId = document.getElementById('ticketId').value;
    const data = {
        subject: document.getElementById('ticketSubject').value,
        description: document.getElementById('ticketDescription').value,
        category: document.getElementById('ticketCategory').value,
        priority: document.getElementById('ticketPriority').value,
        status: document.getElementById('ticketStatus').value,
        assignedTo: document.getElementById('ticketAssignedTo').value,
        studentId: 0,
        studentName: 'Admin',
        studentEmail: 'admin@genius.com'
    };
    
    try {
        const url = ticketId ? '/api/tickets/' + ticketId : '/api/tickets';
        const method = ticketId ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const responseData = await res.json();
        
        if (responseData.success) {
            closeModal('ticketModal');
            loadTicketsTable();
            showNotification(ticketId ? 'Ticket updated!' : 'Ticket created!', 'success');
        } else {
            showNotification('Error saving ticket!', 'error');
        }
    } catch (e) {
        console.error('Error saving ticket:', e);
        showNotification('Error saving ticket!', 'error');
    }
}

async function editTicket(id) {
    try {
        const res = await fetch('/api/tickets/' + id);
        const ticket = await res.json();
        
        document.getElementById('ticketModalTitle').textContent = 'Edit Ticket';
        document.getElementById('ticketId').value = ticket.id;
        document.getElementById('ticketSubject').value = ticket.subject;
        document.getElementById('ticketDescription').value = ticket.description;
        document.getElementById('ticketCategory').value = ticket.category;
        document.getElementById('ticketPriority').value = ticket.priority;
        document.getElementById('ticketStatus').value = ticket.status;
        document.getElementById('ticketAssignedTo').value = ticket.assignedTo || '';
        
        document.getElementById('ticketModal').classList.add('active');
    } catch (e) {
        console.error('Error loading ticket:', e);
        showNotification('Error loading ticket!', 'error');
    }
}

async function deleteTicket(id) {
    if (!confirm('Delete this ticket?')) return;
    try {
        await fetch('/api/tickets/' + id, { method: 'DELETE' });
        loadTicketsTable();
        showNotification('Ticket deleted!', 'success');
    } catch (e) {
        console.error('Error deleting ticket:', e);
        showNotification('Error deleting ticket!', 'error');
    }
}

function toggleAllTicketCheckboxes() {
    const selectAll = document.getElementById('selectAllTickets').checked;
    const checkboxes = document.querySelectorAll('.ticket-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedTickets() {
    const checkboxes = document.querySelectorAll('.ticket-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one ticket to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} ticket(s)?`)) return;
    
    const ticketIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const ticketId of ticketIds) {
            const res = await fetch('/api/tickets/' + ticketId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === ticketIds.length) {
            showNotification(`${deletedCount} ticket(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${ticketIds.length} ticket(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllTickets').checked = false;
        loadTicketsTable();
    } catch (e) {
        console.error('Error deleting tickets:', e);
        showNotification('Error deleting tickets', 'error');
    }
}

// ===== Backup & Recovery =====
async function loadBackupsList() {
    try {
        const res = await fetch('/api/backup/list');
        const data = await res.json();
        const tbody = document.getElementById('backupsTable').querySelector('tbody');
        
        if (!data.success || data.backups.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No backups found</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.backups.map(b => {
            let html = '';
            html += '<tr>';
            html += '<td>' + b.filename + '</td>';
            html += '<td>' + b.sizeFormatted + '</td>';
            html += '<td>' + formatDate(b.created) + '</td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="restoreBackup(\'' + b.filename + '\')">Restore</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteBackup(\'' + b.filename + '\')">Delete</button>';
            html += '</td>';
            html += '</tr>';
            return html;
        }).join('');
    } catch (e) {
        console.error('Error loading backups:', e);
        showNotification('Error loading backups', 'error');
    }
}

async function createBackup() {
    try {
        showNotification('Creating backup... Please wait.', 'info');
        const res = await fetch('/api/backup/create');
        const data = await res.json();
        
        if (data.success) {
            showNotification('Backup created successfully!', 'success');
            loadBackupsList();
        } else {
            showNotification('Error creating backup: ' + data.message, 'error');
        }
    } catch (e) {
        console.error('Error creating backup:', e);
        showNotification('Error creating backup!', 'error');
    }
}

async function restoreBackup(filename) {
    if (!confirm('Are you sure you want to restore from this backup? This will overwrite existing data.')) return;
    
    try {
        showNotification('Restoring backup... Please wait.', 'info');
        const res = await fetch('/api/backup/restore/' + filename, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Backup restored successfully! Page will reload.', 'success');
            setTimeout(() => location.reload(), 2000);
        } else {
            showNotification('Error restoring backup: ' + data.message, 'error');
        }
    } catch (e) {
        console.error('Error restoring backup:', e);
        showNotification('Error restoring backup!', 'error');
    }
}

async function deleteBackup(filename) {
    if (!confirm('Delete this backup?')) return;
    
    try {
        const res = await fetch('/api/backup/' + filename, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Backup deleted successfully!', 'success');
            loadBackupsList();
        } else {
            showNotification('Error deleting backup: ' + data.message, 'error');
        }
    } catch (e) {
        console.error('Error deleting backup:', e);
        showNotification('Error deleting backup!', 'error');
    }
}

// ===== Roles & Permissions =====
async function loadRolesTable() {
    try {
        const res = await fetch('/api/roles');
        const roles = await res.json();
        const tbody = document.getElementById('rolesTable').querySelector('tbody');
        
        if (roles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No roles found</td></tr>';
            return;
        }
        
        tbody.innerHTML = roles.map(r => {
            let html = '';
            html += '<tr>';
            html += '<td><input type="checkbox" class="role-checkbox" data-id="' + r.id + '"></td>';
            html += '<td><strong>' + r.name + '</strong></td>';
            html += '<td>' + (r.description || '-') + '</td>';
            html += '<td>' + (r.permissions.includes('all') ? '<span style="color:green;">All Permissions</span>' : r.permissions.length + ' permissions') + '</td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editRole(' + r.id + ')">Edit</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteRole(' + r.id + ')">Delete</button>';
            html += '</td>';
            html += '</tr>';
            return html;
        }).join('');
    } catch (e) {
        console.error('Error loading roles:', e);
        showNotification('Error loading roles', 'error');
    }
}

async function openRoleModal() {
    document.getElementById('roleModalTitle').textContent = 'Add Role';
    document.getElementById('roleId').value = '';
    document.getElementById('roleName').value = '';
    document.getElementById('roleDescription').value = '';
    
    const permissionsRes = await fetch('/api/permissions');
    const permissions = await permissionsRes.json();
    
    const permissionsList = document.getElementById('permissionsList');
    permissionsList.innerHTML = permissions.map(p => {
        return '<label style="display:block;margin-bottom:5px;"><input type="checkbox" class="permission-checkbox" value="' + p.id + '"> ' + p.name + '</label>';
    }).join('');
    
    document.getElementById('roleModal').classList.add('active');
}

async function saveRole() {
    const roleId = document.getElementById('roleId').value;
    const selectedPermissions = Array.from(document.querySelectorAll('.permission-checkbox:checked')).map(cb => cb.value);
    
    const data = {
        name: document.getElementById('roleName').value,
        description: document.getElementById('roleDescription').value,
        permissions: selectedPermissions
    };
    
    try {
        const url = roleId ? '/api/roles/' + roleId : '/api/roles';
        const method = roleId ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const responseData = await res.json();
        
        if (responseData.success) {
            closeModal('roleModal');
            loadRolesTable();
            showNotification(roleId ? 'Role updated!' : 'Role added!', 'success');
        } else {
            showNotification('Error saving role!', 'error');
        }
    } catch (e) {
        console.error('Error saving role:', e);
        showNotification('Error saving role!', 'error');
    }
}

async function editRole(id) {
    try {
        const res = await fetch('/api/roles/' + id);
        const role = await res.json();
        
        document.getElementById('roleModalTitle').textContent = 'Edit Role';
        document.getElementById('roleId').value = role.id;
        document.getElementById('roleName').value = role.name;
        document.getElementById('roleDescription').value = role.description || '';
        
        const permissionsRes = await fetch('/api/permissions');
        const permissions = await permissionsRes.json();
        
        const permissionsList = document.getElementById('permissionsList');
        permissionsList.innerHTML = permissions.map(p => {
            const checked = role.permissions.includes(p.id) || role.permissions.includes('all') ? 'checked' : '';
            return '<label style="display:block;margin-bottom:5px;"><input type="checkbox" class="permission-checkbox" value="' + p.id + '" ' + checked + '> ' + p.name + '</label>';
        }).join('');
        
        document.getElementById('roleModal').classList.add('active');
    } catch (e) {
        console.error('Error loading role:', e);
        showNotification('Error loading role!', 'error');
    }
}

async function deleteRole(id) {
    if (!confirm('Delete this role?')) return;
    try {
        await fetch('/api/roles/' + id, { method: 'DELETE' });
        loadRolesTable();
        showNotification('Role deleted!', 'success');
    } catch (e) {
        console.error('Error deleting role:', e);
        showNotification('Error deleting role!', 'error');
    }
}

function toggleAllRoleCheckboxes() {
    const selectAll = document.getElementById('selectAllRoles').checked;
    const checkboxes = document.querySelectorAll('.role-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedRoles() {
    const checkboxes = document.querySelectorAll('.role-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one role to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} role(s)?`)) return;
    
    const roleIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const roleId of roleIds) {
            const res = await fetch('/api/roles/' + roleId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === roleIds.length) {
            showNotification(`${deletedCount} role(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${roleIds.length} role(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllRoles').checked = false;
        loadRolesTable();
    } catch (e) {
        console.error('Error deleting roles:', e);
        showNotification('Error deleting roles', 'error');
    }
}

// ===== Exam Results =====
async function loadExamResultsTable() {
    try {
        const res = await fetch('/api/exam-results');
        const data = await res.json();
        const tbody = document.getElementById('examResultsTable').querySelector('tbody');
        if (data.success && data.results) {
            tbody.innerHTML = data.results.map(r => {
                let html = '';
                html += '<tr>';
                html += '<td><input type="checkbox" class="exam-result-checkbox" data-id="' + r.id + '"></td>';
                html += '<td>' + r.studentName + '</td>';
                html += '<td>' + r.course + '</td>';
                html += '<td>' + r.examName + '</td>';
                html += '<td>' + r.grade + '</td>';
                html += '<td>' + r.percentage + '%</td>';
                html += '<td>' + formatDate(r.date) + '</td>';
                html += '<td>';
                html += '<button class="btn" onclick="deleteExamResult(\'' + r.id + '\')"><i class="fas fa-trash"></i></button>';
                html += '</td>';
                html += '</tr>';
                return html;
            }).join('');
        }
    } catch (e) {}
}

function toggleAllExamResultCheckboxes() {
    const selectAll = document.getElementById('selectAllExamResults').checked;
    const checkboxes = document.querySelectorAll('.exam-result-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedExamResults() {
    const checkboxes = document.querySelectorAll('.exam-result-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one exam result to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} exam result(s)?`)) return;
    
    const resultIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const resultId of resultIds) {
            const res = await fetch('/api/exam-results/' + resultId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === resultIds.length) {
            showNotification(`${deletedCount} exam result(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${resultIds.length} exam result(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllExamResults').checked = false;
        loadExamResultsTable();
    } catch (e) {
        console.error('Error deleting exam results:', e);
        showNotification('Error deleting exam results', 'error');
    }
}

function openExamResultModal() {
    document.getElementById('examResultModalTitle').textContent = 'Add Exam Result';
    document.getElementById('examResultId').value = '';
    document.getElementById('examName').value = '';
    document.getElementById('totalMarks').value = '';
    document.getElementById('obtainedMarks').value = '';
    document.getElementById('grade').value = '';
    document.getElementById('examDate').value = new Date().toISOString().split('T')[0];
    loadStudentsForExamModal();
    document.getElementById('examResultModal').classList.add('active');
}

async function loadStudentsForExamModal() {
    try {
        const students = await fetch('/api/students').then(r => r.json());
        const studentSelect = document.getElementById('examResultStudent');
        studentSelect.innerHTML = '<option value="">Select Student</option>' + students.map(s => '<option value="' + s.id + '">' + s.name + ' (' + s.course + ')</option>').join('');
    } catch (e) {}
}

async function saveExamResult() {
    const data = {
        studentId: document.getElementById('examResultStudent').value,
        examName: document.getElementById('examName').value,
        totalMarks: document.getElementById('totalMarks').value,
        obtainedMarks: document.getElementById('obtainedMarks').value,
        grade: document.getElementById('grade').value,
        date: document.getElementById('examDate').value
    };
    try {
        await fetch('/api/exam-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeModal('examResultModal');
        loadExamResultsTable();
        showNotification('Result added!', 'success');
    } catch (e) { showNotification('Error!', 'error'); }
}

async function deleteExamResult(id) {
    if (!confirm('Delete this result?')) return;
    try {
        await fetch('/api/exam-results/' + id, { method: 'DELETE' });
        loadExamResultsTable();
        showNotification('Result deleted!', 'success');
    } catch (e) { showNotification('Error!', 'error'); }
}

// ===== Certificates =====
async function loadCertificatesTable() {
    try {
        const res = await fetch('/api/certificates');
        const data = await res.json();
        const tbody = document.getElementById('certificatesTable').querySelector('tbody');
        if (data.success && data.certificates) {
            tbody.innerHTML = data.certificates.map(c => {
                let html = '';
                html += '<tr>';
                html += '<td><input type="checkbox" class="certificate-checkbox" data-id="' + c.id + '"></td>';
                html += '<td>' + c.studentName + '</td>';
                html += '<td>' + c.certificateType + '</td>';
                html += '<td><span class="badge-' + c.template + '">' + c.template + '</span></td>';
                html += '<td>' + (c.certificateNumber || '—') + '</td>';
                html += '<td>' + c.issueDate + '</td>';
                html += '<td>' + (c.grade || '—') + '</td>';
                html += '<td>';
                html += '<button class="btn" onclick="viewCertificate(\'' + c.id + '\')" title="View"><i class="fas fa-eye"></i></button>';
                html += '<button class="btn" onclick="downloadCertificate(\'' + c.id + '\')" title="Download"><i class="fas fa-download"></i></button>';
                html += '<button class="btn delete-btn" onclick="deleteCertificate(\'' + c.id + '\')" title="Delete"><i class="fas fa-trash"></i></button>';
                html += '</td>';
                html += '</tr>';
                return html;
            }).join('');
        }
    } catch (e) {}
}

function toggleAllCertificateCheckboxes() {
    const selectAll = document.getElementById('selectAllCertificates').checked;
    const checkboxes = document.querySelectorAll('.certificate-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedCertificates() {
    const checkboxes = document.querySelectorAll('.certificate-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one certificate to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} certificate(s)?`)) return;
    
    const certificateIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const certificateId of certificateIds) {
            const res = await fetch('/api/certificates/' + certificateId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === certificateIds.length) {
            showNotification(`${deletedCount} certificate(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${certificateIds.length} certificate(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllCertificates').checked = false;
        loadCertificatesTable();
    } catch (e) {
        console.error('Error deleting certificates:', e);
        showNotification('Error deleting certificates', 'error');
    }
}

// ===== Payments =====
async function loadPaymentsTable() {
    try {
        const res = await fetch('/api/payments');
        
        if (!res.ok) {
            throw new Error('HTTP error! status: ' + res.status);
        }
        
        const data = await res.json();
        const tbody = document.querySelector('#paymentsTable tbody');
        
        if (data.success && data.payments && data.payments.length > 0) {
            tbody.innerHTML = data.payments.map(p => {
                const statusBadge = p.status === 'pending' 
                    ? '<span style="color:#f59e0b;font-weight:600;">Pending</span>'
                    : p.status === 'approved'
                    ? '<span style="color:#16a34a;font-weight:600;">Approved</span>'
                    : p.status === 'denied'
                    ? '<span style="color:#dc2626;font-weight:600;">Denied</span>'
                    : '<span style="color:#64748b;font-weight:600;">Unknown</span>';
                
                const actions = p.status === 'pending' 
                    ? '<button class="btn" onclick="approvePayment(\'' + p.id + '\')" style="padding:6px 12px;margin-right:5px;">Approve</button><button class="btn" onclick="denyPayment(\'' + p.id + '\')" style="padding:6px 12px;background:#fee2e2;color:#dc2626;">Deny</button>'
                    : '<span style="color:#64748b;font-size:13px;">Processed</span>';
                
                let html = '';
                html += '<tr>';
                html += '<td>' + p.date + '</td>';
                html += '<td>' + p.studentName + '</td>';
                html += '<td>&#8377;' + p.amount + '</td>';
                html += '<td>' + p.mode + '</td>';
                html += '<td>' + statusBadge + '</td>';
                html += '<td>' + actions + '</td>';
                html += '</tr>';
                return html;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#64748b;">No payments found</td></tr>';
        }
    } catch (err) {
        console.error('Error loading payments:', err);
        const tbody = document.querySelector('#paymentsTable tbody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#dc2626;">Error loading payments</td></tr>';
    }
}

async function approvePayment(paymentId) {
    try {
        const res = await fetch('/api/payments/' + paymentId + '/approve', { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            alert('Payment approved successfully!');
            loadPaymentsTable();
        } else {
            alert('Error approving payment: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Error approving payment:', err);
        alert('Error approving payment');
    }
}

async function denyPayment(paymentId) {
    if (!confirm('Are you sure you want to deny this payment?')) return;
    
    try {
        const res = await fetch('/api/payments/' + paymentId + '/deny', { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            alert('Payment denied!');
            loadPaymentsTable();
        } else {
            alert('Error denying payment: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Error denying payment:', err);
        alert('Error denying payment');
    }
}

// Notification functions
function openNotificationModal(studentId, studentName) {
    document.getElementById('notificationStudentId').value = studentId;
    document.getElementById('notificationStudentName').value = studentName;
    document.getElementById('notificationStudentSelectGroup').style.display = 'none';
    document.getElementById('notificationMessage').value = '';
    document.getElementById('notificationType').value = 'info';
    document.getElementById('notificationModal').classList.add('active');
}

async function openStudentNotificationsModal(studentId, studentName) {
    document.getElementById('studentNotifStudentId').value = studentId;
    document.getElementById('studentNotifStudentName').value = studentName;
    document.getElementById('studentNotificationsModal').classList.add('active');
    
    try {
        const res = await fetch('/api/notifications/' + studentId);
        const data = await res.json();
        const tbody = document.getElementById('studentNotificationsTable').querySelector('tbody');
        
        if (data.success && data.notifications) {
            if (data.notifications.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No notifications sent to this student</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.notifications.map(n => {
                let html = '';
                html += '<tr>';
                html += '<td>' + n.date + '</td>';
                html += '<td>' + n.message + '</td>';
                html += '<td><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:' + (n.type === 'info' ? '#e0f2fe' : n.type === 'warning' ? '#fef3c7' : n.type === 'success' ? '#dcfce7' : '#fee2e2') + ';color:' + (n.type === 'info' ? '#0284c7' : n.type === 'warning' ? '#d97706' : n.type === 'success' ? '#16a34a' : '#dc2626') + ';">' + n.type + '</span></td>';
                html += '<td><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:' + (n.read ? '#dcfce7' : '#fee2e2') + ';color:' + (n.read ? '#16a34a' : '#dc2626') + ';">' + (n.read ? 'Read' : 'Unread') + '</span></td>';
                html += '<td>';
                html += '<button class="btn" onclick="markNotificationAsRead(' + n.id + ')" style="padding:4px 8px;font-size:11px;background:#dcfce7;color:#16a34a;margin-right:4px;">' + (n.read ? 'Unread' : 'Read') + '</button>';
                html += '<button class="btn" onclick="editNotification(' + n.id + ', \'' + n.message.replace(/'/g, "\\'") + '\', \'' + n.type + '\')" style="padding:4px 8px;font-size:11px;background:#e0f2fe;color:#0284c7;margin-right:4px;">Edit</button>';
                html += '<button class="btn" onclick="deleteNotification(' + n.id + ')" style="padding:4px 8px;font-size:11px;background:#fee2e2;color:#dc2626;">Delete</button>';
                html += '</td>';
                html += '</tr>';
                return html;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No notifications found</td></tr>';
        }
    } catch (e) {
        console.error('Error loading notifications:', e);
        const tbody = document.getElementById('notificationsTable').querySelector('tbody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Error loading notifications</td></tr>';
    }
}

function openNotificationModal(studentId, studentName) {
    document.getElementById('notificationStudentId').value = studentId;
    document.getElementById('notificationSendType').value = 'student';
    document.getElementById('notificationStudentGroup').style.display = 'block';
    document.getElementById('notificationCourseGroup').style.display = 'none';
    document.getElementById('notificationBatchGroup').style.display = 'none';
    document.getElementById('notificationMessage').value = '';
    document.getElementById('notificationType').value = 'info';
    document.getElementById('notificationModal').classList.add('active');
}

function toggleNotificationSendType() {
    const sendType = document.getElementById('notificationSendType').value;
    if (sendType === 'student') {
        document.getElementById('notificationStudentGroup').style.display = 'block';
        document.getElementById('notificationCourseGroup').style.display = 'none';
        document.getElementById('notificationBatchGroup').style.display = 'none';
    } else {
        document.getElementById('notificationStudentGroup').style.display = 'none';
        document.getElementById('notificationCourseGroup').style.display = 'block';
        document.getElementById('notificationBatchGroup').style.display = 'block';
    }
}

async function openAdminNotificationModal() {
    document.getElementById('notificationStudentId').value = '';
    document.getElementById('notificationSendType').value = 'student';
    document.getElementById('notificationStudentGroup').style.display = 'block';
    document.getElementById('notificationCourseGroup').style.display = 'none';
    document.getElementById('notificationBatchGroup').style.display = 'none';
    document.getElementById('notificationMessage').value = '';
    document.getElementById('notificationType').value = 'info';
    
    // Load students into dropdown
    try {
        const students = await fetch('/api/students').then(r => r.json());
        const studentSelect = document.getElementById('notificationStudentSelect');
        studentSelect.innerHTML = '<option value="">Select Student</option>' + students.map(s => '<option value="' + s.id + '">' + s.name + ' (' + s.course + ')</option>').join('');
    } catch (e) {
        console.error('Error loading students:', e);
    }
    
    // Load courses into dropdown
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const courseSelect = document.getElementById('notificationCourseSelect');
        courseSelect.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option value="' + c.name + '">' + c.name + '</option>').join('');
    } catch (e) {
        console.error('Error loading courses:', e);
    }
    
    document.getElementById('notificationModal').classList.add('active');
}

async function loadBatchesForNotification() {
    const course = document.getElementById('notificationCourseSelect').value;
    const batchSelect = document.getElementById('notificationBatchSelect');
    batchSelect.innerHTML = '<option value="">Select Batch</option>';
    
    if (!course) return;
    
    try {
        const students = await fetch('/api/students').then(r => r.json());
        const batches = [...new Set(students.filter(s => s.course === course).map(s => s.batch).filter(b => b))];
        batchSelect.innerHTML = '<option value="">Select Batch</option>' + batches.map(b => '<option value="' + b + '">' + b + '</option>').join('');
    } catch (e) {
        console.error('Error loading batches:', e);
    }
}

async function sendNotification() {
    const sendType = document.getElementById('notificationSendType').value;
    const message = document.getElementById('notificationMessage').value;
    const type = document.getElementById('notificationType').value;
    
    if (!message.trim()) {
        alert('Please enter a message');
        return;
    }
    
    try {
        if (sendType === 'student') {
            const studentId = document.getElementById('notificationStudentId').value || document.getElementById('notificationStudentSelect').value;
            if (!studentId) {
                alert('Please select a student');
                return;
            }
            
            const res = await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, message, type })
            });
            const data = await res.json();
            
            if (data.success) {
                alert('Notification sent successfully!');
                closeModal('notificationModal');
                loadNotificationsTable();
            } else {
                alert('Error sending notification: ' + (data.message || 'Unknown error'));
            }
        } else {
            const course = document.getElementById('notificationCourseSelect').value;
            const batch = document.getElementById('notificationBatchSelect').value;
            
            if (!course || !batch) {
                alert('Please select course and batch');
                return;
            }
            
            const res = await fetch('/api/notifications/send-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ course, batch, message, type })
            });
            const data = await res.json();
            
            if (data.success) {
                alert('Notification sent to ' + data.count + ' students!');
                closeModal('notificationModal');
                loadNotificationsTable();
            } else {
                alert('Error sending notification: ' + (data.message || 'Unknown error'));
            }
        }
    } catch (err) {
        console.error('Error sending notification:', err);
        alert('Error sending notification. Please check if the server is running.');
    }
}

async function deleteNotification(notificationId, studentId) {
    if (!confirm('Are you sure you want to delete this notification?')) return;
    
    try {
        const res = await fetch('/api/notifications/' + notificationId, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Notification deleted!', 'success');
            if (studentId) {
                openStudentProfile(studentId);
            } else {
                loadNotificationsTable();
            }
        } else {
            showNotification('Error deleting notification!', 'error');
        }
    } catch (err) {
        showNotification('Error deleting notification!', 'error');
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        const res = await fetch('/api/notifications/all');
        const data = await res.json();
        const notification = data.notifications.find(n => n.id == notificationId);
        
        if (notification) {
            const newReadStatus = !notification.read;
            await fetch('/api/notifications/' + notificationId + '/read', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ read: newReadStatus })
            });
            loadNotificationsTable();
        }
    } catch (err) {
        showNotification('Error updating notification!', 'error');
    }
}

async function editNotification(notificationId, message, type) {
    document.getElementById('notificationStudentId').value = '';
    document.getElementById('notificationStudentName').value = '';
    document.getElementById('notificationStudentSelectGroup').style.display = 'none';
    document.getElementById('notificationMessage').value = message;
    document.getElementById('notificationType').value = type;
    document.getElementById('notificationModal').classList.add('active');
    
    // Store the notification ID for updating
    window.editingNotificationId = notificationId;
    
    // Change the send button to update button
    const sendBtn = document.querySelector('#notificationModal .btn-primary');
    sendBtn.innerHTML = '<i class="fas fa-save"></i> Update';
    sendBtn.onclick = updateNotification;
}

async function updateNotification() {
    const notificationId = window.editingNotificationId;
    const message = document.getElementById('notificationMessage').value;
    const type = document.getElementById('notificationType').value;
    
    if (!message.trim()) {
        alert('Please enter a message');
        return;
    }
    
    try {
        const res = await fetch('/api/notifications/' + notificationId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, type })
        });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Notification updated!', 'success');
            closeModal('notificationModal');
            loadNotificationsTable();
            resetNotificationButton();
        } else {
            alert('Error updating notification: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Error updating notification:', err);
        alert('Error updating notification. Please check if the server is running.');
    }
}

function resetNotificationButton() {
    const sendBtn = document.querySelector('#notificationModal .btn-primary');
    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
    sendBtn.onclick = sendNotification;
    window.editingNotificationId = null;
}

async function loadNotificationsTable() {
    try {
        console.log('Loading notifications table...');
        const res = await fetch('/api/notifications/all');
        const data = await res.json();
        const tbody = document.getElementById('notificationsTable').querySelector('tbody');
        
        console.log('Notifications data:', data);
        
        if (data.success && data.notifications) {
            // Get all students for name lookup
            const students = await fetch('/api/students').then(r => r.json());
            const studentMap = {};
            students.forEach(s => studentMap[s.id] = s.name);
            
            console.log('Total notifications:', data.notifications.length);
            
            if (data.notifications.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No notifications found</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.notifications.map(n => {
                const studentName = studentMap[n.studentId] || 'Student ' + n.studentId;
                console.log('Rendering notification:', n);
                let html = '';
                html += '<tr>';
                html += '<td><input type="checkbox" class="notification-checkbox" data-id="' + n.id + '"></td>';
                html += '<td>' + n.date + '</td>';
                html += '<td><strong>' + studentName + '</strong></td>';
                html += '<td>' + n.message + '</td>';
                html += '<td><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:' + (n.type === 'info' ? '#e0f2fe' : n.type === 'warning' ? '#fef3c7' : n.type === 'success' ? '#dcfce7' : '#fee2e2') + ';color:' + (n.type === 'info' ? '#0284c7' : n.type === 'warning' ? '#d97706' : n.type === 'success' ? '#16a34a' : '#dc2626') + ';">' + n.type + '</span></td>';
                html += '<td>' + (n.read ? 'Yes' : 'No') + '</td>';
                html += '<td>';
                html += '<button class="action-btn edit-btn" onclick="editNotification(\'' + n.id + '\')">Edit</button>';
                html += '<button class="action-btn delete-btn" onclick="deleteNotification(\'' + n.id + '\')">Delete</button>';
                html += '</td>';
                html += '</tr>';
                return html;
            }).join('');
            console.log('Notifications table rendered');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No notifications found</td></tr>';
        }
    } catch (e) {
        console.error('Error loading notifications:', e);
        const tbody = document.getElementById('notificationsTable').querySelector('tbody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Error loading notifications</td></tr>';
    }
}

// ===== Exam Management =====
async function loadExamManagementTable() {
    try {
        const exams = await fetch('/api/exams').then(r => r.json());
        const tbody = document.querySelector('#examManagementTable tbody');
        let html = '';
        exams.forEach(e => {
            html += '<tr>';
            html += '<td>' + e.name + '</td>';
            html += '<td>' + e.course + '</td>';
            html += '<td>' + e.date + '</td>';
            html += '<td>' + e.duration + '</td>';
            html += '<td>' + e.totalMarks + '</td>';
            html += '<td>' + e.status + '</td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editExam(' + e.id + ')">Edit</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteExam(' + e.id + ')">Delete</button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (err) { console.error(err); }
}

async function loadQuestionBankTable() {
    try {
        const data = await fetch('/api/questions').then(r => r.json());
        const questions = Array.isArray(data) ? data : (data.questions || []);
        const tbody = document.querySelector('#questionBankTable tbody');
        let html = '';
        questions.forEach(q => {
            html += '<tr>';
            html += '<td><input type="checkbox" class="question-checkbox" data-id="' + q.id + '"></td>';
            html += '<td>' + (q.text ? q.text.substring(0, 50) + (q.text.length > 50 ? '...' : '') : '') + '</td>';
            html += '<td>' + (q.courseName || q.course || '') + '</td>';
            html += '<td>' + q.type + '</td>';
            html += '<td>' + q.difficulty + '</td>';
            html += '<td>' + q.marks + '</td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editQuestion(' + q.id + ')">Edit</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteQuestion(' + q.id + ')">Delete</button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (err) { console.error(err); }
}

function toggleAllQuestionCheckboxes() {
    const selectAll = document.getElementById('selectAllQuestions').checked;
    const checkboxes = document.querySelectorAll('.question-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedQuestions() {
    const checkboxes = document.querySelectorAll('.question-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one question to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} question(s)?`)) return;
    
    const questionIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const questionId of questionIds) {
            const res = await fetch('/api/questions/' + questionId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === questionIds.length) {
            showNotification(`${deletedCount} question(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${questionIds.length} question(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllQuestions').checked = false;
        loadQuestionBankTable();
    } catch (e) {
        console.error('Error deleting questions:', e);
        showNotification('Error deleting questions', 'error');
    }
}

function openQuestionModal() {
    document.getElementById('questionModalTitle').textContent = 'Add Question';
    document.getElementById('questionId').value = '';
    document.getElementById('questionTextEnglish').innerHTML = '';
    document.getElementById('questionTextHindi').innerHTML = '';
    document.getElementById('questionModalCourse').value = '';
    document.getElementById('questionModalType').value = 'MCQ';
    document.getElementById('questionModalDifficulty').value = 'Easy';
    document.getElementById('questionMarks').value = '';
    document.getElementById('questionOption1').value = '';
    document.getElementById('questionOption2').value = '';
    document.getElementById('questionOption3').value = '';
    document.getElementById('questionOption4').value = '';
    document.getElementById('questionCorrectAnswer').value = '';
    document.getElementById('questionTrueFalseAnswer').value = '';
    document.getElementById('questionShortAnswer').value = '';
    document.getElementById('questionGradingCriteria').value = '';
    document.getElementById('questionModal').classList.add('active');
    
    // Show English by default and set question type fields
    switchQuestionLang('english');
    updateQuestionTypeFields();
    
    // Load courses
    fetch('/api/courses').then(r => r.json()).then(courses => {
        const courseSelect = document.getElementById('questionModalCourse');
        courseSelect.innerHTML = '<option value="">All Courses</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
    });
}

function switchQuestionLang(lang) {
    const englishSection = document.getElementById('englishQuestionSection');
    const hindiSection = document.getElementById('hindiQuestionSection');
    const englishBtn = document.getElementById('langEnglishBtn');
    const hindiBtn = document.getElementById('langHindiBtn');
    
    if (lang === 'english') {
        englishSection.style.display = 'block';
        hindiSection.style.display = 'none';
        englishBtn.style.background = '#3b82f6';
        englishBtn.style.color = '#fff';
        hindiBtn.style.background = '#64748b';
        hindiBtn.style.color = '#fff';
    } else {
        englishSection.style.display = 'none';
        hindiSection.style.display = 'block';
        hindiBtn.style.background = '#3b82f6';
        hindiBtn.style.color = '#fff';
        englishBtn.style.background = '#64748b';
        englishBtn.style.color = '#fff';
    }
}

function formatText(command) {
    document.execCommand(command, false, null);
}

function formatTextHindi(command) {
    document.execCommand(command, false, null);
}

function updateQuestionTypeFields() {
    const type = document.getElementById('questionModalType').value;
    const mcqOptionsSection = document.getElementById('mcqOptionsSection');
    const trueFalseSection = document.getElementById('trueFalseSection');
    const shortAnswerSection = document.getElementById('shortAnswerSection');
    const essaySection = document.getElementById('essaySection');
    const mcqCorrectAnswerSection = document.getElementById('mcqCorrectAnswerSection');
    
    // Hide all sections first
    mcqOptionsSection.style.display = 'none';
    trueFalseSection.style.display = 'none';
    shortAnswerSection.style.display = 'none';
    essaySection.style.display = 'none';
    mcqCorrectAnswerSection.style.display = 'none';
    
    // Show relevant sections based on question type
    if (type === 'MCQ') {
        mcqOptionsSection.style.display = 'block';
        mcqCorrectAnswerSection.style.display = 'block';
    } else if (type === 'TrueFalse') {
        trueFalseSection.style.display = 'block';
    } else if (type === 'ShortAnswer') {
        shortAnswerSection.style.display = 'block';
    } else if (type === 'Essay') {
        essaySection.style.display = 'block';
    }
}

function closeQuestionModal() {
    document.getElementById('questionModal').classList.remove('active');
}

function openBulkUploadModal() {
    document.getElementById('bulkUploadModal').classList.add('active');
    loadCoursesForBulkUpload();
}

function closeBulkUploadModal() {
    document.getElementById('bulkUploadModal').classList.remove('active');
}

async function loadCoursesForBulkUpload() {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    const select = document.getElementById('bulkUploadCourse');
    select.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('');
}

async function uploadBulkQuestions() {
    const course = document.getElementById('bulkUploadCourse').value;
    const type = document.getElementById('bulkUploadType').value;
    const difficulty = document.getElementById('bulkUploadDifficulty').value;
    const file = document.getElementById('bulkUploadFile').files[0];
    
    if (!course) return showNotification('Please select a course', 'error');
    if (!type) return showNotification('Please select question type', 'error');
    if (!file) return showNotification('Please select a file', 'error');
    
    const formData = new FormData();
    formData.append('course', course);
    formData.append('type', type);
    formData.append('difficulty', difficulty);
    formData.append('file', file);
    
    try {
        const res = await fetch('/api/questions/bulk-upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (data.success) {
            showNotification(data.message || 'Questions uploaded successfully!', 'success');
            closeBulkUploadModal();
            cachedQuestions = null;
            loadQuestionBankTable();
        } else {
            showNotification(data.message || 'Error uploading questions', 'error');
        }
    } catch (e) {
        console.error('Error uploading questions:', e);
        showNotification('Error uploading questions', 'error');
    }
}

function previewSheetFormat() {
    document.getElementById('sheetPreviewModal').classList.add('active');
    loadCoursesForSheetPreview();
}

function closeSheetPreviewModal() {
    document.getElementById('sheetPreviewModal').classList.remove('active');
}

async function loadCoursesForSheetPreview() {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    const select = document.getElementById('previewCourse');
    select.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('');
}

async function loadSheetPreview() {
    const courseId = document.getElementById('previewCourse').value;
    if (!courseId) return;
    
    try {
        const res = await fetch('/api/questions?course=' + courseId);
        const data = await res.json();
        const questions = data.questions || [];
        
        const previewContent = document.getElementById('sheetPreviewContent');
        
        if (questions.length === 0) {
            previewContent.innerHTML = '<p style="color:#64748b;text-align:center;padding:50px;">No questions found for this course</p>';
            return;
        }
        
        let html = '<div style="font-family:Arial,sans-serif;padding:20px;">';
        html += '<h2 style="text-align:center;border-bottom:2px solid #000;padding-bottom:10px;">Question Paper</h2>';
        html += '<p style="text-align:right;">Course: ' + (questions[0].courseName || '') + '</p>';
        html += '<p style="text-align:right;">Date: ' + formatDate(new Date()) + '</p><br>';
        
        questions.forEach((q, index) => {
            html += '<div style="margin-bottom:15px;">';
            html += '<p style="margin:0;"><strong>Q' + (index + 1) + '.</strong> ' + q.question + ' (' + q.marks + ' marks)</p>';
            if (q.options && q.options.length > 0) {
                html += '<div style="margin-left:20px;margin-top:5px;">';
                q.options.forEach((opt, i) => {
                    html += '<p style="margin:2px 0;">(' + String.fromCharCode(65 + i) + ') ' + opt + '</p>';
                });
                html += '</div>';
            }
            html += '</div>';
        });
        
        html += '</div>';
        previewContent.innerHTML = html;
    } catch (e) {
        console.error('Error loading sheet preview:', e);
        showNotification('Error loading preview', 'error');
    }
}

function printSheetPreview() {
    const previewContent = document.getElementById('sheetPreviewContent').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Question Sheet Preview</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04;"><img src="/uploads/logo/logo.png" style="max-width: 300px; max-height: 300px;" onerror="this.parentElement.style.display='none'"></div>
            ${previewContent}
        </body>
        </html>
    `);
}

async function saveQuestion() {
    const id = document.getElementById('questionId').value;
    const textEnglish = document.getElementById('questionTextEnglish').innerHTML;
    const textHindi = document.getElementById('questionTextHindi').innerHTML;
    const course = document.getElementById('questionModalCourse').value;
    const type = document.getElementById('questionModalType').value;
    const difficulty = document.getElementById('questionModalDifficulty').value;
    const marks = document.getElementById('questionMarks').value;
    
    if (!textEnglish || textEnglish.trim() === '' || textEnglish === '<br>') {
        showNotification('Question text (English) is required!', 'error');
        return;
    }
    
    let data = {
        text: textEnglish,
        textHindi: textHindi,
        course,
        type,
        difficulty,
        marks: parseInt(marks) || 0
    };
    
    // Handle different question types
    if (type === 'MCQ') {
        const option1 = document.getElementById('questionOption1').value;
        const option2 = document.getElementById('questionOption2').value;
        const option3 = document.getElementById('questionOption3').value;
        const option4 = document.getElementById('questionOption4').value;
        const correctAnswer = document.getElementById('questionCorrectAnswer').value;
        
        data.options = [option1, option2, option3, option4].filter(o => o.trim() !== '');
        data.correctAnswer = correctAnswer;
    } else if (type === 'TrueFalse') {
        data.correctAnswer = document.getElementById('questionTrueFalseAnswer').value;
    } else if (type === 'ShortAnswer') {
        data.correctAnswer = document.getElementById('questionShortAnswer').value;
    } else if (type === 'Essay') {
        data.gradingCriteria = document.getElementById('questionGradingCriteria').value;
    }
    
    try {
        const url = id ? '/api/questions/' + id : '/api/questions';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (result.success) {
            showNotification(id ? 'Question updated!' : 'Question added!', 'success');
            closeQuestionModal();
            loadQuestionBankTable();
        } else {
            showNotification(result.message || 'Error saving question!', 'error');
        }
    } catch (e) {
        console.error('Error saving question:', e);
        showNotification('Error saving question!', 'error');
    }
}

async function editQuestion(id) {
    try {
        const res = await fetch('/api/questions/' + id);
        if (!res.ok) {
            showNotification('Question not found!', 'error');
            return;
        }
        const question = await res.json();
        
        document.getElementById('questionModalTitle').textContent = 'Edit Question';
        document.getElementById('questionId').value = question.id;
        document.getElementById('questionTextEnglish').innerHTML = question.text || '';
        document.getElementById('questionTextHindi').innerHTML = question.textHindi || '';
        document.getElementById('questionModalCourse').value = question.course || '';
        document.getElementById('questionModalType').value = question.type;
        document.getElementById('questionModalDifficulty').value = question.difficulty;
        document.getElementById('questionMarks').value = question.marks || '';
        
        // Load type-specific fields
        updateQuestionTypeFields();
        
        const qType = question.type;
        if (qType === 'MCQ' && question.options && question.options.length > 0) {
            document.getElementById('questionOption1').value = question.options[0] || '';
            document.getElementById('questionOption2').value = question.options[1] || '';
            document.getElementById('questionOption3').value = question.options[2] || '';
            document.getElementById('questionOption4').value = question.options[3] || '';
            document.getElementById('questionCorrectAnswer').value = question.correctAnswer || '';
        } else if (qType === 'TrueFalse') {
            document.getElementById('questionTrueFalseAnswer').value = question.correctAnswer || '';
        } else if (qType === 'ShortAnswer') {
            document.getElementById('questionShortAnswer').value = question.correctAnswer || '';
        } else if (qType === 'Essay') {
            document.getElementById('questionGradingCriteria').value = question.gradingCriteria || '';
        }
        
        document.getElementById('questionModal').classList.add('active');
        
        // Show English by default
        switchQuestionLang('english');
        
        // Load courses
        fetch('/api/courses').then(function(r) { return r.json(); }).then(function(courses) {
            const courseSelect = document.getElementById('questionModalCourse');
            if (Array.isArray(courses) && courses.length > 0) {
                var optionsHtml = '<option value="">All Courses</option>';
                for (var i = 0; i < courses.length; i++) {
                    optionsHtml += '<option>' + courses[i].name + '</option>';
                }
                courseSelect.innerHTML = optionsHtml;
            } else {
                courseSelect.innerHTML = '<option value="">All Courses</option>';
            }
            courseSelect.value = question.course || '';
        }).catch(function(err) {
            console.error('Error loading courses:', err);
        });
    } catch (e) {
        console.error('Error loading question:', e);
        showNotification('Error loading question!', 'error');
    }
}

async function deleteQuestion(id) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
        const res = await fetch('/api/questions/' + id, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Question deleted!', 'success');
            loadQuestionBankTable();
        } else {
            showNotification('Error deleting question!', 'error');
        }
    } catch (e) {
        console.error('Error deleting question:', e);
        showNotification('Error deleting question!', 'error');
    }
}

function filterQuestions() {
    const course = document.getElementById('questionCourse').value;
    const type = document.getElementById('questionType').value;
    const difficulty = document.getElementById('questionDifficulty').value;
    
    fetch('/api/questions').then(r => r.json()).then(questions => {
        const filtered = questions.filter(q => {
            if (course && q.course !== course) return false;
            if (type && q.type !== type) return false;
            if (difficulty && q.difficulty !== difficulty) return false;
            return true;
        });
        
        const tbody = document.querySelector('#questionBankTable tbody');
        let html = '';
        filtered.forEach(q => {
            html += '<tr>';
            html += '<td>' + q.text.substring(0, 50) + '...</td>';
            html += '<td>' + q.course + '</td>';
            html += '<td>' + q.type + '</td>';
            html += '<td>' + q.difficulty + '</td>';
            html += '<td>' + q.marks + '</td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editQuestion(' + q.id + ')">Edit</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteQuestion(' + q.id + ')">Delete</button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    });
}

async function loadExamScheduleTable() {
    try {
        const schedules = await fetch('/api/exam-schedules').then(r => r.json());
        const tbody = document.querySelector('#examScheduleTable tbody');
        let html = '';
        schedules.forEach(s => {
            html += '<tr>';
            html += '<td><input type="checkbox" class="exam-schedule-checkbox" data-id="' + s.id + '"></td>';
            html += '<td>' + s.exam + '</td>';
            html += '<td>' + s.course + '</td>';
            html += '<td>' + s.batch + '</td>';
            html += '<td>' + s.date + '</td>';
            html += '<td>' + s.time + '</td>';
            html += '<td>' + s.duration + '</td>';
            html += '<td>' + s.totalMarks + '</td>';
            html += '<td>' + s.venue + '</td>';
            html += '<td><span class="status-badge status-' + s.status.toLowerCase() + '">' + s.status + '</span></td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editExamSchedule(' + s.id + ')">Edit</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteExamSchedule(' + s.id + ')">Delete</button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (err) { console.error(err); }
}

function toggleAllExamScheduleCheckboxes() {
    const selectAll = document.getElementById('selectAllExamSchedules').checked;
    const checkboxes = document.querySelectorAll('.exam-schedule-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedExamSchedules() {
    const checkboxes = document.querySelectorAll('.exam-schedule-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one exam schedule to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} exam schedule(s)?`)) return;
    
    const scheduleIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const scheduleId of scheduleIds) {
            const res = await fetch('/api/exam-schedules/' + scheduleId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === scheduleIds.length) {
            showNotification(`${deletedCount} exam schedule(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${scheduleIds.length} exam schedule(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllExamSchedules').checked = false;
        loadExamScheduleTable();
    } catch (e) {
        console.error('Error deleting exam schedules:', e);
        showNotification('Error deleting exam schedules', 'error');
    }
}

function openExamScheduleModal() {
    document.getElementById('examScheduleModalTitle').textContent = 'Add Exam Schedule';
    document.getElementById('examScheduleId').value = '';
    document.getElementById('scheduleExamTitle').value = '';
    document.getElementById('scheduleCourse').value = '';
    document.getElementById('scheduleBatch').value = '';
    document.getElementById('scheduleDate').value = '';
    document.getElementById('scheduleTime').value = '';
    document.getElementById('scheduleDuration').value = '';
    document.getElementById('scheduleTotalMarks').value = '';
    document.getElementById('scheduleVenue').value = '';
    document.getElementById('scheduleStatus').value = 'Scheduled';
    document.getElementById('scheduleDescription').value = '';
    document.getElementById('examScheduleModal').classList.add('active');
    loadCoursesAndBatches();
}

function closeExamScheduleModal() {
    document.getElementById('examScheduleModal').classList.remove('active');
}

async function loadCoursesAndBatches() {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const courseSelect = document.getElementById('scheduleCourse');
        courseSelect.innerHTML = '<option value="">Select Course</option><option value="All">All Courses</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
        
        const batches = await fetch('/api/batches').then(r => r.json());
        const batchSelect = document.getElementById('scheduleBatch');
        batchSelect.innerHTML = '<option value="">Select Batch</option><option value="All">All Batches</option>' + batches.map(b => '<option>' + b.name + '</option>').join('');
    } catch (err) {
        console.error('Error loading courses and batches:', err);
    }
}

async function saveExamSchedule() {
    const id = document.getElementById('examScheduleId').value;
    const data = {
        exam: document.getElementById('scheduleExamTitle').value,
        course: document.getElementById('scheduleCourse').value,
        batch: document.getElementById('scheduleBatch').value,
        date: document.getElementById('scheduleDate').value,
        time: document.getElementById('scheduleTime').value,
        duration: document.getElementById('scheduleDuration').value,
        totalMarks: document.getElementById('scheduleTotalMarks').value,
        venue: document.getElementById('scheduleVenue').value,
        status: document.getElementById('scheduleStatus').value,
        description: document.getElementById('scheduleDescription').value
    };
    
    if (!data.exam || !data.course || !data.batch || !data.date || !data.time || !data.duration || !data.totalMarks || !data.venue) {
        showNotification('Please fill all required fields!', 'error');
        return;
    }
    
    try {
        const url = id ? '/api/exam-schedules/' + id : '/api/exam-schedules';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (result.success) {
            showNotification(id ? 'Exam schedule updated!' : 'Exam schedule added!', 'success');
            closeExamScheduleModal();
            loadExamScheduleTable();
        } else {
            showNotification(result.message || 'Error saving exam schedule!', 'error');
        }
    } catch (e) {
        console.error('Error saving exam schedule:', e);
        showNotification('Error saving exam schedule!', 'error');
    }
}

async function editExamSchedule(id) {
    try {
        const res = await fetch('/api/exam-schedules/' + id);
        const schedule = await res.json();
        
        document.getElementById('examScheduleModalTitle').textContent = 'Edit Exam Schedule';
        document.getElementById('examScheduleId').value = schedule.id;
        document.getElementById('scheduleExamTitle').value = schedule.exam || '';
        document.getElementById('scheduleCourse').value = schedule.course || '';
        document.getElementById('scheduleBatch').value = schedule.batch || '';
        document.getElementById('scheduleDate').value = schedule.date || '';
        document.getElementById('scheduleTime').value = schedule.time || '';
        document.getElementById('scheduleDuration').value = schedule.duration || '';
        document.getElementById('scheduleTotalMarks').value = schedule.totalMarks || '';
        document.getElementById('scheduleVenue').value = schedule.venue || '';
        document.getElementById('scheduleStatus').value = schedule.status || 'Scheduled';
        document.getElementById('scheduleDescription').value = schedule.description || '';
        document.getElementById('examScheduleModal').classList.add('active');
        loadCoursesAndBatches();
    } catch (e) {
        console.error('Error loading exam schedule:', e);
        showNotification('Error loading exam schedule!', 'error');
    }
}

async function deleteExamSchedule(id) {
    if (!confirm('Are you sure you want to delete this exam schedule?')) return;
    
    try {
        const res = await fetch('/api/exam-schedules/' + id, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Exam schedule deleted!', 'success');
            loadExamScheduleTable();
        } else {
            showNotification('Error deleting exam schedule!', 'error');
        }
    } catch (e) {
        console.error('Error deleting exam schedule:', e);
        showNotification('Error deleting exam schedule!', 'error');
    }
}

function printExamSchedule() {
    const schedules = document.querySelectorAll('#examScheduleTable tbody tr');
    if (schedules.length === 0) {
        showNotification('No exam schedules to print!', 'error');
        return;
    }
    
    let printContent = '<html><head><title>Exam Schedule</title>';
    printContent += '<style>body{font-family:Arial,sans-serif;padding:20px;}';
    printContent += 'table{width:100%;border-collapse:collapse;margin-top:20px;}';
    printContent += 'th,td{border:1px solid #ddd;padding:10px;text-align:left;}';
    printContent += 'th{background-color:#4CAF50;color:white;}';
    printContent += '.status-scheduled{background:#e3f2fd;padding:3px 8px;border-radius:4px;}';
    printContent += '.status-completed{background:#e8f5e9;padding:3px 8px;border-radius:4px;}';
    printContent += '.status-cancelled{background:#ffebee;padding:3px 8px;border-radius:4px;}';
    printContent += '.status-postponed{background:#fff3e0;padding:3px 8px;border-radius:4px;}';
    printContent += '.watermark { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04; }</style></head><body><div class="watermark"><img src="/uploads/logo/logo.png" style="max-width: 300px; max-height: 300px;" onerror="this.parentElement.style.display=\'none\'"></div>';
    printContent += '<h1>Exam Schedule</h1>';
    printContent += '<table><thead><tr><th>Exam</th><th>Course</th><th>Batch</th><th>Date</th><th>Time</th><th>Duration</th><th>Total Marks</th><th>Venue</th><th>Status</th></tr></thead><tbody>';
    
    document.querySelectorAll('#examScheduleTable tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        printContent += '<tr>';
        for (let i = 0; i < cells.length - 1; i++) {
            printContent += '<td>' + cells[i].innerHTML + '</td>';
        }
        printContent += '</tr>';
    });
    
    printContent += '</tbody></table></body></html>';
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    printWindow.onafterprint = function() { printWindow.close(); };
}

async function loadExamRegistrationTable() {
    try {
        const [registrations, students] = await Promise.all([
            fetch('/api/exam-registrations').then(r => r.json()),
            fetch('/api/students').then(r => r.json())
        ]);
        const studentsMap = {};
        (students || []).forEach(s => { studentsMap[s.id] = s; });
        const tbody = document.querySelector('#examRegistrationTable tbody');
        if (!registrations || registrations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:20px;">No exam registrations found</td></tr>';
            return;
        }
        let html = '';
        registrations.forEach(r => {
            const statusClass = r.status === 'Approved' ? 'active' : r.status === 'Rejected' ? 'inactive' : 'pending';
            const statusStyle = r.status === 'Approved' ? 'background:#dcfce7;color:#166534;' : r.status === 'Rejected' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;';
            const feeStatusClass = r.feeStatus === 'Paid' ? 'active' : 'pending';
            const feeStyle = r.feeStatus === 'Paid' ? 'background:#dcfce7;color:#166534;' : 'background:#fee2e2;color:#991b1b;';
            const actions = [];
            if (r.status === 'Pending') {
                actions.push('<button class="action-btn edit-btn" onclick="approveRegistration(' + r.id + ')" title="Approve"><i class="fas fa-check"></i> Approve</button>');
                actions.push('<button class="action-btn delete-btn" onclick="rejectRegistration(' + r.id + ')" title="Reject"><i class="fas fa-times"></i> Reject</button>');
            }
            actions.push('<button class="action-btn" onclick="deleteRegistration(' + r.id + ')" title="Delete"><i class="fas fa-trash"></i></button>');
            const student = studentsMap[r.student];
            const studentIdDisplay = student && student.rollNo ? student.rollNo : '—';
            html += '<tr>';
            html += '<td><input type="checkbox" class="registration-checkbox" data-id="' + r.id + '"></td>';
            html += '<td style="font-weight:600;">' + (r.studentName || '—') + '<br><small style="color:#64748b;font-weight:400;">' + (r.courseName || r.course || '') + '</small></td>';
            html += '<td>' + (r.examName || '—') + '<br><small style="color:#64748b;">' + (r.examDate || '') + '</small></td>';
            html += '<td>' + (r.courseName || r.course || '—') + '</td>';
            html += '<td><span style="font-family:monospace;font-size:12px;color:#64748b;background:#f1f5f9;padding:2px 8px;border-radius:4px;">' + studentIdDisplay + '</span></td>';
            html += '<td><span class="status-badge" style="' + statusStyle + '">' + r.status + '</span></td>';
            html += '<td><span class="status-badge" style="' + feeStyle + '">' + (r.feeStatus || 'Unknown') + '</span></td>';
            html += '<td>' + (r.registrationDate || formatDateTime(r.registeredAt) || '—') + '</td>';
            html += '<td>' + actions.join('') + '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (err) { console.error('Exam registration load error:', err); }
}

async function approveRegistration(id) {
    if (!confirm('Approve this registration and generate admit card?')) return;
    try {
        const res = await fetch('/api/exam-registrations/' + id + '/approve', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve' })
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Registration approved! Admit card generated.', 'success');
            loadExamRegistrationTable();
        } else {
            showNotification(data.message || 'Failed to approve', 'error');
        }
    } catch (e) {
        console.error('Error approving registration:', e);
        showNotification('Error approving registration', 'error');
    }
}

async function rejectRegistration(id) {
    const reason = prompt('Rejection reason (optional):');
    if (reason === null) return; // cancelled
    if (!confirm('Reject this registration?')) return;
    try {
        const res = await fetch('/api/exam-registrations/' + id + '/approve', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', reason: reason || '' })
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Registration rejected.', 'warning');
            loadExamRegistrationTable();
        } else {
            showNotification(data.message || 'Failed to reject', 'error');
        }
    } catch (e) {
        console.error('Error rejecting registration:', e);
        showNotification('Error rejecting registration', 'error');
    }
}

function toggleAllRegistrationCheckboxes() {
    const selectAll = document.getElementById('selectAllRegistrations').checked;
    const checkboxes = document.querySelectorAll('.registration-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedRegistrations() {
    const checkboxes = document.querySelectorAll('.registration-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one registration to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} registration(s)?`)) return;
    
    const registrationIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const registrationId of registrationIds) {
            const res = await fetch('/api/exam-registrations/' + registrationId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === registrationIds.length) {
            showNotification(`${deletedCount} registration(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${registrationIds.length} registration(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllRegistrations').checked = false;
        loadExamRegistrationTable();
    } catch (e) {
        console.error('Error deleting registrations:', e);
        showNotification('Error deleting registrations', 'error');
    }
}

async function generateRollNumber() {
    try {
        const course = document.getElementById('registrationCourse').value;
        if (!course) {
            showNotification('Please select course first!', 'error');
            return;
        }
        
        const registrations = await fetch('/api/exam-registrations').then(r => r.json());
        const year = new Date().getFullYear();
        
        // Find registrations for this course
        const courseRegistrations = registrations.filter(r => r.course == course);
        
        // Extract roll numbers and find the highest
        let maxRollNo = 0;
        courseRegistrations.forEach(r => {
            const rollNum = parseInt(r.rollNo);
            if (!isNaN(rollNum) && rollNum > maxRollNo) {
                maxRollNo = rollNum;
            }
        });
        
        // Generate next sequential roll number
        const nextRollNo = maxRollNo > 0 ? maxRollNo + 1 : parseInt(year + '001');
        document.getElementById('registrationRollNo').value = nextRollNo;
    } catch (err) {
        console.error('Error generating roll number:', err);
        showNotification('Error generating roll number', 'error');
    }
}

function openRegistrationModal() {
    document.getElementById('registrationModalTitle').textContent = 'Register Student';
    document.getElementById('registrationId').value = '';
    document.getElementById('registrationStudent').value = '';
    document.getElementById('registrationExam').value = '';
    document.getElementById('registrationCourse').value = '';
    document.getElementById('registrationRollNo').value = '';
    document.getElementById('registrationStatus').value = 'Pending';
    document.getElementById('registrationPayment').value = 'Pending';
    document.getElementById('registrationModal').classList.add('active');
    loadStudentsExamsAndCourses();
}

function closeRegistrationModal() {
    document.getElementById('registrationModal').classList.remove('active');
}

async function loadStudentsExamsAndCourses() {
    try {
        const students = await fetch('/api/students').then(r => r.json());
        const studentSelect = document.getElementById('registrationStudent');
        studentSelect.innerHTML = '<option value="">Select Student</option>' + students.map(s => `<option value="${s.id}">${s.name} (Roll: ${s.rollNo})</option>`).join('');
        
        const examSchedules = await fetch('/api/exam-schedules').then(r => r.json());
        const examSelect = document.getElementById('registrationExam');
        examSelect.innerHTML = '<option value="">Select Exam</option>' + examSchedules.filter(e => e.status === 'Scheduled').map(e => `<option value="${e.id}">${e.exam} - ${e.date}</option>`).join('');
        
        const courses = await fetch('/api/courses').then(r => r.json());
        const courseSelect = document.getElementById('registrationCourse');
        courseSelect.innerHTML = '<option value="">Select Course</option>' + courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (err) {
        console.error('Error loading data:', err);
    }
}

async function saveRegistration() {
    const id = document.getElementById('registrationId').value;
    const data = {
        student: document.getElementById('registrationStudent').value,
        exam: document.getElementById('registrationExam').value,
        course: document.getElementById('registrationCourse').value,
        rollNo: document.getElementById('registrationRollNo').value,
        status: document.getElementById('registrationStatus').value,
        payment: document.getElementById('registrationPayment').value,
        registrationDate: new Date().toISOString()
    };
    
    if (!data.student || !data.exam || !data.course || !data.rollNo) {
        showNotification('Please fill all required fields!', 'error');
        return;
    }
    
    try {
        const url = id ? '/api/exam-registrations/' + id : '/api/exam-registrations';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (result.success) {
            showNotification(id ? 'Registration updated!' : 'Student registered!', 'success');
            closeRegistrationModal();
            loadExamRegistrationTable();
        } else {
            showNotification(result.message || 'Error saving registration!', 'error');
        }
    } catch (e) {
        console.error('Error saving registration:', e);
        showNotification('Error saving registration!', 'error');
    }
}

async function editRegistration(id) {
    try {
        const res = await fetch('/api/exam-registrations/' + id);
        const registration = await res.json();
        
        document.getElementById('registrationModalTitle').textContent = 'Edit Registration';
        document.getElementById('registrationId').value = registration.id;
        document.getElementById('registrationStudent').value = registration.student || '';
        document.getElementById('registrationExam').value = registration.exam || '';
        document.getElementById('registrationCourse').value = registration.course || '';
        document.getElementById('registrationRollNo').value = registration.rollNo || '';
        document.getElementById('registrationStatus').value = registration.status || 'Pending';
        document.getElementById('registrationPayment').value = registration.payment || 'Pending';
        document.getElementById('registrationModal').classList.add('active');
        loadStudentsExamsAndCourses();
    } catch (e) {
        console.error('Error loading registration:', e);
        showNotification('Error loading registration!', 'error');
    }
}

async function deleteRegistration(id) {
    if (!confirm('Are you sure you want to delete this registration?')) return;
    
    try {
        const res = await fetch('/api/exam-registrations/' + id, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Registration deleted!', 'success');
            loadExamRegistrationTable();
        } else {
            showNotification('Error deleting registration!', 'error');
        }
    } catch (e) {
        console.error('Error deleting registration:', e);
        showNotification('Error deleting registration!', 'error');
    }
}

async function loadOnlineExamTable() {
    try {
        const onlineExams = await fetch('/api/online-exams').then(r => r.json());
        const tbody = document.querySelector('#onlineExamTable tbody');
        let html = '';
        onlineExams.forEach(e => {
            html += '<tr>';
            html += '<td><input type="checkbox" class="online-exam-checkbox" data-id="' + e.id + '"></td>';
            html += '<td>' + e.name + '</td>';
            html += '<td>' + e.course + '</td>';
            html += '<td>' + (e.questions ? e.questions.length : 0) + '</td>';
            html += '<td>' + e.totalMarks + '</td>';
            html += '<td>' + e.passingMarks + '</td>';
            html += '<td>' + e.duration + '</td>';
            html += '<td>' + (e.startDate || '-') + '</td>';
            html += '<td>' + (e.endDate || '-') + '</td>';
            html += '<td><span class="status-badge status-' + e.status.toLowerCase() + '">' + e.status + '</span></td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editOnlineExam(' + e.id + ')">Edit</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteOnlineExam(' + e.id + ')">Delete</button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (err) { console.error(err); }
}

function toggleAllOnlineExamCheckboxes() {
    const selectAll = document.getElementById('selectAllOnlineExams').checked;
    const checkboxes = document.querySelectorAll('.online-exam-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteSelectedOnlineExams() {
    const checkboxes = document.querySelectorAll('.online-exam-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one online exam to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} online exam(s)?`)) return;
    
    const examIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const examId of examIds) {
            const res = await fetch('/api/online-exams/' + examId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === examIds.length) {
            showNotification(`${deletedCount} online exam(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${examIds.length} online exam(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllOnlineExams').checked = false;
        loadOnlineExamTable();
    } catch (e) {
        console.error('Error deleting online exams:', e);
        showNotification('Error deleting online exams', 'error');
    }
}

let selectedQuestions = [];
let cachedQuestions = null;
let cachedCoursesForQuestions = null;
let currentFilteredQuestions = [];

function openOnlineExamModal() {
    document.getElementById('onlineExamModalTitle').textContent = 'Create Online Exam';
    document.getElementById('onlineExamId').value = '';
    document.getElementById('onlineExamCourse').value = '';
    document.getElementById('onlineExamTotalMarks').value = '';
    document.getElementById('onlineExamPassingMarks').value = '';
    document.getElementById('onlineExamDuration').value = '';
    document.getElementById('onlineExamStatus').value = 'Draft';
    document.getElementById('onlineExamStartDate').value = '';
    document.getElementById('onlineExamEndDate').value = '';
    document.getElementById('onlineExamInstructions').value = '';
    document.getElementById('shuffleQuestions').checked = false;
    document.getElementById('shuffleOptions').checked = false;
    document.getElementById('showResultImmediately').checked = true;
    document.getElementById('onlineExamMaxAttempts').value = '1';
    document.getElementById('disableTabSwitch').checked = false;
    document.getElementById('disableCopyPaste').checked = false;
    document.getElementById('enforceFullscreen').checked = false;
    document.getElementById('disableRightClick').checked = false;
    document.getElementById('enableWebcamMonitoring').checked = false;
    document.getElementById('enableIPRestriction').checked = false;
    document.getElementById('encryptQuestions').checked = false;
    document.getElementById('onlineExamName').value = '';
    document.getElementById('onlineExamNameCustom').value = '';
    document.getElementById('onlineExamNameCustom').style.display = 'none';
    selectedQuestions = [];
    updateSelectedQuestionsList();
    document.getElementById('onlineExamModal').classList.add('active');
    loadExamSchedulesAndCourses();
}

function closeOnlineExamModal() {
    document.getElementById('onlineExamModal').classList.remove('active');
}

function generateAIInstructions() {
    const duration = document.getElementById('onlineExamDuration').value || '60';
    const totalMarks = document.getElementById('onlineExamTotalMarks').value || '100';
    const passingMarks = document.getElementById('onlineExamPassingMarks').value || '40';
    const examName = document.getElementById('onlineExamNameCustom').value || document.getElementById('onlineExamName').value || 'this exam';
    
    const instructions = `Welcome to ${examName}!

Important Instructions:
• This exam consists of multiple choice questions
• Total duration: ${duration} minutes
• Total marks: ${totalMarks}
• Minimum passing marks: ${passingMarks}
• Read each question carefully before answering
• Once submitted, you cannot change your answers
• Do not refresh the page during the exam
• Ensure stable internet connection throughout

Exam Guidelines:
• All questions are compulsory
• Each question carries equal marks unless specified
• Negative marking may apply (if specified)
• Use a stable device with good internet connectivity
• Keep your webcam on if monitoring is enabled

Technical Requirements:
• Use a modern browser (Chrome, Firefox, Safari)
• Disable ad-blockers during the exam
• Ensure sufficient battery life if using a laptop
• Close all other tabs and applications

Good luck with your exam!`;

    document.getElementById('onlineExamInstructions').value = instructions;
    showNotification('Instructions generated successfully!', 'success');
}

async function loadExamSchedulesAndCourses() {
    try {
        const examSchedules = await fetch('/api/exam-schedules').then(r => r.json());
        const examNameSelect = document.getElementById('onlineExamName');
        examNameSelect.innerHTML = '<option value="">Select from Exam Schedule</option><option value="custom">-- Or Enter Custom Name --</option>' + examSchedules.map(e => '<option>' + e.exam + '</option>').join('');
        
        const courses = await fetch('/api/courses').then(r => r.json());
        const courseSelect = document.getElementById('onlineExamCourse');
        courseSelect.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
        
        // Add event listener for exam name dropdown
        examNameSelect.onchange = function() {
            if (this.value === 'custom') {
                document.getElementById('onlineExamNameCustom').style.display = 'block';
            } else {
                document.getElementById('onlineExamNameCustom').style.display = 'none';
            }
        };
    } catch (err) {
        console.error('Error loading data:', err);
    }
}

function openQuestionSelector() {
    document.getElementById('questionSelectorModal').classList.add('active');
    loadQuestionsForSelector();
}

function closeQuestionSelector() {
    document.getElementById('questionSelectorModal').classList.remove('active');
}

function renderQuestionSelectorList(questions) {
    const container = document.getElementById('questionSelectorList');
    const selectedIds = new Set(selectedQuestions.map(sq => sq.id));
    const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const parts = new Array(questions.length);
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const isSelected = selectedIds.has(q.id);
        parts[i] = '<div data-qid="' + q.id + '" style="padding:12px;border-bottom:1px solid #e2e8f0;cursor:pointer;' + (isSelected ? 'background:#e3f2fd;' : '') + '" onclick="toggleQuestionSelection(' + q.id + ')">'
            + '<input type="checkbox" id="question_' + q.id + '" ' + (isSelected ? 'checked' : '') + ' style="margin-right:8px;pointer-events:none;">'
            + '<strong>' + escapeHtml(q.text) + '</strong>'
            + '<br><small>Type: ' + escapeHtml(q.type) + ' | Course: ' + escapeHtml(q.courseName || q.course || '') + ' | Marks: ' + escapeHtml(q.marks) + '</small>'
            + '</div>';
    }
    container.innerHTML = parts.join('');
}

async function loadQuestionsForSelector() {
    try {
        const container = document.getElementById('questionSelectorList');
        if (!cachedQuestions) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Loading questions...</div>';
            const [qData, cData] = await Promise.all([
                fetch('/api/questions').then(r => r.json()),
                fetch('/api/courses').then(r => r.json())
            ]);
            cachedQuestions = Array.isArray(qData) ? qData : (qData.questions || []);
            cachedCoursesForQuestions = Array.isArray(cData) ? cData : (cData.courses || []);
            
            const courseFilter = document.getElementById('questionFilterCourse');
            courseFilter.innerHTML = '<option value="">All Courses</option>' + cachedCoursesForQuestions.map(c => '<option>' + c.name + '</option>').join('');
        }
        
        applyQuestionFilters();
        updateSelectedQuestionCount();
    } catch (err) {
        console.error('Error loading questions:', err);
    }
}

function applyQuestionFilters() {
    if (!cachedQuestions) return;
    const courseFilter = document.getElementById('questionFilterCourse').value;
    const typeFilter = document.getElementById('questionFilterType').value;
    
    let questions = cachedQuestions;
    if (courseFilter) {
        questions = questions.filter(q => (q.courseName || q.course) === courseFilter);
    }
    if (typeFilter) {
        questions = questions.filter(q => q.type === typeFilter);
    }
    
    currentFilteredQuestions = questions;
    renderQuestionSelectorList(questions);
    updateFilteredQuestionCount();
    syncSelectAllCheckbox();
}

function filterQuestions() {
    applyQuestionFilters();
}

function updateFilteredQuestionCount() {
    const el = document.getElementById('filteredQuestionCount');
    if (el) el.textContent = currentFilteredQuestions.length;
}

function syncSelectAllCheckbox() {
    const checkbox = document.getElementById('selectAllFilteredQuestions');
    if (!checkbox) return;
    if (currentFilteredQuestions.length === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
        return;
    }
    const selectedIds = new Set(selectedQuestions.map(sq => sq.id));
    const selectedCount = currentFilteredQuestions.filter(q => selectedIds.has(q.id)).length;
    if (selectedCount === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    } else if (selectedCount === currentFilteredQuestions.length) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
    } else {
        checkbox.checked = false;
        checkbox.indeterminate = true;
    }
}

function toggleSelectAllFilteredQuestions() {
    const checkbox = document.getElementById('selectAllFilteredQuestions');
    const selectAll = checkbox.checked;
    const selectedIds = new Set(selectedQuestions.map(sq => sq.id));
    
    if (selectAll) {
        // Add all filtered that aren't already selected
        currentFilteredQuestions.forEach(q => {
            if (!selectedIds.has(q.id)) selectedQuestions.push(q);
        });
    } else {
        // Remove all filtered from selection
        const filteredIds = new Set(currentFilteredQuestions.map(q => q.id));
        selectedQuestions = selectedQuestions.filter(q => !filteredIds.has(q.id));
    }
    
    renderQuestionSelectorList(currentFilteredQuestions);
    updateSelectedQuestionCount();
    syncSelectAllCheckbox();
}

function toggleQuestionSelection(questionId) {
    const row = document.querySelector('#questionSelectorList [data-qid="' + questionId + '"]');
    const checkbox = document.getElementById('question_' + questionId);
    const index = selectedQuestions.findIndex(q => q.id === questionId);
    
    if (index === -1) {
        const q = cachedQuestions ? cachedQuestions.find(x => x.id === questionId) : null;
        if (q) {
            selectedQuestions.push(q);
            if (checkbox) checkbox.checked = true;
            if (row) row.style.background = '#e3f2fd';
            updateSelectedQuestionCount();
            syncSelectAllCheckbox();
        } else {
            // Fallback for missing cache
            fetch('/api/questions/' + questionId).then(r => r.json()).then(q => {
                selectedQuestions.push(q);
                if (checkbox) checkbox.checked = true;
                if (row) row.style.background = '#e3f2fd';
                updateSelectedQuestionCount();
                syncSelectAllCheckbox();
            });
        }
    } else {
        selectedQuestions.splice(index, 1);
        if (checkbox) checkbox.checked = false;
        if (row) row.style.background = '';
        updateSelectedQuestionCount();
        syncSelectAllCheckbox();
    }
}

function updateSelectedQuestionCount() {
    document.getElementById('selectedQuestionCount').textContent = selectedQuestions.length;
}

function updateSelectedQuestionsList() {
    const container = document.getElementById('selectedQuestionsList');
    if (selectedQuestions.length === 0) {
        container.innerHTML = '<p style="color:#64748b;font-size:14px;">No questions selected</p>';
    } else {
        let html = '<p style="margin-bottom:8px;"><strong>' + selectedQuestions.length + ' questions selected</strong></p>';
        selectedQuestions.forEach(q => {
            html += '<div style="padding:4px 0;border-bottom:1px solid #e2e8f0;font-size:13px;">' + q.text + '</div>';
        });
        container.innerHTML = html;
    }
}

function confirmQuestionSelection() {
    closeQuestionSelector();
    updateSelectedQuestionsList();
}

async function saveOnlineExam() {
    const id = document.getElementById('onlineExamId').value;
    const examNameSelect = document.getElementById('onlineExamName').value;
    const examNameCustom = document.getElementById('onlineExamNameCustom').value;
    
    const examName = examNameSelect === 'custom' ? examNameCustom : examNameSelect;
    
    const data = {
        name: examName,
        course: document.getElementById('onlineExamCourse').value,
        totalMarks: parseInt(document.getElementById('onlineExamTotalMarks').value),
        passingMarks: parseInt(document.getElementById('onlineExamPassingMarks').value),
        duration: parseInt(document.getElementById('onlineExamDuration').value),
        status: document.getElementById('onlineExamStatus').value,
        startDate: document.getElementById('onlineExamStartDate').value,
        endDate: document.getElementById('onlineExamEndDate').value,
        instructions: document.getElementById('onlineExamInstructions').value,
        questions: selectedQuestions,
        shuffleQuestions: document.getElementById('shuffleQuestions').checked,
        shuffleOptions: document.getElementById('shuffleOptions').checked,
        showResultImmediately: document.getElementById('showResultImmediately').checked,
        maxAttempts: parseInt(document.getElementById('onlineExamMaxAttempts').value) || 1,
        security: {
            disableTabSwitch: document.getElementById('disableTabSwitch').checked,
            disableCopyPaste: document.getElementById('disableCopyPaste').checked,
            enforceFullscreen: document.getElementById('enforceFullscreen').checked,
            disableRightClick: document.getElementById('disableRightClick').checked,
            enableWebcamMonitoring: document.getElementById('enableWebcamMonitoring').checked,
            enableIPRestriction: document.getElementById('enableIPRestriction').checked,
            encryptQuestions: document.getElementById('encryptQuestions').checked
        }
    };
    
    if (!data.name || !data.course || !data.totalMarks || !data.passingMarks || !data.duration) {
        showNotification('Please fill all required fields!', 'error');
        return;
    }
    
    if (selectedQuestions.length === 0) {
        showNotification('Please select at least one question!', 'error');
        return;
    }
    
    try {
        const url = id ? '/api/online-exams/' + id : '/api/online-exams';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (result.success) {
            showNotification(id ? 'Online exam updated!' : 'Online exam created!', 'success');
            closeOnlineExamModal();
            loadOnlineExamTable();
        } else {
            showNotification(result.message || 'Error saving online exam!', 'error');
        }
    } catch (e) {
        console.error('Error saving online exam:', e);
        showNotification('Error saving online exam!', 'error');
    }
}

async function editOnlineExam(id) {
    try {
        const res = await fetch('/api/online-exams/' + id);
        const exam = await res.json();
        
        document.getElementById('onlineExamModalTitle').textContent = 'Edit Online Exam';
        document.getElementById('onlineExamId').value = exam.id;
        document.getElementById('onlineExamCourse').value = exam.course || '';
        document.getElementById('onlineExamTotalMarks').value = exam.totalMarks || '';
        document.getElementById('onlineExamPassingMarks').value = exam.passingMarks || '';
        document.getElementById('onlineExamDuration').value = exam.duration || '';
        document.getElementById('onlineExamStatus').value = exam.status || 'Draft';
        document.getElementById('onlineExamStartDate').value = exam.startDate || '';
        document.getElementById('onlineExamEndDate').value = exam.endDate || '';
        document.getElementById('onlineExamInstructions').value = exam.instructions || '';
        document.getElementById('shuffleQuestions').checked = exam.shuffleQuestions || false;
        document.getElementById('shuffleOptions').checked = exam.shuffleOptions || false;
        document.getElementById('showResultImmediately').checked = exam.showResultImmediately !== false;
        document.getElementById('onlineExamMaxAttempts').value = exam.maxAttempts || 1;
        document.getElementById('disableTabSwitch').checked = exam.security?.disableTabSwitch || false;
        document.getElementById('disableCopyPaste').checked = exam.security?.disableCopyPaste || false;
        document.getElementById('enforceFullscreen').checked = exam.security?.enforceFullscreen || false;
        document.getElementById('disableRightClick').checked = exam.security?.disableRightClick || false;
        document.getElementById('enableWebcamMonitoring').checked = exam.security?.enableWebcamMonitoring || false;
        document.getElementById('enableIPRestriction').checked = exam.security?.enableIPRestriction || false;
        document.getElementById('encryptQuestions').checked = exam.security?.encryptQuestions || false;
        
        // Load exam schedules into dropdown first
        await loadExamSchedulesAndCourses();
        
        // Check if exam name exists in dropdown, otherwise use custom
        const examNameSelect = document.getElementById('onlineExamName');
        const examNameCustom = document.getElementById('onlineExamNameCustom');
        
        let examNameExists = false;
        for (let i = 0; i < examNameSelect.options.length; i++) {
            if (examNameSelect.options[i].value === exam.name) {
                examNameSelect.value = exam.name;
                examNameExists = true;
                break;
            }
        }
        
        if (!examNameExists) {
            examNameSelect.value = 'custom';
            examNameCustom.value = exam.name || '';
            examNameCustom.style.display = 'block';
        } else {
            examNameCustom.style.display = 'none';
        }
        
        selectedQuestions = exam.questions || [];
        updateSelectedQuestionsList();
        document.getElementById('onlineExamModal').classList.add('active');
    } catch (e) {
        console.error('Error loading online exam:', e);
        showNotification('Error loading online exam!', 'error');
    }
}

async function deleteOnlineExam(id) {
    if (!confirm('Are you sure you want to delete this online exam?')) return;
    
    try {
        const res = await fetch('/api/online-exams/' + id, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Online exam deleted!', 'success');
            loadOnlineExamTable();
        } else {
            showNotification('Error deleting online exam!', 'error');
        }
    } catch (e) {
        console.error('Error deleting online exam:', e);
        showNotification('Error deleting online exam!', 'error');
    }
}

async function loadExamGradingTable() {
    try {
        const grades = await fetch('/api/exam-grades').then(r => r.json());
        const tbody = document.querySelector('#examGradingTable tbody');
        let html = '';
        grades.forEach(g => {
            html += '<tr>';
            html += '<td>' + g.student + '</td>';
            html += '<td>' + g.exam + '</td>';
            html += '<td>' + g.obtained + '</td>';
            html += '<td>' + g.total + '</td>';
            html += '<td>' + g.percentage + '</td>';
            html += '<td>' + g.grade + '</td>';
            html += '<td>' + g.status + '</td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="editGrade(' + g.id + ')">Edit</button>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (err) { console.error(err); }
}

async function loadExamReportsTable() {
    try {
        // Populate dropdowns on first load
        const courseSelect = document.getElementById('reportCourse');
        const examSelect = document.getElementById('reportExam');
        if (courseSelect && courseSelect.options.length <= 1) {
            const courses = await fetch('/api/courses').then(r => r.json());
            courses.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.name;
                courseSelect.appendChild(opt);
            });
        }
        if (examSelect && examSelect.options.length <= 1) {
            const exams = await fetch('/api/online-exams').then(r => r.json());
            exams.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.examName || e.title || e.name || '';
                opt.textContent = e.examName || e.title || e.name || 'Untitled';
                examSelect.appendChild(opt);
            });
        }

        // Build query params
        const params = new URLSearchParams();
        if (courseSelect && courseSelect.value) params.append('course', courseSelect.value);
        if (examSelect && examSelect.value) params.append('exam', examSelect.value);
        const fromDate = document.getElementById('reportFromDate');
        const toDate = document.getElementById('reportToDate');
        if (fromDate && fromDate.value) params.append('fromDate', fromDate.value);
        if (toDate && toDate.value) params.append('toDate', toDate.value);

        const reports = await fetch('/api/exam-reports?' + params.toString()).then(r => r.json());
        const tbody = document.querySelector('#examReportsTable tbody');
        const summary = document.getElementById('reportSummary');

        if (!reports || reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px;">No exam reports found for selected criteria</td></tr>';
            if (summary) summary.innerHTML = '';
            return;
        }

        // Summary stats
        const totalStudents = reports.length;
        const avgPercentage = totalStudents > 0
            ? (reports.reduce((sum, r) => sum + (parseFloat(r.percentage) || 0), 0) / totalStudents).toFixed(1)
            : 0;
        const passed = reports.filter(r => r.status === 'Passed' || (parseFloat(r.percentage) || 0) >= 40).length;
        const failed = totalStudents - passed;

        if (summary) {
            summary.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
                    <div style="background:#fff;padding:14px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);text-align:center;">
                        <div style="font-size:24px;font-weight:700;color:#667eea;">${totalStudents}</div>
                        <div style="font-size:12px;color:#64748b;">Total Students</div>
                    </div>
                    <div style="background:#fff;padding:14px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);text-align:center;">
                        <div style="font-size:24px;font-weight:700;color:#48bb78;">${avgPercentage}%</div>
                        <div style="font-size:12px;color:#64748b;">Avg Percentage</div>
                    </div>
                    <div style="background:#fff;padding:14px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);text-align:center;">
                        <div style="font-size:24px;font-weight:700;color:#10b981;">${passed}</div>
                        <div style="font-size:12px;color:#64748b;">Passed</div>
                    </div>
                    <div style="background:#fff;padding:14px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);text-align:center;">
                        <div style="font-size:24px;font-weight:700;color:#ef4444;">${failed}</div>
                        <div style="font-size:12px;color:#64748b;">Failed</div>
                    </div>
                </div>
            `;
        }

        let html = '';
        reports.forEach(r => {
            html += '<tr>';
            html += '<td style="font-weight:600;">' + (r.studentName || r.studentId || '-') + '</td>';
            html += '<td>' + (r.examName || r.exam || '-') + '</td>';
            html += '<td>' + (r.obtained || 0) + ' / ' + (r.total || '-') + '</td>';
            html += '<td>' + (r.percentage || 0) + '%</td>';
            html += '<td><span style="font-weight:600;color:' + ((r.percentage || 0) >= 40 ? '#10b981' : '#ef4444') + ';">' + (r.grade || '-') + '</span></td>';
            html += '<td>' + (r.date || '-') + '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (err) { console.error('Exam reports error:', err); }
}

function generateExamReport() {
    const course = document.getElementById('reportCourse')?.value || '';
    const exam = document.getElementById('reportExam')?.value || '';
    const fromDate = document.getElementById('reportFromDate')?.value || '';
    const toDate = document.getElementById('reportToDate')?.value || '';

    const params = new URLSearchParams();
    if (course) params.append('course', course);
    if (exam) params.append('exam', exam);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);

    showNotification('Preparing report download...', 'info');

    fetch('/api/exam-reports?' + params.toString())
        .then(r => r.json())
        .then(data => {
            if (!data || data.length === 0) {
                showNotification('No data to export', 'warning');
                return;
            }
            // Simple CSV export
            const headers = ['Student Name', 'Exam', 'Course', 'Obtained', 'Total', 'Percentage', 'Grade', 'Status', 'Date'];
            const rows = data.map(r => [
                r.studentName || '', r.examName || '', r.course || '',
                r.obtained || 0, r.total || 0, r.percentage || 0,
                r.grade || '', r.status || '', r.date || ''
            ]);
            const csv = [headers.join(','), ...rows.map(row => row.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'exam-report-' + new Date().toISOString().split('T')[0] + '.csv';
            a.click();
            URL.revokeObjectURL(url);
            showNotification('Report downloaded as CSV!', 'success');
        })
        .catch(err => {
            console.error(err);
            showNotification('Failed to generate report', 'error');
        });
}

// ===== Manual Grading =====
async function loadPendingGrading() {
    try {
        // Load filter dropdowns on first call
        const examSelect = document.getElementById('gradingFilterExam');
        const courseSelect = document.getElementById('gradingFilterCourse');
        if (examSelect && examSelect.options.length <= 1) {
            const exams = await fetch('/api/online-exams').then(r => r.json());
            exams.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = e.examName || e.title || e.name || 'Untitled';
                examSelect.appendChild(opt);
            });
        }
        if (courseSelect && courseSelect.options.length <= 1) {
            const courses = await fetch('/api/courses').then(r => r.json());
            courses.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.name;
                courseSelect.appendChild(opt);
            });
        }

        // Build query params
        const params = new URLSearchParams();
        if (examSelect && examSelect.value) params.append('examId', examSelect.value);
        if (courseSelect && courseSelect.value) params.append('courseId', courseSelect.value);
        const statusSel = document.getElementById('gradingFilterStatus');
        if (statusSel && statusSel.value) params.append('status', statusSel.value);
        const studentInput = document.getElementById('gradingFilterStudent');
        if (studentInput && studentInput.value.trim()) params.append('studentName', studentInput.value.trim());

        const data = await fetch('/api/grading/pending?' + params.toString()).then(r => r.json());
        const tbody = document.querySelector('#pendingGradingTable tbody');
        if (!tbody) return;

        let items = data || [];

        // Client-side student name filter (since API doesn't have studentName param yet)
        if (studentInput && studentInput.value.trim()) {
            const q = studentInput.value.trim().toLowerCase();
            items = items.filter(item => {
                const name = (item.attempt && (item.attempt.studentName || item.attempt.studentId)) || '';
                return String(name).toLowerCase().includes(q);
            });
        }

        // Sort
        const sortBy = document.getElementById('gradingSortBy');
        if (sortBy && sortBy.value) {
            const s = sortBy.value;
            items.sort((a, b) => {
                if (s === 'date-desc') return (b.attempt && b.attempt.id || 0) - (a.attempt && a.attempt.id || 0);
                if (s === 'date-asc') return (a.attempt && a.attempt.id || 0) - (b.attempt && b.attempt.id || 0);
                if (s === 'score-desc') return (b.attempt && b.attempt.score || 0) - (a.attempt && a.attempt.score || 0);
                if (s === 'score-asc') return (a.attempt && a.attempt.score || 0) - (b.attempt && b.attempt.score || 0);
                return 0;
            });
        }

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px;">No attempts found matching criteria</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(item => {
            const a = item.attempt || {};
            const e = item.exam || {};
            const statusClass = item.gradingStatus === 'graded' ? 'enq-badge-replied' : item.gradingStatus === 'Rejected' ? 'enq-badge-pending' : 'enq-badge-pending';
            const statusStyle = item.gradingStatus === 'graded' ? '' : item.gradingStatus === 'Rejected' ? 'background:#fee2e2;color:#ef4444;' : '';
            return `<tr>
                <td style="font-weight:600;">${a.studentName || a.studentId || '-'}</td>
                <td>${e.examName || '-'}</td>
                <td>${a.course || '-'}</td>
                <td>${item.subjectiveCount || 0}</td>
                <td>${item.gradedCount || 0} / ${item.subjectiveCount || 0}</td>
                <td><span class="enq-badge ${statusClass}" style="${statusStyle}">${item.gradingStatus || 'Pending'}</span></td>
                <td>${a.submittedAt ? formatDateTime(a.submittedAt) : '-'}</td>
                <td>
                    ${item.gradingStatus === 'Pending' ? `<button class="action-btn edit-btn" onclick="approveReEval(${item.id})" title="Approve"><i class="fas fa-check"></i></button><button class="action-btn delete-btn" onclick="rejectReEval(${item.id})" title="Reject" style="margin-left:5px;"><i class="fas fa-times"></i></button>` : '<span style="color:#94a3b8;font-size:12px;">Resolved</span>'}
                </td>
            </tr>`;
        }).join('');
    } catch (err) { console.error('Manual grading error:', err); }
}

function exportGradingList() {
    showNotification('Export feature coming soon', 'info');
}

function openGradingModal(attemptId) {
    showNotification('Grading detail view: attempt ID ' + attemptId, 'info');
}

function viewGrading(attemptId) {
    showNotification('Viewing graded attempt ID ' + attemptId, 'info');
}

// ===== Exam Analytics =====
async function loadAnalyticsPage() {
    try {
        const examSelect = document.getElementById('analyticsExam');
        if (examSelect && examSelect.options.length <= 1) {
            const exams = await fetch('/api/online-exams').then(r => r.json());
            exams.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = e.examName || e.title || e.name || 'Untitled';
                examSelect.appendChild(opt);
            });
        }
        // Load overall analytics initially
        loadAnalytics();
    } catch (err) { console.error('Analytics page error:', err); }
}

async function loadAnalytics() {
    try {
        const examId = document.getElementById('analyticsExam')?.value;
        const [grades, attempts, exams] = await Promise.all([
            fetch('/api/exam-grades').then(r => r.json()).catch(() => ({ grades: [] })),
            fetch('/api/exam-attempts').then(r => r.json()).catch(() => []),
            fetch('/api/online-exams').then(r => r.json()).catch(() => [])
        ]);

        const gradeList = Array.isArray(grades) ? grades : (grades.grades || []);
        let filtered = gradeList;
        let filteredAttempts = attempts;

        if (examId) {
            filtered = gradeList.filter(g => g.examId == examId || g.exam == examId);
            filteredAttempts = attempts.filter(a => a.examId == examId);
        }

        // Stats
        const totalAttempts = filtered.length;
        const avgScore = totalAttempts > 0
            ? (filtered.reduce((sum, g) => sum + (parseFloat(g.percentage) || 0), 0) / totalAttempts).toFixed(1)
            : 0;
        const passRate = totalAttempts > 0
            ? ((filtered.filter(g => g.passed || g.grade && !['F','Fail'].includes(g.grade)).length / totalAttempts) * 100).toFixed(1)
            : 0;
        const highestScore = totalAttempts > 0
            ? Math.max(...filtered.map(g => parseFloat(g.percentage) || 0)).toFixed(1)
            : 0;

        document.getElementById('statTotalAttempts').textContent = totalAttempts;
        document.getElementById('statAverageScore').textContent = avgScore;
        document.getElementById('statPassRate').textContent = passRate + '%';
        document.getElementById('statHighestScore').textContent = highestScore;

        // Question analysis - aggregate from attempts
        const questionStats = {};
        filteredAttempts.forEach(a => {
            if (a.answers && Array.isArray(a.answers)) {
                a.answers.forEach((ans, idx) => {
                    if (!questionStats[idx]) {
                        questionStats[idx] = { correct: 0, total: 0, questionText: 'Question ' + (idx + 1) };
                    }
                    questionStats[idx].total++;
                    if (ans && ans.isCorrect) questionStats[idx].correct++;
                });
            }
        });

        const tbody = document.querySelector('#questionAnalysisTable tbody');
        if (Object.keys(questionStats).length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px;">No question-level data available</td></tr>';
            return;
        }

        tbody.innerHTML = Object.entries(questionStats).map(([idx, stat]) => {
            const rate = stat.total > 0 ? ((stat.correct / stat.total) * 100).toFixed(1) : 0;
            return `<tr>
                <td>${stat.questionText}</td>
                <td>${stat.correct}</td>
                <td>${stat.total}</td>
                <td style="font-weight:600;color:${rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444'};">${rate}%</td>
            </tr>`;
        }).join('');
    } catch (err) { console.error('Analytics error:', err); }
}

// ===== Re-evaluation =====
async function loadReEvaluationTable() {
    try {
        const requests = await fetch('/api/re-evaluation').then(r => r.json()).catch(() => []);
        const tbody = document.querySelector('#reEvaluationTable tbody');
        if (!tbody) return;

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px;">No re-evaluation requests yet</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(r => {
            const statusClass = r.status === 'Approved' ? 'enq-badge-replied' : r.status === 'Rejected' ? 'enq-badge-pending' : 'enq-badge-pending';
            const statusStyle = r.status === 'Approved' ? '' : r.status === 'Rejected' ? 'background:#fee2e2;color:#ef4444;' : '';
            return `<tr>
                <td style="font-weight:600;">${r.studentName || r.studentId || '-'}</td>
                <td>${r.examName || '-'}</td>
                <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${(r.reason || '').replace(/"/g, '&quot;')}">${r.reason || '-'}</td>
                <td><span class="enq-badge ${statusClass}" style="${statusStyle}">${r.status || 'Pending'}</span></td>
                <td>${r.requestedAt ? formatDateTime(r.requestedAt) : '-'}</td>
                <td>
                    ${r.status === 'Pending' ? `<button class="action-btn edit-btn" onclick="approveReEval(${r.id})" title="Approve"><i class="fas fa-check"></i></button><button class="action-btn delete-btn" onclick="rejectReEval(${r.id})" title="Reject" style="margin-left:5px;"><i class="fas fa-times"></i></button>` : '<span style="color:#94a3b8;font-size:12px;">Resolved</span>'}
                </td>
            </tr>`;
        }).join('');
    } catch (err) { console.error('Re-evaluation error:', err); }
}

async function approveReEval(id) {
    if (!confirm('Approve this re-evaluation request?')) return;
    try {
        const res = await fetch('/api/re-evaluation/' + id + '/approve', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Approved' })
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Re-evaluation approved!', 'success');
            loadReEvaluationTable();
        } else {
            showNotification(data.message || 'Failed to approve', 'error');
        }
    } catch (err) { showNotification('Error: ' + err.message, 'error'); }
}

async function rejectReEval(id) {
    const comments = prompt('Rejection reason (optional):');
    if (comments === null) return; // Cancelled
    try {
        const res = await fetch('/api/re-evaluation/' + id + '/approve', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Rejected', comments: comments || 'Rejected by admin' })
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Re-evaluation rejected', 'warning');
            loadReEvaluationTable();
        } else {
            showNotification(data.message || 'Failed to reject', 'error');
        }
    } catch (err) { showNotification('Error: ' + err.message, 'error'); }
}

function generateCertificate() {
    document.getElementById('certificateStudent').value = '';
    document.getElementById('certificateIssueDate').value = new Date().toISOString().split('T')[0];
    loadStudentsForCertificateModal();
    document.getElementById('certificateModal').classList.add('active');
}

function toggleCertificateFields() {
    const certificateType = document.getElementById('certificateType').value;
    const courseFields = document.getElementById('courseFields');
    const achievementFields = document.getElementById('achievementFields');
    const eventFields = document.getElementById('eventFields');
    const excellenceFields = document.getElementById('excellenceFields');
    const internshipFields = document.getElementById('internshipFields');
    const attendanceFields = document.getElementById('attendanceFields');
    
    // Hide all fields first
    courseFields.style.display = 'none';
    achievementFields.style.display = 'none';
    eventFields.style.display = 'none';
    excellenceFields.style.display = 'none';
    internshipFields.style.display = 'none';
    attendanceFields.style.display = 'none';
    
    // Show appropriate fields based on certificate type
    switch (certificateType) {
        case 'Course Completion':
            courseFields.style.display = 'block';
            break;
        case 'Achievement':
            achievementFields.style.display = 'block';
            break;
        case 'Participation':
            eventFields.style.display = 'block';
            break;
        case 'Excellence':
            excellenceFields.style.display = 'block';
            break;
        case 'Internship':
            internshipFields.style.display = 'block';
            break;
        case 'Attendance':
            attendanceFields.style.display = 'block';
            break;
    }
}

async function loadStudentsForCertificateModal() {
    try {
        const students = await fetch('/api/students').then(r => r.json());
        const studentSelect = document.getElementById('certificateStudent');
        studentSelect.innerHTML = '<option value="">Select Student</option>' + students.map(s => '<option value="' + s.id + '">' + s.name + ' (' + s.course + ')</option>').join('');
    } catch (e) {}
}

async function saveCertificate() {
    const studentId = document.getElementById('certificateStudent').value;
    const certificateType = document.getElementById('certificateType').value;
    const template = document.getElementById('certificateTemplate').value;
    const grade = document.getElementById('certificateGrade').value;
    const remarks = document.getElementById('certificateRemarks').value;
    const certificateNumber = document.getElementById('certificateNumber').value;
    const issueDate = document.getElementById('certificateIssueDate').value;
    
    // Achievement fields
    const achievementTitle = document.getElementById('achievementTitle').value;
    const awardRank = document.getElementById('awardRank').value;
    
    // Event fields
    const eventName = document.getElementById('eventName').value;
    const eventDuration = document.getElementById('eventDuration').value;
    const eventLocation = document.getElementById('eventLocation').value;
    const participationLevel = document.getElementById('participationLevel').value;
    
    // Excellence fields
    const excellenceCategory = document.getElementById('excellenceCategory').value;
    const excellenceAward = document.getElementById('excellenceAward').value;
    
    // Internship fields
    const internshipRole = document.getElementById('internshipRole').value;
    const companyName = document.getElementById('companyName').value;
    const internshipDuration = document.getElementById('internshipDuration').value;
    const performanceRating = document.getElementById('performanceRating').value;
    
    // Attendance fields
    const attendancePeriod = document.getElementById('attendancePeriod').value;
    const attendancePercentage = document.getElementById('attendancePercentage').value;
    
    if (!studentId || !certificateType || !issueDate) {
        showNotification('Please fill all required fields!', 'error');
        return;
    }
    
    // Type-specific validation
    if (certificateType === 'Achievement' && !achievementTitle) {
        showNotification('Please enter achievement title!', 'error');
        return;
    }
    if (certificateType === 'Participation' && !eventName) {
        showNotification('Please enter event name!', 'error');
        return;
    }
    if (certificateType === 'Excellence' && !excellenceCategory) {
        showNotification('Please enter excellence category!', 'error');
        return;
    }
    if (certificateType === 'Internship' && (!internshipRole || !companyName)) {
        showNotification('Please enter internship role and company!', 'error');
        return;
    }
    if (certificateType === 'Attendance' && !attendancePeriod) {
        showNotification('Please enter attendance period!', 'error');
        return;
    }
    
    try {
        const students = await fetch('/api/students').then(r => r.json());
        const student = students.find(s => s.id == studentId);
        
        const data = {
            studentId: studentId,
            studentName: student ? student.name : '',
            course: student ? student.course : '',
            certificateType: certificateType,
            template: template,
            grade: grade,
            remarks: remarks,
            certificateNumber: certificateNumber,
            issueDate: issueDate,
            achievementTitle: achievementTitle,
            awardRank: awardRank,
            eventName: eventName,
            eventDuration: eventDuration,
            eventLocation: eventLocation,
            participationLevel: participationLevel,
            excellenceCategory: excellenceCategory,
            excellenceAward: excellenceAward,
            internshipRole: internshipRole,
            companyName: companyName,
            internshipDuration: internshipDuration,
            performanceRating: performanceRating,
            attendancePeriod: attendancePeriod,
            attendancePercentage: attendancePercentage
        };
        
        await fetch('/api/certificates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeModal('certificateModal');
        loadCertificatesTable();
        showNotification('Certificate generated!', 'success');
    } catch (e) { showNotification('Error!', 'error'); }
}

async function downloadCertificate(id) {
    try {
        const res = await fetch('/api/certificates/' + id);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Certificate.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (e) { showNotification('Error downloading certificate!', 'error'); }
}

async function deleteCertificate(id) {
    if (!confirm('Are you sure you want to delete this certificate?')) return;
    
    try {
        await fetch('/api/certificates/' + id, { method: 'DELETE' });
        loadCertificatesTable();
        showNotification('Certificate deleted!', 'success');
    } catch (e) { showNotification('Error deleting certificate!', 'error'); }
}

function generateBulkCertificates() {
    document.getElementById('bulkIssueDate').value = new Date().toISOString().split('T')[0];
    loadCoursesForBulkCertificate();
    document.getElementById('bulkCertificateModal').classList.add('active');
}

async function loadCoursesForBulkCertificate() {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const courseSelect = document.getElementById('bulkCourse');
        courseSelect.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option value="' + c.name + '">' + c.name + '</option>').join('');
        
        // Load batches when course changes
        courseSelect.onchange = async () => {
            const selectedCourse = courseSelect.value;
            const batchSelect = document.getElementById('bulkBatch');
            
            if (!selectedCourse) {
                batchSelect.innerHTML = '<option value="">Select Batch</option>';
                return;
            }
            
            const batches = await fetch('/api/batches').then(r => r.json());
            const courseBatches = batches.filter(b => b.course === selectedCourse);
            batchSelect.innerHTML = '<option value="">Select Batch</option>' + courseBatches.map(b => '<option value="' + b.name + '">' + b.name + '</option>').join('');
        };
    } catch (e) {}
}

async function loadStudentsForBulkCertificate() {
    try {
        const course = document.getElementById('bulkCourse').value;
        const batch = document.getElementById('bulkBatch').value;
        
        if (!course || !batch) {
            document.getElementById('bulkStudentsList').innerHTML = '<p style="color: #64748b;">Select course and batch to load students</p>';
            return;
        }
        
        const students = await fetch('/api/students').then(r => r.json());
        const filteredStudents = students.filter(s => s.course === course && s.batch === batch);
        
        const studentsList = document.getElementById('bulkStudentsList');
        studentsList.innerHTML = filteredStudents.map(s => {
            let html = '';
            html += '<div style="display: flex; align-items: center; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">';
            html += '<input type="checkbox" class="bulk-student-checkbox" value="' + s.id + '" checked style="margin-right: 10px;">';
            html += '<span>' + s.name + ' (' + s.rollNo + ')</span>';
            html += '</div>';
            return html;
        }).join('');
    } catch (e) {}
}

async function saveBulkCertificates() {
    const course = document.getElementById('bulkCourse').value;
    const batch = document.getElementById('bulkBatch').value;
    const certificateType = document.getElementById('bulkCertificateType').value;
    const template = document.getElementById('bulkTemplate').value;
    const grade = document.getElementById('bulkGrade').value;
    const remarks = document.getElementById('bulkRemarks').value;
    const issueDate = document.getElementById('bulkIssueDate').value;
    
    if (!course || !batch || !certificateType || !issueDate) {
        showNotification('Please fill all required fields!', 'error');
        return;
    }
    
    const checkboxes = document.querySelectorAll('.bulk-student-checkbox:checked');
    const studentIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (studentIds.length === 0) {
        showNotification('Please select at least one student!', 'error');
        return;
    }
    
    try {
        await fetch('/api/certificates/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentIds: studentIds,
                certificateType: certificateType,
                template: template,
                grade: grade,
                remarks: remarks,
                issueDate: issueDate
            })
        });
        closeModal('bulkCertificateModal');
        loadCertificatesTable();
        showNotification(studentIds.length + ' certificates generated!', 'success');
    } catch (e) { showNotification('Error!', 'error'); }
}

async function viewCertificate(id) {
    try {
        const res = await fetch('/api/certificates');
        const data = await res.json();
        
        if (!data.success || !data.certificates) {
            showNotification('Error loading certificates!', 'error');
            return;
        }
        
        const certificate = data.certificates.find(c => c.id == id);
        if (!certificate) {
            showNotification('Certificate not found!', 'error');
            return;
        }
        
        // Open certificate view in new window
        window.open('/api/students/' + certificate.studentId + '/certificate/view', '_blank');
        showNotification('Certificate opened!', 'success');
    } catch (e) { 
        console.error('Error viewing certificate:', e);
        showNotification('Error viewing certificate!', 'error'); 
    }
}

async function loadBatchesForCourse(courseName) {
    const data = await fetch('/api/batches/seats').then(r => r.json());
    const sel = document.getElementById('sBatch');
    sel.innerHTML = '<option value="">-- Select Batch --</option>';
    if (data.length === 0) {
        sel.innerHTML += '<option disabled>No batches available</option>';
        return;
    }
    data.forEach(b => {
        const available = b.available > 0 ? '(' + b.available + ' seats available)' : '(FULL)';
        const opt = document.createElement('option');
        opt.value = b.name; opt.dataset.batchId = b.id;
        opt.textContent = b.name + ' — ' + (b.timing || '') + ' ' + available;
        if (b.available === 0) opt.disabled = true;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', function() {
        const selected = this.options[this.selectedIndex];
        document.getElementById('sBatchId') && (document.getElementById('sBatchId').value = selected?.dataset?.batchId || '');
    });
}

// ===== Razorpay =====
async function initiateRazorpay() {
    const amount = parseInt(document.getElementById('sPayNow').value.replace(/[^0-9]/g, ''));
    if (!amount) { showNotification('Pehle payment amount calculate karo!', 'error'); return; }
    try {
        const res = await fetch('/api/payment/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
        const data = await res.json();
        if (!data.success) { showNotification(data.error || 'Order create failed. Razorpay keys check karein Settings mein.', 'error'); return; }
        const options = {
            key: data.key, amount: data.order.amount, currency: 'INR',
            name: document.getElementById('adminSiteName')?.textContent || 'Genius Education',
            description: 'Admission Fee — ' + (document.getElementById('sCourse')?.value || ''),
            order_id: data.order.id,
            handler: function(response) {
                document.getElementById('sTransactionId').value = response.razorpay_payment_id;
                document.getElementById('razorpayStatus').style.display = 'block';
                document.getElementById('razorpayBtn').textContent = '✅ Payment Done';
                document.getElementById('razorpayBtn').disabled = true;
                showNotification('Payment successful! ₹' + (amount) + ' received.', 'success');
            },
            prefill: { name: document.getElementById('sName')?.value || '', email: document.getElementById('sEmail')?.value || '', contact: document.getElementById('sPhone')?.value || '' },
            theme: { color: '#2563eb' }
        };
        new Razorpay(options).open();
    } catch(e) { showNotification('Payment gateway error: ' + e.message, 'error'); }
}

// ===== Document helpers =====
function showSingleDoc(input, labelId) {
    const f = input.files[0];
    document.getElementById(labelId).textContent = f ? '📎 ' + f.name : 'Click to upload';
}

// ===== Qualification / Marks Helpers =====
const SUBJECTS_12 = {
    Science:  [['Physics',100],['Chemistry',100],['Mathematics',100],['English',100],['Hindi / Other',100]],
    Commerce: [['Accountancy',100],['Business Studies',100],['Economics',100],['English',100],['Mathematics / IP',100]],
    Arts:     [['History',100],['Geography',100],['Political Science',100],['English',100],['Hindi',100]]
};
const GRAD_DEFAULT = [['Year 1 / Sem 1-2',700],['Year 2 / Sem 3-4',700],['Year 3 / Sem 5-6',700]];

function getDivision(pct) {
    if (pct >= 60) return { text: 'First Division ✅', cls: 'div-first' };
    if (pct >= 45) return { text: 'Second Division', cls: 'div-second' };
    if (pct >= 33) return { text: 'Third Division', cls: 'div-third' };
    return { text: 'Fail ❌', cls: 'div-fail' };
}

function buildSubjectRow(tbodyId, name = '', maxM = 100, obtM = '') {
    const tbody = document.getElementById(tbodyId);
    const tr = document.createElement('tr');
    let html = '';
    html += '<td><input type="text" class="marks-subject-input" value="' + name + '" placeholder="Subject" oninput="recalcPercent(\'' + tbodyId + '\')"></td>';
    html += '<td><input type="number" class="marks-input max-marks" value="' + maxM + '" min="0" max="1000" oninput="recalcPercent(\'' + tbodyId + '\')"></td>';
    html += '<td><input type="number" class="marks-input obt-marks" value="' + obtM + '" min="0" placeholder="0" oninput="recalcPercent(\'' + tbodyId + '\')"></td>';
    html += '<td><span class="row-pct">—</span></td>';
    html += '<td><button type="button" class="remove-row-btn" onclick="removeSubjectRow(this,\'' + tbodyId + '\')"><i class="fas fa-times"></i></button></td>';
    tr.innerHTML = html;
    tbody.appendChild(tr);
    recalcPercent(tbodyId);
}

function addSubjectRow(tbodyId) { buildSubjectRow(tbodyId); }

function removeSubjectRow(btn, tbodyId) {
    btn.closest('tr').remove();
    recalcPercent(tbodyId);
}

function recalcPercent(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    let totalMax = 0, totalObt = 0;
    tbody.querySelectorAll('tr').forEach(row => {
        const max = parseFloat(row.querySelector('.max-marks')?.value) || 0;
        const obt = parseFloat(row.querySelector('.obt-marks')?.value) || 0;
        const rowPct = row.querySelector('.row-pct');
        totalMax += max; totalObt += obt;
        if (rowPct) rowPct.textContent = max > 0 ? ((obt / max) * 100).toFixed(1) + '%' : '—';
    });
    const isGrad = tbodyId === 'marksGradBody';
    const prefix = isGrad ? 'Grad' : '12';
    const maxEl = document.getElementById('max' + prefix + 'Total');
    const obtEl = document.getElementById('obt' + prefix + 'Total');
    const pctEl = document.getElementById('pct' + prefix);
    const divEl = document.getElementById('div' + prefix);
    if (maxEl) maxEl.textContent = totalMax;
    if (obtEl) obtEl.textContent = totalObt;
    if (pctEl && totalMax > 0) {
        const pct = (totalObt / totalMax) * 100;
        pctEl.textContent = pct.toFixed(2) + '%';
        const d = getDivision(pct);
        pctEl.className = 'pct-display ' + d.cls;
        if (divEl) { divEl.textContent = d.text; divEl.className = 'div-badge ' + d.cls; }
    } else if (pctEl) {
        pctEl.textContent = '—'; pctEl.className = 'pct-display';
        if (divEl) { divEl.textContent = '—'; divEl.className = 'div-badge'; }
    }
}

function load12Subjects() {
    const stream = document.getElementById('s12Stream').value;
    const tbody = document.getElementById('marks12Body');
    tbody.innerHTML = '';
    (SUBJECTS_12[stream] || SUBJECTS_12['Science']).forEach(([n, m]) => buildSubjectRow('marks12Body', n, m, ''));
}

function onCourseChange() {
    const val = document.getElementById('sCourse').value.toUpperCase();
    const isDCA    = val.includes('DCA') && !val.includes('PGDCA');
    const isBCA    = val.includes('BCA') && !val.includes('PGDCA');
    const isPGDCA  = val.includes('PGDCA');
    const qualSection = document.getElementById('qualificationSection');
    const tenthSection = document.getElementById('tenthSection');
    const gradSection = document.getElementById('graduationSection');
    const msg         = document.getElementById('qualEligibilityMsg');
    if (!isDCA && !isBCA && !isPGDCA) { qualSection.style.display = 'none'; msg.style.display = 'none'; return; }
    qualSection.style.display = 'block';
    // Show 10th section for all courses that require qualification
    tenthSection.style.display = 'block';
    gradSection.style.display = isPGDCA ? 'block' : 'none';
    const msgs = {
        DCA:   '<i class="fas fa-info-circle"></i> <strong>DCA Eligibility:</strong> 10th Pass — minimum 33% (Third Division)',
        BCA:   '<i class="fas fa-info-circle"></i> <strong>BCA Eligibility:</strong> 12th Pass — minimum 45% (Second Division), Mathematics preferred',
        PGDCA: '<i class="fas fa-info-circle"></i> <strong>PGDCA Eligibility:</strong> Graduation (any stream) — minimum 45% (Second Division)'
    };
    const key = isPGDCA ? 'PGDCA' : isBCA ? 'BCA' : 'DCA';
    msg.style.display = 'block'; msg.className = 'eligibility-msg'; msg.innerHTML = msgs[key];
    if (document.getElementById('marks12Body').querySelectorAll('tr').length === 0) load12Subjects();
    if (isPGDCA && document.getElementById('marksGradBody').querySelectorAll('tr').length === 0)
        GRAD_DEFAULT.forEach(([n, m]) => buildSubjectRow('marksGradBody', n, m, ''));
    const gradMkGroup = document.getElementById('sGradMarksheetGroup');
    if (gradMkGroup) gradMkGroup.style.display = isPGDCA ? 'block' : 'none';
    const courseName = document.getElementById('sCourse').value;
    if (courseName) loadBatchesForCourse(courseName);
}

function toggleGradMarksType() {
    const isPct = document.querySelector('input[name="gradMarksType"]:checked').value === 'percentage';
    document.getElementById('gradPctSection').style.display  = isPct ? 'block' : 'none';
    document.getElementById('gradCGPASection').style.display = isPct ? 'none'  : 'block';
}

function calc10Pct() {
    const total = parseFloat(document.getElementById('s10Total').value) || 0;
    const obtained = parseFloat(document.getElementById('s10Obtained').value) || 0;
    const pct = total > 0 ? ((obtained / total) * 100).toFixed(2) : 0;
    document.getElementById('pct10').textContent = pct + '%';
    const d = getDivision(parseFloat(pct));
    document.getElementById('div10').textContent = d ? d.text : '—';
    document.getElementById('div10').className = 'div-badge ' + (d ? d.cls : '');
}

function calcCGPAPercentage() {
    const cgpa = parseFloat(document.getElementById('sGradCGPA').value) || 0;
    const pct  = (cgpa * 10).toFixed(2);
    document.getElementById('sGradCGPAPct').value = cgpa > 0 ? pct + '%' : '';
    const d = cgpa > 0 ? getDivision(parseFloat(pct)) : null;
    document.getElementById('sGradCGPADiv').value = d ? d.text : '';
}

function getQualificationData() {
    const val = (document.getElementById('sCourse')?.value || '').toUpperCase();
    const isPGDCA = val.includes('PGDCA');
    const qual = {};
    if (document.getElementById('qualificationSection').style.display !== 'none') {
        qual.twelfth = {
            board: document.getElementById('s12Board').value,
            stream: document.getElementById('s12Stream').value,
            school: document.getElementById('s12School').value,
            year: document.getElementById('s12Year').value,
            roll: document.getElementById('s12Roll').value,
            percentage: document.getElementById('pct12').textContent,
            division: document.getElementById('div12').textContent
        };
    }
    if (isPGDCA) {
        const isCGPA = document.querySelector('input[name="gradMarksType"]:checked')?.value === 'cgpa';
        qual.graduation = {
            university: document.getElementById('sGradUniv').value,
            college: document.getElementById('sGradCollege').value,
            degree: document.getElementById('sGradDegree').value,
            stream: document.getElementById('sGradStream').value,
            year: document.getElementById('sGradYear').value,
            enroll: document.getElementById('sGradEnroll').value,
            marksType: isCGPA ? 'cgpa' : 'percentage',
            percentage: isCGPA ? document.getElementById('sGradCGPAPct').value : document.getElementById('pctGrad').textContent,
            cgpa: isCGPA ? document.getElementById('sGradCGPA').value : '',
            division: isCGPA ? document.getElementById('sGradCGPADiv').value : document.getElementById('divGrad').textContent
        };
    }
    return qual;
}

// ===== Students =====
let allStudents = [];

async function loadStudentsTable() {
    try {
        allStudents = await fetch('/api/students').then(r => r.json());
        renderStudentsTable(allStudents);
    } catch (err) { showNotification('Students load error!', 'error'); }
}

function renderStudentsTable(students) {
    const tbody = document.querySelector('#studentsTable tbody');
    const statsEl = document.getElementById('studentsStats');
    const total = students.length;
    const active = students.filter(s => s.status === 'Active').length;
    const pending = students.filter(s => s.fees && s.fees.dueAmount > 0).length;
    let statsHtml = '';
    statsHtml += '<div class="stat-mini"><span>' + total + '</span> Total</div>';
    statsHtml += '<div class="stat-mini s-active"><span>' + active + '</span> Active</div>';
    statsHtml += '<div class="stat-mini s-pending"><span>' + pending + '</span> Fee Pending</div>';
    statsEl.innerHTML = statsHtml;
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:#999;">Koi student nahi hai. "New Admission" karein.</td></tr>';
        return;
    }
    tbody.innerHTML = students.map(s => {
        let html = '';
        html += '<tr>';
        html += '<td><input type="checkbox" class="student-checkbox" data-id="' + s.id + '"></td>';
        html += '<td><strong>' + s.rollNo + '</strong></td>';
        html += '<td>' + (s.photo ? '<img src="' + s.photo + '" style="width:36px;height:36px;object-fit:cover;border-radius:50%;border:2px solid #ddd;">' : '<i class="fas fa-user-circle" style="font-size:2rem;color:#94a3b8;"></i>') + '</td>';
        html += '<td>' + s.name + '</td>';
        html += '<td>' + s.course + '</td>';
        html += '<td>' + s.phone + '</td>';
        html += '<td class="fee-paid">&#8377;' + s.fees.paidAmount + '</td>';
        html += '<td class="' + (s.fees.dueAmount > 0 ? 'fee-due' : 'fee-paid') + '">&#8377;' + s.fees.dueAmount + '</td>';
        html += '<td><span class="badge-' + (s.status === 'Active' ? 'active' : 'inactive') + '">' + s.status + '</span></td>';
        html += '<td>';
        html += '<button class="action-btn edit-btn" onclick="openStudentProfile(' + s.id + ')"><i class="fas fa-eye"></i></button>';
        html += '<button class="action-btn" onclick="openUpdateStudentModal(' + s.id + ')"><i class="fas fa-edit"></i></button>';
        html += '<button class="action-btn" onclick="printStudentForm(' + s.id + ')"><i class="fas fa-print"></i></button>';
        html += '<button class="action-btn" onclick="generateICard(' + s.id + ')"><i class="fas fa-id-card"></i></button>';
        html += '<button class="action-btn" onclick="openNotificationModal(' + s.id + ', \'' + s.name.replace(/'/g, "\\'") + '\')"><i class="fas fa-bell"></i></button>';
        html += '<button class="action-btn" onclick="openStudentNotificationsModal(' + s.id + ', \'' + s.name.replace(/'/g, "\\'") + '\')"><i class="fas fa-bell-slash"></i></button>';
        html += '<button class="action-btn delete-btn" onclick="deleteStudent(' + s.id + ')"><i class="fas fa-trash"></i></button>';
        html += '</td>';
        html += '</tr>';
        return html;
    }).join('');
}

function filterStudents() {
    const q = document.getElementById('studentSearch').value.toLowerCase();
    const filtered = allStudents.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.course && s.course.toLowerCase().includes(q))
    );
    renderStudentsTable(filtered);
}

function toggleAllStudentCheckboxes() {
    const selectAll = document.getElementById('selectAllStudents').checked;
    const checkboxes = document.querySelectorAll('.student-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
}

async function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    
    try {
        const res = await fetch('/api/students/' + studentId, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Student deleted successfully!', 'success');
            loadStudentsTable();
        } else {
            showNotification('Failed to delete student', 'error');
        }
    } catch (e) {
        console.error('Error deleting student:', e);
        showNotification('Error deleting student', 'error');
    }
}

async function deleteSelectedStudents() {
    const checkboxes = document.querySelectorAll('.student-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select at least one student to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} student(s)?`)) return;
    
    const studentIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;
    
    try {
        for (const studentId of studentIds) {
            const res = await fetch('/api/students/' + studentId, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                deletedCount++;
            }
        }
        
        if (deletedCount === studentIds.length) {
            showNotification(`${deletedCount} student(s) deleted successfully!`, 'success');
        } else {
            showNotification(`${deletedCount}/${studentIds.length} student(s) deleted`, 'warning');
        }
        
        document.getElementById('selectAllStudents').checked = false;
        loadStudentsTable();
    } catch (e) {
        console.error('Error deleting students:', e);
        showNotification('Error deleting students', 'error');
    }
}

function showAdmissionForm() {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-admission').classList.remove('hidden');
    document.getElementById('pageTitle').textContent = 'New Admission';
    document.getElementById('admissionForm').reset();
    document.getElementById('sAdmDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('sPhotoPreview').style.display = 'none';
    document.getElementById('sPhotoPlaceholder').style.display = 'block';
    document.getElementById('sSignaturePreview').style.display = 'none';
    document.getElementById('sSignaturePlaceholder').style.display = 'block';
    document.getElementById('sDocsList').textContent = 'Click to upload (multiple allowed)';
    ['sAadharDocName','s10thMarksheetName','s12thMarksheetName','sGradMarksheetName'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = 'Click to upload';
    });
    ['sGradMarksheetGroup','sRazorpayGroup','sTransactionGroup'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    const rzBtn = document.getElementById('razorpayBtn'); const rzStat = document.getElementById('razorpayStatus');
    if (rzBtn) { rzBtn.disabled = false; rzBtn.innerHTML = '<i class="fas fa-lock"></i> Pay Now via Razorpay'; }
    if (rzStat) rzStat.style.display = 'none';
    document.getElementById('sPayNow').value = '';
    document.getElementById('sPendingFees').value = '';
    loadCoursesForAdmission();
}

function showStudentsPage() {
    document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-page="students"]').classList.add('active');
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-students').classList.remove('hidden');
    document.getElementById('pageTitle').textContent = 'Students';
    loadStudentsTable();
}

async function loadCoursesForAdmission() {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const sel = document.getElementById('sCourse');
        sel.innerHTML = '<option value="">-- Select Course --</option>' +
            courses.map(c => '<option value="' + c.name + '" data-fees="' + c.price + '">' + c.name + ' (&#8377;' + c.price + ')</option>').join('');
        sel.onchange = function() {
            const opt = sel.options[sel.selectedIndex];
            if (opt.dataset.fees) { document.getElementById('sTotalFees').value = opt.dataset.fees; calculatePayment(); }
        };
    } catch (e) {}
}

function calculatePayment() {
    const total = parseInt(document.getElementById('sTotalFees').value) || 0;
    const isPartial = document.querySelector('input[name="sPayType"]:checked')?.value === 'partial';
    const payNow = isPartial ? Math.round(total * 0.4) : total;
    const pending = total - payNow;
    document.getElementById('sPayNow').value = '&#8377; ' + payNow.toLocaleString('en-IN');
    document.getElementById('sPendingFees').value = '&#8377; ' + pending.toLocaleString('en-IN');
    document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
    const checked = document.querySelector('input[name="sPayType"]:checked');
    if (checked) checked.closest('.radio-card').classList.add('selected');
}

function toggleTransactionId() {
    const mode = document.getElementById('sPayMode').value;
    const isUPI = mode === 'UPI';
    const isOnline = mode === 'Online';
    const notCash = mode !== 'Cash';
    document.getElementById('sTransactionGroup').style.display = notCash ? 'block' : 'none';
    const rg = document.getElementById('sRazorpayGroup');
    if (rg) rg.style.display = isOnline ? 'block' : 'none';
    if (!isOnline) {
        const rzBtn = document.getElementById('razorpayBtn');
        const rzStatus = document.getElementById('razorpayStatus');
        if (rzBtn) { rzBtn.disabled = false; rzBtn.innerHTML = '<i class="fas fa-lock"></i> Pay Now via Razorpay'; }
        if (rzStatus) rzStatus.style.display = 'none';
    }
}

function previewDocFile(input, imgId, placeholderId) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const img = document.getElementById(imgId);
        const ph = document.getElementById(placeholderId);
        img.src = e.target.result;
        img.style.display = 'block';
        ph.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function showDocsList(input) {
    const files = Array.from(input.files);
    document.getElementById('sDocsList').innerHTML = files.length
        ? files.map(f => '<div>&#128196; ' + f.name + '</div>').join('')
        : 'Click to upload (multiple allowed)';
}

// Validation for duplicate mobile and email in admission form
async function checkAdminDuplicateMobile() {
    const phone = document.getElementById('sPhone').value;
    const errorMsg = document.getElementById('sPhoneError');
    
    if (phone.length === 10 && /^[6-9]/.test(phone)) {
        try {
            const res = await fetch('/api/students/check-mobile?phone=' + phone);
            const data = await res.json();
            if (data.exists) {
                errorMsg.textContent = '⚠️ This mobile number is already registered!';
                errorMsg.style.color = '#dc2626';
                errorMsg.style.display = 'block';
                return true;
            } else {
                errorMsg.style.display = 'none';
                return false;
            }
        } catch (e) {
            console.error('Error checking mobile:', e);
            return false;
        }
    } else {
        return false;
    }
}

async function checkAdminDuplicateEmail() {
    const email = document.getElementById('sEmail').value;
    const errorEl = document.getElementById('sEmailError');
    
    if (!email || !email.includes('@')) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
        return false;
    }
    
    try {
        const res = await fetch('/api/students/check-email?email=' + encodeURIComponent(email));
        const data = await res.json();
        
        if (data.exists) {
            errorEl.textContent = 'Email already registered!';
            errorEl.style.display = 'block';
            return true;
        } else {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
            return false;
        }
    } catch (err) {
        console.error('Error checking duplicate email:', err);
        // Silently fail - validation will proceed
        errorEl.textContent = '';
        errorEl.style.display = 'none';
        return false;
    }
}

async function checkAdminDuplicateAadhar() {
    const aadhar = document.getElementById('sAadhar').value;
    const errorEl = document.getElementById('sAadharError');
    
    if (!aadhar || aadhar.length !== 12) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
        return false;
    }
    
    try {
        const res = await fetch('/api/students/check-aadhar?aadhar=' + aadhar);
        const data = await res.json();
        
        if (data.exists) {
            errorEl.textContent = 'Aadhar number already registered!';
            errorEl.style.display = 'block';
            return true;
        } else {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
            return false;
        }
    } catch (err) {
        console.error('Error checking duplicate Aadhar:', err);
        // Silently fail - validation will proceed
        errorEl.textContent = '';
        errorEl.style.display = 'none';
        return false;
    }
}

async function populateAdminPrintSection(student, paymentMode, paymentType, amountPaid) {
    // Fetch settings for institute info
    const settings = await fetch('/api/settings').then(r => r.json());
    
    // Institute info
    document.getElementById('adminPrintInstituteName').textContent = settings.name || 'Genius Computer Education';
    document.getElementById('adminPrintInstituteAddress').textContent = settings.address || 'Institute Address';
    document.getElementById('adminPrintInstitutePhone').textContent = 'Phone: ' + (settings.phone || 'XXXXXXXXXX') + ' | Email: ' + (settings.email || 'contact@institute.com');
    
    // Logo
    if (settings.logo) {
        document.getElementById('adminPrintLogo').src = settings.logo;
        document.getElementById('adminPrintWatermark').src = settings.logo;
    }
    
    // Personal info
    document.getElementById('adminPrintAppId').textContent = student.rollNo || '-';
    document.getElementById('adminPrintDate').textContent = formatDate(new Date());
    document.getElementById('adminPrintName').textContent = student.name || '-';
    document.getElementById('adminPrintFatherName').textContent = student.fatherName || '-';
    document.getElementById('adminPrintMotherName').textContent = student.motherName || '-';
    document.getElementById('adminPrintDOB').textContent = student.dob || '-';
    document.getElementById('adminPrintGender').textContent = student.gender || '-';
    document.getElementById('adminPrintCategory').textContent = student.category || '-';
    document.getElementById('adminPrintMobile').textContent = student.phone || '-';
    document.getElementById('adminPrintEmail').textContent = student.email || '-';
    document.getElementById('adminPrintAadhar').textContent = student.aadhar || '-';
    document.getElementById('adminPrintIncome').textContent = student.familyIncome || '-';
    
    // Course info
    document.getElementById('adminPrintCourse').textContent = student.course || '-';
    document.getElementById('adminPrintBatch').textContent = student.batch || '-';
    
    // Photo and signature
    if (student.photo) document.getElementById('adminPrintPhoto').src = student.photo;
    if (student.signature) document.getElementById('adminPrintSignature').src = student.signature;
    
    // Qualification
    const qual = typeof student.qualification === 'string' ? JSON.parse(student.qualification) : student.qualification;
    if (qual && qual.tenth) {
        document.getElementById('adminPrint10Board').textContent = qual.tenth.board || '-';
        document.getElementById('adminPrint10Year').textContent = qual.tenth.year || '-';
        document.getElementById('adminPrint10Total').textContent = qual.tenth.total || '-';
        document.getElementById('adminPrint10Obtained').textContent = qual.tenth.obtained || '-';
        document.getElementById('adminPrint10Pct').textContent = qual.tenth.percentage || '-';
    }
    
    if (qual && qual.twelfth) {
        document.getElementById('adminPrint12Section').style.display = 'block';
        document.getElementById('adminPrint12Board').textContent = qual.twelfth.board || '-';
        document.getElementById('adminPrint12Year').textContent = qual.twelfth.year || '-';
        document.getElementById('adminPrint12Stream').textContent = qual.twelfth.stream || '-';
        document.getElementById('adminPrint12Pct').textContent = qual.twelfth.percentage || '-';
    } else {
        document.getElementById('adminPrint12Section').style.display = 'none';
    }
    
    if (qual && qual.graduation) {
        document.getElementById('adminPrintGradSection').style.display = 'block';
        document.getElementById('adminPrintGradUniv').textContent = qual.graduation.university || '-';
        document.getElementById('adminPrintGradCollege').textContent = qual.graduation.college || '-';
        document.getElementById('adminPrintGradDegree').textContent = qual.graduation.degree || '-';
        document.getElementById('adminPrintGradStream').textContent = qual.graduation.stream || '-';
        document.getElementById('adminPrintGradYear').textContent = qual.graduation.year || '-';
        document.getElementById('adminPrintGradEnroll').textContent = qual.graduation.enrollment || '-';
    } else {
        document.getElementById('adminPrintGradSection').style.display = 'none';
    }
    
    // Payment info
    document.getElementById('adminPrintPaymentMode').textContent = paymentMode || '-';
    document.getElementById('adminPrintPaymentType').textContent = paymentType || '-';
    document.getElementById('adminPrintAmountPaid').textContent = '₹' + (amountPaid || 0).toLocaleString('en-IN');
    
    // Generated date
    document.getElementById('adminPrintGeneratedDate').textContent = formatDate(new Date());
}

function printAdminApplication() {
    const content = document.getElementById('adminPrintContent').innerHTML;
    const printWindow = window.open('', '_blank');
    let html = '';
    html += '<!DOCTYPE html>\n';
    html += '<html>\n';
    html += '<head>\n';
    html += '    <title>Admission Application</title>\n';
    html += '    <style>\n';
    html += '        @media print {\n';
    html += '            @page { margin: 20px; }\n';
    html += '            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n';
    html += '        }\n';
    html += '        body { font-family: \'Times New Roman\', serif; margin: 0; padding: 30px; background: white; }\n';
    html += '    </style>\n';
    html += '</head>\n';
    html += '    <body><div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04;"><img src="/uploads/logo/logo.png" style="max-width: 300px; max-height: 300px;" onerror="this.parentElement.style.display=\'none\'"></div>' + content + '</body>\n';
    html += '</html>';
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
    printWindow.onafterprint = function() { printWindow.close(); };
}

function closeAdminPrintSection() {
    document.getElementById('adminPrintSection').style.display = 'none';
    document.getElementById('page-admission').style.display = 'block';
    document.getElementById('admissionForm').reset();
    showStudentsPage();
}

async function openStudentProfile(id) {
    document.getElementById('studentProfileContent').innerHTML = '<p style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading...</p>';
    document.getElementById('studentProfileModal').classList.add('active');
    try {
        const s = await fetch('/api/students/' + id).then(r => r.json());
        const dueColor = s.fees.dueAmount > 0 ? '#d97706' : '#16a34a';
        const payRows = (s.fees.payments || []).map(p => {
            let html = '';
            html += '<tr><td>' + p.date + '</td><td><strong>&#8377;' + p.amount + '</strong></td><td>' + p.type + '</td><td>' + p.mode + '</td><td>' + (p.transactionId || '-') + '</td><td><small>' + p.receipt + '</small></td></tr>';
            return html;
        }).join('');
        
        // Load notifications for this student
        const notifRes = await fetch('/api/notifications/' + id);
        const notifData = await notifRes.json();
        console.log('Student notifications data:', notifData);
        console.log('Notifications array:', notifData.notifications);
        console.log('Notifications length:', notifData.notifications ? notifData.notifications.length : 0);
        const notifRows = (notifData.notifications || []).map(n => {
            let html = '';
            html += '<tr>';
            html += '<td>' + n.date + '</td>';
            html += '<td>' + n.message + '</td>';
            html += '<td><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:' + (n.type === 'info' ? '#e0f2fe' : n.type === 'warning' ? '#fef3c7' : n.type === 'success' ? '#dcfce7' : '#fee2e2') + ';color:' + (n.type === 'info' ? '#0284c7' : n.type === 'warning' ? '#d97706' : n.type === 'success' ? '#16a34a' : '#dc2626') + ';">' + n.type + '</span></td>';
            html += '<td><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:' + (n.read ? '#dcfce7' : '#fee2e2') + ';color:' + (n.read ? '#16a34a' : '#dc2626') + ';">' + (n.read ? 'Read' : 'Unread') + '</span></td>';
            html += '<td style="text-align:center;">';
            html += '<button class="btn" onclick="deleteNotification(' + n.id + ', ' + id + ')" style="padding:4px 8px;font-size:11px;background:#fee2e2;color:#dc2626;border:1px solid #dc2626;display:inline-block;visibility:visible;">Delete</button>';
            html += '</td>';
            html += '</tr>';
            return html;
        }).join('');
        console.log('Notification rows HTML:', notifRows);
        
        // Parse qualification
        const qual = typeof s.qualification === 'string' ? JSON.parse(s.qualification) : s.qualification;
        
        let html = '';
        html += '<div class="profile-header">';
        html += '<div class="profile-photo">' + (s.photo ? '<img src="' + s.photo + '" alt="Photo">' : '<i class="fas fa-user-circle fa-5x" style="color:#94a3b8;"></i>') + '</div>';
        html += '<div class="profile-meta">';
        html += '<h2>' + s.name + ' <span class="badge-' + (s.status === 'Active' ? 'active' : 'inactive') + '" style="font-size:.75rem;">' + s.status + '</span> ' + (s.icardGenerated || s.icard_generated ? '<span class="badge-success" style="font-size:.75rem;margin-left:8px;background:#16a34a;color:white;padding:2px 8px;border-radius:4px;"><i class="fas fa-id-card"></i> I-Card Generated</span>' : '') + '</h2>';
        html += '<p><i class="fas fa-id-badge"></i> ' + s.rollNo + '</p>';
        html += '<p><i class="fas fa-phone"></i> ' + s.phone + ' &nbsp; ' + (s.email ? '<i class="fas fa-envelope"></i> ' + s.email : '') + '</p>';
        html += '<p><i class="fas fa-book"></i> ' + s.course + ' | ' + (s.batch || '-') + ' | ' + s.admissionDate + '</p>';
        html += '</div>';
        html += '<div class="profile-actions">';
        html += (s.fees.dueAmount > 0 ? '<button class="btn btn-primary" onclick="openPaymentModal(' + s.id + ', ' + s.fees.dueAmount + ')"><i class="fas fa-rupee-sign"></i> Pay Now</button>' : '');
        html += '<button class="btn" onclick="generateICard(' + s.id + ')"><i class="fas fa-id-card"></i> I-Card</button>';
        html += '<button class="btn" onclick="sendStudentSlip(' + s.id + ')"><i class="fas fa-envelope"></i> Send Slip</button>';
        html += '<button class="btn" onclick="printStudentSlip(' + s.id + ')"><i class="fas fa-print"></i> Print</button>';
        html += '<button class="btn delete-btn" onclick="deleteStudent(' + s.id + ')"><i class="fas fa-trash"></i></button>';
        html += '</div>';
        html += '</div>';
        
        html += '<div class="profile-fees">';
        html += '<div class="fee-box"><div class="fee-box-label">Total Fees</div><div class="fee-box-amt">&#8377;' + s.fees.totalFees + '</div></div>';
        html += '<div class="fee-box paid"><div class="fee-box-label">Paid</div><div class="fee-box-amt" style="color:#16a34a;">&#8377;' + s.fees.paidAmount + '</div></div>';
        html += '<div class="fee-box ' + (s.fees.dueAmount > 0 ? 'due' : 'paid') + '"><div class="fee-box-label">Pending</div><div class="fee-box-amt" style="color:' + dueColor + ';">&#8377;' + s.fees.dueAmount + '</div></div>';
        html += '</div>';
        
        html += '<!-- Personal Details -->';
        html += '<div style="margin:20px 0;">';
        html += '<h4 style="margin:0 0 12px;color:#2563eb;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Personal Information</h4>';
        html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">';
        html += '<div><strong>Father\'s Name:</strong> ' + (s.fatherName || '-') + '</div>';
        html += '<div><strong>Mother\'s Name:</strong> ' + (s.motherName || '-') + '</div>';
        html += '<div><strong>Date of Birth:</strong> ' + (s.dob || '-') + '</div>';
        html += '<div><strong>Gender:</strong> ' + (s.gender || '-') + '</div>';
        html += '<div><strong>Category:</strong> ' + (s.category || '-') + '</div>';
        html += '<div><strong>Aadhar:</strong> ' + (s.aadhar || '-') + '</div>';
        html += '<div><strong>Family Income:</strong> ' + (s.familyIncome || '-') + '</div>';
        html += '<div><strong>Address:</strong> ' + (s.address || '-') + '</div>';
        html += '</div>';
        html += '</div>';
        
        html += '<!-- Educational Qualification -->';
        html += '<div style="margin:20px 0;">';
        html += '<h4 style="margin:0 0 12px;color:#2563eb;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Educational Qualification</h4>';
        if (qual && qual.tenth) {
            html += '<div style="background:#f8fafc;padding:12px;border-radius:6px;margin-bottom:10px;">';
            html += '<strong>10th Standard:</strong>';
            html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px;">';
            html += '<div>Board: ' + (qual.tenth.board || '-') + '</div>';
            html += '<div>School: ' + (qual.tenth.school || '-') + '</div>';
            html += '<div>Year: ' + (qual.tenth.year || '-') + '</div>';
            html += '<div>Roll No: ' + (qual.tenth.roll || '-') + '</div>';
            html += '<div>Total: ' + (qual.tenth.total || '-') + '</div>';
            html += '<div>Obtained: ' + (qual.tenth.obtained || '-') + '</div>';
            html += '<div>Percentage: ' + (qual.tenth.percentage || '-') + '</div>';
            html += '<div>Division: ' + (qual.tenth.division || '-') + '</div>';
            html += '</div>';
            html += '</div>';
        }
        
        if (qual && qual.twelfth) {
            html += '<div style="background:#f8fafc;padding:12px;border-radius:6px;margin-bottom:10px;">';
            html += '<strong>12th Standard:</strong>';
            html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px;">';
            html += '<div>Board: ' + (qual.twelfth.board || '-') + '</div>';
            html += '<div>School: ' + (qual.twelfth.school || '-') + '</div>';
            html += '<div>Stream: ' + (qual.twelfth.stream || '-') + '</div>';
            html += '<div>Year: ' + (qual.twelfth.year || '-') + '</div>';
            html += '<div>Roll No: ' + (qual.twelfth.roll || '-') + '</div>';
            html += '<div>Percentage: ' + (qual.twelfth.percentage || '-') + '</div>';
            html += '<div>Division: ' + (qual.twelfth.division || '-') + '</div>';
            html += '</div>';
            html += '</div>';
        }
        
        if (qual && qual.graduation) {
            html += '<div style="background:#f8fafc;padding:12px;border-radius:6px;margin-bottom:10px;">';
            html += '<strong>Graduation:</strong>';
            html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px;">';
            html += '<div>University: ' + (qual.graduation.university || '-') + '</div>';
            html += '<div>College: ' + (qual.graduation.college || '-') + '</div>';
            html += '<div>Degree: ' + (qual.graduation.degree || '-') + '</div>';
            html += '<div>Stream: ' + (qual.graduation.stream || '-') + '</div>';
            html += '<div>Year: ' + (qual.graduation.year || '-') + '</div>';
            html += '<div>Enrollment No: ' + (qual.graduation.enrollment || '-') + '</div>';
            html += '<div>Marks Type: ' + (qual.graduation.marksType || '-') + '</div>';
            html += '<div>Percentage: ' + (qual.graduation.percentage || '-') + '</div>';
            html += '<div>Division: ' + (qual.graduation.division || '-') + '</div>';
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';
        
        if (s.documents && s.documents.length) {
            html += '<div style="margin:14px 0;"><strong>Documents:</strong> ' + s.documents.map(d => '<a href="' + d + '" target="_blank" style="margin-left:10px;"><i class="fas fa-file"></i> View</a>').join('') + '</div>';
        }
        
        html += '<h4 style="margin:18px 0 10px;color:#2563eb;">Payment History</h4>';
        html += '<div class="data-table">';
        html += '<table><thead><tr><th>Date</th><th>Amount</th><th>Type</th><th>Mode</th><th>Txn ID</th><th>Receipt</th></tr></thead>';
        html += '<tbody>' + (payRows || '<tr><td colspan="6" style="text-align:center;">No payments</td></tr>') + '</tbody></table></div>';
        
        html += '<h4 style="margin:18px 0 10px;color:#2563eb;">Notifications</h4>';
        html += '<div class="data-table">';
        html += '<table><thead><tr><th>Date</th><th>Message</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>';
        html += '<tbody>' + (notifRows || '<tr><td colspan="5" style="text-align:center;">No notifications</td></tr>') + '</tbody></table></div>';
        
        document.getElementById('studentProfileContent').innerHTML = html;
    } catch (err) { document.getElementById('studentProfileContent').innerHTML = '<p style="padding:40px;color:red;">Error loading student!</p>'; }
}

function openPaymentModal(id, due) {
    document.getElementById('payStudentId').value = id;
    document.getElementById('payDueDisplay').value = '&#8377; ' + due.toLocaleString('en-IN');
    document.getElementById('payAmount').value = due;
    document.getElementById('payTransactionGroup').style.display = 'none';
    document.getElementById('paymentModal').classList.add('active');
}

function togglePayTransactionId() {
    const mode = document.getElementById('payMode').value;
    document.getElementById('payTransactionGroup').style.display = (mode !== 'Cash') ? 'block' : 'none';
}

async function submitStudentPayment() {
    const id = document.getElementById('payStudentId').value;
    const amount = document.getElementById('payAmount').value;
    if (!amount || amount <= 0) { showNotification('Valid amount daalo!', 'error'); return; }
    try {
        const res = await fetch('/api/students/' + id + '/payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount, mode: document.getElementById('payMode').value,
                transactionId: document.getElementById('payTransactionId').value,
                sendEmail: document.getElementById('paySendEmail').checked ? 'true' : 'false'
            })
        });
        const data = await res.json();
        if (data.success) {
            closeModal('paymentModal');
            showNotification('Payment added!', 'success');
            openStudentProfile(id);
        } else { showNotification('Error!', 'error'); }
    } catch (err) { showNotification('Payment error!', 'error'); }
}

async function sendStudentSlip(id) {
    try {
        const res = await fetch('/api/students/' + id + '/send-slip', { method: 'POST' });
        const data = await res.json();
        if (data.success) showNotification('Email sent!', 'success');
        else showNotification(data.message || 'Email bhejne mein error!', 'error');
    } catch (err) { showNotification('Email error!', 'error'); }
}

async function generateICard(id) {
    try {
        showNotification('Generating I-Card...', 'info');
        
        // Check if html2canvas is loaded
        if (typeof html2canvas === 'undefined') {
            alert('html2canvas library not loaded. Opening I-Card in new window.');
            window.open('/api/students/' + id + '/icard', '_blank');
            return;
        }
        
        // Fetch the i-card HTML
        const res = await fetch('/api/students/' + id + '/icard');
        if (!res.ok) {
            throw new Error('HTTP error! status: ' + res.status);
        }
        const html = await res.text();
        
        // Create a temporary container to render the HTML
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '400px';
        container.style.height = '600px';
        container.style.backgroundColor = '#ffffff';
        container.innerHTML = html;
        document.body.appendChild(container);
        
        // Wait for images to load
        const images = container.querySelectorAll('img');
        const imagePromises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        });
        await Promise.all(imagePromises);
        
        // Convert to canvas using html2canvas
        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: 400,
            height: container.scrollHeight
        });
        
        // Remove the temporary container
        document.body.removeChild(container);
        
        // Convert canvas to JPG and download
        canvas.toBlob(function(blob) {
            if (!blob) {
                throw new Error('Failed to generate image blob');
            }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ICard-' + id + '.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showNotification('I-Card downloaded as JPG!', 'success');
        }, 'image/jpeg', 0.9);
        
    } catch (err) {
        console.error('Error generating I-Card:', err);
        showNotification('Error generating I-Card. Opening in new window...', 'error');
        // Fallback: open i-card in new window
        window.open('/api/students/' + id + '/icard', '_blank');
    }
}

async function updateStudentICardStatus(id, generated) {
    try {
        await fetch('/api/students/' + id + '/icard-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ icardGenerated: generated })
        });
    } catch (err) {
        console.error('Error updating i-card status:', err);
    }
}

async function openUpdateStudentModal(id) {
    try {
        const s = await fetch('/api/students/' + id).then(r => r.json());
        const settings = await fetch('/api/settings').then(r => r.json());
        
        document.getElementById('updateStudentId').value = s.id;
        document.getElementById('updateName').value = s.name;
        document.getElementById('updateFatherName').value = s.fatherName;
        document.getElementById('updateMotherName').value = s.motherName;
        document.getElementById('updateDob').value = s.dob;
        document.getElementById('updateGender').value = s.gender;
        document.getElementById('updateCategory').value = s.category;
        document.getElementById('updateBloodGroup').value = s.bloodGroup || '';
        document.getElementById('updatePhone').value = s.phone;
        document.getElementById('updateEmail').value = s.email || '';
        document.getElementById('updateAadhar').value = s.aadhar || '';
        document.getElementById('updateIncome').value = s.familyIncome || '';
        document.getElementById('updateAddress').value = s.address || '';
        document.getElementById('updateCourse').value = s.course;
        document.getElementById('updateBatch').value = s.batch || '';
        document.getElementById('updateRollNo').value = s.rollNo;
        document.getElementById('updateAdmissionDate').value = s.admissionDate;
        document.getElementById('updateStatus').value = s.status;
        
        // Parse qualification
        const qual = typeof s.qualification === 'string' ? JSON.parse(s.qualification) : s.qualification;
        
        // 10th Standard
        document.getElementById('update10Board').value = qual.tenth?.board || '';
        document.getElementById('update10School').value = qual.tenth?.school || '';
        document.getElementById('update10Year').value = qual.tenth?.year || '';
        document.getElementById('update10Roll').value = qual.tenth?.rollNo || '';
        document.getElementById('update10Total').value = qual.tenth?.totalMarks || '';
        document.getElementById('update10Obtained').value = qual.tenth?.obtainedMarks || '';
        document.getElementById('update10Pct').value = qual.tenth?.percentage || '';
        document.getElementById('update10Div').value = qual.tenth?.division || '';
        
        // 12th Standard
        document.getElementById('update12Board').value = qual.twelfth?.board || '';
        document.getElementById('update12School').value = qual.twelfth?.school || '';
        document.getElementById('update12Stream').value = qual.twelfth?.stream || '';
        document.getElementById('update12Year').value = qual.twelfth?.year || '';
        document.getElementById('update12Roll').value = qual.twelfth?.rollNo || '';
        document.getElementById('update12Pct').value = qual.twelfth?.percentage || '';
        document.getElementById('update12Div').value = qual.twelfth?.division || '';
        
        // Graduation
        document.getElementById('updateGradUniv').value = qual.graduation?.university || '';
        document.getElementById('updateGradCollege').value = qual.graduation?.college || '';
        document.getElementById('updateGradDegree').value = qual.graduation?.degree || '';
        document.getElementById('updateGradStream').value = qual.graduation?.stream || '';
        document.getElementById('updateGradYear').value = qual.graduation?.year || '';
        document.getElementById('updateGradEnroll').value = qual.graduation?.enrollmentNo || '';
        document.getElementById('updateGradPct').value = qual.graduation?.percentage || '';
        document.getElementById('updateGradDiv').value = qual.graduation?.division || '';
        
        // Load courses and batches dropdowns
        const courseSelect = document.getElementById('updateCourse');
        try {
            const courses = await fetch('/api/courses').then(r => r.json());
            if (courses && courses.length > 0) {
                courseSelect.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option value="' + c.name + '">' + c.name + '</option>').join('');
            } else {
                courseSelect.innerHTML = '<option value="">Select Course</option>';
            }
        } catch (e) {
            courseSelect.innerHTML = '<option value="">Select Course</option>';
        }
        courseSelect.value = s.course;
        
        const batchSelect = document.getElementById('updateBatch');
        try {
            const batches = await fetch('/api/batches').then(r => r.json());
            if (batches && batches.length > 0) {
                batchSelect.innerHTML = '<option value="">Select Batch</option>' + batches.map(b => '<option value="' + b.name + '">' + b.name + '</option>').join('');
            } else {
                batchSelect.innerHTML = '<option value="">Select Batch</option>';
            }
        } catch (e) {
            batchSelect.innerHTML = '<option value="">Select Batch</option>';
        }
        batchSelect.value = s.batch || '';
        
        document.getElementById('updateStudentModal').classList.add('active');
    } catch (err) {
        showNotification('Error loading student data!', 'error');
    }
}

async function updateStudent() {
    try {
        const id = document.getElementById('updateStudentId').value;
        
        const qualification = {
            tenth: {
                board: document.getElementById('update10Board').value,
                school: document.getElementById('update10School').value,
                year: document.getElementById('update10Year').value,
                rollNo: document.getElementById('update10Roll').value,
                totalMarks: document.getElementById('update10Total').value,
                obtainedMarks: document.getElementById('update10Obtained').value,
                percentage: document.getElementById('update10Pct').value,
                division: document.getElementById('update10Div').value
            },
            twelfth: {
                board: document.getElementById('update12Board').value,
                school: document.getElementById('update12School').value,
                stream: document.getElementById('update12Stream').value,
                year: document.getElementById('update12Year').value,
                rollNo: document.getElementById('update12Roll').value,
                percentage: document.getElementById('update12Pct').value,
                division: document.getElementById('update12Div').value
            },
            graduation: {
                university: document.getElementById('updateGradUniv').value,
                college: document.getElementById('updateGradCollege').value,
                degree: document.getElementById('updateGradDegree').value,
                stream: document.getElementById('updateGradStream').value,
                year: document.getElementById('updateGradYear').value,
                enrollmentNo: document.getElementById('updateGradEnroll').value,
                percentage: document.getElementById('updateGradPct').value,
                division: document.getElementById('updateGradDiv').value
            }
        };
        
        const data = {
            name: document.getElementById('updateName').value,
            fatherName: document.getElementById('updateFatherName').value,
            motherName: document.getElementById('updateMotherName').value,
            dob: document.getElementById('updateDob').value,
            gender: document.getElementById('updateGender').value,
            category: document.getElementById('updateCategory').value,
            bloodGroup: document.getElementById('updateBloodGroup').value,
            phone: document.getElementById('updatePhone').value,
            email: document.getElementById('updateEmail').value,
            aadhar: document.getElementById('updateAadhar').value,
            familyIncome: document.getElementById('updateIncome').value,
            address: document.getElementById('updateAddress').value,
            course: document.getElementById('updateCourse').value,
            batch: document.getElementById('updateBatch').value,
            status: document.getElementById('updateStatus').value,
            qualification: qualification
        };
        
        const res = await fetch('/api/students/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if (result.success) {
            closeModal('updateStudentModal');
            loadStudentsTable();
            showNotification('Student profile updated!', 'success');
        } else {
            showNotification('Error updating student!', 'error');
        }
    } catch (err) {
        showNotification('Error updating student!', 'error');
    }
}

async function generateICard(id) {
    try {
        const s = await fetch('/api/students/' + id).then(r => r.json());
        const settings = await fetch('/api/settings').then(r => r.json());
        
        const printWindow = window.open('', '_blank');
        let html = '';
        html += '<!DOCTYPE html>\n';
        html += '<html>\n';
        html += '<head>\n';
        html += '    <title>I-Card - ' + s.name + '</title>\n';
        html += '    <style>\n';
        html += '        @media print {\n';
        html += '            @page { margin: 0; size: 54mm 85.6mm; }\n';
        html += '            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n';
        html += '        }\n';
        html += '        body { font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #e8f4f8; display: flex; justify-content: center; align-items: center; min-height: 100vh; }\n';
        html += '        .icard { width: 54mm; height: 85.6mm; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%); border-radius: 10px; overflow: hidden; position: relative; box-shadow: 0 15px 35px rgba(0,0,0,0.3); }\n';
        html += '        .icard::before { content: \'\'; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6); }\n';
        html += '        .icard::after { content: \'\'; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #8b5cf6, #3b82f6, #06b6d4); }\n';
        html += '        .keyboard-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="5" y="5" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="20" y="5" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="35" y="5" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="50" y="5" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="65" y="5" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="80" y="5" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="5" y="18" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="20" y="18" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="35" y="18" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="50" y="18" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="65" y="18" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="80" y="18" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="5" y="31" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="20" y="31" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="35" y="31" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="50" y="31" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="65" y="31" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="80" y="31" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="5" y="44" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="20" y="44" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="35" y="44" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="50" y="44" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="65" y="44" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="80" y="44" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="5" y="57" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="20" y="57" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="35" y="57" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="50" y="57" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="65" y="57" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="80" y="57" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="5" y="70" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="20" y="70" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="35" y="70" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="50" y="70" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="65" y="70" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="80" y="70" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="5" y="83" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="20" y="83" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="35" y="83" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="50" y="83" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="65" y="83" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/><rect x="80" y="83" width="10" height="8" fill="rgba(255,255,255,0.08)" rx="1"/></svg>\'); opacity: 0.15; }\n';
        html += '        .icard-header { background: rgba(255,255,255,0.95); padding: 10px 15px; text-align: center; border-bottom: 2px solid #1e40af; position: relative; z-index: 1; }\n';
        html += '        .icard-logo { width: 35px; height: 35px; object-fit: contain; vertical-align: middle; margin-right: 8px; }\n';
        html += '        .icard-institute { color: #1e40af; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; vertical-align: middle; }\n';
        html += '        .icard-body { padding: 6px 12px 8px; text-align: center; background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%); position: relative; z-index: 1; }\n';
        html += '        .icard-photo { width: 70px; height: 85px; border: 3px solid white; border-radius: 8px; overflow: hidden; background: white; margin: 0 auto 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }\n';
        html += '        .icard-photo img { width: 100%; height: 100%; object-fit: cover; }\n';
        html += '        .icard-details { color: white; font-size: 8px; line-height: 1.4; text-align: left; position: relative; z-index: 1; }\n';
        html += '        .icard-details h2 { margin: 0 0 3px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; color: white; text-shadow: 0 1px 3px rgba(0,0,0,0.3); }\n';
        html += '        .icard-details p { margin: 2px 0; font-size: 8px; }\n';
        html += '        .icard-details .label { color: #e0f2fe; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }\n';
        html += '        .icard-details .value { color: white; font-weight: 700; }\n';
        html += '        .icard-badge { display: inline-block; background: #06b6d4; color: white; padding: 3px 10px; border-radius: 4px; font-size: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); margin: 0 auto 6px; position: relative; z-index: 1; }\n';
        html += '    </style>\n';
        html += '</head>\n';
        html += '<body>\n';
        html += '    <div class="icard">\n';
        html += '        <div class="keyboard-bg"></div>\n';
        html += '        <div class="icard-header">\n';
        html += '            <img src="' + (settings.logo || '') + '" alt="Logo" class="icard-logo">\n';
        html += '            <div class="icard-institute">' + (settings.name || 'Institute Name') + '</div>\n';
        html += '        </div>\n';
        html += '        <div class="icard-body">\n';
        html += '            <div class="icard-badge">STUDENT</div>\n';
        html += '            <div class="icard-photo">\n';
        html += '                <img src="' + (s.photo || '') + '" alt="Photo">\n';
        html += '            </div>\n';
        html += '            <div class="icard-details">\n';
        html += '                <h2>' + s.name + '</h2>\n';
        html += '                <p><span class="label">ID No:</span> <span class="value">' + s.rollNo + '</span></p>\n';
        html += '                <p><span class="label">Course:</span> <span class="value">' + s.course + '</span></p>\n';
        html += '                <p><span class="label">Batch:</span> <span class="value">' + (s.batch || '-') + '</span></p>\n';
        html += '                <p><span class="label">DOB:</span> <span class="value">' + s.dob + '</span></p>\n';
        html += '                <p><span class="label">Phone:</span> <span class="value">' + s.phone + '</span></p>\n';
        html += '                <p><span class="label">Valid Till:</span> <span class="value">30/06/2027</span></p>\n';
        html += '            </div>\n';
        html += '        </div>\n';
        html += '    </div>\n';
        html += '    <script>\n';
        html += '        window.onload = function() {\n';
        html += '            window.print();\n';
        html += '            window.onafterprint = function() { window.close(); };\n';
        html += '        };\n';
        html += '    </script>\n';
        html += '</body>\n';
        html += '</html>\n';
        printWindow.document.write(html);
    } catch (err) {
        showNotification('Error generating I-Card!', 'error');
    }
}

async function printStudentForm(id) {
    try {
        const s = await fetch('/api/students/' + id).then(r => r.json());
        const settings = await fetch('/api/settings').then(r => r.json());
        
        // Parse qualification
        const qual = typeof s.qualification === 'string' ? JSON.parse(s.qualification) : s.qualification;
        
        const printWindow = window.open('', '_blank');
        let html = '';
        html += '<!DOCTYPE html>\n';
        html += '<html>\n';
        html += '<head>\n';
        html += '    <title>Admission Form - ' + s.name + '</title>\n';
        html += '    <style>\n';
        html += '        @media print {\n';
        html += '            @page { margin: 20px; }\n';
        html += '            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n';
        html += '        }\n';
        html += '        body { font-family: \'Times New Roman\', serif; margin: 0; padding: 30px; background: white; position: relative; }\n';
        html += '        .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.05; z-index: 0; pointer-events: none; }\n';
        html += '        .watermark img { width: 600px; height: auto; }\n';
        html += '        .header { display: flex; align-items: center; margin-bottom: 20px; border-bottom: 4px solid #1e40af; padding-bottom: 20px; position: relative; z-index: 1; }\n';
        html += '        .header-left { flex: 1; }\n';
        html += '        .logo-name { display: flex; align-items: center; gap: 20px; margin-bottom: 10px; }\n';
        html += '        .logo-name img { max-height: 120px; max-width: 120px; object-fit: contain; }\n';
        html += '        .logo-name .text-center { flex: 1; text-align: center; }\n';
        html += '        .logo-name h1 { margin: 0; color: #1e40af; font-size: 38px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; }\n';
        html += '        .logo-name .subtitle { margin: 3px 0 0; color: #3b82f6; font-size: 18px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; }\n';
        html += '        .logo-name .contact-info { margin: 2px 0 0; color: #3b82f6; font-size: 15px; font-weight: 500; letter-spacing: 1px; }\n';
        html += '        .personal-section { display: flex; gap: 20px; margin-top: 0; }\n';
        html += '        .personal-table { flex: 1; border-collapse: collapse; border: 2px solid #1e40af; }\n';
        html += '        .personal-table td { padding: 12px 18px; border: 1px solid #1e40af; }\n';
        html += '        .personal-table .label { font-weight: 700; color: #1e40af; width: 30%; }\n';
        html += '        .personal-table .value { color: #0f172a; font-weight: 500; }\n';
        html += '        .personal-table tr:nth-child(even) { background: #f0f9ff; }\n';
        html += '        .photo-sig-right { display: flex; flex-direction: column; gap: 12px; }\n';
        html += '        .photo-box { width: 120px; height: 150px; border: 3px solid #1e40af; border-radius: 6px; overflow: hidden; background: #f8fafc; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }\n';
        html += '        .photo-box img { width: 100%; height: 100%; object-fit: contain; }\n';
        html += '        .sig-box { width: 120px; height: 40px; border: 3px solid #1e40af; border-radius: 6px; overflow: hidden; background: #f8fafc; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }\n';
        html += '        .sig-box img { width: 100%; height: 100%; object-fit: contain; }\n';
        html += '        .title { text-align: center; margin: 25px 0; }\n';
        html += '        .title h2 { margin: 0; color: #1e40af; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; }\n';
        html += '        .title .divider { width: 250px; height: 4px; background: linear-gradient(90deg, #1e40af, #3b82f6); margin: 18px auto; }\n';
        html += '        .app-info { background: #eff6ff; padding: 15px; margin-bottom: 20px; border-left: 5px solid #1e40af; border-radius: 4px; }\n';
        html += '        .app-info table { width: 100%; border-collapse: collapse; }\n';
        html += '        .app-info td { padding: 8px; }\n';
        html += '        .section-title { background: #1e40af; color: white; padding: 12px 18px; margin: 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }\n';
        html += '        .data-table { width: 100%; border-collapse: collapse; border: 2px solid #1e40af; margin-top: 0; }\n';
        html += '        .data-table td { padding: 12px 18px; border: 1px solid #1e40af; }\n';
        html += '        .data-table .label { font-weight: 700; color: #1e40af; width: 25%; }\n';
        html += '        .data-table .value { color: #0f172a; font-weight: 500; }\n';
        html += '        .data-table tr:nth-child(even) { background: #f0f9ff; }\n';
        html += '        .data-table .sub-header { background: #dbeafe; font-weight: 700; color: #1e40af; font-size: 15px; }\n';
        html += '        .section { margin-bottom: 25px; }\n';
        html += '        .signatures { margin-top: 45px; padding-top: 20px; }\n';
        html += '        .signatures .flex { display: flex; justify-content: space-between; }\n';
        html += '        .signatures .line { border-top: 3px solid #1e40af; width: 250px; margin-top: 65px; padding-top: 12px; font-weight: 700; color: #1e40af; font-size: 14px; text-align: center; }\n';
        html += '        .footer { margin-top: 35px; padding-top: 18px; border-top: 2px solid #1e40af; text-align: center; font-size: 13px; color: #64748b; }\n';
        html += '        .footer p { margin: 6px 0; }\n';
        html += '        .generated-date { font-size: 12px; }\n';
        html += '    </style>\n';
        html += '</head>\n';
        html += '<body>\n';
        html += '    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04;"><img src=\"/uploads/logo/logo.png\" style=\"max-width: 300px; max-height: 300px;\" onerror=\"this.parentElement.style.display=\'none\'\"></div>\n';
        html += '    <div class="header">\n';
        html += '        <div class="header-left">\n';
        html += '            <div class="logo-name">\n';
        html += '                <img src="' + (settings.logo || '') + '" alt="Logo">\n';
        html += '                <div class="text-center">\n';
        html += '                    <h1>' + (settings.name || 'Institute Name') + '</h1>\n';
        html += '                    <p class="subtitle">Admission Application Form</p>\n';
        html += '                    <p class="contact-info">' + (settings.address || 'Institute Address') + '</p>\n';
        html += '                    <p class="contact-info">Phone: ' + (settings.phone || 'XXXXXXXXXX') + ' | Email: ' + (settings.email || 'contact@institute.com') + '</p>\n';
        html += '                </div>\n';
        html += '            </div>\n';
        html += '        </div>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="app-info">\n';
        html += '        <table>\n';
        html += '            <tr>\n';
        html += '                <td style="font-weight: 700; color: #1e40af; width: 15%;">Application ID:</td>\n';
        html += '                <td style="font-weight: 600; color: #0f172a;">' + s.id + '</td>\n';
        html += '                <td style="font-weight: 700; color: #1e40af; width: 10%;">Date:</td>\n';
        html += '                <td style="font-weight: 600; color: #0f172a;">' + s.admissionDate + '</td>\n';
        html += '            </tr>\n';
        html += '        </table>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">1. Personal Information</h3>\n';
        html += '        <div class="personal-section">\n';
        html += '            <table class="personal-table">\n';
        html += '                <tr><td class="label">Full Name</td><td class="value">' + s.name + '</td><td class="label">Father\'s Name</td><td class="value">' + s.fatherName + '</td></tr>\n';
        html += '                <tr><td class="label">Mother\'s Name</td><td class="value">' + s.motherName + '</td><td class="label">Date of Birth</td><td class="value">' + s.dob + '</td></tr>\n';
        html += '                <tr><td class="label">Gender</td><td class="value">' + s.gender + '</td><td class="label">Category</td><td class="value">' + s.category + '</td></tr>\n';
        html += '                <tr><td class="label">Mobile Number</td><td class="value">' + s.phone + '</td><td class="label">Email Address</td><td class="value">' + s.email + '</td></tr>\n';
        html += '                <tr><td class="label">Aadhar Number</td><td class="value">' + s.aadhar + '</td><td class="label">Annual Income</td><td class="value">' + s.familyIncome + '</td></tr>\n';
        html += '            </table>\n';
        html += '            <div class="photo-sig-right">\n';
        html += '                <div class="photo-box">\n';
        html += '                    <img src="' + (s.photo || '') + '" alt="Photo">\n';
        html += '                </div>\n';
        html += '                <div class="sig-box">\n';
        html += '                    <img src="' + (s.signature || '') + '" alt="Signature">\n';
        html += '                </div>\n';
        html += '            </div>\n';
        html += '        </div>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">2. Course Information</h3>\n';
        html += '        <table class="data-table">\n';
        html += '            <tr><td class="label">Course Name</td><td class="value">' + s.course + '</td><td class="label">Batch</td><td class="value">' + s.batch + '</td></tr>\n';
        html += '            <tr><td class="label">Roll Number</td><td class="value">' + s.rollNo + '</td><td class="label">Admission Date</td><td class="value">' + s.admissionDate + '</td></tr>\n';
        html += '        </table>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">3. Educational Qualification</h3>\n';
        if (qual && qual.tenth) {
            html += '        <table class="data-table" style="margin-bottom: 10px;">\n';
            html += '            <tr class="sub-header"><td colspan="4">10th Standard</td></tr>\n';
            html += '            <tr><td class="label">Board</td><td class="value">' + qual.tenth.board + '</td><td class="label">School</td><td class="value">' + qual.tenth.school + '</td></tr>\n';
            html += '            <tr><td class="label">Year</td><td class="value">' + qual.tenth.year + '</td><td class="label">Roll No</td><td class="value">' + qual.tenth.roll + '</td></tr>\n';
            html += '            <tr><td class="label">Total Marks</td><td class="value">' + qual.tenth.total + '</td><td class="label">Obtained Marks</td><td class="value">' + qual.tenth.obtained + '</td></tr>\n';
            html += '            <tr><td class="label">Percentage</td><td class="value">' + qual.tenth.percentage + '</td><td class="label">Division</td><td class="value">' + qual.tenth.division + '</td></tr>\n';
            html += '        </table>\n';
        }
        
        if (qual && qual.twelfth) {
            html += '        <table class="data-table" style="margin-bottom: 10px;">\n';
            html += '            <tr class="sub-header"><td colspan="4">12th Standard</td></tr>\n';
            html += '            <tr><td class="label">Board</td><td class="value">' + qual.twelfth.board + '</td><td class="label">School</td><td class="value">' + qual.twelfth.school + '</td></tr>\n';
            html += '            <tr><td class="label">Stream</td><td class="value">' + qual.twelfth.stream + '</td><td class="label">Year</td><td class="value">' + qual.twelfth.year + '</td></tr>\n';
            html += '            <tr><td class="label">Roll No</td><td class="value">' + qual.twelfth.roll + '</td><td class="label">Percentage</td><td class="value">' + qual.twelfth.percentage + '</td></tr>\n';
            html += '            <tr><td class="label">Division</td><td class="value">' + qual.twelfth.division + '</td><td class="value"></td><td class="value"></td></tr>\n';
            html += '        </table>\n';
        }
        
        if (qual && qual.graduation) {
            html += '        <table class="data-table">\n';
            html += '            <tr class="sub-header"><td colspan="4">Graduation</td></tr>\n';
            html += '            <tr><td class="label">University</td><td class="value">' + qual.graduation.university + '</td><td class="label">College</td><td class="value">' + qual.graduation.college + '</td></tr>\n';
            html += '            <tr><td class="label">Degree</td><td class="value">' + qual.graduation.degree + '</td><td class="label">Stream</td><td class="value">' + qual.graduation.stream + '</td></tr>\n';
            html += '            <tr><td class="label">Year</td><td class="value">' + qual.graduation.year + '</td><td class="label">Enrollment No</td><td class="value">' + qual.graduation.enroll + '</td></tr>\n';
            html += '            <tr><td class="label">Percentage</td><td class="value">' + qual.graduation.percentage + '</td><td class="label">Division</td><td class="value">' + qual.graduation.division + '</td></tr>\n';
            html += '        </table>\n';
        }
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">4. Payment Information</h3>\n';
        html += '        <table class="data-table">\n';
        html += '            <tr><td class="label">Total Fees</td><td class="value">&#8377;' + s.fees.totalFees + '</td><td class="label">Paid Amount</td><td class="value" style="color: #16a34a; font-weight: 700;">&#8377;' + s.fees.paidAmount + '</td></tr>\n';
        html += '            <tr><td class="label">Pending Fees</td><td class="value" style="color: ' + (s.fees.dueAmount > 0 ? '#d97706' : '#16a34a') + '; font-weight: 700;">&#8377;' + s.fees.dueAmount + '</td><td class="label">Payment Status</td><td class="value" style="color: #16a34a; font-weight: 700;">' + (s.fees.dueAmount > 0 ? 'Partial' : 'Fully Paid') + '</td></tr>\n';
        html += '        </table>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">5. Declaration</h3>\n';
        html += '        <div style="background: #f8fafc; padding: 15px; border: 2px solid #1e40af; margin-top: 0;">\n';
        html += '            <ol style="margin: 0; padding-left: 20px; line-height: 1.8; color: #0f172a;">\n';
        html += '                <li>Maine jo bhi jaankari di hai wo bilkul sahi aur sacchi hai.</li>\n';
        html += '                <li>Main institute ke sabhi niyam aur kanoon manne ko taiyaar hun.</li>\n';
        html += '                <li>Mujhe pata hai ki ek baar jama ki gayi fees refundable nahi hogi.</li>\n';
        html += '                <li>Main minimum 75% attendance rakhne ka pran karta hun.</li>\n';
        html += '                <li>Main class mein shant aur vyavasthit rahunga/karungi.</li>\n';
        html += '                <li>Main institute ki property (computer, furniture, etc.) ka dhyan se isthapana karunga/karungi.</li>\n';
        html += '                <li>Main kisi bhi tarah ka ragging, badtameezi ya ghatna mein hissa nahi lunga/lungi.</li>\n';
        html += '                <li>Main teachers aur staff ka samman karunga/karungi.</li>\n';
        html += '                <li>Main assignments aur projects ko samay par submit karunga/karungi.</li>\n';
        html += '                <li>Main exam ke niyam ka paalan karunga/karungi aur nakal nahi karunga/karungi.</li>\n';
        html += '            </ol>\n';
        html += '        </div>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="signatures">\n';
        html += '        <div class="flex">\n';
        html += '            <div class="line">Student Signature</div>\n';
        html += '            <div class="line">Institute Seal & Signature</div>\n';
        html += '        </div>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="footer">\n';
        html += '        <p style="font-weight: 600;">This is a computer-generated admission application form.</p>\n';
        html += '        <p>For any queries, please contact the institute administration.</p>\n';
        html += '        <p class="generated-date">Generated on: ' + formatDate(new Date()) + '</p>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <script>\n';
        html += '        window.onload = function() {\n';
        html += '            window.print();\n';
        html += '            window.onafterprint = function() { window.close(); };\n';
        html += '        };\n';
        html += '    </script>\n';
        html += '</body>\n';
        html += '</html>\n';
        printWindow.document.write(html);
    } catch (err) {
        showNotification('Error loading student data!', 'error');
    }
}

// ===== Carousel =====
async function loadCarouselAdmin() {
    try {
        const items = await fetch('/api/carousel').then(r => r.json());
        const grid = document.getElementById('carouselAdminGrid');
        if (items.length === 0) {
            grid.innerHTML = '<p style="color:#999;">Koi carousel image nahi hai. Add Image dabao.</p>';
            return;
        }
        grid.innerHTML = items.map(item => {
            let html = '';
            html += '<div class="carousel-admin-card">';
            html += '<img src="' + item.image + '" alt="' + (item.caption || 'Slide') + '">';
            html += '<div class="carousel-admin-info">';
            html += '<p>' + (item.caption || '<em style="color:#999">No caption</em>') + '</p>';
            html += '<button class="action-btn delete-btn" onclick="deleteCarouselItem(' + item.id + ')"><i class="fas fa-trash"></i> Delete</button>';
            html += '</div>';
            html += '</div>';
            return html;
        }).join('');
    } catch (err) { showNotification('Error loading carousel!', 'error'); }
}

function openCarouselModal() {
    document.getElementById('carouselCaption').value = '';
    document.getElementById('carouselFile').value = '';
    document.getElementById('carouselPreviewImg').style.display = 'none';
    document.getElementById('carouselPlaceholder').style.display = 'block';
    carouselImageFile = null;
    document.getElementById('carouselModal').classList.add('active');
}

async function saveCarouselItem() {
    if (!carouselImageFile) { showNotification('Pehle image select karo!', 'error'); return; }
    const formData = new FormData();
    formData.append('image', carouselImageFile);
    formData.append('caption', document.getElementById('carouselCaption').value);
    try {
        const res = await fetch('/api/carousel', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            closeModal('carouselModal');
            carouselImageFile = null;
            loadCarouselAdmin();
            showNotification('Carousel image added!', 'success');
        } else {
            showNotification(data.message || 'Upload failed!', 'error');
        }
    } catch (err) { showNotification('Error uploading image!', 'error'); }
}

async function deleteCarouselItem(id) {
    if (!confirm('Delete this carousel image?')) return;
    try {
        await fetch('/api/carousel/' + id, { method: 'DELETE' });
        loadCarouselAdmin();
        showNotification('Deleted!', 'success');
    } catch (err) { showNotification('Error!', 'error'); }
}

// ===== About =====
async function autoWriteDescription() {
    try {
        const settings = await fetch('/api/settings').then(r => r.json());
        const name = settings.name || 'Genius Computer Education';
        const phone = settings.phone || '';
        const email = settings.email || '';
        const address = settings.address || '';

        let desc = '';
        desc += name + ' ek leading computer education institute hai jo students ko high-quality technical training deta hai.\n';
        desc += '\n';
        desc += 'Hamare baare mein:\n';
        desc += '✔ Experienced aur qualified faculty\n';
        desc += '✔ Modern computer lab with latest equipment\n';
        desc += '✔ Industry-relevant courses for all age groups\n';
        desc += '✔ Practical-based learning approach\n';
        desc += '✔ Job placement assistance\n';
        desc += '\n';
        if (address) desc += '📍 Address: ' + address + '\n';
        if (phone) desc += '📞 Phone: ' + phone + '\n';
        if (email) desc += '✉ Email: ' + email + '\n';
        desc += '\n';
        desc += 'Aaj hi enroll karein aur apna digital future banayein!';

        document.getElementById('aboutDescription').value = desc.trim();
        showNotification('Description auto-write ho gaya! Edit kar sakte hain.', 'success');
    } catch (err) {
        showNotification('Settings load nahi hui. Pehle settings save karo.', 'error');
    }
}

async function loadAbout() {
    try {
        const about = await fetch('/api/about').then(r => r.json());
        document.getElementById('aboutDescription').value = about.description || '';
        document.getElementById('aboutMapUrl').value = about.mapUrl || '';
        if (about.mapUrl) previewMap(about.mapUrl);
    } catch (err) { console.error(err); }
}

document.getElementById('aboutForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = {
        description: document.getElementById('aboutDescription').value,
        mapUrl: document.getElementById('aboutMapUrl').value.trim()
    };
    try {
        const res = await fetch('/api/about', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await res.json();
        if (result.success) showNotification('About section saved!', 'success');
    } catch (err) { showNotification('Error saving about!', 'error'); }
});

function autoFillFromMap() {
    const input = document.getElementById('aboutMapUrl').value.trim();
    if (!input) { showNotification('Pehle Google Maps link paste karo!', 'error'); return; }

    let address = '';

    try {
        const url = new URL(input);
        const q = url.searchParams.get('q') || url.searchParams.get('query');
        const daddr = url.searchParams.get('daddr');
        const place = url.pathname.match(/\/maps\/place\/([^/@]+)/);

        if (q) address = decodeURIComponent(q.replace(/\+/g, ' '));
        else if (daddr) address = decodeURIComponent(daddr.replace(/\+/g, ' '));
        else if (place) address = decodeURIComponent(place[1].replace(/\+/g, ' '));
    } catch (e) {
        // If URL parsing fails, try regex
        const match = input.match(/[?&]q=([^&]+)/) || input.match(/place\/([^/@?]+)/);
        if (match) address = decodeURIComponent(match[1].replace(/\+/g, ' '));
    }

    if (address) {
        const currentDesc = document.getElementById('aboutDescription').value;
        const locationLine = '\n\nHamara Address: ' + address;
        if (!currentDesc.includes(locationLine)) {
            document.getElementById('aboutDescription').value = currentDesc + locationLine;
        }

        // Convert share URL to embed URL if needed
        const embedUrl = convertToEmbedUrl(input);
        document.getElementById('aboutMapUrl').value = embedUrl;
        previewMap(embedUrl);
        showNotification('Address auto-fill ho gaya! Save karo.', 'success');
    } else {
        // No address extracted, just try to embed the map
        const embedUrl = convertToEmbedUrl(input);
        document.getElementById('aboutMapUrl').value = embedUrl;
        previewMap(embedUrl);
        showNotification('Map preview ready! Description manually likho.', 'success');
    }
}

function convertToEmbedUrl(input) {
    // If user pasted full iframe HTML, extract src
    const srcMatch = input.match(/src="([^"]+)"/);
    if (srcMatch) return srcMatch[1];

    // Already a proper embed URL (from Share > Embed a map)
    if (input.includes('/maps/embed')) return input;

    // Already has output=embed
    if (input.includes('output=embed')) return input;

    // Extract query from various Google Maps URL formats
    let query = '';
    try {
        const u = new URL(input);
        query = u.searchParams.get('q') || u.searchParams.get('query') || '';

        // Handle /maps/place/PlaceName format
        if (!query) {
            const placeMatch = u.pathname.match(/\/maps\/place\/([^/@]+)/);
            if (placeMatch) query = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
        }
    } catch (e) {
        const match = input.match(/[?&]q=([^&]+)/);
        if (match) query = match[1];
    }

    if (query) {
        return 'https://maps.google.com/maps?q=' + encodeURIComponent(query) + '&output=embed';
    }

    // Return as-is if nothing matched
    return input;
}

function previewMap(urlOverride) {
    const url = urlOverride || document.getElementById('aboutMapUrl').value.trim();
    if (!url) { showNotification('Map URL daalo pehle!', 'error'); return; }
    const embedUrl = convertToEmbedUrl(url);
    document.getElementById('aboutMapPreview').src = embedUrl;
    document.getElementById('mapPreviewBox').style.display = 'block';
}

// ===== Settings =====
async function loadSettings() {
    try {
        const s = await fetch('/api/settings').then(r => r.json());
        document.getElementById('settingName').value = s.name || 'Genius Computer Education';
        document.getElementById('settingPhone').value = s.phone || '';
        document.getElementById('settingEmail').value = s.email || '';
        document.getElementById('settingAddress').value = s.address || '';
        document.getElementById('rightClickPrevention').checked = s.rightClickPrevention || false;
        if (s.logo) {
            const img = document.getElementById('logoPreviewImg');
            img.src = s.logo;
            img.style.display = 'block';
            document.getElementById('logoPlaceholder').style.display = 'none';
            document.getElementById('removeLogoBtn').style.display = 'inline-block';
        }
        if (s.signature) {
            const img = document.getElementById('signaturePreviewImg');
            img.src = s.signature;
            img.style.display = 'block';
            document.getElementById('signaturePlaceholder').style.display = 'none';
            document.getElementById('removeSignatureBtn').style.display = 'inline-block';
        }
        if (s.smtp) {
            document.getElementById('smtpUser').value = s.smtp.user || '';
            document.getElementById('smtpPass').value = s.smtp.pass || '';
            document.getElementById('smtpHost').value = s.smtp.host || 'smtp.gmail.com';
            document.getElementById('smtpPort').value = s.smtp.port || '587';
        }
        if (s.razorpay) {
            document.getElementById('razorpayKeyId').value = s.razorpay.keyId || '';
            document.getElementById('razorpayKeySecret').value = s.razorpay.keySecret || '';
        }
    } catch (err) { console.error(err); }
    
    // Initialize settings tabs
    initSettingsTabs();
}

function initSettingsTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all tab content
            document.querySelectorAll('.settings-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Show target tab content
            document.getElementById('tab-' + targetTab).classList.add('active');
        });
    });
}

async function loadLogoPreview() {
    try {
        const settings = await fetch('/api/settings').then(r => r.json());
        const previewImg = document.getElementById('logoPreviewImg');
        const placeholder = document.getElementById('logoPlaceholder');
        const removeBtn = document.getElementById('removeLogoBtn');
        if (settings.logo) {
            previewImg.src = settings.logo;
            previewImg.style.display = 'block';
            placeholder.style.display = 'none';
            removeBtn.style.display = 'inline-block';
        } else {
            previewImg.style.display = 'none';
            placeholder.style.display = 'block';
            removeBtn.style.display = 'none';
        }
    } catch (err) { console.error(err); }
}

async function removeLogo() {
    if (!confirm('Remove logo?')) return;
    try {
        await fetch('/api/logo', { method: 'DELETE' });
        loadLogoPreview();
        loadAdminLogo();
        showNotification('Logo removed!', 'success');
    } catch (err) { showNotification('Error!', 'error'); }
}

async function loadSignaturePreview() {
    try {
        const settings = await fetch('/api/settings').then(r => r.json());
        const previewImg = document.getElementById('signaturePreviewImg');
        const placeholder = document.getElementById('signaturePlaceholder');
        const removeBtn = document.getElementById('removeSignatureBtn');
        if (settings.signature) {
            previewImg.src = settings.signature;
            previewImg.style.display = 'block';
            placeholder.style.display = 'none';
            removeBtn.style.display = 'inline-block';
        } else {
            previewImg.style.display = 'none';
            placeholder.style.display = 'block';
            removeBtn.style.display = 'none';
        }
    } catch (err) { console.error(err); }
}

async function removeSignature() {
    if (!confirm('Remove signature?')) return;
    try {
        await fetch('/api/signature', { method: 'DELETE' });
        loadSignaturePreview();
        showNotification('Signature removed!', 'success');
    } catch (err) { showNotification('Error!', 'error'); }
}

document.getElementById('settingsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('settingName').value,
        phone: document.getElementById('settingPhone').value,
        email: document.getElementById('settingEmail').value,
        address: document.getElementById('settingAddress').value,
        rightClickPrevention: document.getElementById('rightClickPrevention').checked
    };
    try {
        await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        loadAdminLogo();
        showNotification('Settings saved!', 'success');
    } catch (err) { showNotification('Error saving settings!', 'error'); }
});

document.getElementById('razorpaySettingsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = { razorpayKeyId: document.getElementById('razorpayKeyId').value.trim(), razorpayKeySecret: document.getElementById('razorpayKeySecret').value.trim() };
    try {
        await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        showNotification('Razorpay settings saved!', 'success');
    } catch (err) { showNotification('Error!', 'error'); }
});

document.getElementById('smtpForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = {
        smtpUser: document.getElementById('smtpUser').value,
        smtpPass: document.getElementById('smtpPass').value,
        smtpHost: document.getElementById('smtpHost').value,
        smtpPort: document.getElementById('smtpPort').value
    };
    try {
        await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        showNotification('Email settings saved!', 'success');
    } catch (err) { showNotification('Error saving email settings!', 'error'); }
});

// ===== Utilities =====
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if (modalId === 'notificationModal') {
        resetNotificationButton();
    }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

function showNotification(message, type) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-notification toast-' + type;
    toast.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle') + '"></i> ' + message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('toast-show'); }, 10);
    setTimeout(function() {
        toast.classList.remove('toast-show');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

// --- Result & Grading Functions ---

async function loadOnlineExamResults() {
    try {
        console.log('Loading online exam results...');
        const grades = await fetch('/api/exam-grades').then(r => r.json());
        const onlineExams = await fetch('/api/online-exams').then(r => r.json());
        
        console.log('Grades response:', grades);
        console.log('Online exams response:', onlineExams);
        
        // Populate exam filter dropdown
        const examFilter = document.getElementById('resultFilterExam');
        if (examFilter) {
            examFilter.innerHTML = '<option value="">All Exams</option>' + onlineExams.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        }
        
        // Apply filters
        const filterPublished = document.getElementById('resultFilterPublished')?.value || '';
        const filterExam = document.getElementById('resultFilterExam')?.value || '';
        
        console.log('Filter published:', filterPublished, 'Filter exam:', filterExam);
        
        let filteredGrades = Array.isArray(grades) ? grades : (grades.grades || []);
        console.log('Total grades:', filteredGrades.length);
        
        if (filterPublished === 'unpublished') {
            filteredGrades = filteredGrades.filter(g => !g.published);
        } else if (filterPublished === 'published') {
            filteredGrades = filteredGrades.filter(g => g.published);
        } else if (filterPublished === 'scheduled') {
            filteredGrades = filteredGrades.filter(g => !g.published && g.scheduledPublishAt);
        }
        
        if (filterExam) {
            filteredGrades = filteredGrades.filter(g => g.examId == filterExam);
        }
        
        console.log('Filtered grades:', filteredGrades.length);
        
        const tbody = document.querySelector('#onlineExamResultsTable tbody');
        console.log('Table body found:', tbody);
        
        if (filteredGrades && filteredGrades.length > 0) {
            tbody.innerHTML = filteredGrades.map(g => {
                let pubBadge;
                if (g.published) {
                    pubBadge = `<span class="status-badge status-active">✓ Published</span>`;
                } else if (g.scheduledPublishAt) {
                    const when = formatDateTime(g.scheduledPublishAt);
                    pubBadge = `<span class="status-badge" style="background:#fef3c7;color:#92400e;" title="Scheduled: ${when}">⏰ Scheduled</span><div style="font-size:10px;color:#92400e;margin-top:2px;">${when}</div>`;
                } else {
                    pubBadge = `<span class="status-badge status-inactive">Pending</span>`;
                }
                
                let actionBtns = `<button class="btn btn-info" onclick="viewResult(${g.id})" style="padding:5px 10px;font-size:12px;"><i class="fas fa-eye"></i> View</button>`;
                actionBtns += `<button class="btn btn-primary" onclick="downloadResultPDF(${g.id}, 'marksheet')" style="padding:5px 10px;font-size:12px;"><i class="fas fa-file-pdf"></i> Marksheet</button>`;
                if (g.published && g.status === 'Passed') {
                    actionBtns += `<button class="btn btn-success" onclick="downloadResultPDF(${g.id}, 'certificate')" style="padding:5px 10px;font-size:12px;background:#16a34a;color:#fff;border:none;"><i class="fas fa-certificate"></i> Certificate</button>`;
                }
                if (g.published) {
                    actionBtns += `<button class="btn btn-warning" onclick="unpublishResult(${g.id})" style="padding:5px 10px;font-size:12px;background:#f59e0b;color:#fff;border:none;"><i class="fas fa-undo"></i> Unpublish</button>`;
                } else if (g.scheduledPublishAt) {
                    actionBtns += `<button class="btn btn-secondary" onclick="cancelScheduleOne(${g.id})" style="padding:5px 10px;font-size:12px;"><i class="fas fa-ban"></i> Cancel</button>`;
                    actionBtns += `<button class="btn btn-success" onclick="publishResult(${g.id})" style="padding:5px 10px;font-size:12px;"><i class="fas fa-check"></i> Publish Now</button>`;
                } else {
                    actionBtns += `<button class="btn btn-success" onclick="publishResult(${g.id})" style="padding:5px 10px;font-size:12px;"><i class="fas fa-check"></i> Publish</button>`;
                }
                actionBtns += `<button class="btn btn-danger" onclick="deleteResult(${g.id})" style="padding:5px 10px;font-size:12px;"><i class="fas fa-trash"></i> Delete</button>`;
                
                return `
                    <tr>
                        <td><input type="checkbox" class="result-checkbox" value="${g.id}" data-published="${g.published ? '1' : '0'}" data-scheduled="${g.scheduledPublishAt ? '1' : '0'}" onchange="updateSelectedCount()"></td>
                        <td>${g.studentName}</td>
                        <td>${g.examName}</td>
                        <td>${g.course}</td>
                        <td>${g.obtained} / ${g.total}</td>
                        <td>${g.percentage}%</td>
                        <td><span class="grade-badge">${g.grade}</span></td>
                        <td><span class="status-badge ${g.status === 'Passed' ? 'status-active' : 'status-inactive'}">${g.status}</span></td>
                        <td>${pubBadge}</td>
                        <td>${formatDate(g.date)}</td>
                        <td>
                            <div style="display:flex;gap:5px;flex-wrap:wrap;">${actionBtns}</div>
                        </td>
                    </tr>
                `;
            }).join('');
            updateSelectedCount();
        } else {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:#64748b;">No exam results found</td></tr>';
        }
    } catch (e) {
        console.error('Error loading exam results:', e);
    }
}

function updateSelectedCount() {
    const count = document.querySelectorAll('.result-checkbox:checked').length;
    const label = document.getElementById('selectedCountLabel');
    if (label) label.textContent = count;
}

function downloadResultPDF(gradeId, type) {
    const url = `/api/exam-grades/${gradeId}/pdf${type ? '?type=' + type : ''}`;
    window.open(url, '_blank');
}

async function publishResult(gradeId) {
    const sendEmail = document.getElementById('sendEmailNotification')?.checked || false;
    const msg = sendEmail
        ? 'Publish this result and send email notification to student?'
        : 'Publish this result? It will become visible to the student.';
    if (!confirm(msg)) return;
    try {
        const res = await fetch('/api/exam-grades/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gradeId, sendEmail })
        });
        const data = await res.json();
        
        if (data.success) {
            let msg = 'Result published successfully!';
            if (sendEmail && data.email) {
                msg += data.email.sent ? ' Email sent.' : ` (Email failed: ${data.email.reason || 'unknown'})`;
            }
            showNotification(msg, 'success');
            loadOnlineExamResults();
        } else {
            showNotification('Failed to publish result', 'error');
        }
    } catch (e) {
        console.error('Error publishing result:', e);
        showNotification('Error publishing result', 'error');
    }
}

async function unpublishResult(gradeId) {
    if (!confirm('Unpublish this result? It will no longer be visible to the student.')) return;
    try {
        const res = await fetch('/api/exam-grades/unpublish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gradeId })
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Result unpublished', 'success');
            loadOnlineExamResults();
        } else {
            showNotification('Failed to unpublish result', 'error');
        }
    } catch (e) {
        console.error('Error unpublishing result:', e);
        showNotification('Error unpublishing result', 'error');
    }
}

async function cancelScheduleOne(gradeId) {
    if (!confirm('Cancel scheduled publish for this result?')) return;
    try {
        const res = await fetch('/api/exam-grades/cancel-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gradeIds: [gradeId] })
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Schedule cancelled', 'success');
            loadOnlineExamResults();
        }
    } catch (e) {
        console.error('Error cancelling schedule:', e);
        showNotification('Error cancelling schedule', 'error');
    }
}

// Global state for view result modal
let _viewResultData = null;

function _vrEscape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function viewResult(gradeId) {
    try {
        const [gradesRes, settingsRes, examsRes, attemptsRes] = await Promise.all([
            fetch('/api/exam-grades'),
            fetch('/api/settings'),
            fetch('/api/online-exams'),
            fetch('/api/exam-attempts').catch(() => ({ json: () => [] }))
        ]);
        const gradesData = await gradesRes.json();
        const settings = await settingsRes.json();
        const examsData = await examsRes.json();
        const attemptsData = await attemptsRes.json().catch(() => []);
        
        const allGrades = Array.isArray(gradesData) ? gradesData : (gradesData.grades || []);
        const grade = allGrades.find(g => g.id == gradeId);
        if (!grade) { showNotification('Result not found', 'error'); return; }
        
        const allExams = Array.isArray(examsData) ? examsData : (examsData.exams || []);
        const exam = allExams.find(e => e.id == grade.examId);
        
        const allAttempts = Array.isArray(attemptsData) ? attemptsData : (attemptsData.attempts || []);
        const attempt = allAttempts.find(a => a.examId == grade.examId && a.studentId == grade.studentId) || { answers: {} };
        
        // Fetch student info + full history
        let student = null;
        let studentHistory = [];
        try {
            const studentsRes = await fetch('/api/students');
            const studentsData = await studentsRes.json();
            const allStudents = Array.isArray(studentsData) ? studentsData : (studentsData.students || []);
            student = allStudents.find(s => s.id == grade.studentId);
            studentHistory = allGrades.filter(g => g.studentId == grade.studentId)
                .sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
        } catch(e) { console.warn('Could not fetch student info:', e); }
        
        _viewResultData = { grade, settings, exam, attempt, student, studentHistory };
        
        const modal = document.createElement('div');
        modal.id = 'view-result-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:9999;';
        modal.innerHTML = `
            <div style="max-width:1200px;width:95%;height:92vh;display:flex;flex-direction:column;background:#fff;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.2);overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:15px 20px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;flex-shrink:0;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        ${settings.logo ? `<img src="${settings.logo}" alt="Logo" style="height:40px;">` : ''}
                        <div>
                            <h3 style="margin:0;font-size:16px;color:#1e293b;">${settings.name || 'Institute'}</h3>
                            <div style="font-size:12px;color:#64748b;"><strong>${grade.studentName}</strong> • ${grade.course} • ${grade.examName}</div>
                        </div>
                    </div>
                    <button id="vr-close-x" style="padding:6px 12px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;">✕ Close</button>
                </div>
                <div style="display:flex;gap:4px;padding:0 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;flex-shrink:0;">
                    <button class="vr-tab-btn active" data-tab="report" style="padding:12px 18px;background:none;border:none;border-bottom:3px solid #3b82f6;cursor:pointer;font-weight:600;color:#3b82f6;">📄 Report</button>
                    <button class="vr-tab-btn" data-tab="stats" style="padding:12px 18px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;color:#64748b;">📊 Statistics</button>
                    <button class="vr-tab-btn" data-tab="history" style="padding:12px 18px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;color:#64748b;">👤 Student History</button>
                    <button class="vr-tab-btn" data-tab="answers" style="padding:12px 18px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;color:#64748b;">📝 Answer Review</button>
                </div>
                <div id="vr-tab-content" style="flex:1;overflow-y:auto;padding:20px;background:#fff;"></div>
                <div style="padding:12px 20px;background:#f1f5f9;border-top:1px solid #e2e8f0;flex-shrink:0;display:flex;justify-content:flex-end;gap:8px;">
                    <button id="vr-print-btn" style="padding:8px 16px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;"><i class="fas fa-print"></i> Print / PDF</button>
                    <button id="vr-close-btn" style="padding:8px 16px;background:#64748b;color:#fff;border:none;border-radius:6px;cursor:pointer;">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Event listeners
        const closeModal = () => modal.remove();
        document.getElementById('vr-close-x').addEventListener('click', closeModal);
        document.getElementById('vr-close-btn').addEventListener('click', closeModal);
        document.getElementById('vr-print-btn').addEventListener('click', () => _vrPrintReport());
        
        modal.querySelectorAll('.vr-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.vr-tab-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.borderBottom = '3px solid transparent';
                    b.style.color = '#64748b';
                    b.style.fontWeight = 'normal';
                });
                btn.classList.add('active');
                btn.style.borderBottom = '3px solid #3b82f6';
                btn.style.color = '#3b82f6';
                btn.style.fontWeight = '600';
                _vrRenderTab(btn.dataset.tab);
            });
        });
        
        _vrRenderTab('report');
    } catch (e) {
        console.error('Error viewing result:', e);
        showNotification('Error viewing result', 'error');
    }
}

function _vrRenderTab(tab) {
    const container = document.getElementById('vr-tab-content');
    if (!container || !_viewResultData) return;
    const { grade, settings, exam, attempt, student, studentHistory } = _viewResultData;
    
    if (tab === 'report') {
        container.innerHTML = _vrReportHtml(grade, settings, student);
    } else if (tab === 'stats') {
        container.innerHTML = _vrStatsHtml(grade, exam, attempt);
    } else if (tab === 'history') {
        container.innerHTML = _vrHistoryHtml(student, studentHistory, grade);
    } else if (tab === 'answers') {
        container.innerHTML = _vrAnswersHtml(exam, attempt);
        // Attach filter listeners
        const searchInput = document.getElementById('vr-q-search');
        const filterSel = document.getElementById('vr-q-filter');
        const applyFilter = () => {
            const q = (searchInput.value || '').toLowerCase();
            const f = filterSel.value;
            document.querySelectorAll('.vr-question-item').forEach(item => {
                const txt = item.textContent.toLowerCase();
                const status = item.dataset.status;
                const matchText = !q || txt.includes(q);
                const matchStatus = f === 'all' || status === f;
                item.style.display = (matchText && matchStatus) ? 'block' : 'none';
            });
        };
        if (searchInput) searchInput.addEventListener('input', applyFilter);
        if (filterSel) filterSel.addEventListener('change', applyFilter);
    }
}

function _vrReportHtml(grade, settings, student) {
    const passColor = grade.status === 'Passed' ? '#22c55e' : '#ef4444';
    return `
        <div id="vr-printable" style="max-width:800px;margin:0 auto;padding:30px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
            <div style="text-align:center;border-bottom:2px solid #1e293b;padding-bottom:20px;margin-bottom:25px;">
                ${settings.logo ? `<img src="${settings.logo}" style="height:70px;margin-bottom:10px;">` : ''}
                <h2 style="margin:0;color:#1e293b;">${settings.name || 'Institute'}</h2>
                ${settings.address ? `<div style="color:#64748b;font-size:13px;margin-top:4px;">${settings.address}</div>` : ''}
                <h3 style="margin:15px 0 0;color:#3b82f6;letter-spacing:2px;">EXAM RESULT REPORT</h3>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                <tr><td style="padding:8px;background:#f1f5f9;font-weight:600;width:40%;">Student Name</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${grade.studentName}</td></tr>
                ${student?.rollNumber ? `<tr><td style="padding:8px;background:#f1f5f9;font-weight:600;">Roll Number</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${student.rollNumber}</td></tr>` : ''}
                ${student?.email ? `<tr><td style="padding:8px;background:#f1f5f9;font-weight:600;">Email</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${student.email}</td></tr>` : ''}
                ${student?.phone ? `<tr><td style="padding:8px;background:#f1f5f9;font-weight:600;">Phone</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${student.phone}</td></tr>` : ''}
                <tr><td style="padding:8px;background:#f1f5f9;font-weight:600;">Course</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${grade.course}</td></tr>
                <tr><td style="padding:8px;background:#f1f5f9;font-weight:600;">Exam Name</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${grade.examName}</td></tr>
                <tr><td style="padding:8px;background:#f1f5f9;font-weight:600;">Exam Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${formatDate(grade.date)}</td></tr>
                ${grade.rank ? `<tr><td style="padding:8px;background:#f1f5f9;font-weight:600;">Rank</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><span style="color:#f59e0b;font-weight:700;">#${grade.rank}</span></td></tr>` : ''}
            </table>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:25px;">
                <div style="text-align:center;padding:20px;background:#f8fafc;border-radius:8px;border:2px solid #e2e8f0;">
                    <div style="font-size:12px;color:#64748b;margin-bottom:6px;">Total Marks</div>
                    <div style="font-size:28px;font-weight:700;color:#1e293b;">${grade.total}</div>
                </div>
                <div style="text-align:center;padding:20px;background:#f8fafc;border-radius:8px;border:2px solid #3b82f6;">
                    <div style="font-size:12px;color:#64748b;margin-bottom:6px;">Obtained</div>
                    <div style="font-size:28px;font-weight:700;color:#3b82f6;">${grade.obtained}</div>
                </div>
                <div style="text-align:center;padding:20px;background:#f8fafc;border-radius:8px;border:2px solid ${passColor};">
                    <div style="font-size:12px;color:#64748b;margin-bottom:6px;">Percentage</div>
                    <div style="font-size:28px;font-weight:700;color:${passColor};">${grade.percentage}%</div>
                </div>
            </div>
            <div style="text-align:center;padding:25px;background:linear-gradient(135deg, ${passColor}22, ${passColor}11);border-radius:8px;border:2px solid ${passColor};">
                <div style="font-size:14px;color:#64748b;margin-bottom:8px;">Grade</div>
                <div style="font-size:48px;font-weight:700;color:${passColor};line-height:1;">${grade.grade}</div>
                <div style="font-size:18px;font-weight:600;color:${passColor};margin-top:8px;">${grade.status.toUpperCase()}</div>
            </div>
            <div style="margin-top:30px;padding-top:20px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;font-size:12px;color:#64748b;">
                <div>Generated: ${formatDate(new Date())}</div>
                <div>Published: ${grade.published ? 'Yes' : 'No'}</div>
            </div>
            <div style="margin-top:40px;display:flex;justify-content:space-between;">
                <div style="text-align:center;">
                    <div style="border-top:1px solid #1e293b;padding-top:5px;width:180px;font-size:12px;">Student Signature</div>
                </div>
                <div style="text-align:center;">
                    <div style="border-top:1px solid #1e293b;padding-top:5px;width:180px;font-size:12px;">Authorized Signatory</div>
                </div>
            </div>
        </div>
    `;
}

function _vrStatsHtml(grade, exam, attempt) {
    if (!exam) return '<div style="text-align:center;padding:40px;color:#64748b;">Exam data not available</div>';
    const total = exam.questions.length;
    const answers = attempt.answers || {};
    let correct = 0, incorrect = 0, notAttempted = 0;
    exam.questions.forEach((q, i) => {
        const a = answers[i.toString()];
        if (a === undefined) notAttempted++;
        else if (a === parseInt(q.correctAnswer)) correct++;
        else incorrect++;
    });
    const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;
    const attemptRate = total > 0 ? (((total - notAttempted) / total) * 100).toFixed(1) : 0;
    const timeTaken = attempt.timeTaken ? Math.round(attempt.timeTaken / 60) : null;
    
    return `
        <div style="max-width:900px;margin:0 auto;">
            <h3 style="margin:0 0 20px;color:#1e293b;">Performance Statistics</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px;margin-bottom:25px;">
                <div style="padding:20px;background:#dbeafe;border-radius:8px;border-left:4px solid #3b82f6;">
                    <div style="font-size:12px;color:#64748b;">Total Questions</div>
                    <div style="font-size:32px;font-weight:700;color:#3b82f6;">${total}</div>
                </div>
                <div style="padding:20px;background:#dcfce7;border-radius:8px;border-left:4px solid #22c55e;">
                    <div style="font-size:12px;color:#64748b;">Correct</div>
                    <div style="font-size:32px;font-weight:700;color:#22c55e;">${correct}</div>
                </div>
                <div style="padding:20px;background:#fee2e2;border-radius:8px;border-left:4px solid #ef4444;">
                    <div style="font-size:12px;color:#64748b;">Incorrect</div>
                    <div style="font-size:32px;font-weight:700;color:#ef4444;">${incorrect}</div>
                </div>
                <div style="padding:20px;background:#fef3c7;border-radius:8px;border-left:4px solid #f59e0b;">
                    <div style="font-size:12px;color:#64748b;">Not Attempted</div>
                    <div style="font-size:32px;font-weight:700;color:#f59e0b;">${notAttempted}</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:25px;">
                <div style="padding:20px;background:#f8fafc;border-radius:8px;">
                    <div style="font-size:13px;color:#64748b;margin-bottom:10px;">Accuracy Rate</div>
                    <div style="font-size:24px;font-weight:700;color:#1e293b;">${accuracy}%</div>
                    <div style="margin-top:10px;height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;">
                        <div style="width:${accuracy}%;height:100%;background:#22c55e;"></div>
                    </div>
                </div>
                <div style="padding:20px;background:#f8fafc;border-radius:8px;">
                    <div style="font-size:13px;color:#64748b;margin-bottom:10px;">Attempt Rate</div>
                    <div style="font-size:24px;font-weight:700;color:#1e293b;">${attemptRate}%</div>
                    <div style="margin-top:10px;height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;">
                        <div style="width:${attemptRate}%;height:100%;background:#3b82f6;"></div>
                    </div>
                </div>
            </div>
            ${timeTaken !== null ? `
            <div style="padding:15px;background:#f1f5f9;border-radius:8px;margin-bottom:15px;">
                <strong>Time Taken:</strong> ${timeTaken} minutes
                ${exam.duration ? ` out of ${exam.duration} minutes` : ''}
            </div>` : ''}
            <div style="padding:15px;background:#f1f5f9;border-radius:8px;">
                <strong>Score Breakdown:</strong> ${grade.obtained} / ${grade.total} marks (${grade.percentage}%) — Grade <strong>${grade.grade}</strong> — <span style="color:${grade.status === 'Passed' ? '#22c55e' : '#ef4444'};font-weight:600;">${grade.status}</span>
            </div>
        </div>
    `;
}

function _vrHistoryHtml(student, history, currentGrade) {
    const totalExams = history.length;
    const avgPercent = totalExams > 0 ? (history.reduce((s, g) => s + parseFloat(g.percentage || 0), 0) / totalExams).toFixed(1) : 0;
    const passed = history.filter(g => g.status === 'Passed').length;
    
    return `
        <div style="max-width:1000px;margin:0 auto;">
            <div style="display:grid;grid-template-columns:1fr 2fr;gap:20px;margin-bottom:20px;">
                <div style="padding:20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
                    <h4 style="margin:0 0 15px;color:#1e293b;">Student Profile</h4>
                    ${student ? `
                        <div style="font-size:13px;line-height:1.8;">
                            <div><strong>Name:</strong> ${student.name || currentGrade.studentName}</div>
                            ${student.rollNumber ? `<div><strong>Roll:</strong> ${student.rollNumber}</div>` : ''}
                            ${student.email ? `<div><strong>Email:</strong> ${student.email}</div>` : ''}
                            ${student.phone ? `<div><strong>Phone:</strong> ${student.phone}</div>` : ''}
                            ${student.course ? `<div><strong>Course:</strong> ${student.course}</div>` : ''}
                            ${student.batch ? `<div><strong>Batch:</strong> ${student.batch}</div>` : ''}
                        </div>
                    ` : `<div style="color:#64748b;">Name: <strong>${currentGrade.studentName}</strong><br>Course: ${currentGrade.course}</div>`}
                </div>
                <div style="padding:20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
                    <h4 style="margin:0 0 15px;color:#1e293b;">Overall Performance</h4>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
                        <div style="text-align:center;padding:12px;background:#fff;border-radius:6px;">
                            <div style="font-size:11px;color:#64748b;">Exams Taken</div>
                            <div style="font-size:22px;font-weight:700;color:#3b82f6;">${totalExams}</div>
                        </div>
                        <div style="text-align:center;padding:12px;background:#fff;border-radius:6px;">
                            <div style="font-size:11px;color:#64748b;">Passed</div>
                            <div style="font-size:22px;font-weight:700;color:#22c55e;">${passed}/${totalExams}</div>
                        </div>
                        <div style="text-align:center;padding:12px;background:#fff;border-radius:6px;">
                            <div style="font-size:11px;color:#64748b;">Avg %</div>
                            <div style="font-size:22px;font-weight:700;color:#1e293b;">${avgPercent}%</div>
                        </div>
                    </div>
                </div>
            </div>
            <h4 style="color:#1e293b;margin-bottom:10px;">Exam History (${totalExams})</h4>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="padding:10px;text-align:left;font-size:12px;">#</th>
                            <th style="padding:10px;text-align:left;font-size:12px;">Exam</th>
                            <th style="padding:10px;text-align:left;font-size:12px;">Date</th>
                            <th style="padding:10px;text-align:center;font-size:12px;">Score</th>
                            <th style="padding:10px;text-align:center;font-size:12px;">%</th>
                            <th style="padding:10px;text-align:center;font-size:12px;">Grade</th>
                            <th style="padding:10px;text-align:center;font-size:12px;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.map((g, i) => `
                            <tr style="${g.id == currentGrade.id ? 'background:#dbeafe;' : ''};border-bottom:1px solid #e2e8f0;">
                                <td style="padding:10px;font-size:13px;">${i + 1}</td>
                                <td style="padding:10px;font-size:13px;">${g.examName}${g.id == currentGrade.id ? ' <span style="font-size:10px;color:#3b82f6;font-weight:600;">(CURRENT)</span>' : ''}</td>
                                <td style="padding:10px;font-size:13px;">${formatDate(g.date)}</td>
                                <td style="padding:10px;text-align:center;font-size:13px;">${g.obtained}/${g.total}</td>
                                <td style="padding:10px;text-align:center;font-size:13px;font-weight:600;">${g.percentage}%</td>
                                <td style="padding:10px;text-align:center;font-size:13px;"><span class="grade-badge">${g.grade}</span></td>
                                <td style="padding:10px;text-align:center;"><span class="status-badge ${g.status === 'Passed' ? 'status-active' : 'status-inactive'}" style="font-size:11px;">${g.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function _vrAnswersHtml(exam, attempt) {
    if (!exam) return '<div style="text-align:center;padding:40px;color:#64748b;">Exam data not available</div>';
    const answers = attempt.answers || {};
    
    return `
        <div style="max-width:1000px;margin:0 auto;">
            <div style="display:flex;gap:10px;margin-bottom:20px;padding:15px;background:#f8fafc;border-radius:8px;position:sticky;top:-20px;z-index:10;">
                <input id="vr-q-search" type="text" placeholder="🔍 Search question text..." style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;">
                <select id="vr-q-filter" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;">
                    <option value="all">All Questions</option>
                    <option value="correct">✓ Correct Only</option>
                    <option value="incorrect">✗ Incorrect Only</option>
                    <option value="notAttempted">○ Not Attempted</option>
                </select>
            </div>
            <div>
                ${exam.questions.map((q, i) => {
                    const studentAns = answers[i.toString()];
                    const correctAns = parseInt(q.correctAnswer);
                    const isAttempted = studentAns !== undefined;
                    const isCorrect = studentAns === correctAns;
                    const status = !isAttempted ? 'notAttempted' : (isCorrect ? 'correct' : 'incorrect');
                    const statusColor = !isAttempted ? '#f59e0b' : (isCorrect ? '#22c55e' : '#ef4444');
                    const statusLabel = !isAttempted ? '○ Not Attempted' : (isCorrect ? '✓ Correct' : '✗ Incorrect');
                    
                    return `
                        <div class="vr-question-item" data-status="${status}" style="margin-bottom:12px;padding:14px;background:#fff;border:1px solid #e2e8f0;border-left:4px solid ${statusColor};border-radius:6px;">
                            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
                                <div style="font-weight:600;color:#1e293b;font-size:14px;flex:1;">Q${i + 1}: ${_vrEscape(q.text)}</div>
                                <span style="font-size:12px;font-weight:600;color:${statusColor};white-space:nowrap;margin-left:10px;">${statusLabel}</span>
                            </div>
                            <div style="margin-left:10px;font-size:13px;">
                                ${q.options.map((opt, oi) => {
                                    const isStudent = studentAns === oi;
                                    const isRight = oi === correctAns;
                                    let bg = '#fff', border = '#e2e8f0', weight = 'normal';
                                    if (isRight) { bg = '#dcfce7'; border = '#22c55e'; weight = '600'; }
                                    if (isStudent && !isRight) { bg = '#fee2e2'; border = '#ef4444'; weight = '600'; }
                                    const icon = isRight ? '✓ ' : (isStudent && !isRight ? '✗ ' : '');
                                    return `
                                        <div style="padding:6px 10px;margin:3px 0;background:${bg};border:1px solid ${border};border-radius:4px;font-weight:${weight};">
                                            ${icon}${_vrEscape(opt)}
                                            ${isStudent ? ' <span style="color:#6366f1;font-size:11px;">(Student)</span>' : ''}
                                            ${isRight ? ' <span style="color:#22c55e;font-size:11px;">(Correct)</span>' : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function _vrPrintReport() {
    if (!_viewResultData) return;
    const { grade, settings, student } = _viewResultData;
    const html = _vrReportHtml(grade, settings, student);
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(`
        <!DOCTYPE html><html><head><title>Result Report - ${grade.studentName}</title>
        <style>
            body{font-family:Arial,sans-serif;margin:0;padding:20px;background:#fff;}
            .grade-badge{display:inline-block;padding:2px 8px;background:#dbeafe;border-radius:4px;font-weight:600;}
            @media print{@page{size:A4;margin:15mm;}body{padding:0;}}
        </style></head><body><div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04;"><img src="/uploads/logo/logo.png" style="max-width: 300px; max-height: 300px;" onerror="this.parentElement.style.display='none'"></div>${html}
        <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
        </body></html>
    `);
    w.document.close();
}


async function deleteResult(gradeId) {
    if (!confirm('Are you sure you want to delete this result? This action cannot be undone.')) return;
    
    try {
        const res = await fetch('/api/exam-grades/' + gradeId, {
            method: 'DELETE'
        });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Result deleted successfully!', 'success');
            loadOnlineExamResults();
        } else {
            showNotification('Failed to delete result', 'error');
        }
    } catch (e) {
        console.error('Error deleting result:', e);
        showNotification('Error deleting result', 'error');
    }
}

async function publishAllSelected() {
    const checkboxes = document.querySelectorAll('.result-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Please select results to publish', 'warning');
        return;
    }
    
    // Filter to only unpublished
    const toPublish = Array.from(checkboxes).filter(cb => cb.dataset.published !== '1').map(cb => parseInt(cb.value));
    if (toPublish.length === 0) {
        showNotification('Selected results are already published', 'warning');
        return;
    }
    
    const sendEmail = document.getElementById('sendEmailNotification')?.checked || false;
    const confirmMsg = `Publish ${toPublish.length} result(s)?${sendEmail ? ' Email notifications will be sent to students.' : ''}`;
    if (!confirm(confirmMsg)) return;
    
    try {
        const res = await fetch('/api/exam-grades/publish-selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gradeIds: toPublish, sendEmail })
        });
        const data = await res.json();
        if (data.success) {
            let msg = `Published ${data.publishedCount} result(s)`;
            if (sendEmail) msg += `. Emails sent: ${data.emailsSent}, failed: ${data.emailsFailed}`;
            showNotification(msg, 'success');
            loadOnlineExamResults();
        } else {
            showNotification(data.message || 'Bulk publish failed', 'error');
        }
    } catch (e) {
        console.error('Bulk publish error:', e);
        showNotification('Error in bulk publish', 'error');
    }
}

async function unpublishAllSelected() {
    const checkboxes = document.querySelectorAll('.result-checkbox:checked');
    const toUnpublish = Array.from(checkboxes).filter(cb => cb.dataset.published === '1').map(cb => parseInt(cb.value));
    if (toUnpublish.length === 0) {
        showNotification('Please select published results to unpublish', 'warning');
        return;
    }
    if (!confirm(`Unpublish ${toUnpublish.length} result(s)? They will no longer be visible to students.`)) return;
    
    try {
        const res = await fetch('/api/exam-grades/unpublish-selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gradeIds: toUnpublish })
        });
        const data = await res.json();
        if (data.success) {
            showNotification(`Unpublished ${data.unpublishedCount} result(s)`, 'success');
            loadOnlineExamResults();
        } else {
            showNotification(data.message || 'Bulk unpublish failed', 'error');
        }
    } catch (e) {
        console.error('Bulk unpublish error:', e);
        showNotification('Error in bulk unpublish', 'error');
    }
}

async function cancelScheduleSelected() {
    const checkboxes = document.querySelectorAll('.result-checkbox:checked');
    const toCancel = Array.from(checkboxes).filter(cb => cb.dataset.scheduled === '1').map(cb => parseInt(cb.value));
    if (toCancel.length === 0) {
        showNotification('No scheduled results selected', 'warning');
        return;
    }
    if (!confirm(`Cancel schedule for ${toCancel.length} result(s)?`)) return;
    
    try {
        const res = await fetch('/api/exam-grades/cancel-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gradeIds: toCancel })
        });
        const data = await res.json();
        if (data.success) {
            showNotification(`Cancelled ${data.cancelledCount} schedule(s)`, 'success');
            loadOnlineExamResults();
        }
    } catch (e) {
        console.error('Cancel schedule error:', e);
        showNotification('Error cancelling schedules', 'error');
    }
}

function openScheduleModal() {
    const checkboxes = document.querySelectorAll('.result-checkbox:checked');
    const selectable = Array.from(checkboxes).filter(cb => cb.dataset.published !== '1').map(cb => parseInt(cb.value));
    if (selectable.length === 0) {
        showNotification('Please select unpublished results to schedule', 'warning');
        return;
    }
    
    // Default: 1 hour from now, format for datetime-local input
    const defaultDt = new Date(Date.now() + 60 * 60 * 1000);
    const pad = n => String(n).padStart(2, '0');
    const defaultStr = `${defaultDt.getFullYear()}-${pad(defaultDt.getMonth() + 1)}-${pad(defaultDt.getDate())}T${pad(defaultDt.getHours())}:${pad(defaultDt.getMinutes())}`;
    
    const existing = document.getElementById('schedule-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'schedule-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:10000;';
    modal.innerHTML = `
        <div style="background:#fff;padding:25px;border-radius:8px;max-width:450px;width:90%;box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin:0 0 15px;color:#1e293b;"><i class="fas fa-clock"></i> Schedule Publish</h3>
            <p style="color:#64748b;font-size:14px;margin-bottom:15px;">
                Schedule publishing of <strong>${selectable.length}</strong> selected result(s). They will auto-publish at the specified time.
            </p>
            <label style="display:block;margin-bottom:8px;font-weight:600;color:#334155;font-size:14px;">Publish Date & Time</label>
            <input type="datetime-local" id="schedule-datetime" value="${defaultStr}" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;margin-bottom:15px;">
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:20px;cursor:pointer;font-size:14px;">
                <input type="checkbox" id="schedule-send-email"> Send email notification when published
            </label>
            <div style="display:flex;justify-content:flex-end;gap:8px;">
                <button id="schedule-cancel" style="padding:8px 16px;background:#64748b;color:#fff;border:none;border-radius:6px;cursor:pointer;">Cancel</button>
                <button id="schedule-confirm" style="padding:8px 16px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;">Schedule</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('schedule-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('schedule-confirm').addEventListener('click', async () => {
        const dt = document.getElementById('schedule-datetime').value;
        if (!dt) { showNotification('Please select a date and time', 'warning'); return; }
        const scheduleDate = new Date(dt);
        if (scheduleDate <= new Date()) {
            if (!confirm('Selected time is in the past or now. Publish immediately?')) return;
        }
        const sendEmail = document.getElementById('schedule-send-email').checked;
        
        try {
            const res = await fetch('/api/exam-grades/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gradeIds: selectable, scheduledAt: scheduleDate.toISOString(), sendEmail })
            });
            const data = await res.json();
            if (data.success) {
                showNotification(`Scheduled ${data.scheduledCount} result(s) for ${formatDateTime(data.scheduledAt)}`, 'success');
                modal.remove();
                loadOnlineExamResults();
            } else {
                showNotification(data.message || 'Failed to schedule', 'error');
            }
        } catch (e) {
            console.error('Schedule error:', e);
            showNotification('Error scheduling publish', 'error');
        }
    });
}

function toggleAllResultCheckboxes() {
    const selectAll = document.getElementById('selectAllResults');
    const checkboxes = document.querySelectorAll('.result-checkbox:not(:disabled)');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateSelectedCount();
}

// ===== BATCH 1: Video Quiz & Resources Management =====
let currentQuizVideoId = null;
let currentQuizQuestions = [];

async function openQuizManager(videoId, videoTitle) {
    currentQuizVideoId = videoId;
    document.getElementById('quizVideoTitle').textContent = videoTitle;
    document.getElementById('quizPassingScore').value = 60;
    currentQuizQuestions = [];
    try {
        const res = await fetch('/api/videos/' + videoId + '/quiz');
        const data = await res.json();
        if (data.success && data.quiz) {
            currentQuizQuestions = data.quiz.questions || [];
            document.getElementById('quizPassingScore').value = data.quiz.passingScore || 60;
        }
    } catch (e) { console.error(e); }
    renderQuizQuestions();
    document.getElementById('quizManagerModal').classList.add('active');
}

function renderQuizQuestions() {
    const container = document.getElementById('quizQuestionsList');
    if (currentQuizQuestions.length === 0) {
        container.innerHTML = '<p style="color:#64748b;text-align:center;padding:20px;">No questions yet. Click "Add Question" below.</p>';
        return;
    }
    container.innerHTML = currentQuizQuestions.map((q, i) => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:15px;margin-bottom:10px;background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                <strong>Question ${i + 1}</strong>
                <button class="action-btn delete-btn" onclick="removeQuestion(${i})">Remove</button>
            </div>
            <input type="text" placeholder="Question text" value="${(q.question || '').replace(/"/g, '&quot;')}" onchange="currentQuizQuestions[${i}].question=this.value" style="width:100%;padding:8px;margin-bottom:8px;border:1px solid #cbd5e1;border-radius:4px;">
            ${[0,1,2,3].map(optIdx => `
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:5px;">
                    <input type="radio" name="correct_${i}" ${q.correctAnswer === optIdx ? 'checked' : ''} onchange="currentQuizQuestions[${i}].correctAnswer=${optIdx}">
                    <input type="text" placeholder="Option ${optIdx + 1}" value="${(q.options && q.options[optIdx] || '').replace(/"/g, '&quot;')}" onchange="if(!currentQuizQuestions[${i}].options)currentQuizQuestions[${i}].options=[];currentQuizQuestions[${i}].options[${optIdx}]=this.value" style="flex:1;padding:6px;border:1px solid #cbd5e1;border-radius:4px;">
                </div>
            `).join('')}
        </div>
    `).join('');
}

function addQuestion() {
    currentQuizQuestions.push({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
    renderQuizQuestions();
}

function removeQuestion(i) {
    currentQuizQuestions.splice(i, 1);
    renderQuizQuestions();
}

async function saveQuiz() {
    const passingScore = parseInt(document.getElementById('quizPassingScore').value) || 60;
    const validQuestions = currentQuizQuestions.filter(q => q.question && q.options && q.options.filter(o => o).length >= 2);
    if (validQuestions.length === 0) {
        showNotification('Add at least one valid question with 2+ options', 'error');
        return;
    }
    try {
        const res = await fetch('/api/videos/' + currentQuizVideoId + '/quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: validQuestions, passingScore })
        });
        const data = await res.json();
        if (data.success) {
            closeModal('quizManagerModal');
            showNotification('Quiz saved successfully!', 'success');
        }
    } catch (e) {
        showNotification('Error saving quiz', 'error');
    }
}

async function deleteQuiz() {
    if (!confirm('Delete this quiz?')) return;
    try {
        await fetch('/api/videos/' + currentQuizVideoId + '/quiz', { method: 'DELETE' });
        closeModal('quizManagerModal');
        showNotification('Quiz deleted', 'success');
    } catch (e) {
        showNotification('Error deleting quiz', 'error');
    }
}

// ===== Resources Manager =====
let currentResourceVideoId = null;

async function openResourcesManager(videoId, videoTitle) {
    currentResourceVideoId = videoId;
    document.getElementById('resourceVideoTitle').textContent = videoTitle;
    document.getElementById('resourceTitle').value = '';
    document.getElementById('resourceDescription').value = '';
    document.getElementById('resourceFile').value = '';
    await loadResourcesList();
    document.getElementById('resourcesManagerModal').classList.add('active');
}

async function loadResourcesList() {
    try {
        const res = await fetch('/api/videos/' + currentResourceVideoId + '/resources');
        const data = await res.json();
        const container = document.getElementById('resourcesList');
        if (!data.resources || data.resources.length === 0) {
            container.innerHTML = '<p style="color:#64748b;text-align:center;padding:20px;">No resources yet.</p>';
            return;
        }
        container.innerHTML = data.resources.map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px;background:#f8fafc;">
                <div>
                    <strong>${r.title}</strong>
                    <div style="font-size:12px;color:#64748b;">${(r.fileSize/1024).toFixed(1)} KB · ${r.fileName}</div>
                    ${r.description ? '<div style="font-size:12px;color:#475569;margin-top:4px;">' + r.description + '</div>' : ''}
                </div>
                <div style="display:flex;gap:6px;">
                    <a href="${r.fileUrl}" target="_blank" class="action-btn" style="background:#3b82f6;color:#fff;text-decoration:none;">View</a>
                    <button class="action-btn delete-btn" onclick="deleteResource(${r.id})">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
    }
}

async function uploadResource() {
    const title = document.getElementById('resourceTitle').value.trim();
    const description = document.getElementById('resourceDescription').value.trim();
    const file = document.getElementById('resourceFile').files[0];
    if (!file) { showNotification('Select a file', 'error'); return; }
    const formData = new FormData();
    formData.append('title', title || file.name);
    formData.append('description', description);
    formData.append('file', file);
    try {
        const res = await fetch('/api/videos/' + currentResourceVideoId + '/resources', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            document.getElementById('resourceTitle').value = '';
            document.getElementById('resourceDescription').value = '';
            document.getElementById('resourceFile').value = '';
            loadResourcesList();
            showNotification('Resource uploaded', 'success');
        }
    } catch (e) {
        showNotification('Upload failed', 'error');
    }
}

async function deleteResource(id) {
    if (!confirm('Delete this resource?')) return;
    try {
        await fetch('/api/videos/resources/' + id, { method: 'DELETE' });
        loadResourcesList();
        showNotification('Resource deleted', 'success');
    } catch (e) {
        showNotification('Error', 'error');
    }
}

// ===== BATCH 2: Admin Video Comments Management =====
async function loadAdminVideoComments() {
    const container = document.getElementById('adminVideoCommentsList');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;color:#64748b;padding:20px;">Loading...</p>';
    try {
        const res = await fetch('/api/admin/video-comments');
        const data = await res.json();
        if (!data.comments || data.comments.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#64748b;padding:30px;">No comments yet.</p>';
            return;
        }
        container.innerHTML = data.comments.map(c => `
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:15px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <div>
                        <strong style="color:#2563eb;">${c.studentName}</strong>
                        <span style="color:#94a3b8;font-size:12px;margin-left:8px;">on <em>${c.videoTitle}</em></span>
                    </div>
                    <span style="color:#64748b;font-size:12px;">${new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <div style="background:#f8fafc;padding:10px;border-radius:6px;margin-bottom:10px;">${c.text}</div>
                ${(c.replies || []).map(r => `
                    <div style="margin-left:20px;padding:8px;background:#ecfdf5;border-left:3px solid #10b981;border-radius:4px;margin-bottom:5px;">
                        <strong style="color:#059669;font-size:13px;">${r.authorName} (${r.authorType})</strong>
                        <span style="color:#64748b;font-size:11px;margin-left:8px;">${new Date(r.createdAt).toLocaleString()}</span>
                        <div style="margin-top:4px;">${r.text}</div>
                    </div>
                `).join('')}
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="btn btn-primary" style="padding:6px 14px;font-size:13px;" onclick="adminReplyToComment(${c.id})"><i class="fas fa-reply"></i> Reply</button>
                    <button class="btn btn-danger" style="padding:6px 14px;font-size:13px;" onclick="adminDeleteComment(${c.id})"><i class="fas fa-trash"></i> Delete</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<p style="text-align:center;color:#ef4444;padding:20px;">Failed to load comments.</p>';
    }
}

async function adminReplyToComment(commentId) {
    const text = prompt('Your reply:');
    if (!text || !text.trim()) return;
    const adminName = localStorage.getItem('adminName') || 'Teacher';
    try {
        const res = await fetch('/api/videos/comments/' + commentId + '/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authorName: adminName, authorType: 'teacher', text: text.trim() })
        });
        if ((await res.json()).success) {
            showNotification('Reply posted', 'success');
            loadAdminVideoComments();
        }
    } catch (e) {
        showNotification('Failed to reply', 'error');
    }
}

async function adminDeleteComment(id) {
    if (!confirm('Delete this comment and its replies?')) return;
    try {
        await fetch('/api/videos/comments/' + id, { method: 'DELETE' });
        showNotification('Comment deleted', 'success');
        loadAdminVideoComments();
    } catch (e) {
        showNotification('Failed', 'error');
    }
}

async function loadVideoAnalytics() {
    const tbody = document.getElementById('videoAnalyticsTable')?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;">Loading analytics...</td></tr>';
    try {
        const [analyticsRes, coursesRes] = await Promise.all([
            fetch('/api/admin/video-analytics').then(r => r.json()),
            fetch('/api/courses').then(r => r.json())
        ]);
        const list = analyticsRes.analytics || [];
        const courseMap = {};
        coursesRes.forEach(c => { courseMap[c.id] = c.name; });

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No videos available for analytics.</td></tr>';
            return;
        }

        tbody.innerHTML = list.map(v => `
            <tr>
                <td>
                    <strong>${v.title || '-'}</strong>
                    <div style="font-size:11px;color:#64748b;">${courseMap[v.courseId] || 'N/A'}</div>
                </td>
                <td>${v.views || 0}</td>
                <td>${v.uniqueViewers || 0}</td>
                <td>${v.completedCount || 0}</td>
                <td>${v.completionRate || 0}%</td>
                <td>${v.avgWatchMinutes || 0}</td>
                <td>${v.commentsCount || 0}</td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ef4444;">Failed to load analytics.</td></tr>';
    }
}

async function notifyVideoAvailability(videoId) {
    if (!confirm('Send email notification to eligible students for this video?')) return;
    try {
        const res = await fetch('/api/admin/videos/' + videoId + '/notify-availability', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            if ((data.failed || 0) > 0) {
                const failedSample = (data.failedEmails || []).slice(0, 3).join(', ');
                const failedMsg = 'Sent: ' + (data.sent || 0) + ', Failed: ' + (data.failed || 0);
                const detail = failedSample ? '\nFailed: ' + failedSample : '';
                showNotification(failedMsg + ' student(s)' + detail, 'error');
            } else {
                showNotification('Notification sent to ' + (data.sent || 0) + ' student(s)', 'success');
            }
            loadVideosTable();
        } else {
            showNotification(data.message || 'Failed to send notification', 'error');
        }
    } catch (e) {
        showNotification('Failed to send notification', 'error');
    }
}

let currentHotspotVideoId = null;
let currentHotspots = [];

async function openHotspotManager(videoId, videoTitle) {
    currentHotspotVideoId = videoId;
    document.getElementById('hotspotVideoTitle').textContent = videoTitle;
    currentHotspots = [];
    try {
        const res = await fetch('/api/videos/' + videoId + '/hotspots');
        const data = await res.json();
        if (data.success && Array.isArray(data.hotspots)) {
            currentHotspots = data.hotspots;
        }
    } catch (e) {
        currentHotspots = [];
    }
    renderHotspotRows();
    document.getElementById('hotspotManagerModal').classList.add('active');
}

function renderHotspotRows() {
    const container = document.getElementById('hotspotList');
    if (!container) return;
    if (!currentHotspots.length) {
        container.innerHTML = '<p style="color:#64748b;text-align:center;padding:20px;">No hotspots yet. Add one below.</p>';
        return;
    }
    container.innerHTML = currentHotspots.map((h, i) => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <strong>Hotspot ${i + 1}</strong>
                <button class="action-btn delete-btn" onclick="removeHotspotRow(${i})">Remove</button>
            </div>
            <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;">
                <input type="number" min="0" step="0.5" value="${h.timeSeconds || 0}" onchange="currentHotspots[${i}].timeSeconds=parseFloat(this.value)||0" placeholder="Second" style="padding:8px;border:1px solid #cbd5e1;border-radius:4px;">
                <input type="text" value="${(h.text || '').replace(/"/g, '&quot;')}" onchange="currentHotspots[${i}].text=this.value" placeholder="Message text" style="padding:8px;border:1px solid #cbd5e1;border-radius:4px;">
                <div></div>
                <input type="text" value="${(h.linkUrl || '').replace(/"/g, '&quot;')}" onchange="currentHotspots[${i}].linkUrl=this.value" placeholder="Optional link URL" style="padding:8px;border:1px solid #cbd5e1;border-radius:4px;">
            </div>
        </div>
    `).join('');
}

function addHotspotRow() {
    currentHotspots.push({ timeSeconds: 0, text: '', linkUrl: '' });
    renderHotspotRows();
}

function removeHotspotRow(index) {
    currentHotspots.splice(index, 1);
    renderHotspotRows();
}

async function saveHotspots() {
    if (!currentHotspotVideoId) return;
    const cleaned = currentHotspots.filter(h => h.text && h.text.trim());
    try {
        const res = await fetch('/api/videos/' + currentHotspotVideoId + '/hotspots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hotspots: cleaned })
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Hotspots saved', 'success');
            closeModal('hotspotManagerModal');
        } else {
            showNotification(data.message || 'Failed to save hotspots', 'error');
        }
    } catch (e) {
        showNotification('Failed to save hotspots', 'error');
    }
}
