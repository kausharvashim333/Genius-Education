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

function showDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    
    document.getElementById('facultyName').textContent = currentFaculty.name;
    document.getElementById('facultyRole').textContent = 'Role: ' + currentFaculty.role;
    
    // Check if password change is required
    if (!currentFaculty.passwordChanged) {
        showPasswordChangeModal();
    }
    
    loadFacultyMenu();
    loadFacultyStats();
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
    
    // Dashboard - always visible
    menuHTML += '<li><a href="#" onclick="showSection(\'dashboard\')"><i class="fas fa-home"></i> Dashboard</a></li>';
    
    // Common options for all roles
    menuHTML += '<li><a href="#" onclick="showSection(\'courses\')"><i class="fas fa-book"></i> My Courses</a></li>';
    menuHTML += '<li><a href="#" onclick="showSection(\'students\')"><i class="fas fa-users"></i> My Students</a></li>';
    
    // Role-specific options
    if (currentFaculty.role === 'Admin' || currentFaculty.role === 'Faculty') {
        menuHTML += '<li><a href="#" onclick="showSection(\'assignments\')"><i class="fas fa-tasks"></i> Assignments</a></li>';
        menuHTML += '<li><a href="#" onclick="showSection(\'attendance\')"><i class="fas fa-calendar-check"></i> Attendance</a></li>';
    }
    
    if (currentFaculty.role === 'Admin') {
        menuHTML += '<li><a href="#" onclick="showSection(\'materials\')"><i class="fas fa-folder"></i> Study Materials</a></li>';
        menuHTML += '<li><a href="#" onclick="showSection(\'results\')"><i class="fas fa-chart-line"></i> Exam Results</a></li>';
    }
    
    if (currentFaculty.role === 'Staff') {
        menuHTML += '<li><a href="#" onclick="showSection(\'enquiries\')"><i class="fas fa-envelope"></i> Enquiries</a></li>';
        menuHTML += '<li><a href="#" onclick="showSection(\'notices\')"><i class="fas fa-bullhorn"></i> Notices</a></li>';
    }
    
    // Helper to check permission
    const hasPermission = (perm) => {
        const perms = currentFaculty.permissions || [];
        return perms.includes('all') || perms.includes(perm);
    };
    
    // Blog management - permission via role OR individual toggle
    if (currentFaculty.canWriteBlogs || hasPermission('blogs')) {
        menuHTML += '<li><a href="#" onclick="showSection(\'blogs\')"><i class="fas fa-blog"></i> Blog Management</a></li>';
    }
    
    // Entrance Exam - permission via role
    if (hasPermission('entrance-exam')) {
        menuHTML += '<li><a href="#" onclick="showSection(\'entranceExam\')"><i class="fas fa-file-alt"></i> Entrance Exam</a></li>';
    }
    
    menu.innerHTML = menuHTML;
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
        'courses': 'My Courses',
        'students': 'My Students',
        'assignments': 'Assignments',
        'attendance': 'Attendance',
        'materials': 'Study Materials',
        'results': 'Exam Results',
        'enquiries': 'Enquiries',
        'notices': 'Notices',
        'blogs': 'Blog Management'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';
    
    // Load section-specific data
    if (section === 'courses') loadCourses();
    if (section === 'students') loadStudents();
    if (section === 'assignments') loadAssignments();
    if (section === 'attendance') {
        document.getElementById('attendanceDate').value = new Date().toISOString().split('T')[0];
        loadAttendance();
    }
    if (section === 'materials') loadMaterials();
    if (section === 'notices') loadNotices();
    if (section === 'blogs') loadBlogs();
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

async function loadCourses() {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const coursesList = document.getElementById('coursesList');
        
        if (!courses.length) {
            coursesList.innerHTML = '<p style="color:rgba(255,255,255,0.7);text-align:center;padding:40px;">No courses found.</p>';
            return;
        }
        
        coursesList.innerHTML = '<div class="courses-grid">' + courses.map(course => `
            <div class="course-card-glass">
                <div class="course-card-icon"><i class="fas fa-book-open"></i></div>
                <h4 class="course-card-title">${course.name || 'Untitled Course'}</h4>
                ${course.duration ? `<div class="course-card-meta"><i class="fas fa-clock"></i> ${course.duration}</div>` : ''}
                ${course.fees ? `<div class="course-card-meta"><i class="fas fa-rupee-sign"></i> ${course.fees}</div>` : ''}
                ${course.description ? `<p class="course-card-desc">${course.description}</p>` : ''}
            </div>
        `).join('') + '</div>';
    } catch (e) {
        console.error('Error loading courses:', e);
    }
}

