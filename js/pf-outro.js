/* ============================================================================
   THE COVER — show and hide
   ----------------------------------------------------------------------------
   Not scroll-driven. The slide is a CSS transition; this file only decides WHEN
   it runs. Amanda: "WITHOUT SCROLL-DRIVEN. So, just immediate effect, intro and
   outro."

   Intro: a deliberate downward gesture once the page is at its own maximum
   scroll. Deltas are accumulated and a threshold must be crossed, because the
   tail of a momentum fling would otherwise trigger it the instant the page
   lands at the bottom — which reads as the page ambushing you.

   Outro: a deliberate upward gesture while the sheet is scrolled to its own top.
   Escape also dismisses.

   ---------------------------------------------------------------------------
   THE WHEEL LISTENER IS ON WINDOW, IN THE CAPTURE PHASE, AND THAT IS THE WHOLE
   TRICK. These four pages run four different scroll engines — aspire and
   identity hijack the wheel themselves, kayn and nobi use Lenis — and every one
   of them listens on `window` in the BUBBLE phase. A capture listener on window
   is the first thing in the propagation path, so while the sheet is up we can
   stopPropagation() and none of them ever sees the event. That is what lets the
   sheet scroll: previously the host engine swallowed the wheel and scrolled the
   page underneath instead, so the sheet sat there frozen and the footer was
   unreachable.

   We stop propagation but do NOT preventDefault: the browser's own default
   action then scrolls the sheet, with real momentum and real smoothing, which
   is far better than anything reimplemented here. overscroll-behavior: contain
   stops that scroll chaining back to the page once the sheet bottoms out.

   ES5 on purpose: these pages ship ES5-only scripts and there is no transpiler.
   ========================================================================== */
