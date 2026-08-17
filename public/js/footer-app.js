(async function () {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        const show = settings.androidApp && settings.androidApp.uploaded;
        document.querySelectorAll('.footer-app-download').forEach(function (el) {
            el.style.display = show ? '' : 'none';
        });
    } catch (e) {
        document.querySelectorAll('.footer-app-download').forEach(function (el) {
            el.style.display = 'none';
        });
    }
})();
