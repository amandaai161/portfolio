/* =============================================================================
   Aspire 2026 — smooth scrolling
   -----------------------------------------------------------------------------
   Wheel input is accumulated into a target and the page eases towards it, so a
   notch of the wheel glides instead of jumping the ~100px the OS reports.

   It moves the REAL scroll position (`window.scrollTo`) rather than transforming
   a wrapper, which is the only version of this that can work on this page:
   `position: sticky` on the hero pin and `position: fixed` on the blurred field
   both key off native scroll, and a transformed wrapper would strand them.
   Scrollbar, keyboard, find-in-page and anchor jumps all keep working untouched,
   and the scrollbar thumb stays where the page actually is.

   It stands down completely for:
     - prefers-reduced-motion
     - touch / coarse pointers, where the platform's own momentum is better than
       anything reimplemented here and fighting it feels awful
     - a wheel event the page has already had a chance to handle (defaultPrevented)

   hero.js has its own easing (`--scroll-ease`) for the composition. With this
   running, that is set to 1 in styles.css so the scene tracks the eased position
   exactly — two lerps in series read as lag, not smoothness.
   ========================================================================== */

(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var coarse  = matchMedia('(pointer: coarse)');

  function num(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }

  var EASE = num('--scroll-smooth', 0.11);   /* 0–1 per frame; lower = longer glide */
  var STEP = num('--scroll-step', 1);        /* wheel multiplier */

  var target  = window.scrollY;
  var raf     = 0;
  var driving = false;                       /* is the animation ours? */

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  /* `behavior: 'instant'` is load-bearing, not decoration. html carries
     `scroll-behavior: smooth` for anchor jumps, and that applies to programmatic
     scrolls too — so a plain scrollTo() here would ask the browser to animate to
     each of our own intermediate positions, sixty times a second. Two easings
     fighting reads as lag. This opts each write out. */
  function jump(y) {
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
  }

  function frame() {
    raf = 0;
    var current = window.scrollY;
    var delta = target - current;

    /* Under a pixel there is nothing left to see; land exactly and hand back. */
    if (Math.abs(delta) < 0.5) {
      driving = false;
      jump(target);
      return;
    }
    jump(current + delta * EASE);
    raf = requestAnimationFrame(frame);
  }

  function drive() {
    if (raf) return;
    driving = true;
    raf = requestAnimationFrame(frame);
  }

  function onWheel(e) {
    if (!enabled()) return;
    /* Someone else wants this wheel event (a scrollable child, a map, a modal). */
    if (e.defaultPrevented || e.ctrlKey) return;

    /* deltaMode 1 is lines, 2 is pages — normalise both to pixels. */
    var dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= window.innerHeight;

    e.preventDefault();
    /* Re-anchor to where the page actually is if we were not already driving,
       so a wheel after a scrollbar drag or a keyboard jump starts from there. */
    if (!driving) target = window.scrollY;
    target = Math.max(0, Math.min(maxScroll(), target + dy * STEP));
    drive();
  }

  /* Anything that scrolls the page without going through us — the scrollbar, a
     keypress, find-in-page — resets the target so the next wheel does not snap
     back to a stale position. */
  function onScroll() {
    if (!driving) target = window.scrollY;
  }

  function enabled() {
    return !reduced.matches && !coarse.matches;
  }

  /* The class is how the stylesheet knows to hand the hero's own easing over
     (html.smooth-on { --scroll-ease: 1 }). It has to be set before hero.js reads
     its config — which it is, because this file is loaded first — and taken off
     again if the media queries flip mid-session, so the composition never ends up
     with no easing at all. */
  function syncFlag() {
    document.documentElement.classList.toggle('smooth-on', enabled());
  }
  syncFlag();

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    driving = false;
    target = window.scrollY;
  }

  /* passive:false because the whole point is preventDefault on the wheel. */
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('scroll', onScroll, { passive: true });
  /* A touch anywhere means the platform is scrolling; get out of its way. */
  window.addEventListener('touchstart', stop, { passive: true });
  window.addEventListener('resize', stop);

  function onQueryChange() {
    stop();
    syncFlag();
    /* re-read --scroll-ease under the new flag */
    if (window.hero && window.hero.measure) window.hero.measure();
  }
  function watch(mq) {
    if (mq.addEventListener) mq.addEventListener('change', onQueryChange);
    else if (mq.addListener) mq.addListener(onQueryChange);
  }
  watch(reduced);
  watch(coarse);

  /* --------------------------------------------------------- debug hook */
  window.smoothScroll = {
    get state() {
      return {
        enabled: enabled(),
        reason: enabled() ? null : (reduced.matches ? 'prefers-reduced-motion' : 'coarse pointer'),
        ease: EASE,
        step: STEP,
        driving: driving,
        target: Math.round(target),
        current: Math.round(window.scrollY)
      };
    },
    to: function (y) {
      if (!enabled()) { jump(y); return; }
      target = Math.max(0, Math.min(maxScroll(), y));
      drive();
    }
  };
})();
