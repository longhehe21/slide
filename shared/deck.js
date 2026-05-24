/* ===========================================
   DECK CONTROLLER — multi-file mode
   Each section file loads this script. On DOMContentLoaded:
   - Add `.visible` to all .slide elements → triggers .reveal stagger
   - Listen for prev/next keyboard nav (Arrow keys, PageUp/Down, Space)
   - 'M' key → go to menu.html
   - Within a multi-slide page (e.g. redmine.html), scroll-snap handles
     sub-slide navigation; at page edges, ArrowDown/Up navigates to
     the next/prev page file (via body data-next / data-prev).
   - Progress bar updates with scroll position
   =========================================== */
(function () {
    'use strict';

    function init() {
        const slides = Array.from(document.querySelectorAll('.slide'));
        const progressBar = document.getElementById('progressBar');
        const nextHref = document.body.dataset.next || null;
        const prevHref = document.body.dataset.prev || null;

        // Always trigger intro animation on the FIRST slide as soon as DOM is ready
        // (the first slide is the one in viewport at scrollY=0). For multi-slide
        // pages, subsequent sub-slides are revealed by the intersection observer
        // when the user scrolls down to them — giving each its own fresh animation.
        if (slides.length > 0) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => slides[0].classList.add('visible'));
            });
        }

        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: [0, 0.5, 1] });
        slides.forEach(s => obs.observe(s));

        // ---------- Keyboard navigation ----------
        document.addEventListener('keydown', (e) => {
            // Skip when typing in inputs
            if (e.target.matches('input, textarea, [contenteditable]')) return;

            const scrollY = window.scrollY;
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            const atTop = scrollY < 50;
            const atBottom = scrollY >= maxScroll - 50;

            switch (e.key) {
                case 'ArrowDown':
                case 'ArrowRight':
                case 'PageDown':
                case ' ':
                    e.preventDefault();
                    if (slides.length > 1 && !atBottom) {
                        scrollToNextSlide(slides);
                    } else if (nextHref) {
                        window.location.href = nextHref;
                    }
                    break;
                case 'ArrowUp':
                case 'ArrowLeft':
                case 'PageUp':
                    e.preventDefault();
                    if (slides.length > 1 && !atTop) {
                        scrollToPrevSlide(slides);
                    } else if (prevHref) {
                        window.location.href = prevHref;
                    }
                    break;
                case 'Home':
                    e.preventDefault();
                    window.location.href = 'index.html';
                    break;
                case 'End':
                    e.preventDefault();
                    window.location.href = 'recap.html';
                    break;
                case 'm':
                case 'M':
                    e.preventDefault();
                    window.location.href = 'menu.html';
                    break;
            }
        });

        // ---------- Touch / swipe ----------
        let touchStartY = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        document.addEventListener('touchend', (e) => {
            const diff = touchStartY - e.changedTouches[0].clientY;
            if (Math.abs(diff) < 60) return;
            const scrollY = window.scrollY;
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

            if (diff > 0) {
                // swipe up → next
                if (slides.length > 1 && scrollY < maxScroll - 50) {
                    scrollToNextSlide(slides);
                } else if (nextHref) {
                    window.location.href = nextHref;
                }
            } else {
                // swipe down → prev
                if (slides.length > 1 && scrollY > 50) {
                    scrollToPrevSlide(slides);
                } else if (prevHref) {
                    window.location.href = prevHref;
                }
            }
        }, { passive: true });

        // ---------- Progress bar ----------
        if (progressBar) {
            const update = () => {
                const max = document.documentElement.scrollHeight - window.innerHeight;
                const pct = max > 0 ? (window.scrollY / max) * 100 : 100;
                progressBar.style.width = pct + '%';
            };
            window.addEventListener('scroll', update, { passive: true });
            update();
        }
    }

    function scrollToNextSlide(slides) {
        const y = window.scrollY;
        const next = slides.find(s => s.offsetTop > y + 10);
        if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function scrollToPrevSlide(slides) {
        const y = window.scrollY;
        const prev = [...slides].reverse().find(s => s.offsetTop < y - 10);
        if (prev) prev.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
