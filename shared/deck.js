/* ===========================================
   DECK CONTROLLER — vanilla SPA
   - setupOnce(): keyboard, touch, image modal, ambient fx, router (run 1x)
   - mountPage(): per-page setup (intro reveal, image clicks, sub-nav, tilt)
     re-runs after each router navigation
   - Router: intercepts internal .html links, fetches, swaps slide sections,
     uses View Transitions API when available for cross-fade
   =========================================== */
(function () {
    'use strict';

    // ---------- Module state ----------
    let currentSlides = [];   // mutated on every page mount
    let modal = null;         // { open, close, isOpen }
    let observer = null;      // shared intersection observer

    // ==========================================================
    // ONE-TIME SETUP (runs at first DOMContentLoaded only)
    // ==========================================================
    function setupOnce() {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);

        modal = setupImageModal();          // creates modal element, wires its close handlers
        setupKeyboardNav();
        setupTouchNav();
        setupProgressBar();
        setupRouter();
        try { setupAmbientFx(); } catch (e) { console.warn('[deck.js] ambient fx:', e); }
        try { setupCatMascot(); } catch (e) { console.warn('[deck.js] cat mascot:', e); }

        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: [0, 0.5, 1] });

        console.log('[deck.js] v13 light theme + cat mascot 🐈‍⬛');
    }

    // ==========================================================
    // PER-PAGE MOUNT (runs on initial load AND after every navigation)
    // ==========================================================
    function mountPage() {
        currentSlides = Array.from(document.querySelectorAll('.slide'));

        // Tag body with current page name so CSS view-transition-name
        // selectors (body[data-page="hook"] .section-label etc.) can hook on.
        // Examples: /hook.html → "hook", /redmine-list.html → "redmine-list",
        //           / → "index", /index.html → "index".
        const path = location.pathname;
        let pageName = path.split('/').pop().replace(/\.html$/i, '');
        if (!pageName) pageName = 'index';
        document.body.dataset.page = pageName;

        console.log('[deck.js] mountPage · ' + currentSlides.length + ' slide(s) · page="' + pageName + '"');

        // 1. Reveal intro animation on first slide ASAP
        if (currentSlides.length > 0) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => currentSlides[0].classList.add('visible'));
            });
        }

        // 2. Observe sub-slides for scroll-triggered reveal
        currentSlides.forEach(s => observer.observe(s));

        // 3. Wire image clicks (modal trigger)
        wireImageClicks();

        // 4. Wire any data-modal-image element
        document.querySelectorAll('[data-modal-image]:not([data-modal-bound])').forEach(el => {
            el.dataset.modalBound = 'true';
            el.addEventListener('click', (e) => {
                e.preventDefault();
                modal.open(el.dataset.modalImage, el.dataset.modalAlt || '');
            });
        });

        // 5. 3D tilt on cards (dash-card, part-card)
        try { setupTiltCards(); } catch (e) { console.warn('[deck.js] tilt:', e); }

        // 6. Per-page custom logic (e.g. template.html copy button)
        wireTemplateCopyButton();
    }

    function wireImageClicks() {
        document.querySelectorAll('.slide img:not([data-img-bound])').forEach(img => {
            img.dataset.imgBound = 'true';
            img.style.cursor = 'zoom-in';
            img.addEventListener('click', () => modal.open(img.src, img.alt));
        });
    }

    function wireTemplateCopyButton() {
        const btn = document.getElementById('copyTemplate');
        const code = document.getElementById('templateCode');
        if (!btn || !code || btn.dataset.bound) return;
        btn.dataset.bound = 'true';
        const label = btn.querySelector('.copy-label');
        btn.addEventListener('click', async () => {
            const text = code.textContent;
            try {
                await navigator.clipboard.writeText(text);
            } catch (e) {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed'; ta.style.left = '-9999px';
                document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
            }
            btn.classList.add('copied');
            if (label) label.textContent = 'Đã copy!';
            setTimeout(() => {
                btn.classList.remove('copied');
                if (label) label.textContent = 'Copy template';
            }, 1800);
        });
    }

    // ==========================================================
    // CLIENT-SIDE ROUTER
    // ==========================================================
    function setupRouter() {
        // Intercept link clicks anywhere in the document
        document.addEventListener('click', (e) => {
            // Ignore modifier clicks (open-in-new-tab etc.)
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (e.button !== 0) return;

            const link = e.target.closest('a[href]');
            if (!link) return;
            if (link.target === '_blank') return;
            if (link.hasAttribute('data-modal-image')) return;

            const href = link.getAttribute('href');
            if (!href) return;
            if (href.startsWith('http') || href.startsWith('//')) return;  // external
            if (href.startsWith('#')) return;                              // pure hash
            if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
            if (!/\.html(\?|#|$)/i.test(href)) return;                     // not an HTML page

            e.preventDefault();
            navigate(href);
        });

        // Browser back/forward
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

            // The actual content swap, wrapped for View Transitions
            const swap = () => {
                document.title = newDoc.title;

                // Remove old slide content & page-nav
                document.querySelectorAll('section.slide, nav.page-nav').forEach(el => el.remove());

                // Insert new sections + nav (before #progressBar or fx elements)
                const newSlides = newDoc.querySelectorAll('section.slide');
                const newPageNav = newDoc.querySelector('nav.page-nav');
                const refNode = document.querySelector('.fx-grid, .fx-particle, .fx-frame, .image-modal') || null;

                newSlides.forEach(s => {
                    const clone = document.importNode(s, true);
                    document.body.insertBefore(clone, refNode);
                });
                if (newPageNav) {
                    document.body.insertBefore(document.importNode(newPageNav, true), refNode);
                }

                // Update history (only on user-initiated nav, not popstate)
                if (!opts.fromHistory) {
                    history.pushState({}, '', url);
                }

                window.scrollTo(0, 0);
                mountPage();
            };

            // Use View Transitions API for buttery cross-fade where supported
            if (document.startViewTransition) {
                document.startViewTransition(swap);
            } else {
                // Manual fade fallback
                const slides = document.querySelectorAll('section.slide');
                slides.forEach(s => s.style.transition = 'opacity 0.18s ease');
                slides.forEach(s => s.style.opacity = '0');
                await wait(180);
                swap();
                // mountPage triggers fresh fade-in via .reveal
            }
        } catch (err) {
            console.error('[deck.js] router navigate failed → falling back to full load', err);
            window.location.href = url;
        }
    }

    function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ==========================================================
    // INPUT HANDLERS (one-time)
    // ==========================================================
    function setupKeyboardNav() {
        const onKey = (e) => {
            if (e.target.matches && e.target.matches('input, textarea, [contenteditable]')) return;
            if (modal && modal.isOpen()) {
                if (e.key === 'Escape') { e.preventDefault(); modal.close(); }
                return;
            }
            const slides = currentSlides;
            const curr = getCurrentSlideIndex(slides);

            switch (e.key) {
                case 'ArrowDown': case 'ArrowRight': case 'PageDown': case ' ':
                    if (curr < slides.length - 1) {
                        e.preventDefault();
                        goToSlide(slides[curr + 1]);
                    }
                    break;
                case 'ArrowUp': case 'ArrowLeft': case 'PageUp':
                    if (curr > 0) {
                        e.preventDefault();
                        goToSlide(slides[curr - 1]);
                    }
                    break;
                case 'm': case 'M':
                    e.preventDefault();
                    navigate('menu.html');
                    break;
            }
        };
        document.addEventListener('keydown', onKey);
        window.addEventListener('keydown', onKey);
    }

    function setupTouchNav() {
        let startY = 0;
        document.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
        document.addEventListener('touchend', (e) => {
            const diff = startY - e.changedTouches[0].clientY;
            if (Math.abs(diff) < 60) return;
            const slides = currentSlides;
            const curr = getCurrentSlideIndex(slides);
            if (diff > 0 && curr < slides.length - 1) goToSlide(slides[curr + 1]);
            else if (diff < 0 && curr > 0) goToSlide(slides[curr - 1]);
        }, { passive: true });
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
    // IMAGE MODAL — created once, click wiring re-runs on mount
    // ==========================================================
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
            setTimeout(() => { if (!overlay.classList.contains('open')) img.src = ''; }, 300);
        }
        function isOpen() { return overlay.classList.contains('open'); }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === closeBtn) close();
        });

        return { open, close, isOpen };
    }

    // ==========================================================
    // MÈO ĐEN MASCOT — bottom-left corner, click for Git joke
    // ==========================================================
    function setupCatMascot() {
        const jokes = [
            'Meo~ Đừng `git push --force` lên main đó!',
            'Tao đã `git reset --hard` đời mày 😼',
            '🐾 `git blame` ra tao thì mày mệt đó',
            'Nhớ rebase trước khi mở PR nhé human',
            'Ở dưới gầm bàn có 1 con mèo đang `git stash`',
            'Conflict? Tao bấm `--abort` cho gọn',
            'Mèo đen biết `cherry-pick` từng sợi tóc bạc của mày',
            'main branch là của tao 🐈‍⬛',
            'Tao chỉ pull khi nào tao muốn',
            'Commit message của tao luôn là "meo"',
        ];

        const cat = document.createElement('button');
        cat.className = 'cat-mascot';
        cat.setAttribute('aria-label', 'Mèo đen mascot');
        cat.textContent = '🐈‍⬛';

        const tip = document.createElement('div');
        tip.className = 'cat-tooltip';
        tip.setAttribute('aria-hidden', 'true');

        document.body.appendChild(cat);
        document.body.appendChild(tip);

        let hideTimer = 0;
        cat.addEventListener('click', () => {
            const joke = jokes[Math.floor(Math.random() * jokes.length)];
            tip.textContent = joke;
            tip.classList.add('show');
            cat.classList.add('angry');
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                tip.classList.remove('show');
                cat.classList.remove('angry');
            }, 3500);
        });
    }

    // ==========================================================
    // AMBIENT FX — injected once, persist across navigations
    // ==========================================================
    function setupAmbientFx() {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) return;

        const frag = document.createDocumentFragment();

        const grid = document.createElement('div');
        grid.className = 'fx-grid';
        grid.setAttribute('aria-hidden', 'true');
        frag.appendChild(grid);

        for (let i = 0; i < 6; i++) {
            const p = document.createElement('div');
            let cls = 'fx-particle';
            if (i % 2) cls += ' cyan';
            if (i > 3) cls += ' tiny';
            p.className = cls;
            p.setAttribute('aria-hidden', 'true');
            p.style.left = (Math.random() * 95 + 2) + '%';
            p.style.animationDelay = (-Math.random() * 30) + 's';
            p.style.animationDuration = (22 + Math.random() * 18) + 's';
            frag.appendChild(p);
        }

        ['tl', 'tr', 'bl', 'br'].forEach(pos => {
            const f = document.createElement('div');
            f.className = 'fx-frame ' + pos;
            f.setAttribute('aria-hidden', 'true');
            frag.appendChild(f);
        });

        document.body.appendChild(frag);
    }

    // ==========================================================
    // 3D TILT — runs on every mount (new cards each page)
    // ==========================================================
    function setupTiltCards() {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) return;
        const MAX_TILT = 9;
        const LIFT = 8;

        document.querySelectorAll('.dash-card:not([data-tilt-bound]), .part-card:not([data-tilt-bound])').forEach(card => {
            card.dataset.tiltBound = 'true';
            let rafId = 0;
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left, y = e.clientY - rect.top;
                const cx = rect.width / 2, cy = rect.height / 2;
                const ry = ((x - cx) / cx) * MAX_TILT;
                const rx = -((y - cy) / cy) * MAX_TILT;
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    card.style.transform =
                        'perspective(1000px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-' + LIFT + 'px)';
                    card.style.setProperty('--mx', (x / rect.width * 100).toFixed(1) + '%');
                    card.style.setProperty('--my', (y / rect.height * 100).toFixed(1) + '%');
                });
            });
            card.addEventListener('mouseleave', () => {
                if (rafId) cancelAnimationFrame(rafId);
                card.style.transform = '';
                card.style.removeProperty('--mx');
                card.style.removeProperty('--my');
            });
        });
    }

    // ==========================================================
    // UTILITIES
    // ==========================================================
    function goToSlide(slideEl) {
        if (!slideEl) return;
        try {
            slideEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
            window.scrollTo({ top: slideEl.offsetTop, behavior: 'smooth' });
        }
    }

    function getCurrentSlideIndex(slides) {
        if (!slides.length) return -1;
        const center = window.scrollY + window.innerHeight / 2;
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < slides.length; i++) {
            const sc = slides[i].offsetTop + slides[i].offsetHeight / 2;
            const d = Math.abs(sc - center);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        return bestIdx;
    }

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
})();
