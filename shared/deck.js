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

        const modal = setupImageModal();

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
            // Skip when image modal is open — Esc handler closes it, other keys shouldn't navigate slides
            if (modal.isOpen()) {
                if (e.key === 'Escape') { e.preventDefault(); modal.close(); }
                return;
            }

            const curr = getCurrentSlideIndex(slides);

            switch (e.key) {
                /* Within-section nav only. Once at the last/first sub-slide,
                   the key press does nothing — user must click ⌂ Menu to
                   reach other sections. Keeps sections self-contained. */
                case 'ArrowDown':
                case 'ArrowRight':
                case 'PageDown':
                case ' ':
                    e.preventDefault();
                    if (curr < slides.length - 1) {
                        goToSlide(slides[curr + 1]);
                    }
                    break;
                case 'ArrowUp':
                case 'ArrowLeft':
                case 'PageUp':
                    e.preventDefault();
                    if (curr > 0) {
                        goToSlide(slides[curr - 1]);
                    }
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
            const curr = getCurrentSlideIndex(slides);

            if (diff > 0) {
                // swipe up → next sub-slide (within section only)
                if (curr < slides.length - 1) goToSlide(slides[curr + 1]);
            } else {
                // swipe down → prev sub-slide (within section only)
                if (curr > 0) goToSlide(slides[curr - 1]);
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

    /* Inject a single image modal at body level. Every <img> inside .slide
       becomes clickable — opens the modal with that image at full size.
       Close via X button, click on backdrop, or Esc key. */
    function setupImageModal() {
        const overlay = document.createElement('div');
        overlay.className = 'image-modal';
        overlay.innerHTML =
            '<button class="modal-close" aria-label="Đóng (Esc)">×</button>' +
            '<img class="modal-image" alt="" />' +
            '<div class="modal-hint">Bấm bên ngoài hoặc nhấn <kbd>Esc</kbd> để đóng</div>';
        document.body.appendChild(overlay);

        const img = overlay.querySelector('.modal-image');
        const closeBtn = overlay.querySelector('.modal-close');

        function open(src, alt) {
            img.src = src;
            img.alt = alt || '';
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        function close() {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
            // Clear src after fade-out so the next open animates fresh
            setTimeout(() => { if (!overlay.classList.contains('open')) img.src = ''; }, 300);
        }
        function isOpen() { return overlay.classList.contains('open'); }

        // Wire up clicks on all current slide images
        document.querySelectorAll('.slide img').forEach(slideImg => {
            slideImg.style.cursor = 'zoom-in';
            slideImg.addEventListener('click', () => open(slideImg.src, slideImg.alt));
        });

        // Wire up any non-image element with [data-modal-image="path/to.png"]
        // → click opens that image in the modal. Lets buttons trigger the lightbox.
        document.querySelectorAll('[data-modal-image]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                open(el.dataset.modalImage, el.dataset.modalAlt || '');
            });
        });

        // Click backdrop or close button → close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === closeBtn) close();
        });

        return { open, close, isOpen };
    }

    /* Scroll to a slide using explicit offsetTop. window.scrollTo gives a
       deterministic target — scrollIntoView could be intercepted by
       scroll-snap-type:mandatory and skip multiple slides at once. */
    function goToSlide(slideEl) {
        if (!slideEl) return;
        window.scrollTo({
            top: slideEl.offsetTop,
            left: 0,
            behavior: 'smooth'
        });
    }

    /* Return the index of the slide currently filling most of the viewport.
       We use the slide whose center is closest to the viewport center — this
       is robust against:
       - Smooth-scroll animation mid-flight (intermediate scrollY values)
       - Browser quirks where document.scrollHeight is unreliable when body
         has height:100% and children overflow with vh units
       - scroll-snap engaging at half-scrolled positions */
    function getCurrentSlideIndex(slides) {
        if (!slides.length) return -1;
        const viewportCenter = window.scrollY + window.innerHeight / 2;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < slides.length; i++) {
            const slideCenter = slides[i].offsetTop + slides[i].offsetHeight / 2;
            const dist = Math.abs(slideCenter - viewportCenter);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
            }
        }
        return bestIdx;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
