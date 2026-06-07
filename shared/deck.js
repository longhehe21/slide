/* ===========================================
   GIT WORKFLOW DECK — vanilla SPA with GitHub vibes
   - setupOnce: keyboard, image modal, SPA router (run 1x)
   - mountPage: per-page reveal animation + image click wiring
   - Router: intercept .html links → fetch → swap content → View Transitions
   =========================================== */
(function () {
    'use strict';

    let currentSlides = [];
    let modal = null;
    let observer = null;

    // ==========================================================
    // BOOT
    // ==========================================================
    function boot() {
        setupOnce();
        mountPage();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // ==========================================================
    // ONE-TIME (run on first page load only)
    // ==========================================================
    function setupOnce() {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);

        modal = setupImageModal();
        setupKeyboardNav();
        setupProgressBar();
        setupRouter();

        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: [0, 0.4, 1] });

        console.log('[deck.js] v14 GitHub vibe loaded');
    }

    // ==========================================================
    // PER-PAGE MOUNT
    // ==========================================================
    function mountPage() {
        currentSlides = Array.from(document.querySelectorAll('.slide'));

        // Body data-page for CSS view-transition-name selectors
        const path = location.pathname;
        let pageName = path.split('/').pop().replace(/\.html$/i, '');
        if (!pageName) pageName = 'index';
        document.body.dataset.page = pageName;

        // Reveal animation on first slide
        if (currentSlides.length > 0) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => currentSlides[0].classList.add('visible'));
            });
        }

        // Observe any additional sub-slides
        currentSlides.forEach(s => observer.observe(s));

        // Wire image clicks → modal
        document.querySelectorAll('.slide img:not([data-img-bound])').forEach(img => {
            img.dataset.imgBound = 'true';
            img.style.cursor = 'zoom-in';
            img.addEventListener('click', () => modal.open(img.src, img.alt));
        });

        document.querySelectorAll('[data-modal-image]:not([data-modal-bound])').forEach(el => {
            el.dataset.modalBound = 'true';
            el.addEventListener('click', (e) => {
                e.preventDefault();
                modal.open(el.dataset.modalImage, el.dataset.modalAlt || '');
            });
        });
    }

    // ==========================================================
    // CLIENT-SIDE ROUTER (intercepts internal .html links)
    // ==========================================================
    function setupRouter() {
        document.addEventListener('click', (e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (e.button !== 0) return;

            const link = e.target.closest('a[href]');
            if (!link) return;
            if (link.target === '_blank') return;
            if (link.hasAttribute('data-modal-image')) return;

            const href = link.getAttribute('href');
            if (!href) return;
            if (href.startsWith('http') || href.startsWith('//')) return;
            if (href.startsWith('#')) return;
            if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
            if (!/\.html(\?|#|$)/i.test(href)) return;

            e.preventDefault();
            navigate(href);
        });

        window.addEventListener('popstate', () => {
            navigate(location.pathname + location.search, { fromHistory: true });
        });
    }

    async function navigate(url, opts) {
        opts = opts || {};
        try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const html = await res.text();
            const newDoc = new DOMParser().parseFromString(html, 'text/html');

            const swap = () => {
                document.title = newDoc.title;

                // Remove old slide content + nav (keep .gh-topbar + .progress-bar etc.)
                document.querySelectorAll('section.slide, nav.page-nav').forEach(el => el.remove());

                const newSlides = newDoc.querySelectorAll('section.slide');
                const newPageNav = newDoc.querySelector('nav.page-nav');

                // Insert just before image-modal (keeps element order sane)
                const ref = document.querySelector('.image-modal') || null;
                newSlides.forEach(s => {
                    document.body.insertBefore(document.importNode(s, true), ref);
                });
                if (newPageNav) {
                    document.body.insertBefore(document.importNode(newPageNav, true), ref);
                }

                if (!opts.fromHistory) history.pushState({}, '', url);
                window.scrollTo(0, 0);
                mountPage();
            };

            if (document.startViewTransition) {
                document.startViewTransition(swap);
            } else {
                swap();
            }
        } catch (err) {
            console.error('[deck.js] router fallback to full load:', err);
            window.location.href = url;
        }
    }

    // ==========================================================
    // KEYBOARD: M → menu, Esc → close modal
    // ==========================================================
    function setupKeyboardNav() {
        document.addEventListener('keydown', (e) => {
            if (e.target.matches && e.target.matches('input, textarea, [contenteditable]')) return;
            if (modal && modal.isOpen()) {
                if (e.key === 'Escape') { e.preventDefault(); modal.close(); }
                return;
            }
            if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                navigate('menu.html');
            }
        });
    }

    function setupProgressBar() {
        const update = () => {
            const bar = document.getElementById('progressBar');
            if (!bar) return;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const pct = max > 0 ? (window.scrollY / max) * 100 : 100;
            bar.style.width = pct + '%';
        };
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    // ==========================================================
    // IMAGE MODAL (lightbox)
    // ==========================================================
    function setupImageModal() {
        const overlay = document.createElement('div');
        overlay.className = 'image-modal';
        overlay.innerHTML =
            '<button class="modal-close" aria-label="Close (Esc)">×</button>' +
            '<img class="modal-image" alt="" />';
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
            setTimeout(() => { if (!overlay.classList.contains('open')) img.src = ''; }, 300);
        }
        function isOpen() { return overlay.classList.contains('open'); }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === closeBtn) close();
        });

        return { open, close, isOpen };
    }
})();
