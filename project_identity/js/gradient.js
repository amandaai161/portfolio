/* ==========================================================================
   Identity — gradient motion
   --------------------------------------------------------------------------
   Two layers of movement on the same three blobs:

   1. SCROLL — the four states from materials/effect movement - step *.png,
      keyed to the deck slides:

        slide 0  hero      the default composition
        slide 1  intro     blob A up-left, blob B left, blob C up-right
        slide 2  numbers   the same directions, pushed much further out
        slide 3  map       one more move of the same range, then opacity -> 0

   2. AMBIENT — a slow, never-ending drift/breath/rotation on top, so the
      field is alive even when the page is still. Long periods (20-45s) and
      small amplitudes keep it from pulling focus.

   Offsets are px on the 1440-wide reference stage the comps were drawn on and
   rescaled to the viewport width at runtime (the composition itself is
   authored in vw in gradient.css).
   ========================================================================== */

(function () {
  "use strict";

  var STAGE_W = 1440;

  /* per-blob [dx, dy] against the hero composition, in stage px */
  var FRAMES = [
    { key: "hero",    a: [0, 0],        b: [0, 0],      c: [0, 0],        opacity: 1 },
    { key: "intro",   a: [-336, -276],  b: [-120, 92],  c: [268, -124],   opacity: 1 },
    { key: "numbers", a: [-544, -828],  b: [-504, 28],  c: [692, -440],   opacity: 1 },
    { key: "out",     a: [-752, -1380], b: [-888, -36], c: [1116, -756],  opacity: 0 }
  ];

  /* amplitude in stage px / period in seconds, per blob.
     Big and slow: the blobs are hundreds of px across and blurred by 170px,
     so anything under ~150px of travel simply reads as a still image. */
  var AMBIENT = {
    a: { ax: 230, px: 17, ay: 165, py: 23, as: 0.13, ps: 13, ar: 6.0, pr: 27, ph: 0.0 },
    b: { ax: 195, px: 14, ay: 210, py: 19, as: 0.15, ps: 11, ar: 7.5, pr: 21, ph: 1.7 },
    c: { ax: 275, px: 21, ay: 150, py: 16, as: 0.12, ps: 15, ar: 5.0, pr: 31, ph: 3.1 }
  };

  var KEYS = ["a", "b", "c"];
  var TAU = Math.PI * 2;

  var field, stage, blobs = {};
  var stageScale = 1, hidden = false, ambient = true;
  var t0 = performance.now();

  function smoothstep(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  }

  function measure() {
    /* travel uses the same basis as the vw geometry — window.innerWidth
       includes the scrollbar, exactly like the vw unit does. On narrow screens
       the composition is scaled up in CSS (--grad-scale) so it still fills the
       frame, and the travel has to be scaled with it. */
    var s = parseFloat(getComputedStyle(stage).getPropertyValue("--grad-scale")) || 1;
    stageScale = (window.innerWidth / STAGE_W) * s;
    anchors = null;
  }

  /* Where the keyframes live when the deck is standing down (mobile): the
     sections scroll normally, so each frame is pinned to the section that
     carried it in the deck. Anchored a third of a viewport early so the field
     has finished moving by the time the section is properly on screen. */
  var anchors = null;

  function measureAnchors() {
    var ids = ["hero", "intro", "numbers", "map"];
    var out = [];
    var raw, allZero = true;
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) return (anchors = null);
      raw = el.getBoundingClientRect().top + window.scrollY;
      if (raw !== 0) allZero = false;
      out.push(i === 0 ? 0 : Math.max(0, raw - window.innerHeight * 0.34));
    }
    /* The project navbar can hide this whole page in a display:none panel
       (switching to Brand or Case study) without tearing this script down, and
       a debounced resize fires while it is hidden. Every element in a
       display:none subtree reports a (0,0,0,0) rect, so every "raw" above
       comes back 0 and the loop would otherwise commit anchors = [0,0,0,0] --
       a truthy array that stackedProgress() then trusts forever, since its own
       lazy re-measure only fires when anchors is falsy. That stale zeroed
       array reads as "past the last frame" (opacity 0), so coming back to this
       panel showed a flash of flat colour until the NEXT debounced resize
       happened to reset it. Bailing to null here instead means the lazy
       re-measure keeps retrying on every tick, so it self-heals on the very
       first frame after the panel is unhidden and layout is real again. */
    anchors = allZero ? null : out;
  }

  function stackedProgress(y) {
    if (!anchors) measureAnchors();
    if (!anchors) return 0;
    for (var i = 0; i < anchors.length - 1; i++) {
      if (y < anchors[i + 1]) {
        var span = anchors[i + 1] - anchors[i];
        return span > 0 ? i + Math.max(0, (y - anchors[i]) / span) : i;
      }
    }
    return anchors.length - 1;
  }

  /* deck progress -> continuous frame index, clamped to the last frame */
  function frameProgress() {
    var deck = window.ID && window.ID.deck;
    var p = (deck && deck.live()) ? deck.progress() : stackedProgress(window.scrollY);
    return Math.max(0, Math.min(FRAMES.length - 1, p));
  }

  function apply(p, seconds) {
    var i = Math.min(FRAMES.length - 2, Math.floor(p));
    var t = Math.min(1, Math.max(0, p - i));
    var e = smoothstep(t);
    var from = FRAMES[i];
    var to = FRAMES[i + 1];

    for (var n = 0; n < KEYS.length; n++) {
      var k = KEYS[n];
      var el = blobs[k];
      if (!el) continue;

      var dx = from[k][0] + (to[k][0] - from[k][0]) * e;
      var dy = from[k][1] + (to[k][1] - from[k][1]) * e;
      var rot = 0;
      var scale = 1;

      if (ambient) {
        var m = AMBIENT[k];
        dx += m.ax * Math.sin(TAU * seconds / m.px + m.ph);
        dy += m.ay * Math.cos(TAU * seconds / m.py + m.ph * 1.3);
        scale = 1 + m.as * Math.sin(TAU * seconds / m.ps + m.ph * 0.7);
        rot = m.ar * Math.sin(TAU * seconds / m.pr + m.ph * 1.9);
      }

      el.style.transform =
        "translate3d(" + (dx * stageScale).toFixed(2) + "px," +
        (dy * stageScale).toFixed(2) + "px,0) rotate(" +
        rot.toFixed(3) + "deg) scale(" + scale.toFixed(4) + ")";
    }

    var o = from.opacity + (to.opacity - from.opacity) * e;
    stage.style.opacity = o.toFixed(3);

    /* stop compositing the (very expensive) blurs once the field is invisible */
    var shouldHide = o < 0.004;
    if (shouldHide !== hidden) {
      hidden = shouldHide;
      field.style.visibility = hidden ? "hidden" : "";
    }
  }

  function update() {
    var seconds = (performance.now() - t0) / 1000;
    apply(frameProgress(), seconds);
  }

  function init() {
    field = document.querySelector(".gradient-field");
    if (!field) return;
    stage = field.querySelector(".gradient-field__stage");
    blobs = {
      a: field.querySelector(".blob--a"),
      b: field.querySelector(".blob--b"),
      c: field.querySelector(".blob--c")
    };

    ambient = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    measure();
    update();

    if (window.ID && window.ID.onTick) {
      window.ID.onTick(update);
    } else {
      /* no shared loop (shouldn't happen) — keep the ambient drift alive */
      (function loop() { update(); requestAnimationFrame(loop); })();
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { measure(); update(); }, 120);
    });
    window.addEventListener("load", function () { measure(); update(); });

    window.ID = window.ID || {};
    window.ID.gradient = { update: update, measure: measure, frames: FRAMES };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
