// Site-wide security controls (right-click + developer tools prevention)
// Driven by admin settings: rightClickPrevention, devToolsPrevention
(function () {
    'use strict';
    
    function applyRightClickBlock() {
        document.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            return false;
        }, true);
    }

    function applyDevToolsBlock() {
        // Block common inspect shortcuts
        document.addEventListener('keydown', function (e) {
            const key = (e.key || '').toUpperCase();
            // F12
            if (key === 'F12') { e.preventDefault(); return false; }
            // Ctrl+U (view source)
            if (e.ctrlKey && key === 'U') { e.preventDefault(); return false; }
            // Ctrl+S (save page)
            if (e.ctrlKey && key === 'S') { e.preventDefault(); return false; }
            // Ctrl+Shift+I / J / C / K (devtools)
            if ((e.ctrlKey && e.shiftKey) && (key === 'I' || key === 'J' || key === 'C' || key === 'K')) {
                e.preventDefault();
                return false;
            }
            // Cmd+Opt+I / J / C / U on macOS
            if (e.metaKey && e.altKey && (key === 'I' || key === 'J' || key === 'C')) {
                e.preventDefault();
                return false;
            }
            if (e.metaKey && key === 'U') { e.preventDefault(); return false; }
        }, true);

        // Prevent text selection / drag (also helps stop saving content)
        // Skip editable elements (inputs, textareas, contenteditable/rich text editors)
        function isEditable(target) {
            if (!target) return false;
            // selectstart target can be a Text node; climb to its parent element
            if (target.nodeType === 3) target = target.parentElement;
            if (!target || !target.closest) return false;
            return !!target.closest('input, textarea, select, [contenteditable], .ql-editor, .ql-container');
        }
        document.addEventListener('selectstart', function (e) { if (isEditable(e.target)) return; e.preventDefault(); return false; }, true);
        document.addEventListener('dragstart', function (e) { if (isEditable(e.target)) return; e.preventDefault(); return false; }, true);
        document.addEventListener('copy', function (e) { if (isEditable(e.target)) return; e.preventDefault(); return false; }, true);

        // Devtools open detection (best-effort, not foolproof)
        const threshold = 160;
        let warned = false;
        function check() {
            const widthDiff = window.outerWidth - window.innerWidth;
            const heightDiff = window.outerHeight - window.innerHeight;
            if (widthDiff > threshold || heightDiff > threshold) {
                if (!warned) {
                    warned = true;
                    try { document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;background:#0f172a;color:#fff;text-align:center;padding:20px;"><div><h1 style="font-size:32px;margin-bottom:12px;">&#128274; Access Restricted</h1><p style="font-size:16px;opacity:.85;">Developer tools are disabled on this website.</p><p style="font-size:14px;opacity:.6;margin-top:10px;">Please close developer tools to continue.</p></div></div>'; } catch (_) {}
                }
            } else {
                warned = false;
            }
        }
        setInterval(check, 1000);

        // Disable console (basic)
        try {
            const noop = function () {};
            ['log', 'warn', 'error', 'info', 'debug', 'table', 'trace'].forEach(function (m) {
                if (window.console) window.console[m] = noop;
            });
        } catch (_) {}
    }

    async function init() {
        try {
            const res = await fetch('/api/settings');
            const settings = await res.json();
            if (settings.rightClickPrevention) applyRightClickBlock();
            if (settings.devToolsPrevention) applyDevToolsBlock();
        } catch (err) {
            // Silent fail
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
