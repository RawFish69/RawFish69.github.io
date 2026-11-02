// Robotics page theme toggle. The page keeps its own header (no shared Nori
// top bar), so this adds a single Light/Dark button to it. Theme state is
// shared with the rest of the site: <html data-theme> + the 'theme' key.
(function () {
    'use strict';
    var root = document.documentElement;

    function current() {
        return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }

    function label(btn) {
        var dark = current() === 'dark';
        btn.textContent = dark ? 'Light mode' : 'Dark mode';
        btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }

    function set(theme) {
        root.setAttribute('data-theme', theme);
        root.classList.toggle('site-dark', theme === 'dark');
        root.classList.toggle('site-light', theme === 'light');
        try { localStorage.setItem('theme', theme); } catch (e) { /* storage blocked */ }
    }

    document.addEventListener('DOMContentLoaded', function () {
        // Opened from disk (file://), "../" would show a folder listing;
        // point it at the home page file instead. Online this does nothing.
        if (location.protocol === 'file:') {
            document.querySelectorAll('a[href="../"]').forEach(function (a) {
                a.setAttribute('href', '../index.html');
            });
        }

        var btn = document.getElementById('robotics-theme');
        if (!btn) return;
        label(btn);
        btn.addEventListener('click', function () {
            set(current() === 'dark' ? 'light' : 'dark');
            label(btn);
        });
    });
})();
