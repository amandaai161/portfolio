/* ==========================================================================
   Identity — UI behaviours
     · header: hides on scroll down, returns on scroll up or on hover
     · header: the small-screen menu
     · testimonial carousel: arrows, dots, mouse/touch drag
     · counting animation for the numbers section
     · scroll reveals for when the deck is standing down
   ========================================================================== */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function deckLive() {
    var d = window.ID && window.ID.deck;
    return !!(d && d.live());
  }

  /* ---------------------------------------------------------------- header */

  function initNav() {
    var nav = document.getElementById("site-nav");
    if (!nav) return;

    var SHOW_ABOVE = 90;      /* always visible near the top of the page, and
                                 the strip of screen that calls it back      */
    var DELTA = 6;            /* ignore scroll jitter                    */
    var lastY = window.scrollY;
    var pinned = false;       /* pointer is in the top strip             */
    var hidden = false;

    function setHidden(next) {
      if (next === hidden) return;
      hidden = next;
      nav.classList.toggle("is-hidden", hidden);
    }

    function onTick(y) {
      var dy = y - lastY;
      if (Math.abs(dy) < DELTA) return;
      lastY = y;
      if (pinned || y <= SHOW_ABOVE) setHidden(false);
      else setHidden(dy > 0);
    }

    if (window.ID && window.ID.onTick) window.ID.onTick(onTick);
    else window.addEventListener("scroll", function () { onTick(window.scrollY); }, { passive: true });

    function pin() { pinned = true; setHidden(false); }
    function unpin() { pinned = false; }

    nav.addEventListener("mouseenter", pin);
    nav.addEventListener("mouseleave", unpin);
    nav.addEventListener("focusin", pin);
    nav.addEventListener("focusout", unpin);

    /* a mouse that never enters the strip (e.g. jumps in) still counts */
    window.addEventListener("mousemove", function (e) {
      var inStrip = e.clientY <= SHOW_ABOVE;
      if (inStrip !== pinned) {
        pinned = inStrip;
        if (inStrip) setHidden(false);
      }
    }, { passive: true });

    /* ---- small-screen menu ---------------------------------------------- */

    var toggle = nav.querySelector(".nav__toggle");
    var menu = document.getElementById("nav-menu");
    if (!toggle || !menu) return;

    function setMenu(open) {
      nav.classList.toggle("is-open", open);
      document.documentElement.classList.toggle("has-menu", open);
      toggle.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-hidden", String(!open));
      if (open) setHidden(false);
    }

    toggle.addEventListener("click", function () {
      setMenu(!nav.classList.contains("is-open"));
    });
    /* any destination closes it — the links are all in-page */
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); toggle.focus(); }
    });
    window.addEventListener("resize", function () {
      if (nav.classList.contains("is-open") && window.innerWidth >= 900) setMenu(false);
    });
  }

  /* ------------------------------------------------------------- carousel */

  function initCarousel(root) {
    var viewport = root.querySelector(".testi__viewport");
    var track = root.querySelector(".testi__track");
    var cards = Array.prototype.slice.call(root.querySelectorAll(".testi__card"));
    var dots = Array.prototype.slice.call(root.querySelectorAll(".testi__dot"));
    var prev = root.querySelector(".testi__nav--prev");
    var next = root.querySelector(".testi__nav--next");
    if (!track || !cards.length) return;

    var index = 0;
    var dragging = false;
    var moved = 0;
    var startX = 0;
    var startAt = 0;
    var pointerId = null;

    function step() {
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return cards[0].getBoundingClientRect().width + gap;
    }

    function place(offset) {
      track.style.transform = "translate3d(" + (-index * step() + (offset || 0)) + "px,0,0)";
    }

    function render() {
      place(0);
      cards.forEach(function (card, i) {
        card.setAttribute("data-active", String(i === index));
        card.setAttribute("aria-hidden", String(i !== index));
      });
      dots.forEach(function (dot, i) {
        dot.setAttribute("aria-selected", String(i === index));
      });
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === cards.length - 1;
    }

    function go(i) {
      index = Math.max(0, Math.min(cards.length - 1, i));
      render();
    }

    dots.forEach(function (dot, i) { dot.addEventListener("click", function () { go(i); }); });
    if (prev) prev.addEventListener("click", function () { go(index - 1); });
    if (next) next.addEventListener("click", function () { go(index + 1); });

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.stopPropagation(); e.preventDefault(); go(index + 1); }
      if (e.key === "ArrowLeft") { e.stopPropagation(); e.preventDefault(); go(index - 1); }
    });

    /* ---- drag ---------------------------------------------------------- */

    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      moved = 0;
      startX = e.clientX;
      startAt = index;
      pointerId = e.pointerId;
      viewport.classList.add("is-dragging");
      if (viewport.setPointerCapture && pointerId !== undefined) {
        try { viewport.setPointerCapture(pointerId); } catch (err) { /* ignore */ }
      }
    }

    function onMove(e) {
      if (!dragging) return;
      moved = e.clientX - startX;
      var s = step();
      var resisted = moved;
      /* rubber-band at both ends */
      if ((index === 0 && moved > 0) || (index === cards.length - 1 && moved < 0)) {
        resisted = moved * 0.35;
      }
      place(Math.max(-s, Math.min(s, resisted)));
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove("is-dragging");
      var threshold = Math.min(140, step() * 0.15);
      if (moved <= -threshold) go(startAt + 1);
      else if (moved >= threshold) go(startAt - 1);
      else render();
      setTimeout(function () { moved = 0; }, 0);
    }

    if (window.PointerEvent) {
      viewport.addEventListener("pointerdown", onDown);
      viewport.addEventListener("pointermove", onMove);
      viewport.addEventListener("pointerup", onUp);
      viewport.addEventListener("pointercancel", onUp);
    } else {
      viewport.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }

    viewport.addEventListener("dragstart", function (e) { e.preventDefault(); });

    /* click a peeking card to bring it forward (but not at the end of a drag) */
    cards.forEach(function (card, i) {
      card.addEventListener("click", function () {
        if (Math.abs(moved) > 6) return;
        if (i !== index) go(i);
      });
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      var prevTransition = track.style.transition;
      track.style.transition = "none";
      resizeTimer = setTimeout(function () { track.style.transition = prevTransition; }, 200);
      render();
    });

    /* land on the comp's active slide without animating on load */
    var initial = track.style.transition;
    track.style.transition = "none";
    go(1 < cards.length ? 1 : 0);
    void track.offsetWidth;
    track.style.transition = initial;
  }

  /* ------------------------------------------------------------- counters */

  function initCounters() {
    var values = Array.prototype.slice.call(document.querySelectorAll(".stat__value[data-count]"));
    if (!values.length) return;

    var DURATION = 900;

    function format(n) {
      return n.toLocaleString("en-US");
    }

    function run(el) {
      var to = parseFloat(el.getAttribute("data-count"));
      var prefix = el.getAttribute("data-prefix") || "";
      var suffix = el.getAttribute("data-suffix") || "";
      if (reduced) { el.textContent = prefix + format(to) + suffix; return; }
      if (el._raf) cancelAnimationFrame(el._raf);
      var start = performance.now();
      (function frame(now) {
        var t = Math.min(1, (now - start) / DURATION);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = prefix + format(Math.round(to * eased)) + suffix;
        if (t < 1) el._raf = requestAnimationFrame(frame);
      })(start);
    }

    function runAll() { values.forEach(run); }

    var section = document.getElementById("numbers");
    if (!section) { runAll(); return; }

    /* both routes are wired: the deck replays the count every time its slide
       comes back, and the observer covers the stacked layout it stands down to */
    if (window.ID && window.ID.deck) {
      var idx = window.ID.deck.indexOf(section);
      window.ID.deck.onSlide(function (active) {
        if (deckLive() && active === idx) runAll();
      });
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting && !deckLive()) runAll(); });
      }, { threshold: 0.35 }).observe(section);
    } else {
      runAll();
    }
  }

  /* ------------------------------------------------------------- reveals */
  /*  The deck gives each slide its own intro/outro. When it stands down the
      same [data-reveal] elements earn theirs on the way past instead.        */

  function initReveals() {
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    if (!items.length || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("js-reveal");

    if (reduced) {
      items.forEach(function (el) { el.classList.add("is-revealed"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-revealed");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.04 });

    items.forEach(function (el, i) {
      /* siblings arrive in sequence rather than all at once */
      var prev = el.previousElementSibling;
      var n = 0;
      while (prev) { if (prev.hasAttribute("data-reveal")) n++; prev = prev.previousElementSibling; }
      el.style.setProperty("--reveal-delay", Math.min(n, 5) * 70 + "ms");
      io.observe(el);
    });
  }

  function init() {
    initNav();
    var carousel = document.querySelector(".testi");
    if (carousel) initCarousel(carousel);
    initCounters();
    initReveals();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
