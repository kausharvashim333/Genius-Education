let currentFaculty = null;
let currentOTP = null;

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

document.addEventListener('DOMContentLoaded', function() {
    // Load favicon from settings
    async function loadFavicon() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            if (settings.favicon) {
                // Remove existing favicon if any
                const existingFavicon = document.querySelector('link[rel="icon"]');
                if (existingFavicon) {
                    existingFavicon.remove();
                }
                // Add new favicon
                const link = document.createElement('link');
                link.rel = 'icon';
                link.type = 'image/x-icon';
                link.href = settings.favicon;
                document.head.appendChild(link);
            }
        } catch (err) {
            console.error('Failed to load favicon:', err);
        }
    }
    loadFavicon();

    // Apply login panel customization
    async function loadLoginPanelStyle() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            if (settings.loginPanels && settings.loginPanels.faculty) {
                const lp = settings.loginPanels.faculty;
                const brand = document.querySelector('#loginSection .split-brand');
                if (brand) {
                    if (lp.image) {
                        const opacity = lp.opacity != null ? lp.opacity / 100 : 0.3;
                        brand.style.background = 'linear-gradient(135deg, ' + lp.color1 + ' 0%, ' + lp.color2 + ' 100%)';
                        brand.style.backgroundImage = 'linear-gradient(135deg, ' + lp.color1 + ' 0%, ' + lp.color2 + ' 100%), url(' + lp.image + ')';
                        brand.style.backgroundSize = 'cover, cover';
                        brand.style.backgroundPosition = 'center, center';
                        brand.style.backgroundBlendMode = 'overlay';
                        let overlay = brand.querySelector('.lp-overlay');
                        if (!overlay) {
                            overlay = document.createElement('div');
                            overlay.className = 'lp-overlay';
                            overlay.style.cssText = 'position:absolute;inset:0;background:' + lp.color1 + ';opacity:' + opacity + ';z-index:0;pointer-events:none;';
                            brand.insertBefore(overlay, brand.firstChild);
                        } else {
                            overlay.style.background = lp.color1;
                            overlay.style.opacity = opacity;
                        }
                    } else {
                        brand.style.background = 'linear-gradient(135deg, ' + lp.color1 + ' 0%, ' + lp.color2 + ' 100%)';
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load login panel settings:', err);
        }
    }
    loadLoginPanelStyle();

    // Set current date
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        dateEl.textContent = formatDate(new Date());
    }

    const loginForm = document.getElementById('facultyLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('facultyEmail').value;
            const password = document.getElementById('facultyPassword').value;
            
            try {
                const res = await fetch('/api/faculty-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                
                if (data.success) {
                    currentFaculty = data.user;
                    localStorage.setItem('facultySession', JSON.stringify(currentFaculty));
                    showDashboard();
                } else {
                    alert('Invalid credentials!');
                }
            } catch (err) {
                console.error('Login error:', err);
                alert('Login failed!');
            }
        });
    }
    
    // Check if already logged in
    const savedSession = localStorage.getItem('facultySession');
    if (savedSession) {
        currentFaculty = JSON.parse(savedSession);
        showDashboard();
    }
    
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
        const facultyData = JSON.parse(decodeURIComponent(urlParams.get('data')));
        currentFaculty = facultyData;
        localStorage.setItem('facultySession', JSON.stringify(currentFaculty));
        window.history.replaceState({}, document.title, window.location.pathname);
        showDashboard();
    }
});

