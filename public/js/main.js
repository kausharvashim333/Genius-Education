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

document.addEventListener('DOMContentLoaded', () => {
    triggerHeroAnimation();
    loadCarousel();
    loadCourses();
    loadNotices();
    loadGallery();
    loadBlogs();
    loadSettings();
    loadAbout();
    loadAnnouncementsTicker();
    document.getElementById('contactForm').addEventListener('submit', handleContactSubmit);
    
    // Hamburger menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
});

let carouselIndex = 0;
let carouselItems = [];
let carouselTimer = null;

async function loadCarousel() {
    try {
        const res = await fetch('/api/carousel');
        carouselItems = await res.json();
        if (carouselItems.length === 0) return;

        const track = document.getElementById('carouselTrack');
        const dots = document.getElementById('carouselDots');
        const wrapper = document.getElementById('carouselWrapper');

        track.innerHTML = carouselItems.map((item, i) => `
            <div class="carousel-slide">
                <img src="${item.image}" alt="${item.caption || 'Slide ' + (i+1)}">
                ${item.caption ? '<div class="carousel-caption">' + item.caption + '</div>' : ''}
            </div>
        `).join('');

        dots.innerHTML = carouselItems.map((_, i) =>
            `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></span>`
        ).join('');

        startCarouselTimer();
        triggerHeroAnimation();
    } catch (err) { console.error('Carousel load error:', err); }
}

function carouselMove(dir) {
    goToSlide(carouselIndex + dir);
}

function goToSlide(index) {
    carouselIndex = (index + carouselItems.length) % carouselItems.length;
    const track = document.getElementById('carouselTrack');
    track.style.transform = 'translateX(-' + (carouselIndex * 100) + '%)';
    document.querySelectorAll('.carousel-dot').forEach((d, i) =>
        d.classList.toggle('active', i === carouselIndex)
    );
    triggerHeroAnimation();
    resetCarouselTimer();
}

const HERO_TEXT = 'Welcome to Genius Computer Education';
let typewriterTimer = null;

function triggerHeroAnimation() {
    const h1 = document.querySelector('.hero-overlay h1');
    const overlay = document.querySelector('.hero-overlay');
    if (!h1) return;

    // Reset p and btn animation
    if (overlay) {
        overlay.classList.remove('animate');
        void overlay.offsetWidth;
        overlay.classList.add('animate');
    }

    // Reset h1
    h1.textContent = '';
    h1.style.width = '0';
    h1.style.animation = 'none';

    clearTimeout(typewriterTimer);
    let i = 0;
    const text = HERO_TEXT;
    const speed = 55;

    function type() {
        if (i <= text.length) {
            h1.textContent = text.slice(0, i);
            h1.style.width = 'auto';
            i++;
            if (i <= text.length) {
                typewriterTimer = setTimeout(type, speed);
            } else {
                // Blinking cursor after typing done
                h1.style.animation = 'cursorBlink 0.8s infinite';
            }
        }
    }
    type();
}

function startCarouselTimer() {
    carouselTimer = setInterval(() => carouselMove(1), 4000);
}

function resetCarouselTimer() {
    clearInterval(carouselTimer);
    startCarouselTimer();
}

const COURSE_EMOJIS = {
    'basic computer': '🖥️', 'computer': '🖥️', 'tally': '📊', 'accounting': '📊',
    'web': '🌐', 'website': '🌐', 'python': '🐍', 'graphic': '🎨', 'design': '🎨',
    'digital marketing': '📱', 'marketing': '📱', 'dca': '💻', 'pgdca': '🎓',
    'bca': '🎓', 'mca': '🎓', 'ms office': '📄', 'office': '📄', 'excel': '📈',
    'advance excel': '📈', 'autocad': '📐', 'cad': '📐', 'hardware': '🔧',
    'networking': '🔧', 'data entry': '⌨️', 'typing': '⌨️', 'programming': '👨‍💻',
    'coding': '👨‍💻', 'java': '☕', 'android': '📲', 'mobile': '📲',
    'cyber': '🔐', 'security': '🔐', 'ai': '🤖', 'machine learning': '🤖',
    'cloud': '☁️', 'devops': '⚙️', 'react': '⚛️', 'node': '🟢',
    'photoshop': '🖼️', 'video': '🎬', 'editing': '🎬', 'animation': '🎞️',
    'english': '🗣️', 'spoken': '🗣️', 'default': '📚'
};

