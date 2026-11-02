/**
 * Robotics page client behaviour:
 *   1. Reusable looping image carousel (.rcarousel) for projects with 3+ images.
 *   2. MK3 video carousel with auto-advance between clips.
 *   3. Lazy load/play of non-hero videos so they download one at a time on scroll.
 */

(function () {
    // Reusable looping image carousel: shows two images at once on desktop
    // (one on mobile) with a translucent peek of the neighbours.
    //
    // Track layout after cloning (REAL = number of real images):
    //   [ ...clones... | 0 1 .. REAL-1 | ...clones... ]
    // We rest in the middle block (indices REAL..2*REAL-1) and step one
    // image per click; when we drift one slide outside it, we silently
    // jump back to the identical-looking slide in the middle block.
    function initCarousel(root) {
        var viewport = root.querySelector('.rcarousel-viewport');
        var track = root.querySelector('.rcarousel-track');
        if (!viewport || !track) return;

        var originals = Array.prototype.slice.call(track.children);
        var REAL = originals.length;
        if (REAL < 3) return; // carousel only for 3+ images

        originals.forEach(function (o) { track.insertBefore(o.cloneNode(true), originals[0]); });
        originals.forEach(function (o) { track.appendChild(o.cloneNode(true)); });

        var slides = Array.prototype.slice.call(track.children); // 3 * REAL
        var idx = REAL; // first real image
        var busy = false;
        var lastMoveAt = 0;
        var settleTimer = null;
        // `transitionend` is never guaranteed (mobile background tabs skip it,
        // transitions can be interrupted, and prefers-reduced-motion disables
        // them). If it never arrives, `busy` stays true forever and every
        // arrow click is swallowed, so cap the wait and let a stale lock expire.
        var SETTLE_SAFETY_MS = 700;
        var STALE_LOCK_MS = 900;

        function clearSettleTimer() {
            if (settleTimer) {
                window.clearTimeout(settleTimer);
                settleTimer = null;
            }
        }

        function center(animate) {
            // On narrow screens show one image at a time (single-up); on
            // wider screens keep the two-up pair layout.
            var mobile = window.matchMedia('(max-width: 768px)').matches;
            var a = slides[idx];
            if (!a) return;
            var targetCenter;
            if (mobile) {
                targetCenter = a.offsetLeft + a.offsetWidth / 2;
            } else {
                var b = slides[idx + 1];
                if (!b) return;
                targetCenter = a.offsetLeft + (b.offsetLeft + b.offsetWidth - a.offsetLeft) / 2;
            }
            var tx = viewport.clientWidth / 2 - targetCenter;
            track.style.transition = animate ? 'transform 0.45s ease' : 'none';
            track.style.transform = 'translateX(' + tx + 'px)';
            // On a silent jump (clone -> real) kill the opacity fade too, else
            // the freshly centered pair flashes dim then fades up.
            for (var i = 0; i < slides.length; i++) {
                if (!animate) slides[i].style.transition = 'none';
                slides[i].classList.toggle('is-active', mobile ? (i === idx) : (i === idx || i === idx + 1));
            }
            if (!animate) {
                void track.offsetWidth; // force reflow so the instant change sticks
                for (var j = 0; j < slides.length; j++) slides[j].style.transition = '';
            }
        }

        var AUTO_ADVANCE_MS = 10000;
        var autoTimer = null;
        var paused = false;
        var visible = false;
        var visibilityObserver = null;

        function startAuto() {
            if (autoTimer || !visible) return;
            autoTimer = window.setInterval(function () {
                if (!paused) move(1);
            }, AUTO_ADVANCE_MS);
        }

        function stopAuto() {
            if (!autoTimer) return;
            window.clearInterval(autoTimer);
            autoTimer = null;
        }

        function resetAuto() {
            stopAuto();
            startAuto();
        }

        function observeVisibility() {
            if (!('IntersectionObserver' in window)) {
                visible = true;
                startAuto();
                return;
            }
            visibilityObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.target !== root) return;
                    visible = entry.isIntersecting;
                    if (visible) {
                        startAuto();
                    } else {
                        stopAuto();
                    }
                });
            }, { threshold: 0.25 });
            visibilityObserver.observe(root);
        }

        function move(dir) {
            // Self-heal a stale lock before rejecting the click, so a carousel
            // that missed its `transitionend` can never stay frozen.
            if (busy && Date.now() - lastMoveAt > STALE_LOCK_MS) busy = false;
            if (busy) return;
            busy = true;
            lastMoveAt = Date.now();
            idx += dir;
            center(true);
            clearSettleTimer();
            settleTimer = window.setTimeout(onSettled, SETTLE_SAFETY_MS);
        }

        function onSettled() {
            clearSettleTimer();
            // Jump out of the clone buffers without animation to fake a loop.
            if (idx > 2 * REAL - 1) idx -= REAL;   // drifted past the middle block
            else if (idx < REAL) idx += REAL;      // drifted before the middle block
            else { busy = false; return; }
            center(false);
            busy = false;
        }

        track.addEventListener('transitionend', function (e) {
            if (e.propertyName === 'transform') onSettled();
        });
        track.addEventListener('transitioncancel', function (e) {
            if (e.propertyName === 'transform') onSettled();
        });
        var prev = root.querySelector('.rcarousel-prev');
        var next = root.querySelector('.rcarousel-next');
        if (prev) prev.addEventListener('click', function () { move(-1); resetAuto(); });
        if (next) next.addEventListener('click', function () { move(1); resetAuto(); });
        // Click a dimmed peek to advance toward it.
        slides.forEach(function (s, i) {
            s.addEventListener('click', function () {
                if (s.classList.contains('is-active')) return;
                move(i < idx ? -1 : 1);
                resetAuto();
            });
        });

        root.addEventListener('mouseenter', function () {
            paused = true;
        });
        root.addEventListener('mouseleave', function () {
            paused = false;
        });

        var settle = function () { center(false); };
        window.addEventListener('load', settle);
        window.addEventListener('resize', settle);
        settle();
        observeVisibility();
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.rcarousel').forEach(initCarousel);
    });
})();

