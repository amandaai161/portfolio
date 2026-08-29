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

   Outro: a deliberate upward gesture while the overlay's own scrollTop is 0.
   Escape also dismisses.

   The wheel listener is PASSIVE and never calls preventDefault, so it cannot
   fight the four different scroll engines these pages run (aspire and identity
   hijack the wheel themselves; kayn and nobi use Lenis). preventDefault by
   another listener does not stop delivery to this one.

   ES5 on purpose: these pages ship ES5-only scripts and there is no transpiler.
   ========================================================================== */
(function (window, document) {
  "use strict";

  var root = document.querySelector("[data-pf-outro]");
  if (!root) return;

  var THRESHOLD = 120;   /* px of gesture travel before the state flips */
  var WARM = 600;        /* ms an accumulation stays warm before it resets   */
  var BOTTOM_SLOP = 2;   /* px of rounding tolerance on "at the bottom"      */

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var wide = window.matchMedia("(min-width: 900px)");

  var live = false;
  var shown = false;
  var accum = 0;
  var accumAt = 0;
  var touchY = 0;

  function atBottom() {
    var doc = document.documentElement;
    return window.innerHeight + window.scrollY >= doc.scrollHeight - BOTTOM_SLOP;
  }

  function show() {
    if (!live || shown) return;
    shown = true;
    accum = 0;
    root.scrollTop = 0;
    root.classList.add("is-shown");
    root.inert = false;
  }

  function hide() {
    if (!live || !shown) return;
    shown = false;
    accum = 0;
    root.classList.remove("is-shown");
    root.inert = true;
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
      if (root.scrollTop > 0 || d >= 0) { accum = 0; return; }
      accum -= d;
      if (accum >= THRESHOLD) hide();
    }
  }

  function onWheel(e) { gesture(e.deltaY); }

  function onTouchStart(e) {
    if (e.touches && e.touches.length) touchY = e.touches[0].clientY;
  }
  function onTouchMove(e) {
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
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("keydown", onKeyDown);
  }

  function disable() {
    if (!live) return;
    live = false;
    shown = false;
    accum = 0;
    window.removeEventListener("wheel", onWheel, { passive: true });
    window.removeEventListener("touchstart", onTouchStart, { passive: true });
    window.removeEventListener("touchmove", onTouchMove, { passive: true });
    document.removeEventListener("keydown", onKeyDown);
    root.classList.remove("pf-outro--live", "pf-outro--armed", "is-shown");
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
