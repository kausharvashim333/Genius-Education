/* Premium Mobile Experience JS */

// === 1. Scroll Reveal (IntersectionObserver) ===
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('section .container, .section-title, .courses-grid, .blog-grid, .gallery-grid, .testimonials-wrapper, .about-content, .contact-content, .notice-list').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });

    document.querySelectorAll('.courses-grid, .blog-grid, .gallery-grid, .about-stats, .notice-list').forEach(el => {
        el.classList.add('reveal-stagger');
        observer.observe(el);
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
    const duration = 1500;
    const steps = 60;
    const increment = target / steps;
    const stepTime = duration / steps;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        el.textContent = Math.floor(current) + suffix;
    }, stepTime);
}

function initCounters() {
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('.stat strong, .stat-number').forEach(el => counterObserver.observe(el));
}

// === 3. 3D Tilt Cards ===
function initTiltCards() {
    const cards = document.querySelectorAll('.course-card, .trust-badge, .info-item');
    cards.forEach(card => {
        if (window.innerWidth > 769) return;
        card.classList.add('tilt-card');
        const shine = document.createElement('div');
        shine.className = 'tilt-shine';
        card.appendChild(shine);

        card.addEventListener('touchmove', (e) => {
            const rect = card.getBoundingClientRect();
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const rotateX = ((y - cy) / cy) * -8;
            const rotateY = ((x - cx) / cx) * 8;
            card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
            card.classList.add('tilt-active');
            card.style.setProperty('--shine-x', (x / rect.width * 100) + '%');
            card.style.setProperty('--shine-y', (y / rect.height * 100) + '%');
        });
        card.addEventListener('touchend', () => {
            card.style.transform = '';
            card.classList.remove('tilt-active');
        });
    });
}

// === 4. Card Flip (courses) ===
function initCardFlip() {
    document.querySelectorAll('.course-card').forEach(card => {
        card.classList.add('flip-card');
        const inner = document.createElement('div');
        inner.className = 'flip-card-inner';
        const front = document.createElement('div');
        front.className = 'flip-card-front';
        const back = document.createElement('div');
        back.className = 'flip-card-back';
        back.style.background = 'linear-gradient(135deg, rgba(30,41,59,.95), rgba(15,23,42,.95))';
        back.style.display = 'flex';
        back.style.flexDirection = 'column';
        back.style.justifyContent = 'center';
        back.style.alignItems = 'center';
        back.style.padding = '20px';
        back.style.textAlign = 'center';
        back.innerHTML = '<i class="fas fa-graduation-cap" style="font-size:32px;color:#a5b4fc;margin-bottom:12px"></i><p style="color:#cbd5e1;font-size:13px;margin-bottom:16px">Tap to view full course details</p><a href="courses.html" style="padding:8px 20px;background:linear-gradient(135deg,rgba(102,126,234,.5),rgba(118,75,162,.4));color:#fff;border-radius:50px;text-decoration:none;font-size:13px;font-weight:600;border:1px solid rgba(255,255,255,.2)">View Details</a>';

        while (card.firstChild) front.appendChild(card.firstChild);
        inner.appendChild(front);
        inner.appendChild(back);
        card.appendChild(inner);

        let flipTimer;
        card.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            e.preventDefault();
            card.classList.toggle('flipped');
            clearTimeout(flipTimer);
            flipTimer = setTimeout(() => card.classList.remove('flipped'), 4000);
        });
    });
}