function getCourseEmoji(name) {
    const lower = name.toLowerCase();
    for (const [key, emoji] of Object.entries(COURSE_EMOJIS)) {
        if (key !== 'default' && lower.includes(key)) return emoji;
    }
    return COURSE_EMOJIS['default'];
}

async function loadCourses() {
    try {
        const res = await fetch('/api/courses');
        const courses = await res.json();
        const container = document.getElementById('coursesContainer');
        
        // Get site logo from settings
        const settingsRes = await fetch('/api/settings').then(r => r.json()).catch(() => ({}));
        const siteLogo = settingsRes.logo || '';
        const logoImg = siteLogo ? `<img src="${siteLogo}" alt="Logo" style="width:14px;height:14px;object-fit:contain;margin-right:4px;">` : '<i class="fas fa-graduation-cap"></i>';
        
        container.innerHTML = courses.map(course => {
            const emoji = getCourseEmoji(course.name);
            const priceFormatted = parseInt(course.price).toLocaleString('en-IN');
            const eligibility = course.eligibility || '';
            return `
            <div class="course-card">
                <div class="course-card-header">
                    <span class="course-emoji">${emoji}</span>
                    <h3>${course.name}</h3>
                </div>
                <div class="course-card-body">
                    <div class="course-meta">
                        <span class="meta-tag"><i class="fas fa-clock"></i> ${course.duration}</span>
                        ${eligibility ? `<span class="meta-tag">${logoImg} ${eligibility}</span>` : ''}
                    </div>
                    <div class="price">₹${priceFormatted}</div>
                    <div class="course-card-actions">
                        <button class="btn-view" onclick="viewCourseDetail(${course.id})"><i class="fas fa-eye"></i> View Details</button>
                        <a href="apply.html?course=${encodeURIComponent(course.name)}" class="btn-enroll"><i class="fas fa-user-graduate"></i> Enroll Now</a>
                    </div>
                </div>
            </div>`;
        }).join('');
        window._coursesData = courses;
    } catch (err) { console.error('Error loading courses:', err); }
}

async function viewCourseDetail(id) {
    const course = (window._coursesData || []).find(c => c.id === id);
    if (!course) return;
    const emoji = getCourseEmoji(course.name);
    const priceFormatted = parseInt(course.price).toLocaleString('en-IN');
    const eligibility = course.eligibility || '';
    const desc = course.description || 'Description available nahi hai.';
    
    // Get site logo from settings
    const settingsRes = await fetch('/api/settings').then(r => r.json()).catch(() => ({}));
    const siteLogo = settingsRes.logo || '';
    const logoImg = siteLogo ? `<img src="${siteLogo}" alt="Logo" style="width:16px;height:16px;object-fit:contain;margin-right:4px;">` : '<i class="fas fa-graduation-cap"></i>';
    
    const overlay = document.createElement('div');
    overlay.className = 'course-detail-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="course-detail-box">
            <div class="course-detail-header">
                <span class="course-emoji">${emoji}</span>
                <h2>${course.name}</h2>
            </div>
            <div class="course-detail-body">
                <div class="detail-meta">
                    <span><i class="fas fa-clock"></i> ${course.duration}</span>
                    <span><i class="fas fa-rupee-sign"></i> ₹${priceFormatted}</span>
                    ${eligibility ? `<span>${logoImg} ${eligibility}</span>` : ''}
                </div>
                <div class="detail-desc">${desc}</div>
                <div class="detail-actions">
                    <a href="apply.html?course=${encodeURIComponent(course.name)}" class="btn-enroll"><i class="fas fa-user-graduate"></i> Enroll Now</a>
                    <button class="btn-close-detail" onclick="this.closest('.course-detail-overlay').remove()">Close</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

async function loadGallery() {
    try {
        const res = await fetch('/api/gallery');
        const gallery = await res.json();
        const container = document.getElementById('galleryContainer');
        if (container) {
            container.innerHTML = gallery.map(item => `
                <div class="gallery-item">
                    <img src="${item.image}" alt="${item.title}">
                    <p>${item.title}</p>
                </div>
            `).join('');
        }
    } catch (err) { console.error('Error loading gallery:', err); }
}

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();

        const addressEl = document.getElementById('instituteAddress');
        const phoneEl = document.getElementById('institutePhone');
        const emailEl = document.getElementById('instituteEmail');
        const siteNameEl = document.getElementById('siteName');
        const siteLogo = document.getElementById('siteLogo');
        const defaultIcon = document.getElementById('defaultLogoIcon');
        const navLogo = document.querySelector('.nav-logo');
        const navBrandLink = document.querySelector('.nav-brand a');

        if (addressEl && settings.address) addressEl.textContent = settings.address;
        if (phoneEl && settings.phone) phoneEl.textContent = settings.phone;
        if (emailEl && settings.email) emailEl.textContent = settings.email;
        if (siteNameEl && settings.name) {
            siteNameEl.textContent = settings.name;
            document.title = settings.name;
        }
        
        // Update navbar brand name
        if (navBrandLink && settings.name) {
            navBrandLink.textContent = settings.name;
        }
        
        // Update navbar logo
        if (settings.logo && navLogo) {
            navLogo.src = settings.logo;
            navLogo.style.display = 'block';
        }
        
        if (settings.logo && siteLogo && defaultIcon) {
            siteLogo.src = settings.logo;
            siteLogo.style.display = 'block';
            defaultIcon.style.display = 'none';
        }

        // Load contact map
        const contactMapContainer = document.getElementById('contactMap');
        const contactMapIframe = document.getElementById('contactMapIframe');
        if (settings.mapUrl && contactMapContainer && contactMapIframe) {
            contactMapIframe.src = settings.mapUrl;
            contactMapContainer.style.display = 'block';
        }

        // Load footer contact info
        const footerAddress = document.getElementById('footerAddress');
        const footerPhone = document.getElementById('footerPhone');
        const footerEmail = document.getElementById('footerEmail');
        if (footerAddress && settings.address) footerAddress.textContent = settings.address;
        if (footerPhone && settings.phone) footerPhone.textContent = settings.phone;
        if (footerEmail && settings.email) footerEmail.textContent = settings.email;
    } catch (err) { console.error('Error loading settings:', err); }
}