async function loadStudents() {
    try {
        const students = await fetch('/api/students').then(r => r.json());
        const tbody = document.getElementById('studentsTable').querySelector('tbody');
        
        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No students found</td></tr>';
            return;
        }
        
        tbody.innerHTML = students.map(student => `
            <tr>
                <td>${student.name}</td>
                <td>${student.course || 'N/A'}</td>
                <td>${student.phone || 'N/A'}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Error loading students:', e);
    }
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
            materialsTable.querySelector('tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">No study materials found.</td></tr>';
            return;
        }
        
        materialsTable.querySelector('tbody').innerHTML = materials.map(material => `
            <tr>
                <td>${material.title}</td>
                <td>${material.course || 'N/A'}</td>
                <td>${material.type || 'N/A'}</td>
                <td>${material.author || 'N/A'}</td>
                <td>
                    <a href="${material.url}" target="_blank" class="btn btn-primary" style="padding:6px 12px;font-size:12px;">View</a>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Error loading materials:', e);
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

function openBlogEditor(blogId = null) {
    document.getElementById('blogEditorModal').classList.add('active');
    document.getElementById('blogForm').reset();
    document.getElementById('blogId').value = '';
    document.getElementById('blogEditorTitle').textContent = 'Create Blog Post';
    
    if (blogId) {
        document.getElementById('blogEditorTitle').textContent = 'Edit Blog Post';
        loadBlogForEdit(blogId);
    }
}

function closeBlogEditor() {
    document.getElementById('blogEditorModal').classList.remove('active');
    document.getElementById('blogForm').reset();
}

async function loadBlogForEdit(blogId) {
    try {
        const res = await fetch('/api/blogs?all=1');
        const data = await res.json();
        const blog = data.blogs.find(b => b.id === blogId);
        
        if (blog) {
            document.getElementById('blogId').value = blog.id;
            document.getElementById('blogTitle').value = blog.title;
            document.getElementById('blogCategory').value = blog.category || '';
            document.getElementById('blogExcerpt').value = blog.excerpt || '';
            document.getElementById('blogImage').value = blog.image || '';
            document.getElementById('blogTags').value = (blog.tags || []).join(', ');
            document.getElementById('blogContent').value = blog.content;
            document.getElementById('blogStatus').value = blog.status || 'draft';
        }
    } catch (e) {
        console.error('Error loading blog:', e);
    }
}

async function saveBlog() {
    const blogId = document.getElementById('blogId').value;
    const title = document.getElementById('blogTitle').value;
    const category = document.getElementById('blogCategory').value;
    const excerpt = document.getElementById('blogExcerpt').value;
    const image = document.getElementById('blogImage').value;
    const tags = document.getElementById('blogTags').value;
    const content = document.getElementById('blogContent').value;
    const status = document.getElementById('blogStatus').value;
    
    if (!title || !content) {
        alert('Title and content are required!');
        return;
    }
    
    const blogData = {
        title,
        category,
        excerpt,
        image,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        content,
        status,
        author: currentFaculty.name,
        authorId: currentFaculty.id,
        authorRole: 'faculty'
    };
    
    try {
        let res;
        if (blogId) {
            res = await fetch(`/api/blogs/${blogId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(blogData)
            });
        } else {
            res = await fetch('/api/blogs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(blogData)
            });
        }
        
        const data = await res.json();
        
        if (data.success) {
            closeBlogEditor();
            loadBlogs();
            alert(status === 'pending' ? 'Blog submitted for approval!' : 'Blog saved successfully!');
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
        const res = await fetch(`/api/blogs/${blogId}`, {
            method: 'DELETE'
        });
        
        const data = await res.json();
        
        if (data.success) {
            loadBlogs();
            alert('Blog deleted successfully!');
        } else {
            alert('Error deleting blog');
        }
    } catch (e) {
        console.error('Error deleting blog:', e);
        alert('Error deleting blog');
    }
}
