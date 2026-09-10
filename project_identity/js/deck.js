/* ==========================================================================
   Identity — the deck
   --------------------------------------------------------------------------
   Sections 1-6 share one pinned frame and cross-dissolve as you scroll: the
   content never travels, the scroll position just drives which slide is on
   screen. Each slide gets a viewport of scroll distance; the CTA and footer
   below the deck scroll normally.

   Each slide's [data-reveal] children also pick up a small, staggered offset
   so a slide reads as arriving and leaving rather than simply blinking on.

   A slide can ask for extra scroll to sit still in — `data-dwell="2"` buys it
   two more viewports during which the progress value stays pinned at that
   slide. The map uses it: it needs room for its own scroll-driven build and
   then a stretch of page you can actually explore it in.
   ========================================================================== */

(function () {
  "use strict";

  /* A slide is fully out before the next starts coming in — a clean fade
     out / fade in rather than a muddy cross-dissolve of two compositions. */
  var HOLD = 0.30;      /* slide sits fully opaque within ±HOLD of its stop  */
  var FADE = 0.17;      /* … then fades out over this much more             */
  var LIFT = 26;        /* px of intro/outro drift for revealed children     */
  var STAGGER = 0.28;   /* each further child drifts this much more          */

  /* the deck is a wide-viewport, pointer-driven idea — below this it stands
     down and the sections just stack (see setMode) */
  var mq = window.matchMedia("(min-width: 900px)");
  var live = false;

  var deck, stage, slides = [], reveals = [];
  var deckTop = 0, vh = 0, count = 0;
  var lastP = -1, lastY = 0;
  var listeners = [];
  var active = -1;

  /* dwell[i] = extra viewports slide i holds for; stops[i] = the scroll offset
     (in viewports, from the top of the deck) where that hold begins */
  var dwell = [], stops = [], span = 0;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function smoothstep(t) {
    t = clamp01(t);
    return t * t * (3 - 2 * t);
  }

  /* how visible a slide is, given its distance (in slides) from its stop */
  function visibility(t) {
    var d = Math.abs(t);
    if (d <= HOLD) return 1;
    return smoothstep(1 - (d - HOLD) / FADE);
  }

  function measure() {
    if (!deck) return;
    /* The visible height BELOW the project navbar, which is what one slide
       occupies. sections.css sizes .deck and .deck__stage from the same figure;
       if these two ever disagree the slides stop drifting out of step with the
       scroll. Reads the live custom property so the 80px -> 56px breakpoint
       needs no second definition here. */
    var navH = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--pf-nav-h")
    ) || 0;
    vh = window.innerHeight - navH;
    /* navH comes off BOTH figures, and for two different reasons. vh is how
       much height one slide occupies. deckTop is the scroll position at which
       slide 0 should read as progress 0 -- and .deck__stage now pins at
       top: navH, so it pins navH px of scrolling EARLIER than the deck's own
       document offset. Subtracting it here is what keeps "the stage just
       pinned" and "slide 0 is exactly on its stop" the same moment. Take it
       off vh alone and every slide stop sits navH px late. */
    deckTop = deck.getBoundingClientRect().top + window.scrollY - navH;
    lastP = -1;
  }

  /* scroll position -> continuous slide index. Without any dwell this is just
     "viewports scrolled since the deck began"; a dwell inserts a flat stretch
     where the value stays parked on that slide. */
  function progress(y) {
    var u = (y - deckTop) / vh;
    if (u <= 0) return 0;
    if (u >= span) return count - 1;
    for (var i = 0; i < count; i++) {
      var end = stops[i] + dwell[i];
      if (u <= end) return i;
      if (u < stops[i + 1]) return i + (u - end);
    }
    return count - 1;
  }

  /* how far the page has scrolled past the start of slide i's hold, in
     viewports — negative while the slide is still on its way in */
  function slideScroll(i) {
    return (lastY - deckTop) / vh - stops[i];
  }

  function apply(p) {
    for (var i = 0; i < slides.length; i++) {
      var t = p - i;
      var o = visibility(t);
      var el = slides[i];

      if (o !== el._o) {
        el._o = o;
        el.style.opacity = o.toFixed(3);
        el.classList.toggle("is-live", o > 0.002);
        el.classList.toggle("is-active", o > 0.5);
        el.setAttribute("aria-hidden", o > 0.5 ? "false" : "true");
      }

      /* drift the content: below its stop it sits low, above it rides up */
      if (o > 0.002) {
        var lift = Math.max(-1, Math.min(1, t)) * -LIFT;
        var kids = reveals[i];
        for (var k = 0; k < kids.length; k++) {
          kids[k].style.setProperty("--reveal-y", (lift * (1 + k * STAGGER)).toFixed(1) + "px");
        }
      }
    }

    var current = Math.round(p);
    if (current !== active) {
      active = current;
      for (var l = 0; l < listeners.length; l++) listeners[l](active, slides[active]);
    }
  }

  function update(y) {
    if (!deck || !live) return;
    lastY = y === undefined ? window.scrollY : y;
    var p = progress(lastY);
    if (Math.abs(p - lastP) < 0.0004) return;
    lastP = p;
    apply(p);
  }

  /* Below the breakpoint the deck stands down: a pinned cross-dissolve wants a
     wide, stable viewport and a pointer, and gets neither on a phone — the
     sections simply stack and scroll, and reveal themselves on the way in.
     Everything that reads the deck asks live() first. */
  function setMode() {
    var want = mq.matches;
    if (want === live) return;
    live = want;
    document.documentElement.classList.toggle("js-deck", live);

    if (live) {
      lastP = -1;
      measure();
      update();
    } else {
      /* hand the slides back to normal flow */
      slides.forEach(function (el, i) {
        el._o = undefined;
        el.style.opacity = "";
        el.classList.remove("is-live", "is-active");
        el.removeAttribute("aria-hidden");
        reveals[i].forEach(function (k) { k.style.removeProperty("--reveal-y"); });
      });
      lastP = -1;
      active = -1;
    }
    for (var l = 0; l < listeners.length; l++) listeners[l](active, slides[active]);
  }

  function init() {
    deck = document.getElementById("deck");
    if (!deck) return;
    stage = deck.querySelector(".deck__stage");
    slides = Array.prototype.slice.call(stage.querySelectorAll(".slide"));
    count = slides.length;

    var acc = 0;
    dwell = slides.map(function (s) {
      return Math.max(0, parseFloat(s.getAttribute("data-dwell")) || 0);
    });
    stops = dwell.map(function (d) { var at = acc; acc += d + 1; return at; });
    span = acc - 1;                    /* the last slide has nothing after it */
    deck.style.setProperty("--deck-span", span);

    reveals = slides.map(function (s) {
      return Array.prototype.slice.call(s.querySelectorAll("[data-reveal]"));
    });

    window.ID = window.ID || {};
    window.ID.deck = {
      live: function () { return live; },
      /* scroll offset that parks slide `i` dead centre of its hold */
      offsetOf: function (i) { return deckTop + (stops[i] + dwell[i] / 2) * vh; },
      progress: function () { return lastP < 0 ? progress(window.scrollY) : lastP; },
      slideScroll: slideScroll,
      count: function () { return count; },
      indexOf: function (el) { return slides.indexOf(el); },
      slides: slides,
      onSlide: function (fn) { listeners.push(fn); fn(active, slides[active]); },
      update: update,
      measure: measure
    };

    setMode();
    if (mq.addEventListener) mq.addEventListener("change", setMode);
    else if (mq.addListener) mq.addListener(setMode);

    if (window.ID.onTick) window.ID.onTick(update);
    else window.addEventListener("scroll", function () { update(); }, { passive: true });

    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () { if (live) { measure(); update(); } }, 120);
    });
    window.addEventListener("load", function () { if (live) { measure(); update(); } });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