function showLoginMethod(method) {
    document.querySelectorAll('.login-method-btn').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-method="${method}"]`).classList.add('active');
    
    document.getElementById('facultyLoginForm').style.display = method === 'password' ? 'block' : 'none';
    document.getElementById('otpLoginForm').style.display = method === 'otp' ? 'block' : 'none';
}

async function sendOTP() {
    const email = document.getElementById('otpEmail').value;
    if (!email) {
        alert('Please enter your email');
        return;
    }
    
    try {
        const res = await fetch('/api/faculty/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        
        if (data.success) {
            currentOTP = data.otp;
            document.getElementById('otpInputGroup').style.display = 'block';
            document.getElementById('verifyOTPBtn').style.display = 'block';
            alert('OTP sent to your email');
        } else {
            alert(data.message || 'Error sending OTP');
        }
    } catch (e) {
        console.error('Error sending OTP:', e);
        alert('Error sending OTP');
    }
}

async function verifyOTP() {
    const email = document.getElementById('otpEmail').value;
    const otp = document.getElementById('otpCode').value;
    
    if (!email || !otp) {
        alert('Please enter email and OTP');
        return;
    }
    
    try {
        const res = await fetch('/api/faculty/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        
        if (data.success) {
            currentFaculty = data.user;
            localStorage.setItem('facultySession', JSON.stringify(currentFaculty));
            showDashboard();
        } else {
            alert('Invalid OTP');
        }
    } catch (e) {
        console.error('Error verifying OTP:', e);
        alert('Error verifying OTP');
    }
}

async function showDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    
    // Refresh faculty data from server to get latest permissions
    await refreshFacultyData();
    
    document.getElementById('facultyName').textContent = currentFaculty.name;
    document.getElementById('facultyRole').textContent = 'Role: ' + currentFaculty.role;
    
    // Check if password change is required
    if (!currentFaculty.passwordChanged) {
        showPasswordChangeModal();
    }
    
    loadFacultyMenu();
    loadFacultyStats();
}

async function refreshFacultyData() {
    if (!currentFaculty || !currentFaculty.id) return;
    try {
        const res = await fetch('/api/faculty/' + currentFaculty.id + '/me');
        const data = await res.json();
        if (data.success && data.user) {
            // Merge new data, preserve any client-only fields
            currentFaculty = { ...currentFaculty, ...data.user };
            localStorage.setItem('facultySession', JSON.stringify(currentFaculty));
        }
    } catch (err) {
        console.warn('Could not refresh faculty data:', err);
    }
}

function showPasswordChangeModal() {
    document.getElementById('passwordChangeModal').classList.add('active');
}

function closePasswordChangeModal() {
    document.getElementById('passwordChangeModal').classList.remove('active');
    document.getElementById('passwordChangeForm').reset();
    document.getElementById('passwordChangeError').style.display = 'none';
}

async function handlePasswordChange(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorEl = document.getElementById('passwordChangeError');
    
    if (newPassword !== confirmPassword) {
        errorEl.textContent = 'New passwords do not match';
        errorEl.style.display = 'block';
        return;
    }
    
    if (newPassword.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.style.display = 'block';
        return;
    }
    
    try {
        const res = await fetch('/api/faculty/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: currentFaculty.email, 
                currentPassword, 
                newPassword 
            })
        });
        const data = await res.json();
        
        if (data.success) {
            // Update current faculty object
            currentFaculty.passwordChanged = true;
            localStorage.setItem('facultySession', JSON.stringify(currentFaculty));
            closePasswordChangeModal();
            alert('Password changed successfully!');
        } else {
            errorEl.textContent = data.message || 'Failed to change password';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        console.error('Password change error:', err);
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('facultySession');
    currentFaculty = null;
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('facultyLoginForm').reset();
}

// ===== Forgot Password Functions =====
function showForgotPassword() {
    document.getElementById('forgotPasswordModal').classList.add('active');
    document.getElementById('forgotPasswordForm').style.display = 'block';
    document.getElementById('forgotPasswordOTPForm').style.display = 'none';
    document.getElementById('forgotPasswordError').style.display = 'none';
    document.getElementById('forgotPasswordSuccess').style.display = 'none';
    document.getElementById('passwordResetError').style.display = 'none';
    document.getElementById('forgotPasswordForm').reset();
    document.getElementById('forgotPasswordOTPForm').reset();
}

function closeForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').classList.remove('active');
    document.getElementById('forgotPasswordForm').reset();
    document.getElementById('forgotPasswordOTPForm').reset();
}

async function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('forgotPasswordEmail').value;
    const errorEl = document.getElementById('forgotPasswordError');
    const successEl = document.getElementById('forgotPasswordSuccess');
    
    errorEl.style.display = 'none';
    successEl.style.display = 'none';
    
    try {
        const res = await fetch('/api/faculty/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        
        if (data.success) {
            currentOTP = data.otp;
            successEl.textContent = 'OTP sent to your email. Please check your inbox.';
            successEl.style.display = 'block';
            
            // Show OTP form after 2 seconds
            setTimeout(() => {
                document.getElementById('forgotPasswordForm').style.display = 'none';
                document.getElementById('forgotPasswordOTPForm').style.display = 'block';
            }, 2000);
        } else {
            errorEl.textContent = data.message || 'Error sending OTP';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        console.error('Forgot password error:', err);
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.style.display = 'block';
    }
}

async function handlePasswordReset(event) {
    event.preventDefault();
    
    const otp = document.getElementById('forgotPasswordOTP').value;
    const newPassword = document.getElementById('resetNewPassword').value;
    const confirmPassword = document.getElementById('resetConfirmPassword').value;
    const email = document.getElementById('forgotPasswordEmail').value;
    const errorEl = document.getElementById('passwordResetError');
    
    if (newPassword !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.style.display = 'block';
        return;
    }
    
    if (newPassword.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.style.display = 'block';
        return;
    }
    
    try {
        const res = await fetch('/api/faculty/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, newPassword })
        });
        const data = await res.json();
        
        if (data.success) {
            alert('Password reset successfully! Please login with your new password.');
            closeForgotPasswordModal();
        } else {
            errorEl.textContent = data.message || 'Failed to reset password';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        console.error('Password reset error:', err);
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.style.display = 'block';
    }
}

function loadFacultyMenu() {
    const menu = document.getElementById('facultyMenu');
    let menuHTML = '';

    // Helper to check permission
    const hasPermission = (perm) => {
        const perms = currentFaculty.permissions || [];
        return perms.includes('all') || perms.includes(perm);
    };

    // Dashboard - always visible
    menuHTML += '<li><a href="#" onclick="showSection(\'dashboard\')"><i class="fas fa-home"></i> Dashboard</a></li>';

    // Permission-based menu items
    if (hasPermission('students')) {
        menuHTML += '<li><a href="#" onclick="showSection(\'students\')"><i class="fas fa-users"></i> My Students</a></li>';
    }

    if (hasPermission('assignments')) {
        menuHTML += '<li><a href="#" onclick="showSection(\'assignments\')"><i class="fas fa-tasks"></i> Assignments</a></li>';
    }

    if (hasPermission('attendance')) {
        menuHTML += '<li><a href="#" onclick="showSection(\'attendance\')"><i class="fas fa-calendar-check"></i> Attendance</a></li>';
    }

    if (hasPermission('study-materials') || hasPermission('materials')) {
        menuHTML += '<li><a href="#" onclick="showSection(\'materials\')"><i class="fas fa-folder"></i> Study Materials</a></li>';
    }

    if (hasPermission('results')) {
        menuHTML += '<li><a href="#" onclick="showSection(\'results\')"><i class="fas fa-chart-line"></i> Exam Results</a></li>';
    }

    if (hasPermission('enquiries')) {
        menuHTML += '<li><a href="#" onclick="showSection(\'enquiries\')"><i class="fas fa-envelope"></i> Enquiries</a></li>';
    }

    if (hasPermission('notices')) {
        menuHTML += '<li><a href="#" onclick="showSection(\'notices\')"><i class="fas fa-bullhorn"></i> Notices</a></li>';
    }

    // Blog Management dropdown - permission via role OR individual toggle
    if (currentFaculty.canWriteBlogs || hasPermission('blogs')) {
        menuHTML += `
            <li class="has-submenu">
                <a href="#" class="submenu-toggle" onclick="toggleSubmenu(event, this)">
                    <i class="fas fa-blog"></i> Blog Management
                    <i class="fas fa-chevron-down chevron"></i>
                </a>
                <ul class="submenu">
                    <li><a href="#" onclick="showSection('blogs'); return false;"><i class="fas fa-pen"></i> My Blogs</a></li>
                    <li><a href="#" onclick="showSection('allBlogs'); return false;"><i class="fas fa-list"></i> All Blogs</a></li>
                    <li><a href="#" onclick="showSection('pendingBlogs'); return false;"><i class="fas fa-clock"></i> Pending Blogs</a></li>
                    <li><a href="#" onclick="showSection('blogComments'); return false;"><i class="fas fa-comments"></i> Blog Comments</a></li>
                </ul>
            </li>`;
    }

    // Entrance Exam Management dropdown - faculty can access student registration
    if (currentFaculty.canManageEntranceExam || hasPermission('entrance-exam')) {
        menuHTML += `
            <li class="has-submenu">
                <a href="#" class="submenu-toggle" onclick="toggleSubmenu(event, this)">
                    <i class="fas fa-graduation-cap"></i> Entrance Exam
                    <i class="fas fa-chevron-down chevron"></i>
                </a>
                <ul class="submenu">
                    <li><a href="#" onclick="showSection('entranceStudentRegistration'); return false;"><i class="fas fa-user-plus"></i> Student Registration</a></li>
                </ul>
            </li>`;
    }

    menu.innerHTML = menuHTML;
}

// Toggle expand/collapse for sidebar submenus
function toggleSubmenu(event, anchorEl) {
    event.preventDefault();
    const parentLi = anchorEl.closest('li.has-submenu');
    if (!parentLi) return;
    parentLi.classList.toggle('open');
}

// Load an admin page inside the embedded iframe
function loadEmbed(page, title) {
    const frame = document.getElementById('embedFrame');
    if (!frame) return;
    frame.src = '/admin.html?mode=embed&page=' + encodeURIComponent(page);

    // Hide all sections, show embed
    document.querySelectorAll('.faculty-content-section').forEach(el => el.classList.remove('active'));
    const embedSection = document.getElementById('embedContent');
    if (embedSection) embedSection.classList.add('active');

    // Hide stats grid
    const facultyStats = document.getElementById('facultyStats');
    if (facultyStats) facultyStats.style.display = 'none';

    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle && title) pageTitle.textContent = title;
}

function showSection(section) {
    // Hide all content sections
    document.querySelectorAll('.faculty-content-section').forEach(el => el.classList.remove('active'));
    
    // Show selected section
    const sectionEl = document.getElementById(section + 'Content');
    if (sectionEl) {
        sectionEl.classList.add('active');
    }
    
    // Show/hide faculty stats based on section
    const facultyStats = document.getElementById('facultyStats');
    if (facultyStats) {
        facultyStats.style.display = section === 'dashboard' ? 'grid' : 'none';
    }
    
    // Update page title
    const titles = {
        'dashboard': 'Dashboard',
        'students': 'My Students',
        'assignments': 'Assignments',
        'attendance': 'Attendance',
        'materials': 'Study Materials',
        'results': 'Exam Results',
        'enquiries': 'Enquiries',
        'notices': 'Notices',
        'blogs': 'Blog Management',
        'allBlogs': 'All My Blogs',
        'pendingBlogs': 'Pending Approval Blogs',
        'blogComments': 'Blog Comments',
        'entranceStudentRegistration': 'Entrance Exam Student Registration'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';

    // Load section-specific data
    if (section === 'students') loadStudents();
    if (section === 'assignments') loadAssignments();
    if (section === 'attendance') {
        document.getElementById('attendanceDate').value = new Date().toISOString().split('T')[0];
        loadAttendance();
    }
    if (section === 'materials') loadMaterials();
    if (section === 'notices') loadNotices();
    if (section === 'blogs') loadBlogs();
    if (section === 'allBlogs') loadAllBlogs();
    if (section === 'pendingBlogs') loadPendingBlogs();
    if (section === 'blogComments') loadBlogComments();
    if (section === 'entranceStudentRegistration') loadEntranceStudentRegistration();
}

async function loadFacultyStats() {
    try {
        const students = await fetch('/api/students').then(r => r.json());
        const courses = await fetch('/api/courses').then(r => r.json());
        const assignments = await fetch('/api/assignments').then(r => r.json());
        
        document.getElementById('myStudentsCount').textContent = students.length;
        document.getElementById('myCoursesCount').textContent = courses.length;
        document.getElementById('assignmentsCount').textContent = assignments.length;
    } catch (e) {
        console.error('Error loading stats:', e);
    }
}

let allFacultyStudents = [];
let facultyStudentsCurrentPage = 1;
const facultyStudentsPerPage = 25;
let facultyStudentsFiltered = [];

async function loadStudents() {
    try {
        allFacultyStudents = await fetch('/api/students').then(r => r.json());
        
        // Populate course filter
        const courseFilter = document.getElementById('facultyStudentCourseFilter');
        const courses = [...new Set(allFacultyStudents.map(s => s.course).filter(Boolean))].sort();
        courseFilter.innerHTML = '<option value="">All Courses</option>' + courses.map(c => '<option value="' + c + '">' + c + '</option>').join('');
        
        // Populate batch filter
        const batchFilter = document.getElementById('facultyStudentBatchFilter');
        const batches = [...new Set(allFacultyStudents.map(s => s.batch).filter(Boolean))].sort();
        batchFilter.innerHTML = '<option value="">All Batches</option>' + batches.map(b => '<option value="' + b + '">' + b + '</option>').join('');
        
        renderFacultyStudents(allFacultyStudents);
    } catch (e) {
        console.error('Error loading students:', e);
    }
}

function renderFacultyStudents(students) {
    facultyStudentsFiltered = students;
    const tbody = document.getElementById('studentsTable').querySelector('tbody');
    const paginationEl = document.getElementById('facultyStudentsPagination');
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No students found</td></tr>';
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }
    const totalPages = Math.ceil(students.length / facultyStudentsPerPage);
    if (facultyStudentsCurrentPage > totalPages) facultyStudentsCurrentPage = 1;
    const startIdx = (facultyStudentsCurrentPage - 1) * facultyStudentsPerPage;
    const pageStudents = students.slice(startIdx, startIdx + facultyStudentsPerPage);
    tbody.innerHTML = pageStudents.map(student => `
        <tr>
            <td>${student.rollNo || 'N/A'}</td>
            <td>${student.name}</td>
            <td>${student.course || 'N/A'}</td>
            <td>${student.batch || 'N/A'}</td>
            <td>${student.phone || 'N/A'}</td>
            <td><button class="btn btn-primary" style="padding:4px 8px;font-size:12px;" onclick="showStudentQR(${student.id})"><i class="fas fa-qrcode"></i></button></td>
        </tr>
    `).join('');
    renderFacultyStudentsPagination(totalPages);
}

function renderFacultyStudentsPagination(totalPages) {
    const container = document.getElementById('facultyStudentsPagination');
    if (!container || totalPages <= 1) { if (container) container.innerHTML = ''; return; }
    let html = '';
    html += '<button class="pagination-btn" onclick="goToFacultyStudentPage(' + (facultyStudentsCurrentPage - 1) + ')" ' + (facultyStudentsCurrentPage === 1 ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
    const maxVisible = 7;
    let startPage = Math.max(1, facultyStudentsCurrentPage - 3);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
    if (startPage > 1) {
        html += '<button class="pagination-btn" onclick="goToFacultyStudentPage(1)">1</button>';
        if (startPage > 2) html += '<span class="pagination-ellipsis">...</span>';
    }
    for (let i = startPage; i <= endPage; i++) {
        html += '<button class="pagination-btn' + (i === facultyStudentsCurrentPage ? ' active"' : '"') + ' onclick="goToFacultyStudentPage(' + i + ')">' + i + '</button>';
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="pagination-ellipsis">...</span>';
        html += '<button class="pagination-btn" onclick="goToFacultyStudentPage(' + totalPages + ')">' + totalPages + '</button>';
    }
    html += '<button class="pagination-btn" onclick="goToFacultyStudentPage(' + (facultyStudentsCurrentPage + 1) + ')" ' + (facultyStudentsCurrentPage === totalPages ? 'disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
    html += '<span class="pagination-info">Page ' + facultyStudentsCurrentPage + ' of ' + totalPages + '</span>';
    container.innerHTML = html;
}

function goToFacultyStudentPage(page) {
    const totalPages = Math.ceil(facultyStudentsFiltered.length / facultyStudentsPerPage);
    if (page < 1 || page > totalPages) return;
    facultyStudentsCurrentPage = page;
    renderFacultyStudents(facultyStudentsFiltered);
}

function filterFacultyStudents() {
    facultyStudentsCurrentPage = 1;
    const search = (document.getElementById('facultyStudentSearch').value || '').toLowerCase();
    const course = document.getElementById('facultyStudentCourseFilter').value;
    const batch = document.getElementById('facultyStudentBatchFilter').value;
    
    let filtered = allFacultyStudents;
    if (course) filtered = filtered.filter(s => s.course === course);
    if (batch) filtered = filtered.filter(s => s.batch === batch);
    if (search) {
        filtered = filtered.filter(s =>
            (s.name && s.name.toLowerCase().includes(search)) ||
            (s.rollNo && s.rollNo.toLowerCase().includes(search)) ||
            (s.phone && s.phone.includes(search))
        );
    }
    renderFacultyStudents(filtered);
}

async function showStudentQR(id) {
    try {
        const s = await fetch('/api/students/' + id).then(r => r.json());
        document.getElementById('studentQRName').textContent = s.name;
        document.getElementById('studentQRId').textContent = 'ID: ' + s.rollNo;
        document.getElementById('studentQRCourse').textContent = s.course || '';
        const baseUrl = window.location.origin;
        const qrText = baseUrl + '/verify-student?rollNo=' + encodeURIComponent(s.rollNo);
        const qrRes = await fetch('/api/qr?text=' + encodeURIComponent(qrText) + '&size=200');
        const qrData = await qrRes.json();
        if (qrData.success) {
            document.getElementById('studentQRImage').src = qrData.dataUrl;
        } else {
            alert('Error generating QR code!');
            return;
        }
        document.getElementById('studentQRModal').classList.add('active');
    } catch (err) {
        console.error('Error loading student QR:', err);
        alert('Error loading student QR!');
    }
}

function closeStudentQRModal() {
    document.getElementById('studentQRModal').classList.remove('active');
}

function downloadStudentQR() {
    const img = document.getElementById('studentQRImage');
    if (!img.src) return;
    const name = document.getElementById('studentQRName').textContent || 'student';
    const id = document.getElementById('studentQRId').textContent.replace('ID: ', '') || '';
    const link = document.createElement('a');
    link.href = img.src;
    link.download = 'QR_' + name.replace(/\s+/g, '_') + '_' + id + '.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function loadAssignments() {
    try {
        const response = await fetch('/api/assignments');
        const assignments = await response.json();
        
        const materialsResponse = await fetch('/api/study-materials');
        const materialsData = await materialsResponse.json();
        const materials = materialsData.materials || [];
        
        // Filter study materials with type "assignment"
        const assignmentMaterials = materials.filter(m => m.type && m.type.toLowerCase() === 'assignment');
        
        // Combine both assignments
        const allAssignments = [...assignments, ...assignmentMaterials];
        
        const assignmentsList = document.getElementById('assignmentsList');
        
        console.log('All assignments loaded:', allAssignments);
        
        if (!allAssignments || allAssignments.length === 0) {
            assignmentsList.innerHTML = '<p>No assignments found.</p>';
            return;
        }
        
        // Fetch courses to resolve course names
        const coursesResponse = await fetch('/api/courses');
        const courses = await coursesResponse.json();
        
        assignmentsList.innerHTML = allAssignments.map(assignment => {
            const fileUrl = assignment.fileUrl || assignment.url;
            const courseId = assignment.courseId || assignment.course;
            const dueDate = assignment.dueDate || 'N/A';
            
            // Resolve course name
            let courseName = courseId || 'N/A';
            if (courseId && courses.length > 0) {
                const course = courses.find(c => c.id == courseId || c.id == parseInt(courseId));
                if (course) courseName = course.name;
            }
            
            return `
            <div style="padding:15px;background:#f8fafc;border-radius:8px;margin-bottom:10px;">
                <h4 style="margin:0 0 5px 0;">${assignment.title}</h4>
                <p style="margin:0;color:#64748b;font-size:14px;">Course: ${courseName}</p>
                <p style="margin:0;color:#64748b;font-size:14px;">Due: ${dueDate}</p>
                ${fileUrl ? `<a href="${fileUrl}" target="_blank" class="btn btn-primary" style="padding:6px 12px;font-size:12px;margin-top:5px;display:inline-block;">Download File</a>` : ''}
            </div>
        `;
        }).join('');
    } catch (e) {
        console.error('Error loading assignments:', e);
        assignmentsList.innerHTML = '<p style="color:red;">Error loading assignments: ' + e.message + '</p>';
    }
}

async function loadNotices() {
    try {
        const notices = await fetch('/api/notices').then(r => r.json());
        const noticesList = document.getElementById('noticesList');
        
        if (notices.length === 0) {
            noticesList.innerHTML = '<p>No notices found.</p>';
            return;
        }
        
        noticesList.innerHTML = notices.map(notice => `
            <div style="padding:15px;background:#f8fafc;border-radius:8px;margin-bottom:10px;">
                <h4 style="margin:0 0 5px 0;">${notice.title}</h4>
                <p style="margin:0;color:#64748b;font-size:14px;">${notice.content || 'No content'}</p>
                <small style="color:#94a3b8;">${notice.date || 'N/A'}</small>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error loading notices:', e);
    }
}

