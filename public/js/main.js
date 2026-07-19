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
    loadTestimonials();
    loadNotices();
    loadGallery();
    loadBlogs();
    loadSettings();
    loadAbout();
    loadAnnouncementsTicker();
    loadCourses();
    loadTestimonials();
    const contactFormEl = document.getElementById('contactForm');
    if (contactFormEl) contactFormEl.addEventListener('submit', handleContactSubmit);
    
    // Hamburger menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
        
        // Close menu when clicking on a link
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
                navMenu.classList.remove('active');
            }
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
        const logoImg = siteLogo ? `<img src="${siteLogo}" alt="Logo" style="width:14px;height:14px;object-fit:contain;margin-right:4px;border-radius:3px;">` : '<i class="fas fa-graduation-cap"></i>';
        
        container.innerHTML = courses.slice(0, 6).map(course => {
            const emoji = getCourseEmoji(course.name);
            const fee = course.fee || course.price || 0;
            const feeType = course.feeType || 'Per Program';
            const priceFormatted = parseInt(fee).toLocaleString('en-IN');
            const eligibility = course.eligibility || '';
            // Truncate description for preview
            const shortDesc = course.description.substring(0, 100) + (course.description.length > 100 ? '...' : '');
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
                    <p class="course-preview">${shortDesc}</p>
                    <div class="course-card-actions">
                        <button class="btn-view" onclick="openCourseModal(${course.id})"><i class="fas fa-eye"></i> View Details</button>
                        <a href="apply.html?course=${encodeURIComponent(course.name)}" class="btn-enroll"><i class="fas fa-user-graduate"></i> Enroll Now</a>
                    </div>
                </div>
            </div>
            `;
        }).join('');
        window._coursesData = courses;
    } catch (err) {
        console.error('Error loading courses:', err);
        document.getElementById('coursesContainer').innerHTML = '<p style="text-align:center;color:#94a3b8;padding:30px;">Unable to load courses.</p>';
    }
}

async function viewCourseDetail(id) {
    const course = (window._coursesData || []).find(c => c.id === id);
    if (!course) return;
    const emoji = getCourseEmoji(course.name);
    const priceFormatted = parseInt(course.price).toLocaleString('en-IN');
    const eligibility = course.eligibility || '';
    const desc = course.description || 'Description available nahi hai.';
    
    // Open modal instead of navigating
    openCourseModal(id);
}

function openCourseModal(id) {
    const course = (window._coursesData || []).find(c => c.id === id);
    if (!course) return;

    const emoji = getCourseEmoji(course.name);
    const fee = course.fee || course.price || 0;
    const feeType = course.feeType || 'Per Program';
    const priceFormatted = parseInt(fee).toLocaleString('en-IN');
    const eligibility = course.eligibility || 'Any';
    const desc = course.description || 'Description available nahi hai.';
    const duration = course.duration || 'N/A';

    // Split description into bullet points if it contains newlines or •
    const descLines = desc.split(/\n|•/).map(s => s.trim()).filter(s => s.length > 0);
    const hasBullets = descLines.length > 1;

    const modalContent = document.getElementById('courseModalContent');
    modalContent.innerHTML = `
        <div class="course-detail-hero">
            <span class="course-detail-emoji">${emoji}</span>
            <h2 class="course-detail-title">${course.name}</h2>
            <div class="course-detail-badges">
                <span class="detail-badge"><i class="fas fa-clock"></i> ${duration}</span>
                <span class="detail-badge"><i class="fas fa-graduation-cap"></i> ${eligibility}</span>
                <span class="detail-badge"><i class="fas fa-indian-rupee-sign"></i> ₹${priceFormatted} <small>${feeType}</small></span>
            </div>
        </div>
        <div class="course-detail-body">
            <div class="course-detail-section">
                <h3 class="course-detail-heading"><i class="fas fa-book-open"></i> Course Overview</h3>
                <p class="course-detail-desc">${desc}</p>
            </div>
            ${hasBullets ? `
            <div class="course-detail-section">
                <h3 class="course-detail-heading"><i class="fas fa-list-ul"></i> What You'll Learn</h3>
                <ul class="course-detail-list">
                    ${descLines.map(line => `<li><i class="fas fa-check-circle"></i> ${line}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            <div class="course-detail-info-grid">
                <div class="course-detail-info-card">
                    <i class="fas fa-clock"></i>
                    <div>
                        <small>Duration</small>
                        <strong>${duration}</strong>
                    </div>
                </div>
                <div class="course-detail-info-card">
                    <i class="fas fa-graduation-cap"></i>
                    <div>
                        <small>Eligibility</small>
                        <strong>${eligibility}</strong>
                    </div>
                </div>
                <div class="course-detail-info-card">
                    <i class="fas fa-indian-rupee-sign"></i>
                    <div>
                        <small>Fee</small>
                        <strong>₹${priceFormatted}</strong>
                    </div>
                </div>
                <div class="course-detail-info-card">
                    <i class="fas fa-tag"></i>
                    <div>
                        <small>Fee Type</small>
                        <strong>${feeType}</strong>
                    </div>
                </div>
            </div>
            <div class="course-detail-cta">
                <a href="apply.html?course=${encodeURIComponent(course.name)}" class="btn btn-primary course-detail-enroll">
                    <i class="fas fa-user-graduate"></i> Enroll Now
                </a>
                <a href="javascript:void(0)" onclick="closeCourseModal()" class="btn course-detail-close-btn">
                    <i class="fas fa-times"></i> Close
                </a>
            </div>
        </div>
    `;
    
    document.getElementById('courseDetailModal').classList.add('active');
}

function closeCourseModal() {
    document.getElementById('courseDetailModal').classList.remove('active');
}

async function loadGallery() {
    try {
        const res = await fetch('/api/gallery');
        const gallery = await res.json();
        const container = document.getElementById('galleryContainer');
        if (container) {
            // Show random 15 images on homepage; rest are viewable on gallery.html
            const shuffled = [...gallery].sort(() => Math.random() - 0.5);
            window.galleryData = shuffled.slice(0, 15);
            renderGallery('all');
            const viewMoreWrap = document.getElementById('galleryViewMoreWrap');
            if (viewMoreWrap) viewMoreWrap.style.display = gallery.length > 15 ? 'flex' : 'none';
        }
        setupGalleryFilters();
    } catch (err) { console.error('Error loading gallery:', err); }
}

function renderGallery(filter) {
    console.log('renderGallery called with filter:', filter);
    const container = document.getElementById('galleryContainer');
    container.classList.remove('masonry-grid');
    container.classList.remove('gallery-carousel-container');

    // Clear existing interval
    if (galleryCarouselInterval) {
        console.log('Clearing existing interval in renderGallery');
        clearInterval(galleryCarouselInterval);
        galleryCarouselInterval = null;
    }

    // Show carousel for all filters
    let galleryItems;
    if (filter === 'all') {
        galleryItems = window.galleryData;
    } else {
        galleryItems = window.galleryData.filter(item => (item.category || 'all') === filter);
    }

    const carouselItems = galleryItems.map(item => `
        <div class="carousel-item" data-category="${item.category || 'all'}" onclick="openLightbox('${item.image}', '${item.title.replace(/'/g, "\\'")}')">
            <img src="${item.image}" alt="${item.title}">
            <div class="gallery-overlay">
                <p>${item.title}</p>
                <span class="gallery-category-badge">${item.category || 'General'}</span>
            </div>
        </div>
    `).join('');

    console.log('Carousel items generated:', carouselItems.length > 0 ? 'yes' : 'no', 'Length:', carouselItems.length);
    container.innerHTML = `
        <div class="gallery-carousel" id="galleryCarousel">
            <div class="carousel-track" id="galleryCarouselTrack">
                ${carouselItems}
            </div>
            <button class="carousel-btn prev-btn" onclick="slideGallery(-1)"><i class="fas fa-chevron-left"></i></button>
            <button class="carousel-btn next-btn" onclick="slideGallery(1)"><i class="fas fa-chevron-right"></i></button>
            <div class="carousel-dots" id="galleryCarouselDots"></div>
        </div>
    `;
    console.log('Carousel HTML injected');
    // Use setTimeout with longer delay to ensure DOM is fully updated
    setTimeout(() => setupGalleryCarousel(), 200);
}

function setupGalleryFilters() {
    const filterBtns = document.querySelectorAll('.gallery-filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.dataset.filter;
            filterBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'rgba(255,255,255,0.1)';
            });
            this.classList.add('active');
            this.style.background = 'rgba(59,130,246,0.85)';
            renderGallery(filter);
        });
    });
}

let galleryCarouselIndex = 0;
let galleryCarouselInterval;

function setupGalleryCarousel() {
    const track = document.getElementById('galleryCarouselTrack');
    console.log('Looking for galleryCarouselTrack element...');
    if (!track) {
        console.log('Gallery carousel track not found');
        return;
    }
    console.log('Gallery carousel track found');
    console.log('Track innerHTML length:', track.innerHTML.length);
    console.log('Track innerHTML:', track.innerHTML.substring(0, 200));

    const items = track.querySelectorAll('.carousel-item');
    console.log('Found', items.length, 'carousel items');
    if (items.length === 0) {
        console.log('No carousel items found');
        return;
    }

    console.log('Setting up carousel with', items.length, 'items');
    galleryCarouselIndex = 0;

    // Set initial active class
    items.forEach((item, index) => {
        item.classList.remove('active');
        if (index === 0) {
            item.classList.add('active');
        }
    });

    updateCarousel();

    // Create dots
    const dotsContainer = document.getElementById('galleryCarouselDots');
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        items.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = 'carousel-dot' + (index === 0 ? ' active' : '');
            dot.onclick = () => {
                galleryCarouselIndex = index;
                updateCarousel();
                resetAutoSlide();
            };
            dotsContainer.appendChild(dot);
        });
    }

    // Auto-slide every 4 seconds
    resetAutoSlide();
    console.log('Auto-slide interval set');
}

function updateCarousel() {
    const track = document.getElementById('galleryCarouselTrack');
    const items = track.querySelectorAll('.carousel-item');
    const dots = document.querySelectorAll('.carousel-dot');

    if (items.length === 0) return;

    // Update active card
    items.forEach((item, index) => {
        item.classList.remove('active');
        if (index === galleryCarouselIndex) {
            item.classList.add('active');
        }
    });

    // Update dots
    dots.forEach((dot, index) => {
        dot.classList.remove('active');
        if (index === galleryCarouselIndex) {
            dot.classList.add('active');
        }
    });

    // Calculate transform to center the active card (showing 3 cards: 2 side + 1 center)
    const activeCardWidth = 650;
    const inactiveCardWidth = 280;
    const margin = 15;

    let offset = 0;
    for (let i = 0; i < galleryCarouselIndex; i++) {
        offset += inactiveCardWidth + (margin * 2);
    }

    // Center the active card
    const containerWidth = track.parentElement.offsetWidth;
    const centerOffset = (containerWidth - activeCardWidth) / 2;
    offset -= centerOffset;

    track.style.transform = `translateX(${-offset}px)`;
}

function slideGallery(direction) {
    console.log('Sliding gallery:', direction);
    const track = document.getElementById('galleryCarouselTrack');
    if (!track) return;

    const items = track.querySelectorAll('.carousel-item');
    if (items.length === 0) return;

    galleryCarouselIndex += direction;
    if (galleryCarouselIndex < 0) {
        galleryCarouselIndex = items.length - 1;
    } else if (galleryCarouselIndex >= items.length) {
        galleryCarouselIndex = 0;
    }

    console.log('New index:', galleryCarouselIndex);
    updateCarousel();
    resetAutoSlide();
}

function resetAutoSlide() {
    console.log('Resetting auto-slide');
    if (galleryCarouselInterval) {
        console.log('Clearing existing interval');
        clearInterval(galleryCarouselInterval);
    }
    galleryCarouselInterval = setInterval(() => {
        console.log('Auto-slide triggered');
        slideGallery(1);
    }, 4000);
    console.log('New interval set:', galleryCarouselInterval);
}

function openLightbox(imageUrl, title) {
    const lightbox = document.createElement('div');
    lightbox.id = 'galleryLightbox';
    lightbox.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;justify-content:center;align-items:center;z-index:9999;cursor:pointer;';
    lightbox.innerHTML = `
        <div style="position:relative;max-width:90%;max-height:90%;">
            <img src="${imageUrl}" alt="${title}" style="max-width:100%;max-height:90vh;object-fit:contain;border-radius:10px;">
            <button onclick="closeLightbox(event)" style="position:absolute;top:-40px;right:0;background:rgba(255,255,255,0.2);color:#fff;border:none;border-radius:50%;width:40px;height:40px;font-size:24px;cursor:pointer;">×</button>
            <p style="color:#fff;text-align:center;margin-top:10px;font-size:18px;">${title}</p>
        </div>
    `;
    lightbox.onclick = function(e) {
        if (e.target === lightbox) closeLightbox(e);
    };
    document.body.appendChild(lightbox);
}

function closeLightbox(e) {
    if (e) e.stopPropagation();
    const lightbox = document.getElementById('galleryLightbox');
    if (lightbox) lightbox.remove();
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
        if (!container) return;
        
        if (data.success && data.blogs && data.blogs.length > 0) {
            // Cache for clean URL lookup in viewBlogDetail
            window._homeBlogs = data.blogs;
            // Show only pinned + published blogs on home page (max 6)
            let pinned = data.blogs.filter(b => b.published && b.pinned);
            // Fallback: if no pinned blogs, show 3 latest published so the section isn't empty
            if (pinned.length === 0) {
                pinned = data.blogs.filter(b => b.published).slice(0, 3);
            }
            pinned = pinned.slice(0, 6);
            
            if (pinned.length > 0) {
                container.innerHTML = pinned.map(blog => {
                    const excerpt = String(blog.content || '').replace(/<[^>]+>/g, ' ').trim();
                    const shortDesc = excerpt.substring(0, 140) + (excerpt.length > 140 ? '...' : '');
                    const imgHtml = blog.image ? `<div class="blog-card-image" style="background-image:url('${blog.image}');"></div>` : '';
                    const pinBadge = blog.pinned ? `<span class="blog-pinned-badge"><i class="fas fa-thumbtack"></i> Featured</span>` : '';
                    return `
                    <div class="blog-card" onclick="viewBlogDetail(${blog.id})">
                        ${imgHtml}
                        <div class="blog-card-body">
                            <div class="blog-header">
                                <span class="blog-category">${blog.category}</span>
                                ${pinBadge}
                            </div>
                            <h3 class="blog-title">${blog.title}</h3>
                            <div class="blog-content">${shortDesc}</div>
                            <div class="blog-footer">
                                <span class="blog-author"><i class="fas fa-user"></i> ${blog.author}</span>
                                <span class="blog-meta-info"><i class="far fa-clock"></i> ${blog.readingTime || 1} min</span>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');
                empty.style.display = 'none';
                setupBlogCarouselDots(pinned.length);
            } else {
                container.innerHTML = '';
                empty.style.display = 'block';
            }
        } else {
            container.innerHTML = '';
            empty.style.display = 'block';
        }
    } catch (e) {
        console.error('Error loading blogs:', e);
    }
}

