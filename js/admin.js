let currentPage = 'dashboard';
let currentGalleryImage = null;
let galleryImageError = null;

// Check session on page load
document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('adminSession') === 'active') {
        showDashboard();
    }
    
    // Gallery file input handler
    const galleryFile = document.getElementById('galleryFile');
    if (galleryFile) {
        galleryFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            galleryImageError = null;
            currentGalleryImage = null;
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                galleryImageError = 'Please select a valid image file (JPG, PNG, GIF etc.)';
                showNotification(galleryImageError, 'error');
                return;
            }
            
            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                galleryImageError = 'Image size too large! Maximum 10MB allowed.';
                showNotification(galleryImageError, 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(event) {
                currentGalleryImage = event.target.result;
                galleryImageError = null;
                document.getElementById('galleryPreviewImg').src = currentGalleryImage;
                document.getElementById('galleryPreviewImg').style.display = 'block';
                document.getElementById('galleryPlaceholder').style.display = 'none';
                showNotification('Image loaded successfully!', 'success');
            };
            reader.onerror = function() {
                galleryImageError = 'Error reading image file. Please try again.';
                currentGalleryImage = null;
                showNotification(galleryImageError, 'error');
            };
            reader.readAsDataURL(file);
        });
    }
    
    // Gallery form submit - handled by onclick for reliability

    
    // Logo file input handler
    const logoFile = document.getElementById('logoFile');
    if (logoFile) {
        logoFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const logoData = event.target.result;
                    localStorage.setItem('instituteLogo', logoData);
                    loadLogoPreview();
                    alert('Logo uploaded successfully! Save settings to apply.');
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

function showDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    loadDashboard();
    loadAdminLogo();
}

// Login handling
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (username === 'admin' && password === 'admin123') {
        localStorage.setItem('adminSession', 'active');
        showDashboard();
    } else {
        alert('Invalid credentials!\nTry: admin / admin123');
    }
});

// Logout handling
document.getElementById('logoutBtn').addEventListener('click', function() {
    localStorage.removeItem('adminSession');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
});

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
        
        // Load page data
        if (page === 'dashboard') loadDashboard();
        if (page === 'courses') loadCoursesTable();
        if (page === 'enquiries') loadEnquiriesTable();
        if (page === 'faculty') loadFacultyTable();
        if (page === 'gallery') loadGalleryTable();
        if (page === 'settings') loadSettings();
    });
});

function loadDashboard() {
    const courses = JSON.parse(localStorage.getItem('courses')) || [];
    const enquiries = JSON.parse(localStorage.getItem('enquiries')) || [];
    const faculty = JSON.parse(localStorage.getItem('faculty')) || [];
    const gallery = JSON.parse(localStorage.getItem('gallery')) || [];
    
    document.getElementById('totalCourses').textContent = courses.length;
    document.getElementById('totalEnquiries').textContent = enquiries.length;
    document.getElementById('totalFaculty').textContent = faculty.length;
    document.getElementById('totalGallery').textContent = gallery.length;
}

function loadAdminLogo() {
    const logoData = localStorage.getItem('instituteLogo');
    const adminLogo = document.getElementById('adminLogo');
    const adminDefaultIcon = document.getElementById('adminDefaultIcon');
    const adminSiteName = document.getElementById('adminSiteName');
    const settings = JSON.parse(localStorage.getItem('settings')) || {};
    
    if (logoData && adminLogo && adminDefaultIcon) {
        adminLogo.src = logoData;
        adminLogo.style.display = 'block';
        adminDefaultIcon.style.display = 'none';
    }
    
    if (adminSiteName && settings.name) {
        adminSiteName.textContent = settings.name;
    }
}