async function loadMaterials() {
    try {
        const response = await fetch('/api/study-materials').then(r => r.json());
        const materials = response.materials || [];
        const materialsTable = document.getElementById('materialsTable');
        
        if (materials.length === 0) {
            materialsTable.querySelector('tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">No study materials found.</td></tr>';
            return;
        }
        
        materialsTable.querySelector('tbody').innerHTML = materials.map(material => {
            const status = material.status || 'approved';
            const statusBadge = status === 'pending' 
                ? '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">Pending</span>'
                : status === 'rejected'
                ? '<span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">Rejected</span>'
                : '<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">Approved</span>';
            return `
            <tr>
                <td>${material.title}</td>
                <td>${material.course || 'N/A'}</td>
                <td>${material.type || 'N/A'}</td>
                <td>${material.author || 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>
                    <a href="${material.url}" target="_blank" class="btn btn-primary" style="padding:6px 12px;font-size:12px;">View</a>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('Error loading materials:', e);
    }
}

async function openFacultyMaterialModal() {
    document.getElementById('facultyMaterialTitle').value = '';
    document.getElementById('facultyMaterialFile').value = '';
    document.getElementById('facultyMaterialDescription').value = '';
    document.getElementById('facultyMaterialAuthor').value = currentFaculty ? currentFaculty.name : '';
    document.getElementById('facultyMaterialCategory').value = 'General';
    document.getElementById('facultyMaterialDifficulty').value = 'Beginner';
    document.getElementById('facultyMaterialTags').value = '';
    document.getElementById('facultyMaterialBatch').value = '';
    document.getElementById('facultyMaterialType').value = '';
    await loadCoursesForFacultyMaterial();
    await loadBatchesForFacultyMaterial();
    document.getElementById('facultyMaterialModal').classList.add('active');
}

function closeFacultyMaterialModal() {
    document.getElementById('facultyMaterialModal').classList.remove('active');
}

async function loadCoursesForFacultyMaterial() {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    const select = document.getElementById('facultyMaterialCourse');
    select.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
}

async function loadBatchesForFacultyMaterial() {
    const res = await fetch('/api/batches');
    const batches = await res.json();
    const select = document.getElementById('facultyMaterialBatch');
    select.innerHTML = '<option value="">All Batches</option>' + batches.map(b => '<option>' + b.name + '</option>').join('');
}

function updateFacultyMaterialFileInput() {
    const type = document.getElementById('facultyMaterialType').value;
    const fileInput = document.getElementById('facultyMaterialFile');
    const acceptTypes = {
        'pdf': '.pdf',
        'video': '.mp4,.avi,.mov,.mkv',
        'doc': '.doc,.docx,.ppt,.pptx,.txt',
        'image': '.jpg,.jpeg,.png,.gif,.bmp'
    };
    fileInput.accept = acceptTypes[type] || '*';
}

async function saveFacultyMaterial(event) {
    event.preventDefault();
    try {
        const fileInput = document.getElementById('facultyMaterialFile');
        const file = fileInput.files[0];
        if (!file) { alert('Please select a file'); return; }
        
        const title = document.getElementById('facultyMaterialTitle').value;
        const course = document.getElementById('facultyMaterialCourse').value;
        const type = document.getElementById('facultyMaterialType').value;
        if (!title || !course || !type) { alert('Please fill in all required fields'); return; }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('course', course);
        formData.append('type', type);
        formData.append('description', document.getElementById('facultyMaterialDescription').value);
        formData.append('author', document.getElementById('facultyMaterialAuthor').value);
        formData.append('category', document.getElementById('facultyMaterialCategory').value);
        formData.append('difficulty', document.getElementById('facultyMaterialDifficulty').value);
        formData.append('tags', document.getElementById('facultyMaterialTags').value);
        formData.append('batch', document.getElementById('facultyMaterialBatch').value);
        formData.append('status', 'pending');
        formData.append('submittedBy', currentFaculty ? currentFaculty.name : 'Faculty');
        formData.append('submittedById', currentFaculty ? currentFaculty.id : '');
        
        const res = await fetch('/api/study-materials', { method: 'POST', body: formData });
        const result = await res.json();
        
        if (result.success) {
            closeFacultyMaterialModal();
            loadMaterials();
            alert('Study material submitted for approval!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
    } catch (e) {
        console.error('Error:', e);
        alert('Error: ' + e.message);
    }
}

async function loadAttendance() {
    const date = document.getElementById('attendanceDate').value;
    if (!date) return alert('Please select a date');
    
    try {
        const students = await fetch('/api/students').then(r => r.json());
        const attendance = await fetch('/api/attendance').then(r => r.json());
        const tbody = document.getElementById('attendanceTable').querySelector('tbody');
        
        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No students found</td></tr>';
            return;
        }
        
        tbody.innerHTML = students.map(student => {
            const attendanceRecord = attendance.attendance.find(a => a.studentId === student.id && a.date === date);
            const status = attendanceRecord ? attendanceRecord.status : '';
            
            return `
                <tr>
                    <td>${student.name}</td>
                    <td>${student.course || 'N/A'}</td>
                    <td>
                        <select id="status-${student.id}" style="padding:5px;border:1px solid #e2e8f0;border-radius:4px;">
                            <option value="">Not Marked</option>
                            <option value="present" ${status === 'present' ? 'selected' : ''}>Present</option>
                            <option value="absent" ${status === 'absent' ? 'selected' : ''}>Absent</option>
                            <option value="late" ${status === 'late' ? 'selected' : ''}>Late</option>
                        </select>
                    </td>
                    <td>
                        <button onclick="saveAttendance(${student.id})" class="btn btn-primary" style="padding:5px 10px;font-size:12px;">Save</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Error loading attendance:', e);
    }
}

async function saveAttendance(studentId) {
    const date = document.getElementById('attendanceDate').value;
    const status = document.getElementById(`status-${studentId}`).value;
    
    if (!status) return alert('Please select attendance status');
    
    try {
        const students = await fetch('/api/students').then(r => r.json());
        const student = students.find(s => s.id === studentId);
        
        const data = {
            studentId: studentId,
            date: date,
            status: status,
            course: student ? student.course : '',
            batch: student ? student.batch : ''
        };
        
        const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (result.success) {
            alert('Attendance saved successfully!');
        } else {
            alert('Error saving attendance');
        }
    } catch (e) {
        console.error('Error saving attendance:', e);
        alert('Error saving attendance');
    }
}

// ===== Blog Management Functions =====
async function loadBlogs() {
    try {
        const res = await fetch(`/api/blogs?all=1&authorId=${currentFaculty.id}`);
        const data = await res.json();
        const blogs = data.blogs || [];

        const tbody = document.getElementById('blogsTable').querySelector('tbody');

        if (blogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No blogs found. Create your first blog!</td></tr>';
            return;
        }

        tbody.innerHTML = blogs.map(blog => {
            const statusColors = {
                'draft': '#64748b',
                'pending': '#f59e0b',
                'published': '#16a34a',
                'rejected': '#ef4444'
            };
            const statusColor = statusColors[blog.status] || '#64748b';

            return `
                <tr>
                    <td>${blog.title}</td>
                    <td><span style="color:${statusColor};font-weight:600;">${blog.status}</span></td>
                    <td>${blog.category || 'N/A'}</td>
                    <td>${formatDate(blog.createdAt)}</td>
                    <td>
                        <button onclick="editBlog(${blog.id})" class="btn btn-primary" style="padding:5px 10px;font-size:12px;margin-right:5px;"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteBlog(${blog.id})" class="btn btn-danger" style="padding:5px 10px;font-size:12px;"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Error loading blogs:', e);
    }
}

async function loadAllBlogs() {
    try {
        const res = await fetch(`/api/blogs?all=1&authorId=${currentFaculty.id}`);
        const data = await res.json();
        const blogs = data.blogs || [];

        const tbody = document.getElementById('allBlogsTable').querySelector('tbody');

        if (blogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No blogs found. Create your first blog!</td></tr>';
            return;
        }

        tbody.innerHTML = blogs.map(blog => {
            const statusColors = {
                'draft': '#64748b',
                'pending': '#f59e0b',
                'published': '#16a34a',
                'rejected': '#ef4444'
            };
            const statusColor = statusColors[blog.status] || '#64748b';

            return `
                <tr>
                    <td>${blog.title}</td>
                    <td><span style="color:${statusColor};font-weight:600;">${blog.status}</span></td>
                    <td>${blog.category || 'N/A'}</td>
                    <td>${formatDate(blog.createdAt)}</td>
                    <td>
                        <button onclick="editBlog(${blog.id})" class="btn btn-primary" style="padding:5px 10px;font-size:12px;margin-right:5px;"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteBlog(${blog.id})" class="btn btn-danger" style="padding:5px 10px;font-size:12px;"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Error loading all blogs:', e);
    }
}

async function loadPendingBlogs() {
    try {
        const res = await fetch(`/api/blogs?all=1&authorId=${currentFaculty.id}`);
        const data = await res.json();
        const blogs = data.blogs || [];

        // Filter only pending blogs
        const pendingBlogs = blogs.filter(blog => blog.status === 'pending');

        const tbody = document.getElementById('pendingBlogsTable').querySelector('tbody');

        if (pendingBlogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No pending blogs. Your submitted blogs will appear here.</td></tr>';
            return;
        }

        tbody.innerHTML = pendingBlogs.map(blog => {
            return `
                <tr>
                    <td>${blog.title}</td>
                    <td>${blog.category || 'N/A'}</td>
                    <td>${formatDate(blog.createdAt)}</td>
                    <td>
                        <button onclick="editBlog(${blog.id})" class="btn btn-primary" style="padding:5px 10px;font-size:12px;margin-right:5px;"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteBlog(${blog.id})" class="btn btn-danger" style="padding:5px 10px;font-size:12px;"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Error loading pending blogs:', e);
    }
}

async function loadBlogComments() {
    try {
        // First get faculty's blog IDs
        const blogsRes = await fetch(`/api/blogs?all=1&authorId=${currentFaculty.id}`);
        const blogsData = await blogsRes.json();
        const facultyBlogIds = (blogsData.blogs || []).map(b => b.id);

        if (facultyBlogIds.length === 0) {
            document.getElementById('blogCommentsList').innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">No blogs found. Create blogs first to see comments.</p>';
            return;
        }

        // Get all comments
        const commentsRes = await fetch('/api/admin/comments?status=all');
        const commentsData = await commentsRes.json();
        const allComments = commentsData.comments || [];

        // Filter comments to only those on faculty's blogs
        const facultyComments = allComments.filter(c => facultyBlogIds.includes(c.blogId));

        if (facultyComments.length === 0) {
            document.getElementById('blogCommentsList').innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">No comments on your blogs yet.</p>';
            return;
        }

        // Render comments
        document.getElementById('blogCommentsList').innerHTML = facultyComments.map(comment => {
            const statusColor = comment.approved ? '#16a34a' : '#f59e0b';
            const statusText = comment.approved ? 'Approved' : 'Pending';
            return `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:15px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                        <div>
                            <strong style="color:#1e293b;">${comment.name || 'Anonymous'}</strong>
                            <span style="color:#64748b;font-size:12px;margin-left:10px;">${comment.email || ''}</span>
                        </div>
                        <span style="color:${statusColor};font-size:12px;font-weight:600;background:${comment.approved ? '#dcfce7' : '#fef3c7'};padding:2px 8px;border-radius:4px;">${statusText}</span>
                    </div>
                    <p style="color:#334155;margin:0 0 8px 0;">${comment.content}</p>
                    <div style="font-size:12px;color:#94a3b8;">
                        <span>On: ${comment.blogTitle || 'Unknown Blog'}</span>
                        <span style="margin-left:15px;">${formatDate(comment.createdAt)}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Error loading blog comments:', e);
        document.getElementById('blogCommentsList').innerHTML = '<p style="color:red;">Error loading comments.</p>';
    }
}

// ===== Entrance Exam Student Registration Functions =====
let entranceExamsCache = [];

async function loadEntranceStudentRegistration() {
    try {
        const [exams, regs] = await Promise.all([
            fetch('/api/entrance-exams').then(r => r.json()),
            fetch('/api/entrance-registrations').then(r => r.json())
        ]);

        entranceExamsCache = exams || [];
        const shiftMap = {};
        (exams || []).forEach(e => {
            (e.shifts || []).forEach(s => shiftMap[s.id] = s.name);
        });

        const tbody = document.querySelector('#entranceStudentRegistrationTable tbody');

        if (!regs || regs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:rgba(255,255,255,0.7);padding:20px;">No entrance exam registrations found</td></tr>';
            return;
        }

        tbody.innerHTML = regs.map(r => {
            const statusBadge = r.suspended
                ? '<span style="color:#ef4444;font-weight:600;">Suspended</span>'
                : '<span style="color:#16a34a;font-weight:600;">' + (r.status || '') + '</span>';
            return `
                <tr${r.suspended ? ' style="background:rgba(239,68,68,0.15);"' : ''}>
                    <td>${r.registrationNo || ''}</td>
                    <td>${r.studentName || ''}</td>
                    <td>${r.phone || ''}</td>
                    <td>${r.course || '-'}</td>
                    <td>${shiftMap[r.shiftId] || '<span style="color:#fbbf24;">Not Assigned</span>'}</td>
                    <td><code>${r.loginPassword || ''}</code></td>
                    <td>${statusBadge}</td>
                    <td>
                        <button onclick="editEntranceRegistration(${JSON.stringify(r).replace(/"/g, '&quot;')})" class="glass-btn" style="padding:5px 10px;font-size:12px;margin-right:5px;"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteEntranceRegistration(${r.id})" class="glass-btn" style="padding:5px 10px;font-size:12px;background:linear-gradient(135deg, rgba(239,68,68,0.8), rgba(220,38,38,0.8));"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Error loading entrance student registrations:', e);
        document.querySelector('#entranceStudentRegistrationTable tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:#ef4444;">Error loading registrations</td></tr>';
    }
}

function openEntranceRegistrationModal() {
    document.getElementById('entRegId').value = '';
    ['entRegIdNo', 'entRegName', 'entRegFather', 'entRegPhone', 'entRegQualification', 'entRegCourse'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Populate exam dropdown
    const sel = document.getElementById('entRegExamSel');
    sel.innerHTML = '<option value="">Select Exam</option>' + entranceExamsCache.map(e => '<option value="' + e.id + '">' + e.name + '</option>').join('');
    document.getElementById('entRegShiftSel').innerHTML = '<option value="">Select Shift</option>';

    document.getElementById('entranceRegModal').classList.add('active');
}

function closeEntranceRegistrationModal() {
    document.getElementById('entranceRegModal').classList.remove('active');
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
        shiftSel.innerHTML = '<option value="">Select Shift</option>' + exam.shifts.map(s => '<option value="' + s.id + '">' + s.name + '</option>').join('');
        shiftSel.value = reg.shiftId || '';
    }

    document.getElementById('entranceRegModal').classList.add('active');
}

function loadShiftsForRegistration() {
    const examId = document.getElementById('entRegExamSel').value;
    const shiftSel = document.getElementById('entRegShiftSel');
    shiftSel.innerHTML = '<option value="">Select Shift</option>';

    if (!examId) return;

    const exam = entranceExamsCache.find(e => e.id == examId);
    if (exam && exam.shifts) {
        shiftSel.innerHTML += exam.shifts.map(s => '<option value="' + s.id + '">' + s.name + '</option>').join('');
    }
}

function autoFillCourse() {
    const qual = document.getElementById('entRegQualification').value;
    const courseMap = {
        '10th': 'DCA',
        '12th': 'ADCA',
        'Graduate': 'PGDCA',
        'Post Graduate': 'MCA'
    };
    if (courseMap[qual]) {
        document.getElementById('entRegCourse').value = courseMap[qual];
    }
}

async function saveEntranceRegistration() {
    const id = document.getElementById('entRegId').value;
    const registrationNo = document.getElementById('entRegIdNo').value;
    const examId = document.getElementById('entRegExamSel').value;
    const shiftId = document.getElementById('entRegShiftSel').value;
    const studentName = document.getElementById('entRegName').value;
    const fatherName = document.getElementById('entRegFather').value;
    const gender = document.getElementById('entRegGender').value;
    const phone = document.getElementById('entRegPhone').value;
    const qualification = document.getElementById('entRegQualification').value;
    const course = document.getElementById('entRegCourse').value;

    if (!registrationNo || !examId || !studentName || !phone) {
        alert('Please fill all required fields');
        return;
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? '/api/entrance-registrations/' + id : '/api/entrance-registrations';

        const data = {
            registrationNo,
            examId: parseInt(examId),
            shiftId: shiftId ? parseInt(shiftId) : null,
            studentName,
            fatherName,
            gender,
            phone,
            qualification,
            course
        };

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (result.success) {
            alert(id ? 'Registration updated!' : 'Student registered! Login credentials generated.');
            closeEntranceRegistrationModal();
            loadEntranceStudentRegistration();
        } else {
            alert(result.message || 'Error saving registration!');
        }
    } catch (e) {
        console.error('Error saving entrance registration:', e);
        alert('Error saving registration!');
    }
}

async function deleteEntranceRegistration(id) {
    if (!confirm('Are you sure you want to delete this registration?')) return;

    try {
        const res = await fetch('/api/entrance-registrations/' + id, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            alert('Registration deleted!');
            loadEntranceStudentRegistration();
        } else {
            alert('Error deleting registration!');
        }
    } catch (e) {
        console.error('Error deleting entrance registration:', e);
        alert('Error deleting registration!');
    }
}

// ===== Quill-based blog editor (matches admin panel) =====
let _blogQuill = null;
let _imgPopover = null;
let _activeImg = null;

function initBlogQuill() {
    if (_blogQuill || typeof Quill === 'undefined') return;

    // Custom Image blot to preserve width + alignment classes
    const BaseImage = Quill.import('formats/image');
    const IMG_ATTRS = ['alt', 'src', 'width', 'class'];
    class BlogImage extends BaseImage {
        static formats(domNode) {
            const fmt = {};
            IMG_ATTRS.forEach(attr => { if (domNode.hasAttribute(attr)) fmt[attr] = domNode.getAttribute(attr); });
            return fmt;
        }
        format(name, value) {
            if (IMG_ATTRS.includes(name)) {
                if (value) this.domNode.setAttribute(name, value); else this.domNode.removeAttribute(name);
            } else { super.format(name, value); }
        }
    }
    BlogImage.blotName = 'image';
    BlogImage.tagName = 'IMG';
    Quill.register(BlogImage, true);

    _blogQuill = new Quill('#blogEditor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: '#blogEditorToolbar',
                handlers: { image: blogQuillImageHandler }
            }
        },
        placeholder: 'Write your blog content here... Use the image button in the toolbar to insert images anywhere. Click any inserted image to resize, align, or add a caption.'
    });

    setupBlogImageEditing();
}

function setupBlogImageEditing() {
    const editor = _blogQuill.root;
    editor.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault(); e.stopPropagation();
            showImagePopover(e.target);
        }
    });
    document.addEventListener('mousedown', (e) => {
        if (!_imgPopover) return;
        if (_imgPopover.contains(e.target)) return;
        if (e.target.tagName === 'IMG' && editor.contains(e.target)) return;
        hideImagePopover();
    });
    window.addEventListener('scroll', () => { if (_activeImg) positionImagePopover(_activeImg); }, true);
}

function showImagePopover(img) {
    hideImagePopover();
    _activeImg = img;
    img.classList.add('blog-img-selected');
    const popover = document.createElement('div');
    popover.className = 'blog-img-popover';
    const currentSize = img.getAttribute('width') || '100%';
    const currentAlign = (img.className.match(/img-align-(left|center|right)/) || [])[1] || 'center';
    popover.innerHTML = `
        <div class="bip-row">
            <span class="bip-label"><i class="fas fa-expand-arrows-alt"></i> Size</span>
            <div class="bip-btns">
                <button data-size="25%" class="${currentSize==='25%'?'active':''}">S</button>
                <button data-size="50%" class="${currentSize==='50%'?'active':''}">M</button>
                <button data-size="75%" class="${currentSize==='75%'?'active':''}">L</button>
                <button data-size="100%" class="${currentSize==='100%'?'active':''}">Full</button>
            </div>
        </div>
        <div class="bip-row">
            <span class="bip-label"><i class="fas fa-align-justify"></i> Align</span>
            <div class="bip-btns">
                <button data-align="left" class="${currentAlign==='left'?'active':''}"><i class="fas fa-align-left"></i></button>
                <button data-align="center" class="${currentAlign==='center'?'active':''}"><i class="fas fa-align-center"></i></button>
                <button data-align="right" class="${currentAlign==='right'?'active':''}"><i class="fas fa-align-right"></i></button>
            </div>
        </div>
        <div class="bip-row">
            <span class="bip-label"><i class="fas fa-comment-dots"></i> Caption</span>
            <input type="text" class="bip-caption" placeholder="Add caption (optional)" maxlength="200">
        </div>
        <div class="bip-row bip-delete-row">
            <button class="bip-delete"><i class="fas fa-trash"></i> Delete Image</button>
        </div>`;
    document.body.appendChild(popover);
    _imgPopover = popover;
    positionImagePopover(img);
    const captionEl = findBlogCaptionFor(img);
    if (captionEl) popover.querySelector('.bip-caption').value = captionEl.textContent;
    popover.querySelectorAll('button[data-size]').forEach(btn => {
        btn.onclick = () => { setBlogImageSize(img, btn.dataset.size); refreshBlogPopover(popover, 'size', btn.dataset.size); };
    });
    popover.querySelectorAll('button[data-align]').forEach(btn => {
        btn.onclick = () => { setBlogImageAlign(img, btn.dataset.align); refreshBlogPopover(popover, 'align', btn.dataset.align); };
    });
    popover.querySelector('.bip-caption').oninput = (e) => setBlogImageCaption(img, e.target.value);
    popover.querySelector('.bip-delete').onclick = () => { deleteBlogImage(img); hideImagePopover(); };
}

function refreshBlogPopover(popover, type, val) {
    popover.querySelectorAll(`button[data-${type}]`).forEach(b => b.classList.toggle('active', b.dataset[type] === val));
}

function positionImagePopover(img) {
    if (!_imgPopover) return;
    const rect = img.getBoundingClientRect();
    const popH = _imgPopover.offsetHeight || 200;
    let top = rect.bottom + 8;
    if (top + popH > window.innerHeight - 10) top = Math.max(10, rect.top - popH - 8);
    let left = rect.left;
    const popW = _imgPopover.offsetWidth || 280;
    if (left + popW > window.innerWidth - 10) left = window.innerWidth - popW - 10;
    _imgPopover.style.position = 'fixed';
    _imgPopover.style.top = top + 'px';
    _imgPopover.style.left = Math.max(10, left) + 'px';
    _imgPopover.style.zIndex = '100001';
}

function hideImagePopover() {
    if (_imgPopover) { _imgPopover.remove(); _imgPopover = null; }
    if (_activeImg) { _activeImg.classList.remove('blog-img-selected'); _activeImg = null; }
}

function setBlogImageSize(img, size) {
    img.setAttribute('width', size); img.style.width = size;
    if (_blogQuill) _blogQuill.update();
}

function setBlogImageAlign(img, align) {
    img.classList.remove('img-align-left', 'img-align-center', 'img-align-right');
    img.classList.add('img-align-' + align);
    if (_blogQuill) _blogQuill.update();
}

function findBlogCaptionFor(img) {
    const parentP = img.closest('p'); if (!parentP) return null;
    const next = parentP.nextElementSibling;
    if (next && next.classList && next.classList.contains('blog-caption')) return next;
    return null;
}

function setBlogImageCaption(img, text) {
    const parentP = img.closest('p'); if (!parentP) return;
    let caption = findBlogCaptionFor(img);
    text = (text || '').trim();
    if (!text) { if (caption) caption.remove(); return; }
    if (caption) { caption.textContent = text; }
    else {
        caption = document.createElement('p');
        caption.className = 'blog-caption';
        caption.textContent = text;
        parentP.parentNode.insertBefore(caption, parentP.nextSibling);
    }
    if (_blogQuill) _blogQuill.update();
}

function deleteBlogImage(img) {
    const caption = findBlogCaptionFor(img); if (caption) caption.remove();
    const parentP = img.closest('p');
    if (parentP && parentP.textContent.trim() === '' && parentP.querySelectorAll('img').length === 1) parentP.remove();
    else img.remove();
    if (_blogQuill) _blogQuill.update();
}

function blogQuillImageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
        const file = input.files[0]; if (!file) return;
        if (file.size > 10 * 1024 * 1024) { alert('Image too large (max 10MB)'); return; }
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await fetch('/api/upload/blog-image', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success && data.url) {
                const range = _blogQuill.getSelection(true);
                _blogQuill.insertEmbed(range.index, 'image', data.url, 'user');
                _blogQuill.setSelection(range.index + 1);
            } else { alert(data.message || 'Upload failed'); }
        } catch (e) { alert('Upload error'); }
    };
}

async function uploadBlogCover(input) {
    const file = input.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Cover image too large (max 10MB)'); input.value = ''; return; }
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await fetch('/api/upload/blog-image', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success && data.url) {
            document.getElementById('blogImage').value = data.url;
            document.getElementById('blogCoverImg').src = data.url;
            document.getElementById('blogCoverPreview').style.display = 'block';
            document.getElementById('blogCoverRemoveBtn').style.display = 'inline-flex';
        } else { alert(data.message || 'Upload failed'); input.value = ''; }
    } catch (e) { alert('Upload error'); input.value = ''; }
}

function removeBlogCover() {
    document.getElementById('blogImage').value = '';
    document.getElementById('blogCoverInput').value = '';
    document.getElementById('blogCoverImg').src = '';
    document.getElementById('blogCoverPreview').style.display = 'none';
    document.getElementById('blogCoverRemoveBtn').style.display = 'none';
}

function openBlogEditor(blogId = null) {
    document.getElementById('blogModalTitle').textContent = blogId ? 'Edit Blog Post' : 'Create Blog Post';
    document.getElementById('blogId').value = '';
    document.getElementById('blogTitle').value = '';
    document.getElementById('blogCategory').value = 'General';
    document.getElementById('blogTags').value = '';
    document.getElementById('blogExcerpt').value = '';
    document.getElementById('blogMetaTitle').value = '';
    document.getElementById('blogMetaDescription').value = '';
    document.getElementById('blogOgImage').value = '';
    document.getElementById('blogStatus').value = 'pending';
    removeBlogCover();
    document.getElementById('blogModal').style.display = 'flex';
    setTimeout(() => {
        initBlogQuill();
        if (_blogQuill) {
            _blogQuill.setContents([]);
            _blogQuill.focus();
        }
        if (blogId) loadBlogForEdit(blogId);
    }, 150);
}

function closeBlogEditor() {
    document.getElementById('blogModal').style.display = 'none';
    hideImagePopover();
}

async function loadBlogForEdit(blogId) {
    try {
        const res = await fetch(`/api/blogs?all=1&authorId=${currentFaculty.id}`);
        const data = await res.json();
        const blog = (data.blogs || []).find(b => b.id == blogId);
        if (!blog) { alert('Blog not found'); return; }
        document.getElementById('blogId').value = blog.id;
        document.getElementById('blogTitle').value = blog.title || '';
        document.getElementById('blogCategory').value = blog.category || 'General';
        document.getElementById('blogTags').value = Array.isArray(blog.tags) ? blog.tags.join(', ') : '';
        document.getElementById('blogExcerpt').value = blog.excerpt || '';
        document.getElementById('blogMetaTitle').value = blog.metaTitle || '';
        document.getElementById('blogMetaDescription').value = blog.metaDescription || '';
        document.getElementById('blogOgImage').value = blog.ogImage || '';
        if (blog.image) {
            document.getElementById('blogImage').value = blog.image;
            document.getElementById('blogCoverImg').src = blog.image;
            document.getElementById('blogCoverPreview').style.display = 'block';
            document.getElementById('blogCoverRemoveBtn').style.display = 'inline-flex';
        }
        if (_blogQuill) {
            _blogQuill.setContents([]);
            _blogQuill.clipboard.dangerouslyPasteHTML(0, blog.content || '');
            _blogQuill.setSelection(0);
            setTimeout(() => _blogQuill.focus(), 100);
        }
    } catch (e) {
        console.error('Error loading blog:', e);
    }
}

async function saveBlog(targetStatus) {
    const blogId = document.getElementById('blogId').value;
    const title = document.getElementById('blogTitle').value.trim();
    const category = document.getElementById('blogCategory').value;
    const image = document.getElementById('blogImage').value;
    const tags = document.getElementById('blogTags').value;
    const excerpt = document.getElementById('blogExcerpt').value;
    const metaTitle = document.getElementById('blogMetaTitle').value;
    const metaDescription = document.getElementById('blogMetaDescription').value;
    const ogImage = document.getElementById('blogOgImage').value;

    let content = '';
    if (_blogQuill) {
        const html = _blogQuill.root.innerHTML;
        content = (_blogQuill.getText().trim() === '' && !/<img/i.test(html)) ? '' : html;
    }

    if (!title || !content) { alert('Title and content are required!'); return; }

    // Faculty can only save as draft or submit for approval (pending)
    const status = (targetStatus === 'draft') ? 'draft' : 'pending';

    const blogData = {
        title, category, image, content,
        tags: tags.split(',').map(t => t.trim()).filter(t => t).slice(0, 10),
        excerpt, metaTitle, metaDescription, ogImage,
        status,
        author: currentFaculty.name,
        authorId: currentFaculty.id,
        authorRole: 'faculty'
    };

    try {
        const url = blogId ? `/api/blogs/${blogId}` : '/api/blogs';
        const method = blogId ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(blogData)
        });
        const data = await res.json();
        if (data.success) {
            closeBlogEditor();
            loadBlogs();
            alert(status === 'pending' ? 'Blog submitted for approval!' : 'Blog saved as draft!');
        } else {
            alert(data.message || 'Error saving blog');
        }
    } catch (e) {
        console.error('Error saving blog:', e);
        alert('Error saving blog');
    }
}

async function editBlog(blogId) {
    openBlogEditor(blogId);
}

async function deleteBlog(blogId) {
    if (!confirm('Are you sure you want to delete this blog?')) return;
    try {
        const res = await fetch(`/api/blogs/${blogId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { loadBlogs(); alert('Blog deleted successfully!'); }
        else { alert('Error deleting blog'); }
    } catch (e) {
        console.error('Error deleting blog:', e);
        alert('Error deleting blog');
    }
}
