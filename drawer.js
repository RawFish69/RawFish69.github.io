// Robotics project drawer: a left-side list of every project (opened from the
// "Projects" button in the header or the cue under the intro). Hovering a title
// previews the project's first image; clicking jumps to it. A one-time hint
// points first-time visitors at the button.
(function () {
    'use strict';

    var HINT_KEY = 'robotics-projects-hint-seen';
    var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function $(id) { return document.getElementById(id); }

    document.addEventListener('DOMContentLoaded', function () {
        var drawer = $('projects-drawer');
        var scrim = $('projects-scrim');
        var list = $('projects-list');
        var toggle = $('projects-toggle');
        var preview = $('projects-preview');
        if (!drawer || !list || !toggle) return;

        var rows = Array.prototype.slice.call(list.querySelectorAll('.drawer-row'));
        var lastFocus = null;

        document.querySelectorAll('.projects-count').forEach(function (el) {
            el.textContent = rows.length;
        });

        // ---------- Per-project media for previews / thumbnails ----------
        function mediaFor(row) {
            var target = document.querySelector(row.getAttribute('href'));
            if (!target) return null;
            // A section can name its own preview image with data-preview, which
            // beats guessing from the first image. Used by video-only projects.
            var explicit = target.getAttribute('data-preview');
            if (explicit) {
                var fallbackVid = target.querySelector('video[src]');
                return {
                    type: 'img',
                    src: explicit,
                    fallback: fallbackVid ? { type: 'video', src: fallbackVid.getAttribute('src') } : null
                };
            }
            var img = target.querySelector('img');
            if (img) return { type: 'img', src: img.getAttribute('src') || img.getAttribute('data-src') };
            var video = target.querySelector('video[src]');
            if (video) return { type: 'video', src: video.getAttribute('src') };
            return null;
        }

        rows.forEach(function (row) {
            var media = mediaFor(row);
            row._media = media;
            var thumb = row.querySelector('.drawer-thumb');
            // Inline thumbnails are for touch screens (no hover). Videos only
            // get a play glyph there so the list never downloads video.
            if (!canHover && thumb && media) {
                if (media.type === 'img') {
                    var t = document.createElement('img');
                    t.src = media.src;
                    t.alt = '';
                    t.loading = 'lazy';
                    // A declared preview can be missing; degrade to the video glyph.
                    t.addEventListener('error', function () {
                        t.remove();
                        thumb.classList.add('is-video');
                        thumb.textContent = '\u25B6';
                    });
                    thumb.appendChild(t);
                } else {
                    thumb.classList.add('is-video');
                    thumb.textContent = '▶';
                }
            }
        });

        // ---------- Open / close ----------
        function openDrawer(e) {
            // Mouse/touch clicks report detail >= 1; keyboard activation reports 0.
            var fromKeyboard = !e || e.detail === 0;
            lastFocus = document.activeElement;
            dismissHint();
            drawer.classList.add('open');
            drawer.setAttribute('aria-hidden', 'false');
            scrim.hidden = false;
            requestAnimationFrame(function () { scrim.classList.add('open'); });
            toggle.setAttribute('aria-expanded', 'true');
            var current = list.querySelector('[aria-current="true"]') || rows[0];
            if (current) {
                current.scrollIntoView({ block: 'nearest' });
                if (fromKeyboard) current.focus({ preventScroll: true });
                else drawer.focus({ preventScroll: true });
            }
        }

        function closeDrawer(restoreFocus) {
            if (!drawer.classList.contains('open')) return;
            drawer.classList.remove('open');
            drawer.setAttribute('aria-hidden', 'true');
            scrim.classList.remove('open');
            setTimeout(function () { if (!drawer.classList.contains('open')) scrim.hidden = true; }, 200);
            toggle.setAttribute('aria-expanded', 'false');
            hidePreview();
            if (restoreFocus !== false && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
        }

        toggle.addEventListener('click', function (e) {
            if (drawer.classList.contains('open')) closeDrawer(); else openDrawer(e);
        });
        document.querySelectorAll('[data-open-projects]').forEach(function (b) {
            b.addEventListener('click', openDrawer);
        });
        $('projects-close').addEventListener('click', function () { closeDrawer(); });
        scrim.addEventListener('click', function () { closeDrawer(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { closeDrawer(); dismissHint(); }
        });

        // ---------- Hover preview (desktop) ----------
        var previewMedia = preview.querySelector('.projects-preview-media');
        var previewTitle = preview.querySelector('.projects-preview-title');

        function renderMedia(media) {
            previewMedia.innerHTML = '';
            if (!media) {
                previewMedia.hidden = true;
                return;
            }
            previewMedia.hidden = false;
            if (media.type === 'img') {
                var img = document.createElement('img');
                img.src = media.src;
                img.alt = '';
                // A declared preview image may not exist yet; fall back to the
                // project's video rather than showing a broken image.
                img.addEventListener('error', function () {
                    if (media.fallback) renderMedia(media.fallback);
                    else previewMedia.hidden = true;
                });
                previewMedia.appendChild(img);
            } else {
                var v = document.createElement('video');
                v.src = media.src + '#t=0.5';
                v.muted = true;
                v.playsInline = true;
                v.preload = 'metadata';
                previewMedia.appendChild(v);
            }
        }

        function showPreview(row) {
            if (!canHover || !drawer.classList.contains('open')) return;
            renderMedia(row._media);
            previewTitle.textContent = row.querySelector('.drawer-title').textContent;

            var r = row.getBoundingClientRect();
            var h = preview.offsetHeight || 260;
            var top = Math.min(Math.max(12, r.top + r.height / 2 - h / 2), window.innerHeight - h - 12);
            preview.style.top = top + 'px';
            preview.classList.add('show');
            preview.setAttribute('aria-hidden', 'false');
        }

        function hidePreview() {
            preview.classList.remove('show');
            preview.setAttribute('aria-hidden', 'true');
        }

        rows.forEach(function (row) {
            row.addEventListener('mouseenter', function () { showPreview(row); });
            row.addEventListener('focus', function () { showPreview(row); });
        });
        list.addEventListener('mouseleave', hidePreview);

        // ---------- Jump to a project ----------
        rows.forEach(function (row) {
            row.addEventListener('click', function (e) {
                var id = row.getAttribute('href');
                var target = document.querySelector(id);
                if (!target) return;
                e.preventDefault();
                closeDrawer(false);
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (history.replaceState) history.replaceState(null, '', id);
                var title = target.querySelector('h2');
                if (title) {
                    title.classList.remove('just-jumped');
                    void title.offsetWidth; // restart the highlight animation
                    title.classList.add('just-jumped');
                }
            });
        });

        // ---------- Scroll-spy: mark the project currently in view ----------
        if ('IntersectionObserver' in window) {
            var byId = {};
            rows.forEach(function (row) { byId[row.getAttribute('href').slice(1)] = row; });
            var visible = {};
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting ? en.boundingClientRect.top : null; });
                var best = null, bestTop = Infinity;
                Object.keys(visible).forEach(function (id) {
                    var top = visible[id];
                    if (top !== null && Math.abs(top) < bestTop) { best = id; bestTop = Math.abs(top); }
                });
                rows.forEach(function (row) { row.removeAttribute('aria-current'); });
                if (best && byId[best]) byId[best].setAttribute('aria-current', 'true');
            }, { rootMargin: '-80px 0px -45% 0px' });
            Object.keys(byId).forEach(function (id) {
                var el = document.getElementById(id);
                if (el) io.observe(el);
            });
        }

        // ---------- First-visit hint ----------
        var hint = $('projects-hint');
        var hintTimer = null;

        function seen() {
            try { return localStorage.getItem(HINT_KEY) === '1'; } catch (e) { return true; }
        }

        function dismissHint() {
            if (!hint || hint.hidden) return;
            hint.classList.remove('show');
            setTimeout(function () { hint.hidden = true; }, 200);
            clearTimeout(hintTimer);
            window.removeEventListener('scroll', onScrollDismiss);
            try { localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* storage blocked */ }
        }

        function onScrollDismiss() { if (window.scrollY > 300) dismissHint(); }

        function placeHint() {
            var r = toggle.getBoundingClientRect();
            hint.style.left = Math.max(8, r.left) + 'px';
            hint.style.top = (r.bottom + 10) + 'px';
        }

        if (hint && !seen()) {
            setTimeout(function () {
                if (seen() || drawer.classList.contains('open')) return;
                placeHint();
                hint.hidden = false;
                requestAnimationFrame(function () { hint.classList.add('show'); });
                window.addEventListener('scroll', onScrollDismiss, { passive: true });
                window.addEventListener('resize', placeHint);
                hintTimer = setTimeout(dismissHint, 9000);
            }, 900);
            hint.querySelector('.projects-hint-close').addEventListener('click', dismissHint);
        }
    });
})();
