let currentPage = 'dashboard';
let galleryImageFile = null;
let galleryEditId = null;
let carouselImageFile = null;

// ===== Toast Notification System =====
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle', info: 'info-circle' };
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<i class="fas fa-' + (icons[type] || 'info-circle') + ' toast-icon"></i>' +
        '<span class="toast-msg">' + message + '</span>' +
        '<i class="fas fa-times toast-close"></i>';
    container.appendChild(toast);
    const removeToast = () => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    };
    toast.querySelector('.toast-close').addEventListener('click', removeToast);
    if (duration > 0) setTimeout(removeToast, duration);
}

// ===== Empty State Helper =====
function renderEmptyState(tbody, icon = 'inbox', text = 'No data found') {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="100"><div class="empty-state"><i class="fas fa-' + icon + ' empty-icon"></i><div class="empty-text">' + text + '</div></div></td></tr>';
}

// ===== Loading Spinner Helper =====
function renderLoadingSpinner(tbody, text = 'Loading...') {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="100"><div class="table-loading-spinner"><div class="spinner"></div><span class="spinner-text">' + text + '</span></div></td></tr>';
}

// Auto-inject X-Admin-Session header on all /api/ fetch calls + handle session expiry
(function () {
    const origFetch = window.fetch.bind(window);
    let sessionExpiredHandled = false;
    function handleSessionExpired() {
        if (sessionExpiredHandled) return;
        sessionExpiredHandled = true;
        sessionStorage.removeItem('adminSession');
        sessionStorage.removeItem('adminSessionToken');
        sessionStorage.removeItem('adminSessionExpires');
        alert('Your admin session has expired. Please login again.');
        window.location.reload();
    }
    window.fetch = function (input, init) {
        let isAdminApi = false;
        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            if (url.indexOf('/api/') !== -1) {
                isAdminApi = true;
                const token = sessionStorage.getItem('adminSessionToken');
                if (token) {
                    init = init || {};
                    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
                    if (!headers.has('X-Admin-Session')) headers.set('X-Admin-Session', token);
                    init.headers = headers;
                }
            }
        } catch (_) {}
        const p = origFetch(input, init);
        if (!isAdminApi) return p;
        return p.then(res => {
            // If the admin session is invalid/expired, gracefully handle it once.
            if (res && res.status === 401 && sessionStorage.getItem('adminSessionToken')) {
                handleSessionExpired();
            }
            return res;
        });
    };
})();

// Helper function to get admin session headers
function getAdminHeaders() {
    const sessionToken = sessionStorage.getItem('adminSessionToken');
    const headers = { 'Content-Type': 'application/json' };
    if (sessionToken) {
        headers['X-Admin-Session'] = sessionToken;
    }
    return headers;
}

// Helper function to check if session is valid
async function checkAdminSession() {
    const sessionToken = sessionStorage.getItem('adminSessionToken');
    if (!sessionToken) return false;
    
    try {
        const res = await fetch('/api/admin/verify-session', {
            headers: { 'X-Admin-Session': sessionToken }
        });
        const data = await res.json();
        return data.valid;
    } catch (err) {
        console.error('Session check error:', err);
        return false;
    }
}

// Session is bound to the browser tab via sessionStorage and is also validated
// against the server. It auto-expires when the tab is closed or when admin logs out.
async function checkSessionTimeout() {
    const sessionToken = sessionStorage.getItem('adminSessionToken');
    if (!sessionToken) return;
    try {
        const res = await fetch('/api/admin/verify-session', {
            headers: { 'X-Admin-Session': sessionToken }
        });
        const data = await res.json().catch(() => ({}));
        if (!data.valid) {
            sessionStorage.removeItem('adminSession');
            sessionStorage.removeItem('adminSessionToken');
            sessionStorage.removeItem('adminSessionExpires');
            showNotification('Your session has expired. Please login again.', 'error');
            document.getElementById('loginSection').classList.remove('hidden');
            document.getElementById('dashboardSection').classList.add('hidden');
            const loginNav = document.querySelector('.admin-login-nav');
            if (loginNav) loginNav.classList.remove('hidden');
        }
    } catch (e) { /* network error - ignore */ }
}

// Periodically validate the session against the server (every 5 minutes)
setInterval(checkSessionTimeout, 5 * 60 * 1000);

// Global formatDate function for DD-MMM-YYYY format (with month name)
function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

// Global formatTime function for HH:MM AM/PM format
function formatTime(time) {
    if (!time) return 'N/A';
    const [h, m] = time.split(':');
    if (!h) return time;
    const hr = parseInt(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const h12 = hr % 12 || 12;
    return `${h12}:${m || '00'} ${ampm}`;
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
            grid.innerHTML = data.admitCards.map(ac => {
                const student = studentsMap[ac.studentId];
                const studentIdDisplay = student && student.rollNo ? student.rollNo : (ac.rollNo || 'N/A');
                return `<div style="background:rgba(255,255,255,0.1);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:16px;display:flex;align-items:center;gap:16px;box-shadow:0 8px 32px rgba(0,0,0,0.1);transition:all 0.3s;">
                    <img src="${ac.studentPhoto || '/uploads/students/default.png'}" alt="Student" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid rgba(102,126,234,0.5);">
                    <div style="flex:1;">
                        <div style="font-weight:600;color:#fff;font-size:15px;text-shadow:0 2px 4px rgba(0,0,0,0.2);">${ac.studentName}</div>
                        <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Roll No: ${ac.rollNo || 'N/A'}</div>
                        <div style="font-size:13px;color:rgba(255,255,255,0.8);">Exam: ${ac.examName}</div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-primary" onclick="viewAdmitCard(${ac.id})" style="padding:10px 20px;font-size:13px;background:rgba(102,126,234,0.6);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);border:1px solid rgba(102,126,234,0.8);border-radius:8px;color:#fff;font-weight:600;cursor:pointer;transition:all 0.3s;"><i class="fas fa-eye"></i> View</button>
                        <button class="btn btn-secondary" onclick="printAdmitCard(${ac.id})" style="padding:10px 20px;font-size:13px;background:rgba(255,255,255,0.15);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.3);border-radius:8px;color:#fff;font-weight:600;cursor:pointer;transition:all 0.3s;"><i class="fas fa-print"></i> Print</button>
                        <button class="btn btn-danger" onclick="deleteAdmitCard(${ac.id})" style="padding:10px 20px;font-size:13px;background:rgba(239,68,68,0.5);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);border:1px solid rgba(239,68,68,0.7);border-radius:8px;color:#fff;font-weight:600;cursor:pointer;transition:all 0.3s;"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>`;
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

async function viewAdmitCard(id) {
    try {
        const res = await fetch('/api/admit-cards/' + id);
        const data = await res.json();
        if (data.success && data.admitCard) {
            const ac = data.admitCard;
            const modal = document.createElement('div');
            modal.id = 'admitCardModal';
            modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
            modal.innerHTML = `
                <div class="admit-card-preview" style="background:rgba(0,0,0,0.3);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.2);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.1);max-width:800px;width:100%;margin:0;max-height:90vh;overflow-y:auto;padding:24px;">
                    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.2);">
                        <img src="${ac.instituteLogo || '/uploads/logo/logo.png'}" alt="Logo" style="width:60px;height:60px;border-radius:8px;">
                        <div style="color:#fff;">
                            <h3 style="font-size:20px;margin:0 0 4px 0;font-weight:600;">${ac.instituteName || 'Genius Computer Education'}</h3>
                            <p style="font-size:14px;margin:0;opacity:0.9;">Admit Card</p>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
                        <img src="${ac.studentPhoto || '/uploads/students/default.png'}" alt="Student" style="width:100px;height:100px;object-fit:cover;border:3px solid rgba(102,126,234,0.5);border-radius:8px;">
                        <div style="color:#fff;">
                            <h4 style="font-size:18px;margin:0 0 8px 0;font-weight:600;">${ac.studentName}</h4>
                            <p style="font-size:14px;margin:0;opacity:0.8;">Roll No: ${ac.rollNo || 'N/A'}</p>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:24px;">
                        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-left:4px solid rgba(102,126,234,0.5);border-radius:8px;padding:12px 16px;"><span style="color:rgba(255,255,255,0.7);font-size:13px;display:block;margin-bottom:4px;">Exam</span><strong style="color:#fff;font-size:15px;font-weight:600;">${ac.examName}</strong></div>
                        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-left:4px solid rgba(102,126,234,0.5);border-radius:8px;padding:12px 16px;"><span style="color:rgba(255,255,255,0.7);font-size:13px;display:block;margin-bottom:4px;">Date</span><strong style="color:#fff;font-size:15px;font-weight:600;">${formatDate(ac.examDate)}</strong></div>
                        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-left:4px solid rgba(102,126,234,0.5);border-radius:8px;padding:12px 16px;"><span style="color:rgba(255,255,255,0.7);font-size:13px;display:block;margin-bottom:4px;">Time</span><strong style="color:#fff;font-size:15px;font-weight:600;">${formatTime(ac.examTime)}</strong></div>
                        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-left:4px solid rgba(102,126,234,0.5);border-radius:8px;padding:12px 16px;"><span style="color:rgba(255,255,255,0.7);font-size:13px;display:block;margin-bottom:4px;">Duration</span><strong style="color:#fff;font-size:15px;font-weight:600;">${ac.duration} mins</strong></div>
                        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-left:4px solid rgba(102,126,234,0.5);border-radius:8px;padding:12px 16px;"><span style="color:rgba(255,255,255,0.7);font-size:13px;display:block;margin-bottom:4px;">Venue</span><strong style="color:#fff;font-size:15px;font-weight:600;">${ac.venue}</strong></div>
                        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-left:4px solid rgba(102,126,234,0.5);border-radius:8px;padding:12px 16px;"><span style="color:rgba(255,255,255,0.7);font-size:13px;display:block;margin-bottom:4px;">Total Marks</span><strong style="color:#fff;font-size:15px;font-weight:600;">${ac.totalMarks}</strong></div>
                    </div>
                    <div style="display:flex;justify-content:center;padding-top:20px;border-top:1px solid rgba(255,255,255,0.2);">
                        <button id="closeAdmitCardModal" class="btn btn-secondary" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:8px;padding:10px 32px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.3s;">Close</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            
            document.getElementById('closeAdmitCardModal').addEventListener('click', () => {
                modal.remove();
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        } else {
            showNotification('Error loading admit card', 'error');
        }
    } catch (e) {
        console.error('Error viewing admit card:', e);
        showNotification('Error viewing admit card', 'error');
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
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04;"><img src="/uploads/logo/logo.png" style="max-width: 300px; max-height: 300px; border-radius: 12px;" onerror="this.parentElement.style.display='none'"></div>
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

    // Load students and alumni lists for testimonials
    loadStudentsList();
    loadAlumniList();

    // Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log('Login form found, attaching event listener');
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Login form submitted');
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const totpToken = document.getElementById('totpToken').value;
            console.log('Attempting login with username:', username);
            try {
                // Get reCAPTCHA token
                const recaptchaToken = await grecaptcha.execute('6LfDe_gsAAAAALle5tiQY_6WnVgp-wrRrhwlqk9t', {action: 'verify_admin_credentials'});
                
                const res = await fetch('/api/admin/verify-credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, totpToken, recaptchaToken })
                });
                const data = await res.json();
                console.log('Login response:', data);
                if (data.success) {
                    sessionStorage.setItem('adminSession', 'active');
                    sessionStorage.setItem('adminSessionToken', data.sessionToken);
                    sessionStorage.setItem('adminSessionExpires', data.expiresAt);
                    showDashboard();
                } else if (data.requireTOTP) {
                    // Show TOTP input field
                    document.getElementById('totpSection').style.display = 'block';
                    document.getElementById('totpToken').focus();
                    showNotification(data.message || 'TOTP code required', 'warning');
                } else {
                    showNotification(data.message || 'Invalid credentials!', 'error');
                    if (data.remainingAttempts !== undefined) {
                        showNotification(`Remaining attempts: ${data.remainingAttempts}`, 'warning');
                    }
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
    document.getElementById('logoutBtn').addEventListener('click', async function() {
        const sessionToken = sessionStorage.getItem('adminSessionToken');
        if (sessionToken) {
            try {
                await fetch('/api/admin/logout', {
                    method: 'POST',
                    headers: { 'X-Admin-Session': sessionToken }
                });
            } catch (err) {
                console.error('Logout error:', err);
            }
        }
        sessionStorage.removeItem('adminSession');
        sessionStorage.removeItem('adminSessionToken');
        sessionStorage.removeItem('adminSessionExpires');
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('dashboardSection').classList.add('hidden');
        const loginNav = document.querySelector('.admin-login-nav');
        if (loginNav) loginNav.classList.remove('hidden');
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
    const pageTitles = {
        'dashboard': { title: 'Dashboard', icon: 'home', breadcrumb: 'Home' },
        'students': { title: 'Students', icon: 'user-graduate', breadcrumb: 'Home > Students' },
        'admission': { title: 'New Admission', icon: 'user-plus', breadcrumb: 'Home > Students > New Admission' },
        'fees': { title: 'Fees Management', icon: 'money-bill-wave', breadcrumb: 'Home > Fees' },
        'certificates': { title: 'Certificates', icon: 'certificate', breadcrumb: 'Home > Certificates' },
        'payments': { title: 'Payments', icon: 'rupee-sign', breadcrumb: 'Home > Payments' },
        'enquiries': { title: 'Enquiries', icon: 'clipboard-list', breadcrumb: 'Home > Enquiries' },
        'courses': { title: 'Courses', icon: 'book', breadcrumb: 'Home > Courses' },
        'batches': { title: 'Batches', icon: 'layer-group', breadcrumb: 'Home > Batches' },
        'faculty': { title: 'Faculty', icon: 'user-tie', breadcrumb: 'Home > Faculty' },
        'testimonials': { title: 'Testimonials', icon: 'star', breadcrumb: 'Home > Testimonials' },
        'gallery': { title: 'Gallery', icon: 'images', breadcrumb: 'Home > Gallery' },
        'hero-section': { title: 'Hero Section', icon: 'image', breadcrumb: 'Home > Settings > Hero Section' },
        'social': { title: 'Social Media', icon: 'share-alt', breadcrumb: 'Home > Settings > Social Media' },
        'homepage-sections': { title: 'Homepage Sections', icon: 'th-list', breadcrumb: 'Home > Settings > Homepage Sections' },
        'legal-pages': { title: 'Legal Pages', icon: 'file-contract', breadcrumb: 'Home > Settings > Legal Pages' },
        'settings': { title: 'General Settings', icon: 'sliders-h', breadcrumb: 'Home > Settings > General' },
        'about': { title: 'About Section', icon: 'info-circle', breadcrumb: 'Home > Settings > About' },
        'helpdesk': { title: 'Helpdesk', icon: 'headset', breadcrumb: 'Home > Admin > Helpdesk' },
        'backup': { title: 'Backup & Recovery', icon: 'database', breadcrumb: 'Home > Admin > Backup' },
        'roles': { title: 'Roles & Permissions', icon: 'user-shield', breadcrumb: 'Home > Admin > Roles' },
        'typing-users': { title: 'Typing - User Management', icon: 'keyboard', breadcrumb: 'Home > Typing > Users' },
        'typing-content': { title: 'Typing - Content', icon: 'keyboard', breadcrumb: 'Home > Typing > Content' },
        'typing-leaderboard': { title: 'Typing - Leaderboard', icon: 'trophy', breadcrumb: 'Home > Typing > Leaderboard' },
        'typing-analytics': { title: 'Typing - Analytics', icon: 'chart-bar', breadcrumb: 'Home > Typing > Analytics' },
        'typing-settings': { title: 'Typing - Settings', icon: 'cog', breadcrumb: 'Home > Typing > Settings' },
        'blog': { title: 'Blog Posts', icon: 'blog', breadcrumb: 'Home > Content > Blog' },
        'blog-pending': { title: 'Pending Blogs', icon: 'blog', breadcrumb: 'Home > Content > Pending Blogs' },
        'blog-comments': { title: 'Blog Comments', icon: 'comments', breadcrumb: 'Home > Content > Comments' },
        'newsletter': { title: 'Newsletter', icon: 'envelope', breadcrumb: 'Home > Content > Newsletter' },
        'notices': { title: 'Notices', icon: 'bullhorn', breadcrumb: 'Home > Content > Notices' },
        'announcements': { title: 'Announcements', icon: 'bullhorn', breadcrumb: 'Home > Content > Announcements' },
        'tests': { title: 'Tests', icon: 'clipboard-check', breadcrumb: 'Home > Content > Tests' },
        'study-materials': { title: 'Study Materials', icon: 'file-alt', breadcrumb: 'Home > Content > Study Materials' },
        'videos': { title: 'Videos', icon: 'video', breadcrumb: 'Home > Content > Videos' },
        'video-comments': { title: 'Video Comments', icon: 'comments', breadcrumb: 'Home > Content > Video Comments' },
        'video-analytics': { title: 'Video Analytics', icon: 'chart-bar', breadcrumb: 'Home > Content > Video Analytics' },
        'assignments': { title: 'Assignments', icon: 'tasks', breadcrumb: 'Home > Content > Assignments' },
        'alumni': { title: 'Alumni', icon: 'user-graduate', breadcrumb: 'Home > Content > Alumni' },
        'notifications': { title: 'Notifications', icon: 'bell', breadcrumb: 'Home > Content > Notifications' },
        'attendance': { title: 'Attendance', icon: 'calendar-check', breadcrumb: 'Home > Attendance' },
        'holidays': { title: 'Holidays', icon: 'calendar-times', breadcrumb: 'Home > Attendance > Holidays' },
        'exam-calendar': { title: 'Exam Calendar', icon: 'calendar-alt', breadcrumb: 'Home > Exams > Calendar' },
        'exam-management': { title: 'Exam Management', icon: 'clipboard', breadcrumb: 'Home > Exams > Management' },
        'question-bank': { title: 'Question Bank', icon: 'question-circle', breadcrumb: 'Home > Exams > Questions' },
        'exam-schedule': { title: 'Exam Schedule', icon: 'calendar-plus', breadcrumb: 'Home > Exams > Schedule' },
        'exam-registration': { title: 'Exam Registration', icon: 'user-plus', breadcrumb: 'Home > Exams > Registration' },
        'admit-cards': { title: 'Admit Cards', icon: 'id-card', breadcrumb: 'Home > Exams > Admit Cards' },
        'online-exam': { title: 'Online Exams', icon: 'laptop-code', breadcrumb: 'Home > Exams > Online Exams' },
        'online-exam-results': { title: 'Online Exam Results', icon: 'poll', breadcrumb: 'Home > Exams > Results' },
        'manual-grading': { title: 'Manual Grading', icon: 'pen', breadcrumb: 'Home > Exams > Grading' },
        'exam-analytics': { title: 'Exam Analytics', icon: 'chart-pie', breadcrumb: 'Home > Exams > Analytics' },
        're-evaluation': { title: 'Re-evaluation', icon: 'redo', breadcrumb: 'Home > Exams > Re-evaluation' },
        'exam-reports': { title: 'Exam Reports', icon: 'file-alt', breadcrumb: 'Home > Exams > Reports' },
        'exam-results': { title: 'Exam Results', icon: 'poll', breadcrumb: 'Home > Exams > Results' },
        'entrance-dashboard': { title: 'Entrance Exam Dashboard', icon: 'graduation-cap', breadcrumb: 'Home > Entrance > Dashboard' },
        'entrance-exams': { title: 'Entrance Exams', icon: 'graduation-cap', breadcrumb: 'Home > Entrance > Exams' },
        'entrance-questions': { title: 'Question Bank', icon: 'question-circle', breadcrumb: 'Home > Entrance > Questions' },
        'entrance-registrations': { title: 'Registrations', icon: 'user-plus', breadcrumb: 'Home > Entrance > Registrations' },
        'entrance-monitor': { title: 'Live Monitoring', icon: 'eye', breadcrumb: 'Home > Entrance > Monitor' },
        'entrance-results': { title: 'Results', icon: 'poll', breadcrumb: 'Home > Entrance > Results' },
        'entrance-settings': { title: 'Settings', icon: 'cog', breadcrumb: 'Home > Entrance > Settings' }
    };

    function updateHeaderForPage(page) {
        const greetingEl = document.getElementById('headerGreeting');
        const titleEl = document.getElementById('headerPageTitle');
        if (!greetingEl || !titleEl) return;
        
        if (page === 'dashboard') {
            greetingEl.style.display = '';
            titleEl.style.display = 'none';
        } else {
            greetingEl.style.display = 'none';
            titleEl.style.display = '';
            const info = pageTitles[page] || { title: page.charAt(0).toUpperCase() + page.slice(1), icon: 'th-large', breadcrumb: 'Home > ' + page };
            document.getElementById('pageTitleText').innerHTML = '<i class="fas fa-' + info.icon + '"></i> ' + info.title;
            document.getElementById('pageBreadcrumb').innerHTML = '<i class="fas fa-home"></i> ' + info.breadcrumb;
        }
    }

    function updateHeaderToolbar(pageEl) {
        const toolbar = document.getElementById('headerToolbar');
        if (!toolbar) return;
        // Return existing toolbar children to their original pages
        const existing = toolbar.querySelectorAll('.page-toolbar');
        existing.forEach(tb => {
            const originId = tb.getAttribute('data-toolbar-origin');
            if (originId) {
                const origin = document.getElementById(originId);
                if (origin) {
                    origin.insertBefore(tb, origin.firstChild);
                    // Show parent form-page-header if it was hidden
                    const parent = tb.parentElement;
                    if (parent && parent.classList.contains('form-page-header')) {
                        parent.style.display = '';
                    }
                }
            }
        });
        if (!pageEl) return;
        const toolbars = pageEl.querySelectorAll('.page-toolbar');
        toolbars.forEach(tb => {
            tb.setAttribute('data-toolbar-origin', pageEl.id);
            toolbar.appendChild(tb);
            // Hide parent form-page-header if it's now empty
            const parent = tb.parentElement;
            if (parent && parent.classList.contains('form-page-header') && !parent.children.length) {
                parent.style.display = 'none';
            }
        });
    }

    function loadPage(page) {
        document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
        document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
        
        // Save current page to localStorage
        localStorage.setItem('currentAdminPage', page);
        
        const pageEl = document.getElementById('page-' + page);
        if (pageEl) {
            pageEl.classList.remove('hidden');
            updateHeaderForPage(page);
            updateHeaderToolbar(pageEl);
            const link = document.querySelector(`.sidebar-menu a[data-page="${page}"]`);
            if (link) link.classList.add('active');
            
            const pageLoaders = {
                'dashboard': loadDashboard,
                'enquiries': loadEnquiries,
                'students': loadStudentsTable,
                'courses': loadCoursesTable,
                'batches': loadBatchesTable,
                'faculty': loadFacultyTable,
                'fees': loadFeesTable,
                'certificates': loadCertificatesTable,
                'payments': loadPaymentsTable,
                'testimonials': loadTestimonialsTable,
                'hero-section': () => { loadCarouselAdmin(); loadHeroText(); },
                'gallery': loadGalleryTable,
                'social': loadSocialMedia,
                'homepage-sections': () => { loadSectionVisibility(); loadSectionTexts(); setupHomepageSectionsTabs(); },
                'settings': loadSettings,
                'helpdesk': loadTicketsTable,
                'backup': loadBackupsList,
                'typing-users': loadTypingUsers,
                'typing-content': () => {},
                'typing-leaderboard': loadTypingLeaderboard,
                'typing-analytics': loadTypingAnalytics,
                'typing-settings': () => {},
                'blog-pending': loadPendingBlogs,
                'roles': loadRolesTable,
                'about': loadAbout,
                'study-materials': loadStudyMaterialsTable,
                'videos': () => { loadVideosTable(); loadChaptersTable(); },
                'video-comments': loadAdminVideoComments,
                'video-analytics': loadVideoAnalytics,
                'assignments': loadAssignmentsTable,
                'exam-results': loadExamResultsTable,
                'notices': loadNoticesTable,
                'announcements': loadAnnouncementsTable,
                'tests': loadTestsTable,
                'blog': loadBlogTable,
                'blog-comments': loadBlogComments,
                'newsletter': loadNewsletterSubs,
                'alumni': loadAlumniTable,
                'attendance': loadAttendancePage,
                'holidays': loadHolidaysTable,
                'exam-calendar': loadExamCalendarTable,
                'question-bank': loadQuestionBankTable,
                'exam-schedule': loadExamScheduleTable,
                'exam-registration': loadExamRegistrationTable,
                'admit-cards': loadAdmitCards,
                'online-exam': loadOnlineExamTable,
                'online-exam-results': loadOnlineExamResults,
                'manual-grading': typeof loadPendingGrading === 'function' ? loadPendingGrading : null,
                'exam-analytics': typeof loadAnalyticsPage === 'function' ? loadAnalyticsPage : null,
                're-evaluation': loadReEvaluationTable,
                'exam-reports': loadExamReportsTable,
                'legal-pages': loadLegalPagesEditor
            };
            const loader = pageLoaders[page];
            if (typeof loader === 'function') {
                try { loader(); } catch (err) { console.error('Loader error for ' + page + ':', err); }
            }
            autoExpandActiveDropdown();
        }
    }

    document.querySelectorAll('.sidebar-menu a[data-page]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            loadPage(page);
        });
    });

    // Dropdown toggle functionality
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            const dropdown = this.closest('.dropdown');
            
            // Close all other dropdowns
            document.querySelectorAll('.dropdown').forEach(d => {
                if (d !== dropdown) {
                    d.classList.remove('open');
                }
            });
            
            dropdown.classList.toggle('open');
        });
    });

    // Collapse state init from localStorage
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        const sidebarEl = document.querySelector('.sidebar');
        if (sidebarEl) sidebarEl.classList.add('collapsed');
    }

    // Dynamic greeting clock timer
    updateHeaderClock();
    setInterval(updateHeaderClock, 1000);

    // Auto expand active dropdown on load
    autoExpandActiveDropdown();

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

    // Favicon file upload
    document.getElementById('faviconFile').addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('favicon', file);
        try {
            const res = await fetch('/api/favicon', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                loadFaviconPreview();
                showNotification('Favicon uploaded!', 'success');
            } else {
                showNotification(data.message || 'Favicon upload failed!', 'error');
            }
        } catch (err) { showNotification('Favicon upload failed!', 'error'); }
    });

    // Popup image file upload
    document.getElementById('popupImageFile').addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('popupImage', file);
        try {
            const res = await fetch('/api/popup-image', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                loadPopupImagePreview();
                showNotification('Popup image uploaded!', 'success');
            } else {
                showNotification(data.message || 'Popup image upload failed!', 'error');
            }
        } catch (err) { showNotification('Popup image upload failed!', 'error'); }
    });

    // Check if already logged in (session is tied to current tab)
    if (sessionStorage.getItem('adminSession') === 'active') {
        showDashboard();
    }

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
            const originalBtnHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            try {
                // Validation
                const phone = document.getElementById('sPhone').value;
                if (phone.length !== 10 || !/^[6-9]/.test(phone)) { showNotification('Valid 10-digit mobile number chahiye (6-9 se shuru ho)!', 'error'); btn.disabled = false; btn.innerHTML = originalBtnHtml; return; }
                const aadhar = document.getElementById('sAadhar').value;
                if (aadhar && aadhar.length !== 12) { showNotification('Aadhar number 12 digits ka hona chahiye!', 'error'); btn.disabled = false; btn.innerHTML = originalBtnHtml; return; }
                const pincode = document.getElementById('sPincode').value;
                if (pincode && pincode.length !== 6) { showNotification('PIN code 6 digits ka hona chahiye!', 'error'); btn.disabled = false; btn.innerHTML = originalBtnHtml; return; }
                for (let i = 1; i <= 10; i++) {
                    const dec = document.getElementById('decl' + i);
                    if (dec && !dec.checked) {
                        showNotification('Declaration ke sabhi boxes check karna zaroori hai!', 'error');
                        btn.disabled = false;
                        btn.innerHTML = originalBtnHtml;
                        return;
                    }
                }

                const formData = new FormData();
                formData.append('name', document.getElementById('sName').value);
                formData.append('dob', document.getElementById('sDob').value);
                formData.append('gender', document.getElementById('sGender').value);
                formData.append('category', document.getElementById('sCategory').value);
                formData.append('bloodGroup', document.getElementById('sBloodGroup').value);
                formData.append('fatherName', document.getElementById('sFatherName').value);
                formData.append('fatherOccupation', document.getElementById('sFatherOcc').value);
                formData.append('fatherPhone', document.getElementById('sFatherPhone').value);
                formData.append('motherName', document.getElementById('sMotherName').value);
                formData.append('familyIncome', document.getElementById('sFamilyIncome').value);
                formData.append('phone', document.getElementById('sPhone').value);
                formData.append('whatsapp', document.getElementById('sWhatsapp').value);
                formData.append('email', document.getElementById('sEmail').value);
                formData.append('aadhar', document.getElementById('sAadhar').value);
                formData.append('address', [
                    document.getElementById('sStreet').value,
                    document.getElementById('sCity').value,
                    document.getElementById('sTehsil').value,
                    document.getElementById('sDistrict').value,
                    document.getElementById('sState').value,
                    document.getElementById('sPincode').value
                ].filter(Boolean).join(', '));
                formData.append('reference', document.getElementById('sReference').value);
                formData.append('course', document.getElementById('sCourse').value);
                const batchSel = document.getElementById('sBatch');
                formData.append('batch', batchSel.value);
                formData.append('batchId', batchSel.options[batchSel.selectedIndex]?.dataset?.batchId || '');

                const totalFees = parseInt(document.getElementById('sTotalFees').value) || 0;
                const amountPaid = parseInt(document.getElementById('sPayNow').value) || 0;
                const pendingFees = Math.max(0, totalFees - amountPaid);
                const paymentType = document.querySelector('input[name="sPayType"]:checked')?.value || 'partial';
                const paymentMode = document.getElementById('sPayMode').value || 'Cash';

                formData.append('totalFees', totalFees.toString());
                formData.append('paymentType', paymentType);
                formData.append('paymentMode', paymentMode);
                formData.append('amountPaid', amountPaid.toString());
                formData.append('pendingFees', pendingFees.toString());
                formData.append('transactionId', document.getElementById('sTransactionId')?.value || '');
                if (paymentMode === 'upi') {
                    formData.append('utrNumber', document.getElementById('utrNumber')?.value || '');
                }
                if (paymentMode === 'cash') {
                    formData.append('utrNumber', document.getElementById('cashReceiptNo')?.value || '');
                }
                formData.append('sendEmail', document.getElementById('sSendEmail')?.checked ? 'true' : 'false');

                const qualification = {
                    tenth: {
                        board: document.getElementById('s10Board')?.value || '',
                        school: document.getElementById('s10School')?.value || '',
                        year: document.getElementById('s10Year')?.value || '',
                        roll: document.getElementById('s10Roll')?.value || '',
                        total: document.getElementById('s10Total')?.value || '',
                        obtained: document.getElementById('s10Obtained')?.value || '',
                        percentage: document.getElementById('pct10')?.textContent || '',
                        division: document.getElementById('div10')?.textContent || ''
                    }
                };

                const isTyping = (document.getElementById('sCourse').value || '').toUpperCase().includes('TYPING');
                const isPGDCA = (document.getElementById('sCourse').value || '').toUpperCase().includes('PGDCA');

                if (!isTyping && document.getElementById('qualificationSection')?.style.display !== 'none') {
                    qualification.twelfth = {
                        board: document.getElementById('s12Board')?.value || '',
                        stream: document.getElementById('s12Stream')?.value || '',
                        school: document.getElementById('s12School')?.value || '',
                        year: document.getElementById('s12Year')?.value || '',
                        roll: document.getElementById('s12Roll')?.value || '',
                        total: document.getElementById('s12Total')?.value || '',
                        obtained: document.getElementById('s12Obtained')?.value || '',
                        percentage: document.getElementById('pct12')?.textContent || '',
                        division: document.getElementById('div12')?.textContent || ''
                    };
                }

                if (isPGDCA) {
                    const isCGPA = document.querySelector('input[name="gradMarksType"]:checked')?.value === 'cgpa';
                    qualification.graduation = {
                        university: document.getElementById('sGradUniv')?.value || '',
                        college: document.getElementById('sGradCollege')?.value || '',
                        degree: document.getElementById('sGradDegree')?.value || '',
                        stream: document.getElementById('sGradStream')?.value || '',
                        year: document.getElementById('sGradYear')?.value || '',
                        enroll: document.getElementById('sGradEnroll')?.value || '',
                        marksType: isCGPA ? 'cgpa' : 'percentage',
                        total: isCGPA ? '' : (document.getElementById('sGradTotal')?.value || ''),
                        obtained: isCGPA ? '' : (document.getElementById('sGradObtained')?.value || ''),
                        percentage: isCGPA ? (document.getElementById('sGradCGPAPct')?.value || '') : (document.getElementById('pctGrad')?.textContent || ''),
                        cgpa: isCGPA ? (document.getElementById('sGradCGPA')?.value || '') : '',
                        division: isCGPA ? (document.getElementById('sGradCGPADiv')?.value || '') : (document.getElementById('divGrad')?.textContent || '')
                    };
                }

                formData.append('qualification', JSON.stringify(qualification));

                const photo = document.getElementById('sPhoto')?.files?.[0];
                const signature = document.getElementById('sSignature')?.files?.[0];
                if (photo) formData.append('photo', photo);
                if (signature) formData.append('signature', signature);
                ['sAadharDoc', 's10thMarksheet', 's12thMarksheet', 'sGradMarksheet'].forEach(id => {
                    const f = document.getElementById(id)?.files?.[0];
                    if (f) formData.append('documents', f);
                });

                const res = await fetch('/api/students', { method: 'POST', body: formData });
                const data = await res.json();
                console.log('Server response:', data);
                if (data.success) {
                    loadStudentsTable();
                    loadDashboard();
                    showStudentsPage();
                    showNotification('Admission successful!', 'success');
                } else {
                    showNotification(data.message || 'Admission failed!', 'error');
                }
            } catch (err) {
                console.error('Error submitting admin admission form:', err);
                showNotification('Error submitting form!', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
        });
    }
});

function showDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    const loginNav = document.querySelector('.admin-login-nav');
    if (loginNav) loginNav.classList.add('hidden');
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
        let [coursesData, students, enquiries, faculty, gallery, paymentsData, batches, onlineExams, certsData, materialsData, admitCardsData] = await Promise.all([
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

        // Defensive: any endpoint that returned a non-array (e.g. 401 {success:false}) becomes []
        if (!Array.isArray(students)) students = [];
        if (!Array.isArray(enquiries)) enquiries = [];
        if (!Array.isArray(faculty)) faculty = [];
        if (!Array.isArray(gallery)) gallery = [];
        if (!Array.isArray(batches)) batches = [];
        if (!Array.isArray(onlineExams)) onlineExams = [];

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

        // Total Revenue
        const totalRevenue = students.reduce((sum, s) => sum + (s.fees && s.fees.paidAmount ? parseFloat(s.fees.paidAmount) : 0), 0);
        document.getElementById('totalRevenue').textContent = '₹' + totalRevenue.toLocaleString('en-IN');

        const totalDues = students.reduce((sum, s) => sum + (s.fees && s.fees.dueAmount ? parseFloat(s.fees.dueAmount) : 0), 0);
        document.getElementById('totalDues').textContent = '₹' + totalDues.toLocaleString('en-IN');

        document.getElementById('totalBatches').textContent = batches.length;

        // Row 3
        document.getElementById('totalOnlineExams').textContent = onlineExams.length;
        document.getElementById('totalCertificates').textContent = certificates.length;
        document.getElementById('totalMaterials').textContent = materials.length;
        document.getElementById('totalGallery').textContent = gallery.length;

        // ===== 1. Admissions & Revenue Timeline Activity Feed =====
        const recentStudents = [...students].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5);
        const admTimeline = document.getElementById('recentAdmissionsTimeline');
        if (admTimeline) {
            if (recentStudents.length > 0) {
                admTimeline.innerHTML = recentStudents.map(s => `
                    <div class="timeline-item">
                        <div class="timeline-dot bg-primary"></div>
                        <div class="timeline-content">
                            <div class="timeline-title">${s.name || '-'}</div>
                            <div class="timeline-desc">Joined course <strong>${s.course || '-'}</strong></div>
                            <div class="timeline-time"><i class="far fa-clock"></i> ${s.admissionDate ? formatDate(s.admissionDate) : '-'}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                admTimeline.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;">No recent admissions yet</div>';
            }
        }

        const recentPay = [...payments].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5);
        const payTimeline = document.getElementById('recentPaymentsTimeline');
        if (payTimeline) {
            if (recentPay.length > 0) {
                payTimeline.innerHTML = recentPay.map(p => {
                    const dotClass = p.status === 'approved' ? 'bg-success' : p.status === 'denied' ? 'bg-danger' : 'bg-warning';
                    return `
                        <div class="timeline-item">
                            <div class="timeline-dot ${dotClass}"></div>
                            <div class="timeline-content">
                                <div class="timeline-title">${p.studentName || '-'}</div>
                                <div class="timeline-desc">Paid amount <strong>₹${(p.amount || 0).toLocaleString('en-IN')}</strong> (${p.status || 'pending'})</div>
                                <div class="timeline-time"><i class="far fa-clock"></i> ${p.date ? formatDate(p.date) : '-'}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                payTimeline.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;">No recent payments yet</div>';
            }
        }

        // Recent Enquiries (last 5) - pending first
        const recentEnq = [...enquiries].sort((a, b) => {
            if (!a.replied && b.replied) return -1;
            if (a.replied && !b.replied) return 1;
            return (b.id || 0) - (a.id || 0);
        }).slice(0, 5);
        const enqTbody = document.querySelector('#recentEnquiriesTable tbody');
        if (enqTbody) {
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
                renderEmptyState(enqTbody, 'envelope-open', 'No enquiries yet');
            }
        }

        // ===== 2. Analytics Charts Aggregations & Generation =====
        
        // 2a. Course distribution data
        const courseCounts = {};
        students.forEach(s => {
            if (s.course && s.status === 'Active') {
                courseCounts[s.course] = (courseCounts[s.course] || 0) + 1;
            }
        });
        const courseLabels = Object.keys(courseCounts);
        const courseData = Object.values(courseCounts);

        // 2b. Admissions and Revenue Trend over last 6 months
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const last6Months = [];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            last6Months.push({
                year: d.getFullYear(),
                month: d.getMonth(),
                label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`,
                admissions: 0,
                revenue: 0
            });
        }

        // Aggregate admissions by month
        students.forEach(s => {
            if (s.admissionDate) {
                const ad = new Date(s.admissionDate);
                if (!isNaN(ad.getTime())) {
                    const match = last6Months.find(m => m.year === ad.getFullYear() && m.month === ad.getMonth());
                    if (match) {
                        match.admissions++;
                    }
                }
            }
        });

        // Aggregate revenue (approved payments) by month
        payments.forEach(p => {
            if (p.status === 'approved' && p.date) {
                const pd = new Date(p.date);
                if (!isNaN(pd.getTime())) {
                    const match = last6Months.find(m => m.year === pd.getFullYear() && m.month === pd.getMonth());
                    if (match) {
                        match.revenue += parseFloat(p.amount || 0);
                    }
                }
            }
        });

        const trendLabels = last6Months.map(m => m.label);
        const admissionsTrendData = last6Months.map(m => m.admissions);
        const revenueTrendData = last6Months.map(m => m.revenue);

        // Render or update Admissions & Revenue Chart
        const trendCtx = document.getElementById('revenueAdmissionChart');
        if (trendCtx && typeof Chart !== 'undefined') {
            if (revenueAdmissionChartInstance) {
                revenueAdmissionChartInstance.destroy();
            }
            revenueAdmissionChartInstance = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: trendLabels,
                    datasets: [
                        {
                            label: 'Admissions',
                            data: admissionsTrendData,
                            borderColor: '#38f9d7',
                            backgroundColor: 'rgba(56, 249, 215, 0.1)',
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'yAdmissions'
                        },
                        {
                            label: 'Revenue (₹)',
                            data: revenueTrendData,
                            borderColor: '#fa709a',
                            backgroundColor: 'rgba(250, 112, 154, 0.1)',
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'yRevenue'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#fff', font: { family: 'Segoe UI', size: 11 } } },
                        tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.85)', titleColor: '#fff', bodyColor: '#fff', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }
                    },
                    scales: {
                        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } } },
                        yAdmissions: {
                            type: 'linear',
                            position: 'left',
                            title: { display: true, text: 'Admissions', color: '#38f9d7', font: { size: 10 } },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 }, stepSize: 1 }
                        },
                        yRevenue: {
                            type: 'linear',
                            position: 'right',
                            title: { display: true, text: 'Revenue (₹)', color: '#fa709a', font: { size: 10 } },
                            grid: { drawOnChartArea: false },
                            ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } }
                        }
                    }
                }
            });
        }

        // Render or update Course Distribution Doughnut Chart
        const courseCtx = document.getElementById('courseDistributionChart');
        if (courseCtx && typeof Chart !== 'undefined') {
            if (courseDistributionChartInstance) {
                courseDistributionChartInstance.destroy();
            }
            courseDistributionChartInstance = new Chart(courseCtx, {
                type: 'doughnut',
                data: {
                    labels: courseLabels.length ? courseLabels : ['No Students'],
                    datasets: [{
                        data: courseData.length ? courseData : [1],
                        backgroundColor: [
                            '#667eea', '#764ba2', '#fa709a', '#fee140', '#38f9d7', '#4facfe', '#fa5252', '#be4bdb'
                        ],
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: '#fff', font: { family: 'Segoe UI', size: 10 } } },
                        tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.85)', titleColor: '#fff', bodyColor: '#fff' }
                    },
                    cutout: '60%'
                }
            });
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
    const tbody = document.querySelector('#coursesTable tbody');
    renderLoadingSpinner(tbody, 'Loading courses...');
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        if (courses.length === 0) { renderEmptyState(tbody, 'book', 'No courses found. Click "Add Course" to create one.'); return; }
        let html = '';
        courses.forEach((c, index, arr) => {
            html += '<tr data-id="' + c.id + '">';
            html += '<td>' + c.name + '</td>';
            html += '<td>' + c.duration + '</td>';
            html += '<td>₹' + (c.fee || c.price || 0) + '</td>';
            html += '<td>' + (c.feeType || 'Per Program') + '</td>';
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
    } catch (err) { console.error(err); renderEmptyState(tbody, 'exclamation-circle', 'Error loading courses'); }
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
            document.getElementById('courseFee').value = course.fee || course.price || 0;
            document.getElementById('courseFeeType').value = course.feeType || 'Per Program';
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
        fee: parseInt(document.getElementById('courseFee').value),
        feeType: document.getElementById('courseFeeType').value,
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
    const fee = document.getElementById('courseFee').value;
    const btn = document.getElementById('aiWriteBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Writing...';
    try {
        const res = await fetch('/api/ai/course-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseName, duration, fee })
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
let allEnquiries = [];
let enquiriesCurrentPage = 1;
const enquiriesPerPage = 25;
let enquiriesFiltered = [];

async function loadEnquiriesTable() {
    const tbody = document.querySelector('#enquiriesTable tbody');
    renderLoadingSpinner(tbody, 'Loading enquiries...');
    try {
        allEnquiries = await fetch('/api/enquiries').then(r => r.json());
        enquiriesCurrentPage = 1;
        const searchEl = document.getElementById('enquirySearch');
        const statusEl = document.getElementById('enquiryStatusFilter');
        if (searchEl) searchEl.value = '';
        if (statusEl) statusEl.value = '';
        renderEnquiries(allEnquiries);
    } catch (err) { console.error(err); }
}

function filterEnquiries() {
    enquiriesCurrentPage = 1;
    const search = (document.getElementById('enquirySearch').value || '').toLowerCase();
    const status = document.getElementById('enquiryStatusFilter').value;
    let filtered = allEnquiries;
    if (status === 'pending') filtered = filtered.filter(e => !e.replied);
    if (status === 'replied') filtered = filtered.filter(e => e.replied);
    if (search) {
        filtered = filtered.filter(e =>
            (e.name && e.name.toLowerCase().includes(search)) ||
            (e.email && e.email.toLowerCase().includes(search)) ||
            (e.phone && e.phone.includes(search))
        );
    }
    renderEnquiries(filtered);
}

function renderEnquiries(enquiries) {
    enquiriesFiltered = enquiries;
    const tbody = document.querySelector('#enquiriesTable tbody');
    const paginationEl = document.getElementById('enquiriesPagination');
    if (enquiries.length === 0) {
        renderEmptyState(tbody, 'envelope-open', 'No enquiries found');
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }
    const totalPages = Math.ceil(enquiries.length / enquiriesPerPage);
    if (enquiriesCurrentPage > totalPages) enquiriesCurrentPage = 1;
    const startIdx = (enquiriesCurrentPage - 1) * enquiriesPerPage;
    const pageEnquiries = enquiries.slice(startIdx, startIdx + enquiriesPerPage);
    let html = '';
    pageEnquiries.forEach(e => {
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
    renderEnquiriesPagination(totalPages);
}

function renderEnquiriesPagination(totalPages) {
    const container = document.getElementById('enquiriesPagination');
    if (!container || totalPages <= 1) { if (container) container.innerHTML = ''; return; }
    let html = '';
    html += '<button class="pagination-btn" onclick="goToEnquiryPage(' + (enquiriesCurrentPage - 1) + ')" ' + (enquiriesCurrentPage === 1 ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
    const maxVisible = 7;
    let startPage = Math.max(1, enquiriesCurrentPage - 3);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
    if (startPage > 1) {
        html += '<button class="pagination-btn" onclick="goToEnquiryPage(1)">1</button>';
        if (startPage > 2) html += '<span class="pagination-ellipsis">...</span>';
    }
    for (let i = startPage; i <= endPage; i++) {
        html += '<button class="pagination-btn' + (i === enquiriesCurrentPage ? ' active"' : '"') + ' onclick="goToEnquiryPage(' + i + ')">' + i + '</button>';
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="pagination-ellipsis">...</span>';
        html += '<button class="pagination-btn" onclick="goToEnquiryPage(' + totalPages + ')">' + totalPages + '</button>';
    }
    html += '<button class="pagination-btn" onclick="goToEnquiryPage(' + (enquiriesCurrentPage + 1) + ')" ' + (enquiriesCurrentPage === totalPages ? 'disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
    html += '<span class="pagination-info">Page ' + enquiriesCurrentPage + ' of ' + totalPages + '</span>';
    container.innerHTML = html;
}

function goToEnquiryPage(page) {
    const totalPages = Math.ceil(enquiriesFiltered.length / enquiriesPerPage);
    if (page < 1 || page > totalPages) return;
    enquiriesCurrentPage = page;
    renderEnquiries(enquiriesFiltered);
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

// ===== Testimonials =====
let studentsList = [];
let alumniList = [];

async function loadStudentsList() {
    try {
        const res = await fetch('/api/students');
        const result = await res.json();
        studentsList = result.students || [];
    } catch (err) {
        console.error('Error loading students:', err);
        studentsList = [];
    }
}

async function loadAlumniList() {
    try {
        const res = await fetch('/api/alumni');
        const result = await res.json();
        alumniList = result.alumni || [];
    } catch (err) {
        console.error('Error loading alumni:', err);
        alumniList = [];
    }
}

function openAddTestimonialModal() {
    document.getElementById('editingTestimonialId').value = '';
    document.getElementById('testimonialModalTitle').innerHTML = '<i class="fas fa-star" style="color:#667eea;margin-right:8px;"></i> Add Testimonial';
    document.getElementById('saveTestimonialBtn').innerHTML = '<i class="fas fa-save"></i> Save Testimonial';
    
    document.getElementById('testimonialName').value = '';
    document.getElementById('testimonialPosition').value = '';
    document.getElementById('testimonialRating').value = '';
    document.getElementById('testimonialComment').value = '';
    document.getElementById('testimonialImage').value = '';
    document.getElementById('testimonialStudent').value = '';
    document.getElementById('testimonialAlumni').value = '';
    document.getElementById('testimonialPersonType').value = '';
    document.getElementById('testimonialPhotoUpload').value = '';
    document.getElementById('testimonialPhotoPreview').style.display = 'none';
    testimonialUploadedPhoto = null;
    
    document.getElementById('testimonialStudentSection').style.display = 'none';
    document.getElementById('testimonialAlumniSection').style.display = 'none';
    
    // Populate student dropdown
    const studentSelect = document.getElementById('testimonialStudent');
    studentSelect.innerHTML = '<option value="">Select a student (auto-fills name and photo)</option>';
    studentsList.forEach(student => {
        studentSelect.innerHTML += `<option value="${student.id}" data-name="${student.name}" data-photo="${student.photo || ''}">${student.name} (Roll: ${student.rollNo})</option>`;
    });
    
    // Populate alumni dropdown
    const alumniSelect = document.getElementById('testimonialAlumni');
    alumniSelect.innerHTML = '<option value="">Select an alumni (auto-fills name and photo)</option>';
    alumniList.forEach(alumnus => {
        alumniSelect.innerHTML += `<option value="${alumnus.id}" data-name="${alumnus.name}" data-photo="${alumnus.photo || ''}" data-position="${alumnus.designation || 'Alumni'}">${alumnus.name} (${alumnus.course || 'N/A'}, Batch: ${alumnus.batch || 'N/A'})</option>`;
    });
    
    document.getElementById('testimonialModal').classList.add('active');
}

async function editTestimonial(id) {
    try {
        const res = await fetch('/api/testimonials');
        const result = await res.json();
        const testimonials = result.testimonials || [];
        const testimonial = testimonials.find(t => t.id == id);
        
        if (!testimonial) {
            showNotification('Testimonial not found!', 'error');
            return;
        }
        
        document.getElementById('editingTestimonialId').value = testimonial.id;
        document.getElementById('testimonialModalTitle').innerHTML = '<i class="fas fa-edit" style="color:#667eea;margin-right:8px;"></i> Edit Testimonial';
        document.getElementById('saveTestimonialBtn').innerHTML = '<i class="fas fa-save"></i> Update Testimonial';
        
        document.getElementById('testimonialName').value = testimonial.name;
        document.getElementById('testimonialPosition').value = testimonial.position || '';
        document.getElementById('testimonialRating').value = testimonial.rating;
        document.getElementById('testimonialComment').value = testimonial.comment;
        document.getElementById('testimonialImage').value = testimonial.image || '';
        
        document.getElementById('testimonialStudent').value = testimonial.studentId || '';
        document.getElementById('testimonialAlumni').value = testimonial.alumniId || '';
        
        // Set person type based on studentId or alumniId
        if (testimonial.studentId) {
            document.getElementById('testimonialPersonType').value = 'student';
            document.getElementById('testimonialStudentSection').style.display = 'block';
            document.getElementById('testimonialAlumniSection').style.display = 'none';
        } else if (testimonial.alumniId) {
            document.getElementById('testimonialPersonType').value = 'alumni';
            document.getElementById('testimonialStudentSection').style.display = 'none';
            document.getElementById('testimonialAlumniSection').style.display = 'block';
        } else {
            document.getElementById('testimonialPersonType').value = 'manual';
            document.getElementById('testimonialStudentSection').style.display = 'none';
            document.getElementById('testimonialAlumniSection').style.display = 'none';
        }
        
        document.getElementById('testimonialPhotoUpload').value = '';
        if (testimonial.image) {
            document.getElementById('testimonialPreviewImg').src = testimonial.image;
            document.getElementById('testimonialPhotoPreview').style.display = 'flex';
        } else {
            document.getElementById('testimonialPhotoPreview').style.display = 'none';
        }
        testimonialUploadedPhoto = null;
        
        // Populate student dropdown
        const studentSelect = document.getElementById('testimonialStudent');
        studentSelect.innerHTML = '<option value="">Select a student (auto-fills name and photo)</option>';
        studentsList.forEach(student => {
            studentSelect.innerHTML += `<option value="${student.id}" data-name="${student.name}" data-photo="${student.photo || ''}" ${student.id == testimonial.studentId ? 'selected' : ''}>${student.name} (Roll: ${student.rollNo})</option>`;
        });
        
        // Populate alumni dropdown
        const alumniSelect = document.getElementById('testimonialAlumni');
        alumniSelect.innerHTML = '<option value="">Select an alumni (auto-fills name and photo)</option>';
        alumniList.forEach(alumnus => {
            alumniSelect.innerHTML += `<option value="${alumnus.id}" data-name="${alumnus.name}" data-photo="${alumnus.photo || ''}" data-position="${alumnus.designation || 'Alumni'}" ${alumnus.id == testimonial.alumniId ? 'selected' : ''}>${alumnus.name} (${alumnus.course || 'N/A'}, Batch: ${alumnus.batch || 'N/A'})</option>`;
        });
        
        document.getElementById('testimonialModal').classList.add('active');
    } catch (err) {
        console.error('Error loading testimonial:', err);
        showNotification('Error loading testimonial!', 'error');
    }
}

function handleTestimonialPersonTypeChange() {
    const type = document.getElementById('testimonialPersonType').value;
    document.getElementById('testimonialStudentSection').style.display = type === 'student' ? 'block' : 'none';
    document.getElementById('testimonialAlumniSection').style.display = type === 'alumni' ? 'block' : 'none';
    
    // Clear selections when type changes
    document.getElementById('testimonialStudent').value = '';
    document.getElementById('testimonialAlumni').value = '';
}

function handleTestimonialStudentChange() {
    const studentSelect = document.getElementById('testimonialStudent');
    const selectedOption = studentSelect.options[studentSelect.selectedIndex];
    
    if (selectedOption.value) {
        document.getElementById('testimonialName').value = selectedOption.dataset.name || '';
        document.getElementById('testimonialPosition').value = 'Student';
        document.getElementById('testimonialImage').value = selectedOption.dataset.photo || '';
    }
}

function handleTestimonialAlumniChange() {
    const alumniSelect = document.getElementById('testimonialAlumni');
    const selectedOption = alumniSelect.options[alumniSelect.selectedIndex];
    
    if (selectedOption.value) {
        document.getElementById('testimonialName').value = selectedOption.dataset.name || '';
        document.getElementById('testimonialPosition').value = selectedOption.dataset.position || 'Alumni';
        document.getElementById('testimonialImage').value = selectedOption.dataset.photo || '';
    }
}

let testimonialUploadedPhoto = null;

// Setup dropzone click handler
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const dropzone = document.getElementById('testimonialPhotoDropzone');
        if (dropzone) {
            dropzone.addEventListener('click', function() {
                document.getElementById('testimonialPhotoUpload').click();
            });
            
            // Drag and drop handlers
            dropzone.addEventListener('dragover', function(e) {
                e.preventDefault();
                dropzone.style.borderColor = 'rgba(102, 126, 234, 0.8)';
                dropzone.style.background = 'rgba(102, 126, 234, 0.1)';
            });
            
            dropzone.addEventListener('dragleave', function(e) {
                e.preventDefault();
                dropzone.style.borderColor = 'rgba(255,255,255,0.3)';
                dropzone.style.background = 'rgba(255,255,255,0.05)';
            });
            
            dropzone.addEventListener('drop', function(e) {
                e.preventDefault();
                dropzone.style.borderColor = 'rgba(255,255,255,0.3)';
                dropzone.style.background = 'rgba(255,255,255,0.05)';
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    document.getElementById('testimonialPhotoUpload').files = files;
                    handleTestimonialPhotoUpload();
                }
            });
        }
    }, 100);
});

function handleTestimonialPhotoUpload() {
    const fileInput = document.getElementById('testimonialPhotoUpload');
    const file = fileInput.files[0];
    
    if (file) {
        // Check file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            showNotification('Image size too large. Maximum size is 5MB.', 'error');
            fileInput.value = '';
            return;
        }
        
        // Check if file is HEIC format
        const isHEIC = file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic');
        
        if (isHEIC) {
            // HEIC not supported directly, need to convert
            showNotification('HEIC format not supported. Please use JPG or PNG.', 'error');
            fileInput.value = '';
            return;
        }
        
        // Compress and convert image
        compressImage(file, 800, 800, 0.7).then(compressedDataUrl => {
            testimonialUploadedPhoto = compressedDataUrl;
            document.getElementById('testimonialImage').value = compressedDataUrl;
            document.getElementById('testimonialPreviewImg').src = compressedDataUrl;
            document.getElementById('testimonialPhotoPreview').style.display = 'flex';
        }).catch(err => {
            console.error('Error compressing image:', err);
            // Fallback to original if compression fails
            const reader = new FileReader();
            reader.onload = function(e) {
                testimonialUploadedPhoto = e.target.result;
                document.getElementById('testimonialImage').value = testimonialUploadedPhoto;
                document.getElementById('testimonialPreviewImg').src = testimonialUploadedPhoto;
                document.getElementById('testimonialPhotoPreview').style.display = 'flex';
            };
            reader.readAsDataURL(file);
        });
    }
}

function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calculate new dimensions
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to JPEG with compression
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function clearTestimonialPhoto() {
    document.getElementById('testimonialPhotoUpload').value = '';
    document.getElementById('testimonialImage').value = '';
    testimonialUploadedPhoto = null;
    document.getElementById('testimonialPhotoPreview').style.display = 'none';
}

async function saveTestimonial() {
    const editingId = document.getElementById('editingTestimonialId').value;
    const personType = document.getElementById('testimonialPersonType').value;
    const studentId = document.getElementById('testimonialStudent').value;
    const alumniId = document.getElementById('testimonialAlumni').value;
    const name = document.getElementById('testimonialName').value;
    const position = document.getElementById('testimonialPosition').value;
    const rating = document.getElementById('testimonialRating').value;
    const comment = document.getElementById('testimonialComment').value;
    const image = document.getElementById('testimonialImage').value;

    if (!name || !rating || !comment) {
        showNotification('Name, rating, and comment are required!', 'error');
        return;
    }

    try {
        const url = editingId ? `/api/testimonials/${editingId}` : '/api/testimonials';
        const method = editingId ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, position, rating, comment, image, studentId, alumniId })
        });
        const result = await res.json();
        if (result.success) {
            closeModal('testimonialModal');
            loadTestimonialsTable();
            showNotification(editingId ? 'Testimonial updated successfully!' : 'Testimonial added successfully!', 'success');
        } else {
            showNotification(result.message || 'Error saving testimonial!', 'error');
        }
    } catch (err) {
        console.error('Error saving testimonial:', err);
        showNotification('Error saving testimonial!', 'error');
    }
}