function loadCoursesTable() {
    const courses = JSON.parse(localStorage.getItem('courses')) || [];
    const tbody = document.querySelector('#coursesTable tbody');
    
    tbody.innerHTML = courses.map(course => `
        <tr>
            <td>${course.name}</td>
            <td>${course.duration}</td>
            <td>₹${course.price}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editCourse(${course.id})">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteCourse(${course.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function loadEnquiriesTable() {
    const enquiries = JSON.parse(localStorage.getItem('enquiries')) || [];
    const tbody = document.querySelector('#enquiriesTable tbody');
    
    if (enquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No enquiries yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = enquiries.map(e => `
        <tr>
            <td>${e.name}</td>
            <td>${e.email}</td>
            <td>${e.phone}</td>
            <td>${e.message}</td>
            <td>${e.date}</td>
        </tr>
    `).join('');
}

function loadFacultyTable() {
    const faculty = JSON.parse(localStorage.getItem('faculty')) || [];
    const tbody = document.querySelector('#facultyTable tbody');
    
    tbody.innerHTML = faculty.map(f => `
        <tr>
            <td>${f.name}</td>
            <td>${f.subject}</td>
            <td>${f.experience}</td>
            <td>
                <button class="action-btn delete-btn" onclick="deleteFaculty(${f.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function loadGalleryTable() {
    const gallery = JSON.parse(localStorage.getItem('gallery')) || [];
    const tbody = document.querySelector('#galleryTable tbody');
    
    tbody.innerHTML = gallery.map(item => `
        <tr>
            <td><img src="${item.image}" alt="${item.title}" style="width: 100px; height: 60px; object-fit: cover;"></td>
            <td>${item.title}</td>
            <td>
                <button class="action-btn delete-btn" onclick="deleteGalleryItem(${item.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('settings')) || {};
    document.getElementById('settingName').value = settings.name || '';
    document.getElementById('settingPhone').value = settings.phone || '';
    document.getElementById('settingEmail').value = settings.email || '';
    document.getElementById('settingAddress').value = settings.address || '';
    
    // Load logo preview
    loadLogoPreview();
}


function loadLogoPreview() {
    const logoData = localStorage.getItem('instituteLogo');
    const previewImg = document.getElementById('logoPreviewImg');
    const placeholder = document.getElementById('logoPlaceholder');
    const removeBtn = document.getElementById('removeLogoBtn');
    
    if (logoData) {
        previewImg.src = logoData;
        previewImg.style.display = 'block';
        placeholder.style.display = 'none';
        removeBtn.style.display = 'inline-block';
    } else {
        previewImg.style.display = 'none';
        placeholder.style.display = 'block';
        removeBtn.style.display = 'none';
    }
}

function removeLogo() {
    if (confirm('Are you sure you want to remove the logo?')) {
        localStorage.removeItem('instituteLogo');
        loadLogoPreview();
        alert('Logo removed! Save settings to apply.');
    }
}

// Modal Functions
function openCourseModal() {
    document.getElementById('courseForm').reset();
    document.getElementById('courseId').value = '';
    document.getElementById('courseModalTitle').textContent = 'Add Course';
    document.getElementById('courseModal').classList.add('active');
}

function editCourse(id) {
    const courses = JSON.parse(localStorage.getItem('courses')) || [];
    const course = courses.find(c => c.id === id);
    if (course) {
        document.getElementById('courseId').value = course.id;
        document.getElementById('courseName').value = course.name;
        document.getElementById('courseDuration').value = course.duration;
        document.getElementById('courseFee').value = course.fee || course.price || 0;
        document.getElementById('courseFeeType').value = course.feeType || 'Per Program';
        document.getElementById('courseDesc').value = course.description || '';
        document.getElementById('courseModalTitle').textContent = 'Edit Course';
        document.getElementById('courseModal').classList.add('active');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Course Form
document.getElementById('courseForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const id = document.getElementById('courseId').value;
    const name = document.getElementById('courseName').value;
    const duration = document.getElementById('courseDuration').value;
    const fee = document.getElementById('courseFee').value;
    const feeType = document.getElementById('courseFeeType').value;
    const description = document.getElementById('courseDesc').value;

    let courses = JSON.parse(localStorage.getItem('courses')) || [];

    if (id) {
        // Edit existing
        const index = courses.findIndex(c => c.id == id);
        if (index !== -1) {
            courses[index] = { id: parseInt(id), name, duration, fee, feeType, description };
        }
    } else {
        // Add new
        const newCourse = {
            id: Date.now(),
            name,
            duration,
            fee,
            feeType,
            description
        };
        courses.push(newCourse);
    }

    localStorage.setItem('courses', JSON.stringify(courses));
    loadCoursesTable();
    closeModal('courseModal');
    showNotification('Course saved successfully!', 'success');
});

function deleteCourse(id) {
    if (confirm('Are you sure you want to delete this course?')) {
        let courses = JSON.parse(localStorage.getItem('courses')) || [];
        courses = courses.filter(c => c.id !== id);
        localStorage.setItem('courses', JSON.stringify(courses));
        loadCoursesTable();
        loadDashboard();
    }
}

// Faculty Modal & Functions
function openFacultyModal() {
    document.getElementById('facultyForm').reset();
    document.getElementById('facultyModal').classList.add('active');
}

document.getElementById('facultyForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('facultyName').value;
    const subject = document.getElementById('facultySubject').value;
    const experience = document.getElementById('facultyExperience').value;
    
    let faculty = JSON.parse(localStorage.getItem('faculty')) || [];
    faculty.push({ id: Date.now(), name, subject, experience });
    
    localStorage.setItem('faculty', JSON.stringify(faculty));
    closeModal('facultyModal');
    loadFacultyTable();
    loadDashboard();
    alert('Faculty added successfully!');
});

function deleteFaculty(id) {
    if (confirm('Are you sure?')) {
        let faculty = JSON.parse(localStorage.getItem('faculty')) || [];
        faculty = faculty.filter(f => f.id !== id);
        localStorage.setItem('faculty', JSON.stringify(faculty));
        loadFacultyTable();
        loadDashboard();
    }
}

// Gallery Modal & Functions

function openGalleryModal() {
    document.getElementById('galleryForm').reset();
    currentGalleryImage = null;
    document.getElementById('galleryPreviewImg').style.display = 'none';
    document.getElementById('galleryPlaceholder').style.display = 'block';
    document.getElementById('galleryModal').classList.add('active');
}

function saveGalleryItem() {
    const title = document.getElementById('galleryTitle').value.trim();

    if (!title) {
        showNotification('Please enter a title!', 'error');
        return;
    }

    if (galleryImageError) {
        showNotification(galleryImageError, 'error');
        return;
    }

    if (!currentGalleryImage) {
        showNotification('Please select an image first!', 'error');
        return;
    }

    try {
        let gallery = JSON.parse(localStorage.getItem('gallery')) || [];
        gallery.push({ id: Date.now(), title, image: currentGalleryImage });
        localStorage.setItem('gallery', JSON.stringify(gallery));
        closeModal('galleryModal');
        loadGalleryTable();
        loadDashboard();
        currentGalleryImage = null;
        galleryImageError = null;
        showNotification('Gallery item added successfully!', 'success');
    } catch (err) {
        if (err.name === 'QuotaExceededError' || err.code === 22) {
            showNotification('Storage full! Delete some gallery items first.', 'error');
        } else {
            showNotification('Error saving gallery item: ' + err.message, 'error');
        }
    }
}

function deleteGalleryItem(id) {
    if (confirm('Are you sure?')) {
        let gallery = JSON.parse(localStorage.getItem('gallery')) || [];
        gallery = gallery.filter(g => g.id !== id);
        localStorage.setItem('gallery', JSON.stringify(gallery));
        loadGalleryTable();
        loadDashboard();
    }
}

// Settings Form
document.getElementById('settingsForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const settings = {
        name: document.getElementById('settingName').value,
        phone: document.getElementById('settingPhone').value,
        email: document.getElementById('settingEmail').value,
        address: document.getElementById('settingAddress').value
    };
    
    localStorage.setItem('settings', JSON.stringify(settings));
    loadAdminLogo();
    alert('Settings saved successfully!');
});

// Close modal on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

// Toast Notification
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
