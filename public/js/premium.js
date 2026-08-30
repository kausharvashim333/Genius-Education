/* Premium Mobile Experience JS — Optimized */

// === 1. Scroll Reveal (IntersectionObserver) ===
function initScrollReveal() {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

    document.querySelectorAll('section .container, .section-title, .courses-grid, .blog-grid, .gallery-grid, .testimonials-wrapper, .about-content, .contact-content, .notice-list').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
    document.querySelectorAll('.courses-grid, .blog-grid, .gallery-grid, .about-stats, .notice-list').forEach(el => {
        el.classList.add('reveal-stagger');
    });
}

// === 2. Number Counter Animation ===
function animateCounter(el) {
    const text = el.textContent.trim();
    const match = text.match(/(\d+)(.*)/);
    if (!match) return;
    const target = parseInt(match[1]);
    const suffix = match[2] || '';
    let current = 0;
    const duration = 1200;
    const steps = 40;
    const increment = target / steps;
    const stepTime = duration / steps;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = Math.floor(current) + suffix;
    }, stepTime);
}

function initCounters() {
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { animateCounter(e.target); obs.unobserve(e.target); } });
    }, { threshold: 0.5 });
    document.querySelectorAll('.stat strong, .stat-number').forEach(el => obs.observe(el));
}

// === 3. 3D Tilt cards (lightweight, trust badges only) ===
function initTiltCards() {
    if (window.innerWidth > 769) return;
    document.querySelectorAll('.trust-badge').forEach(card => {
        card.classList.add('tilt-card');
        const shine = document.createElement('div');
        shine.className = 'tilt-shine';
        card.appendChild(shine);
        card.addEventListener('touchmove', (e) => {
            const r = card.getBoundingClientRect();
            const t = e.touches[0];
            const rx = ((t.clientY - r.top - r.height/2) / (r.height/2)) * -5;
            const ry = ((t.clientX - r.left - r.width/2) / (r.width/2)) * 5;
            card.style.transform = 'perspective(600px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
            card.classList.add('tilt-active');
            card.style.setProperty('--shine-x', ((t.clientX - r.left) / r.width * 100) + '%');
            card.style.setProperty('--shine-y', ((t.clientY - r.top) / r.height * 100) + '%');
        }, { passive: true });
        card.addEventListener('touchend', () => { card.style.transform = ''; card.classList.remove('tilt-active'); });
    });
}

// === 5. Floating Action Menu — Direct Enquiry Modal ===
function initFabMenu() {
    const fabBtn = document.querySelector('.enquiry-fab-btn');
    const fabWrapper = document.getElementById('enquiryFab');
    if (!fabBtn || !fabWrapper) return;

    fabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (typeof openEnquiryModal === 'function') openEnquiryModal();
    });
}

