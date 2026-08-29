/* ============================================================
   Cursor dot. One rAF loop writing a single transform — the
   lerp is what gives it the trailing feel. Pill state is driven
   by delegated pointerover/pointerout so cards added later
   (or re-rendered) are picked up without re-binding.
   ============================================================ */
(function () {
  "use strict";

  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!fine) return;

  var el = document.querySelector(".cursor");
  if (!el) return;
  var labelEl = el.querySelector(".cursor__label");

  var x = 0, y = 0, tx = 0, ty = 0;
  var awake = false;
  var EASE = 0.18;
  // Distance from the pointer hotspot to the dot's LEFT edge / vertical
  // CENTRE (see the transform at the bottom of this file for why those are
  // the anchored edges rather than the dot's own centre). Raised from 14/16
  // on Amanda's note that the dot sat too close to the cursor; at 22/24 the
  // dot clears the macOS arrow glyph (~12x19px from its hotspot) with real
  // air around it rather than tucking against its corner.
  var OFFSET_X = 22;
  var OFFSET_Y = 24;

  window.addEventListener("pointermove", function (e) {
    tx = e.clientX;
    ty = e.clientY;
    if (!awake) {
      // Jump to the pointer on the first move so it does not fly in from 0,0.
      x = tx; y = ty;
      awake = true;
      el.classList.add("is-awake");
    }
  }, { passive: true });

  document.addEventListener("pointerleave", function () {
    el.classList.remove("is-awake");
    awake = false;
  });

  /* ---------- pill state ---------- */
  function targetOf(node) {
    return node && node.closest ? node.closest("[data-cursor]") : null;
  }

  document.addEventListener("pointerover", function (e) {
    var t = targetOf(e.target);
    if (!t) return;
    labelEl.textContent = t.getAttribute("data-cursor") || "See project";
    el.classList.add("is-pill");
  });

  document.addEventListener("pointerout", function (e) {
    var from = targetOf(e.target);
    if (!from) return;
    // Ignore moves that stay inside the same [data-cursor] element.
    if (targetOf(e.relatedTarget) === from) return;
    el.classList.remove("is-pill");
  });

  (function raf() {
    x += (tx - x) * EASE;
    y += (ty - y) * EASE;
    // translate(0, -50%), NOT translate(-50%, -50%): the element is anchored
    // by its LEFT edge and its vertical centre. That is what makes the pill
    // extend to the RIGHT of the dot when .is-pill widens it — the left edge
    // stays put, so the dot's position is also the pill's starting point,
    // and the whole thing stays down-and-right of the pointer at every
    // width. Centre-anchoring instead splits the growth both ways and drags
    // the pill back underneath the cursor (see css/cursor.css's note).
    el.style.transform =
      "translate3d(" + (x + OFFSET_X).toFixed(2) + "px," + (y + OFFSET_Y).toFixed(2) + "px,0) translate(0,-50%)";
    requestAnimationFrame(raf);
  })();
})();