async function loadAbout() {
    try {
        const res = await fetch('/api/about');
        const about = await res.json();
        const descEl = document.getElementById('aboutDescription');
        const mapContainer = document.getElementById('aboutMapContainer');
        const mapIframe = document.getElementById('aboutMapIframe');
        if (descEl && about.description) descEl.textContent = about.description;
        if (about.mapUrl && mapContainer && mapIframe) {
            mapIframe.src = about.mapUrl;
            mapContainer.style.display = 'block';
        }
    } catch (err) { console.error('Error loading about:', err); }
}

async function loadAnnouncementsTicker() {
    try {
        const res = await fetch('/api/announcements');
        const data = await res.json();
        const tickerContent = document.getElementById('tickerContent');
        
        if (data.success && data.announcements && data.announcements.length > 0) {
            tickerContent.innerHTML = data.announcements.map(a => `
                <span class="ticker-item priority-${a.priority}">
                    <i class="fas fa-bullhorn" style="margin-right:8px;"></i>
                    ${a.title}
                </span>
            `).join('');
        } else {
            tickerContent.innerHTML = '<span>No active announcements</span>';
        }
    } catch (e) {
        document.getElementById('tickerContent').innerHTML = '<span>Unable to load announcements</span>';
    }
}

async function handleContactSubmit(e) {
    e.preventDefault();
    try {
        const data = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            message: document.getElementById('message').value
        };
        const res = await fetch('/api/enquiries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            alert('Thank you for your enquiry! We will contact you soon.');
            e.target.reset();
        }
    } catch (err) { alert('Error submitting enquiry. Please try again.'); }
}

let allNotices = [];
let activeNoticeCat = 'All';

const NOTICE_CAT_COLORS = { General:'#64748b', Exam:'#7c3aed', Fee:'#dc2626', Holiday:'#16a34a', Event:'#0284c7', Result:'#d97706' };

