/* ============================================================================
   THE COVER — scroll driver
   ----------------------------------------------------------------------------
   One job: turn scroll position into the sheet's translateX. The pin itself is
   CSS (see the header comment in pf-outro.css); this only slides.

   Progress is read from getBoundingClientRect(), NOT from a cached document
   offset. Everything above this block changes height after first paint on these
   pages — fonts land, images decode, ScrollTrigger inserts pin spacers — and a
   cached offset would be wrong by however much. The rect is never stale.

   ES5, and no GSAP: two of the four pages this runs on have no GSAP at all.
   ========================================================================== */
(function (window, document) {
  "use strict";

  var root = document.querySelector("[data-pf-outro]");
  if (!root) return;

  var panel = root.querySelector(".pf-outro__panel");
  var sheet = root.querySelector(".pf-outro__sheet");
  if (!panel || !sheet) return;

  /* The sweep's share of a viewport. Long enough to read as a deliberate
     arrival, short enough that the page underneath does not drift far. */
  var PIN_RATIO = 0.9;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var wide = window.matchMedia("(min-width: 900px)");

  var live = false;
  var pin = 0;
  var raf = 0;
  var lastX = -1;
  var resizeTimer = null;
  var SCROLL_OPTS = { passive: true };

  function measure() {
    var vh = window.innerHeight;
    pin = Math.round(vh * PIN_RATIO);
    root.style.setProperty("--pf-vh", vh + "px");
    root.style.setProperty("--pf-pin", pin + "px");
  }

  function paint() {
    raf = 0;
    var p = -root.getBoundingClientRect().top / pin;
    if (p < 0) p = 0; else if (p > 1) p = 1;
    /* smoothstep, so the sheet decelerates into place instead of arriving at
       whatever speed the wheel happened to be turning. */
    var e = p * p * (3 - 2 * p);
    var x = (1 - e) * 100;
    /* Drives the leading-edge shadow's opacity (see pf-outro.css): at rest the
       shadow sits inside the clip box, not outside it, so it must be
       transparent until the sweep has actually started. */
    root.style.setProperty("--pf-sweep", e.toFixed(4));
    /* The sheet sits at translateX(100%) until the sweep starts, so there is
       no scroll that can bring a focused descendant (the CTA, the footer
       links) into view -- tabbing into it would fling the page at an
       unreachable target. inert removes it from the tab order and the
       accessibility tree until it has actually begun arriving. Set on every
       paint (not just past the threshold crossing) so it always reflects
       current progress, including when paint() is re-entered after a resize.
       Plain property assignment: a no-op on engines without `inert`, which
       is exactly today's behaviour there. */
    sheet.inert = e < 0.02;
    if (Math.abs(x - lastX) < 0.05) return;
    lastX = x;
    sheet.style.transform = "translate3d(" + x.toFixed(3) + "%,0,0)";
  }

  function onScroll() {
    if (!raf) raf = window.requestAnimationFrame(paint);
  }

  function onResize() {
    /* measure() is two setProperty calls -- cheap enough to run on every
       resize tick, not just once the drag settles. Left debounced, --pf-vh
       and --pf-pin (and, while live, the sheet's own transform, computed
       against the now-stale `pin`) went stale for the full 150ms: on aspire
       the stale ::before { top: var(--pf-vh) } could expose a band of white
       body background below the sheet, and the transform would visibly snap
       once the debounce finally caught up. Crossing the 900px gate -- which
       ordinary browser zoom can do without the window itself resizing --
       needs this to be immediate for the same reason.
       sync() is the one part worth debouncing: canRun() reads
       panel.offsetHeight, which forces layout, and it only needs to run
       once the size has settled rather than on every tick. */
    measure();
    if (live) { lastX = -1; paint(); }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sync, 150);
  }

  function canRun() {
    if (reduced.matches) return false;
    if (!wide.matches) return false;
    /* A panel shorter than the viewport cannot cover it, and pinning one would
       leave a strip of the old page showing down the side for the whole sweep. */
    return panel.offsetHeight >= window.innerHeight;
  }

  function enable() {
    if (live) return;
    live = true;
    measure();
    root.classList.add("pf-outro--live");
    lastX = -1;
    paint();
    window.addEventListener("scroll", onScroll, SCROLL_OPTS);
  }

  function disable() {
    if (!live) return;
    live = false;
    window.removeEventListener("scroll", onScroll, SCROLL_OPTS);
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    lastX = -1;
    root.classList.remove("pf-outro--live");
    sheet.style.transform = "";
    root.style.removeProperty("--pf-vh");
    root.style.removeProperty("--pf-pin");
    root.style.removeProperty("--pf-sweep");
    /* The flat fallback (reduced motion, under 900px, or no JS at all) is
       ordinary document flow with nothing parked off-screen, so it must
       never be inert -- this is the only path some readers get. */
    sheet.inert = false;
  }

  function sync() {
    if (canRun()) enable(); else disable();
  }

  function watch(mq) {
    if (mq.addEventListener) mq.addEventListener("change", sync);
    else if (mq.addListener) mq.addListener(sync);
  }
  watch(reduced);
  watch(wide);

  window.addEventListener("resize", onResize);
  /* The panel's height is not final until its webfont and its own images have
     landed, and canRun() depends on that height. */
  window.addEventListener("load", function () { sync(); if (live) { measure(); lastX = -1; paint(); } });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { sync(); if (live) { measure(); lastX = -1; paint(); } });
  }

  sync();

  window.PFOutro = {
    enable: enable,
    disable: disable,
    get live() { return live; },
    get pin() { return pin; },
    get panelHeight() { return panel.offsetHeight; },
    get progress() {
      if (!pin) return 0;
      var p = -root.getBoundingClientRect().top / pin;
      return p < 0 ? 0 : p > 1 ? 1 : +p.toFixed(4);
    }
  };
})(window, document);