async function loadTestimonialsTable() {
    const tbody = document.querySelector('#testimonialsTable tbody');
    renderLoadingSpinner(tbody, 'Loading testimonials...');
    try {
        const res = await fetch('/api/testimonials');
        const result = await res.json();
        const testimonials = result.testimonials || [];
        
        if (testimonials.length === 0) {
            renderEmptyState(tbody, 'quote-right', 'No testimonials found');
            return;
        }

        tbody.innerHTML = testimonials.map(t => `
            <tr>
                <td><input type="checkbox" class="testimonial-checkbox" data-id="${t.id}"></td>
                <td>${t.name}</td>
                <td>${t.position || '-'}</td>
                <td>${'⭐'.repeat(t.rating)}</td>
                <td>${t.comment.substring(0, 100)}${t.comment.length > 100 ? '...' : ''}</td>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-primary" onclick="editTestimonial(${t.id})" style="padding:6px 12px;font-size:12px;margin-right:5px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger" onclick="deleteTestimonial(${t.id})" style="padding:6px 12px;font-size:12px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Error loading testimonials:', err);
        showNotification('Error loading testimonials!', 'error');
    }
}

async function deleteTestimonial(id) {
    if (!confirm('Delete this testimonial?')) return;
    try {
        const res = await fetch(`/api/testimonials/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            loadTestimonialsTable();
            showNotification('Testimonial deleted!', 'success');
        } else {
            showNotification(result.message || 'Error deleting testimonial!', 'error');
        }
    } catch (err) {
        console.error('Error deleting testimonial:', err);
        showNotification('Error deleting testimonial!', 'error');
    }
}