// === 6. Glass Bottom Sheet ===
function showBottomSheet(title, bodyHTML) {
    let overlay = document.getElementById('bottomSheetOverlay');
    let sheet = document.getElementById('bottomSheet');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'bottom-sheet-overlay';
        overlay.id = 'bottomSheetOverlay';
        overlay.innerHTML = `<div class="bottom-sheet" id="bottomSheet">
            <div class="bottom-sheet-handle"></div>
            <button class="bottom-sheet-close" onclick="closeBottomSheet()"><i class="fas fa-times"></i></button>
            <div class="bottom-sheet-content">
                <div class="bottom-sheet-title" id="bottomSheetTitle"></div>
                <div class="bottom-sheet-body" id="bottomSheetBody"></div>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeBottomSheet(); });
    }
    document.getElementById('bottomSheetTitle').innerHTML = title;
    document.getElementById('bottomSheetBody').innerHTML = bodyHTML;
    overlay.classList.add('active');
    document.getElementById('bottomSheet').classList.add('active');
}
function closeBottomSheet() {
    const overlay = document.getElementById('bottomSheetOverlay');
    const sheet = document.getElementById('bottomSheet');
    if (overlay) overlay.classList.remove('active');
    if (sheet) sheet.classList.remove('active');
}

// === 6. Mesh Background (lightweight — 2 blobs only) ===
function initMeshBg() {
    const mesh = document.createElement('div');
    mesh.className = 'mesh-bg';
    mesh.innerHTML = '<div class="mesh-blob b1"></div><div class="mesh-blob b2"></div>';
    document.body.insertBefore(mesh, document.body.firstChild);
}

// === 7. Liquid Ripple ===
function initRipple() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn, .enquiry-submit-btn, .segmented-btn, .notice-filter-btn, .gallery-filter-btn, .trust-badge');
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple-circle';
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }, { passive: true });
}

// === 9. Typewriter Effect ===
function initTypewriter() {
    const el = document.getElementById('heroSubheading');
    if (!el) return;
    const text = el.textContent;
    el.textContent = '';
    el.innerHTML = '<span id="twText"></span><span class="typewriter-cursor"></span>';
    const twEl = document.getElementById('twText');
    let i = 0;
    function type() {
        if (i < text.length) {
            twEl.textContent += text[i];
            i++;
            setTimeout(type, 40);
        }
    }
    setTimeout(type, 800);
}

// === 10. Trust Badges ===
function initTrustBadges() {
    const about = document.querySelector('#about .container');
    if (!about) return;
    const strip = document.createElement('div');
    strip.className = 'trust-strip reveal';
    strip.innerHTML = `
        <div class="trust-badge"><i class="fas fa-award"></i><span>Govt Approved</span></div>
        <div class="trust-badge"><i class="fas fa-certificate"></i><span>ISO Certified</span></div>
        <div class="trust-badge"><i class="fas fa-laptop-code"></i><span>Practical Training</span></div>
        <div class="trust-badge"><i class="fas fa-user-graduate"></i><span>5000+ Students</span></div>
        <div class="trust-badge"><i class="fas fa-briefcase"></i><span>Job Placement</span></div>
        <div class="trust-badge"><i class="fas fa-chalkboard-teacher"></i><span>Expert Faculty</span></div>
    `;
    about.insertBefore(strip, about.firstChild);
}

// === 10. Toast Notifications ===
function showToast(message, type) {
    type = type || 'info';
    let container = document.querySelector('.toast-container');
    if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i> ' + message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// === 11. Segmented Control (Notices/Blog) — mobile only ===
function initSegmentedControl() {
    if (window.innerWidth > 769) return;
    const blogSection = document.querySelector('#blog .container');
    if (!blogSection) return;
    if (document.querySelector('.segmented-control')) return;
    const title = blogSection.querySelector('.section-title');
    const control = document.createElement('div');
    control.className = 'segmented-control';
    control.innerHTML = '<button class="segmented-btn active" data-tab="blog">Blog Posts</button><button class="segmented-btn" data-tab="notices">Notices</button>';
    title.insertAdjacentElement('afterend', control);

    const blogGrid = document.getElementById('blogContainer');
    const blogDots = document.getElementById('blogCarouselDots');
    const blogEmpty = document.getElementById('blogEmpty');
    const blogLink = blogSection.querySelector('a[href="blog.html"]');
    const blogLinkWrap = blogLink ? blogLink.parentElement : null;
    const blogDesc = blogSection.querySelector('p[style*="text-align:center"]');
    const noticeSection = document.getElementById('notices');
    const noticeControls = document.querySelector('.notice-controls');

    control.querySelectorAll('.segmented-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            control.querySelectorAll('.segmented-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            if (tab === 'blog') {
                if (blogGrid) blogGrid.style.display = '';
                if (blogDots) blogDots.style.display = '';
                if (blogEmpty) blogEmpty.style.display = 'none';
                if (blogLinkWrap) blogLinkWrap.style.display = '';
                if (blogDesc) blogDesc.style.display = '';
                if (noticeSection) noticeSection.style.display = 'none';
            } else {
                if (blogGrid) blogGrid.style.display = 'none';
                if (blogDots) blogDots.style.display = 'none';
                if (blogLinkWrap) blogLinkWrap.style.display = 'none';
                if (blogDesc) blogDesc.style.display = 'none';
                if (noticeSection) { noticeSection.style.display = ''; if (noticeControls) noticeControls.style.display = ''; }
            }
        });
    });
    if (noticeSection) noticeSection.style.display = 'none';
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
    initMeshBg();
    initScrollReveal();
    initRipple();
    initTrustBadges();

    function waitForContent(callback, maxTries) {
        maxTries = maxTries || 30;
        let tries = 0;
        function check() {
            tries++;
            const courses = document.querySelectorAll('#coursesContainer .course-card');
            const blogs = document.querySelectorAll('#blogContainer > *');
            if ((courses.length > 0 || tries >= maxTries) && (blogs.length > 0 || tries >= maxTries)) {
                callback();
            } else { setTimeout(check, 300); }
        }
        check();
    }

    waitForContent(() => {
        initCounters();
        initTiltCards();
        initTypewriter();
        initSegmentedControl();
    });

    setTimeout(() => initFabMenu(), 800);
});

document.documentElement.style.scrollBehavior = 'smooth';
