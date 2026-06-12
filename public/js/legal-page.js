// Loads dynamic legal-page content from /api/legal-pages/:slug
(function () {
    function fmt(d) {
        if (!d) return '';
        try {
            const dt = new Date(d);
            return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (_) { return ''; }
    }
    async function load() {
        const root = document.getElementById('legalPageRoot');
        if (!root) return;
        const slug = root.getAttribute('data-slug');
        if (!slug) return;
        try {
            const res = await fetch('/api/legal-pages/' + encodeURIComponent(slug));
            if (!res.ok) return;
            const page = await res.json();
            const titleEl = document.getElementById('legalTitle');
            const contentEl = document.getElementById('legalContent');
            const dateEl = document.getElementById('legalUpdated');
            if (titleEl && page.title) {
                titleEl.textContent = page.title;
                document.title = page.title + ' - Genius Computer Education';
            }
            if (contentEl && typeof page.content === 'string') {
                contentEl.innerHTML = page.content;
            }
            if (dateEl && page.updatedAt) {
                dateEl.textContent = 'Last updated: ' + fmt(page.updatedAt);
            }
        } catch (err) {
            // Silently keep static fallback content
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
    else load();
})();