var ROBOTICS_VIDEO_CONFIG = {
    mk3YoutubeUrl: 'https://www.youtube.com/embed/OUJBFZM-bNs?si=TLwtHn-OSiWeLMsd&rel=0&modestbranding=1&playsinline=1&autoplay=1&mute=1'
};

(function () {
    function initVideoCarousel(root) {
        var track = root.querySelector('.vcarousel-track');
        var originals = Array.prototype.slice.call(root.querySelectorAll('.vcarousel-slide'));
        var dots = Array.prototype.slice.call(root.querySelectorAll('.vcarousel-dot'));
        if (!track || originals.length < 2) return;

        var youtubePlayers = {};
        var youtubeApiReady = false;
        var youtubeApiQueue = [];

        function fallbackToNextSlide(reason) {
            if (busy) return;
            if (window.console && window.console.warn) {
                window.console.warn('Falling back from YouTube video to local video:', reason);
            }
            move(1);
        }

        function ensureYouTubeApi(callback) {
            if (window.YT && window.YT.Player) {
                callback();
                return;
            }
            if (youtubeApiQueue.indexOf(callback) === -1) {
                youtubeApiQueue.push(callback);
            }
            if (youtubeApiReady) return;
            youtubeApiReady = true;
            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = function () {
                youtubeApiQueue.forEach(function (fn) { fn(); });
                youtubeApiQueue = [];
            };
        }

        function whenMk3Ready(fn) {
            if (window.roboticsMk3Ready || !window.roboticsLoader) { fn(); return; }
            document.addEventListener('robotics:mk3-ready', fn, { once: true });
        }

        function attachYouTubePlayer(slide) {
            var iframe = slide.querySelector('iframe');
            if (!iframe || youtubePlayers[slide.dataset.realIndex]) return;
            if (iframe.getAttribute('src') === null) {
                iframe.setAttribute('src', ROBOTICS_VIDEO_CONFIG.mk3YoutubeUrl);
            }
            iframe.addEventListener('error', function () {
                fallbackToNextSlide('youtube-iframe-error');
            });
            ensureYouTubeApi(function () {
                var player = new window.YT.Player(iframe, {
                    events: {
                        onReady: function (event) {
                            var playback = event.target;
                            try { playback.setPlaybackQuality('hd1080'); } catch (e) {}
                            try { playback.playVideo(); } catch (e) {}
                        },
                        onStateChange: function (event) {
                            if (event.data === 1) {
                                try { event.target.setPlaybackQuality('highres'); } catch (e) {}
                            }
                            if (event.data === 0) {
                                move(1);
                            }
                        },
                        onError: function () {
                            fallbackToNextSlide('youtube-player-error');
                        }
                    }
                });
                youtubePlayers[slide.dataset.realIndex] = player;
            });
        }

        originals.forEach(function (slide, i) {
            slide.dataset.realIndex = i;
            slide.classList.remove('is-active');
            if (slide.getAttribute('data-media-type') === 'youtube') {
                // Start the YouTube embed only once MK3's photos are in
                // (loader.js fires robotics:mk3-ready), so it doesn't compete
                // with the first thing visitors see.
                whenMk3Ready(function () { attachYouTubePlayer(slide); });
            }
        });

        var firstClone = originals[0].cloneNode(true);
        var lastClone = originals[originals.length - 1].cloneNode(true);
        firstClone.dataset.realIndex = 0;
        firstClone.dataset.clone = 'true';
        lastClone.dataset.realIndex = originals.length - 1;
        lastClone.dataset.clone = 'true';
        [firstClone, lastClone].forEach(function (clone) {
            clone.classList.remove('is-active');
            clone.querySelectorAll('video').forEach(function (video) {
                video.removeAttribute('autoplay');
                video.autoplay = false;
                video.preload = 'none';
                video.setAttribute('preload', 'none');
            });
        });

        track.insertBefore(lastClone, originals[0]);
        track.appendChild(firstClone);

        var slides = Array.prototype.slice.call(track.children);
        var pos = 1;
        var busy = false;
        var pendingReset = false;
        var lastMoveAt = 0;
        var settleTimer = null;
        // Same guard as the image carousel: a missed `transitionend` must never
        // leave the video carousel permanently locked (frozen arrows on mobile).
        var SETTLE_SAFETY_MS = 700;
        var STALE_LOCK_MS = 900;

        function clearSettleTimer() {
            if (settleTimer) {
                window.clearTimeout(settleTimer);
                settleTimer = null;
            }
        }

        function realIndex() {
            return Number(slides[pos].dataset.realIndex || 0);
        }

        function setPosition(animate) {
            track.style.transition = animate ? 'transform 0.45s ease' : 'none';
            track.style.transform = 'translateX(-' + (pos * 100) + '%)';
            if (!animate) {
                void track.offsetWidth;
                track.style.transition = '';
            }
        }

        function syncActive(resetVideo) {
            var activeReal = realIndex();
            slides.forEach(function (slide, i) {
                slide.classList.toggle('is-active', i === pos);
            });
            dots.forEach(function (dot, i) {
                dot.classList.toggle('is-active', i === activeReal);
            });

            slides.forEach(function (slide, i) {
                var video = slide.querySelector('video');
                var youtubePlayer = youtubePlayers[slide.dataset.realIndex];
                if (video) {
                    if (i === pos) {
                        if (resetVideo || video.ended) {
                            try { video.currentTime = 0; } catch (e) {}
                        }
                        video.play().catch(function () {});
                    } else {
                        video.pause();
                    }
                } else if (youtubePlayer) {
                    if (i === pos) {
                        if (resetVideo) {
                            try { youtubePlayer.seekTo(0, true); } catch (e) {}
                        }
                        try { youtubePlayer.playVideo(); } catch (e) {
                            fallbackToNextSlide('youtube-play-error');
                        }
                    } else {
                        try { youtubePlayer.pauseVideo(); } catch (e) {}
                    }
                }
            });
        }

        function move(dir) {
            // Self-heal a stale lock (see SETTLE_SAFETY_MS above).
            if (busy && Date.now() - lastMoveAt > STALE_LOCK_MS) busy = false;
            if (busy) return;
            busy = true;
            lastMoveAt = Date.now();
            pendingReset = true;
            pos += dir;
            setPosition(true);
            syncActive(true);
            clearSettleTimer();
            settleTimer = window.setTimeout(settle, SETTLE_SAFETY_MS);
        }

        originals.forEach(function (slide) {
            var video = slide.querySelector('video');
            if (!video) return;
            // No video.load() here: it made the browser download every carousel
            // video at startup. play() fetches a video when it is swiped to.
            video.addEventListener('ended', function () {
                move(1);
            });
        });

        // Settles the current step. Safe to call twice: a second call just finds
        // the position already normalised and clears `busy` again.
        function settle() {
            clearSettleTimer();
            if (pos === 0) {
                pos = originals.length;
                setPosition(false);
                syncActive(pendingReset);
            } else if (pos === originals.length + 1) {
                pos = 1;
                setPosition(false);
                syncActive(pendingReset);
            }
            pendingReset = false;
            busy = false;
        }

        track.addEventListener('transitionend', function (e) {
            if (e.propertyName !== 'transform') return;
            settle();
        });
        track.addEventListener('transitioncancel', function (e) {
            if (e.propertyName !== 'transform') return;
            settle();
        });

        var prev = root.querySelector('.vcarousel-prev');
        var next = root.querySelector('.vcarousel-next');
        if (prev) prev.addEventListener('click', function () { move(-1); });
        if (next) next.addEventListener('click', function () { move(1); });
        dots.forEach(function (dot, i) {
            dot.addEventListener('click', function () {
                if (i + 1 === pos) {
                    syncActive(true);
                    return;
                }
                if (busy && Date.now() - lastMoveAt > STALE_LOCK_MS) busy = false;
                if (busy) return;
                busy = true;
                lastMoveAt = Date.now();
                pendingReset = true;
                pos = i + 1;
                setPosition(true);
                syncActive(true);
                clearSettleTimer();
                settleTimer = window.setTimeout(settle, SETTLE_SAFETY_MS);
            });
        });

        setPosition(false);
        syncActive(false);
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.vcarousel').forEach(initVideoCarousel);
    });
})();

