/* ============================================================
   Cursor dot. One rAF loop writing a single transform — the
   lerp is what gives it the trailing feel. Pill state is driven
   by delegated pointerover/pointerout so cards added later
   (or re-rendered) are picked up without re-binding.

   THREE SHAPES. The dot; the labelled pill over [data-cursor];
   and, over a link carrying data-card-img (the homepage hero's
   three links, Amanda 17 Nov 2026), a preview card with that
   work's picture and a line of context. The card grows out of
   the dot the way the pill does, from the dot's own corner, and
   shrinks back into it. Pages with no data-card-img never see it.
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
  var DOT = 14;          // css/cursor.css --dot
  var CARD_W = 272;      // css/cursor.css --card-w
  var EDGE = 16;         // the card keeps this much air from the window's edges

  window.addEventListener("pointermove", function (e) {
    tx = e.clientX;
    ty = e.clientY;
    if (!awake) {
      // Jump to the pointer on the first move so it does not fly in from 0,0.
      x = tx; y = ty;
      awake = true;
      el.classList.add("is-awake");
      preload();
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

  /* ---------- card state ----------
     Built once, filled per link. The pictures are fetched on the first
     mouse move, so a card never opens on an empty frame. */
  var cards = document.querySelectorAll("[data-card-img]");
  var card = null, cardImg, cardKicker, cardTitle, cardDesc;
  var openOn = null;            // the link whose card is showing
  var corner = false;           // the card's corner, not the dot's centre, is the anchor
  var flipX = false, flipY = false;

  function cardOf(node) {
    return node && node.closest ? node.closest("[data-card-img]") : null;
  }

  function preload() {
    for (var i = 0; i < cards.length; i++) {
      var img = new Image();
      img.decoding = "async";
      img.src = cards[i].getAttribute("data-card-img");
    }
  }

  if (cards.length) {
    card = document.createElement("div");
    card.className = "cursor__card";
    card.innerHTML =
      '<span class="cursor__media"><img alt="" decoding="async"></span>' +
      '<span class="cursor__text"><span class="cursor__kicker"></span>' +
      '<span class="cursor__title"></span><span class="cursor__desc"></span></span>';
    el.appendChild(card);
    cardImg = card.querySelector("img");
    cardKicker = card.querySelector(".cursor__kicker");
    cardTitle = card.querySelector(".cursor__title");
    cardDesc = card.querySelector(".cursor__desc");
  }

  function openCard(link) {
    openOn = link;
    cardImg.src = link.getAttribute("data-card-img");
    cardKicker.textContent = link.getAttribute("data-card-kicker") || "";
    cardTitle.textContent = link.getAttribute("data-card-title") || "";
    cardDesc.textContent = link.getAttribute("data-card-desc") || "";
    var h = card.offsetHeight;
    /* Which way it opens is settled once, as it opens, so it never jumps:
       down and to the right of the pointer, mirrored when that would run
       off the window. */
    flipX = tx + OFFSET_X + CARD_W > window.innerWidth - EDGE;
    flipY = ty + OFFSET_Y + h > window.innerHeight - EDGE;
    corner = true;
    el.classList.remove("is-pill");
    el.classList.add("is-card");
    el.style.width = CARD_W + "px";
    el.style.height = h + "px";
  }

  function closeCard() {
    openOn = null;
    el.classList.remove("is-card");
    el.style.width = "";
    el.style.height = "";
  }

  document.addEventListener("pointerover", function (e) {
    var c = card && cardOf(e.target);
    if (c) {
      if (c !== openOn) openCard(c);
      return;
    }
    var t = targetOf(e.target);
    if (!t) return;
    labelEl.textContent = t.getAttribute("data-cursor") || "See project";
    el.classList.add("is-pill");
  });

  document.addEventListener("pointerout", function (e) {
    var c = card && cardOf(e.target);
    if (c) {
      if (cardOf(e.relatedTarget) !== c) closeCard();
      return;
    }
    var from = targetOf(e.target);
    if (!from) return;
    // Ignore moves that stay inside the same [data-cursor] element.
    if (targetOf(e.relatedTarget) === from) return;
    el.classList.remove("is-pill");
  });

  /* The hero fades away under a still pointer when the page scrolls, and
     the browser may not send a pointerout until the mouse moves again. */
  window.addEventListener("scroll", function () {
    if (openOn && !openOn.matches(":hover")) closeCard();
  }, { passive: true });

  (function raf() {
    x += (tx - x) * EASE;
    y += (ty - y) * EASE;
    // The element is anchored by its LEFT edge and its vertical centre, NOT
    // its centre: that is what makes the pill extend to the RIGHT of the dot
    // when .is-pill widens it — the left edge stays put, so the dot's
    // position is also the pill's starting point, and the whole thing stays
    // down-and-right of the pointer at every width. Centre-anchoring instead
    // splits the growth both ways and drags the pill back underneath the
    // cursor (see css/cursor.css's note).
    //
    // The card is anchored by the dot's top-left corner instead (or the
    // mirrored corner, see openCard), so it grows down and out of the dot
    // and shrinks back into the same place. `corner` holds until it has
    // shrunk all the way, so the close does not jump.
    var left = x + OFFSET_X;
    var top;
    if (corner) {
      var w = el.offsetWidth, h = el.offsetHeight;
      if (!openOn && w <= DOT + 1 && h <= DOT + 1) corner = false;
      if (flipX) left = x + OFFSET_X + DOT - w;
      top = flipY ? y + OFFSET_Y + DOT / 2 - h : y + OFFSET_Y - DOT / 2;
      el.style.transform = "translate3d(" + left.toFixed(2) + "px," + top.toFixed(2) + "px,0)";
    }
    if (!corner) {
      el.style.transform =
        "translate3d(" + left.toFixed(2) + "px," + (y + OFFSET_Y).toFixed(2) + "px,0) translate(0,-50%)";
    }
    requestAnimationFrame(raf);
  })();
})();
