/* ============================================================
   THE DISPLAY HEADLINE — one fixed element that arrives, holds,
   becomes a watermark, changes its word, and leaves.

   ONE module, ONE measure(), ONE render(). render(y) is a pure
   function of scroll position that writes EVERY property of the
   headline — top, font-size, colour, opacity, visibility, and each
   glyph's transform, opacity, blur, width and text — unconditionally,
   on every frame. Nothing else on the page writes any of them.

   That is the whole design, and it is deliberate. This feature used
   to be four scroll scenes across two files, each owning a different
   subset of the same element's properties and handing over at the
   boundaries; every defect it ever had was a boundary defect — two
   writers on one property, a scrubbed tween latching a start value
   while the element was hidden, a re-measure wiping what another
   scene had just written. A property with exactly one writer,
   recomputed from scratch each frame from one input, cannot be
   raced, cannot latch a stale value, and cannot be left behind by an
   instant jump.

   PROMINENCE. The headline is only ever somewhere between two
   states: LANDED (large, middle-left, black — #mheadSlot's geometry)
   and WATERMARK (small, top-left, 4.5% black — .mhead's own base
   rule). It travels between them four times: it arrives landed,
   shrinks to the watermark, grows back as it changes word, and
   shrinks again. All four are one number, `prom`, and one set of
   three interpolations.

   WHY THE HEADLINE NEVER REFLOWS. Measured on an earlier version,
   mid-change: 786px wide, then 798, 918, 1002 and back to 786,
   collapsing onto ONE line at the widest point. Two structural
   causes, both removed by construction here:
     * the two-line break depended on a width cap happening to fit
       the current string, so a wide scramble frame broke
       differently. The two words are BLOCKS now. Two lines is a fact
       of the markup; no string can change it.
     * every glyph resized as random characters passed through it,
       relaying out the line every frame. Every glyph now has a
       PINNED WIDTH, in em, interpolated from the width of the
       character it starts as to the width of the one it ends as.
       Layout is a function of `morph` alone.

   The arrival itself — the scatter from outside the frame, the
   stagger, the fade/blur arc — is js/arrival.js, shared with the
   closing CTA headline so the page's two arrivals are one piece of
   code rather than two that must be kept looking alike.
   ============================================================ */