(function () {
    // Load + play each non-hero video only while it is on screen, so the
    // browser fetches videos one at a time as the user scrolls down instead
    // of downloading every video at once on page load. The first project's
    // video keeps its native autoplay so the top of the page is lively.
    var vids = document.querySelectorAll('video.lazy-video');
    if (!vids.length) return;

    // A clip can show its poster frame while it buffers. If the markup also has
    // a `.video-loading` note next to it, keep that note up until the video can
    // play (and bring it back if playback stalls), so the slot never looks empty.
    function bindLoadingNote(v) {
        var note = v.parentElement ? v.parentElement.querySelector('.video-loading') : null;
        if (!note) return;
        var show = function () { if (v.readyState < 3) note.hidden = false; };
        var hide = function () { note.hidden = true; };
        ['loadstart', 'waiting', 'stalled'].forEach(function (t) { v.addEventListener(t, show); });
        ['canplay', 'playing', 'error'].forEach(function (t) { v.addEventListener(t, hide); });
        if (v.readyState >= 3) hide();
    }

    vids.forEach(bindLoadingNote);

    if (!('IntersectionObserver' in window)) {
        vids.forEach(function (v) { v.preload = 'auto'; v.play().catch(function () {}); });
        return;
    }
    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            var v = e.target;
            if (e.isIntersecting) {
                if (v.preload === 'none') v.preload = 'auto';
                v.play().catch(function () {});
            } else {
                v.pause();
            }
        });
    }, { threshold: 0.25 });
    vids.forEach(function (v) { io.observe(v); });
})();