(function (window, document) {
  "use strict";

  var root = document.querySelector("[data-pf-outro]");
  if (!root) return;

  var THRESHOLD = 120;   /* px of gesture travel before the state flips        */
  var WARM = 700;        /* ms an accumulation stays warm before it resets     */
  /* Generous on purpose. The host engines ease towards the bottom over many
     frames, and reveal animations can still be settling the page's height when
     the reader gets there, so "exactly at the last pixel" is a test the page
     can fail for a moment at a time. 24px of tolerance costs nothing and makes
     the trigger fire when the reader believes they are at the bottom. */
  var BOTTOM_SLOP = 24;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var wide = window.matchMedia("(min-width: 900px)");

  var live = false;
  var shown = false;
  var accum = 0;
  var accumAt = 0;
  var touchY = 0;
  var lockedY = 0;

  function atBottom() {
    var doc = document.documentElement;
    return window.innerHeight + window.scrollY >= doc.scrollHeight - BOTTOM_SLOP;
  }

  /* ---- host scroll lock ----------------------------------------------------
     Removing the scrollbar narrows the viewport by its own width, which would
     shift the page underneath — and the dock, which floats above the sheet.
     Replacing it with an equal padding keeps every box exactly where it was. */
  function lockHost() {
    var doc = document.documentElement;
    lockedY = window.scrollY;
    var bar = window.innerWidth - doc.clientWidth;
    if (bar > 0) {
      doc.style.paddingRight = bar + "px";
      /* The dock is fixed to the viewport, which the padding cannot reach.
         pf-outro.css hands it this figure as a margin instead. */
      doc.style.setProperty("--pf-scrollbar", bar + "px");
    }
    doc.classList.add("pf-outro-open");
  }

  function unlockHost() {
    var doc = document.documentElement;
    doc.classList.remove("pf-outro-open");
    doc.style.paddingRight = "";
    doc.style.removeProperty("--pf-scrollbar");
    /* Some browsers drop the scroll position when the root stops scrolling.
       Put it back, so dismissing the sheet returns the reader to the end of the
       page they left rather than the top of it. */
    if (Math.abs(window.scrollY - lockedY) > 1) {
      window.scrollTo({ top: lockedY, left: 0, behavior: "instant" });
    }
  }

  function show() {
    if (!live || shown) return;
    shown = true;
    accum = 0;
    root.scrollTop = 0;
    lockHost();
    root.classList.add("is-shown");
    root.inert = false;
    /* Focus it so the keyboard scrolls the SHEET rather than the locked page
       behind it. preventScroll because focusing must not jump it anywhere. */
    try { root.focus({ preventScroll: true }); } catch (e) { }
  }

  function hide() {
    if (!live || !shown) return;
    shown = false;
    accum = 0;
    root.classList.remove("is-shown");
    root.inert = true;
    unlockHost();
  }

  /* One accumulator serves both directions: `d` is travel in the direction that
     would change the current state, so a gesture the other way just resets it. */
  function gesture(d) {
    if (!live) return;
    var now = new Date().getTime();
    if (now - accumAt > WARM) accum = 0;
    accumAt = now;

    if (!shown) {
      if (!atBottom() || d <= 0) { accum = 0; return; }
      accum += d;
      if (accum >= THRESHOLD) show();
    } else {
      /* Only dismiss from the sheet's own top, and only on an upward gesture. */
      if (root.scrollTop > 0 || d >= 0) { accum = 0; return; }
      accum -= d;
      if (accum >= THRESHOLD) hide();
    }
  }

  function onWheel(e) {
    /* While the sheet is up it owns the wheel: stop the event before any host
       engine sees it, and let the default action scroll the sheet. */
    if (shown) e.stopPropagation();
    gesture(e.deltaY);
  }

  function onTouchStart(e) {
    if (shown) e.stopPropagation();
    if (e.touches && e.touches.length) touchY = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (shown) e.stopPropagation();
    if (!e.touches || !e.touches.length) return;
    var y = e.touches[0].clientY;
    gesture(touchY - y);   /* finger up = content down = positive, as with wheel */
    touchY = y;
  }

  function onKeyDown(e) {
    if (!shown) return;
    if (e.key === "Escape" || e.key === "Esc") hide();
  }

  function canRun() {
    return !reduced.matches && wide.matches;
  }

  /* capture:true is load-bearing — see the header. passive:false because a
     capture listener that might stopPropagation must not be marked passive. */
  var CAP = { capture: true, passive: false };

  function enable() {
    if (live) return;
    live = true;
    root.classList.add("pf-outro--live");
    /* Commit the parked position BEFORE the transition exists, then arm it a
       frame later. Without this the sheet animates itself off-screen on load:
       .pf-outro--live is what first sets translateX(100%), so with the
       transition already in that rule the browser tweens to it from none. */
    void root.offsetHeight;
    root.classList.add("pf-outro--armed");
    root.inert = true;
    /* Lenis reads this attribute and leaves the element's wheel events alone.
       Belt and braces alongside the capture listener, and free. */
    root.setAttribute("data-lenis-prevent", "");
    root.setAttribute("tabindex", "-1");
    window.addEventListener("wheel", onWheel, CAP);
    window.addEventListener("touchstart", onTouchStart, CAP);
    window.addEventListener("touchmove", onTouchMove, CAP);
    document.addEventListener("keydown", onKeyDown);
  }

  function disable() {
    if (!live) return;
    if (shown) unlockHost();
    live = false;
    shown = false;
    accum = 0;
    window.removeEventListener("wheel", onWheel, CAP);
    window.removeEventListener("touchstart", onTouchStart, CAP);
    window.removeEventListener("touchmove", onTouchMove, CAP);
    document.removeEventListener("keydown", onKeyDown);
    root.classList.remove("pf-outro--live", "pf-outro--armed", "is-shown");
    root.removeAttribute("data-lenis-prevent");
    root.removeAttribute("tabindex");
    /* The flat fallback must never be inert — it is how the section is read
       under reduced motion, on a phone, and with no JS at all. */
    root.inert = false;
  }

  function sync() { if (canRun()) enable(); else disable(); }

  function watch(mq) {
    if (mq.addEventListener) mq.addEventListener("change", sync);
    else if (mq.addListener) mq.addListener(sync);
  }
  watch(reduced);
  watch(wide);
  window.addEventListener("resize", sync);

  sync();

  window.PFOutro = {
    show: show,
    hide: hide,
    get live() { return live; },
    get shown() { return shown; }
  };
})(window, document);