// === 5. Floating Action Menu ===
function initFabMenu() {
    const fabBtn = document.querySelector('.enquiry-fab-btn');
    const fabWrapper = document.getElementById('enquiryFab');
    if (!fabBtn || !fabWrapper) return;

    const overlay = document.createElement('div');
    overlay.className = 'fab-menu-overlay';
    overlay.id = 'fabMenuOverlay';

    const items = document.createElement('div');
    items.className = 'fab-menu-items';
    items.innerHTML = `
        <a class="fab-menu-item fab-call" id="fabCall"><i class="fas fa-phone"></i> Call Now</a>
        <a class="fab-menu-item fab-whatsapp" id="fabWhatsapp" target="_blank"><i class="fab fa-whatsapp"></i> WhatsApp</a>
        <a class="fab-menu-item fab-enquiry" id="fabEnquiry"><i class="fas fa-comment-dots"></i> Enquiry</a>
        <a class="fab-menu-item fab-directions" id="fabDirections" target="_blank"><i class="fas fa-map-marked-alt"></i> Directions</a>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(items);

    function toggleMenu() {
        const isOpen = overlay.classList.contains('active');
        if (isOpen) {
            overlay.classList.remove('active');
            fabBtn.classList.remove('fab-menu-open');
        } else {
            overlay.classList.add('active');
            fabBtn.classList.add('fab-menu-open');
        }
    }

    fabBtn.addEventListener('click', (e) => {
        if (typeof openEnquiryModal === 'function' && !overlay.classList.contains('active')) {
            e.stopPropagation();
            e.preventDefault();
            toggleMenu();
        }
    });

    overlay.addEventListener('click', toggleMenu);

    document.getElementById('fabEnquiry').addEventListener('click', (e) => {
        e.preventDefault();
        toggleMenu();
        if (typeof openEnquiryModal === 'function') openEnquiryModal();
    });

    // Load phone/whatsapp from settings
    fetch('/api/settings').then(r => r.json()).then(s => {
        if (s.phone) {
            const phone = s.phone.split(',')[0].trim().replace(/[^0-9+]/g, '');
            document.getElementById('fabCall').href = 'tel:' + phone;
            document.getElementById('fabWhatsapp').href = 'https://wa.me/' + phone.replace('+', '');
        }
        if (s.address) {
            document.getElementById('fabDirections').href = 'https://maps.google.com/?q=' + encodeURIComponent(s.address);
        }
    }).catch(() => {});
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

// === 7. Mesh Background ===
function initMeshBg() {
    const mesh = document.createElement('div');
    mesh.className = 'mesh-bg';
    mesh.innerHTML = '<div class="mesh-blob b1"></div><div class="mesh-blob b2"></div><div class="mesh-blob b3"></div>';
    document.body.insertBefore(mesh, document.body.firstChild);
}

// === 8. Liquid Ripple ===
function initRipple() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn, .enquiry-submit-btn, .segmented-btn, .notice-filter-btn, .gallery-filter-btn, .trust-badge');
        if (!btn) return;
        btn.classList.add('ripple-btn');
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple-circle';
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });
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

// === 11. Toast Notifications ===
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// === 12. Segmented Control (Notices/Blog) ===
function initSegmentedControl() {
    const blogSection = document.querySelector('#blog .container');
    if (!blogSection) return;
    const title = blogSection.querySelector('.section-title');
    const control = document.createElement('div');
    control.className = 'segmented-control';
    control.innerHTML = `
        <button class="segmented-btn active" data-tab="blog">Blog Posts</button>
        <button class="segmented-btn" data-tab="notices">Notices</button>
    `;
    title.insertAdjacentElement('afterend', control);

    const blogGrid = document.getElementById('blogContainer');
    const blogDots = document.getElementById('blogCarouselDots');
    const blogEmpty = document.getElementById('blogEmpty');
    const blogLink = blogSection.querySelector('a[href="blog.html"]').parentElement;

    const noticeSection = document.getElementById('notices');
    const noticeList = document.getElementById('noticeList');
    const noticeControls = document.querySelector('.notice-controls');
    const noticeEmpty = document.getElementById('noticeEmpty');

    control.querySelectorAll('.segmented-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            control.querySelectorAll('.segmented-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            if (tab === 'blog') {
                blogGrid.style.display = '';
                if (blogDots) blogDots.style.display = '';
                if (blogEmpty) blogEmpty.style.display = 'none';
                blogLink.style.display = '';
                noticeSection.style.display = 'none';
            } else {
                blogGrid.style.display = 'none';
                if (blogDots) blogDots.style.display = 'none';
                blogLink.style.display = 'none';
                noticeSection.style.display = '';
                noticeSection.querySelector('.container').insertBefore(noticeControls, noticeList);
                if (noticeControls) noticeControls.style.display = '';
            }
        });
    });
}

// === 13. Peek Carousel for Courses ===
function initPeekCarousel() {
    if (window.innerWidth > 769) return;
    const grid = document.getElementById('coursesContainer');
    if (!grid) return;
    grid.classList.add('peek-carousel');
    grid.querySelectorAll('.course-card').forEach(card => card.classList.add('peek-card'));
}

// === Init All ===
document.addEventListener('DOMContentLoaded', () => {
    initMeshBg();
    initScrollReveal();
    initCounters();
    initTiltCards();
    initRipple();
    initTrustBadges();

    // Delayed inits (after content loads)
    setTimeout(() => {
        initCardFlip();
        initPeekCarousel();
        initTypewriter();
        initSegmentedControl();
    }, 1000);

    // FAB Menu after enquiry modal is set up
    setTimeout(() => initFabMenu(), 500);
});

// Smooth scroll
document.documentElement.style.scrollBehavior = 'smooth';