async function loadNotices() {
    try {
        const raw = await fetch('/api/notices').then(r => r.json());
        if (!raw || raw.length === 0) return;

        const today = new Date().toISOString().split('T')[0];

        // Filter expired for public view; sort pinned first then by insertion order
        allNotices = raw
            .filter(n => !n.expiry || n.expiry >= today)
            .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

        if (allNotices.length === 0) return;

        // --- Ticker: show important + pinned first in ticker ---
        const tickerBar = document.getElementById('noticeTickerBar');
        const tickerTrack = document.getElementById('noticeTickerTrack');
        tickerBar.style.display = 'flex';

        const items = allNotices.map(n => {
            const icon = n.isImportant ? 'fa-exclamation-circle' : (n.isPinned ? 'fa-thumbtack' : 'fa-circle-dot');
            const color = n.isImportant ? '#fca5a5' : (n.isPinned ? '#fde68a' : '#fff');
            const inner = `<i class="fas ${icon}" style="color:${color};margin-right:5px;"></i>${n.title} <span class="ticker-date">(${n.date})</span>`;
            return n.file
                ? `<a href="${n.file}" target="_blank" class="ticker-item">${inner}</a>`
                : `<span class="ticker-item">${inner}</span>`;
        }).join('<span class="ticker-sep">&#9679;</span>');
        tickerTrack.innerHTML = items + '<span class="ticker-sep">&#9679;</span>' + items;

        // --- Notice board section ---
        document.getElementById('notices').style.display = 'block';
        renderNoticeCards(allNotices);
    } catch (err) { console.error('Notice load error', err); }
}

function renderNoticeCards(notices) {
    const list = document.getElementById('noticeList');
    const empty = document.getElementById('noticeEmpty');
    if (notices.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    list.innerHTML = notices.map((n, i) => {
        const cat = n.category || 'General';
        const catColor = NOTICE_CAT_COLORS[cat] || '#64748b';
        const isNew = isWithin7Days(n.date);
        return `
        <div class="notice-card ${n.isPinned ? 'notice-pinned' : ''} ${n.isImportant ? 'notice-important' : ''}">
            <div class="notice-num">${String(i + 1).padStart(2, '0')}</div>
            <div class="notice-body">
                <div class="notice-title-row">
                    ${n.isPinned ? '<i class="fas fa-thumbtack notice-pin-icon" title="Pinned"></i>' : ''}
                    <span class="notice-title">${n.title}</span>
                    ${n.isImportant ? '<span class="notice-imp-badge">IMPORTANT</span>' : ''}
                    ${isNew ? '<span class="notice-new-badge">NEW</span>' : ''}
                </div>
                <div class="notice-meta-row">
                    <span class="notice-cat-pill" style="background:${catColor}">${cat}</span>
                    <span class="notice-date"><i class="fas fa-calendar-alt"></i> ${n.date}</span>
                </div>
            </div>
            ${n.file ? `<a href="${n.file}" target="_blank" class="notice-download"><i class="fas fa-download"></i> Download</a>` : ''}
        </div>`;
    }).join('');
}

function isWithin7Days(dateStr) {
    try {
        const parts = dateStr.split('/');
        if (parts.length !== 3) return false;
        const d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
        return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
    } catch { return false; }
}

function setNoticeFilter(btn) {
    document.querySelectorAll('.notice-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeNoticeCat = btn.dataset.cat;
    filterNotices();
}

function filterNotices() {
    const q = (document.getElementById('noticeSearch')?.value || '').toLowerCase();
    const filtered = allNotices.filter(n => {
        const matchCat = activeNoticeCat === 'All' || n.category === activeNoticeCat;
        const matchQ = !q || n.title.toLowerCase().includes(q) || (n.category && n.category.toLowerCase().includes(q));
        return matchCat && matchQ;
    });
    renderNoticeCards(filtered);
}

async function loadBlogs() {
    try {
        const res = await fetch('/api/blogs');
        const data = await res.json();
        const container = document.getElementById('blogContainer');
        const empty = document.getElementById('blogEmpty');
        
        if (data.success && data.blogs && data.blogs.length > 0) {
            const publishedBlogs = data.blogs.filter(b => b.published);
            if (publishedBlogs.length > 0) {
                container.innerHTML = publishedBlogs.map(blog => `
                    <div class="blog-card">
                        <div class="blog-header">
                            <span class="blog-category">${blog.category}</span>
                            <span class="blog-date">${formatDate(blog.createdAt)}</span>
                        </div>
                        <h3 class="blog-title">${blog.title}</h3>
                        <div class="blog-content">${blog.content.substring(0, 150)}${blog.content.length > 150 ? '...' : ''}</div>
                        <div class="blog-footer">
                            <span class="blog-author"><i class="fas fa-user"></i> ${blog.author}</span>
                        </div>
                    </div>
                `).join('');
                empty.style.display = 'none';
            } else {
                container.innerHTML = '';
                empty.style.display = 'block';
            }
        } else {
            container.innerHTML = '';
            empty.style.display = 'block';
        }
    } catch (err) {
        console.error('Error loading blogs:', err);
    }
}
