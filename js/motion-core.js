/* ============================================================
   Motion core. Owns the single Lenis instance and the single
   GSAP ticker, and decides whether motion runs at all.

   The gate is deliberately conservative: if ANY of the three
   CDN libraries failed to load, or the visitor asked for
   reduced motion, html.motion is never added — and because
   every animated element's RESTING CSS is its final state,
   the page simply renders complete and static.
   ============================================================ */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var haveLibs =
    typeof window.gsap !== "undefined" &&
    typeof window.ScrollTrigger !== "undefined" &&
    typeof window.Lenis !== "undefined";

  // window.V3 must always exist — even on the no-motion path — so scene
  // scripts can read .ready without throwing. Set the safe default first,
  // then let every early-return below leave it exactly as-is.
  var V3 = (window.V3 = { ready: false, reduced: reduced, lenis: null });

  // Diagnostic escape hatch: ?nomotion=1 forces the no-motion path, which is
  // the only practical way to exercise the fallback in a real browser.
  if (/[?&]nomotion=1/.test(location.search)) return;

  if (reduced || !haveLibs) return;

  gsap.registerPlugin(ScrollTrigger);

  var lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });

  // Drive Lenis from GSAP's ticker (one rAF loop, not two) and let every
  // Lenis scroll tick refresh ScrollTrigger, so scrubs stay in lockstep
  // with the smoothed scroll position rather than the raw one.
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);

  V3.lenis = lenis;
  V3.ready = true;
  document.documentElement.classList.add("motion");

  // Layout depends on webfont metrics — remeasure once Figtree is in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