function setupBlogCarouselDots(count) {
    const container = document.getElementById('blogContainer');
    const dotsWrap = document.getElementById('blogCarouselDots');
    if (!container || !dotsWrap || count <= 1) {
        if (dotsWrap) dotsWrap.innerHTML = '';
        return;
    }
    // Only meaningful on mobile (CSS hides dots on desktop anyway)
    let dotsHtml = '';
    for (let i = 0; i < count; i++) {
        dotsHtml += '<button class="dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" aria-label="Go to blog ' + (i + 1) + '"></button>';
    }
    dotsWrap.innerHTML = dotsHtml;

    const cards = container.querySelectorAll('.blog-card');
    const dots = dotsWrap.querySelectorAll('.dot');

    // Click dot -> scroll to card
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const idx = parseInt(dot.dataset.idx, 10);
            if (cards[idx]) {
                cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        });
    });

    // Scroll -> update active dot
    let scrollTimeout;
    container.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const containerCenter = container.scrollLeft + container.clientWidth / 2;
            let closestIdx = 0;
            let closestDist = Infinity;
            cards.forEach((card, idx) => {
                const cardCenter = card.offsetLeft + card.offsetWidth / 2;
                const dist = Math.abs(cardCenter - containerCenter);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestIdx = idx;
                }
            });
            dots.forEach((d, i) => d.classList.toggle('active', i === closestIdx));
        }, 80);
    }, { passive: true });
}

