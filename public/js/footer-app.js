(async function () {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        const show = settings.androidApp && settings.androidApp.uploaded;
        document.querySelectorAll('.footer-app-row').forEach(function (el) {
            el.style.display = show ? '' : 'none';
        });
        if (settings.logo) {
            document.querySelectorAll('.footer-logo').forEach(function (el) {
                el.src = settings.logo;
            });
        }
        if (settings.name) {
            document.querySelectorAll('.footer-brand-logo span').forEach(function (el) {
                el.textContent = settings.name;
            });
        }
    } catch (e) {
        document.querySelectorAll('.footer-app-row').forEach(function (el) {
            el.style.display = 'none';
        });
    }
})();
