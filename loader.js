// Robotics image loading order.
//
//   1. The first two MK3 photos load straight from the HTML (fetchpriority=high).
//   2. Then the rest of MK3's photos.
//   3. Then the MK3 YouTube embed is allowed to start (carousel.js waits for
//      the "robotics:mk3-ready" event).
//   4. Then each following project's photos, one project at a time, in page
//      order. A project starts only after the previous one has finished.
//   5. Videos are never queued: they load only when reached (carousel swipe
//      or scrolled on screen), so they never compete with photos.
//
// Whatever is on screen jumps the queue: if the visitor scrolls ahead or
// jumps there from the project drawer, those photos load immediately.
//
// Deferred images carry their URL in data-src. The carousel clones slides,
// so a URL is applied to every <img> that shares it (originals and clones).
(function () {
    'use strict';

    var CONCURRENCY = 3;       // photos in flight at once inside a project
    var HERO_WAIT_MS = 2500;   // don't hold the queue forever on slow heroes
    var MK3_READY_MAX_MS = 6000;

    var done = Object.create(null);     // url -> true once loaded (or failed)
    var inflight = Object.create(null); // url -> true while loading
    var groups = [];                    // [{ id, urls: [...] }] in page order
    var active = 0;
    var started = false;

    window.roboticsLoader = { done: done };
    window.roboticsMk3Ready = false;

    function apply(url) {
        document.querySelectorAll('img[data-src="' + url + '"]').forEach(function (img) {
            img.src = url;
            img.removeAttribute('data-src');
        });
    }

    function load(url, cb) {
        if (done[url]) { if (cb) cb(); return; }
        if (inflight[url]) {
            if (cb) (inflight[url].cbs || (inflight[url].cbs = [])).push(cb);
            return;
        }
        var entry = inflight[url] = { cbs: cb ? [cb] : [] };
        var pre = new Image();
        pre.decoding = 'async';
        var finish = function () {
            if (done[url]) return;
            done[url] = true;
            delete inflight[url];
            apply(url);
            entry.cbs.forEach(function (f) { f(); });
        };
        pre.onload = finish;
        pre.onerror = finish;
        pre.src = url;
    }

    // ---------- Sequential project queue ----------
    function pump() {
        while (groups.length && active < CONCURRENCY) {
            var g = groups[0];
            var next = null;
            for (var i = 0; i < g.urls.length; i++) {
                var u = g.urls[i];
                if (!done[u] && !inflight[u]) { next = u; break; }
            }
            if (!next) {
                // Everything in this project is loaded or loading; move on only
                // once it has fully finished.
                var pending = g.urls.some(function (u) { return !done[u]; });
                if (pending) return;
                groups.shift();
                if (g.id === 'proj-mk3') markMk3Ready();
                continue;
            }
            active++;
            load(next, function () { active--; pump(); });
        }
        if (groups.length) {
            var head = groups[0];
            if (!head.urls.some(function (u) { return !done[u]; })) {
                groups.shift();
                if (head.id === 'proj-mk3') markMk3Ready();
                pump();
            }
        }
    }

    function markMk3Ready() {
        if (window.roboticsMk3Ready) return;
        window.roboticsMk3Ready = true;
        document.dispatchEvent(new CustomEvent('robotics:mk3-ready'));
    }

    // ---------- On screen jumps the queue ----------
    function watchViewport() {
        if (!('IntersectionObserver' in window)) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                var url = e.target.getAttribute('data-src');
                io.unobserve(e.target);
                if (!url) return;
                load(url);
                // Pull the rest of that project to the front of the queue.
                var article = e.target.closest('.robotics-project');
                if (!article) return;
                for (var i = 1; i < groups.length; i++) {
                    if (groups[i].id === article.id) {
                        groups.unshift(groups.splice(i, 1)[0]);
                        pump();
                        break;
                    }
                }
            });
        }, { rootMargin: '200px 0px' });
        document.querySelectorAll('img[data-src]').forEach(function (img) { io.observe(img); });
    }

    function start() {
        if (started) return;
        started = true;
        document.querySelectorAll('.robotics-project').forEach(function (article) {
            var urls = [];
            article.querySelectorAll('img[data-src]').forEach(function (img) {
                var u = img.getAttribute('data-src');
                if (urls.indexOf(u) === -1) urls.push(u);
            });
            if (urls.length) groups.push({ id: article.id, urls: urls });
        });
        if (!groups.length || groups[0].id !== 'proj-mk3') markMk3Ready();
        pump();
    }

    function init() {
        watchViewport();
        // Let the two hero photos finish first (they are already downloading).
        var heroes = Array.prototype.slice.call(document.querySelectorAll('img[fetchpriority="high"]'));
        var waiting = heroes.filter(function (img) { return !img.complete; }).length;
        if (!waiting) { start(); return; }
        var timer = setTimeout(start, HERO_WAIT_MS);
        heroes.forEach(function (img) {
            if (img.complete) return;
            var settle = function () { if (--waiting <= 0) { clearTimeout(timer); start(); } };
            img.addEventListener('load', settle, { once: true });
            img.addEventListener('error', settle, { once: true });
        });
        // Never hold the YouTube embed back for too long.
        setTimeout(markMk3Ready, MK3_READY_MAX_MS);
    }

    try {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
        else init();
    } catch (err) {
        // If anything goes wrong, just show everything.
        document.querySelectorAll('img[data-src]').forEach(function (img) {
            img.src = img.getAttribute('data-src');
            img.removeAttribute('data-src');
        });
    }
})();
