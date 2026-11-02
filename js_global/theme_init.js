// Runs synchronously in <head> so the theme is applied before first paint.
// Dark is the default; an explicit choice is remembered under the legacy
// 'theme' key so it carries over from the old site.
(function () {
    var theme;
    try { theme = localStorage.getItem('theme'); } catch (e) { /* storage blocked */ }
    if (theme !== 'light' && theme !== 'dark') theme = 'dark';
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.add('site-' + theme);
    root.classList.remove(theme === 'dark' ? 'site-light' : 'site-dark');
})();