function toggleAllTestimonialCheckboxes() {
    const selectAll = document.getElementById('selectAllTestimonials');
    const checkboxes = document.querySelectorAll('.testimonial-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

async function deleteSelectedTestimonials() {
    const checkboxes = document.querySelectorAll('.testimonial-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Select testimonials to delete!', 'error');
        return;
    }

    if (!confirm(`Delete ${checkboxes.length} selected testimonial(s)?`)) return;

    const testimonialIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    let deletedCount = 0;

    for (const id of testimonialIds) {
        try {
            const res = await fetch(`/api/testimonials/${id}`, { method: 'DELETE' });
            if ((await res.json()).success) deletedCount++;
        } catch (e) {
            console.error('Error deleting testimonial:', e);
        }
    }

    if (deletedCount === testimonialIds.length) {
        showNotification(`${deletedCount} testimonial(s) deleted successfully!`, 'success');
    } else {
        showNotification(`${deletedCount}/${testimonialIds.length} testimonial(s) deleted`, 'warning');
    }

    document.getElementById('selectAllTestimonials').checked = false;
    loadTestimonialsTable();
}

// ===== Faculty =====
async function openFacultyModal() {
    document.getElementById('facultyForm').reset();
    document.getElementById('facultyModal').classList.add('active');
    
    // Load roles dynamically (excluding Super Admin)
    try {
        const res = await fetch('/api/roles');
        const roles = await res.json();
        const roleSelect = document.getElementById('facultyRole');
        
        // Keep default options and add custom roles
        roleSelect.innerHTML = `
            <option value="Faculty">Faculty</option>
            <option value="Admin">Admin</option>
            <option value="Staff">Staff</option>
        `;
        
        // Add custom roles (excluding Super Admin)
        roles.forEach(role => {
            if (role.name !== 'Super Admin') {
                roleSelect.innerHTML += `<option value="${role.name}">${role.name}</option>`;
            }
        });
    } catch (e) {
        console.error('Error loading roles:', e);
    }
}

document.getElementById('facultyForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const facultyId = document.getElementById('facultyId').value;
    const data = {
        name: document.getElementById('facultyName').value,
        email: document.getElementById('facultyEmail').value,
        subject: document.getElementById('facultySubject').value,
        experience: document.getElementById('facultyExperience').value,
        role: document.getElementById('facultyRole').value,
        permissions: getSelectedPermissions()
    };

    try {
        let res, result;
        if (facultyId) {
            // Update existing faculty
            res = await fetch('/api/faculty/' + facultyId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            result = await res.json();
            showNotification(result.message || 'Faculty updated!', 'success');
        } else {
            // Create new faculty
            res = await fetch('/api/faculty', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            result = await res.json();
            showNotification(result.message || 'Faculty added!', 'success');
        }

        closeModal('facultyModal');
        loadFacultyTable();
        loadDashboard();
    } catch (err) {
        showNotification(facultyId ? 'Error updating faculty!' : 'Error adding faculty!', 'error');
    }
});

async function deleteFaculty(id) {
    if (!confirm('Delete this faculty?')) return;
    try {
        await fetch('/api/faculty/' + id, { method: 'DELETE' });
        loadFacultyTable();
        showNotification('Faculty deleted!', 'success');
    } catch (err) { showNotification('Error!', 'error'); }
}

async function openFacultyEditModal(id) {
    try {
        const res = await fetch('/api/faculty/' + id);
        const faculty = await res.json();

        document.getElementById('facultyId').value = faculty.id;
        document.getElementById('facultyName').value = faculty.name || '';
        document.getElementById('facultySubject').value = faculty.subject || '';
        document.getElementById('facultyExperience').value = faculty.experience || '';
        document.getElementById('facultyEmail').value = faculty.email || '';
        document.getElementById('facultyRole').value = faculty.role || 'Faculty';

        // Load permissions
        deselectAllPermissions();
        const permissions = faculty.permissions || [];
        permissions.forEach(perm => {
            const checkbox = document.querySelector(`.faculty-permission[value="${perm}"]`);
            if (checkbox) checkbox.checked = true;
        });

        document.getElementById('facultyModalTitle').textContent = 'Edit Faculty';
        document.getElementById('facultySaveBtn').textContent = 'Update Faculty';

        document.getElementById('facultyModal').classList.add('active');
    } catch (err) {
        console.error('Error loading faculty:', err);
        showNotification('Error loading faculty data!', 'error');
    }
}

function openFacultyModal() {
    document.getElementById('facultyForm').reset();
    document.getElementById('facultyId').value = '';
    document.getElementById('facultyModalTitle').textContent = 'Add Faculty';
    document.getElementById('facultySaveBtn').textContent = 'Save Faculty';
    deselectAllPermissions();
    document.getElementById('facultyModal').classList.add('active');
}

function getSelectedPermissions() {
    const checkboxes = document.querySelectorAll('.faculty-permission:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function selectAllPermissions() {
    document.querySelectorAll('.faculty-permission').forEach(cb => cb.checked = true);
}

function deselectAllPermissions() {
    document.querySelectorAll('.faculty-permission').forEach(cb => cb.checked = false);
}

function applyRolePreset() {
    const role = document.getElementById('facultyRole').value;
    deselectAllPermissions();

    const presets = {
        Faculty: ['students', 'courses', 'batches', 'materials', 'results', 'online-exam', 'test'],
        Staff: ['enquiries', 'attendance', 'materials', 'notices', 'admissions'],
        Admin: ['all']
    };

    if (role === 'Admin') {
        selectAllPermissions();
    } else {
        const permissions = presets[role] || [];
        permissions.forEach(perm => {
            const checkbox = document.querySelector(`.faculty-permission[value="${perm}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }
}

async function toggleFacultyAdmissionAccess(id, currentState) {
    const newState = !currentState;
    try {
        const res = await fetch(`/api/faculty/${id}/admission-access`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ canSubmitAdmission: newState })
        });
        const data = await res.json();
        if (data.success) {
            loadFacultyTable();
            showNotification(`Admission access ${newState ? 'enabled' : 'disabled'} for ${data.faculty.name}`, 'success');
        } else {
            showNotification(data.message || 'Failed to toggle access', 'error');
        }
    } catch (err) {
        showNotification('Error toggling admission access', 'error');
    }
}

async function toggleFacultyBlogAccess(id, currentState) {
    const newState = !currentState;
    try {
        const res = await fetch(`/api/faculty/${id}/blog-access`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ canWriteBlogs: newState })
        });
        const data = await res.json();
        if (data.success) {
            loadFacultyTable();
            showNotification(`Blog access ${newState ? 'enabled' : 'disabled'} for ${data.faculty.name}`, 'success');
        } else {
            showNotification(data.message || 'Failed to toggle access', 'error');
        }
    } catch (err) {
        showNotification('Error toggling blog access', 'error');
    }
}

async function toggleFacultyEntranceManagementAccess(id, currentState) {
    const newState = !currentState;
    try {
        const res = await fetch(`/api/faculty/${id}/entrance-management-access`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ canManageEntranceExam: newState })
        });
        const data = await res.json();
        if (data.success) {
            loadFacultyTable();
            showNotification(`Entrance exam access ${newState ? 'enabled' : 'disabled'} for ${data.faculty.name}`, 'success');
        } else {
            showNotification(data.message || 'Failed to toggle access', 'error');
        }
    } catch (err) {
        showNotification('Error toggling entrance exam access', 'error');
    }
}

async function loadFacultyTable() {
    const tbody = document.querySelector('#facultyTable tbody');
    if (!tbody) return;
    renderLoadingSpinner(tbody, 'Loading faculty...');
    try {
        const faculty = await fetch('/api/faculty').then(r => r.json());

        if (faculty.length === 0) {
            renderEmptyState(tbody, 'chalkboard-teacher', 'No faculty members yet. Click "Add Faculty" to create one.');
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
            const permCount = (f.permissions && f.permissions.length) ? f.permissions.length : 0;
            html += '<td><span style="background:#3b82f6;color:#fff;padding:4px 10px;border-radius:12px;font-size:12px;">' + permCount + ' permissions</span></td>';
            html += '<td>';
            html += '<button class="action-btn edit-btn" onclick="openFacultyEditModal(' + f.id + ')"><i class="fas fa-edit"></i></button>';
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
    const tbody = document.querySelector('#galleryTable tbody');
    renderLoadingSpinner(tbody, 'Loading gallery...');
    try {
        const gallery = await fetch('/api/gallery').then(r => r.json());
        let html = '';
        gallery.forEach(item => {
            const categoryColors = {
                events: '#3b82f6',
                campus: '#16a34a',
                students: '#f59e0b',
                awards: '#8b5cf6',
                facilities: '#06b6d4'
            };
            const categoryColor = categoryColors[item.category] || '#64748b';
            html += '<tr>';
            html += '<td><input type="checkbox" class="gallery-checkbox" data-id="' + item.id + '"></td>';
            html += '<td><img src="' + item.image + '" alt="' + item.title + '" style="width:100px;height:60px;object-fit:cover;"></td>';
            html += '<td>' + item.title + '</td>';
            html += '<td><span style="background:' + categoryColor + ';color:#fff;padding:4px 10px;border-radius:12px;font-size:12px;text-transform:capitalize;">' + (item.category || 'General') + '</span></td>';
            html += '<td>';
            html += '<button class="btn" onclick="editGalleryItem(' + item.id + ')"><i class="fas fa-edit"></i></button>';
            html += '<button class="btn delete-btn" onclick="deleteGalleryItem(\'' + item.id + '\')"><i class="fas fa-trash"></i></button>';
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
    galleryEditId = null;
    document.getElementById('galleryPreviewImg').style.display = 'none';
    document.getElementById('galleryPlaceholder').style.display = 'block';
    document.getElementById('galleryFile').value = '';
    document.getElementById('galleryModal').querySelector('h3').textContent = 'Add Gallery Item';
    document.getElementById('galleryModal').classList.add('active');
}

async function editGalleryItem(id) {
    try {
        const gallery = await fetch('/api/gallery').then(r => r.json());
        const item = gallery.find(g => g.id == id);
        if (!item) {
            showNotification('Gallery item not found!', 'error');
            return;
        }

        document.getElementById('galleryTitle').value = item.title;
        document.getElementById('galleryCategory').value = item.category || '';
        galleryEditId = id;
        galleryImageFile = null;

        document.getElementById('galleryPreviewImg').src = item.image;
        document.getElementById('galleryPreviewImg').style.display = 'block';
        document.getElementById('galleryPlaceholder').style.display = 'none';
        document.getElementById('galleryFile').value = '';

        document.getElementById('galleryModal').querySelector('h3').textContent = 'Edit Gallery Item';
        document.getElementById('galleryModal').classList.add('active');
    } catch (err) {
        showNotification('Error loading gallery item!', 'error');
        console.error(err);
    }
}

async function saveGalleryItem() {
    const title = document.getElementById('galleryTitle').value.trim();
    const category = document.getElementById('galleryCategory').value;
    if (!title) { showNotification('Please enter a title!', 'error'); return; }
    if (!category) { showNotification('Please select a category!', 'error'); return; }

    try {
        let res, data;
        if (galleryEditId) {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('category', category);
            if (galleryImageFile) {
                formData.append('image', galleryImageFile);
            }
            res = await fetch('/api/gallery/' + galleryEditId, { method: 'PUT', body: formData });
            data = await res.json();
            if (data.success) {
                closeModal('galleryModal');
                loadGalleryTable();
                loadDashboard();
                showNotification('Gallery item updated!', 'success');
            } else {
                showNotification(data.message || 'Update failed!', 'error');
            }
        } else {
            if (!galleryImageFile) { showNotification('Please select an image!', 'error'); return; }
            const formData = new FormData();
            formData.append('title', title);
            formData.append('category', category);
            formData.append('image', galleryImageFile);
            res = await fetch('/api/gallery', { method: 'POST', body: formData });
            data = await res.json();
            if (data.success) {
                closeModal('galleryModal');
                loadGalleryTable();
                loadDashboard();
                showNotification('Gallery item added!', 'success');
            } else {
                showNotification(data.message || 'Upload failed!', 'error');
            }
        }
    } catch (err) {
        console.error('Error saving gallery item:', err);
        showNotification('Error saving gallery item!', 'error');
    }
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
    const tbody = document.querySelector('#noticesTable tbody');
    renderLoadingSpinner(tbody, 'Loading notices...');
    try {
        const notices = await fetch('/api/notices').then(r => r.json());
        if (notices.length === 0) {
            renderEmptyState(tbody, 'bullhorn', 'No notices found. Click "Add Notice" to create one.');
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
    const tbody = document.querySelector('#batchesTable tbody');
    renderLoadingSpinner(tbody, 'Loading batches...');
    try {
        const data = await fetch('/api/batches/seats').then(r => r.json());
        if (!data.length) { renderEmptyState(tbody, 'layer-group', 'No batches found. Click "Create Batch" to add one.'); return; }
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
            html += '<button class="action-btn edit-btn" onclick="viewBatchStudents(' + b.id + ', \'' + b.name + '\')" title="View Students"><i class="fas fa-users"></i></button>';
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

async function viewBatchStudents(batchId, batchName) {
    // Navigate to students page
    document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-page="students"]').classList.add('active');
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-students').classList.remove('hidden');
    if (typeof updateHeaderForPage === 'function') updateHeaderForPage('students');
    if (typeof updateHeaderToolbar === 'function') updateHeaderToolbar(document.getElementById('page-students'));
    
    // Load students table
    await loadStudentsTable();
    
    // Set batch filter to the selected batch
    const batchFilter = document.getElementById('studentBatchFilter');
    if (batchFilter) {
        batchFilter.value = batchId;
        filterStudentsByBatch();
    }
    
    showNotification('Showing students for ' + batchName, 'success');
}

// ===== Announcements =====
async function loadAnnouncementsTable() {
    const tbody = document.getElementById('announcementsTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading announcements...');
    try {
        const res = await fetch('/api/announcements');
        const data = await res.json();
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
    const tbody = document.getElementById('testsTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading tests...');
    try {
        const res = await fetch('/api/tests');
        const data = await res.json();
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
    handleTestTargetChange();
    document.getElementById('testModal').classList.add('active');
}

function handleTestTargetChange() {
    const target = document.getElementById('testTarget').value;
    const courseSection = document.getElementById('testCourseSection');
    const batchSection = document.getElementById('testBatchSection');

    courseSection.style.display = target === 'course' ? 'block' : 'none';
    batchSection.style.display = target === 'batch' ? 'block' : 'none';
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
    html += '<div class="question-field" id="question-' + questionId + '" style="background: rgba(255,255,255,0.08); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; margin-bottom: 15px; padding: 18px;">';
    html += '<div style="display: flex; justify-content: space-between; margin-bottom: 15px; align-items: center;">';
    html += '<h5 style="margin: 0; color: #fff; font-size: 16px; font-weight: 600;">Question ' + (questionId + 1) + '</h5>';
    html += '<button type="button" class="btn" onclick="removeQuestion(' + questionId + ')" style="padding: 6px 12px; font-size: 12px; background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4); color: #fff; border-radius: 6px;"><i class="fas fa-times"></i></button>';
    html += '</div>';
    html += '<div style="margin-bottom: 12px;"><label style="font-weight: 600; color: #fff; margin-bottom: 6px; display: block;">Question *</label><input type="text" class="question-text" placeholder="Enter question..." required style="width: 100%; height: 45px; padding: 0 12px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; font-size: 14px; color: #fff;"></div>';
    html += '<div style="margin-bottom: 12px;"><label style="font-weight: 600; color: #fff; margin-bottom: 6px; display: block;">Question Type</label>';
    html += '<select class="question-type" onchange="updateQuestionOptions(' + questionId + ', this.value)" style="width: 100%; height: 45px; padding: 0 12px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; font-size: 14px; color: #fff;">';
    html += '<option value="mcq-single">Multiple Choice (Single)</option>';
    html += '<option value="mcq-multiple">Multiple Choice (Multiple)</option>';
    html += '<option value="true-false">True/False</option>';
    html += '<option value="short-answer">Short Answer</option>';
    html += '</select>';
    html += '</div>';
    html += '<div style="margin-bottom: 12px;"><label style="font-weight: 600; color: #fff; margin-bottom: 6px; display: block;">Marks</label><input type="number" class="question-marks" value="1" min="1" style="width: 100%; height: 45px; padding: 0 12px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; font-size: 14px; color: #fff;"></div>';
    html += '<div class="question-options" id="options-' + questionId + '">';
    html += '<div style="margin-bottom: 10px;"><label style="font-weight: 600; color: #fff; margin-bottom: 6px; display: block;">Option A</label><input type="text" class="option-text" placeholder="Option A" style="width: 100%; height: 40px; padding: 0 12px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; font-size: 14px; color: #fff;"></div>';
    html += '<div style="margin-bottom: 10px;"><label style="font-weight: 600; color: #fff; margin-bottom: 6px; display: block;">Option B</label><input type="text" class="option-text" placeholder="Option B" style="width: 100%; height: 40px; padding: 0 12px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; font-size: 14px; color: #fff;"></div>';
    html += '<div style="margin-bottom: 10px;"><label style="font-weight: 600; color: #fff; margin-bottom: 6px; display: block;">Option C</label><input type="text" class="option-text" placeholder="Option C" style="width: 100%; height: 40px; padding: 0 12px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; font-size: 14px; color: #fff;"></div>';
    html += '<div style="margin-bottom: 10px;"><label style="font-weight: 600; color: #fff; margin-bottom: 6px; display: block;">Option D</label><input type="text" class="option-text" placeholder="Option D" style="width: 100%; height: 40px; padding: 0 12px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; font-size: 14px; color: #fff;"></div>';
    html += '<div style="margin-bottom: 10px;"><label style="font-weight: 600; color: #fff; margin-bottom: 6px; display: block;">Correct Answer</label>';
    html += '<select class="correct-answer" style="width: 100%; height: 40px; padding: 0 12px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; font-size: 14px; color: #fff;">';
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
let revenueReportData = [];

async function loadRevenueReport() {
    const tbody = document.querySelector('#revenueTable tbody');
    const summaryEl = document.getElementById('revenueSummary');
    const dateFrom = document.getElementById('revenueDateFrom').value;
    const dateTo = document.getElementById('revenueDateTo').value;
    const modeFilter = (document.getElementById('revenueModeFilter').value || '').toLowerCase();

    renderLoadingSpinner(tbody, 'Loading revenue...');

    try {
        const [paymentsRes, studentsRes] = await Promise.all([
            fetch('/api/payments'),
            fetch('/api/students')
        ]);
        const paymentsData = await paymentsRes.json();
        const studentsData = await studentsRes.json().catch(() => []);
        const students = Array.isArray(studentsData) ? studentsData : (studentsData.data || []);
        const studentMap = {};
        students.forEach(s => { studentMap[s.id] = s; });

        let payments = (paymentsData.payments || []).filter(p => p.status === 'approved');

        if (dateFrom) {
            payments = payments.filter(p => {
                const pd = new Date(p.date);
                return !isNaN(pd.getTime()) && pd >= new Date(dateFrom + 'T00:00:00');
            });
        }
        if (dateTo) {
            payments = payments.filter(p => {
                const pd = new Date(p.date);
                return !isNaN(pd.getTime()) && pd <= new Date(dateTo + 'T23:59:59');
            });
        }
        if (modeFilter) {
            payments = payments.filter(p => (p.mode || '').toLowerCase() === modeFilter);
        }

        payments.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        revenueReportData = payments;

        const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const modeBreakdown = {};
        payments.forEach(p => {
            const mode = (p.mode || 'other').toLowerCase();
            if (!modeBreakdown[mode]) modeBreakdown[mode] = { total: 0, count: 0 };
            modeBreakdown[mode].total += parseFloat(p.amount || 0);
            modeBreakdown[mode].count++;
        });

        const modeConfig = [
            { key: 'cash', label: 'Cash', icon: 'fa-money-bill-wave', gradient: 'rgba(22,163,74,0.2),rgba(34,197,94,0.15)', border: 'rgba(22,163,74,0.3)', color: '#4ade80' },
            { key: 'upi', label: 'UPI', icon: 'fa-mobile-alt', gradient: 'rgba(99,102,241,0.2),rgba(139,92,246,0.15)', border: 'rgba(99,102,241,0.3)', color: '#a78bfa' }
        ];

        let summaryHtml = `
            <div style="flex:1;min-width:200px;padding:16px 20px;border-radius:12px;background:linear-gradient(135deg,rgba(102,126,234,0.25),rgba(118,75,162,0.2));border:1px solid rgba(102,126,234,0.4);">
                <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:4px;"><i class="fas fa-wallet" style="margin-right:4px;"></i> Total Revenue</div>
                <div style="font-size:1.6rem;font-weight:700;color:#fff;">₹${totalRevenue.toLocaleString('en-IN')}</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:4px;">${payments.length} transaction(s)</div>
            </div>
        `;

        modeConfig.forEach(m => {
            const data = modeBreakdown[m.key];
            if (data) {
                summaryHtml += `
                    <div style="flex:1;min-width:150px;padding:14px 18px;border-radius:12px;background:linear-gradient(135deg,${m.gradient});border:1px solid ${m.border};cursor:pointer;" onclick="filterRevenueByMode('${m.key}')">
                        <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:4px;"><i class="fas ${m.icon}" style="margin-right:4px;"></i> ${m.label}</div>
                        <div style="font-size:1.3rem;font-weight:700;color:${m.color};">₹${data.total.toLocaleString('en-IN')}</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:3px;">${data.count} payment(s)</div>
                    </div>
                `;
            }
        });

        const otherModes = Object.keys(modeBreakdown).filter(k => !modeConfig.find(m => m.key === k));
        if (otherModes.length > 0) {
            const otherTotal = otherModes.reduce((sum, k) => sum + modeBreakdown[k].total, 0);
            const otherCount = otherModes.reduce((sum, k) => sum + modeBreakdown[k].count, 0);
            summaryHtml += `
                <div style="flex:1;min-width:150px;padding:14px 18px;border-radius:12px;background:linear-gradient(135deg,rgba(100,116,139,0.2),rgba(148,163,184,0.15));border:1px solid rgba(100,116,139,0.3);">
                    <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:4px;"><i class="fas fa-coins" style="margin-right:4px;"></i> Other</div>
                    <div style="font-size:1.3rem;font-weight:700;color:#94a3b8;">₹${otherTotal.toLocaleString('en-IN')}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:3px;">${otherCount} payment(s)</div>
                </div>
            `;
        }

        summaryEl.innerHTML = summaryHtml;

        if (payments.length === 0) {
            renderEmptyState(tbody, 'chart-line', 'No revenue data found for selected filters');
            return;
        }

        tbody.innerHTML = payments.map(p => {
            const student = studentMap[p.studentId] || {};
            const modeDisplay = (p.mode || '—').toString().toUpperCase();
            const txnId = p.utrNo || p.transactionId || '—';
            const statusBadge = (p.status || 'approved').toLowerCase() === 'approved'
                ? '<span style="background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">Approved</span>'
                : '<span style="background:#e2e8f0;color:#64748b;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">' + (p.status || '—') + '</span>';
            return '<tr>' +
                '<td style="white-space:nowrap;">' + (p.date ? formatDate(p.date) : '—') + '</td>' +
                '<td><strong>' + (p.studentName || student.name || '—') + '</strong></td>' +
                '<td>' + (student.course || '—') + '</td>' +
                '<td><strong>₹' + parseFloat(p.amount || 0).toLocaleString('en-IN') + '</strong></td>' +
                '<td>' + modeDisplay + '</td>' +
                '<td><code style="font-size:12px;">' + txnId + '</code></td>' +
                '<td>' + statusBadge + '</td>' +
                '</tr>';
        }).join('');
    } catch (err) {
        console.error('Error loading revenue report:', err);
        renderEmptyState(tbody, 'exclamation-circle', 'Error loading revenue data');
    }
}

function clearRevenueFilter() {
    document.getElementById('revenueDateFrom').value = '';
    document.getElementById('revenueDateTo').value = '';
    document.getElementById('revenueModeFilter').value = '';
    document.getElementById('revenueSummary').innerHTML = '';
    document.querySelector('#revenueTable tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8;">Select a date range and click Filter to view revenue</td></tr>';
    revenueReportData = [];
}

function filterRevenueByMode(mode) {
    document.getElementById('revenueModeFilter').value = mode;
    loadRevenueReport();
}

async function exportRevenueReport() {
    if (revenueReportData.length === 0) {
        showNotification('No revenue data to export! Click Filter first.', 'error');
        return;
    }
    const headers = ['Date', 'Student', 'Course', 'Amount', 'Mode', 'UTR/Txn ID', 'Status'];
    const rows = revenueReportData.map(p => [
        p.date ? formatDate(p.date) : '—',
        p.studentName || '—',
        '—',
        p.amount || 0,
        (p.mode || '—').toUpperCase(),
        p.utrNo || p.transactionId || '—',
        p.status || '—'
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'revenue_report_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
    showNotification('Revenue report exported!', 'success');
}

async function loadFeesTable() {
    const tbody = document.getElementById('feesTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading fees...');
    try {
        const res = await fetch('/api/students');
        const students = await res.json();
        
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
                html += '<button class="btn btn-info" onclick="viewStudentPaymentHistory(\'' + s.id + '\')" style="padding:4px 8px;font-size:12px;margin-left:5px;">View History</button>';
                html += '</td>';
                html += '</tr>';
            });
            tbody.innerHTML = html;
        }
    } catch (e) {
        console.error('Error loading fees:', e);
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

async function viewStudentPaymentHistory(studentId) {
    try {
        const res = await fetch('/api/students/' + studentId);
        const data = await res.json();
        
        // Handle both response formats: direct student object or wrapped in { success, student }
        const student = data.student || data;
        
        if (student && student.id) {
            const fees = student.fees || { totalFees: 0, paidAmount: 0, dueAmount: 0, payments: [] };
            
            // Combine payments from student.fees.payments and payments.json
            const studentFeePayments = fees.payments || [];
            const payRes = await fetch('/api/payments');
            const payData = await payRes.json();
            
            let allPayments = [];
            
            // Add payments from student.fees.payments (includes admission fee)
            if (studentFeePayments.length > 0) {
                allPayments = allPayments.concat(studentFeePayments.map(p => ({
                    ...p,
                    status: p.status || 'approved',
                    utr: p.utr || p.utrNumber || p.transactionId || p.receipt || '-',
                    utrNo: p.utrNo || p.utrNumber || p.transactionId || p.utr || '-',
                    studentReceipt: p.studentReceipt || p.receipt || '-'
                })));
            }
            
            // Add payments from payments.json
            if (payData.success && payData.payments) {
                const paymentsFromJson = payData.payments.filter(p => String(p.studentId) === String(student.id));
                allPayments = allPayments.concat(paymentsFromJson.map(p => ({
                    ...p,
                    utr: p.utr || p.transactionId || p.receipt || '-',
                    utrNo: p.utrNo || p.utr || p.transactionId || '-',
                    studentReceipt: p.studentReceipt || p.receipt || '-'
                })));
            }
            
            // Remove duplicates based on payment id
            const uniquePayments = [];
            const paymentIds = new Set();
            allPayments.forEach(p => {
                if (p.id && !paymentIds.has(String(p.id))) {
                    paymentIds.add(String(p.id));
                    uniquePayments.push(p);
                }
            });
            
            // Sort by date (newest first)
            uniquePayments.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Generate payment history HTML
            let historyHtml = '<div style="margin-bottom:20px;">';
            historyHtml += '<h4 style="margin:0 0 10px 0;color:#0ea5e9;font-weight:600;">' + student.name + ' (' + student.rollNo + ')</h4>';
            historyHtml += '<div style="display:flex;gap:20px;margin-bottom:15px;">';
            historyHtml += '<span><strong>Total Fees:</strong> ₹' + (fees.totalFees || 0) + '</span>';
            historyHtml += '<span style="color:#16a34a;"><strong>Paid:</strong> ₹' + (fees.paidAmount || 0) + '</span>';
            historyHtml += '<span style="color:' + (fees.dueAmount > 0 ? '#dc2626' : '#16a34a') + ';"><strong>Due:</strong> ₹' + (fees.dueAmount || 0) + '</span>';
            historyHtml += '</div>';
            historyHtml += '</div>';
            
            if (uniquePayments.length > 0) {
                historyHtml += '<table style="width:100%;border-collapse:collapse;">';
                historyHtml += '<thead><tr style="background:#f1f5f9;">';
                historyHtml += '<th style="padding:10px;text-align:left;border:1px solid #e2e8f0;">Date</th>';
                historyHtml += '<th style="padding:10px;text-align:left;border:1px solid #e2e8f0;">Amount</th>';
                historyHtml += '<th style="padding:10px;text-align:left;border:1px solid #e2e8f0;">Type</th>';
                historyHtml += '<th style="padding:10px;text-align:left;border:1px solid #e2e8f0;">Mode</th>';
                historyHtml += '<th style="padding:10px;text-align:left;border:1px solid #e2e8f0;">Status</th>';
                historyHtml += '<th style="padding:10px;text-align:left;border:1px solid #e2e8f0;">UTR / Txn ID</th>';
                historyHtml += '<th style="padding:10px;text-align:left;border:1px solid #e2e8f0;">Student Receipt</th>';
                historyHtml += '</tr></thead>';
                historyHtml += '<tbody>';
                
                uniquePayments.forEach(p => {
                    const statusBadge = p.status === 'approved'
                        ? '<span style="background:#dcfce7;color:#16a34a;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:600;">Approved</span>'
                        : p.status === 'denied'
                        ? '<span style="background:#fee2e2;color:#dc2626;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:600;">Denied</span>'
                        : '<span style="background:#fef3c7;color:#d97706;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:600;">Pending</span>';
                    
                    historyHtml += '<tr>';
                    historyHtml += '<td style="padding:10px;border:1px solid #e2e8f0;">' + formatDate(p.date) + '</td>';
                    historyHtml += '<td style="padding:10px;border:1px solid #e2e8f0;"><strong>₹' + p.amount + '</strong></td>';
                    historyHtml += '<td style="padding:10px;border:1px solid #e2e8f0;">' + (p.type || 'Fee') + '</td>';
                    historyHtml += '<td style="padding:10px;border:1px solid #e2e8f0;">' + p.mode + '</td>';
                    historyHtml += '<td style="padding:10px;border:1px solid #e2e8f0;">' + statusBadge + '</td>';
                    historyHtml += '<td style="padding:10px;border:1px solid #e2e8f0;"><code style="font-size:12px;">' + (p.utrNo || p.transactionId || p.utr || '-') + '</code></td>';
                    historyHtml += '<td style="padding:10px;border:1px solid #e2e8f0;"><code style="font-size:12px;color:#0ea5e9;font-weight:600;">' + (p.studentReceipt || '-') + '</code></td>';
                    historyHtml += '</tr>';
                });
                
                historyHtml += '</tbody></table>';
            } else {
                historyHtml += '<p style="text-align:center;padding:20px;color:#64748b;">No payment history found</p>';
            }
            
            // Show in a modal
            const modalHtml = `
                <div id="paymentHistoryModal" class="modal active" style="display:flex;">
                    <div class="modal-content" style="max-width:800px;max-height:80vh;overflow-y:auto;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                            <h3 style="margin:0;">Payment History</h3>
                            <button onclick="closePaymentHistoryModal()" style="background:none;border:none;font-size:24px;cursor:pointer;">&times;</button>
                        </div>
                        ${historyHtml}
                    </div>
                </div>
            `;
            
            // Remove existing modal if present
            const existingModal = document.getElementById('paymentHistoryModal');
            if (existingModal) existingModal.remove();
            
            // Add new modal
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } else {
            showNotification('Student not found!', 'error');
        }
    } catch (e) {
        console.error('Error loading payment history:', e);
        showNotification('Error loading payment history!', 'error');
    }
}

function closePaymentHistoryModal() {
    const modal = document.getElementById('paymentHistoryModal');
    if (modal) modal.remove();
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ===== Attendance =====
async function loadAttendancePage() {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const courseSelect = document.getElementById('attendanceCourse');
        courseSelect.innerHTML = '<option value="">Select Course</option>' + courses.map(c => '<option>' + c.name + '</option>').join('');
        
        // Add onchange event to load batches when course is selected
        courseSelect.onchange = async function() {
            const course = courseSelect.value;
            const batchSelect = document.getElementById('attendanceBatch');
            if (course) {
                const batches = await fetch('/api/batches?course=' + encodeURIComponent(course)).then(r => r.json());
                batchSelect.innerHTML = '<option value="">All Batches</option>' + batches.map(b => '<option value="' + b.name + '">' + b.name + '</option>').join('');
            } else {
                batchSelect.innerHTML = '<option value="">All Batches</option>';
            }
        };
        
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
        
        const holidayDiv = document.getElementById('holidayInfo');
        
        if (data.success && data.holiday) {
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
    const tbody = document.querySelector('#examCalendarTable tbody');
    if (tbody) renderLoadingSpinner(tbody, 'Loading exam calendar...');
    try {
        const res = await fetch('/api/exam-calendar');
        const data = await res.json();
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
    const tbody = document.querySelector('#holidaysTable tbody');
    if (tbody) renderLoadingSpinner(tbody, 'Loading holidays...');
    try {
        const res = await fetch('/api/holidays');
        const data = await res.json();
        
        if (data.success && data.holidays) {
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
let _allBlogs = [];
async function loadBlogTable() {
    const tbody = document.querySelector('#blogTable tbody');
    if (tbody) renderLoadingSpinner(tbody, 'Loading blogs...');
    try {
        // Check if running in faculty embed mode - filter by faculty ID
        let apiUrl = '/api/blogs?all=1';
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'embed') {
            try {
                const faculty = JSON.parse(localStorage.getItem('facultySession'));
                if (faculty && faculty.id) {
                    apiUrl += '&authorId=' + faculty.id;
                }
            } catch (e) {}
        }
        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.success && data.blogs) {
            _allBlogs = data.blogs;
            const tbody = document.querySelector('#blogTable tbody');
            tbody.innerHTML = data.blogs.map(blog => {
                const pinIcon = blog.pinned
                    ? '<i class="fas fa-thumbtack" style="color:#f59e0b;" title="Pinned"></i>'
                    : '<i class="fas fa-thumbtack" style="color:#cbd5e1;" title="Not pinned"></i>';
                let statusHtml;
                const st = blog.status || (blog.published === false ? 'draft' : 'published');
                if (st === 'published') {
                    statusHtml = '<span style="color:#16a34a;font-weight:600;"><i class="fas fa-check-circle"></i> Published</span>';
                } else if (st === 'scheduled') {
                    const when = blog.scheduledFor ? new Date(blog.scheduledFor).toLocaleString() : '';
                    statusHtml = '<span style="color:#f59e0b;font-weight:600;" title="Scheduled for ' + when + '"><i class="fas fa-clock"></i> Scheduled<br><small style="font-weight:400;">' + when + '</small></span>';
                } else {
                    statusHtml = '<span style="color:#94a3b8;font-weight:600;"><i class="fas fa-pencil-alt"></i> Draft</span>';
                }
                let html = '';
                html += '<tr>';
                html += '<td><input type="checkbox" class="blog-checkbox" data-id="' + blog.id + '"></td>';
                html += '<td style="text-align:center;cursor:pointer;" onclick="togglePinBlog(' + blog.id + ')">' + pinIcon + '</td>';
                html += '<td><strong>' + blog.title + '</strong>';
                if (blog.tags && blog.tags.length) {
                    html += '<br><span style="font-size:11px;color:#64748b;">' + blog.tags.slice(0,4).map(t => '#' + t).join(' ') + (blog.tags.length > 4 ? ' …' : '') + '</span>';
                }
                html += '</td>';
                html += '<td>' + blog.category + '</td>';
                html += '<td>' + blog.author + '</td>';
                html += '<td>' + (blog.views || 0) + '</td>';
                html += '<td>' + (blog.likes || 0) + '</td>';
                html += '<td><span id="blogCmtCount-' + blog.id + '">' + (blog.commentCount || 0) + '</span></td>';
                html += '<td>' + formatDate(blog.createdAt) + '</td>';
                html += '<td>' + statusHtml + '</td>';
                html += '<td style="white-space:nowrap;">';
                html += '<button class="btn btn-secondary" onclick="openBlogAnalytics(' + blog.id + ')" style="padding:4px 8px;font-size:12px;margin-right:4px;background:#0ea5e9;color:#fff;" title="Analytics"><i class="fas fa-chart-line"></i></button>';
                html += '<button class="btn btn-primary" onclick="editBlog(' + blog.id + ')" style="padding:4px 8px;font-size:12px;margin-right:4px;" title="Edit"><i class="fas fa-edit"></i></button>';
                html += '<button class="btn btn-secondary" onclick="deleteBlog(' + blog.id + ')" style="padding:4px 8px;font-size:12px;" title="Delete"><i class="fas fa-trash"></i></button>';
                html += '</td>';
                html += '</tr>';
                return html;
            }).join('');
        }
    } catch (e) {
        console.error('Error loading blogs:', e);
    }
}

// ===== Blog Analytics Modal =====
async function openBlogAnalytics(id) {
    document.getElementById('blogAnalyticsModal').style.display = 'flex';
    document.getElementById('blogAnalyticsBody').innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const res = await fetch('/api/admin/blogs/' + id + '/analytics');
        const data = await res.json();
        if (!data.success) {
            document.getElementById('blogAnalyticsBody').innerHTML = '<div style="color:#ef4444;">Could not load analytics.</div>';
            return;
        }
        const a = data.analytics;
        const reactions = a.reactions || {};
        const shares = a.shares || {};
        const totalShares = (shares.whatsapp || 0) + (shares.facebook || 0) + (shares.twitter || 0) + (shares.linkedin || 0) + (shares.copy || 0);
        document.getElementById('blogAnalyticsBody').innerHTML = `
            <h4 style="margin:0 0 14px;color:#1e293b;">${escapeAdminHtml(a.title)}</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px;">
                ${analyticsTile('eye', '#0ea5e9', 'Views', a.views)}
                ${analyticsTile('heart', '#ef4444', 'Likes', a.likes)}
                ${analyticsTile('comment', '#8b5cf6', 'Comments', a.commentsTotal + ' (' + a.commentsApproved + ' live)')}
                ${analyticsTile('share-alt', '#16a34a', 'Total Shares', totalShares)}
            </div>
            <div style="margin-bottom:18px;">
                <h5 style="margin:0 0 8px;color:#475569;">Reactions</h5>
                <div style="display:flex;gap:14px;flex-wrap:wrap;">
                    <div>🙏 Helpful: <strong>${reactions.helpful || 0}</strong></div>
                    <div>🔥 Fire: <strong>${reactions.fire || 0}</strong></div>
                    <div>💡 Insightful: <strong>${reactions.idea || 0}</strong></div>
                    <div>❤️ Loved: <strong>${reactions.love || 0}</strong></div>
                </div>
            </div>
            <div style="margin-bottom:18px;">
                <h5 style="margin:0 0 8px;color:#475569;">Shares Breakdown</h5>
                <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;">
                    <div><i class="fab fa-whatsapp" style="color:#25d366;"></i> ${shares.whatsapp || 0}</div>
                    <div><i class="fab fa-facebook" style="color:#1877f2;"></i> ${shares.facebook || 0}</div>
                    <div><i class="fab fa-twitter" style="color:#1da1f2;"></i> ${shares.twitter || 0}</div>
                    <div><i class="fab fa-linkedin" style="color:#0a66c2;"></i> ${shares.linkedin || 0}</div>
                    <div><i class="fas fa-link"></i> Copy: ${shares.copy || 0}</div>
                </div>
            </div>
            <div style="background:#f1f5f9;padding:10px;border-radius:6px;font-size:12px;color:#475569;">
                <div><strong>Status:</strong> ${a.status}${a.scheduledFor ? ' (publishes ' + new Date(a.scheduledFor).toLocaleString() + ')' : ''}</div>
                <div><strong>Created:</strong> ${new Date(a.createdAt).toLocaleString()}</div>
                <div><strong>Updated:</strong> ${new Date(a.updatedAt).toLocaleString()}</div>
                ${a.commentsPending ? '<div style="color:#ef4444;margin-top:4px;"><strong>' + a.commentsPending + ' comments awaiting moderation</strong></div>' : ''}
            </div>
        `;
    } catch (e) {
        document.getElementById('blogAnalyticsBody').innerHTML = '<div style="color:#ef4444;">Error loading analytics.</div>';
    }
}

function analyticsTile(icon, color, label, value) {
    return `<div style="background:${color}10;border:1px solid ${color}30;padding:14px;border-radius:8px;text-align:center;">
        <i class="fas fa-${icon}" style="color:${color};font-size:20px;"></i>
        <div style="font-size:20px;font-weight:700;margin-top:6px;color:#0f172a;">${value}</div>
        <div style="font-size:12px;color:#64748b;">${label}</div>
    </div>`;
}

function closeBlogAnalyticsModal() {
    document.getElementById('blogAnalyticsModal').style.display = 'none';
}

async function togglePinBlog(id) {
    const blog = _allBlogs.find(b => b.id == id);
    if (!blog) return;
    try {
        const res = await fetch('/api/blogs/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinned: !blog.pinned })
        });
        const data = await res.json();
        if (data.success) {
            showNotification(blog.pinned ? 'Blog unpinned' : 'Blog pinned to home page', 'success');
            loadBlogTable();
        }
    } catch (e) { showNotification('Error updating pin status', 'error'); }
}

function editBlog(id) {
    const blog = _allBlogs.find(b => b.id == id);
    if (!blog) return;
    document.getElementById('blogModalTitle').textContent = 'Edit Blog Post';
    document.getElementById('blogId').value = blog.id;
    document.getElementById('blogTitle').value = blog.title || '';
    document.getElementById('blogCategory').value = blog.category || 'General';
    document.getElementById('blogAuthor').value = blog.author || '';
    document.getElementById('blogPinned').checked = !!blog.pinned;

    // Tags / excerpt / SEO
    document.getElementById('blogTags').value = Array.isArray(blog.tags) ? blog.tags.join(', ') : '';
    document.getElementById('blogExcerpt').value = blog.excerpt || '';
    document.getElementById('blogMetaTitle').value = blog.metaTitle || '';
    document.getElementById('blogMetaDescription').value = blog.metaDescription || '';
    document.getElementById('blogOgImage').value = blog.ogImage || '';

    // Status
    const status = blog.status || (blog.published === false ? 'draft' : 'published');
    const radio = document.querySelector(`input[name="blogStatus"][value="${status}"]`);
    if (radio) radio.checked = true;
    if (blog.scheduledFor) {
        // Convert ISO to datetime-local format (YYYY-MM-DDTHH:MM)
        const d = new Date(blog.scheduledFor);
        const pad = n => String(n).padStart(2, '0');
        const localStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        document.getElementById('blogScheduledFor').value = localStr;
    } else {
        document.getElementById('blogScheduledFor').value = '';
    }
    onBlogStatusChange();

    // Last updated
    if (blog.updatedAt) {
        document.getElementById('blogLastUpdatedRow').style.display = 'block';
        document.getElementById('blogLastUpdatedText').textContent = formatDate(blog.updatedAt) + ' ' + new Date(blog.updatedAt).toLocaleTimeString();
    } else {
        document.getElementById('blogLastUpdatedRow').style.display = 'none';
    }

    // Cover image preview
    if (blog.image) {
        document.getElementById('blogImage').value = blog.image;
        document.getElementById('blogCoverImg').src = blog.image;
        document.getElementById('blogCoverPreview').style.display = 'block';
        document.getElementById('blogCoverRemoveBtn').style.display = 'inline-flex';
    } else {
        removeBlogCover();
    }
    document.getElementById('blogCoverInput').value = '';

    document.getElementById('blogModal').style.display = 'block';
    setTimeout(() => {
        initBlogQuill();
        if (_blogQuill) {
            _blogQuill.root.innerHTML = ''; // Clear existing content first
            _blogQuill.clipboard.dangerouslyPasteHTML(0, blog.content || '');
        }
    }, 50);
}

function onBlogStatusChange() {
    const status = document.querySelector('input[name="blogStatus"]:checked');
    const isScheduled = status && status.value === 'scheduled';
    document.getElementById('blogScheduleRow').style.display = isScheduled ? 'block' : 'none';
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

// Quill editor instance (initialized on first modal open)
let _blogQuill = null;

function initBlogQuill() {
    if (_blogQuill || typeof Quill === 'undefined') return;

    // ----- Custom Image blot: preserve width + class attributes -----
    const BaseImage = Quill.import('formats/image');
    const IMG_ATTRS = ['alt', 'src', 'width', 'class'];
    class BlogImage extends BaseImage {
        static formats(domNode) {
            const fmt = {};
            IMG_ATTRS.forEach(attr => {
                if (domNode.hasAttribute(attr)) fmt[attr] = domNode.getAttribute(attr);
            });
            return fmt;
        }
        format(name, value) {
            if (IMG_ATTRS.includes(name)) {
                if (value) this.domNode.setAttribute(name, value);
                else this.domNode.removeAttribute(name);
            } else {
                super.format(name, value);
            }
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
                handlers: {
                    image: blogQuillImageHandler
                }
            }
        },
        placeholder: 'Write your blog content here... Use the image button in the toolbar to insert images anywhere in the content. Click on any inserted image to resize, align, or add a caption.'
    });

    setupBlogImageEditing();
}

// ===== Image click-to-edit popover (size / align / caption / delete) =====
let _imgPopover = null;
let _activeImg = null;

function setupBlogImageEditing() {
    const editor = _blogQuill.root;
    editor.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            e.stopPropagation();
            showImagePopover(e.target);
        }
    });
    // Close popover on outside click
    document.addEventListener('mousedown', (e) => {
        if (!_imgPopover) return;
        if (_imgPopover.contains(e.target)) return;
        if (e.target.tagName === 'IMG' && editor.contains(e.target)) return;
        hideImagePopover();
    });
    // Reposition on scroll
    window.addEventListener('scroll', () => { if (_activeImg) positionPopover(_activeImg); }, true);
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
                <button data-size="25%" class="${currentSize==='25%'?'active':''}" title="Small">S</button>
                <button data-size="50%" class="${currentSize==='50%'?'active':''}" title="Medium">M</button>
                <button data-size="75%" class="${currentSize==='75%'?'active':''}" title="Large">L</button>
                <button data-size="100%" class="${currentSize==='100%'?'active':''}" title="Full width">Full</button>
            </div>
        </div>
        <div class="bip-row">
            <span class="bip-label"><i class="fas fa-align-justify"></i> Align</span>
            <div class="bip-btns">
                <button data-align="left" class="${currentAlign==='left'?'active':''}" title="Left"><i class="fas fa-align-left"></i></button>
                <button data-align="center" class="${currentAlign==='center'?'active':''}" title="Center"><i class="fas fa-align-center"></i></button>
                <button data-align="right" class="${currentAlign==='right'?'active':''}" title="Right"><i class="fas fa-align-right"></i></button>
            </div>
        </div>
        <div class="bip-row bip-caption-row">
            <span class="bip-label"><i class="fas fa-comment-dots"></i> Caption</span>
            <input type="text" class="bip-caption" placeholder="Add caption (optional)" maxlength="200">
        </div>
        <div class="bip-row bip-delete-row">
            <button class="bip-delete"><i class="fas fa-trash"></i> Delete Image</button>
        </div>
    `;
    document.body.appendChild(popover);
    _imgPopover = popover;
    positionPopover(img);

    // Pre-fill caption
    const captionEl = findCaptionFor(img);
    if (captionEl) popover.querySelector('.bip-caption').value = captionEl.textContent;

    // Wire events
    popover.querySelectorAll('button[data-size]').forEach(btn => {
        btn.onclick = () => { setImageSize(img, btn.dataset.size); refreshPopoverActive(popover, 'size', btn.dataset.size); };
    });
    popover.querySelectorAll('button[data-align]').forEach(btn => {
        btn.onclick = () => { setImageAlign(img, btn.dataset.align); refreshPopoverActive(popover, 'align', btn.dataset.align); };
    });
    popover.querySelector('.bip-caption').oninput = (e) => setImageCaption(img, e.target.value);
    popover.querySelector('.bip-delete').onclick = () => { deleteImageWithCaption(img); hideImagePopover(); };
}

function refreshPopoverActive(popover, type, val) {
    popover.querySelectorAll(`button[data-${type}]`).forEach(b => {
        b.classList.toggle('active', b.dataset[type] === val);
    });
}

function positionPopover(img) {
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
    _imgPopover.style.zIndex = '100000';
}

function hideImagePopover() {
    if (_imgPopover) { _imgPopover.remove(); _imgPopover = null; }
    if (_activeImg) { _activeImg.classList.remove('blog-img-selected'); _activeImg = null; }
}

function setImageSize(img, size) {
    img.setAttribute('width', size);
    img.style.width = size;
    if (_blogQuill) _blogQuill.update();
}

function setImageAlign(img, align) {
    // Remove existing align classes
    img.classList.remove('img-align-left', 'img-align-center', 'img-align-right');
    img.classList.add('img-align-' + align);
    if (_blogQuill) _blogQuill.update();
}

function findCaptionFor(img) {
    // Caption is the next paragraph after the image's parent <p>, with class blog-caption
    const parentP = img.closest('p');
    if (!parentP) return null;
    const next = parentP.nextElementSibling;
    if (next && next.classList && next.classList.contains('blog-caption')) return next;
    return null;
}

function setImageCaption(img, text) {
    const parentP = img.closest('p');
    if (!parentP) return;
    let caption = findCaptionFor(img);
    text = (text || '').trim();
    if (!text) {
        if (caption) caption.remove();
        return;
    }
    if (caption) {
        caption.textContent = text;
    } else {
        caption = document.createElement('p');
        caption.className = 'blog-caption';
        caption.textContent = text;
        parentP.parentNode.insertBefore(caption, parentP.nextSibling);
    }
    if (_blogQuill) _blogQuill.update();
}

function deleteImageWithCaption(img) {
    const caption = findCaptionFor(img);
    if (caption) caption.remove();
    const parentP = img.closest('p');
    if (parentP && parentP.textContent.trim() === '' && parentP.querySelectorAll('img').length === 1) {
        parentP.remove();
    } else {
        img.remove();
    }
    if (_blogQuill) _blogQuill.update();
}

// Custom image handler for Quill: upload to server and embed
function blogQuillImageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showNotification('Image too large (max 10MB)', 'error');
            return;
        }
        const formData = new FormData();
        formData.append('image', file);
        try {
            showNotification('Uploading image...', 'info');
            const res = await fetch('/api/upload/blog-image', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success && data.url) {
                const range = _blogQuill.getSelection(true);
                _blogQuill.insertEmbed(range.index, 'image', data.url, 'user');
                _blogQuill.setSelection(range.index + 1);
                showNotification('Image inserted', 'success');
            } else {
                showNotification(data.message || 'Upload failed', 'error');
            }
        } catch (e) {
            showNotification('Upload error', 'error');
        }
    };
}

// Cover image upload
async function uploadBlogCover(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
        showNotification('Cover image too large (max 10MB)', 'error');
        input.value = '';
        return;
    }
    const formData = new FormData();
    formData.append('image', file);
    try {
        showNotification('Uploading cover image...', 'info');
        const res = await fetch('/api/upload/blog-image', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success && data.url) {
            document.getElementById('blogImage').value = data.url;
            document.getElementById('blogCoverImg').src = data.url;
            document.getElementById('blogCoverPreview').style.display = 'block';
            document.getElementById('blogCoverRemoveBtn').style.display = 'inline-flex';
            showNotification('Cover uploaded', 'success');
        } else {
            showNotification(data.message || 'Upload failed', 'error');
            input.value = '';
        }
    } catch (e) {
        showNotification('Upload error', 'error');
        input.value = '';
    }
}

function removeBlogCover() {
    document.getElementById('blogImage').value = '';
    document.getElementById('blogCoverInput').value = '';
    document.getElementById('blogCoverImg').src = '';
    document.getElementById('blogCoverPreview').style.display = 'none';
    document.getElementById('blogCoverRemoveBtn').style.display = 'none';
}

function openBlogModal() {
    document.getElementById('blogModalTitle').textContent = 'Add Blog Post';
    document.getElementById('blogId').value = '';
    document.getElementById('blogTitle').value = '';
    document.getElementById('blogCategory').value = 'General';
    document.getElementById('blogAuthor').value = '';
    document.getElementById('blogImage').value = '';
    document.getElementById('blogCoverInput').value = '';
    document.getElementById('blogPinned').checked = false;
    document.getElementById('blogTags').value = '';
    document.getElementById('blogExcerpt').value = '';
    document.getElementById('blogMetaTitle').value = '';
    document.getElementById('blogMetaDescription').value = '';
    document.getElementById('blogOgImage').value = '';
    document.getElementById('blogScheduledFor').value = '';
    const pubRadio = document.querySelector('input[name="blogStatus"][value="published"]');
    if (pubRadio) pubRadio.checked = true;
    onBlogStatusChange();
    document.getElementById('blogLastUpdatedRow').style.display = 'none';
    removeBlogCover();
    document.getElementById('blogModal').style.display = 'block';
    setTimeout(() => {
        initBlogQuill();
        if (_blogQuill) _blogQuill.setContents([]);
    }, 50);
}

function closeBlogModal() {
    document.getElementById('blogModal').style.display = 'none';
}

async function saveBlog() {
    const id = document.getElementById('blogId').value;
    const title = document.getElementById('blogTitle').value;
    const category = document.getElementById('blogCategory').value;
    const author = document.getElementById('blogAuthor').value;
    const image = document.getElementById('blogImage').value;
    let content = '';
    if (_blogQuill) {
        const html = _blogQuill.root.innerHTML;
        content = (_blogQuill.getText().trim() === '' && !/<img/i.test(html)) ? '' : html;
    }
    const pinned = document.getElementById('blogPinned').checked;
    const tags = document.getElementById('blogTags').value;
    const excerpt = document.getElementById('blogExcerpt').value;
    const metaTitle = document.getElementById('blogMetaTitle').value;
    const metaDescription = document.getElementById('blogMetaDescription').value;
    const ogImage = document.getElementById('blogOgImage').value;
    const statusEl = document.querySelector('input[name="blogStatus"]:checked');
    const status = statusEl ? statusEl.value : 'published';
    let scheduledFor = null;
    if (status === 'scheduled') {
        const v = document.getElementById('blogScheduledFor').value;
        if (!v) { showNotification('Please select a publish date/time for scheduled post', 'error'); return; }
        scheduledFor = new Date(v).toISOString();
    }

    if (!title || !content) {
        showNotification('Title and content are required!', 'error');
        return;
    }

    try {
        const url = id ? '/api/blogs/' + id : '/api/blogs';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, author, image, content, pinned, tags, excerpt, metaTitle, metaDescription, ogImage, status, scheduledFor })
        });
        
        const data = await res.json();
        
        if (data.success) {
            showNotification(id ? 'Blog post updated!' : 'Blog post added!', 'success');
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
            renderEmptyState(tbody, 'user-graduate', 'No students found for this course/batch.');
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
    const tbody = document.getElementById('studyMaterialsTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading study materials...');
    try {
        const res = await fetch('/api/study-materials');
        const data = await res.json();
        if (data.success && data.materials) {
            tbody.innerHTML = data.materials.map(m => {
                let html = '';
                html += '<tr>';
                html += '<td><input type="checkbox" class="study-material-checkbox" data-id="' + m.id + '"></td>';
                html += '<td><strong>' + m.title + '</strong>';
                if (m.submittedBy) html += '<br><small style="color:#64748b;">by ' + m.submittedBy + '</small>';
                html += '</td>';
                html += '<td>' + m.course + '</td>';
                html += '<td>' + (m.category || 'General') + '</td>';
                html += '<td>' + m.type.toUpperCase() + '</td>';
                html += '<td>' + (m.author || 'Admin') + '</td>';
                html += '<td>';
                const status = m.status || 'approved';
                if (status === 'pending') {
                    html += '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">Pending</span>';
                } else if (status === 'rejected') {
                    html += '<span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">Rejected</span>';
                } else {
                    html += '<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">Approved</span>';
                }
                html += '</td>';
                html += '<td>' + (m.viewCount || 0) + '</td>';
                html += '<td>' + (m.downloadCount || 0) + '</td>';
                html += '<td>';
                if (status === 'pending') {
                    html += '<button class="btn btn-success" onclick="approveStudyMaterial(\'' + m.id + '\')" title="Approve" style="padding:5px 8px;font-size:12px;background:#16a34a;"><i class="fas fa-check"></i></button> ';
                    html += '<button class="btn btn-danger" onclick="rejectStudyMaterial(\'' + m.id + '\')" title="Reject" style="padding:5px 8px;font-size:12px;"><i class="fas fa-times"></i></button> ';
                }
                html += '<button class="btn" onclick="deleteStudyMaterial(\'' + m.id + '\')" title="Delete" style="padding:5px 8px;font-size:12px;"><i class="fas fa-trash"></i></button>';
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

async function approveStudyMaterial(id) {
    try {
        const res = await fetch('/api/study-materials/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' })
        });
        const data = await res.json();
        if (data.success) {
            loadStudyMaterialsTable();
            showNotification('Material approved!', 'success');
        } else {
            showNotification('Error: ' + (data.message || 'Unknown'), 'error');
        }
    } catch (e) { showNotification('Error!', 'error'); }
}

async function rejectStudyMaterial(id) {
    if (!confirm('Reject this material?')) return;
    try {
        const res = await fetch('/api/study-materials/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'rejected' })
        });
        const data = await res.json();
        if (data.success) {
            loadStudyMaterialsTable();
            showNotification('Material rejected!', 'success');
        } else {
            showNotification('Error: ' + (data.message || 'Unknown'), 'error');
        }
    } catch (e) { showNotification('Error!', 'error'); }
}

// ===== Videos (Video Learning Platform) =====
function toggleVideoOptions(id) {
    const menu = document.getElementById('videoOpts' + id);
    if (!menu) return;
    document.querySelectorAll('[id^="videoOpts"]').forEach(m => {
        if (m !== menu) m.style.display = 'none';
    });
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', function(e) {
    if (!e.target.closest('[id^="videoOpts"]') && !e.target.closest('button[onclick*="toggleVideoOptions"]')) {
        document.querySelectorAll('[id^="videoOpts"]').forEach(m => m.style.display = 'none');
    }
});

async function loadVideosTable() {
    const tbody = document.getElementById('videosTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading videos...');
    try {
        const res = await fetch('/api/videos');
        const videos = await res.json();

        if (videos.length === 0) {
            renderEmptyState(tbody, 'video', 'No videos found');
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
            html += '<td><div style="position:relative;"><button class="action-btn edit-btn" onclick="toggleVideoOptions(' + v.id + ')"><i class="fas fa-ellipsis-v"></i> Options</button><div id="videoOpts' + v.id + '" style="display:none;position:absolute;right:0;top:100%;z-index:100;min-width:160px;background:rgba(30,41,59,0.97);backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.15);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.4);padding:4px;">';
            html += '<button class="action-btn edit-btn" style="width:100%;text-align:left;margin:2px 0;border:none;background:transparent;color:#e2e8f0;padding:8px 12px;border-radius:6px;" onclick="editVideo(' + v.id + ')"><i class="fas fa-edit"></i> Edit</button>';
            html += '<button style="width:100%;text-align:left;margin:2px 0;border:none;background:transparent;color:#a78bfa;padding:8px 12px;border-radius:6px;cursor:pointer;" onclick="openQuizManager(' + v.id + ',\'' + (v.title || '').replace(/\'/g, "\\'") + '\')"><i class="fas fa-question-circle"></i> Quiz</button>';
            html += '<button style="width:100%;text-align:left;margin:2px 0;border:none;background:transparent;color:#10b981;padding:8px 12px;border-radius:6px;cursor:pointer;" onclick="openResourcesManager(' + v.id + ',\'' + (v.title || '').replace(/\'/g, "\\'") + '\')"><i class="fas fa-paperclip"></i> Files</button>';
            html += '<button style="width:100%;text-align:left;margin:2px 0;border:none;background:transparent;color:#0ea5e9;padding:8px 12px;border-radius:6px;cursor:pointer;" onclick="openHotspotManager(' + v.id + ',\'' + (v.title || '').replace(/\'/g, "\\'") + '\')"><i class="fas fa-map-pin"></i> Hotspots</button>';
            html += '<button style="width:100%;text-align:left;margin:2px 0;border:none;background:transparent;color:#f59e0b;padding:8px 12px;border-radius:6px;cursor:pointer;" onclick="notifyVideoAvailability(' + v.id + ')"><i class="fas fa-bell"></i> Notify</button>';
            html += '<button class="action-btn delete-btn" style="width:100%;text-align:left;margin:2px 0;border:none;background:transparent;color:#f5576c;padding:8px 12px;border-radius:6px;" onclick="deleteVideo(' + v.id + ')"><i class="fas fa-trash"></i> Delete</button>';
            html += '</div></div></td>';
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
    const tbody = document.getElementById('chaptersTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading chapters...');
    try {
        const courseFilter = document.getElementById('chapterCourseFilter');
        const courseId = courseFilter ? courseFilter.value : '';
        const url = courseId ? '/api/chapters?courseId=' + courseId : '/api/chapters';
        const res = await fetch(url);
        const chapters = await res.json();

        if (chapters.length === 0) {
            renderEmptyState(tbody, 'list-ol', 'No chapters found');
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
    const tbody = document.getElementById('assignmentsTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading assignments...');
    try {
        const res = await fetch('/api/assignments');
        const assignments = await res.json();
        
        if (assignments.length === 0) {
            renderEmptyState(tbody, 'tasks', 'No assignments found');
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
    const tbody = document.getElementById('alumniTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading alumni...');
    try {
        const res = await fetch('/api/alumni');
        const alumni = await res.json();
        
        if (alumni.length === 0) {
            renderEmptyState(tbody, 'user-graduate', 'No alumni found');
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
    const tbody = document.getElementById('ticketsTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading tickets...');
    try {
        const res = await fetch('/api/tickets');
        const tickets = await res.json();
        
        if (tickets.length === 0) {
            renderEmptyState(tbody, 'ticket-alt', 'No tickets found');
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
            html += '<button class="action-btn" onclick="openTicketConversation(' + t.id + ')" title="Conversation"><i class="fas fa-comments"></i></button>';
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

async function openTicketModal() {
    document.getElementById('ticketModalTitle').textContent = 'Create Ticket';
    document.getElementById('ticketId').value = '';
    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketDescription').value = '';
    document.getElementById('ticketCategory').value = 'General';
    document.getElementById('ticketPriority').value = 'Medium';
    document.getElementById('ticketStatus').value = 'Open';
    document.getElementById('ticketAssignedTo').value = '';

    // Load students into dropdown
    const studentSelect = document.getElementById('ticketStudentId');
    studentSelect.innerHTML = '<option value="">Select Student</option>';
    try {
        const res = await fetch('/api/students');
        const data = await res.json();
        if (data.success && data.students) {
            data.students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = `${student.name} (${student.rollNo})`;
                studentSelect.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Error loading students:', err);
    }

    document.getElementById('ticketModal').classList.add('active');
}

async function saveTicket() {
    const ticketId = document.getElementById('ticketId').value;
    const studentId = document.getElementById('ticketStudentId').value;

    if (!studentId) {
        showNotification('Please select a student', 'error');
        return;
    }

    // Get student details
    let studentName = 'Unknown';
    let studentEmail = '';
    try {
        const res = await fetch('/api/students');
        const data = await res.json();
        if (data.success && data.students) {
            const student = data.students.find(s => s.id == studentId);
            if (student) {
                studentName = student.name;
                studentEmail = student.email;
            }
        }
    } catch (err) {
        console.error('Error fetching student details:', err);
    }

    const data = {
        subject: document.getElementById('ticketSubject').value,
        description: document.getElementById('ticketDescription').value,
        category: document.getElementById('ticketCategory').value,
        priority: document.getElementById('ticketPriority').value,
        status: document.getElementById('ticketStatus').value,
        assignedTo: document.getElementById('ticketAssignedTo').value,
        studentId: studentId,
        studentName: studentName,
        studentEmail: studentEmail
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

async function openTicketConversation(ticketId) {
    try {
        const res = await fetch('/api/tickets/' + ticketId);
        const data = await res.json();
        if (!data || !data.id) {
            showNotification('Failed to load ticket', 'error');
            return;
        }
        const ticket = data;
        document.getElementById('ticketConversationTitle').textContent = ticket.subject;
        document.getElementById('conversationTicketId').value = ticket.id;
        document.getElementById('ticketConversationInfo').innerHTML = `
            <p><strong>Student:</strong> ${ticket.studentName}</p>
            <p><strong>Status:</strong> ${ticket.status}</p>
            <p><strong>Category:</strong> ${ticket.category}</p>
            <p><strong>Priority:</strong> ${ticket.priority}</p>
        `;

        let threadHtml = '';
        if (ticket.description) {
            threadHtml += `
                <div style="margin-bottom:15px;padding:10px;background:#e0f2fe;border-radius:5px;border-left:3px solid #0284c7;">
                    <p style="margin:0 0 5px;font-weight:600;color:#0369a1;">${ticket.studentName} (Initial)</p>
                    <p style="margin:0;">${ticket.description}</p>
                </div>
            `;
        }
        if (ticket.responses && ticket.responses.length > 0) {
            ticket.responses.forEach(resp => {
                const isAdmin = resp.sender === 'admin';
                threadHtml += `
                    <div style="margin-bottom:15px;padding:10px;background:${isAdmin ? '#fef3c7' : '#e0f2fe'};border-radius:5px;border-left:3px solid ${isAdmin ? '#d97706' : '#0284c7'};">
                        <p style="margin:0 0 5px;font-weight:600;color:${isAdmin ? '#92400e' : '#0369a1'};">${isAdmin ? 'Admin' : ticket.studentName}</p>
                        <p style="margin:0;">${resp.message}</p>
                        <p style="margin:5px 0 0;font-size:12px;color:#64748b;">${formatDate(resp.timestamp || resp.createdAt)}</p>
                    </div>
                `;
            });
        }
        if (!threadHtml) {
            threadHtml = '<p style="color:#64748b;text-align:center;">No responses yet.</p>';
        }
        document.getElementById('ticketConversationThread').innerHTML = threadHtml;
        document.getElementById('ticketAdminReply').value = '';
        document.getElementById('ticketConversationModal').classList.add('active');
    } catch (e) {
        console.error('Error loading ticket conversation:', e);
        showNotification('Error loading conversation', 'error');
    }
}

async function sendAdminReply() {
    const ticketId = document.getElementById('conversationTicketId').value;
    const message = document.getElementById('ticketAdminReply').value.trim();

    if (!message) {
        showNotification('Please enter a reply', 'error');
        return;
    }

    try {
        const res = await fetch('/api/tickets/' + ticketId + '/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: 'admin',
                message: message
            })
        });
        const data = await res.json();
        if (data.success) {
            openTicketConversation(ticketId);
            showNotification('Reply sent!', 'success');
        } else {
            showNotification('Failed to send reply', 'error');
        }
    } catch (e) {
        console.error('Error sending reply:', e);
        showNotification('Error sending reply', 'error');
    }
}

// ===== Backup & Recovery =====
async function loadBackupsList() {
    const tbody = document.getElementById('backupsTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading backups...');
    try {
        const res = await fetch('/api/backup/list');
        const data = await res.json();
        
        if (!data.success || data.backups.length === 0) {
            renderEmptyState(tbody, 'database', 'No backups found');
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
    const tbody = document.getElementById('rolesTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading roles...');
    try {
        const res = await fetch('/api/roles');
        const roles = await res.json();
        
        if (roles.length === 0) {
            renderEmptyState(tbody, 'user-shield', 'No roles found');
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
    document.getElementById('roleModalTitleText').textContent = 'Add Role';
    document.getElementById('roleId').value = '';
    document.getElementById('roleName').value = '';
    document.getElementById('roleDescription').value = '';
    document.getElementById('permissionSearch').value = '';
    
    const permissionsRes = await fetch('/api/permissions');
    const permissions = await permissionsRes.json();
    
    renderPermissionsList(permissions);
    
    document.getElementById('roleModal').classList.add('active');
}

function renderPermissionsList(permissions) {
    const permissionsList = document.getElementById('permissionsList');
    const searchTerm = document.getElementById('permissionSearch').value.toLowerCase();
    
    const filteredPermissions = permissions.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        (p.module && p.module.toLowerCase().includes(searchTerm))
    );
    
    // Group by module if available
    const grouped = {};
    filteredPermissions.forEach(p => {
        const module = p.module || 'Other';
        if (!grouped[module]) grouped[module] = [];
        grouped[module].push(p);
    });
    
    let html = '';
    for (const module in grouped) {
        html += '<div style="margin-bottom:15px;">';
        html += '<div style="font-weight:600;color:#fff;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.2);font-size:13px;text-shadow:0 1px 2px rgba(0,0,0,0.2);">' + module + '</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">';
        grouped[module].forEach(p => {
            html += '<label style="display:flex;align-items:center;padding:8px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;cursor:pointer;transition:all 0.2s;backdrop-filter:blur(5px);">';
            html += '<input type="checkbox" class="permission-checkbox" value="' + p.id + '" style="margin-right:10px;width:16px;height:16px;accent-color:#6366f1;">';
            html += '<span style="font-size:13px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.2);">' + p.name + '</span>';
            html += '</label>';
        });
        html += '</div></div>';
    }
    
    permissionsList.innerHTML = html;
}

function filterPermissions() {
    const permissionsRes = fetch('/api/permissions').then(r => r.json());
    permissionsRes.then(permissions => renderPermissionsList(permissions));
}

function selectAllPermissions() {
    document.querySelectorAll('.permission-checkbox').forEach(cb => cb.checked = true);
}

function deselectAllPermissions() {
    document.querySelectorAll('.permission-checkbox').forEach(cb => cb.checked = false);
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
        
        document.getElementById('roleModalTitleText').textContent = 'Edit Role';
        document.getElementById('roleId').value = role.id;
        document.getElementById('roleName').value = role.name;
        document.getElementById('roleDescription').value = role.description || '';
        document.getElementById('permissionSearch').value = '';
        
        const permissionsRes = await fetch('/api/permissions');
        const permissions = await permissionsRes.json();
        
        renderPermissionsList(permissions);
        
        // Check the permissions that are already assigned to this role
        setTimeout(() => {
            document.querySelectorAll('.permission-checkbox').forEach(cb => {
                if (role.permissions && role.permissions.includes(cb.value)) {
                    cb.checked = true;
                } else {
                    cb.checked = false;
                }
            });
        }, 100);
        
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
    const tbody = document.getElementById('examResultsTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading exam results...');
    try {
        const res = await fetch('/api/exam-results');
        const data = await res.json();
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
    const tbody = document.getElementById('certificatesTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading certificates...');
    try {
        const res = await fetch('/api/certificates');
        const data = await res.json();
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
    const tbody = document.querySelector('#paymentsTable tbody');
    renderLoadingSpinner(tbody, 'Loading payments...');
    try {
        const [res, studentsRes] = await Promise.all([
            fetch('/api/payments'),
            fetch('/api/students')
        ]);

        if (!res.ok) {
            throw new Error('HTTP error! status: ' + res.status);
        }

        const data = await res.json();
        const studentsData = await studentsRes.json().catch(() => []);
        const students = Array.isArray(studentsData) ? studentsData : (studentsData.data || []);
        const validStudentIds = new Set(students.map(s => String(s.id)));
        const tbody = document.querySelector('#paymentsTable tbody');

        // Hide payments belonging to deleted students
        const visiblePayments = (data.payments || []).filter(p => validStudentIds.has(String(p.studentId)));

        if (data.success && visiblePayments.length > 0) {
            // Sort by id descending (latest first)
            const payments = [...visiblePayments].sort((a, b) => (b.id || 0) - (a.id || 0));

            tbody.innerHTML = payments.map(p => {
                const status = (p.status || 'pending').toLowerCase();
                const statusBadge = status === 'pending'
                    ? '<span style="background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;">Pending</span>'
                    : status === 'approved'
                    ? '<span style="background:#dcfce7;color:#16a34a;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;">Approved</span>'
                    : status === 'denied'
                    ? '<span style="background:#fee2e2;color:#dc2626;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;">Denied</span>'
                    : '<span style="background:#e2e8f0;color:#64748b;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;">' + (p.status || 'Unknown') + '</span>';

                const actions = status === 'pending'
                    ? '<button class="action-btn edit-btn" onclick="approvePayment(\'' + p.id + '\')" style="background:#16a34a;color:#fff;margin-right:5px;"><i class="fas fa-check"></i> Approve</button><button class="action-btn delete-btn" onclick="denyPayment(\'' + p.id + '\')"><i class="fas fa-times"></i> Deny</button>'
                    : '<span style="color:#64748b;font-size:13px;">Processed</span>';

                const txnId = p.utrNo || p.transactionId || '—';
                const studentReceipt = p.studentReceipt || (String(p.mode || '').toLowerCase() === 'cash' ? p.transactionId : '') || '—';
                const modeDisplay = (p.mode || '—').toString().toUpperCase();

                let html = '';
                html += '<tr>';
                html += '<td>' + (p.studentName || '—') + '</td>';
                html += '<td><strong>&#8377;' + (p.amount || 0).toLocaleString('en-IN') + '</strong></td>';
                html += '<td>' + modeDisplay + '</td>';
                html += '<td>' + (p.date || '—') + '</td>';
                html += '<td><code style="font-size:12px;">' + txnId + '</code></td>';
                html += '<td><code style="font-size:12px;color:#0ea5e9;font-weight:600;">' + studentReceipt + '</code></td>';
                html += '<td>' + statusBadge + '</td>';
                html += '<td>' + actions + '</td>';
                html += '</tr>';
                return html;
            }).join('');
        } else {
            renderEmptyState(tbody, 'money-bill-wave', 'No payments found');
        }
    } catch (err) {
        console.error('Error loading payments:', err);
        const tbody = document.querySelector('#paymentsTable tbody');
        renderEmptyState(tbody, 'exclamation-circle', 'Error loading payments');
    }
}

async function approvePayment(paymentId) {
    if (!confirm('Are you sure you want to approve this payment?')) return;
    try {
        const res = await fetch('/api/payments/' + paymentId + '/approve', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            showNotification('Payment approved successfully!', 'success');
            loadPaymentsTable();
            loadDashboard && loadDashboard();
        } else {
            showNotification('Error: ' + (data.message || 'Unknown error'), 'error');
        }
    } catch (err) {
        console.error('Error approving payment:', err);
        showNotification('Error approving payment', 'error');
    }
}

async function denyPayment(paymentId) {
    if (!confirm('Are you sure you want to deny this payment?')) return;

    try {
        const res = await fetch('/api/payments/' + paymentId + '/deny', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            showNotification('Payment denied!', 'success');
            loadPaymentsTable();
            loadDashboard && loadDashboard();
        } else {
            showNotification('Error: ' + (data.message || 'Unknown error'), 'error');
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
                renderEmptyState(tbody, 'bell', 'No notifications sent to this student');
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
            renderEmptyState(tbody, 'bell', 'No notifications found');
        }
    } catch (e) {
        console.error('Error loading notifications:', e);
        const tbody = document.getElementById('notificationsTable').querySelector('tbody');
        renderEmptyState(tbody, 'exclamation-circle', 'Error loading notifications');
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
    const tbody = document.getElementById('notificationsTable').querySelector('tbody');
    renderLoadingSpinner(tbody, 'Loading notifications...');
    try {
        console.log('Loading notifications table...');
        const res = await fetch('/api/notifications/all');
        const data = await res.json();
        
        console.log('Notifications data:', data);
        
        if (data.success && data.notifications) {
            // Get all students for name lookup
            const students = await fetch('/api/students').then(r => r.json());
            const studentMap = {};
            students.forEach(s => studentMap[s.id] = s.name);
            
            console.log('Total notifications:', data.notifications.length);
            
            if (data.notifications.length === 0) {
                renderEmptyState(tbody, 'bell', 'No notifications found');
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
            renderEmptyState(tbody, 'bell', 'No notifications found');
        }
    } catch (e) {
        console.error('Error loading notifications:', e);
        const tbody = document.getElementById('notificationsTable').querySelector('tbody');
        renderEmptyState(tbody, 'exclamation-circle', 'Error loading notifications');
    }
}

// ===== Exam Management =====
async function loadExamManagementTable() {
    const tbody = document.querySelector('#examManagementTable tbody');
    renderLoadingSpinner(tbody, 'Loading exams...');
    try {
        const exams = await fetch('/api/exams').then(r => r.json());
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
    const tbody = document.querySelector('#questionBankTable tbody');
    renderLoadingSpinner(tbody, 'Loading question bank...');
    try {
        const data = await fetch('/api/questions').then(r => r.json());
        const questions = Array.isArray(data) ? data : (data.questions || []);
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
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04;"><img src="/uploads/logo/logo.png" style="max-width: 300px; max-height: 300px; border-radius: 12px;" onerror="this.parentElement.style.display='none'"></div>
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
    const tbody = document.querySelector('#examScheduleTable tbody');
    renderLoadingSpinner(tbody, 'Loading exam schedules...');
    try {
        const schedules = await fetch('/api/exam-schedules').then(r => r.json());
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
    printContent += '.watermark { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04; }</style></head><body><div class="watermark"><img src="/uploads/logo/logo.png" style="max-width: 300px; max-height: 300px; border-radius: 12px;" onerror="this.parentElement.style.display=\'none\'"></div>';
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
    const tbody = document.querySelector('#examRegistrationTable tbody');
    renderLoadingSpinner(tbody, 'Loading exam registrations...');
    try {
        const [registrations, students] = await Promise.all([
            fetch('/api/exam-registrations').then(r => r.json()),
            fetch('/api/students').then(r => r.json())
        ]);
        const studentsMap = {};
        (students || []).forEach(s => { studentsMap[s.id] = s; });
        if (!registrations || registrations.length === 0) {
            renderEmptyState(tbody, 'clipboard-list', 'No exam registrations found');
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
    const tbody = document.querySelector('#onlineExamTable tbody');
    renderLoadingSpinner(tbody, 'Loading online exams...');
    try {
        const onlineExams = await fetch('/api/online-exams').then(r => r.json());
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
    const tbody = document.querySelector('#examGradingTable tbody');
    renderLoadingSpinner(tbody, 'Loading grades...');
    try {
        const grades = await fetch('/api/exam-grades').then(r => r.json());
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
            renderEmptyState(tbody, 'file-alt', 'No exam reports found for selected criteria');
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
            renderEmptyState(tbody, 'clipboard-check', 'No attempts found matching criteria');
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
            renderEmptyState(tbody, 'question-circle', 'No question-level data available');
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
    const tbody = document.querySelector('#reEvaluationTable tbody');
    if (!tbody) return;
    renderLoadingSpinner(tbody, 'Loading re-evaluation requests...');
    try {
        const requests = await fetch('/api/re-evaluation').then(r => r.json()).catch(() => []);

        if (requests.length === 0) {
            renderEmptyState(tbody, 'sync', 'No re-evaluation requests yet');
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
    console.log('Loading all batches');
    try {
        const data = await fetch('/api/batches/seats').then(r => r.json());
        console.log('All batches:', data);
        const sel = document.getElementById('sBatch');
        if (!sel) {
            console.error('sBatch element not found');
            return;
        }
        sel.innerHTML = '<option value="">-- Select Batch --</option>';
        
        // Show all batches for all courses
        if (data.length === 0) {
            sel.innerHTML += '<option disabled>No batches available</option>';
            return;
        }
        
        data.forEach(b => {
            const available = b.available > 0 ? b.available + ' seats' : 'FULL';
            const opt = document.createElement('option');
            opt.value = b.name; opt.dataset.batchId = b.id;
            opt.textContent = b.name + ' (' + (b.timing || '') + ') - ' + available;
            if (b.available === 0) opt.disabled = true;
            sel.appendChild(opt);
        });
        console.log('Batches populated in dropdown');
    } catch (e) {
        console.error('Error loading batches:', e);
    }
    
    // Remove existing event listener to avoid duplicates
    const newSel = document.getElementById('sBatch');
    const clonedSel = newSel.cloneNode(true);
    newSel.parentNode.replaceChild(clonedSel, newSel);
    
    clonedSel.addEventListener('change', function() {
        const selected = this.options[this.selectedIndex];
        document.getElementById('sBatchId') && (document.getElementById('sBatchId').value = selected?.dataset?.batchId || '');
    });
}

// ===== Razorpay (Removed) =====

// ===== Document helpers =====
function showSingleDoc(input, labelId) {
    const f = input.files[0];
    if (!f) {
        document.getElementById(labelId).textContent = 'Click to upload';
        return;
    }

    // File size validation (5MB for documents like marksheet, Aadhar, etc.)
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (f.size > maxSize) {
        showNotification('File size exceeds 5MB limit. Please choose a smaller file.', 'error');
        input.value = ''; // Clear the file input
        document.getElementById(labelId).textContent = 'Click to upload';
        return;
    }

    document.getElementById(labelId).textContent = '📎 ' + f.name;
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
    const courseName = document.getElementById('sCourse').value;
    console.log('onCourseChange called, course:', courseName);
    const val = courseName.toUpperCase();
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
    const gradMkGroup = document.getElementById('sGradMarksheetGroup');
    if (gradMkGroup) gradMkGroup.style.display = isPGDCA ? 'block' : 'none';
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

function calc12Pct() {
    const total = parseFloat(document.getElementById('s12Total').value) || 0;
    const obtained = parseFloat(document.getElementById('s12Obtained').value) || 0;
    if (total > 0) {
        const pct = ((obtained / total) * 100).toFixed(2);
        document.getElementById('pct12').textContent = pct + '%';
        const d = getDivision(parseFloat(pct));
        document.getElementById('div12').textContent = d ? d.text : '—';
        document.getElementById('div12').className = 'div-badge ' + (d ? d.cls : '');
    } else {
        document.getElementById('pct12').textContent = '—';
        document.getElementById('div12').textContent = '—';
        document.getElementById('div12').className = 'div-badge';
    }
}

function calcGradPct() {
    const total = parseFloat(document.getElementById('sGradTotal').value) || 0;
    const obtained = parseFloat(document.getElementById('sGradObtained').value) || 0;
    if (total > 0) {
        const pct = ((obtained / total) * 100).toFixed(2);
        document.getElementById('pctGrad').textContent = pct + '%';
        const d = getDivision(parseFloat(pct));
        document.getElementById('divGrad').textContent = d ? d.text : '—';
        document.getElementById('divGrad').className = 'div-badge ' + (d ? d.cls : '');
    } else {
        document.getElementById('pctGrad').textContent = '—';
        document.getElementById('divGrad').textContent = '—';
        document.getElementById('divGrad').className = 'div-badge';
    }
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
            total: document.getElementById('s12Total').value,
            obtained: document.getElementById('s12Obtained').value,
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
            total: isCGPA ? '' : document.getElementById('sGradTotal').value,
            obtained: isCGPA ? '' : document.getElementById('sGradObtained').value,
            percentage: isCGPA ? document.getElementById('sGradCGPAPct').value : document.getElementById('pctGrad').textContent,
            cgpa: isCGPA ? document.getElementById('sGradCGPA').value : '',
            division: isCGPA ? document.getElementById('sGradCGPADiv').value : document.getElementById('divGrad').textContent
        };
    }
    return qual;
}

// ===== Students =====
let allStudents = [];
let studentsCurrentPage = 1;
const studentsPerPage = 25;
let studentsFiltered = [];

async function loadStudentsTable() {
    const tbody = document.querySelector('#studentsTable tbody');
    renderLoadingSpinner(tbody, 'Loading students...');
    try {
        allStudents = await fetch('/api/students').then(r => r.json());
        await loadBatchesForStudentFilter();
        await loadCoursesForStudentFilter();
        renderStudentsTable(allStudents);
    } catch (err) { showNotification('Students load error!', 'error'); renderEmptyState(tbody, 'exclamation-circle', 'Error loading students'); }
}

async function loadCoursesForStudentFilter() {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        const select = document.getElementById('studentCourseFilter');
        select.innerHTML = '<option value="">All Courses</option>' + courses.map(c => '<option value="' + c.name + '">' + c.name + '</option>').join('');
    } catch (err) {
        console.error('Error loading courses for filter:', err);
    }
}

async function loadBatchesForStudentFilter() {
    try {
        const batches = await fetch('/api/batches').then(r => r.json());
        const select = document.getElementById('studentBatchFilter');
        select.innerHTML = '<option value="">All Batches</option>' + batches.map(b => '<option value="' + b.id + '" data-name="' + b.name + '">' + b.name + '</option>').join('');
    } catch (err) {
        console.error('Error loading batches for filter:', err);
    }
}

function filterStudentsByBatch() {
    studentsCurrentPage = 1;
    const selectedBatch = document.getElementById('studentBatchFilter').value;
    const selectedCourse = document.getElementById('studentCourseFilter').value;
    const searchQuery = document.getElementById('studentSearch').value.toLowerCase();
    
    let filtered = allStudents;
    
    // Filter by course
    if (selectedCourse) {
        filtered = filtered.filter(s => s.course === selectedCourse);
    }
    
    // Filter by batch (using batchId for consistency with batch page)
    if (selectedBatch) {
        filtered = filtered.filter(s => s.batchId == selectedBatch);
    }
    
    // Filter by search query
    if (searchQuery) {
        filtered = filtered.filter(s =>
            s.name.toLowerCase().includes(searchQuery) ||
            s.rollNo.toLowerCase().includes(searchQuery) ||
            (s.phone && s.phone.includes(searchQuery)) ||
            (s.course && s.course.toLowerCase().includes(searchQuery))
        );
    }
    
    renderStudentsTable(filtered);
}

function renderStudentsTable(students) {
    studentsFiltered = students;
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
        renderEmptyState(tbody, 'user-graduate', 'No students found. Click "New Admission" to add one.');
        document.getElementById('studentsPagination').innerHTML = '';
        return;
    }
    const totalPages = Math.ceil(students.length / studentsPerPage);
    if (studentsCurrentPage > totalPages) studentsCurrentPage = 1;
    const startIdx = (studentsCurrentPage - 1) * studentsPerPage;
    const pageStudents = students.slice(startIdx, startIdx + studentsPerPage);
    tbody.innerHTML = pageStudents.map(s => {
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
        html += '<td class="action-cell" style="position:relative;">';
        html += '<button class="action-btn options-btn" onclick="toggleRowActions(this, event)" title="Options"><i class="fas fa-ellipsis-v"></i></button>';
        html += '<div class="row-actions-menu" style="display:none;">';
        html += '<button onclick="openStudentProfile(' + s.id + ')"><i class="fas fa-eye"></i> View Profile</button>';
        html += '<button onclick="openUpdateStudentModal(' + s.id + ')"><i class="fas fa-edit"></i> Edit</button>';
        html += '<button onclick="openUpdateStudentIdModal(' + s.id + ')"><i class="fas fa-hashtag"></i> Update Student ID</button>';
        html += '<button onclick="showStudentQR(' + s.id + ')"><i class="fas fa-qrcode"></i> QR Code</button>';
        html += '<button onclick="printStudentForm(' + s.id + ')"><i class="fas fa-print"></i> Print Form</button>';
        html += '<button onclick="generateICard(' + s.id + ')"><i class="fas fa-id-card"></i> Generate I-Card</button>';
        html += '<button onclick="openNotificationModal(' + s.id + ', \'' + s.name.replace(/'/g, "\\'") + '\')"><i class="fas fa-bell"></i> Send Notification</button>';
        html += '<button onclick="openStudentNotificationsModal(' + s.id + ', \'' + s.name.replace(/'/g, "\\'") + '\')"><i class="fas fa-bell-slash"></i> Notification Settings</button>';
        html += '<button class="delete-action" onclick="deleteStudent(' + s.id + ')"><i class="fas fa-trash"></i> Delete</button>';
        html += '</div>';
        html += '</td>';
        html += '</tr>';
        return html;
    }).join('');
    renderStudentsPagination(totalPages);
}

function renderStudentsPagination(totalPages) {
    const container = document.getElementById('studentsPagination');
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    let html = '';
    html += '<button class="pagination-btn" onclick="goToStudentPage(' + (studentsCurrentPage - 1) + ')" ' + (studentsCurrentPage === 1 ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
    const maxVisible = 7;
    let startPage = Math.max(1, studentsCurrentPage - 3);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
    if (startPage > 1) {
        html += '<button class="pagination-btn" onclick="goToStudentPage(1)">1</button>';
        if (startPage > 2) html += '<span class="pagination-ellipsis">...</span>';
    }
    for (let i = startPage; i <= endPage; i++) {
        html += '<button class="pagination-btn' + (i === studentsCurrentPage ? ' active"' : '"') + ' onclick="goToStudentPage(' + i + ')">' + i + '</button>';
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="pagination-ellipsis">...</span>';
        html += '<button class="pagination-btn" onclick="goToStudentPage(' + totalPages + ')">' + totalPages + '</button>';
    }
    html += '<button class="pagination-btn" onclick="goToStudentPage(' + (studentsCurrentPage + 1) + ')" ' + (studentsCurrentPage === totalPages ? 'disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
    html += '<span class="pagination-info">Page ' + studentsCurrentPage + ' of ' + totalPages + '</span>';
    container.innerHTML = html;
}

function goToStudentPage(page) {
    const totalPages = Math.ceil(studentsFiltered.length / studentsPerPage);
    if (page < 1 || page > totalPages) return;
    studentsCurrentPage = page;
    renderStudentsTable(studentsFiltered);
}

function filterStudents() {
    studentsCurrentPage = 1;
    filterStudentsByBatch();
}

function toggleRowActions(btn, event) {
    event.stopPropagation();
    const menu = btn.nextElementSibling;
    const isOpen = menu.style.display === 'block';
    document.querySelectorAll('.row-actions-menu').forEach(m => m.style.display = 'none');
    if (!isOpen) {
        menu.style.display = 'block';
    }
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.action-cell')) {
        document.querySelectorAll('.row-actions-menu').forEach(m => m.style.display = 'none');
    }
});

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
            loadDashboard();
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
        loadDashboard();
    } catch (e) {
        console.error('Error deleting students:', e);
        showNotification('Error deleting students', 'error');
    }
}

async function showAdmissionForm() {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-admission').classList.remove('hidden');
    if (typeof updateHeaderForPage === 'function') updateHeaderForPage('admission');
    if (typeof updateHeaderToolbar === 'function') updateHeaderToolbar(document.getElementById('page-admission'));
    document.getElementById('admissionForm').reset();
    const admDateEl = document.getElementById('sAdmDate');
    if (admDateEl) admDateEl.value = new Date().toISOString().split('T')[0];
    const photoPreview = document.getElementById('sPhotoPreview');
    const photoPlaceholder = document.getElementById('sPhotoPlaceholder');
    if (photoPreview) photoPreview.style.display = 'none';
    if (photoPlaceholder) photoPlaceholder.style.display = 'block';
    const sigPreview = document.getElementById('sSignaturePreview');
    const sigPlaceholder = document.getElementById('sSignaturePlaceholder');
    if (sigPreview) sigPreview.style.display = 'none';
    if (sigPlaceholder) sigPlaceholder.style.display = 'block';
    const docsList = document.getElementById('sDocsList');
    if (docsList) docsList.textContent = 'Click to upload (multiple allowed)';
    ['sAadharDocName','s10thMarksheetName','s12thMarksheetName','sGradMarksheetName'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = 'Click to upload';
    });
    ['sGradMarksheetGroup','sTransactionGroup'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    const payNowEl = document.getElementById('sPayNow');
    const pendingFeesEl = document.getElementById('sPendingFees');
    if (payNowEl) payNowEl.value = '';
    if (pendingFeesEl) pendingFeesEl.value = '';
    await loadCoursesForAdmission();
}

function showStudentsPage() {
    document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-page="students"]').classList.add('active');
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-students').classList.remove('hidden');
    if (typeof updateHeaderForPage === 'function') updateHeaderForPage('students');
    if (typeof updateHeaderToolbar === 'function') updateHeaderToolbar(document.getElementById('page-students'));
    loadStudentsTable();
}

async function loadCoursesForAdmission() {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        console.log('Courses loaded:', courses);
        const sel = document.getElementById('sCourse');
        if (!sel) {
            console.error('sCourse element not found');
            return;
        }
        sel.innerHTML = '<option value="">-- Select Course --</option>' +
            courses.map(c => '<option value="' + c.name + '" data-fees="' + c.fee + '">' + c.name + ' (&#8377;' + c.fee + ')</option>').join('');
        sel.onchange = function() {
            const opt = sel.options[sel.selectedIndex];
            if (opt.dataset.fees) { document.getElementById('sTotalFees').value = opt.dataset.fees; calculatePayment(); }
            onCourseChange();
        };
        console.log('Courses populated in dropdown');
    } catch (e) {
        console.error('Error loading courses for admission:', e);
    }
}

function calculatePayment() {
    const total = parseInt(document.getElementById('sTotalFees').value) || 0;
    const isPartial = document.querySelector('input[name="sPayType"]:checked')?.value === 'partial';
    const payNow = isPartial ? Math.round(total * 0.4) : total;
    document.getElementById('sPayNow').value = payNow;
    // sPendingFees element doesn't exist in admin admission form
    if (document.getElementById('sPendingFees')) {
        document.getElementById('sPendingFees').value = total - payNow;
    }
    updatePaymentPercentage();
}

function calculatePaymentFromAmount() {
    const total = parseInt(document.getElementById('sTotalFees').value) || 0;
    const payNow = parseInt(document.getElementById('sPayNow').value) || 0;
    if (document.getElementById('sPendingFees')) {
        document.getElementById('sPendingFees').value = total - payNow;
    }
    updatePaymentPercentage();
}

function updatePaymentPercentage() {
    const total = parseInt(document.getElementById('sTotalFees').value) || 0;
    const payNow = parseInt(document.getElementById('sPayNow').value) || 0;
    const percentageEl = document.getElementById('paymentPercentage');
    const partialPayLabel = document.querySelector('#partialPayCard small');
    if (total > 0) {
        const percentage = Math.round((payNow / total) * 100);
        if (percentageEl) percentageEl.textContent = `You are paying: ${percentage}% of total fees`;
        if (partialPayLabel) partialPayLabel.textContent = `(${percentage}%)`;
    }
}

function toggleTransactionId() {
    const mode = document.getElementById('sPayMode').value;
    const isUPI = mode === 'UPI';
    const notCash = mode !== 'Cash';
    document.getElementById('sTransactionGroup').style.display = notCash ? 'block' : 'none';
    document.getElementById('sReceiptGroup').style.display = mode === 'Cash' ? 'block' : 'none';
}

function selectPaymentMode(mode) {
    document.querySelectorAll('.payment-mode-btn').forEach(btn => {
        btn.style.background = 'rgba(255,255,255,0.1)';
        btn.style.color = '#fff';
        btn.style.border = '1px solid rgba(255,255,255,0.3)';
    });
    const selectedBtn = document.querySelector(`[data-mode="${mode}"]`);
    if (selectedBtn) {
        selectedBtn.style.background = 'rgba(59,130,246,0.5)';
        selectedBtn.style.color = '#fff';
        selectedBtn.style.border = '1px solid rgba(59,130,246,0.6)';
    }

    document.getElementById('upiSection').style.display = mode === 'upi' ? 'block' : 'none';
    document.getElementById('cashSection').style.display = mode === 'cash' ? 'block' : 'none';
    document.getElementById('sPayMode').value = mode;
}

function calculatePaymentPercentage() {
    const total = parseInt(document.getElementById('sTotalFees').value) || 0;
    const payNow = parseInt(document.getElementById('sPayNow').value) || 0;
    const percentageDisplay = document.getElementById('paymentPercentageDisplay');
    
    if (total > 0 && payNow > 0) {
        const percentage = Math.round((payNow / total) * 100);
        percentageDisplay.style.display = 'block';
        document.getElementById('paymentPercentage').textContent = percentage + '%';
    } else {
        percentageDisplay.style.display = 'none';
    }
}

function previewDocFile(input, imgId, placeholderId) {
    const file = input.files[0];
    if (!file) return;

    // File size validation (2MB for photo, 1MB for signature)
    const maxSize = imgId === 'sPhotoPreview' ? 2 * 1024 * 1024 : 1 * 1024 * 1024;
    const maxSizeMB = imgId === 'sPhotoPreview' ? 2 : 1;

    if (file.size > maxSize) {
        showNotification(`File size exceeds ${maxSizeMB}MB limit. Please choose a smaller file.`, 'error');
        input.value = ''; // Clear the file input
        return;
    }

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
            const res = await fetch('/api/check-mobile?phone=' + phone);
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
        const res = await fetch('/api/check-email?email=' + encodeURIComponent(email));
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
        const res = await fetch('/api/check-aadhar?aadhar=' + aadhar);
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

    // Generate Application ID (same format as printStudentForm + apply.html)
    const year = new Date().getFullYear();
    const serial = String(student.id || student.rollNo || Date.now()).slice(-5).padStart(5, '0');
    const appId = student.applicationId || ('GCE-' + year + '-' + serial);

    // Personal info
    document.getElementById('adminPrintAppId').textContent = appId;
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

    // Generate QR code for admission verification
    try {
        const baseUrl = settings.websiteUrl || window.location.origin;
        const verifyUrl = `${baseUrl}/verify-application?appId=${encodeURIComponent(appId)}`;
        // Try server-side QR API first (consistent across forms), fallback to client-side QRCode lib
        let qrDataUrl = '';
        try {
            const qrRes = await fetch('/api/qr?text=' + encodeURIComponent(verifyUrl) + '&size=120');
            const qrData = await qrRes.json();
            if (qrData.success) qrDataUrl = qrData.dataUrl;
        } catch (_) {}
        if (!qrDataUrl && typeof QRCode !== 'undefined') {
            qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 });
        }
        document.getElementById('adminPrintQRImage').src = qrDataUrl;
    } catch (e) {
        console.error('Error generating QR code:', e);
        document.getElementById('adminPrintQRImage').src = '';
    }
    
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
    html += '    <body><div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04;"><img src="/uploads/logo/logo.png" style="max-width: 300px; max-height: 300px; border-radius: 12px;" onerror="this.parentElement.style.display=\'none\'"></div>' + content + '</body>\n';
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
        html += '<h4 style="margin:0 0 12px;color:#60a5fa;border-bottom:2px solid rgba(255,255,255,0.2);padding-bottom:8px;">Personal Information</h4>';
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
        html += '<h4 style="margin:0 0 12px;color:#60a5fa;border-bottom:2px solid rgba(255,255,255,0.2);padding-bottom:8px;">Educational Qualification</h4>';
        if (qual && qual.tenth) {
            html += '<div style="background:rgba(255,255,255,0.08);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);padding:12px;border-radius:6px;margin-bottom:10px;">';
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
            html += '<div style="background:rgba(255,255,255,0.08);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);padding:12px;border-radius:6px;margin-bottom:10px;">';
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
            html += '<div style="background:rgba(255,255,255,0.08);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);padding:12px;border-radius:6px;margin-bottom:10px;">';
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
        
        html += '<h4 style="margin:18px 0 10px;color:#60a5fa;border-bottom:2px solid rgba(255,255,255,0.2);padding-bottom:8px;">Payment History</h4>';
        html += '<div class="data-table">';
        html += '<table><thead><tr><th>Date</th><th>Amount</th><th>Type</th><th>Mode</th><th>Txn ID</th><th>Receipt</th></tr></thead>';
        html += '<tbody>' + (payRows || '<tr><td colspan="6" style="text-align:center;">No payments</td></tr>') + '</tbody></table></div>';

        html += '<h4 style="margin:18px 0 10px;color:#60a5fa;border-bottom:2px solid rgba(255,255,255,0.2);padding-bottom:8px;">Notifications</h4>';
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

function printStudentSlip(id) {
    const modalContent = document.querySelector('#studentProfileModal .modal-content');
    if (!modalContent) {
        showNotification('Error: Modal content not found!', 'error');
        return;
    }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Student Slip</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .profile-header { display: flex; gap: 20px; align-items: flex-start; padding: 20px; background: #f8fafc; border-radius: 10px; margin-bottom: 16px; }
                .profile-photo { width: 90px; height: 90px; border-radius: 50%; overflow: hidden; border: 3px solid #2563eb; }
                .profile-photo img { width: 100%; height: 100%; object-fit: cover; }
                .profile-meta h2 { margin: 0 0 8px; font-size: 1.25rem; }
                .profile-meta p { margin: 4px 0; font-size: 0.9rem; }
                .profile-fees { display: flex; gap: 14px; margin-bottom: 14px; }
                .fee-box { flex: 1; min-width: 140px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; text-align: center; }
                .fee-box-label { font-size: 0.8rem; color: #64748b; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; }
                .fee-box-amt { font-size: 1.35rem; font-weight: 700; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 10px; border: 1px solid #e2e8f0; text-align: left; }
                th { background: #f8fafc; }
                h4 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
                @media print { body { -webkit-print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            ${modalContent.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.onload = function() {
        printWindow.print();
    };
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
            loadBatchesTable();
            showNotification('Student profile updated!', 'success');
        } else {
            showNotification('Error updating student!', 'error');
        }
    } catch (err) {
        showNotification('Error updating student!', 'error');
    }
}

async function openUpdateStudentIdModal(id) {
    try {
        const s = await fetch('/api/students/' + id).then(r => r.json());
        document.getElementById('updateStudentIdRecordId').value = s.id;
        document.getElementById('updateStudentIdName').value = s.name;
        document.getElementById('updateStudentIdCurrent').value = s.rollNo;
        document.getElementById('updateStudentIdNew').value = '';
        document.getElementById('updateStudentIdModal').classList.add('active');
    } catch (err) {
        showNotification('Error loading student data!', 'error');
    }
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
            showNotification('Error generating QR code!', 'error');
            return;
        }
        document.getElementById('studentQRModal').classList.add('active');
    } catch (err) {
        showNotification('Error loading student QR!', 'error');
    }
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

async function saveStudentId() {
    const id = document.getElementById('updateStudentIdRecordId').value;
    const newId = document.getElementById('updateStudentIdNew').value.trim();
    if (!newId) {
        showNotification('New Student ID enter karein!', 'error');
        return;
    }
    try {
        const res = await fetch('/api/students/' + id + '/update-id', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newRollNo: newId })
        });
        const result = await res.json();
        if (result.success) {
            closeModal('updateStudentIdModal');
            loadStudentsTable();
            showNotification('Student ID updated successfully!', 'success');
        } else {
            showNotification(result.message || 'Error updating Student ID!', 'error');
        }
    } catch (err) {
        showNotification('Error updating Student ID!', 'error');
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
        html += '            <img src="' + (settings.logo || '') + '" alt="Logo" class="icard-logo" style="border-radius:8px;">\n';
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
        const courses = await fetch('/api/courses').then(r => r.json()).catch(() => []);
        const batches = await fetch('/api/batches').then(r => r.json()).catch(() => []);
        const courseInfo = (Array.isArray(courses) ? courses : []).find(c => c.name === s.course) || {};
        const batchInfo = (Array.isArray(batches) ? batches : []).find(b => b.name === s.batch && b.course === s.course) || {};
        
        // Parse qualification
        const qual = typeof s.qualification === 'string' ? JSON.parse(s.qualification) : s.qualification;
        
        // Title Case helper
        function toTitleCase(str) {
            if (!str || typeof str !== 'string') return str;
            const smallWords = /^(a|an|and|as|at|but|by|en|for|if|in|of|on|or|the|to|vs?\.?|via)$/i;
            return str.replace(/\w\S*/g, (txt, i) => {
                if (i > 0 && smallWords.test(txt)) return txt.toLowerCase();
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        }
        
        // Application ID: use stored if available, else generate
        const year = new Date().getFullYear();
        const serial = String(s.id || s.rollNo || Date.now()).slice(-5).padStart(5, '0');
        const appId = s.applicationId || ('GCE-' + year + '-' + serial);
        const todayStr = formatDate(new Date());
        const place = settings.address || 'Batauli, Surguja (C.G.)';
        const nowIso = new Date().toISOString();
        
        // Tamper token
        const raw = 'gce|' + appId + '|' + nowIso;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            const chr = raw.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        const token = ('00000000' + Math.abs(hash).toString(16)).slice(-8).toUpperCase();
        
        // Fetch QR code
        let qrDataUrl = '';
        const verifyUrl = window.location.origin + '/verify-application?appId=' + encodeURIComponent(appId);
        try {
            const qrRes = await fetch('/api/qr?text=' + encodeURIComponent(verifyUrl) + '&size=120');
            const qrData = await qrRes.json();
            if (qrData.success) qrDataUrl = qrData.dataUrl;
        } catch (e) { }
        
        // All payments (most recent first)
        const allPayments = (s.fees && s.fees.payments && s.fees.payments.length) ? [...s.fees.payments].reverse() : [];
        
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
        html += '        body { font-family: \'Times New Roman\', serif; margin: 0; padding: 18px 24px; background: white; position: relative; }\n';
        html += '        .watermark-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-repeat: repeat; background-size: 200px 200px; opacity: 0.06; z-index: 0; pointer-events: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n';
        html += '        .header { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; border-bottom: 4px solid #1e40af; padding-bottom: 20px; position: relative; z-index: 1; }\n';
        html += '        .header-logo { width: 90px; height: 90px; object-fit: contain; flex-shrink: 0; }\n';
        html += '        .header-left { flex: 1; text-align: center; }\n';
        html += '        .header h1 { margin: 0; color: #1e40af; font-size: 26px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; white-space: nowrap; }\n';
        html += '        .header .subtitle { margin: 3px 0 0; color: #3b82f6; font-size: 18px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; }\n';
        html += '        .header .contact-info { margin: 2px 0 0; color: #3b82f6; font-size: 15px; font-weight: 500; letter-spacing: 1px; }\n';
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
        html += '        .section { margin-bottom: 14px; }\n';
        html += '        .section-title { page-break-after: avoid; }\n';
        html += '        table tr, table thead, table tbody { page-break-inside: avoid; }\n';
        html += '        .personal-section { page-break-inside: avoid; }\n';
        html += '        .signatures { margin-top: 30px; padding-top: 12px; page-break-inside: avoid; }\n';
        html += '        .signatures .flex { display: flex; justify-content: space-between; align-items: flex-start; }\n';
        html += '        .sig-block { text-align: center; width: 280px; }\n';
        html += '        .sig-box-dashed { border: 2px dashed #94a3b8; height: 70px; width: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: #f8fafc; }\n';
        html += '        .sig-label { margin-top: 8px; font-weight: 700; color: #1e40af; font-size: 14px; }\n';
        html += '        .sig-meta { font-size: 12px; color: #64748b; margin-top: 4px; }\n';
        html += '        .footer { margin-top: 35px; padding-top: 18px; border-top: 2px solid #1e40af; text-align: center; font-size: 13px; color: #64748b; }\n';
        html += '        .footer p { margin: 6px 0; }\n';
        html += '        .generated-date { font-size: 12px; }\n';
        html += '    </style>\n';
        html += '</head>\n';
        html += '<body>\n';
        html += '    <div class="watermark-bg" style="background-image: url(\'' + (settings.logo || '') + '\');"></div>\n';
        html += '    <div class="header">\n';
        if (settings.logo) {
            html += '        <img src="' + settings.logo + '" alt="Logo" class="header-logo" onerror="this.style.display=\'none\'">\n';
        }
        html += '        <div class="header-left">\n';
        html += '            <h1>' + (settings.name || 'Institute Name') + '</h1>\n';
        html += '            <p class="subtitle">Admission Application Form</p>\n';
        html += '            <p class="contact-info">' + (settings.address || 'Institute Address') + '</p>\n';
        html += '            <p class="contact-info">Phone: ' + (settings.phone || 'XXXXXXXXXX') + ' | Email: ' + (settings.email || 'contact@institute.com') + '</p>\n';
        html += '        </div>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="app-info">\n';
        html += '        <table>\n';
        html += '            <tr>\n';
        html += '                <td style="font-weight: 700; color: #1e40af; width: 15%;">Application ID:</td>\n';
        html += '                <td style="font-weight: 600; color: #0f172a;">' + appId + '</td>\n';
        html += '                <td style="font-weight: 700; color: #1e40af; width: 10%;">Date:</td>\n';
        html += '                <td style="font-weight: 600; color: #0f172a;">' + todayStr + '</td>\n';
        html += '                <td style="width: 110px; vertical-align: middle; text-align: center;" rowspan="2">\n';
        if (qrDataUrl) {
            html += '                    <img src="' + qrDataUrl + '" alt="Verify" style="width: 100px; height: 100px; display: block; margin: 0 auto; border: 2px solid #1e40af; border-radius: 6px; background: #fff; padding: 3px;">\n';
            html += '                    <div style="font-size: 9px; color: #1e40af; font-weight: 600; margin-top: 3px;">Scan to Verify</div>\n';
        }
        html += '                </td>\n';
        html += '            </tr>\n';
        html += '            <tr>\n';
        html += '                <td style="font-weight: 700; color: #1e40af; width: 15%;">Roll No:</td>\n';
        html += '                <td style="font-weight: 600; color: #0f172a;">' + (s.rollNo || '-') + '</td>\n';
        html += '                <td style="font-weight: 700; color: #1e40af; width: 10%;">Place:</td>\n';
        html += '                <td style="font-weight: 600; color: #0f172a;">' + place + '</td>\n';
        html += '            </tr>\n';
        html += '        </table>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">1. Personal Information</h3>\n';
        html += '        <div class="personal-section">\n';
        html += '            <table class="personal-table">\n';
        html += '                <tr><td class="label">Full Name</td><td class="value" colspan="3">' + (toTitleCase(s.name) || '-') + '</td></tr>\n';
        html += '                <tr><td class="label">Date of Birth</td><td class="value">' + (s.dob || '-') + '</td><td class="label">Gender</td><td class="value">' + (s.gender || '-') + '</td></tr>\n';
        html += '                <tr><td class="label">Category</td><td class="value">' + (s.category || '-') + '</td><td class="label">Blood Group</td><td class="value">' + (s.bloodGroup || '-') + '</td></tr>\n';
        html += '                <tr><td class="label">Mobile Number</td><td class="value">' + (s.phone || '-') + '</td><td class="label">WhatsApp</td><td class="value">' + (s.whatsapp || s.phone || '-') + '</td></tr>\n';
        html += '                <tr><td class="label">Email Address</td><td class="value" colspan="3">' + (s.email || '-') + '</td></tr>\n';
        html += '                <tr><td class="label">Aadhar Number</td><td class="value">' + (s.aadhar || '-') + '</td><td class="label">Reference</td><td class="value">' + (toTitleCase(s.reference) || '-') + '</td></tr>\n';
        html += '                <tr><td class="label">Emergency Contact</td><td class="value" colspan="3">' + (s.emergencyContact || s.fatherPhone || '-') + '</td></tr>\n';
        html += '                <tr><td class="label">Address</td><td class="value" colspan="3">' + (s.address || '-') + '</td></tr>\n';
        html += '            </table>\n';
        html += '            <div class="photo-sig-right">\n';
        html += '                <div class="photo-box">\n';
        if (s.photo) {
            html += '                    <img src="' + s.photo + '" alt="Photo" onerror="this.parentNode.innerHTML=\'<div style=&quot;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;text-align:center;&quot;>Photo<br>Not Available</div>\'">\n';
        } else {
            html += '                    <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;text-align:center;">Photo<br>Not Available</div>\n';
        }
        html += '                </div>\n';
        html += '                <div class="sig-box">\n';
        if (s.signature) {
            html += '                    <img src="' + s.signature + '" alt="Signature" onerror="this.parentNode.innerHTML=\'<div style=&quot;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;&quot;>Signature</div>\'">\n';
        } else {
            html += '                    <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;">Signature</div>\n';
        }
        html += '                </div>\n';
        html += '            </div>\n';
        html += '        </div>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">2. Parent / Guardian Information</h3>\n';
        html += '        <table class="data-table">\n';
        html += '            <tr><td class="label">Father\'s Name</td><td class="value">' + (toTitleCase(s.fatherName) || '-') + '</td><td class="label">Father\'s Occupation</td><td class="value">' + (toTitleCase(s.fatherOccupation) || '-') + '</td></tr>\n';
        html += '            <tr><td class="label">Father\'s Phone</td><td class="value">' + (s.fatherPhone || '-') + '</td><td class="label">Mother\'s Name</td><td class="value">' + (toTitleCase(s.motherName) || '-') + '</td></tr>\n';
        html += '            <tr><td class="label">Mother\'s Occupation</td><td class="value">' + (toTitleCase(s.motherOccupation) || '-') + '</td><td class="label">Mother\'s Phone</td><td class="value">' + (s.motherPhone || '-') + '</td></tr>\n';
        html += '            <tr><td class="label">Annual Family Income</td><td class="value">' + (s.familyIncome ? '₹' + s.familyIncome : '-') + '</td><td class="label">Guardian (if any)</td><td class="value">' + (toTitleCase(s.guardianName) || '-') + '</td></tr>\n';
        html += '        </table>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">3. Course Information</h3>\n';
        html += '        <table class="data-table">\n';
        html += '            <tr><td class="label">Course Name</td><td class="value" colspan="3">' + (toTitleCase(s.course) || '-') + '</td></tr>\n';
        html += '            <tr><td class="label">Course Duration</td><td class="value">' + (courseInfo.duration || '-') + '</td><td class="label">Eligibility</td><td class="value">' + (courseInfo.eligibility || '-') + '</td></tr>\n';
        html += '            <tr><td class="label">Batch</td><td class="value">' + (toTitleCase(s.batch) || '-') + '</td><td class="label">Class Timing</td><td class="value">' + (batchInfo.timing || '-') + '</td></tr>\n';
        html += '            <tr><td class="label">Batch Start Date</td><td class="value">' + (batchInfo.startDate || '-') + '</td><td class="label">Admission Date</td><td class="value">' + (s.admissionDate || '-') + '</td></tr>\n';
        html += '        </table>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">4. Educational Qualification</h3>\n';
        if (qual && qual.tenth) {
            html += '        <table class="data-table" style="margin-bottom: 10px;">\n';
            html += '            <tr class="sub-header"><td colspan="4">10th Standard</td></tr>\n';
            html += '            <tr><td class="label">Board</td><td class="value">' + (toTitleCase(qual.tenth.board) || '-') + '</td><td class="label">School</td><td class="value">' + (toTitleCase(qual.tenth.school) || '-') + '</td></tr>\n';
            html += '            <tr><td class="label">Year</td><td class="value">' + (qual.tenth.year || '-') + '</td><td class="label">Roll No</td><td class="value">' + (qual.tenth.roll || '-') + '</td></tr>\n';
            html += '            <tr><td class="label">Total Marks</td><td class="value">' + (qual.tenth.total || '-') + '</td><td class="label">Obtained Marks</td><td class="value">' + (qual.tenth.obtained || '-') + '</td></tr>\n';
            html += '            <tr><td class="label">Percentage</td><td class="value">' + (qual.tenth.percentage || '-') + '</td><td class="label">Division</td><td class="value">' + (qual.tenth.division || '-') + '</td></tr>\n';
            html += '        </table>\n';
        }
        
        if (qual && qual.twelfth) {
            html += '        <table class="data-table" style="margin-bottom: 10px;">\n';
            html += '            <tr class="sub-header"><td colspan="4">12th Standard</td></tr>\n';
            html += '            <tr><td class="label">Board</td><td class="value">' + (toTitleCase(qual.twelfth.board) || '-') + '</td><td class="label">School</td><td class="value">' + (toTitleCase(qual.twelfth.school) || '-') + '</td></tr>\n';
            html += '            <tr><td class="label">Stream</td><td class="value">' + (toTitleCase(qual.twelfth.stream) || '-') + '</td><td class="label">Year</td><td class="value">' + (qual.twelfth.year || '-') + '</td></tr>\n';
            html += '            <tr><td class="label">Roll No</td><td class="value">' + (qual.twelfth.roll || '-') + '</td><td class="label">Percentage</td><td class="value">' + (qual.twelfth.percentage || '-') + '</td></tr>\n';
            html += '            <tr><td class="label">Division</td><td class="value">' + (qual.twelfth.division || '-') + '</td><td class="value"></td><td class="value"></td></tr>\n';
            html += '        </table>\n';
        }
        
        if (qual && qual.graduation) {
            html += '        <table class="data-table">\n';
            html += '            <tr class="sub-header"><td colspan="4">Graduation</td></tr>\n';
            html += '            <tr><td class="label">University</td><td class="value">' + (toTitleCase(qual.graduation.university) || '-') + '</td><td class="label">College</td><td class="value">' + (toTitleCase(qual.graduation.college) || '-') + '</td></tr>\n';
            html += '            <tr><td class="label">Degree</td><td class="value">' + (toTitleCase(qual.graduation.degree) || '-') + '</td><td class="label">Stream</td><td class="value">' + (toTitleCase(qual.graduation.stream) || '-') + '</td></tr>\n';
            html += '            <tr><td class="label">Year</td><td class="value">' + (qual.graduation.year || '-') + '</td><td class="label">Enrollment No</td><td class="value">' + (qual.graduation.enroll || '-') + '</td></tr>\n';
            html += '            <tr><td class="label">Percentage</td><td class="value">' + (qual.graduation.percentage || '-') + '</td><td class="label">Division</td><td class="value">' + (qual.graduation.division || '-') + '</td></tr>\n';
            html += '        </table>\n';
        }
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">5. Payment Information</h3>\n';
        html += '        <table class="data-table">\n';
        html += '            <tr><td class="label">Total Fees</td><td class="value">&#8377;' + s.fees.totalFees + '</td><td class="label">Paid Amount</td><td class="value" style="color: #16a34a; font-weight: 700;">&#8377;' + s.fees.paidAmount + '</td></tr>\n';
        const isFullyPaid = (s.fees.dueAmount || 0) === 0;
        const paymentPercentage = s.fees.totalFees > 0 ? Math.round((s.fees.paidAmount / s.fees.totalFees) * 100) : 0;
        const paymentStatus = isFullyPaid ? 'Full Payment' : (paymentPercentage + '% Paid');
        html += '            <tr><td class="label">Pending Fees</td><td class="value" style="color: ' + (isFullyPaid ? '#16a34a' : '#d97706') + '; font-weight: 700;">&#8377;' + s.fees.dueAmount + '</td><td class="label">Payment Status</td><td class="value" style="color: ' + (isFullyPaid ? '#16a34a' : '#d97706') + '; font-weight: 700;">' + paymentStatus + '</td></tr>\n';
        html += '        </table>\n';
        if (allPayments.length > 0) {
            html += '        <table class="data-table" style="margin-top:8px;">\n';
            html += '            <tr class="sub-header"><td colspan="5" style="text-align:center;">Payment History (' + allPayments.length + ' transaction' + (allPayments.length > 1 ? 's' : '') + ')</td></tr>\n';
            html += '            <tr style="background:#dbeafe;"><td class="label" style="width:8%;">#</td><td class="label">Date</td><td class="label">Amount</td><td class="label">Mode</td><td class="label">Receipt / Txn ID</td></tr>\n';
            allPayments.forEach((p, idx) => {
                const txnRef = p.receipt || p.transactionId || p.utrNumber || p.upiId || '-';
                html += '            <tr><td class="value">' + (idx + 1) + '</td><td class="value">' + (p.date || '-') + '</td><td class="value" style="color:#16a34a;font-weight:700;">&#8377;' + (p.amount || 0) + '</td><td class="value">' + (p.mode || '-') + '</td><td class="value" style="font-family:monospace;font-size:12px;">' + txnRef + '</td></tr>\n';
            });
            html += '        </table>\n';
        }
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">6. Documents Submitted</h3>\n';
        html += '        <table class="data-table">\n';
        html += '            <tr><td class="value" style="width:50%;">&#9744; Aadhar Card Copy</td><td class="value">&#9744; 10th Marksheet</td></tr>\n';
        html += '            <tr><td class="value">&#9744; 12th Marksheet</td><td class="value">&#9744; Graduation Certificate (if applicable)</td></tr>\n';
        html += '            <tr><td class="value">&#9744; Passport Size Photographs (2 copies)</td><td class="value">&#9744; Address Proof</td></tr>\n';
        html += '            <tr><td class="value">&#9744; Caste/Category Certificate (if applicable)</td><td class="value">&#9744; Income Certificate (if applicable)</td></tr>\n';
        html += '        </table>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">7. Declaration &amp; Undertaking (घोषणा एवं प्रतिज्ञा पत्र)</h3>\n';
        html += '        <div style="background: #f8fafc; padding: 18px; border: 2px solid #1e40af; margin-top: 0;">\n';
        html += '            <p style="margin: 0 0 12px 0; font-weight: 600; color: #1e40af; font-size: 13px;">I, the undersigned, hereby declare and solemnly affirm that (मैं नीचे हस्ताक्षर कर्ता, घोषणा एवं शपथपूर्वक पुष्टि करता/करती हूं कि):</p>\n';
        html += '            <ol style="margin: 0; padding-left: 22px; line-height: 1.8; color: #0f172a; font-size: 13px;">\n';
        html += '                <li>All information furnished in this application is true, complete and correct to the best of my knowledge. (इस आवेदन में दी गई सभी जानकारी मेरी जानकारी में सही, पूर्ण और सत्य है।)</li>\n';
        html += '                <li>I have read and understood all the rules, regulations and disciplinary norms of the institute and agree to abide by them. (मैंने संस्थान के सभी नियम, विनियम और अनुशासनात्मक मानदंडों को पढ़ लिया है और उनका पालन करने के लिए सहमत हूं।)</li>\n';
        html += '                <li>I understand that the admission fee once paid is non-refundable under any circumstances. (मुझे पता है कि एक बार जमा की गई फीस किसी भी स्थिति में वापस नहीं की जाएगी।)</li>\n';
        html += '                <li>I undertake to maintain a minimum of 75% attendance throughout the course duration. (मैं पाठ्यक्रम की अवधि के दौरान न्यूनतम 75% उपस्थिति बनाए रखने का वचन देता/देती हूं।)</li>\n';
        html += '                <li>I will maintain decorum and discipline during classes and within institute premises. (मैं कक्षाओं और संस्थान परिसर के भीतर शालीनता और अनुशासन बनाए रखूंगा/रखूंगी।)</li>\n';
        html += '                <li>I will take proper care of institute property including computers, furniture and equipment; and shall be liable for any damage caused by negligence. (मैं संस्थान की संपत्ति का उचित ध्यान रखूंगा/रखूंगी और लापरवाही से हुए किसी भी नुकसान के लिए उत्तरदायी होऊंगा/होऊंगी।)</li>\n';
        html += '                <li>I will not engage in or support ragging, misconduct, indiscipline or any unlawful activity. (मैं रैगिंग, दुर्व्यवहार, अनुशासनहीनता या किसी भी गैरकानूनी गतिविधि में भाग नहीं लूंगा/लूंगी।)</li>\n';
        html += '                <li>I will respect all faculty members, staff and fellow students at all times. (मैं हमेशा सभी संकाय सदस्यों, कर्मचारियों और सहपाठियों का सम्मान करूंगा/करूंगी।)</li>\n';
        html += '                <li>I will submit all assignments, projects and practical work within the stipulated deadlines. (मैं निर्धारित समय सीमा के भीतर सभी असाइनमेंट, प्रोजेक्ट और प्रैक्टिकल कार्य जमा करूंगा/करूंगी।)</li>\n';
        html += '                <li>I will strictly follow all examination rules and will not resort to unfair means or cheating. (मैं सभी परीक्षा नियमों का कड़ाई से पालन करूंगा/करूंगी और किसी भी अनुचित साधन या नकल का सहारा नहीं लूंगा/लूंगी।)</li>\n';
        html += '            </ol>\n';
        html += '            <p style="margin: 12px 0 0 0; font-weight: 700; color: #dc2626; font-size: 13px;">I understand that any false statement or concealment of facts may lead to cancellation of my admission and legal action. (मुझे पता है कि कोई भी झूठा बयान या तथ्यों को छिपाने पर मेरा प्रवेश रद्द किया जा सकता है और कानूनी कार्रवाई की जा सकती है।)</p>\n';
        html += '        </div>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="section">\n';
        html += '        <h3 class="section-title">8. For Office Use Only</h3>\n';
        html += '        <table class="data-table">\n';
        html += '            <tr><td class="label" style="width:25%;">Verified By</td><td class="value">&nbsp;</td><td class="label" style="width:25%;">Verification Date</td><td class="value">&nbsp;</td></tr>\n';
        html += '            <tr><td class="label">Approved By</td><td class="value">&nbsp;</td><td class="label">Approval Date</td><td class="value">&nbsp;</td></tr>\n';
        html += '            <tr><td class="label">Remarks</td><td class="value" colspan="3" style="height:50px;">&nbsp;</td></tr>\n';
        html += '        </table>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="signatures">\n';
        html += '        <div class="flex">\n';
        html += '            <div class="sig-block">\n';
        if (s.signature) {
            html += '                <div class="sig-box-dashed" style="border-style:solid;"><img src="' + s.signature + '" alt="Sig" style="max-height:60px;max-width:100%;object-fit:contain;" onerror="this.parentNode.innerHTML=\'<span style=&quot;color:#94a3b8;font-size:12px;&quot;>Student Signature</span>\'"></div>\n';
        } else {
            html += '                <div class="sig-box-dashed"><span style="color: #94a3b8; font-size: 12px;">Student Signature</span></div>\n';
        }
        html += '                <div class="sig-label">Student Signature</div>\n';
        html += '                <div class="sig-meta">Date: ' + todayStr + '</div>\n';
        html += '                <div class="sig-meta">Place: ' + place + '</div>\n';
        html += '            </div>\n';
        html += '            <div class="sig-block">\n';
        html += '                <div class="sig-box-dashed"><span style="color: #94a3b8; font-size: 12px;">Parent / Guardian Signature</span></div>\n';
        html += '                <div class="sig-label">Parent / Guardian Signature</div>\n';
        html += '                <div class="sig-meta">Date: ' + todayStr + '</div>\n';
        html += '                <div class="sig-meta">Place: ' + place + '</div>\n';
        html += '            </div>\n';
        html += '            <div class="sig-block">\n';
        html += '                <div class="sig-box-dashed"><span style="color: #94a3b8; font-size: 12px;">Authorized Signature &amp; Official Seal</span></div>\n';
        html += '                <div class="sig-label">Authorized Signature &amp; Official Seal</div>\n';
        html += '                <div class="sig-meta">Date: ' + todayStr + '</div>\n';
        html += '                <div class="sig-meta">Place: ' + place + '</div>\n';
        html += '            </div>\n';
        html += '        </div>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <div class="footer">\n';
        html += '        <p style="font-weight: 600;">This is a computer-generated admission application form.</p>\n';
        html += '        <p>For any queries, please contact the institute administration.</p>\n';
        html += '        <p class="generated-date">Generated on: ' + formatDate(new Date()) + ' | Token: ' + token + '</p>\n';
        html += '    </div>\n';
        html += '    \n';
        html += '    <script>\n';
        html += '        function triggerPrint() {\n';
        html += '            setTimeout(function(){ window.focus(); window.print(); }, 400);\n';
        html += '            window.onafterprint = function() { window.close(); };\n';
        html += '        }\n';
        html += '        if (document.readyState === "complete") { triggerPrint(); }\n';
        html += '        else { window.addEventListener("load", triggerPrint); }\n';
        html += '    </script>\n';
        html += '</body>\n';
        html += '</html>\n';
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
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
            html += '<div style="display:flex; gap:8px; margin-top:8px;">';
            html += '<button class="action-btn edit-btn" onclick="editCarouselItem(' + item.id + ')"><i class="fas fa-edit"></i> Edit</button>';
            html += '<button class="action-btn delete-btn" onclick="deleteCarouselItem(' + item.id + ')"><i class="fas fa-trash"></i> Delete</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            return html;
        }).join('');
    } catch (err) { showNotification('Error loading carousel!', 'error'); }
}

function openCarouselModal(editMode = false, itemId = null) {
    document.getElementById('carouselCaption').value = '';
    document.getElementById('carouselFile').value = '';
    document.getElementById('carouselPreviewImg').style.display = 'none';
    document.getElementById('carouselPlaceholder').style.display = 'block';
    carouselImageFile = null;
    document.getElementById('carouselModal').classList.add('active');
    document.getElementById('carouselModal').dataset.editMode = editMode || 'false';
    document.getElementById('carouselModal').dataset.itemId = itemId || '';
    
    // Update modal title and button text based on mode
    const titleEl = document.getElementById('carouselModalTitle');
    const saveBtnEl = document.getElementById('carouselSaveBtn');
    
    if (editMode && itemId) {
        titleEl.textContent = 'Edit Carousel Image';
        saveBtnEl.textContent = 'Update Carousel';
        loadCarouselItemForEdit(itemId);
    } else {
        titleEl.textContent = 'Add Carousel Image';
        saveBtnEl.textContent = 'Add to Carousel';
    }
}

async function loadCarouselItemForEdit(id) {
    try {
        const res = await fetch('/api/carousel');
        const data = await res.json();
        if (data.success && data.carousel) {
            const item = data.carousel.find(i => i.id == id);
            if (item) {
                document.getElementById('carouselCaption').value = item.caption || '';
                document.getElementById('carouselPreviewImg').src = item.image;
                document.getElementById('carouselPreviewImg').style.display = 'block';
                document.getElementById('carouselPlaceholder').style.display = 'none';
            } else {
                showNotification('Carousel item not found!', 'error');
            }
        }
    } catch (err) { 
        console.error('Error loading carousel item:', err);
        showNotification('Error loading carousel item!', 'error'); 
    }
}

async function editCarouselItem(id) {
    openCarouselModal(true, id);
}

async function saveCarouselItem() {
    const editMode = document.getElementById('carouselModal').dataset.editMode === 'true';
    const itemId = document.getElementById('carouselModal').dataset.itemId;
    const caption = document.getElementById('carouselCaption').value;
    
    if (!caption) { showNotification('Caption is required!', 'error'); return; }
    
    const formData = new FormData();
    if (carouselImageFile) {
        formData.append('image', carouselImageFile);
    }
    formData.append('caption', caption);
    
    try {
        let url = '/api/carousel';
        let method = 'POST';
        
        if (editMode && itemId) {
            url = '/api/carousel/' + itemId;
            method = 'PUT';
        }
        
        const res = await fetch(url, { method, body: formData });
        const data = await res.json();
        if (data.success) {
            closeModal('carouselModal');
            carouselImageFile = null;
            loadCarouselAdmin();
            showNotification(editMode ? 'Carousel updated!' : 'Carousel added!', 'success');
        } else {
            showNotification(data.message || 'Operation failed!', 'error');
        }
    } catch (err) { showNotification('Error saving carousel!', 'error'); }
}

async function deleteCarouselItem(id) {
    if (!confirm('Delete this carousel image?')) return;
    try {
        await fetch('/api/carousel/' + id, { method: 'DELETE' });
        loadCarouselAdmin();
        showNotification('Deleted!', 'success');
    } catch (err) { showNotification('Error!', 'error'); }
}

// ===== Hero Text Management =====
async function loadHeroText() {
    try {
        const res = await fetch('/api/hero-text');
        const data = await res.json();
        if (data.success && data.heroText) {
            // Desktop fields
            document.getElementById('heroHeading').value = data.heroText.heading || '';
            document.getElementById('heroSubheading').value = data.heroText.subheading || '';
            document.getElementById('heroHeadingSize').value = data.heroText.headingSize || 3;
            document.getElementById('heroSubheadingSize').value = data.heroText.subheadingSize || 1.3;
            document.getElementById('heroAnimation').value = data.heroText.animation || 'none';
            document.getElementById('heroButton1Text').value = data.heroText.button1Text || 'View Courses';
            document.getElementById('heroButton2Text').value = data.heroText.button2Text || 'Apply Online';
            
            // Mobile fields
            document.getElementById('heroHeadingMobile').value = data.heroText.headingMobile || '';
            document.getElementById('heroSubheadingMobile').value = data.heroText.subheadingMobile || '';
            document.getElementById('heroHeadingSizeMobile').value = data.heroText.headingSizeMobile || 1.2;
            document.getElementById('heroSubheadingSizeMobile').value = data.heroText.subheadingSizeMobile || 1;
            document.getElementById('heroButton1TextMobile').value = data.heroText.button1TextMobile || 'View Courses';
            document.getElementById('heroButton2TextMobile').value = data.heroText.button2TextMobile || 'Apply Online';
            
            // Setup hero tab switching
            setupHeroTabs();
            // Setup hero section tab switching
            setupHeroSectionTabs();
        }
    } catch (err) {
        console.error('Error loading hero text:', err);
        showNotification('Error loading hero text!', 'error');
    }
}

function setupHeroTabs() {
    const heroTabs = document.querySelectorAll('[data-hero-tab]');
    heroTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.heroTab;

            // Remove active class from all tabs
            heroTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Hide all tab contents
            document.querySelectorAll('.hero-tab-content').forEach(content => {
                content.style.display = 'none';
            });

            // Show selected tab content
            document.getElementById('hero-tab-' + tabName).style.display = 'block';
        });
    });
}

function setupHeroSectionTabs() {
    const heroSectionTabs = document.querySelectorAll('[data-hero-section-tab]');
    heroSectionTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.heroSectionTab;

            // Remove active class from all tabs
            heroSectionTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Hide all tab contents
            document.querySelectorAll('.hero-section-tab-content').forEach(content => {
                content.style.display = 'none';
            });

            // Show selected tab content
            document.getElementById('hero-section-tab-' + tabName).style.display = 'block';
        });
    });
}

function setupHomepageSectionsTabs() {
    const homepageSectionTabs = document.querySelectorAll('[data-homepage-section-tab]');
    homepageSectionTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.homepageSectionTab;

            // Remove active class from all tabs
            homepageSectionTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Hide all tab contents
            document.querySelectorAll('.homepage-section-tab-content').forEach(content => {
                content.style.display = 'none';
            });

            // Show selected tab content
            document.getElementById('homepage-section-tab-' + tabName).style.display = 'block';
        });
    });
}

// ===== Enquiries Management =====
async function loadEnquiries() {
    try {
        const res = await fetch('/api/enquiries');
        const result = await res.json();
        allEnquiries = Array.isArray(result) ? result : (result.enquiries || []);
        enquiriesCurrentPage = 1;
        const searchEl = document.getElementById('enquirySearch');
        const statusEl = document.getElementById('enquiryStatusFilter');
        if (searchEl) searchEl.value = '';
        if (statusEl) statusEl.value = '';
        renderEnquiries(allEnquiries);
    } catch (err) {
        console.error('Error loading enquiries:', err);
    }
}

// ===== Social Media Management =====
async function loadSocialMedia() {
    try {
        const res = await fetch('/api/social-media');
        const data = await res.json();
        if (data.success && data.socialMedia) {
            document.getElementById('facebookUrl').value = data.socialMedia.facebookUrl || '';
            document.getElementById('instagramUrl').value = data.socialMedia.instagramUrl || '';
            document.getElementById('whatsappUrl').value = data.socialMedia.whatsappUrl || '';
            document.getElementById('youtubeUrl').value = data.socialMedia.youtubeUrl || '';
            document.getElementById('linkedinUrl').value = data.socialMedia.linkedinUrl || '';
        }
    } catch (err) {
        console.error('Error loading social media:', err);
        showNotification('Error loading social media!', 'error');
    }
}

async function saveSocialMedia() {
    const socialMedia = {
        facebookUrl: document.getElementById('facebookUrl').value,
        instagramUrl: document.getElementById('instagramUrl').value,
        whatsappUrl: document.getElementById('whatsappUrl').value,
        youtubeUrl: document.getElementById('youtubeUrl').value,
        linkedinUrl: document.getElementById('linkedinUrl').value
    };
    
    try {
        const res = await fetch('/api/social-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(socialMedia)
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Social media saved!', 'success');
        } else {
            showNotification(data.message || 'Save failed!', 'error');
        }
    } catch (err) {
        console.error('Error saving social media:', err);
        showNotification('Error saving social media!', 'error');
    }
}

// ===== Section Visibility Management =====
async function loadSectionVisibility() {
    try {
        const res = await fetch('/api/section-visibility');
        const data = await res.json();
        if (data.success && data.sections) {
            const sections = data.sections;
            ['carousel','notices','courses','blog','about','gallery','testimonials','contact'].forEach(key => {
                const el = document.getElementById('section-' + key);
                if (el) el.checked = sections[key] !== false;
            });
        }
    } catch (err) {
        console.error('Error loading section visibility:', err);
    }
}

async function saveSectionVisibility() {
    const sections = {};
    ['carousel','notices','courses','blog','about','gallery','testimonials','contact'].forEach(key => {
        const el = document.getElementById('section-' + key);
        if (el) sections[key] = el.checked;
    });
    
    try {
        const res = await fetch('/api/section-visibility', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sections)
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Section visibility saved!', 'success');
        } else {
            showNotification(data.message || 'Save failed!', 'error');
        }
    } catch (err) {
        console.error('Error saving section visibility:', err);
        showNotification('Error saving section visibility!', 'error');
    }
}

// ===== Section Texts Management =====
const SECTION_TEXT_KEYS = ['notices','courses','blog','about','gallery','testimonials','contact'];

async function loadSectionTexts() {
    try {
        const res = await fetch('/api/section-texts');
        const data = await res.json();
        if (data.success && data.texts) {
            SECTION_TEXT_KEYS.forEach(key => {
                const el = document.getElementById('text-' + key);
                if (el) el.value = data.texts[key] || '';
            });
        }
    } catch (err) {
        console.error('Error loading section texts:', err);
    }
}

async function saveSectionTexts() {
    const texts = {};
    SECTION_TEXT_KEYS.forEach(key => {
        const el = document.getElementById('text-' + key);
        if (el) texts[key] = el.value;
    });
    
    try {
        const res = await fetch('/api/section-texts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(texts)
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Section texts saved!', 'success');
        } else {
            showNotification(data.message || 'Save failed!', 'error');
        }
    } catch (err) {
        console.error('Error saving section texts:', err);
        showNotification('Error saving section texts!', 'error');
    }
}

async function saveHeroText() {
    const heroText = {
        // Desktop fields
        heading: document.getElementById('heroHeading').value,
        subheading: document.getElementById('heroSubheading').value,
        headingSize: parseFloat(document.getElementById('heroHeadingSize').value),
        subheadingSize: parseFloat(document.getElementById('heroSubheadingSize').value),
        animation: document.getElementById('heroAnimation').value,
        button1Text: document.getElementById('heroButton1Text').value,
        button2Text: document.getElementById('heroButton2Text').value,
        // Mobile fields
        headingMobile: document.getElementById('heroHeadingMobile').value,
        subheadingMobile: document.getElementById('heroSubheadingMobile').value,
        headingSizeMobile: parseFloat(document.getElementById('heroHeadingSizeMobile').value),
        subheadingSizeMobile: parseFloat(document.getElementById('heroSubheadingSizeMobile').value),
        button1TextMobile: document.getElementById('heroButton1TextMobile').value,
        button2TextMobile: document.getElementById('heroButton2TextMobile').value
    };
    
    try {
        const res = await fetch('/api/hero-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(heroText)
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Hero text saved!', 'success');
        } else {
            showNotification(data.message || 'Save failed!', 'error');
        }
    } catch (err) { showNotification('Error saving hero text!', 'error'); }
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
        // Handle phone as array or string
        if (s.phone) {
            if (Array.isArray(s.phone)) {
                setPhoneNumbers(s.phone);
            } else {
                setPhoneNumbers([s.phone]);
            }
        } else {
            setPhoneNumbers([]);
        }
        document.getElementById('settingEmail').value = s.email || '';
        document.getElementById('settingAdminEmail').value = s.adminEmail || '';
        document.getElementById('settingAddress').value = s.address || '';
        document.getElementById('settingWebsiteUrl').value = s.websiteUrl || '';
        document.getElementById('rightClickPrevention').checked = s.rightClickPrevention || false;
        document.getElementById('devToolsPrevention').checked = s.devToolsPrevention || false;
        
        // Load popup settings
        if (s.popup) {
            document.getElementById('popupEnabled').checked = s.popup.enabled || false;
            document.getElementById('popupTitle').value = s.popup.title || '';
            document.getElementById('popupDescription').value = s.popup.description || '';
            setPopupButtons(s.popup.buttons || []);
        } else {
            document.getElementById('popupEnabled').checked = false;
            document.getElementById('popupTitle').value = '';
            document.getElementById('popupDescription').value = '';
            setPopupButtons([]);
        }
        
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
        if (s.favicon) {
            const img = document.getElementById('faviconPreviewImg');
            img.src = s.favicon;
            img.style.display = 'block';
            document.getElementById('faviconPlaceholder').style.display = 'none';
            document.getElementById('removeFaviconBtn').style.display = 'inline-block';
        }
        // Load popup image preview
        loadPopupImagePreview();
        if (s.smtp) {
            document.getElementById('smtpUser').value = s.smtp.user || '';
            document.getElementById('smtpPass').value = s.smtp.pass || '';
            document.getElementById('smtpHost').value = s.smtp.host || 'smtp.gmail.com';
            document.getElementById('smtpPort').value = s.smtp.port || '587';
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

async function loadFaviconPreview() {
    try {
        const settings = await fetch('/api/settings').then(r => r.json());
        const previewImg = document.getElementById('faviconPreviewImg');
        const placeholder = document.getElementById('faviconPlaceholder');
        const removeBtn = document.getElementById('removeFaviconBtn');
        if (settings.favicon) {
            previewImg.src = settings.favicon;
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

async function removeFavicon() {
    if (!confirm('Remove favicon?')) return;
    try {
        await fetch('/api/favicon', { method: 'DELETE' });
        loadFaviconPreview();
        showNotification('Favicon removed!', 'success');
    } catch (err) { showNotification('Error!', 'error'); }
}

// Phone numbers management
function addPhoneNumber() {
    const container = document.getElementById('phoneNumbersContainer');
    const div = document.createElement('div');
    div.className = 'phone-number-item';
    div.style.display = 'flex';
    div.style.gap = '10px';
    div.style.marginBottom = '10px';
    div.innerHTML = `
        <input type="tel" class="phone-number-input" placeholder="+91 98765 43210" style="flex: 1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
        <button type="button" class="btn btn-danger" onclick="removePhoneNumber(this)" style="padding: 8px 12px;"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(div);
}

function removePhoneNumber(button) {
    const container = document.getElementById('phoneNumbersContainer');
    if (container.children.length > 1) {
        button.parentElement.remove();
    } else {
        showNotification('At least one phone number is required', 'error');
    }
}

function getPhoneNumbers() {
    const inputs = document.querySelectorAll('.phone-number-input');
    const phoneNumbers = [];
    inputs.forEach(input => {
        if (input.value.trim()) {
            phoneNumbers.push(input.value.trim());
        }
    });
    return phoneNumbers;
}

function setPhoneNumbers(phoneNumbers) {
    const container = document.getElementById('phoneNumbersContainer');
    container.innerHTML = '';
    if (phoneNumbers && phoneNumbers.length > 0) {
        phoneNumbers.forEach(phone => {
            const div = document.createElement('div');
            div.className = 'phone-number-item';
            div.style.display = 'flex';
            div.style.gap = '10px';
            div.style.marginBottom = '10px';
            div.innerHTML = `
                <input type="tel" class="phone-number-input" value="${phone}" placeholder="+91 98765 43210" style="flex: 1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                <button type="button" class="btn btn-danger" onclick="removePhoneNumber(this)" style="padding: 8px 12px;"><i class="fas fa-trash"></i></button>
            `;
            container.appendChild(div);
        });
    } else {
        // Add one empty input by default
        addPhoneNumber();
    }
}

// Popup modal management
function addPopupButton() {
    const container = document.getElementById('popupButtonsContainer');
    const div = document.createElement('div');
    div.className = 'popup-button-item';
    div.style.display = 'flex';
    div.style.gap = '10px';
    div.style.marginBottom = '10px';
    div.style.flexWrap = 'wrap';
    div.innerHTML = `
        <input type="text" class="popup-button-text" placeholder="Button Text" style="flex: 1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; min-width: 150px;">
        <input type="text" class="popup-button-link" placeholder="Button Link (e.g., #contact)" style="flex: 1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; min-width: 150px;">
        <select class="popup-button-style" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
            <option value="btn-primary">Primary</option>
            <option value="btn-secondary">Secondary</option>
            <option value="btn-success">Success</option>
        </select>
        <button type="button" class="btn btn-danger" onclick="removePopupButton(this)" style="padding: 8px 12px;"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(div);
}

function removePopupButton(button) {
    button.parentElement.remove();
}

function getPopupButtons() {
    const buttons = [];
    const items = document.querySelectorAll('.popup-button-item');
    items.forEach(item => {
        const text = item.querySelector('.popup-button-text').value.trim();
        const link = item.querySelector('.popup-button-link').value.trim();
        const style = item.querySelector('.popup-button-style').value;
        if (text) {
            buttons.push({ text, link, style });
        }
    });
    return buttons;
}

function setPopupButtons(buttons) {
    const container = document.getElementById('popupButtonsContainer');
    container.innerHTML = '';
    if (buttons && buttons.length > 0) {
        buttons.forEach(btn => {
            const div = document.createElement('div');
            div.className = 'popup-button-item';
            div.style.display = 'flex';
            div.style.gap = '10px';
            div.style.marginBottom = '10px';
            div.style.flexWrap = 'wrap';
            div.innerHTML = `
                <input type="text" class="popup-button-text" value="${btn.text || ''}" placeholder="Button Text" style="flex: 1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; min-width: 150px;">
                <input type="text" class="popup-button-link" value="${btn.link || ''}" placeholder="Button Link (e.g., #contact)" style="flex: 1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; min-width: 150px;">
                <select class="popup-button-style" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <option value="btn-primary" ${btn.style === 'btn-primary' ? 'selected' : ''}>Primary</option>
                    <option value="btn-secondary" ${btn.style === 'btn-secondary' ? 'selected' : ''}>Secondary</option>
                    <option value="btn-success" ${btn.style === 'btn-success' ? 'selected' : ''}>Success</option>
                </select>
                <button type="button" class="btn btn-danger" onclick="removePopupButton(this)" style="padding: 8px 12px;"><i class="fas fa-trash"></i></button>
            `;
            container.appendChild(div);
        });
    }
}

async function removePopupImage() {
    if (!confirm('Remove popup image?')) return;
    try {
        await fetch('/api/popup-image', { method: 'DELETE' });
        loadPopupImagePreview();
        showNotification('Popup image removed!', 'success');
    } catch (err) { showNotification('Error!', 'error'); }
}

async function loadPopupImagePreview() {
    try {
        const settings = await fetch('/api/settings').then(r => r.json());
        const previewImg = document.getElementById('popupImagePreviewImg');
        const placeholder = document.getElementById('popupImagePlaceholder');
        const removeBtn = document.getElementById('removePopupImageBtn');
        if (settings.popup && settings.popup.image) {
            previewImg.src = settings.popup.image;
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

document.getElementById('settingsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('settingName').value,
        phone: getPhoneNumbers(),
        email: document.getElementById('settingEmail').value,
        adminEmail: document.getElementById('settingAdminEmail').value,
        address: document.getElementById('settingAddress').value,
        websiteUrl: document.getElementById('settingWebsiteUrl').value,
        rightClickPrevention: document.getElementById('rightClickPrevention').checked,
        devToolsPrevention: document.getElementById('devToolsPrevention').checked
    };
    try {
        await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        loadAdminLogo();
        loadSettings();
        showNotification('Settings saved!', 'success');
    } catch (err) { showNotification('Error saving settings!', 'error'); }
});

document.getElementById('popupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    // Get current settings to preserve popup image
    const currentSettings = await fetch('/api/settings').then(r => r.json());
    const data = {
        popup: {
            enabled: document.getElementById('popupEnabled').checked,
            title: document.getElementById('popupTitle').value,
            description: document.getElementById('popupDescription').value,
            buttons: getPopupButtons(),
            image: currentSettings.popup && currentSettings.popup.image ? currentSettings.popup.image : ''
        }
    };
    try {
        await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        loadSettings();
        showNotification('Popup settings saved!', 'success');
    } catch (err) { showNotification('Error saving popup settings!', 'error'); }
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
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;justify-content:center;align-items:center;z-index:9999;';
        modal.innerHTML = `
            <style>
                #view-result-modal .vr-modal-content * { color: inherit; }
                #view-result-modal #vr-tab-content { color: #fff; }
                #view-result-modal #vr-tab-content h1,
                #view-result-modal #vr-tab-content h2,
                #view-result-modal #vr-tab-content h3,
                #view-result-modal #vr-tab-content h4,
                #view-result-modal #vr-tab-content p,
                #view-result-modal #vr-tab-content div,
                #view-result-modal #vr-tab-content span,
                #view-result-modal #vr-tab-content td,
                #view-result-modal #vr-tab-content th,
                #view-result-modal #vr-tab-content li { color: #fff !important; }
                #view-result-modal #vr-tab-content [style*="color:#3b82f6"],
                #view-result-modal #vr-tab-content [style*="color: #3b82f6"] { color: #93c5fd !important; }
                #view-result-modal #vr-tab-content [style*="color:#22c55e"],
                #view-result-modal #vr-tab-content [style*="color: #22c55e"] { color: #86efac !important; }
                #view-result-modal #vr-tab-content [style*="color:#ef4444"],
                #view-result-modal #vr-tab-content [style*="color: #ef4444"] { color: #fca5a5 !important; }
                #view-result-modal #vr-tab-content [style*="color:#f59e0b"],
                #view-result-modal #vr-tab-content [style*="color: #f59e0b"] { color: #fcd34d !important; }
                #view-result-modal #vr-tab-content [style*="color:#64748b"],
                #view-result-modal #vr-tab-content [style*="color: #64748b"] { color: rgba(255,255,255,0.65) !important; }
                #view-result-modal #vr-tab-content [style*="color:#1e293b"],
                #view-result-modal #vr-tab-content [style*="color: #1e293b"] { color: #fff !important; }
                #view-result-modal #vr-tab-content [style*="background:#dbeafe"],
                #view-result-modal #vr-tab-content [style*="background: #dbeafe"] { background: rgba(59,130,246,0.18) !important; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.15); }
                #view-result-modal #vr-tab-content [style*="background:#dcfce7"],
                #view-result-modal #vr-tab-content [style*="background: #dcfce7"] { background: rgba(34,197,94,0.18) !important; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.15); }
                #view-result-modal #vr-tab-content [style*="background:#fee2e2"],
                #view-result-modal #vr-tab-content [style*="background: #fee2e2"] { background: rgba(239,68,68,0.18) !important; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.15); }
                #view-result-modal #vr-tab-content [style*="background:#fef3c7"],
                #view-result-modal #vr-tab-content [style*="background: #fef3c7"] { background: rgba(245,158,11,0.18) !important; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.15); }
                #view-result-modal #vr-tab-content [style*="background:#f8fafc"],
                #view-result-modal #vr-tab-content [style*="background: #f8fafc"],
                #view-result-modal #vr-tab-content [style*="background:#f1f5f9"],
                #view-result-modal #vr-tab-content [style*="background: #f1f5f9"],
                #view-result-modal #vr-tab-content [style*="background:#fff"],
                #view-result-modal #vr-tab-content [style*="background: #fff"] { background: rgba(255,255,255,0.08) !important; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.15); }
                #view-result-modal #vr-tab-content table { background: rgba(255,255,255,0.05); border-radius:8px; overflow:hidden; }
                #view-result-modal #vr-tab-content table th { background: rgba(255,255,255,0.12) !important; color:#fff !important; }
                #view-result-modal #vr-tab-content table td,
                #view-result-modal #vr-tab-content table th { border-color: rgba(255,255,255,0.15) !important; }
                #view-result-modal #vr-tab-content::-webkit-scrollbar { width: 8px; }
                #view-result-modal #vr-tab-content::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
                #view-result-modal #vr-tab-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius:4px; }
                #view-result-modal .vr-tab-btn:hover { color: #fff !important; }
            </style>
            <div class="vr-modal-content" style="max-width:1200px;width:95%;height:92vh;display:flex;flex-direction:column;background:rgba(255,255,255,0.1);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,0.2);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.4);overflow:hidden;color:#fff;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-bottom:1px solid rgba(255,255,255,0.15);flex-shrink:0;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        ${settings.logo ? `<img src="${settings.logo}" alt="Logo" style="height:40px;border-radius:8px;">` : ''}
                        <div>
                            <h3 style="margin:0;font-size:16px;color:#fff;font-weight:700;">${settings.name || 'Institute'}</h3>
                            <div style="font-size:12px;color:rgba(255,255,255,0.8);"><strong style="color:#fff;">${grade.studentName}</strong> • ${grade.course} • ${grade.examName}</div>
                        </div>
                    </div>
                    <button id="vr-close-x" style="padding:7px 14px;background:rgba(239,68,68,0.85);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:10px;cursor:pointer;font-weight:600;backdrop-filter:blur(8px);">✕ Close</button>
                </div>
                <div style="display:flex;gap:4px;padding:0 22px;border-bottom:1px solid rgba(255,255,255,0.15);flex-shrink:0;">
                    <button class="vr-tab-btn active" data-tab="report" style="padding:12px 18px;background:none;border:none;border-bottom:3px solid #60a5fa;cursor:pointer;font-weight:700;color:#60a5fa;">📄 Report</button>
                    <button class="vr-tab-btn" data-tab="stats" style="padding:12px 18px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;color:rgba(255,255,255,0.75);font-weight:600;">📊 Statistics</button>
                    <button class="vr-tab-btn" data-tab="history" style="padding:12px 18px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;color:rgba(255,255,255,0.75);font-weight:600;">👤 Student History</button>
                    <button class="vr-tab-btn" data-tab="answers" style="padding:12px 18px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;color:rgba(255,255,255,0.75);font-weight:600;">📝 Answer Review</button>
                </div>
                <div id="vr-tab-content" style="flex:1;overflow-y:auto;padding:20px;color:#fff;"></div>
                <div style="padding:12px 22px;border-top:1px solid rgba(255,255,255,0.15);flex-shrink:0;display:flex;justify-content:flex-end;gap:8px;">
                    <button id="vr-print-btn" style="padding:8px 16px;background:rgba(59,130,246,0.85);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:10px;cursor:pointer;font-weight:600;backdrop-filter:blur(8px);"><i class="fas fa-print"></i> Print / PDF</button>
                    <button id="vr-close-btn" style="padding:8px 16px;background:rgba(100,116,139,0.85);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:10px;cursor:pointer;font-weight:600;backdrop-filter:blur(8px);">Close</button>
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
                ${settings.logo ? `<img src="${settings.logo}" style="height:70px;margin-bottom:10px;border-radius:12px;">` : ''}
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
            <div style="display:flex;gap:10px;margin-bottom:20px;padding:15px;background:rgba(255,255,255,0.08);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);border-radius:8px;position:sticky;top:-20px;z-index:10;">
                <input id="vr-q-search" type="text" placeholder="🔍 Search question text..." style="flex:1;padding:8px 12px;border:1px solid rgba(255,255,255,0.3);border-radius:6px;font-size:14px;background:rgba(255,255,255,0.1);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;">
                <select id="vr-q-filter" style="padding:8px 12px;border:1px solid rgba(255,255,255,0.3);border-radius:6px;font-size:14px;background:rgba(255,255,255,0.1);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;">
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
        </style></head><body><div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04;"><img src="/uploads/logo/logo.png" style="max-width: 300px; max-height: 300px; border-radius: 12px;" onerror="this.parentElement.style.display='none'"></div>${html}
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

// ===== Excel Export Functions =====

async function exportStudentsToExcel() {
    try {
        const students = await fetch('/api/students').then(r => r.json());
        if (!students || students.length === 0) {
            showNotification('No students to export!', 'error');
            return;
        }

        const data = students.map(s => {
            const q = typeof s.qualification === 'string' ? JSON.parse(s.qualification || '{}') : (s.qualification || {});
            return {
                'Roll No': s.rollNo || '',
                'Name': s.name || '',
                'Date of Birth': s.dob || '',
                'Gender': s.gender || '',
                'Category': s.category || '',
                'Blood Group': s.bloodGroup || '',
                'Phone': s.phone || '',
                'WhatsApp': s.whatsapp || '',
                'Email': s.email || '',
                'Aadhar': s.aadhar || '',
                'Address': s.address || '',
                'Reference': s.reference || '',
                "Father's Name": s.fatherName || '',
                "Father's Occupation": s.fatherOccupation || '',
                "Father's Phone": s.fatherPhone || '',
                "Mother's Name": s.motherName || '',
                'Family Income': s.familyIncome || '',
                '10th Board': (q.tenth && q.tenth.board) || '',
                '10th School': (q.tenth && q.tenth.school) || '',
                '10th Year': (q.tenth && q.tenth.year) || '',
                '10th Roll No': (q.tenth && q.tenth.rollNo) || '',
                '10th Total Marks': (q.tenth && q.tenth.totalMarks) || '',
                '10th Obtained': (q.tenth && q.tenth.obtainedMarks) || '',
                '10th Percentage': (q.tenth && q.tenth.percentage) || '',
                '10th Division': (q.tenth && q.tenth.division) || '',
                '12th Board': (q.twelfth && q.twelfth.board) || '',
                '12th School': (q.twelfth && q.twelfth.school) || '',
                '12th Stream': (q.twelfth && q.twelfth.stream) || '',
                '12th Year': (q.twelfth && q.twelfth.year) || '',
                '12th Roll No': (q.twelfth && q.twelfth.rollNo) || '',
                '12th Percentage': (q.twelfth && q.twelfth.percentage) || '',
                '12th Division': (q.twelfth && q.twelfth.division) || '',
                'Grad University': (q.graduation && q.graduation.university) || '',
                'Grad College': (q.graduation && q.graduation.college) || '',
                'Grad Degree': (q.graduation && q.graduation.degree) || '',
                'Grad Stream': (q.graduation && q.graduation.stream) || '',
                'Grad Year': (q.graduation && q.graduation.year) || '',
                'Grad Enrollment': (q.graduation && q.graduation.enrollmentNo) || '',
                'Grad Percentage': (q.graduation && q.graduation.percentage) || '',
                'Grad Division': (q.graduation && q.graduation.division) || '',
                'Course': s.course || '',
                'Batch': s.batch || '',
                'Admission Date': s.admissionDate || '',
                'Status': s.status || '',
                'Total Fees': s.fees ? s.fees.totalFees : 0,
                'Paid Amount': s.fees ? s.fees.paidAmount : 0,
                'Due Amount': s.fees ? s.fees.dueAmount : 0
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Students');
        XLSX.writeFile(wb, 'Students_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Students exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting students!', 'error');
    }
}

async function exportCoursesToExcel() {
    try {
        const courses = await fetch('/api/courses').then(r => r.json());
        if (!courses || courses.length === 0) {
            showNotification('No courses to export!', 'error');
            return;
        }
        const data = courses.map(c => ({
            'Course Name': c.name || '',
            'Duration': c.duration || '',
            'Price (₹)': c.price || 0,
            'Eligibility': c.eligibility || '',
            'Description': c.description || '',
            'Syllabus': c.syllabus || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Courses');
        XLSX.writeFile(wb, 'Courses_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Courses exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting courses!', 'error');
    }
}

async function exportBatchesToExcel() {
    try {
        const batches = await fetch('/api/batches').then(r => r.json());
        if (!batches || batches.length === 0) {
            showNotification('No batches to export!', 'error');
            return;
        }
        const data = batches.map((b, i) => ({
            '#': i + 1,
            'Batch Name': b.name || '',
            'Timing': b.timing || '',
            'Start Date': b.startDate || '',
            'Total Seats': b.totalSeats || 0,
            'Enrolled': b.enrolled || 0,
            'Available': (b.totalSeats || 0) - (b.enrolled || 0)
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Batches');
        XLSX.writeFile(wb, 'Batches_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Batches exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting batches!', 'error');
    }
}

async function exportEnquiriesToExcel() {
    try {
        const enquiries = await fetch('/api/enquiries').then(r => r.json());
        if (!enquiries || enquiries.length === 0) {
            showNotification('No enquiries to export!', 'error');
            return;
        }
        const data = enquiries.map(e => ({
            'Name': e.name || '',
            'Email': e.email || '',
            'Phone': e.phone || '',
            'Course': e.course || '',
            'Message': e.message || '',
            'Date': e.date || '',
            'Status': e.replied ? 'Replied' : 'Pending'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Enquiries');
        XLSX.writeFile(wb, 'Enquiries_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Enquiries exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting enquiries!', 'error');
    }
}

async function exportFacultyToExcel() {
    try {
        const faculty = await fetch('/api/faculty').then(r => r.json());
        if (!faculty || faculty.length === 0) {
            showNotification('No faculty to export!', 'error');
            return;
        }
        const data = faculty.map(f => ({
            'Name': f.name || '',
            'Email': f.email || '',
            'Phone': f.phone || '',
            'Subject': f.subject || '',
            'Experience': f.experience || '',
            'Qualification': f.qualification || '',
            'Role': f.role || 'Faculty'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Faculty');
        XLSX.writeFile(wb, 'Faculty_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Faculty exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting faculty!', 'error');
    }
}

async function exportFeesToExcel() {
    try {
        const students = await fetch('/api/students').then(r => r.json());
        if (!students || students.length === 0) {
            showNotification('No fee data to export!', 'error');
            return;
        }
        const data = students.map(s => ({
            'Roll No': s.rollNo || '',
            'Student Name': s.name || '',
            'Course': s.course || '',
            'Batch': s.batch || '',
            'Total Fees': s.fees ? s.fees.totalFees : 0,
            'Paid Amount': s.fees ? s.fees.paidAmount : 0,
            'Due Amount': s.fees ? s.fees.dueAmount : 0,
            'Status': s.fees && s.fees.dueAmount > 0 ? 'Pending' : 'Fully Paid'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Fees');
        XLSX.writeFile(wb, 'Fees_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Fees exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting fees!', 'error');
    }
}

async function exportPaymentsToExcel() {
    try {
        const res = await fetch('/api/payments').then(r => r.json());
        const payments = res.payments || [];
        if (!payments || payments.length === 0) {
            showNotification('No payments to export!', 'error');
            return;
        }
        const data = payments.map(p => ({
            'Student Name': p.studentName || '',
            'Amount': p.amount || 0,
            'Mode': p.mode || '',
            'Date': p.date || '',
            'UTR/Txn ID': p.transactionId || p.utrNo || '',
            'Receipt': p.receipt || '',
            'Type': p.type || '',
            'Status': p.status || 'approved'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Payments');
        XLSX.writeFile(wb, 'Payments_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Payments exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting payments!', 'error');
    }
}

async function exportCertificatesToExcel() {
    try {
        const res = await fetch('/api/certificates').then(r => r.json());
        const certificates = res.certificates || [];
        if (!certificates || certificates.length === 0) {
            showNotification('No certificates to export!', 'error');
            return;
        }
        const data = certificates.map(c => ({
            'Student Name': c.studentName || '',
            'Certificate Type': c.certificateType || '',
            'Template': c.template || '',
            'Certificate No': c.certificateNumber || '',
            'Issue Date': c.issueDate || '',
            'Grade': c.grade || '',
            'Remarks': c.remarks || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Certificates');
        XLSX.writeFile(wb, 'Certificates_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Certificates exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting certificates!', 'error');
    }
}

async function exportGalleryToExcel() {
    try {
        const gallery = await fetch('/api/gallery').then(r => r.json());
        if (!gallery || gallery.length === 0) {
            showNotification('No gallery items to export!', 'error');
            return;
        }
        const data = gallery.map(g => ({
            'Title': g.title || '',
            'Category': g.category || '',
            'Description': g.description || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Gallery');
        XLSX.writeFile(wb, 'Gallery_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Gallery exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting gallery!', 'error');
    }
}

async function exportAnnouncementsToExcel() {
    try {
        const res = await fetch('/api/announcements').then(r => r.json());
        const announcements = res.announcements || res || [];
        if (!announcements || announcements.length === 0) {
            showNotification('No announcements to export!', 'error');
            return;
        }
        const data = announcements.map(a => ({
            'Title': a.title || '',
            'Category': a.category || '',
            'Priority': a.priority || '',
            'Target': a.target || '',
            'Expiry': a.expiry || '',
            'Read Count': a.readCount || 0
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Announcements');
        XLSX.writeFile(wb, 'Announcements_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Announcements exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting announcements!', 'error');
    }
}

async function exportTestsToExcel() {
    try {
        const res = await fetch('/api/tests').then(r => r.json());
        const tests = res.tests || res || [];
        if (!tests || tests.length === 0) {
            showNotification('No tests to export!', 'error');
            return;
        }
        const data = tests.map(t => ({
            'Test Name': t.name || t.testName || '',
            'Course': t.course || '',
            'Date': t.date || '',
            'Total Marks': t.totalMarks || '',
            'Status': t.status || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tests');
        XLSX.writeFile(wb, 'Tests_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Tests exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting tests!', 'error');
    }
}

async function exportQuestionsToExcel() {
    try {
        const res = await fetch('/api/questions').then(r => r.json());
        const questions = res.questions || res || [];
        if (!questions || questions.length === 0) {
            showNotification('No questions to export!', 'error');
            return;
        }
        const data = questions.map(q => ({
            'Question': q.question || q.text || '',
            'Type': q.type || '',
            'Course': q.courseName || q.course || '',
            'Options': Array.isArray(q.options)
                ? q.options.map(o => (typeof o === 'object' ? (o.text || '') : o)).join(' | ')
                : (q.options || ''),
            'Correct Answer': q.correctAnswer || q.answer || '',
            'Marks': q.marks || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Question Bank');
        XLSX.writeFile(wb, 'QuestionBank_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Question bank exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting question bank!', 'error');
    }
}

async function exportExamScheduleToExcel() {
    try {
        const res = await fetch('/api/exam-schedules').then(r => r.json());
        const schedules = res.schedules || res || [];
        if (!schedules || schedules.length === 0) {
            showNotification('No exam schedules to export!', 'error');
            return;
        }
        const data = schedules.map(s => ({
            'Exam': s.exam || s.examName || '',
            'Course': s.course || '',
            'Batch': s.batch || '',
            'Date': s.date || '',
            'Time': s.time || '',
            'Duration': s.duration || '',
            'Total Marks': s.totalMarks || '',
            'Venue': s.venue || '',
            'Status': s.status || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Exam Schedule');
        XLSX.writeFile(wb, 'ExamSchedule_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Exam schedule exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting exam schedule!', 'error');
    }
}

async function exportExamRegistrationToExcel() {
    try {
        const res = await fetch('/api/exam-registrations').then(r => r.json());
        const registrations = res.registrations || res || [];
        if (!registrations || registrations.length === 0) {
            showNotification('No exam registrations to export!', 'error');
            return;
        }
        const data = registrations.map(r => ({
            'Student': r.studentName || '',
            'Exam': r.exam || r.examName || '',
            'Course': r.course || '',
            'Student ID': r.studentId || r.rollNo || '',
            'Status': r.status || '',
            'Fee Status': r.feeStatus || '',
            'Registration Date': r.registrationDate || r.date || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Exam Registrations');
        XLSX.writeFile(wb, 'ExamRegistrations_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Exam registrations exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting exam registrations!', 'error');
    }
}

async function exportAdmitCardsToExcel() {
    try {
        const res = await fetch('/api/admit-cards').then(r => r.json());
        const admitCards = res.admitCards || res || [];
        if (!admitCards || admitCards.length === 0) {
            showNotification('No admit cards to export!', 'error');
            return;
        }
        const data = admitCards.map(a => ({
            'Student': a.studentName || '',
            'Exam': a.exam || a.examName || '',
            'Course': a.course || '',
            'Roll No': a.rollNo || '',
            'Issue Date': a.issueDate || '',
            'Status': a.status || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Admit Cards');
        XLSX.writeFile(wb, 'AdmitCards_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Admit cards exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting admit cards!', 'error');
    }
}

async function exportOnlineExamsToExcel() {
    try {
        const res = await fetch('/api/online-exams').then(r => r.json());
        const exams = res.exams || res || [];
        if (!exams || exams.length === 0) {
            showNotification('No online exams to export!', 'error');
            return;
        }
        const data = exams.map(e => ({
            'Exam Name': e.name || e.examName || '',
            'Course': e.course || '',
            'Questions': Array.isArray(e.questions) ? e.questions.length : (e.questions || e.totalQuestions || ''),
            'Total Marks': e.totalMarks || '',
            'Passing Marks': e.passingMarks || '',
            'Duration': e.duration || '',
            'Start Date': e.startDate || '',
            'End Date': e.endDate || '',
            'Status': e.status || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Online Exams');
        XLSX.writeFile(wb, 'OnlineExams_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Online exams exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting online exams!', 'error');
    }
}

async function exportExamReportsToExcel() {
    try {
        const res = await fetch('/api/exam-reports').then(r => r.json());
        const reports = res.reports || res || [];
        if (!reports || reports.length === 0) {
            showNotification('No exam reports to export!', 'error');
            return;
        }
        const data = reports.map(r => ({
            'Student': r.studentName || '',
            'Exam': r.exam || r.examName || '',
            'Course': r.course || '',
            'Marks': r.marks || '',
            'Grade': r.grade || '',
            'Date': r.date || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Exam Reports');
        XLSX.writeFile(wb, 'ExamReports_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Exam reports exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting exam reports!', 'error');
    }
}

async function exportAttendanceToExcel() {
    try {
        const res = await fetch('/api/attendance').then(r => r.json());
        const attendance = res.attendance || res || [];
        if (!attendance || attendance.length === 0) {
            showNotification('No attendance records to export!', 'error');
            return;
        }
        const data = attendance.map(a => ({
            'Roll No': a.rollNo || '',
            'Name': a.studentName || a.name || '',
            'Course': a.course || '',
            'Batch': a.batch || '',
            'Date': a.date || '',
            'Status': a.status || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        XLSX.writeFile(wb, 'Attendance_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Attendance exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting attendance!', 'error');
    }
}

async function exportExamCalendarToExcel() {
    try {
        const res = await fetch('/api/exam-calendar').then(r => r.json());
        const events = res.examCalendar || res.events || res || [];
        if (!events || events.length === 0) {
            showNotification('No exam calendar events to export!', 'error');
            return;
        }
        const data = events.map(e => ({
            'Date': e.date || '',
            'Time': e.time || '',
            'Exam Title': e.title || e.examTitle || '',
            'Course': e.course || '',
            'Batch': e.batch || '',
            'Description': e.description || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Exam Calendar');
        XLSX.writeFile(wb, 'ExamCalendar_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Exam calendar exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting exam calendar!', 'error');
    }
}

async function exportHolidaysToExcel() {
    try {
        const res = await fetch('/api/holidays').then(r => r.json());
        const holidays = res.holidays || res || [];
        if (!holidays || holidays.length === 0) {
            showNotification('No holidays to export!', 'error');
            return;
        }
        const data = holidays.map(h => ({
            'Date': h.date || '',
            'Title': h.title || '',
            'Type': h.type || '',
            'Description': h.description || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Holidays');
        XLSX.writeFile(wb, 'Holidays_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Holidays exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting holidays!', 'error');
    }
}

async function exportBlogToExcel() {
    try {
        const res = await fetch('/api/blogs').then(r => r.json());
        const posts = res.blogs || res.posts || res || [];
        if (!posts || posts.length === 0) {
            showNotification('No blog posts to export!', 'error');
            return;
        }
        const data = posts.map(p => ({
            'Title': p.title || '',
            'Category': p.category || '',
            'Author': p.author || '',
            'Date': p.date || '',
            'Status': p.status || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Blog');
        XLSX.writeFile(wb, 'Blog_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Blog exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting blog!', 'error');
    }
}

async function exportStudyMaterialsToExcel() {
    try {
        const res = await fetch('/api/study-materials').then(r => r.json());
        const materials = res.materials || res || [];
        if (!materials || materials.length === 0) {
            showNotification('No study materials to export!', 'error');
            return;
        }
        const data = materials.map(m => ({
            'Title': m.title || '',
            'Course': m.course || '',
            'Category': m.category || '',
            'Type': m.type || '',
            'Author': m.author || '',
            'Views': m.views || 0,
            'Downloads': m.downloads || 0
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Study Materials');
        XLSX.writeFile(wb, 'StudyMaterials_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Study materials exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting study materials!', 'error');
    }
}

async function exportVideosToExcel() {
    try {
        const res = await fetch('/api/videos').then(r => r.json());
        const videos = res.videos || res || [];
        if (!videos || videos.length === 0) {
            showNotification('No videos to export!', 'error');
            return;
        }
        const data = videos.map(v => ({
            'Title': v.title || '',
            'Course': v.course || '',
            'Chapter': v.chapter || '',
            'Duration': v.duration || '',
            'Views': v.views || 0,
            'Status': v.status || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Videos');
        XLSX.writeFile(wb, 'Videos_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Videos exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting videos!', 'error');
    }
}

async function exportVideoCommentsToExcel() {
    try {
        const res = await fetch('/api/admin/video-comments').then(r => r.json());
        const comments = res.comments || res || [];
        if (!comments || comments.length === 0) {
            showNotification('No video comments to export!', 'error');
            return;
        }
        const data = comments.map(c => ({
            'Video': c.videoTitle || '',
            'Student': c.studentName || '',
            'Comment': c.comment || c.text || '',
            'Date': c.date || '',
            'Status': c.status || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Video Comments');
        XLSX.writeFile(wb, 'VideoComments_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Video comments exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting video comments!', 'error');
    }
}

async function exportAssignmentsToExcel() {
    try {
        const res = await fetch('/api/assignments').then(r => r.json());
        const assignments = res.assignments || res || [];
        if (!assignments || assignments.length === 0) {
            showNotification('No assignments to export!', 'error');
            return;
        }
        const data = assignments.map(a => ({
            'Title': a.title || '',
            'Course': a.course || '',
            'Target': a.target || '',
            'Due Date': a.dueDate || '',
            'Max Marks': a.maxMarks || '',
            'Submissions': a.submissions || 0,
            'Created': a.created || a.date || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Assignments');
        XLSX.writeFile(wb, 'Assignments_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Assignments exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting assignments!', 'error');
    }
}

async function exportAlumniToExcel() {
    try {
        const res = await fetch('/api/alumni').then(r => r.json());
        const alumni = res.alumni || res || [];
        if (!alumni || alumni.length === 0) {
            showNotification('No alumni to export!', 'error');
            return;
        }
        const data = alumni.map(a => ({
            'Name': a.name || '',
            'Course': a.course || '',
            'Batch': a.batch || '',
            'Grad Year': a.gradYear || a.passYear || '',
            'Company': a.company || '',
            'Designation': a.designation || '',
            'Verified': a.verified ? 'Yes' : 'No'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Alumni');
        XLSX.writeFile(wb, 'Alumni_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Alumni exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting alumni!', 'error');
    }
}

async function exportHelpdeskToExcel() {
    try {
        const res = await fetch('/api/tickets').then(r => r.json());
        const tickets = res.tickets || res || [];
        if (!tickets || tickets.length === 0) {
            showNotification('No tickets to export!', 'error');
            return;
        }
        const data = tickets.map(t => ({
            'Subject': t.subject || '',
            'Student': t.studentName || '',
            'Category': t.category || '',
            'Priority': t.priority || '',
            'Status': t.status || '',
            'Created': t.created || t.date || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Helpdesk');
        XLSX.writeFile(wb, 'Helpdesk_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Helpdesk tickets exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting helpdesk tickets!', 'error');
    }
}

async function exportBackupsToExcel() {
    try {
        const res = await fetch('/api/backup/list').then(r => r.json());
        const backups = res.backups || res || [];
        if (!backups || backups.length === 0) {
            showNotification('No backups to export!', 'error');
            return;
        }
        const data = backups.map(b => ({
            'Filename': b.filename || b.name || '',
            'Size': b.size || '',
            'Created': b.created || b.date || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Backups');
        XLSX.writeFile(wb, 'Backups_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Backups exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting backups!', 'error');
    }
}

async function exportRolesToExcel() {
    try {
        const res = await fetch('/api/roles').then(r => r.json());
        const roles = res.roles || res || [];
        if (!roles || roles.length === 0) {
            showNotification('No roles to export!', 'error');
            return;
        }
        const data = roles.map(r => ({
            'Name': r.name || '',
            'Description': r.description || '',
            'Permissions': Array.isArray(r.permissions) ? r.permissions.join(', ') : (r.permissions || '')
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Roles');
        XLSX.writeFile(wb, 'Roles_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Roles exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting roles!', 'error');
    }
}

async function exportExamResultsToExcel() {
    try {
        const res = await fetch('/api/exam-results').then(r => r.json());
        const results = res.results || res || [];
        if (!results || results.length === 0) {
            showNotification('No exam results to export!', 'error');
            return;
        }
        const data = results.map(r => ({
            'Student': r.studentName || '',
            'Exam': r.exam || r.examName || '',
            'Course': r.course || '',
            'Marks': r.marks || '',
            'Grade': r.grade || '',
            'Date': r.date || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Exam Results');
        XLSX.writeFile(wb, 'ExamResults_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        showNotification('Exam results exported successfully!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting exam results!', 'error');
    }
}

// ===== Generic Table Search (auto-attaches to every admin table) =====
(function () {
    const STYLE_ID = 'admin-table-search-style';
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .table-search-wrap {
                display: flex;
                align-items: center;
                gap: 0;
                margin: 0 0 12px 0;
                max-width: 420px;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                overflow: hidden;
            }
            .table-search-wrap .search-input-area {
                position: relative;
                flex: 1;
                display: flex;
                align-items: center;
            }
            .table-search-wrap input {
                width: 100%;
                padding: 8px 12px 8px 38px;
                border: none;
                font-size: 14px;
                outline: none;
                background: transparent;
                color: #fff;
                transition: all .15s;
            }
            .table-search-wrap input::placeholder {
                color: rgba(255, 255, 255, 0.6);
            }
            .table-search-wrap input:focus {
                background: rgba(255, 255, 255, 0.15);
            }
            .table-search-wrap i.search-ico {
                position: absolute;
                left: 12px;
                top: 50%;
                transform: translateY(-50%);
                color: rgba(255, 255, 255, 0.6);
                pointer-events: none;
                font-size: 14px;
            }
            .table-search-wrap .search-count {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                color: rgba(255, 255, 255, 0.7);
                font-size: 12px;
                pointer-events: none;
            }
            .table-search-wrap .clear-btn {
                position: absolute;
                right: 6px;
                top: 50%;
                transform: translateY(-50%);
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: rgba(255, 255, 255, 0.8);
                cursor: pointer;
                padding: 4px 6px;
                display: none;
                border-radius: 6px;
                font-size: 12px;
            }
            .table-search-wrap .clear-btn:hover { 
                background: rgba(255, 255, 255, 0.3);
                color: #fff;
            }
            .table-search-wrap .search-go-btn {
                flex-shrink: 0;
                padding: 8px 16px;
                border: none;
                border-left: 1px solid rgba(255, 255, 255, 0.2);
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: #fff;
                font-size: 14px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all .15s;
                white-space: nowrap;
            }
            .table-search-wrap .search-go-btn:hover {
                background: linear-gradient(135deg, #5a6fd6, #6a3f92);
            }
            .table-search-wrap .search-go-btn:active {
                transform: scale(0.97);
            }
        `;
        document.head.appendChild(style);
    }

    // TOTP Functions
    async function checkTOTPStatus() {
        try {
            const res = await fetch('/api/admin/totp-status');
            const data = await res.json();
            updateTOTPUI(data.configured);
        } catch (err) {
            console.error('Error checking TOTP status:', err);
        }
    }

    function updateTOTPUI(isConfigured) {
        const notConfigured = document.getElementById('totpNotConfigured');
        const configuredEl = document.getElementById('totpConfigured');
        
        if (isConfigured) {
            notConfigured.style.display = 'none';
            configuredEl.style.display = 'block';
        } else {
            notConfigured.style.display = 'block';
            configuredEl.style.display = 'none';
        }
    }

    async function setupTOTP() {
        document.getElementById('totpSetupSection').style.display = 'block';
        document.getElementById('totpLoading').style.display = 'block';
        document.getElementById('qrCodeContainer').style.display = 'none';
        document.getElementById('totpVerifySection').style.display = 'none';
        
        try {
            const res = await fetch('/api/admin/generate-totp-secret', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            
            if (data.success) {
                document.getElementById('qrCodeImage').src = data.qrCode;
                document.getElementById('qrCodeContainer').style.display = 'block';
                document.getElementById('totpVerifySection').style.display = 'block';
                showNotification('QR code generated. Scan with your authenticator app.', 'success');
            } else {
                showNotification(data.message || 'Failed to generate TOTP secret', 'error');
                cancelTOTPSetup();
            }
        } catch (err) {
            console.error('Error setting up TOTP:', err);
            showNotification('Error setting up 2FA', 'error');
            cancelTOTPSetup();
        } finally {
            document.getElementById('totpLoading').style.display = 'none';
        }
    }

    async function verifyTOTPSetup() {
        const token = document.getElementById('setupTotpToken').value.trim();
        
        if (!token || token.length !== 6) {
            showNotification('Please enter a valid 6-digit code', 'error');
            return;
        }
        
        try {
            const res = await fetch('/api/admin/verify-totp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await res.json();
            
            if (data.success) {
                showNotification('2FA enabled successfully!', 'success');
                cancelTOTPSetup();
                checkTOTPStatus();
            } else {
                showNotification(data.message || 'Invalid TOTP code', 'error');
            }
        } catch (err) {
            console.error('Error verifying TOTP:', err);
            showNotification('Error verifying TOTP code', 'error');
        }
    }

    function cancelTOTPSetup() {
        document.getElementById('totpSetupSection').style.display = 'none';
        document.getElementById('setupTotpToken').value = '';
    }

    async function disableTOTP() {
        if (!confirm('Are you sure you want to disable 2FA? This will make your admin account less secure.')) {
            return;
        }
        
        // Note: This requires a server endpoint to disable TOTP
        // For now, we'll just show a message
        showNotification('To disable 2FA, please restart the server to clear the TOTP secret.', 'warning');
    }

    // Check TOTP status when security tab is opened
    document.addEventListener('DOMContentLoaded', function() {
        // Add event listener for security tab
        const securityTab = document.querySelector('.settings-tab[data-tab="security"]');
        if (securityTab) {
            securityTab.addEventListener('click', function() {
                checkTOTPStatus();
            });
        }
    });

    function applyFilter(table, query) {
        const q = (query || '').trim().toLowerCase();
        const tbody = table.tBodies[0];
        if (!tbody) return { visible: 0, total: 0 };
        const rows = tbody.querySelectorAll('tr');
        let visible = 0;
        rows.forEach(tr => {
            // Skip empty-state rows (single cell with colspan)
            const onlyCell = tr.children.length === 1 && tr.children[0].hasAttribute('colspan');
            if (onlyCell) {
                tr.style.display = q ? 'none' : '';
                return;
            }
            if (!q) {
                tr.style.display = '';
                visible++;
                return;
            }
            const text = (tr.textContent || '').toLowerCase();
            if (text.includes(q)) {
                tr.style.display = '';
                visible++;
            } else {
                tr.style.display = 'none';
            }
        });
        return { visible, total: rows.length };
    }

    function attachSearchToTable(table) {
        if (!table || table.dataset.searchAttached === '1') return;
        if (!table.id) return; // require id

        // Skip studentsTable since it has custom search with batch filter
        if (table.id === 'studentsTable') return;

        // Find the page-content wrapper (the section with the header buttons)
        const pageContent = table.closest('.page-content');
        if (!pageContent) return;

        // Check if search already exists for this page-content
        // (check both pageContent and the header toolbar since toolbar may have been moved)
        if (pageContent.dataset.searchAttached === '1') return;
        const headerToolbar = document.getElementById('headerToolbar');
        if (headerToolbar && headerToolbar.querySelector('.table-search-wrap')) return;

        // Look for .page-toolbar first, then .form-page-header
        let header = pageContent.querySelector('.page-toolbar');
        if (!header) {
            header = pageContent.querySelector('.form-page-header');
            if (header) {
                header.classList.add('page-toolbar');
            }
        }
        if (!header) {
            header = document.createElement('div');
            header.className = 'page-toolbar';
            header.style.display = 'flex';
            header.style.gap = '10px';
            header.style.marginBottom = '16px';
            pageContent.insertBefore(header, pageContent.firstChild);
        }
        if (!header) return;

        const search = document.createElement('div');
        search.className = 'table-search-wrap';
        search.style.marginLeft = 'auto';
        search.style.marginBottom = '0';
        search.innerHTML = `
            <div class="search-input-area">
                <i class="fas fa-search search-ico"></i>
                <input type="text" placeholder="Search..." aria-label="Search table">
                <button type="button" class="clear-btn" title="Clear"><i class="fas fa-times"></i></button>
                <span class="search-count"></span>
            </div>
            <button type="button" class="search-go-btn" title="Search"><i class="fas fa-arrow-right"></i></button>
        `;
        header.appendChild(search);

        const input = search.querySelector('input');
        const clearBtn = search.querySelector('.clear-btn');
        const countEl = search.querySelector('.search-count');
        const goBtn = search.querySelector('.search-go-btn');

        const update = () => {
            const q = input.value;
            const { visible, total } = applyFilter(table, q);
            if (q) {
                clearBtn.style.display = 'block';
                countEl.style.display = 'none';
                countEl.textContent = `${visible}/${total}`;
                countEl.style.display = 'block';
                clearBtn.style.right = (countEl.offsetWidth + 12) + 'px';
            } else {
                clearBtn.style.display = 'none';
                countEl.textContent = '';
            }
        };

        input.addEventListener('input', update);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); update(); } });
        clearBtn.addEventListener('click', () => { input.value = ''; update(); input.focus(); });
        goBtn.addEventListener('click', () => { update(); input.focus(); });

        // Re-apply filter when tbody contents change (data reloads)
        const tbody = table.tBodies[0];
        if (tbody && 'MutationObserver' in window) {
            const mo = new MutationObserver(() => {
                if (input.value) update();
            });
            mo.observe(tbody, { childList: true, subtree: false });
        }

        table.dataset.searchAttached = '1';
        pageContent.dataset.searchAttached = '1';
    }

    function scanAndAttach() {
        document.querySelectorAll('table').forEach(t => {
            // Only data tables (skip nested/inline small tables without thead+tbody)
            if (!t.tHead || !t.tBodies[0]) return;
            // Skip dashboard "recent" mini tables to keep dashboard clean
            const id = (t.id || '').toLowerCase();
            if (id.startsWith('dash') || id.startsWith('recent')) return;
            // Require an id (so each table is identifiable)
            if (!t.id) return;
            attachSearchToTable(t);
        });
    }

    // Run after initial load and whenever new content is rendered
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scanAndAttach);
    } else {
        scanAndAttach();
    }

    // Watch for tables added later (e.g. when navigating to admin pages)
    const bodyObserver = new MutationObserver(() => scanAndAttach());
    bodyObserver.observe(document.body, { childList: true, subtree: true });
})();

// ============================================================
// ===== Blog Comments Moderation =====
// ============================================================
let _blogCommentsCache = [];
let _blogCommentTab = 'pending';
let _commentReplyTarget = null;

function setCommentTab(status) {
    _blogCommentTab = status;
    document.querySelectorAll('.comment-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.status === status);
    });
    loadBlogComments();
}

async function loadBlogComments() {
    try {
        const res = await fetch('/api/admin/comments?status=' + encodeURIComponent(_blogCommentTab));
        const data = await res.json();
        if (!data.success) return;
        _blogCommentsCache = data.comments || [];
        // Update pending badges
        const pending = data.pendingCount || 0;
        const navBadge = document.getElementById('blogCommentsBadge');
        if (navBadge) {
            navBadge.textContent = pending;
            navBadge.style.display = pending > 0 ? 'inline-block' : 'none';
        }
        const tabBadge = document.getElementById('cmtPendingCount');
        if (tabBadge) tabBadge.textContent = pending;
        renderBlogCommentsList();
        // Update inline comment counts on blog table
        if (typeof _allBlogs !== 'undefined' && Array.isArray(_allBlogs)) {
            const allRes = await fetch('/api/admin/comments?status=all');
            const allData = await allRes.json();
            if (allData.success) {
                const counts = {};
                (allData.comments || []).forEach(c => {
                    counts[c.blogId] = (counts[c.blogId] || 0) + 1;
                });
                _allBlogs.forEach(b => {
                    const el = document.getElementById('blogCmtCount-' + b.id);
                    if (el) el.textContent = counts[b.id] || 0;
                });
            }
        }
    } catch (e) { console.error('Load comments err:', e); }
}

function renderBlogCommentsList() {
    const container = document.getElementById('blogCommentsList');
    if (!container) return;
    if (_blogCommentsCache.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:50px;color:rgba(255,255,255,0.5);"><i class="fas fa-inbox" style="font-size:50px;opacity:0.3;display:block;margin-bottom:14px;"></i>No comments in this view.</div>';
        return;
    }
    container.innerHTML = `
        <div class="data-table">
            <table>
                <thead><tr>
                    <th><input type="checkbox" id="cmtSelectAll" onchange="cmtToggleSelectAll(this)"></th>
                    <th>Status</th><th>Author</th><th>Comment</th><th>Blog Post</th><th>Date</th><th>Actions</th>
                </tr></thead>
                <tbody>
                ${_blogCommentsCache.map(c => renderCommentRow(c)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderCommentRow(c) {
    const status = c.approved
        ? '<span style="color:#16a34a;font-weight:600;">' + (c.isAdmin ? 'Admin Reply' : 'Approved') + '</span>'
        : '<span style="color:#ef4444;font-weight:600;">Pending</span>';
    const date = formatDate(c.createdAt);
    const blogLink = c.blogSlug
        ? '<a href="/blog/' + encodeURIComponent(c.blogSlug) + '" target="_blank" style="color:#f59e0b;text-decoration:none;">' + escapeAdminHtml(c.blogTitle) + ' <i class="fas fa-external-link-alt" style="font-size:10px;"></i></a>'
        : escapeAdminHtml(c.blogTitle);
    const isReply = c.parentId ? '<span style="color:#94a3b8;font-size:11px;">↳ Reply</span> ' : '';
    return `<tr data-comment-id="${c.id}">
        <td><input type="checkbox" class="cmt-select" data-id="${c.id}"></td>
        <td>${status}</td>
        <td><strong style="color:#fff;">${escapeAdminHtml(c.name)}</strong><br><small style="color:#94a3b8;">${escapeAdminHtml(c.email || '')}</small></td>
        <td style="max-width:400px;min-width:280px;">${isReply}<div style="white-space:pre-wrap;word-break:break-word;font-size:14px;color:#e2e8f0;line-height:1.5;max-height:120px;overflow-y:auto;padding:4px;background:rgba(0,0,0,0.2);border-radius:4px;">${escapeAdminHtml(c.content)}</div></td>
        <td style="max-width:200px;min-width:150px;">${blogLink}</td>
        <td style="color:#cbd5e1;">${date}</td>
        <td style="white-space:nowrap;">
            ${!c.approved ? `<button class="btn btn-success" onclick="approveComment(${c.id})" style="padding:6px 10px;font-size:13px;margin-right:4px;background:#16a34a;" title="Approve"><i class="fas fa-check"></i></button>` : ''}
            ${c.approved && !c.isAdmin ? `<button class="btn btn-secondary" onclick="unapproveComment(${c.id})" style="padding:6px 10px;font-size:13px;margin-right:4px;" title="Unapprove"><i class="fas fa-undo"></i></button>` : ''}
            ${!c.isAdmin ? `<button class="btn btn-primary" onclick="openReplyModal(${c.id})" style="padding:6px 10px;font-size:13px;margin-right:4px;" title="Reply"><i class="fas fa-reply"></i></button>` : ''}
            <button class="btn btn-secondary" onclick="deleteComment(${c.id})" style="padding:6px 10px;font-size:13px;background:#ef4444;color:#fff;" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
    </tr>`;
}

function escapeAdminHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function cmtToggleSelectAll(checkbox) {
    document.querySelectorAll('.cmt-select').forEach(cb => cb.checked = checkbox.checked);
}

function getSelectedCommentIds() {
    return Array.from(document.querySelectorAll('.cmt-select:checked')).map(cb => parseInt(cb.dataset.id));
}

async function approveComment(id) {
    try {
        const res = await fetch('/api/admin/comments/' + id + '/approve', { method: 'PUT' });
        const data = await res.json();
        if (data.success) { showNotification('Comment approved', 'success'); loadBlogComments(); }
    } catch (e) { showNotification('Error approving comment', 'error'); }
}

async function unapproveComment(id) {
    try {
        const res = await fetch('/api/admin/comments/' + id + '/unapprove', { method: 'PUT' });
        const data = await res.json();
        if (data.success) { showNotification('Comment moved back to pending', 'success'); loadBlogComments(); }
    } catch (e) { showNotification('Error', 'error'); }
}

async function deleteComment(id) {
    if (!confirm('Delete this comment? Replies to it will also be deleted.')) return;
    try {
        const res = await fetch('/api/admin/comments/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { showNotification('Comment deleted', 'success'); loadBlogComments(); }
    } catch (e) { showNotification('Error deleting', 'error'); }
}

async function bulkApproveComments() {
    const ids = getSelectedCommentIds();
    if (ids.length === 0) return showNotification('No comments selected', 'warning');
    try {
        const res = await fetch('/api/admin/comments/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, action: 'approve' })
        });
        if ((await res.json()).success) { showNotification(`${ids.length} comments approved`, 'success'); loadBlogComments(); }
    } catch (e) { showNotification('Error', 'error'); }
}

async function bulkDeleteComments() {
    const ids = getSelectedCommentIds();
    if (ids.length === 0) return showNotification('No comments selected', 'warning');
    if (!confirm(`Delete ${ids.length} comments?`)) return;
    try {
        const res = await fetch('/api/admin/comments/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, action: 'delete' })
        });
        if ((await res.json()).success) { showNotification(`${ids.length} comments deleted`, 'success'); loadBlogComments(); }
    } catch (e) { showNotification('Error', 'error'); }
}

function openReplyModal(commentId) {
    const c = _blogCommentsCache.find(x => x.id == commentId);
    if (!c) return;
    _commentReplyTarget = c;
    document.getElementById('replyCommentId').value = c.id;
    document.getElementById('replyToName').textContent = c.name;
    document.getElementById('replyToContent').textContent = c.content;
    document.getElementById('replyContent').value = '';
    document.getElementById('commentReplyModal').style.display = 'flex';
}

function closeCommentReplyModal() {
    document.getElementById('commentReplyModal').style.display = 'none';
    _commentReplyTarget = null;
}

async function submitCommentReply() {
    const id = document.getElementById('replyCommentId').value;
    const content = document.getElementById('replyContent').value.trim();
    if (!content) return showNotification('Reply cannot be empty', 'warning');
    try {
        const res = await fetch('/api/admin/comments/' + id + '/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, name: 'Admin' })
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Reply posted', 'success');
            closeCommentReplyModal();
            loadBlogComments();
        } else {
            showNotification(data.message || 'Error', 'error');
        }
    } catch (e) { showNotification('Error posting reply', 'error'); }
}

// Auto-refresh pending count every 60s
setInterval(() => {
    fetch('/api/admin/comments?status=pending')
        .then(r => r.json())
        .then(d => {
            if (!d.success) return;
            const badge = document.getElementById('blogCommentsBadge');
            if (badge) {
                const count = d.pendingCount || 0;
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        }).catch(() => {});
}, 60000);

// Initial badge load (after login)
setTimeout(() => {
    fetch('/api/admin/comments?status=pending')
        .then(r => r.json())
        .then(d => {
            if (!d.success) return;
            const badge = document.getElementById('blogCommentsBadge');
            if (badge) {
                const count = d.pendingCount || 0;
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        }).catch(() => {});
}, 2000);

// ============================================================
// ===== Newsletter Subscribers =====
// ============================================================
let _newsletterSubs = [];

async function loadNewsletterSubs() {
    try {
        const res = await fetch('/api/admin/newsletter/subscribers');
        const data = await res.json();
        if (!data.success) return;
        _newsletterSubs = data.subscribers || [];
        document.getElementById('newsletterCount').textContent = '(' + _newsletterSubs.length + ')';
        const tbody = document.querySelector('#newsletterTable tbody');
        if (_newsletterSubs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">No subscribers yet.</td></tr>';
            return;
        }
        tbody.innerHTML = _newsletterSubs
            .slice()
            .sort((a, b) => new Date(b.subscribedAt) - new Date(a.subscribedAt))
            .map((s, i) => `
            <tr>
                <td style="color:#cbd5e1;">${i + 1}</td>
                <td style="min-width:200px;"><a href="mailto:${escapeAdminHtml(s.email)}" style="color:#f59e0b;text-decoration:none;font-weight:500;">${escapeAdminHtml(s.email)}</a></td>
                <td style="min-width:150px;color:#e2e8f0;font-weight:500;">${escapeAdminHtml(s.name || '-')}</td>
                <td style="color:#cbd5e1;">${formatDate(s.subscribedAt)}</td>
                <td><button class="btn btn-secondary" onclick="deleteNewsletterSub(${s.id})" style="padding:6px 10px;font-size:13px;background:#ef4444;color:#fff;" title="Delete"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
    } catch (e) { console.error('Newsletter load err:', e); }
}

async function deleteNewsletterSub(id) {
    if (!confirm('Remove this subscriber?')) return;
    try {
        const res = await fetch('/api/admin/newsletter/subscribers/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { showNotification('Subscriber removed', 'success'); loadNewsletterSubs(); }
    } catch (e) { showNotification('Error', 'error'); }
}

// ===== Pending Blogs Review =====
async function loadPendingBlogs() {
    try {
        const res = await fetch('/api/admin/blogs/pending');
        const data = await res.json();
        if (!data.success) return;
        
        const pendingBlogs = data.blogs || [];
        document.getElementById('pendingBlogsCount').textContent = '(' + pendingBlogs.length + ')';
        
        const badge = document.getElementById('pendingBlogsBadge');
        if (badge) {
            badge.textContent = pendingBlogs.length;
            badge.style.display = pendingBlogs.length > 0 ? 'inline' : 'none';
        }
        
        const container = document.getElementById('pendingBlogsList');
        
        if (pendingBlogs.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="fas fa-check-circle" style="font-size:48px;margin-bottom:15px;"></i><p>No pending blogs to review.</p></div>';
            return;
        }
        
        container.innerHTML = pendingBlogs.map(blog => `
            <div style="background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px;">
                    <div>
                        <h4 style="margin:0 0 8px 0;color:#fff;font-size:18px;">${escapeAdminHtml(blog.title)}</h4>
                        <div style="display:flex;gap:15px;align-items:center;font-size:13px;color:#94a3b8;">
                            <span><i class="fas fa-user"></i> ${escapeAdminHtml(blog.author || 'Unknown')}</span>
                            <span><i class="fas fa-folder"></i> ${escapeAdminHtml(blog.category || 'N/A')}</span>
                            <span><i class="fas fa-calendar"></i> ${formatDate(blog.createdAt)}</span>
                        </div>
                    </div>
                    <span style="background:#f59e0b;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Pending</span>
                </div>
                
                ${blog.excerpt ? `<p style="color:#cbd5e1;margin-bottom:15px;line-height:1.6;">${escapeAdminHtml(blog.excerpt)}</p>` : ''}
                
                ${blog.image ? `<img src="${escapeAdminHtml(blog.image)}" alt="Blog Image" style="max-width:200px;border-radius:8px;margin-bottom:15px;">` : ''}
                
                <div style="display:flex;gap:10px;align-items:center;">
                    <button onclick="viewPendingBlog(${blog.id})" class="btn btn-secondary" style="padding:8px 16px;"><i class="fas fa-eye"></i> View Full</button>
                    <button onclick="approveBlog(${blog.id})" class="btn btn-success" style="padding:8px 16px;background:#16a34a;"><i class="fas fa-check"></i> Approve</button>
                    <button onclick="rejectBlog(${blog.id})" class="btn btn-danger" style="padding:8px 16px;"><i class="fas fa-times"></i> Reject</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error loading pending blogs:', e);
    }
}

async function viewPendingBlog(blogId) {
    try {
        const res = await fetch('/api/blogs?all=1');
        const data = await res.json();
        const blog = data.blogs.find(b => b.id === blogId);
        
        if (!blog) return;
        
        const content = `
            <div style="max-height:70vh;overflow-y:auto;padding:20px;">
                <h2 style="margin:0 0 15px 0;color:#fff;">${escapeAdminHtml(blog.title)}</h2>
                <div style="display:flex;gap:15px;align-items:center;margin-bottom:20px;font-size:13px;color:#94a3b8;">
                    <span><i class="fas fa-user"></i> ${escapeAdminHtml(blog.author || 'Unknown')}</span>
                    <span><i class="fas fa-folder"></i> ${escapeAdminHtml(blog.category || 'N/A')}</span>
                    <span><i class="fas fa-calendar"></i> ${formatDate(blog.createdAt)}</span>
                </div>
                ${blog.image ? `<img src="${escapeAdminHtml(blog.image)}" alt="Blog Image" style="max-width:100%;border-radius:8px;margin-bottom:20px;">` : ''}
                <div style="color:#e2e8f0;line-height:1.8;">${blog.content}</div>
                ${(blog.tags || []).length > 0 ? `<div style="margin-top:20px;"><strong>Tags:</strong> ${blog.tags.map(t => `<span style="background:rgba(102,126,234,0.3);color:#fff;padding:4px 10px;border-radius:15px;font-size:12px;margin-right:8px;">${escapeAdminHtml(t)}</span>`).join('')}</div>` : ''}
            </div>
        `;
        
        showModal('Blog Preview', content, [
            { text: 'Close', class: 'btn-secondary', onclick: 'closeModal()' }
        ]);
    } catch (e) {
        console.error('Error viewing blog:', e);
    }
}

async function approveBlog(blogId) {
    if (!confirm('Are you sure you want to approve this blog? It will be published immediately.')) return;
    
    try {
        const res = await fetch(`/api/admin/blogs/${blogId}/approve`, {
            method: 'PUT'
        });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Blog approved and published successfully!', 'success');
            loadPendingBlogs();
        } else {
            showNotification(data.message || 'Failed to approve blog', 'error');
        }
    } catch (e) {
        console.error('Error approving blog:', e);
        showNotification('Error approving blog', 'error');
    }
}

async function rejectBlog(blogId) {
    const reason = prompt('Please enter a reason for rejection (optional):');
    
    try {
        const res = await fetch(`/api/admin/blogs/${blogId}/reject`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejectionReason: reason || '' })
        });
        const data = await res.json();
        
        if (data.success) {
            showNotification('Blog rejected successfully!', 'success');
            loadPendingBlogs();
        } else {
            showNotification(data.message || 'Failed to reject blog', 'error');
        }
    } catch (e) {
        console.error('Error rejecting blog:', e);
        showNotification('Error rejecting blog', 'error');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#16a34a' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function exportNewsletterCSV() {
    if (_newsletterSubs.length === 0) return showNotification('No subscribers to export', 'warning');
    const rows = [['Email', 'Name', 'Subscribed On']];
    _newsletterSubs.forEach(s => rows.push([s.email, s.name || '', s.subscribedAt]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'newsletter-subscribers-' + new Date().toISOString().substring(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// ===== Legal Pages Editor (Privacy, Terms, Refund, Disclaimer, Sitemap) =====
let _legalQuill = null;
let _legalCurrentSlug = 'privacy';
let _legalPages = {};

const LEGAL_SLUG_TO_URL = {
    privacy: '/privacy.html',
    terms: '/terms.html',
    refund: '/refund.html',
    disclaimer: '/disclaimer.html',
    sitemap: '/sitemap.html'
};

function _legalFormatDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleString(); } catch (_) { return ''; }
}

async function loadLegalPagesEditor() {
    try {
        const res = await fetch('/api/legal-pages');
        _legalPages = await res.json() || {};
    } catch (err) {
        showNotification('Error loading legal pages', 'error');
        return;
    }

    // Initialize Quill once
    if (!_legalQuill && typeof Quill !== 'undefined') {
        _legalQuill = new Quill('#legalEditor', {
            theme: 'snow',
            placeholder: 'Edit page content here...',
            modules: {
                toolbar: [
                    [{ header: [1, 2, 3, 4, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    [{ align: [] }],
                    ['link', 'blockquote', 'code-block'],
                    [{ color: [] }, { background: [] }],
                    ['clean']
                ]
            }
        });
    }

    // Wire up tab buttons (one time)
    document.querySelectorAll('#legalPageTabs .legal-tab').forEach(btn => {
        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', () => selectLegalPage(btn.dataset.slug));
    });

    const saveBtn = document.getElementById('legalSaveBtn');
    if (saveBtn && !saveBtn.dataset.wired) {
        saveBtn.dataset.wired = '1';
        saveBtn.addEventListener('click', saveLegalPage);
    }

    selectLegalPage(_legalCurrentSlug);
}

function selectLegalPage(slug) {
    _legalCurrentSlug = slug;
    // Update active tab UI
    document.querySelectorAll('#legalPageTabs .legal-tab').forEach(btn => {
        const active = btn.dataset.slug === slug;
        btn.classList.toggle('btn-primary', active);
        btn.classList.toggle('btn-secondary', !active);
        btn.classList.toggle('active', active);
    });

    const page = _legalPages[slug] || { title: '', content: '', updatedAt: '' };
    document.getElementById('legalPageTitle').value = page.title || '';
    if (_legalQuill) {
        _legalQuill.clipboard.dangerouslyPasteHTML(page.content || '');
    }
    const link = document.getElementById('legalPreviewLink');
    if (link) link.href = LEGAL_SLUG_TO_URL[slug] || '#';
    const upd = document.getElementById('legalUpdatedAt');
    if (upd) upd.textContent = page.updatedAt ? ('Last updated: ' + _legalFormatDate(page.updatedAt)) : '';
}

async function saveLegalPage() {
    const slug = _legalCurrentSlug;
    const title = document.getElementById('legalPageTitle').value.trim();
    const content = _legalQuill ? _legalQuill.root.innerHTML : '';
    if (!title) return showNotification('Title is required', 'warning');
    try {
        const res = await fetch('/api/legal-pages/' + encodeURIComponent(slug), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        const data = await res.json();
        if (data.success) {
            _legalPages[slug] = data.page;
            const upd = document.getElementById('legalUpdatedAt');
            if (upd) upd.textContent = 'Last updated: ' + _legalFormatDate(data.page.updatedAt);
            showNotification('Page saved successfully!', 'success');
        } else {
            showNotification(data.message || 'Save failed', 'error');
        }
    } catch (err) {
        showNotification('Error saving page', 'error');
    }
}

// ===== Typing Practice Admin Functions =====

// Load typing practice users
async function loadTypingUsers() {
    try {
        const res = await fetch('/api/typing-scores/all');
        const data = await res.json();
        let scores = data.scores || [];
        
        // Apply search filter
        const searchTerm = (document.getElementById('typingUserSearch')?.value || '').toLowerCase();
        if (searchTerm) {
            scores = scores.filter(score => 
                (score.studentName || score.name || 'Unknown').toLowerCase().includes(searchTerm)
            );
        }
        
        // Apply date filters
        const dateFrom = document.getElementById('typingDateFrom')?.value;
        const dateTo = document.getElementById('typingDateTo')?.value;
        if (dateFrom) {
            scores = scores.filter(score => {
                const d = new Date(score.createdAt || score.date);
                return d >= new Date(dateFrom + 'T00:00:00');
            });
        }
        if (dateTo) {
            scores = scores.filter(score => {
                const d = new Date(score.createdAt || score.date);
                return d <= new Date(dateTo + 'T23:59:59');
            });
        }
        
        // Group scores by user name
        const users = {};
        scores.forEach(score => {
            const name = score.studentName || score.name || 'Unknown';
            if (!users[name]) {
                users[name] = {
                    name: name,
                    bestWPM: score.wpm,
                    bestAccuracy: score.accuracy,
                    attempts: 0,
                    lastActive: score.createdAt || score.date,
                    allScores: []
                };
            }
            users[name].attempts++;
            users[name].allScores.push(score);
            if (score.wpm > users[name].bestWPM) users[name].bestWPM = score.wpm;
            if (score.accuracy > users[name].bestAccuracy) users[name].bestAccuracy = score.accuracy;
            const scoreDate = score.createdAt || score.date;
            if (scoreDate && new Date(scoreDate) > new Date(users[name].lastActive)) {
                users[name].lastActive = scoreDate;
            }
        });
        
        // Convert to array and sort by last active (newest first by default)
        const sortOrder = document.getElementById('typingSortOrder')?.value || 'newest';
        const usersArray = Object.values(users);
        usersArray.sort((a, b) => {
            const dateA = new Date(a.lastActive).getTime();
            const dateB = new Date(b.lastActive).getTime();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });
        
        const table = document.getElementById('typingUsersTable');
        if (usersArray.length === 0) {
            table.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">No users found</td></tr>';
            return;
        }
        
        table.innerHTML = usersArray.map(user => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                <td style="padding:12px; font-weight:600;">${esc(user.name)}</td>
                <td style="padding:12px; color:#4facfe; font-weight:600;">${user.bestWPM}</td>
                <td style="padding:12px; color:#43e97b; font-weight:600;">${user.bestAccuracy}%</td>
                <td style="padding:12px;">${user.attempts}</td>
                <td style="padding:12px;">${formatDate(user.lastActive)}</td>
                <td style="padding:12px; display:flex; gap:6px;">
                    <button class="btn btn-primary" onclick="showTypingHistory('${esc(user.name)}')" style="padding:4px 10px; font-size:12px;"><i class="fas fa-history"></i> History</button>
                    <button class="btn btn-danger" onclick="deleteTypingUser('${esc(user.name)}')" style="padding:4px 10px; font-size:12px;">Delete</button>
                </td>
            </tr>
        `).join('');
        
        // Store all scores globally for history access
        window._allTypingScores = scores;
    } catch (e) {
        showNotification('Error loading users: ' + e.message, 'error');
    }
}

// Show typing history for a specific user
function showTypingHistory(name) {
    const allScores = window._allTypingScores || [];
    const userScores = allScores.filter(s => (s.studentName || s.name || 'Unknown') === name);
    
    const modal = document.getElementById('typingHistoryModal');
    const nameSpan = document.getElementById('typingHistoryName');
    const body = document.getElementById('typingHistoryBody');
    
    nameSpan.textContent = name;
    
    if (userScores.length === 0) {
        body.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center; padding:20px;">No history found</p>';
    } else {
        userScores.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
        body.innerHTML = `
            <table style="width:100%; border-collapse:separate; border-spacing:0;">
                <thead>
                    <tr style="background:rgba(102,126,234,0.15);">
                        <th style="padding:10px; text-align:left; color:#f8fafc; border-bottom:2px solid rgba(102,126,234,0.5);">WPM</th>
                        <th style="padding:10px; text-align:left; color:#f8fafc; border-bottom:2px solid rgba(102,126,234,0.5);">Accuracy</th>
                        <th style="padding:10px; text-align:left; color:#f8fafc; border-bottom:2px solid rgba(102,126,234,0.5);">Level</th>
                        <th style="padding:10px; text-align:left; color:#f8fafc; border-bottom:2px solid rgba(102,126,234,0.5);">Duration</th>
                        <th style="padding:10px; text-align:left; color:#f8fafc; border-bottom:2px solid rgba(102,126,234,0.5);">Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${userScores.map((score, i) => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.08); transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background=''">
                            <td style="padding:10px; color:#4facfe; font-weight:600;">${score.wpm}</td>
                            <td style="padding:10px; color:#43e97b;">${score.accuracy}%</td>
                            <td style="padding:10px; color:#e2e8f0;">${score.difficulty || score.level || '-'}</td>
                            <td style="padding:10px; color:#e2e8f0;">${score.duration ? score.duration + 's' : '-'}</td>
                            <td style="padding:10px; color:#e2e8f0;">${formatDate(score.createdAt || score.date)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    modal.style.display = 'flex';
}

// Close typing history modal
function closeTypingHistory() {
    document.getElementById('typingHistoryModal').style.display = 'none';
}

// Clear date filters
function clearTypingDateFilter() {
    const fromInput = document.getElementById('typingDateFrom');
    const toInput = document.getElementById('typingDateTo');
    const searchInput = document.getElementById('typingUserSearch');
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    if (searchInput) searchInput.value = '';
    loadTypingUsers();
}

// Delete typing practice user
async function deleteTypingUser(name) {
    if (!confirm(`Are you sure you want to delete all data for user "${name}"?`)) return;
    try {
        await fetch('/api/typing-scores/user/' + encodeURIComponent(name), { method: 'DELETE' });
        loadTypingUsers();
        showNotification('User deleted successfully', 'success');
    } catch (e) {
        showNotification('Error deleting user: ' + e.message, 'error');
    }
}

// Load typing level content
function loadTypingLevelContent() {
    const level = document.getElementById('typingLevelSelect').value;
    if (!level) return;
    
    try {
        const typingTexts = JSON.parse(localStorage.getItem('typingTexts') || '{}');
        let textArray;
        let contentLength;
        
        if (level <= 5) {
            textArray = typingTexts.homeRowTexts || [];
            contentLength = 500;
        } else if (level <= 10) {
            textArray = typingTexts.topRowTexts || [];
            contentLength = 1050;
        } else if (level <= 15) {
            textArray = typingTexts.homeTopTexts || [];
            contentLength = 1600;
        } else if (level <= 20) {
            textArray = typingTexts.bottomRowTexts || [];
            contentLength = 2150;
        } else if (level <= 25) {
            textArray = typingTexts.shortSentences || [];
            contentLength = 2700;
        } else {
            textArray = typingTexts.detailedParagraphs || [];
            contentLength = 3250;
        }
        
        const textIndex = (parseInt(level) - 1) % textArray.length;
        const text = textArray[textIndex] || 'No text available for this level';
        
        document.getElementById('typingLevelText').value = text;
        document.getElementById('typingContentLength').value = contentLength;
    } catch (e) {
        showNotification('Error loading level content: ' + e.message, 'error');
        document.getElementById('typingLevelText').value = 'Error loading content. Please open the typing practice page first to initialize the text data.';
    }
}

// Save typing level content
function saveTypingLevelContent() {
    const level = document.getElementById('typingLevelSelect').value;
    const text = document.getElementById('typingLevelText').value;
    const length = document.getElementById('typingContentLength').value;
    
    if (!level) {
        showNotification('Please select a level first', 'warning');
        return;
    }
    
    try {
        const typingTexts = JSON.parse(localStorage.getItem('typingTexts') || '{}');
        let textArray;
        
        if (level <= 5) {
            textArray = typingTexts.homeRowTexts || [];
        } else if (level <= 10) {
            textArray = typingTexts.topRowTexts || [];
        } else if (level <= 15) {
            textArray = typingTexts.homeTopTexts || [];
        } else if (level <= 20) {
            textArray = typingTexts.bottomRowTexts || [];
        } else if (level <= 25) {
            textArray = typingTexts.shortSentences || [];
        } else {
            textArray = typingTexts.detailedParagraphs || [];
        }
        
        const textIndex = (parseInt(level) - 1) % textArray.length;
        textArray[textIndex] = text;
        
        // Update the appropriate array in storage
        if (level <= 5) {
            typingTexts.homeRowTexts = textArray;
        } else if (level <= 10) {
            typingTexts.topRowTexts = textArray;
        } else if (level <= 15) {
            typingTexts.homeTopTexts = textArray;
        } else if (level <= 20) {
            typingTexts.bottomRowTexts = textArray;
        } else if (level <= 25) {
            typingTexts.shortSentences = textArray;
        } else {
            typingTexts.detailedParagraphs = textArray;
        }
        
        localStorage.setItem('typingTexts', JSON.stringify(typingTexts));
        showNotification('Level content saved successfully', 'success');
    } catch (e) {
        showNotification('Error saving level content: ' + e.message, 'error');
    }
}

// Load typing leaderboard
async function loadTypingLeaderboard() {
    try {
        const res = await fetch('/api/typing-scores/all');
        const data = await res.json();
        const scores = data.scores || [];
        const levelFilter = document.getElementById('typingLeaderboardLevelFilter').value;
        
        let filteredScores = scores;
        if (levelFilter !== 'all') {
            filteredScores = scores.filter(score => (score.difficulty || score.level) === levelFilter);
        }
        
        filteredScores.sort((a, b) => b.wpm - a.wpm);
        filteredScores = filteredScores.slice(0, 50);
        
        const table = document.getElementById('typingLeaderboardTable');
        if (filteredScores.length === 0) {
            table.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center;">No scores found</td></tr>';
            return;
        }
        
        table.innerHTML = filteredScores.map((score, index) => {
            let rankDisplay = `#${index + 1}`;
            if (index === 0) rankDisplay = '🥇';
            if (index === 1) rankDisplay = '🥈';
            if (index === 2) rankDisplay = '🥉';
            
            return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                    <td style="padding:12px;">${rankDisplay}</td>
                    <td style="padding:12px;">${esc(score.studentName || score.name || 'Unknown')}</td>
                    <td style="padding:12px;">${score.difficulty || score.level || '-'}</td>
                    <td style="padding:12px;">${score.wpm}</td>
                    <td style="padding:12px;">${score.accuracy}%</td>
                    <td style="padding:12px;">${formatDate(score.createdAt || score.date)}</td>
                    <td style="padding:12px;">
                        <button class="btn btn-danger" onclick="deleteTypingScore('${score.id}')" style="padding:4px 8px; font-size:12px;">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        showNotification('Error loading leaderboard: ' + e.message, 'error');
    }
}

// Delete typing score
async function deleteTypingScore(id) {
    if (!confirm('Are you sure you want to delete this score?')) return;
    try {
        await fetch('/api/typing-scores/' + id, { method: 'DELETE' });
        loadTypingLeaderboard();
        showNotification('Score deleted successfully', 'success');
    } catch (e) {
        showNotification('Error deleting score: ' + e.message, 'error');
    }
}

// Clear typing leaderboard
async function clearTypingLeaderboard() {
    if (!confirm('Are you sure you want to clear ALL leaderboard data? This cannot be undone.')) return;
    try {
        const res = await fetch('/api/typing-scores/all');
        const data = await res.json();
        const scores = data.scores || [];
        for (const score of scores) {
            await fetch('/api/typing-scores/' + score.id, { method: 'DELETE' });
        }
        loadTypingLeaderboard();
        showNotification('Leaderboard cleared successfully', 'success');
    } catch (e) {
        showNotification('Error clearing leaderboard: ' + e.message, 'error');
    }
}

// Export typing leaderboard to CSV
async function exportTypingLeaderboard() {
    try {
        const res = await fetch('/api/typing-scores/all');
        const data = await res.json();
        const scores = data.scores || [];
        if (scores.length === 0) {
            showNotification('No data to export', 'warning');
            return;
        }
        
        const csv = 'Rank,Name,Difficulty,WPM,Accuracy,Date\n' + 
            scores.map((score, index) => 
                `${index + 1},"${score.studentName || score.name || 'Unknown'}",${score.difficulty || score.level || '-'},${score.wpm},${score.accuracy}%,${formatDate(score.createdAt || score.date)}`
            ).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'typing-leaderboard.csv';
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('Leaderboard exported successfully', 'success');
    } catch (e) {
        showNotification('Error exporting leaderboard: ' + e.message, 'error');
    }
}

// Load typing analytics
async function loadTypingAnalytics() {
    try {
        const res = await fetch('/api/typing-scores/all');
        const data = await res.json();
        const scores = data.scores || [];
        
        const totalUsers = new Set(scores.map(s => s.studentName || s.name)).size;
        const totalAttempts = scores.length;
        const avgWPM = scores.length > 0 ? (scores.reduce((sum, s) => sum + s.wpm, 0) / scores.length).toFixed(1) : 0;
        const avgAccuracy = scores.length > 0 ? (scores.reduce((sum, s) => sum + s.accuracy, 0) / scores.length).toFixed(1) : 0;
        
        document.getElementById('typingTotalUsers').textContent = totalUsers;
        document.getElementById('typingTotalAttempts').textContent = totalAttempts;
        document.getElementById('typingAvgWPM').textContent = avgWPM;
        document.getElementById('typingAvgAccuracy').textContent = avgAccuracy + '%';
        
        const wpmByLevel = {};
        scores.forEach(score => {
            const level = score.difficulty || score.level || 'unknown';
            if (!wpmByLevel[level]) {
                wpmByLevel[level] = { total: 0, count: 0 };
            }
            wpmByLevel[level].total += score.wpm;
            wpmByLevel[level].count++;
        });
        
        const wpmByLevelHtml = Object.entries(wpmByLevel)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([level, data]) => {
                const avg = (data.total / data.count).toFixed(1);
                return `<div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <span>${level}</span>
                    <span>${avg} WPM (${data.count} attempts)</span>
                </div>`;
            }).join('');
        
        document.getElementById('typingWpmByLevel').innerHTML = wpmByLevelHtml || '<p style="text-align:center; padding:20px;">No data available</p>';
        
        const levelAttempts = {};
        scores.forEach(score => {
            const level = score.difficulty || score.level || 'unknown';
            levelAttempts[level] = (levelAttempts[level] || 0) + 1;
        });
        
        const completionHtml = Object.entries(levelAttempts)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([level, count]) => {
                return `<div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <span>${level}</span>
                    <span>${count} attempts</span>
                </div>`;
            }).join('');
        
        document.getElementById('typingCompletionByLevel').innerHTML = completionHtml || '<p style="text-align:center; padding:20px;">No data available</p>';
        
    } catch (e) {
        showNotification('Error loading analytics: ' + e.message, 'error');
    }
}

// Save typing settings
function saveTypingSettings() {
    try {
        const settings = {
            defaultTime: document.getElementById('typingDefaultTime').value,
            wpmMethod: document.getElementById('typingWpmMethod').value,
            enableLeaderboard: document.getElementById('typingEnableLeaderboard').checked,
            enableFingerGuide: document.getElementById('typingEnableFingerGuide').checked,
            enableKeyboardHighlight: document.getElementById('typingEnableKeyboardHighlight').checked,
            minWpm: document.getElementById('typingMinWpm').value,
            minAccuracy: document.getElementById('typingMinAccuracy').value
        };
        
        localStorage.setItem('typingSettings', JSON.stringify(settings));
        showNotification('Settings saved successfully', 'success');
    } catch (e) {
        showNotification('Error saving settings: ' + e.message, 'error');
    }
}

// Initialize typing practice admin pages
function initTypingAdminPages() {
    const levelSelect = document.getElementById('typingLevelSelect');
    if (levelSelect) {
        for (let i = 1; i <= 50; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Level ${i}`;
            levelSelect.appendChild(option);
        }
    }
    
    const levelFilter = document.getElementById('typingLeaderboardLevelFilter');
    if (levelFilter) {
        for (let i = 1; i <= 50; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Level ${i}`;
            levelFilter.appendChild(option);
        }
    }
    
    const savedSettings = localStorage.getItem('typingSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        document.getElementById('typingDefaultTime').value = settings.defaultTime || 1;
        document.getElementById('typingWpmMethod').value = settings.wpmMethod || 'standard';
        document.getElementById('typingEnableLeaderboard').checked = settings.enableLeaderboard !== false;
        document.getElementById('typingEnableFingerGuide').checked = settings.enableFingerGuide !== false;
        document.getElementById('typingEnableKeyboardHighlight').checked = settings.enableKeyboardHighlight !== false;
        document.getElementById('typingMinWpm').value = settings.minWpm || 0;
        document.getElementById('typingMinAccuracy').value = settings.minAccuracy || 80;
    }
}

// Add initialization for typing admin pages
document.addEventListener('DOMContentLoaded', function() {
    initTypingAdminPages();
});

// ===== ADMIN PANEL UPGRADE FUNCTIONS =====

// Global variables for dashboard charts to prevent canvas re-use errors on loadDashboard calls
let revenueAdmissionChartInstance = null;
let courseDistributionChartInstance = null;

// Toggle Sidebar Collapse (Desktop)
window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    const isCollapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed ? 'true' : 'false');
    
    // Smoothly resize charts if they exist when sidebar collapser is toggled
    setTimeout(() => {
        if (revenueAdmissionChartInstance) revenueAdmissionChartInstance.resize();
        if (courseDistributionChartInstance) courseDistributionChartInstance.resize();
    }, 310);
};

// Filter Sidebar Menu
window.filterSidebarMenu = function() {
    const query = document.getElementById('sidebarSearchInput').value.trim().toLowerCase();
    const dropdowns = document.querySelectorAll('.sidebar-menu .dropdown');
    
    if (!query) {
        // Reset: show all links and close dropdowns (except active page dropdown)
        document.querySelectorAll('.sidebar-menu li').forEach(li => {
            li.style.display = '';
        });
        document.querySelectorAll('.sidebar-menu a').forEach(a => {
            a.style.display = '';
        });
        dropdowns.forEach(d => {
            d.classList.remove('open');
        });
        autoExpandActiveDropdown();
        return;
    }
    
    // First hide everything
    document.querySelectorAll('.sidebar-menu > li').forEach(li => {
        li.style.display = 'none';
    });
    
    let matchedAny = false;
    
    // Filter top-level items and dropdown children
    document.querySelectorAll('.sidebar-menu a[data-page]').forEach(link => {
        const text = link.textContent.toLowerCase();
        const page = link.dataset.page;
        
        if (text.includes(query)) {
            matchedAny = true;
            // Show link
            link.style.display = '';
            
            // Show parent li
            let parentLi = link.closest('li');
            while (parentLi) {
                parentLi.style.display = '';
                parentLi = parentLi.parentElement.closest('li');
            }
            
            // If link is inside a dropdown, open the dropdown
            const parentDropdown = link.closest('.dropdown');
            if (parentDropdown) {
                parentDropdown.classList.add('open');
                parentDropdown.style.display = '';
            }
        } else {
            // Hide this link specifically
            link.style.display = 'none';
        }
    });
    
    // Dropdown parent toggle items logic
    dropdowns.forEach(d => {
        const toggle = d.querySelector('.dropdown-toggle');
        const hasVisibleChildren = Array.from(d.querySelectorAll('.dropdown-menu a')).some(a => a.style.display !== 'none');
        
        if (hasVisibleChildren) {
            d.style.display = '';
            if (toggle) toggle.style.display = '';
        } else {
            // If dropdown title itself matches query, show all its items
            const titleText = toggle ? toggle.textContent.toLowerCase() : '';
            if (titleText.includes(query)) {
                d.style.display = '';
                if (toggle) toggle.style.display = '';
                d.classList.add('open');
                d.querySelectorAll('.dropdown-menu a').forEach(a => {
                    a.style.display = '';
                });
            } else {
                d.style.display = 'none';
            }
        }
    });
};

// Auto-expand Dropdown of Active Page
function autoExpandActiveDropdown() {
    // Clear previous parent highlights
    document.querySelectorAll('.dropdown.has-active').forEach(d => d.classList.remove('has-active'));
    const activeLink = document.querySelector('.sidebar-menu a.active');
    if (activeLink) {
        const parentDropdown = activeLink.closest('.dropdown');
        if (parentDropdown) {
            parentDropdown.classList.add('open');
            parentDropdown.classList.add('has-active');
        }
    }
}

// Sidebar Tooltips (Collapsed Mode)
(function initSidebarTooltips() {
    let tooltipEl = null;

    function getTooltip() {
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'sidebar-tooltip';
            document.body.appendChild(tooltipEl);
        }
        return tooltipEl;
    }

    function showTooltip(link) {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || !sidebar.classList.contains('collapsed')) return;
        // Get label text (excluding badge counts)
        const label = Array.from(link.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent.trim())
            .join(' ').trim();
        if (!label) return;
        const tip = getTooltip();
        tip.textContent = label;
        const rect = link.getBoundingClientRect();
        tip.style.left = (rect.right + 12) + 'px';
        tip.style.top = (rect.top + rect.height / 2) + 'px';
        tip.classList.add('visible');
    }

    function hideTooltip() {
        if (tooltipEl) tooltipEl.classList.remove('visible');
    }

    document.addEventListener('mouseover', function(e) {
        const link = e.target.closest('.sidebar-menu > li > a');
        if (link) {
            showTooltip(link);
        } else {
            hideTooltip();
        }
    });

    document.addEventListener('scroll', hideTooltip, true);
})();

// Collapsed Sidebar Flyout Submenus
(function initCollapsedFlyout() {
    document.addEventListener('mouseover', function(e) {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || !sidebar.classList.contains('collapsed')) return;
        const dropdown = e.target.closest('.sidebar-menu > li.dropdown');
        if (!dropdown) return;
        const menu = dropdown.querySelector('.dropdown-menu');
        if (!menu) return;
        const toggle = dropdown.querySelector('.dropdown-toggle');
        if (toggle) {
            const rect = toggle.getBoundingClientRect();
            menu.style.top = rect.top + 'px';
        }
    });

    // Click support for touch devices in collapsed mode
    document.addEventListener('click', function(e) {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || !sidebar.classList.contains('collapsed')) return;
        const toggle = e.target.closest('.sidebar-menu > li.dropdown > .dropdown-toggle');
        if (toggle) {
            e.preventDefault();
            const dropdown = toggle.closest('.dropdown');
            const isOpen = dropdown.classList.contains('flyout-open');
            document.querySelectorAll('.sidebar-menu > li.dropdown.flyout-open').forEach(d => d.classList.remove('flyout-open'));
            if (!isOpen) dropdown.classList.add('flyout-open');
            const menu = dropdown.querySelector('.dropdown-menu');
            if (menu && !isOpen) {
                const rect = toggle.getBoundingClientRect();
                menu.style.top = rect.top + 'px';
            }
        } else {
            document.querySelectorAll('.sidebar-menu > li.dropdown.flyout-open').forEach(d => d.classList.remove('flyout-open'));
        }
    });
})();

// Update Header Welcome Greeting & Digital Clock
function updateHeaderClock() {
    const greetingEl = document.getElementById('welcomeGreeting');
    const clockEl = document.getElementById('headerDateTime');
    const greetingContainer = document.getElementById('headerGreeting');
    if (!greetingEl && !clockEl) return;
    
    // Only update greeting text if greeting container is visible (dashboard page)
    const isGreetingVisible = greetingContainer && greetingContainer.style.display !== 'none';
    
    const now = new Date();
    
    // Greeting
    if (isGreetingVisible) {
    const hour = now.getHours();
    let greeting = 'Welcome, Admin';
    if (hour < 12) {
        greeting = 'Good Morning, Admin 🌅';
    } else if (hour < 17) {
        greeting = 'Good Afternoon, Admin ☀️';
    } else {
        greeting = 'Good Evening, Admin 🌆';
    }
    if (greetingEl) greetingEl.textContent = greeting;
    }
    
    // Clock/Date format: Wednesday, 8 Jul 2026 | 08:30:15 AM
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = days[now.getDay()];
    const dateNum = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const formattedHours = String(hours).padStart(2, '0');
    
    if (clockEl) {
        clockEl.innerHTML = `<i class="far fa-calendar-alt"></i> ${dayName}, ${dateNum} ${monthName} ${year} &nbsp;|&nbsp; <i class="far fa-clock"></i> ${formattedHours}:${minutes}:${seconds} ${ampm}`;
    }
}