(function () {
  "use strict";

  var head = document.getElementById("morphHead");
  var slot = document.getElementById("mheadSlot");
  if (!head || !slot || !window.Arrival) return;

  // No-motion (prefers-reduced-motion, a CDN failure, ?nomotion=1): bail
  // BEFORE the split below, so #morphHead stays plain "SELECTED WORK." markup
  // painted by css/v3.css alone. That resting state is the final state, which
  // is this codebase's standing invariant.
  if (!window.V3 || !window.V3.ready) return;

  /* ---------- tuning ----------
     Every number that is a matter of taste, in one place. Positions inside the
     work section are on ITS timeline's 0..1 scale and are converted to scroll
     pixels by measureAnchors(); everything else is a viewport fraction or a
     plain ratio, so it holds its shape at any screen size. */
  var SEED = 7;
  var HOLD_FRACTION = 2 / 3;    // of #headHold spent holding before the shrink

  var FLIGHT = { win: 0.55, landBy: 0.78, fadeMin: 0.42, blur: 5 };
  var MORPH_WIN = 0.50, MORPH_LAND_BY = 0.85;
  var MORPH_FADE_MIN = 0.42, MORPH_BLUR = 7;

  // Fallback only. The resting alpha is READ FROM CSS in measure(), the same
  // way the resting position and size are — see G.restAlpha for why that
  // matters now that the two viewports want different resting states.
  var WATERMARK = 0.045;

  // Positions on #work's own timeline (js/scenes-work.js publishes the mapping).
  var W_MORPH_FROM = 0.745;     // AFTER pair 2 has completely gone, not while
  var W_MORPH_TO = 0.835;       //  it leaves — Amanda's own note
  var W_SHRINK_FROM = 0.92;     // slide 4 held, then back to the watermark
  var W_SHRINK_TO = 1;

  /* WHERE THE ARRIVAL BEGINS. Not a number of this file's own: it is the exact
     pixel js/scenes-intro.js starts taking intro 2 away on, published by that
     file as a viewport-height offset from #intro's end. Amanda: "The selected
     headline intro animation should start as the last frame of intro2 section
     is animating to disappear. So it creates a continuous transition." Reading
     it rather than matching it means the two cannot drift apart. */
  var ARRIVE_VH = (window.V3.introTail && window.V3.introTail.outroIn) || 1.00;

  /* ---------- small pure helpers ---------- */
  function ramp(y, a, b) {
    if (b <= a) return y >= b ? 1 : 0;
    if (y <= a) return 0;
    if (y >= b) return 1;
    return (y - a) / (b - a);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var smoothstep = Arrival.smoothstep;

  /* ---------- the cells ----------
     One <span> per character of #morphHead's own text. The thing that arrives
     IS the headline — there is no second set of letters flying at it and being
     swapped for it, because a swap between two elements can be misaligned and
     an element cannot be misaligned with itself.

     Each word keeps its own block (css/v3.css), so the two-line break is
     structural. Within a word, white-space: nowrap stops the browser breaking
     between two inline-block glyphs. */
  var cells = [];
  var morphCells = 0;

  Array.prototype.forEach.call(head.querySelectorAll(".mhead__word"), function (word) {
    var from = word.textContent;
    var to = word.getAttribute("data-morph-to");
    var changes = to != null && to !== from;

    Arrival.splitWord(word, "mhead__ch").forEach(function (sp, i) {
      cells.push({
        el: sp,
        ch: from.charAt(i),          // what the arrival resolves to
        a: from.charAt(i),
        // "" for a character the shorter word does not have: it scrambles and
        // then collapses to zero width, which is how SELECTED narrows to OTHER
        // without anything jumping.
        b: changes ? (i < to.length ? to.charAt(i) : "") : from.charAt(i),
        changes: changes,
        mi: changes ? morphCells++ : 0,
        wA: 0, wB: 0, home: null, from: null, w: 0
      });
    });
  });

  if (!cells.length) return;

  /* ---------- geometry ---------- */
  var G = { restTop: 0, restBottom: 0, restFs: 1, restAlpha: WATERMARK,
            landedTop: 0, landedFs: 1 };

  // "rgba(0, 0, 0, 0.045)" / "rgb(0, 0, 0)" -> 0.045 / 1
  function alphaOf(color) {
    var m = /rgba?\(([^)]+)\)/.exec(color);
    if (!m) return 1;
    var parts = m[1].split(",");
    return parts.length > 3 ? parseFloat(parts[3]) : 1;
  }
  var A = {};                 // scroll anchors, all in document pixels

  function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }
  function docBottom(el) { return el.getBoundingClientRect().bottom + window.scrollY; }

  function measure() {
    // Clear everything render() writes before reading anything back. Without
    // this a re-measure feeds this module's own output in as its new input —
    // the most common way a scroll scene corrupts itself.
    head.style.top = "";
    head.style.fontSize = "";
    head.style.color = "";
    cells.forEach(function (c) {
      c.el.style.transform = "none";
      c.el.style.width = "";
      c.el.style.filter = "none";
      c.el.style.opacity = "1";
      c.el.textContent = c.a;
    });

    // RESTING state — .mhead's own rule, read off the element with no inline
    // styles on it. Neither state is a number in this file; both come from CSS
    // and stay correct at every viewport width.
    //
    // The COLOUR is read too, not assumed, and that is what lets the two
    // viewports rest differently without a branch in here. On desktop .mhead
    // is the 4.5% watermark the sections are seen through. On mobile there is
    // no room for a watermark behind five stacked projects, so it rests solid
    // black as a fixed title bar with the content passing under it (Amanda:
    // "please move it to the top of the screen and make it fixed at the top of
    // the screen when we scroll thru the 5 projects"). Both are just what the
    // stylesheet says at that width.
    var restCS = getComputedStyle(head);
    var restRect = head.getBoundingClientRect();
    G.restTop = restRect.top;
    // How far down the screen the headline reaches once it has settled. On a
    // phone that is the bottom edge of a title bar things scroll under, so it
    // is the honest answer to "has this project passed the headline yet" —
    // which is what the mobile anchors below are timed against.
    G.restBottom = restRect.bottom;
    G.restFs = parseFloat(restCS.fontSize) || 1;
    G.restAlpha = alphaOf(restCS.color);

    // LANDED state — #mheadSlot, the invisible twin whose only job is to be
    // measured.
    G.landedTop = slot.getBoundingClientRect().top;
    G.landedFs = parseFloat(getComputedStyle(slot).fontSize) || 1;

    // The glyphs are measured AT the landed size, because that is where they
    // arrive and where their widths are pinned from.
    head.style.top = G.landedTop + "px";
    head.style.fontSize = G.landedFs + "px";

    Arrival.measure(cells, {
      fontSize: G.landedFs,
      viewW: window.innerWidth, viewH: window.innerHeight,
      seed: SEED
    });
    cells.forEach(function (c) { c.wA = c.w; });

    // Second pass for the word the headline changes INTO. Each cell is its own
    // inline-block, so its width is independent of its neighbours' — but all
    // are written before any is read, to keep this one layout pass.
    cells.forEach(function (c) { if (c.changes) c.el.textContent = c.b; });
    cells.forEach(function (c) {
      c.wB = c.changes ? c.el.getBoundingClientRect().width / G.landedFs : c.wA;
    });
    cells.forEach(function (c) { c.el.textContent = c.a; });

    measureAnchors();
  }

  /* ---------- the scroll anchors ----------
     Every phase boundary, as one ordered list of document scroll positions.
     Having them all in one place, in one unit, is most of why this is simpler
     than what it replaces: the old version expressed the same boundaries as
     four triggers' start/end strings plus two sets of timeline fractions, and
     "does this end where that begins" could only be answered by running the
     page. */
  function measureAnchors() {
    var vh = window.innerHeight;
    var intro = document.getElementById("intro");
    var hold = document.getElementById("headHold");
    var outro = document.getElementById("outro");
    var work = window.V3.work;
    A.retireFromCards = false;

    // ARRIVE — begins exactly where js/scenes-intro.js starts taking intro 2
    // away, and ends with the section. The two overlap on purpose; see
    // ARRIVE_VH above.
    var introEnd = intro ? docBottom(intro) - vh : 0;
    A.arriveOut = introEnd;
    A.arriveIn = introEnd - ARRIVE_VH * vh;

    // HOLD, then SHRINK — over #headHold, the empty runway that exists so the
    // headline can be alone on screen while it holds. It ends where #work
    // pins, so there is never a blank screen between the two.
    var holdEnd = hold ? docBottom(hold) : introEnd;
    A.shrink1In = introEnd + (holdEnd - introEnd) * HOLD_FRACTION;
    A.shrink1Out = holdEnd;

    if (work && work.at) {
      A.morphIn = work.at(W_MORPH_FROM);
      A.morphOut = work.at(W_MORPH_TO);
      A.shrink2In = work.at(W_SHRINK_FROM);
      A.shrink2Out = work.at(W_SHRINK_TO);
      A.grows = true;
    } else {
      /* No pinned slide sequence (js/scenes-work.js is desktop-only), so there
         is no slide 4 to grow into: the headline stays where it settled and
         only changes its word.

         TIMED AGAINST THE PROJECTS THEMSELVES, not against the section box.
         Anchoring to #other's top was wrong once the phone layout got the
         wider gaps Amanda asked for: measured at 375px, the section's top is
         a full viewport and a half below the point one viewport before it, so
         the headline was already reading OTHER WORK while selected projects 4
         and 5 were still on screen, and it retired while the third other-work
         project was still mid-screen. Both are what a reader would call
         simply wrong.

         The cards are what the reader actually sees, and the section box is
         not — it carries ~96px of padding at each end. So the word changes as
         the FIRST other-work project comes up the screen, and the headline
         leaves once the LAST one has passed under it (G.restBottom is where
         "under it" is). */
      var cards = document.querySelectorAll(".owork__card");
      var other = document.getElementById("other");
      var firstTop = cards.length ? docTop(cards[0]) : (other ? docTop(other) : null);
      var lastBottom = cards.length ? docBottom(cards[cards.length - 1])
                                    : (other ? docBottom(other) : null);

      A.morphIn = firstTop == null ? null : firstTop - vh * 0.72;
      A.morphOut = firstTop == null ? null : firstTop - vh * 0.50;
      A.shrink2In = null;
      A.shrink2Out = null;
      A.grows = false;

      A.retireIn = lastBottom == null ? null : lastBottom - G.restBottom;
      A.retireOut = lastBottom == null ? null : lastBottom - G.restBottom + vh * 0.14;
      A.retireFromCards = lastBottom != null;
    }

    /* RETIRE — with the three other-work cards, not a screen and a half after
       them. Amanda: "The 'Other work' headline should disappear the moment the
       3 projects disappearing. So, the next section which is bottom CTA +
       footer can have clean start earlier."

       Anchored to js/scenes-outro.js's own slide, which publishes the same
       progress-to-pixel mapping js/scenes-work.js does: the cards start
       leaving at 0.80 and are gone at 1.0, and this rides exactly that. It
       used to key off #outro's top instead, which is one viewport further
       down — so the watermark hung around over an empty screen for the whole
       approach to the closing block.

       The fallback is that same approach, for the widths where the cards are
       ordinary content rather than a slide and there is no mapping to read. */
    var otherScene = window.V3.other;
    if (otherScene && otherScene.at) {
      A.retireIn = otherScene.at(0.80);
      A.retireOut = otherScene.at(1);
    } else if (!A.retireFromCards) {
      // Neither a slide to leave with nor a card to leave after: fall back to
      // the closing block's own arrival.
      var outroTop = outro ? docTop(outro) : null;
      A.retireIn = outroTop == null ? null : outroTop - vh * 0.62;
      A.retireOut = outroTop == null ? null : outroTop - vh * 0.28;
    }
  }

  /* ---------- render ----------
     The whole feature. Everything below is written on every call; nothing is
     conditional on "did this change", because a value that is only sometimes
     written is a value that can be stale, and every instant jump this page
     allows skips every intermediate frame. */
  function render(y) {
    var arrive = ramp(y, A.arriveIn, A.arriveOut);
    var down1 = ramp(y, A.shrink1In, A.shrink1Out);
    var morph = A.morphIn == null ? 0 : ramp(y, A.morphIn, A.morphOut);
    var down2 = A.shrink2In == null ? 0 : ramp(y, A.shrink2In, A.shrink2Out);
    var retire = A.retireIn == null ? 0 : ramp(y, A.retireIn, A.retireOut);
    var up = A.grows ? morph : 0;

    /* PROMINENCE — 1 is the landed headline, 0 the watermark. The four moves
       between those states are strictly ordered and never overlap, which is
       what lets one expression cover all of them: down1 is over before up
       begins, and up is over before down2 begins. Clamped anyway, because a
       future edit that broke that ordering should degrade to "at one end or
       the other", not to a headline three times its own size. */
    var prom = (1 - down1) + up * (1 - down2);
    if (prom < 0) prom = 0; else if (prom > 1) prom = 1;

    head.style.top = lerp(G.restTop, G.landedTop, prom).toFixed(1) + "px";
    head.style.fontSize = lerp(G.restFs, G.landedFs, prom).toFixed(2) + "px";
    head.style.color = "rgba(0,0,0," + lerp(G.restAlpha, 1, prom).toFixed(4) + ")";
    head.style.opacity = (1 - retire).toFixed(3);

    /* The backdrop's strength, for the mobile title bar (css/v3.css reads it;
       no desktop rule does, so this is inert there). 1 once the headline has
       settled at the top, 0 while it is out in the middle of the screen being
       read — a white band across the middle of the page would be absurd, and
       the same number that puts the headline at the top is the one that says
       the band belongs there. */
    head.style.setProperty("--mhead-veil", (1 - prom).toFixed(3));
    // Hidden before it has arrived and after it has gone — not merely
    // transparent, so it is also out of hit-testing and off the compositor.
    head.style.visibility = (arrive > 0 && retire < 1) ? "visible" : "hidden";

    /* ---- the glyphs ----
       LAYOUT is a function of `morph` alone: every cell's width is
       interpolated between the width of the character it starts as and the
       width of the one it becomes, in em. It does NOT depend on which random
       glyph happens to be showing, which is what stops the headline reflowing
       while it scrambles. Smoothstepped so all the cells re-space as one
       gesture rather than each at its own moment. */
    var wT = smoothstep(morph);
    var i, c;
    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      c.el.style.width = lerp(c.wA, c.wB, wT).toFixed(4) + "em";
    }

    if (arrive < 1) {
      // ARRIVING from off-frame. js/arrival.js writes transform, opacity,
      // blur and text for every cell — it is the single writer for those four
      // while it is in charge, and the branches below are the single writer
      // for them the rest of the time.
      Arrival.render(cells, arrive, FLIGHT);
      return;
    }

    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      var op = 1, blur = 0, ch;

      if (morph > 0 && c.changes) {
        // CHANGING WORD. Only the word that actually changes scrambles —
        // "WORK." is the same in both, so putting it through the noise would
        // say something untrue about what is happening.
        var lm = Arrival.localOf(c.mi, morphCells, morph, MORPH_WIN, MORPH_LAND_BY);
        var arc = Math.sin(lm * Math.PI);
        op = 1 - (1 - MORPH_FADE_MIN) * arc;
        blur = MORPH_BLUR * arc;
        ch = lm <= 0 ? c.a
           : (lm >= 1 ? c.b
             : Arrival.GLYPHS.charAt(Math.floor(Math.random() * Arrival.GLYPHS.length)));
      } else {
        ch = morph >= 1 ? c.b : c.a;
      }

      c.el.style.transform = "none";
      c.el.style.opacity = op.toFixed(3);
      c.el.style.filter = blur > 0.05 ? "blur(" + blur.toFixed(2) + "px)" : "none";
      if (c.el.textContent !== ch) c.el.textContent = ch;
    }
  }

  /* ---------- driving it ----------
     On gsap's ticker rather than a scroll listener, because the page's
     scrubbed timelines keep moving for a beat after the scroll itself has
     stopped, and this has to stay in step with them. The early-out keeps it
     free: when the scroll position has not moved, this is one comparison. */
  var lastY = -1, ready = false;

  function tick() {
    if (!ready) return;
    var y = window.scrollY;
    if (y === lastY) return;
    lastY = y;
    render(y);
  }

  function remeasure() {
    measure();
    lastY = -1;
    ready = true;
    tick();
  }

  remeasure();
  // "refresh", not "refreshInit": #work and #outro are PINNED, so the scroll
  // positions of everything after them — and #work's own timeline mapping,
  // which measureAnchors() reads — are only correct once every trigger has
  // recalculated.
  ScrollTrigger.addEventListener("refresh", remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  gsap.ticker.add(tick);

  // Published for the tests and for anyone debugging in the console. Nothing
  // on the page reads it — that is the point.
  //
  // render() is also the only reliable way to VERIFY this in an automated
  // browser: rAF is throttled in a background or headless pane, so gsap's
  // ticker fires sporadically and a scripted scroll reads whatever the last
  // stray frame happened to write. Calling render(y) directly takes the frame
  // loop out of the loop, on the same code path tick() drives.
  window.V3.headline = {
    cells: cells, anchors: A, geom: G, render: render, measure: remeasure
  };
})();
