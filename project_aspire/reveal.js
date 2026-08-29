/* =============================================================================
   Aspire 2026 — intro reveals for the static sections
   -----------------------------------------------------------------------------
   One observer for every `.reveal` inside a `[data-reveal]` root: the benefit
   rows, the CTA banner, the business cards, the testimonial and the closing CTA.

   Reveals run BOTH WAYS. An element animates in when it comes properly into view
   and resets when it leaves, so scrolling back up plays the intro again rather
   than walking through a page of already-finished animations. That means the
   observer stays attached — nothing is ever unobserved.

   Two rootMargins, not one, because a single threshold would flicker: an element
   sitting right on the line would toggle on every pixel of scroll. Entering has to
   clear -18% off the bottom; leaving only happens once the element is fully past
   the viewport edge (+12% of slack). The gap between the two is the hysteresis.

   The product section is deliberately NOT in here. It sits under a pinned header,
   where "in view" is true long before the section is anywhere near its docked
   position, so hero.js cues it by proximity instead — see the `hero:dock` /
   `hero:undock` listener in products.js, which already goes both ways.

   Marking the roots in the markup rather than listing section names here means a
   new section opts in with one attribute and this file never needs touching.
   ========================================================================== */

(function () {
  'use strict';

  var roots = document.querySelectorAll('[data-reveal]');
  if (!roots.length) return;

  var els = [];
  for (var r = 0; r < roots.length; r++) {
    var found = roots[r].querySelectorAll('.reveal');
    for (var f = 0; f < found.length; f++) els.push(found[f]);
  }
  if (!els.length) return;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var i;

  function showAll() {
    for (var a = 0; a < els.length; a++) els[a].classList.add('is-in');
  }

  if (reduced.matches || !window.IntersectionObserver) {
    showAll();
  } else {
    /* IN: the element has to be 18% clear of the bottom edge before it plays. */
    var enter = new IntersectionObserver(function (entries) {
      for (var e = 0; e < entries.length; e++) {
        if (entries[e].isIntersecting) entries[e].target.classList.add('is-in');
      }
    }, { rootMargin: '0px 0px -18% 0px', threshold: 0.01 });

    /* OUT: only once it is fully past the viewport, with 12% of slack, so the two
       margins can never both fire on the same scroll position. */
    var leave = new IntersectionObserver(function (entries) {
      for (var e = 0; e < entries.length; e++) {
        if (!entries[e].isIntersecting) entries[e].target.classList.remove('is-in');
      }
    }, { rootMargin: '12% 0px 12% 0px', threshold: 0 });

    for (i = 0; i < els.length; i++) {
      enter.observe(els[i]);
      leave.observe(els[i]);
    }

    /* Someone can turn reduced motion on mid-session; stop hiding things if so. */
    var onReduced = function () {
      if (!reduced.matches) return;
      enter.disconnect();
      leave.disconnect();
      showAll();
    };
    if (reduced.addEventListener) reduced.addEventListener('change', onReduced);
    else if (reduced.addListener) reduced.addListener(onReduced);
  }

  /* --------------------------------------------------------- debug hook */
  window.reveal = {
    get state() {
      var shown = 0;
      for (var s = 0; s < els.length; s++) {
        if (els[s].classList.contains('is-in')) shown++;
      }
      return { roots: roots.length, watched: els.length, shown: shown, replays: true };
    },
    all: showAll
  };
})();