function viewBlogDetail(id) {
    // Open the dedicated blog post page (use clean URL if slug available)
    const blog = (window._homeBlogs || []).find(b => b.id == id);
    if (blog && blog.slug) {
        window.location.href = '/blog/' + encodeURIComponent(blog.slug);
    } else {
        window.location.href = 'blog-post.html?id=' + id;
    }
}

function toggleReadMore(id) {
    // Show testimonial in modal
    const cards = document.querySelectorAll(`.testimonial-card[data-id="${id}"]`);
    if (cards.length === 0) return;
    
    const card = cards[0];
    const name = card.querySelector('.testimonial-name').textContent;
    const position = card.querySelector('.testimonial-position')?.textContent || '';
    const comment = card.querySelector('.testimonial-comment').getAttribute('data-full');
    const imageSrc = card.querySelector('.testimonial-avatar').src;
    const rating = card.querySelector('.testimonial-rating').innerHTML;
    const date = card.querySelector('.testimonial-date').textContent;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'testimonial-modal';
    modal.innerHTML = `
        <div class="testimonial-modal-content">
            <button class="testimonial-modal-close" onclick="this.closest('.testimonial-modal').remove()">&times;</button>
            <div class="testimonial-modal-header">
                <img src="${imageSrc}" alt="${name}" class="testimonial-modal-avatar">
                <div>
                    <h4 class="testimonial-modal-name">${name}</h4>
                    ${position ? `<p class="testimonial-modal-position">${position}</p>` : ''}
                    <div class="testimonial-modal-rating">${rating}</div>
                </div>
            </div>
            <p class="testimonial-modal-comment">${comment}</p>
            <p class="testimonial-modal-date">${date}</p>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', function closeOnEscape(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    });
}

let currentTestimonialSlide = 0;
let testimonialSlideInterval;
let testimonialsData = [];

async function loadTestimonials() {
    try {
        const res = await fetch('/api/testimonials');
        const data = await res.json();
        const container = document.getElementById('testimonialsContainer');
        const dotsContainer = document.getElementById('carouselDots');
        
        if (data.success && data.testimonials && data.testimonials.length > 0) {
            testimonialsData = data.testimonials;
            
            // Create testimonials HTML
            const testimonialsHTML = testimonialsData.map(testimonial => {
                const stars = Array(5).fill(0).map((_, i) => 
                    `<span class="star ${i < testimonial.rating ? '' : 'empty'}">★</span>`
                ).join('');
                
                const formattedDate = testimonial.date ? new Date(testimonial.date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                }) : '';
                
                const imageSrc = testimonial.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.name)}&background=667eea&color=fff&size=100`;
                
                // Truncate long comments
                const maxChars = 150;
                const isLongComment = testimonial.comment.length > maxChars;
                const words = testimonial.comment.split(' ');
                const shortComment = isLongComment ? words.slice(0, 15).join(' ') + '...' : testimonial.comment;
                
                return `
                    <div class="testimonial-card" data-id="${testimonial.id}">
                        <div class="testimonial-header">
                            <img src="${imageSrc}" alt="${testimonial.name}" class="testimonial-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.name)}&background=667eea&color=fff&size=100'">
                            <div>
                                <h4 class="testimonial-name">${testimonial.name}</h4>
                                ${testimonial.position ? `<p class="testimonial-position">${testimonial.position}</p>` : ''}
                                <div class="testimonial-rating">${stars}</div>
                            </div>
                        </div>
                        <p class="testimonial-comment" data-full="${testimonial.comment}" data-short="${shortComment}">${shortComment}</p>
                        ${isLongComment ? `<button class="read-more-btn" onclick="toggleReadMore(${testimonial.id})">Read More</button>` : ''}
                        <p class="testimonial-date">${formattedDate}</p>
                    </div>
                `;
            }).join('');
            
            // Check if mobile view for card stack
            const isMobile = window.innerWidth <= 769;
            
            if (isMobile) {
                // Student names horizontal scroll for mobile with photos and ratings
                const studentNamesHTML = testimonialsData.map(testimonial => {
                    const stars = Array(5).fill(0).map((_, i) => 
                        `<span class="star ${i < testimonial.rating ? '' : 'empty'}">★</span>`
                    ).join('');
                    
                    const imageSrc = testimonial.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.name)}&background=667eea&color=fff&size=50`;
                    
                    return `<div class="student-name-item" data-id="${testimonial.id}">
                        <img src="${imageSrc}" alt="${testimonial.name}" class="student-avatar">
                        <div class="student-info">
                            <span class="student-name">${testimonial.name}</span>
                            <span class="student-rating">${stars}</span>
                        </div>
                    </div>`;
                }).join('');
                
                container.innerHTML = studentNamesHTML;
                initMobileStudentNames(container, testimonialsData);
            } else {
                // Carousel for desktop
                container.innerHTML = testimonialsHTML + testimonialsHTML + testimonialsHTML;
                currentTestimonialSlide = testimonialsData.length;
                initTestimonialCarousel();
            }
        } else {
            container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:30px;">No testimonials available.</p>';
        }
    } catch (err) {
        console.error('Error loading testimonials:', err);
        document.getElementById('testimonialsContainer').innerHTML = '<p style="text-align:center;color:#94a3b8;padding:30px;">Unable to load testimonials.</p>';
    }
}

function initCardStack(container) {
    // Swipe animation for mobile with dots
    const cards = Array.from(container.children);
    let currentIndex = 0;
    let autoSlideInterval;
    
    // Create dots container
    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'carousel-dots';
    container.parentElement.appendChild(dotsContainer);
    
    // Create dots
    cards.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = 'carousel-dot' + (index === 0 ? ' active' : '');
        dot.addEventListener('click', () => {
            goToSlide(index);
            resetAutoSlide();
        });
        dotsContainer.appendChild(dot);
    });
    
    const dots = Array.from(dotsContainer.children);
    
    function updateDots() {
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    }
    
    function goToSlide(index) {
        currentIndex = index;
        updateCards();
        updateDots();
    }
    
    function updateCards(direction = null) {
        cards.forEach((card, index) => {
            card.classList.remove('active', 'swipe-left', 'swipe-right');
            
            if (index === currentIndex) {
                card.classList.add('active');
            }
        });
    }
    
    function nextSlide() {
        currentIndex++;
        if (currentIndex >= cards.length) {
            currentIndex = 0;
        }
        updateCards();
        updateDots();
    }
    
    function prevSlide() {
        currentIndex--;
        if (currentIndex < 0) {
            currentIndex = cards.length - 1;
        }
        updateCards();
        updateDots();
    }
    
    function startAutoSlide() {
        if (autoSlideInterval) clearInterval(autoSlideInterval);
        autoSlideInterval = setInterval(nextSlide, 5000);
    }
    
    function resetAutoSlide() {
        if (autoSlideInterval) clearInterval(autoSlideInterval);
        startAutoSlide();
    }
    
    // Touch swipe handling
    let touchStartX = 0;
    let touchEndX = 0;
    
    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    container.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
            resetAutoSlide();
        }
    }
    
    // Initialize
    updateCards();
    updateDots();
    startAutoSlide();
}

function initMobileStudentNames(container, testimonialsData) {
    const nameItems = Array.from(container.children);
    let autoScrollInterval;
    
    // Click handler for student names
    nameItems.forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.getAttribute('data-id'));
            const testimonial = testimonialsData.find(t => t.id === id);
            if (testimonial) {
                showTestimonialModal(testimonial);
            }
        });
    });
    
    // Auto-scroll functionality
    function autoScroll() {
        const scrollAmount = 200;
        const maxScroll = container.scrollWidth - container.clientWidth;
        
        if (container.scrollLeft >= maxScroll) {
            container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }
    
    function startAutoScroll() {
        if (autoScrollInterval) clearInterval(autoScrollInterval);
        autoScrollInterval = setInterval(autoScroll, 3000);
    }
    
    function resetAutoScroll() {
        if (autoScrollInterval) clearInterval(autoScrollInterval);
        startAutoScroll();
    }
    
    // Pause auto-scroll on user interaction
    container.addEventListener('touchstart', () => {
        if (autoScrollInterval) clearInterval(autoScrollInterval);
    }, { passive: true });
    
    container.addEventListener('touchend', () => {
        startAutoScroll();
    }, { passive: true });
    
    // Start auto-scroll
    startAutoScroll();
}

function showTestimonialModal(testimonial) {
    const stars = Array(5).fill(0).map((_, i) => 
        `<span class="star ${i < testimonial.rating ? '' : 'empty'}">★</span>`
    ).join('');
    
    const formattedDate = testimonial.date ? new Date(testimonial.date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    }) : '';
    
    const imageSrc = testimonial.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.name)}&background=667eea&color=fff&size=100`;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'testimonial-modal';
    modal.innerHTML = `
        <div class="testimonial-modal-content">
            <button class="testimonial-modal-close" onclick="this.closest('.testimonial-modal').remove()">&times;</button>
            <div class="testimonial-modal-header">
                <img src="${imageSrc}" alt="${testimonial.name}" class="testimonial-modal-avatar">
                <div>
                    <h4 class="testimonial-modal-name">${testimonial.name}</h4>
                    ${testimonial.position ? `<p class="testimonial-modal-position">${testimonial.position}</p>` : ''}
                    <div class="testimonial-modal-rating">${stars}</div>
                </div>
            </div>
            <p class="testimonial-modal-comment">${testimonial.comment}</p>
            <p class="testimonial-modal-date">${formattedDate}</p>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', function closeOnEscape(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    });
}

function initTestimonialCarousel() {
    // Existing carousel logic for desktop
    if (testimonialSlideInterval) clearInterval(testimonialSlideInterval);
    
    const container = document.getElementById('testimonialsContainer');
    const sideCardWidth = 280;
    const activeCardWidth = 650;
    const gap = 30;
    
    function updateCarousel() {
        const cards = container.querySelectorAll('.testimonial-card');
        const totalCards = cards.length;
        
        // Calculate the offset to center the active card
        let offset = 0;
        cards.forEach((card, index) => {
            const isActive = (index % testimonialsData.length) === (currentTestimonialSlide % testimonialsData.length);
            const cardWidth = isActive ? activeCardWidth : sideCardWidth;
            if (index < currentTestimonialSlide) {
                offset -= cardWidth + gap;
            }
        });
        
        const carouselWidth = container.parentElement.offsetWidth;
        const centerOffset = (carouselWidth / 2) - (activeCardWidth / 2);
        offset += centerOffset;
        
        container.style.transform = `translateX(${offset}px)`;
        updateCardStyles();
    }
    
    function updateCardStyles() {
        const cards = container.querySelectorAll('.testimonial-card');
        cards.forEach((card, index) => {
            card.classList.remove('active', 'prev', 'next');
            
            const realIndex = index % testimonialsData.length;
            const activeIndex = currentTestimonialSlide % testimonialsData.length;
            
            if (realIndex === activeIndex) {
                card.classList.add('active');
            } else if (realIndex === (activeIndex - 1 + testimonialsData.length) % testimonialsData.length) {
                card.classList.add('prev');
            } else if (realIndex === (activeIndex + 1) % testimonialsData.length) {
                card.classList.add('next');
            }
        });
    }
    
    function nextSlide() {
        currentTestimonialSlide++;
        if (currentTestimonialSlide >= testimonialsData.length * 2) {
            currentTestimonialSlide = testimonialsData.length;
        }
        updateCarousel();
    }
    
    function prevSlide() {
        currentTestimonialSlide--;
        if (currentTestimonialSlide < testimonialsData.length) {
            currentTestimonialSlide = testimonialsData.length * 2 - 1;
        }
        updateCarousel();
    }
    
    // Auto-slide
    testimonialSlideInterval = setInterval(nextSlide, 5000);
    
    // Button handlers
    const prevBtn = document.getElementById('prevTestimonial');
    const nextBtn = document.getElementById('nextTestimonial');
    
    if (prevBtn) prevBtn.onclick = prevSlide;
    if (nextBtn) nextBtn.onclick = nextSlide;
    
    updateCarousel();
}

function toggleReadMore(id) {
    // Show testimonial in modal
    const cards = document.querySelectorAll(`.testimonial-card[data-id="${id}"]`);
    if (cards.length === 0) return;
    
    const card = cards[0];
    const name = card.querySelector('.testimonial-name').textContent;
    const position = card.querySelector('.testimonial-position')?.textContent || '';
    const comment = card.querySelector('.testimonial-comment').getAttribute('data-full');
    const imageSrc = card.querySelector('.testimonial-avatar').src;
    const rating = card.querySelector('.testimonial-rating').innerHTML;
    const date = card.querySelector('.testimonial-date').textContent;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'testimonial-modal';
    modal.innerHTML = `
        <div class="testimonial-modal-content">
            <button class="testimonial-modal-close" onclick="this.closest('.testimonial-modal').remove()">&times;</button>
            <div class="testimonial-modal-header">
                <img src="${imageSrc}" alt="${name}" class="testimonial-modal-avatar">
                <div>
                    <h4 class="testimonial-modal-name">${name}</h4>
                    ${position ? `<p class="testimonial-modal-position">${position}</p>` : ''}
                    <div class="testimonial-modal-rating">${rating}</div>
                </div>
            </div>
            <p class="testimonial-modal-comment">${comment}</p>
            <p class="testimonial-modal-date">${date}</p>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', function closeOnEscape(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    });
}

