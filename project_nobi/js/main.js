/* ═══════════════════════════════════════════════════════════════════════════
   NOBI Bakery — 2026 · motion
   Lenis (inertial scroll) + GSAP ScrollTrigger (scroll zoom, line draw, reveals)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const doc = document;
  const body = doc.body;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  body.classList.add('js');

  /* ─────────────────────────────────────────────────────────────────────
     TEXT SPLITTING — words and characters, no paid plugin needed
     ───────────────────────────────────────────────────────────────────── */
  function splitWords(scope) {
    const out = [];
    scope.querySelectorAll('.hero__line').forEach((line) => {
      const words = line.textContent.trim().split(/\s+/);
      line.textContent = '';
      words.forEach((w, i) => {
        const span = doc.createElement('span');
        span.className = 'word';
        span.textContent = w;
        line.appendChild(span);
        if (i < words.length - 1) line.appendChild(doc.createTextNode(' '));
        out.push(span);
      });
    });
    return out;
  }

  function splitChars(el) {
    const text = el.textContent;
    el.textContent = '';
    return Array.from(text).map((ch) => {
      const span = doc.createElement('span');
      span.className = 'char';
      span.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(span);
      return span;
    });
  }

  // Headings split twice — words keep their integrity so a narrow viewport can
  // still only break between words, and the characters inside are what animate.
  function splitLineChars(el) {
    const words = el.textContent.trim().split(/\s+/);
    const chars = [];
    el.textContent = '';
    words.forEach((w, i) => {
      const word = doc.createElement('span');
      word.className = 'word';
      Array.from(w).forEach((ch) => {
        const span = doc.createElement('span');
        span.className = 'char';
        span.textContent = ch;
        word.appendChild(span);
        chars.push(span);
      });
      el.appendChild(word);
      if (i < words.length - 1) el.appendChild(doc.createTextNode(' '));
    });
    return chars;
  }

  /* ─────────────────────────────────────────────────────────────────────
     1 · SMOOTH INERTIAL SCROLL
     ───────────────────────────────────────────────────────────────────── */
  let lenis = null;

  function initSmoothScroll() {
    if (REDUCED || typeof Lenis === 'undefined') return;

    lenis = new Lenis({
      duration: 1.25,          // weighted, unhurried
      lerp: null,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.6,
      syncTouch: false,
      autoRaf: false
    });

    // Drive Lenis from the GSAP ticker so scroll + tween share one clock.
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    doc.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (!id || id === '#') return;
        const target = doc.querySelector(id);
        if (!target) return;
        e.preventDefault();
        closeMenu();
        lenis.scrollTo(target, { offset: 0, duration: 1.6 });
      });
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     2 · HERO — sequential video loop with 1s crossfades, opening on clip 2
     ───────────────────────────────────────────────────────────────────── */
  const FIRST_CLIP = 1;              // 0-based: the loop opens on footage 2

  function initHeroVideo() {
    const videos = Array.from(doc.querySelectorAll('.hero__video'));
    if (!videos.length) return;

    const FADE = 1.0;                // seconds of crossfade
    let current = Math.min(FIRST_CLIP, videos.length - 1);
    let switching = false;
    let inView = true;

    videos.forEach((v, i) => {
      v.muted = true;
      v.loop = false;
      v.playsInline = true;
      // Only the opening clip is fetched up front; the rest are pulled in one
      // ahead of time, so the hero costs ~0.7MB on load instead of ~3.7MB.
      v.preload = i === current ? 'auto' : 'metadata';
      v.style.opacity = i === current ? '1' : '0';
      v.classList.toggle('is-active', i === current);
      // A stalled or missing file must not stop the chain.
      v.addEventListener('error', () => { v.dataset.broken = '1'; });
    });

    function warm(i) {
      const v = videos[i];
      if (!v || v.preload === 'auto') return;
      v.preload = 'auto';
      v.load();
    }

    function nextIndex(from) {
      for (let step = 1; step <= videos.length; step++) {
        const i = (from + step) % videos.length;
        if (!videos[i].dataset.broken) return i;
      }
      return from;
    }

    function safePlay(v) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }

    function crossfadeTo(nextI) {
      if (switching || nextI === current) return;
      switching = true;

      const from = videos[current];
      const to = videos[nextI];
      warm(nextIndex(nextI));          // stay one clip ahead

      try { to.currentTime = 0; } catch (e) { /* metadata not ready yet */ }
      safePlay(to);

      gsap.to(to, { opacity: 1, duration: FADE, ease: 'none' });
      gsap.to(from, {
        opacity: 0,
        duration: FADE,
        ease: 'none',
        onComplete() {
          from.pause();
          try { from.currentTime = 0; } catch (e) {}
          from.classList.remove('is-active');
          to.classList.add('is-active');
          current = nextI;
          switching = false;
        }
      });
    }

    // rAF watcher — timeupdate fires too rarely to land a 1s crossfade cleanly.
    function watch() {
      if (inView && !switching) {
        const v = videos[current];
        const d = v.duration;
        if (isFinite(d) && d > 0 && d - v.currentTime <= FADE) {
          crossfadeTo(nextIndex(current));
        }
      }
    }
    gsap.ticker.add(watch);

    videos.forEach((v, i) => {
      v.addEventListener('ended', () => {
        if (i === current && !switching) crossfadeTo(nextIndex(i));
      });
    });

    if (REDUCED) {
      // Hold a single still frame rather than looping motion.
      videos[current].addEventListener('loadeddata', () => {
        try { videos[current].currentTime = 0.1; } catch (e) {}
      });
      gsap.ticker.remove(watch);
      return;
    }

    safePlay(videos[current]);
    warm(nextIndex(current));

    const hero = doc.getElementById('hero');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        if (inView) safePlay(videos[current]);
        else videos.forEach((v) => v.pause());
      }, { threshold: 0.01 }).observe(hero);
    }

    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) videos.forEach((v) => v.pause());
      else if (inView) safePlay(videos[current]);
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     3 · SCROLL ZOOM
     Each photograph enters oversized and eases back to its natural crop over
     its whole journey across the viewport — entering at the bottom, resolving
     as it leaves the top. It zooms out on the way down and, because the tween
     is scrubbed, straight back in on the way up; it never parks.
     ───────────────────────────────────────────────────────────────────── */
  function initScrollZoom() {
    doc.querySelectorAll('img[data-parallax]').forEach((img) => {
      const amount = parseFloat(img.dataset.parallax) || 8;
      const wrap = img.closest('[data-parallax-wrap]') || img.parentElement;
      const from = 1 + (amount * 1.4 + 10) / 100;   // 5 → 1.17 … 10 → 1.24

      gsap.set(img, { transformOrigin: '50% 50%', force3D: true });
      gsap.fromTo(img,
        { scale: from },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: wrap,
            start: 'top bottom',
            end: 'bottom top',      // runs until the photo is out of sight
            scrub: true,
            invalidateOnRefresh: true
          }
        }
      );
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     4 · ROW B DRIFT — items 4 and 5 slide a few pixels left→right
     ───────────────────────────────────────────────────────────────────── */
  function initRowDrift() {
    const row = doc.querySelector('.collection__row--b');
    if (!row) return;
    gsap.fromTo(row.querySelectorAll('.item'),
      { x: -20 },
      {
        x: 20,
        ease: 'none',
        scrollTrigger: {
          trigger: row,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true
        }
      }
    );
  }

  /* ─────────────────────────────────────────────────────────────────────
     5 · HERO SCROLL COMPOSITION
     Everything dissolves where it stands rather than sliding away. The
     footage goes first and quickly — it has cleared by roughly a third of the
     hero's travel — then the Japanese, then the button. Only the headline
     keeps its opacity, and it and the button travel up faster than the page.

     Durations below are fractions of the scrubbed timeline, not seconds: a
     tween of duration 0.3 on a 1.0 timeline finishes 30% of the way down.
     ───────────────────────────────────────────────────────────────────── */
  function initHeroScroll() {
    const hero = doc.getElementById('hero');
    if (!hero) return;

    const lift = -Math.round(Math.min(300, Math.max(120, window.innerWidth * 0.146)));

    gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true
      }
    })
      .fromTo('.hero__videos',    { opacity: 1 }, { opacity: 0, duration: 0.30, ease: 'none' }, 0)
      .fromTo('.hero__scrim',     { opacity: 1 }, { opacity: 0, duration: 0.34, ease: 'none' }, 0)
      .fromTo('.hero__vert-text', { opacity: 1 }, { opacity: 0, duration: 0.55, ease: 'none' }, 0)
      .fromTo('.hero__tagline',   { opacity: 1 }, { opacity: 0, duration: 0.55, ease: 'none' }, 0)
      .fromTo('.hero__cta',       { opacity: 1 }, { opacity: 0, duration: 0.45, ease: 'none' }, 0)
      .to(['.hero__title', '.hero__cta'], { y: lift, duration: 1, ease: 'none' }, 0);
  }

  /* ─────────────────────────────────────────────────────────────────────
     Reveal helper.
     gsap.set() establishes a numeric start state up front, and the tween
     runs with immediateRender:false — so a later ScrollTrigger.refresh()
     (fonts loading, resize) can never rewind something already played.
     ───────────────────────────────────────────────────────────────────── */
  function reveal(target, from, to, st) {
    gsap.set(target, from);
    gsap.to(target, Object.assign({}, to, {
      immediateRender: false,
      scrollTrigger: Object.assign({ once: true }, st)
    }));
  }

  const inHero = (el) => !!el.closest('.hero, .hero__vert');

  /* ─────────────────────────────────────────────────────────────────────
     6 · COLLECTION ITEM HAIRLINES
     The rule runs the height of the photo plus a proportional tail, and the
     vertical Japanese label hangs off its end — both derived from the
     rendered photo so they survive any resize.
     ───────────────────────────────────────────────────────────────────── */
  function sizeItemRules() {
    const w = Math.min(1920, Math.max(402, window.innerWidth));
    const f = 0.692 + (0.3125 - 0.692) * ((w - 402) / (1920 - 402));
    doc.querySelectorAll('.item').forEach((item) => {
      const media = item.querySelector('.media');
      if (!media) return;
      const h = media.offsetHeight;
      item.style.setProperty('--rule-h', Math.round(h + h * f) + 'px');
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     7 · LINE DRAW — horizontals left→right, verticals top→bottom
     ───────────────────────────────────────────────────────────────────── */
  function initLines() {
    doc.querySelectorAll('.line--h, .rule').forEach((el) => {
      if (inHero(el) || el.classList.contains('nav__rule')) return;  // intro owns these
      reveal(el, { scaleX: 0 },
        { scaleX: 1, duration: 1.35, ease: 'power2.out' },
        { trigger: el, start: 'top 97%' });
    });

    doc.querySelectorAll('.line--v').forEach((el) => {
      if (inHero(el)) return;
      reveal(el, { scaleY: 0 },
        { scaleY: 1, duration: 1.5, ease: 'power2.out' },
        { trigger: el, start: 'top 94%' });
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     8 · REVEALS
     ───────────────────────────────────────────────────────────────────── */
  function initReveals() {
    // section headings — the letters rise out of the line's own mask, one
    // after another on a tight stagger
    doc.querySelectorAll('.line-mask').forEach((mask) => {
      const inner = mask.querySelector('.line-inner');
      if (!inner || inHero(mask)) return;
      const group = mask.parentElement;
      const order = Array.prototype.indexOf.call(group.querySelectorAll('.line-mask'), mask);
      const chars = splitLineChars(inner);
      gsap.set(inner, { visibility: 'visible' });
      reveal(chars,
        { yPercent: 125 },
        {
          yPercent: 0, duration: 0.62, ease: 'power3.out',
          stagger: 0.019, delay: order * 0.13
        },
        { trigger: group, start: 'top 88%' });
    });

    // the five product blocks — label, name and copy drift in from the left
    doc.querySelectorAll('[data-reveal-left]').forEach((el) => {
      const group = el.parentElement;
      const order = Array.prototype.indexOf.call(group.querySelectorAll('[data-reveal-left]'), el);
      reveal(el,
        { opacity: 0, x: -36 },
        { opacity: 1, x: 0, duration: 1.15, ease: 'power3.out', delay: order * 0.13 },
        { trigger: group, start: 'top 88%' });
    });

    // everything else fades up
    doc.querySelectorAll('[data-reveal]').forEach((el) => {
      if (inHero(el)) return;
      reveal(el, { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' },
        { trigger: el, start: 'top 93%' });
    });

    // vertical Japanese labels — one character at a time, from the top down
    doc.querySelectorAll('.item__jp').forEach((el) => {
      const chars = splitChars(el);
      gsap.set(el, { opacity: 1 });
      reveal(chars,
        { opacity: 0, y: -16 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out', stagger: 0.075 },
        { trigger: el, start: 'top 95%' });
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     9 · NAV — two heights, plus a backdrop once the hero is behind us
     ───────────────────────────────────────────────────────────────────── */
  function initNav() {
    const nav = doc.getElementById('nav');
    if (!nav) return;

    // mode 1 at the top of the page, mode 2 the moment we start scrolling
    let compact = false;
    function onScroll() {
      const want = window.scrollY > 40;
      if (want !== compact) {
        compact = want;
        nav.classList.toggle('is-compact', compact);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const hero = doc.getElementById('hero');
    if (hero && typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.create({
        trigger: hero,
        start: 'bottom top+=' + nav.offsetHeight,
        onEnter: () => nav.classList.add('is-stuck'),
        onLeaveBack: () => nav.classList.remove('is-stuck')
      });
    }
  }

  const burger = doc.querySelector('.nav__burger');
  const menu = doc.getElementById('mobile-menu');

  function openMenu() {
    if (!menu) return;
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    burger.setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop();
  }
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
    setTimeout(() => { menu.hidden = true; }, 500);
  }
  if (burger) {
    burger.addEventListener('click', () => {
      burger.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu();
    });
  }
  if (menu) menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', closeMenu));
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  /* ─────────────────────────────────────────────────────────────────────
     10 · TESTIMONIALS
     The avatars are buttons and nothing else drives them — no timer, no
     auto-advance. They hold their positions in the strip; the only thing that
     moves is the name/role block, which slots in beside whoever is active.
     ───────────────────────────────────────────────────────────────────── */
  function initTestimonials() {
    const quotes = Array.from(doc.querySelectorAll('.testi__quote'));
    const names = Array.from(doc.querySelectorAll('.testi__name'));
    const roles = Array.from(doc.querySelectorAll('.testi__role'));
    const avatars = Array.from(doc.querySelectorAll('.avatar'));
    if (quotes.length < 2) return;

    const who = doc.querySelector('.testi__who');
    const n = quotes.length;
    let index = 0;

    function setActive(list, i) {
      list.forEach((el, k) => el.classList.toggle('is-active', k === i));
    }

    // Avatars keep their DOM order (even slots); the name block takes the odd
    // slot immediately after the active one.
    function layout() {
      avatars.forEach((a) => { a.style.order = Number(a.dataset.testi) * 2; });
      if (who) who.style.order = index * 2 + 1;
    }

    function show(i) {
      index = ((i % n) + n) % n;

      setActive(quotes, index);
      setActive(names, index);
      setActive(roles, index);

      avatars.forEach((a) => {
        const isActive = Number(a.dataset.testi) === index;
        a.classList.toggle('is-active', isActive);
        a.classList.toggle('avatar--lg', isActive);
        a.classList.toggle('avatar--sm', !isActive);
        a.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      layout();
    }

    avatars.forEach((a) => {
      a.addEventListener('click', () => {
        const i = Number(a.dataset.testi);
        if (i !== index) show(i);
      });
    });

    show(0);
  }

  /* ─────────────────────────────────────────────────────────────────────
     11 · HERO INTRO
     Headline fades in word by word · the button and the hairline rise in
     together · then the Japanese runs up out of the line, quickly.
     ───────────────────────────────────────────────────────────────────── */
  function initHeroIntro() {
    const title = doc.querySelector('.hero__title');
    const words = title ? splitWords(title) : [];
    const jp = doc.querySelector('.hero__vert-text');
    const jpChars = jp ? splitChars(jp) : [];
    const btn = doc.querySelector('.hero__cta .btn');

    gsap.set(words, { opacity: 0 });
    gsap.set('.hero__cta', { opacity: 1 });
    gsap.set(btn, { opacity: 0, y: 34 });
    gsap.set('.hero__vert-line', { scaleY: 1, opacity: 0, y: 34 });
    gsap.set('.hero__tagline .line', { scaleX: 1, opacity: 0, y: 20 });
    gsap.set(jp, { opacity: 1 });
    gsap.set(jpChars, { opacity: 0, y: 20 });

    const tl = gsap.timeline({ delay: 0.2 });
    tl
      .to('.nav__rule', { scaleX: 1, duration: 1.6, ease: 'power2.out' }, 0)
      // word by word
      .to(words, { opacity: 1, duration: 0.9, ease: 'power2.out', stagger: 0.085 }, 0.15)
      // button and hairline rise in together
      .to([btn, '.hero__vert-line'], {
        opacity: 1, y: 0, duration: 1.1, ease: 'power3.out'
      }, 0.75)
      .to('.hero__tagline .line', { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 0.75)
      // then the Japanese climbs out of the line, bottom character first
      .to(jpChars, {
        opacity: 1, y: 0, duration: 0.4, ease: 'power2.out',
        stagger: { each: 0.055, from: 'end' }
      }, 1.35);

    return tl;
  }

  /* ─────────────────────────────────────────────────────────────────────
     12 · BOOT
     ───────────────────────────────────────────────────────────────────── */
  function boot() {
    if (typeof gsap === 'undefined') {
      // No GSAP → show everything rather than an empty page.
      body.classList.remove('js', 'is-loading');
      initHeroVideo();
      initTestimonials();
      initNav();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    sizeItemRules();
    initSmoothScroll();
    initHeroVideo();
    initTestimonials();
    initNav();

    let rz;
    window.addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(() => { sizeItemRules(); ScrollTrigger.refresh(); }, 180);
    });

    if (REDUCED) {
      body.classList.remove('is-loading');
      return;
    }

    initScrollZoom();
    initRowDrift();
    initHeroIntro();      // sets the hero's start states…
    initHeroScroll();     // …which the scrubbed timeline then reads as its "from"
    initLines();
    initReveals();

    body.classList.remove('is-loading');

    // Fonts change metrics — recalculate once they land.
    if (doc.fonts && doc.fonts.ready) {
      doc.fonts.ready.then(() => { sizeItemRules(); ScrollTrigger.refresh(); });
    }
    window.addEventListener('load', () => { sizeItemRules(); ScrollTrigger.refresh(); });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
