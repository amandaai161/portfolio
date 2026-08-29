/* ============================================================
   THE BOTTOM OF THE PAGE — two scenes that used to be four
   sections scrolling into each other.

     #other   the three other-work cards, as ONE SLIDE: they rise
              in together, hold alone on screen, and leave upward.
              Amanda: "The 3 items appear like a slide show instead.
              Just like the selected section. The intro and outro
              animation can just be a simple fading in + out with
              movement from bottom to top."

     #outro   the CTA and the contact/footer, as ONE BLOCK. It is
              PINNED while its entrance plays — the headline
              assembles from outside the frame, then everything else
              fades up — and only then does the pin release and the
              block scroll normally. Amanda: "Wait until the headline
              took place, after that the other appears and this
              section is scrollable as usual. It can't be directly
              scrolled to the bottom when the bottom CTA headline
              still animating, otherwise, it might ruin the UX." The
              pin IS that guarantee: while it holds, scrolling drives
              the entrance instead of the page.

   The headline's arrival is js/arrival.js — the same code that
   assembles "SELECTED WORK." at the end of the intro, because Amanda
   asked for this one in that one's terms ("should be like the 13
   characters'"). One piece of code with two callers, rather than two
   that have to be kept looking alike.
   ============================================================ */
(function () {
  "use strict";
  if (!window.V3 || !window.V3.ready) return;

  /* ============================================================
     #other — one slide through a sticky stage
     ============================================================ */
  (function () {
    var section = document.getElementById("other");
    var cards = document.querySelectorAll(".owork__card");
    if (!section || !cards.length) return;

    var RISE = 60;      // px each card travels on the way in
    var LEAVE = 60;     // ...and on the way out

    /* Only where all three cards fit one screen side by side. Below 901px the
       grid drops to two columns and then one, which is taller than a stage —
       so there this stays ordinary flow with a plain reveal, built in the
       `else` branch. gsap.matchMedia rather than a bare `if`: crossing the
       breakpoint on a resize has to REVERT what it built, not merely stop
       updating it, or a narrow layout inherits a pinned stage's transforms. */
    var mm = gsap.matchMedia();

    mm.add("(min-width: 901px)", function () {
      /* IN 0.00-0.18 | HOLD 0.18-0.80 | OUT 0.80-1.00.
         At a 900px viewport the section's 240vh gives ~1,260px of scrub, so
         that is roughly 225px of entrance, 780px of hold and 250px of exit.
         The exit runs to the very end on purpose: that is the exact scroll
         position where the sticky stage releases, so the cards are still
         leaving as it starts to travel rather than vanishing early and
         leaving an empty stage to scroll away.
         The hold is a span no tween covers — "a pause is the absence of a
         tween, not a tween that does nothing", the same shape the intro and
         the work slides use. */
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: "#other",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6
        }
      });

      tl.fromTo(cards,
        { opacity: 0, y: RISE },
        { opacity: 1, y: 0, ease: "none", duration: 0.18, stagger: 0.035 }, 0);

      tl.to(cards, { opacity: 0, y: -LEAVE, ease: "none", duration: 0.20 }, 0.80);

      /* Force the timeline's own duration to exactly 1.0. GSAP derives
         duration from where the last tween ends, and everything above is
         written as a position on a 0..1 scale — without this pad the exit
         would be pinned to the very end of the section's scroll and the hold
         would be a third of what it says it is. (js/scenes-intro.js and
         js/scenes-work.js carry the same pad for the same reason.) */
      tl.to({ _pad: 0 }, { _pad: 1, ease: "none", duration: 1 }, 0);

      /* Published for js/headline.js, which retires the big "OTHER WORK."
         watermark against these same beats. Amanda: "The 'Other work' headline
         should disappear the moment the 3 projects disappearing. So, the next
         section which is bottom CTA + footer can have clean start earlier."
         Reading the mapping rather than guessing at a scroll offset is what
         makes "the moment" true at every viewport. */
      window.V3.other = { tl: tl, at: function (p) {
        var st = tl.scrollTrigger;
        return st.start + (st.end - st.start) * p;
      } };
      return function () { window.V3.other = null; };
    });

    mm.add("(max-width: 900px)", function () {
      /* Ordinary content: each card arrives as it scrolls up.

         ONE TRIGGER PER CARD, keyed to its own top. It used to be a single
         trigger on the grid with a stagger, which is right while the grid is
         a row and wrong the moment it is a column: at one column the third
         card sits ~1,600px below the grid's own top, so it had already
         finished animating long before it reached the screen. Same shape the
         five selected-work projects use on a phone (js/scenes-work.js), which
         is what makes the two sections feel alike — Amanda: "Do the same
         headline animation + project interaction of the selected work section
         to the other work section." */
      var tweens = [];
      Array.prototype.forEach.call(cards, function (el) {
        tweens.push(gsap.to(el, {
          opacity: 1, y: 0, ease: "none",
          scrollTrigger: { trigger: el, start: "top 88%", end: "top 52%", scrub: 0.7 }
        }));
      });
      return function () {
        tweens.forEach(function (t) { t.scrollTrigger && t.scrollTrigger.kill(); t.kill(); });
      };
    });
  })();

  /* ============================================================
     #outro — the CTA and the contact block, pinned while they arrive
     ============================================================ */
  (function () {
    var outro = document.getElementById("outro");
    var title = outro && outro.querySelector(".cta__title");
    var fades = outro ? outro.querySelectorAll(".outro__fade") : [];
    if (!outro || !title || !window.Arrival) return;

    var SEED = 23;                 // any constant; see Arrival.scatter for why
    var PIN_VH = 1.15;             // viewport-heights of scroll the entrance gets

    /* LETTERS COMING IN FROM THE FRONT OF THE SCREEN. Amanda, spelling out
       what she had been asking for: "All the letters coming in from outframe
       randomly, not just from the top of the screen. Some come from left, some
       right, some top, some bottom as well. All the letters are in
       significantly bigger size first + add more blurry effect before coming
       into the frame. So, it creates a realistic effect like they are coming
       from the front of the screen something like that."

       The timing is still the display headline's (win/landBy/fadeMin), so the
       gesture reads the same. What is different is the depth: curve "in" makes
       size, blur and translucency all decay to nothing by the landing rather
       than peaking mid-flight, so a glyph starts oversized and badly out of
       focus — the way something near a lens is — and resolves as it settles.
       scaleFrom is the largest a glyph starts at; js/arrival.js varies it and
       the blur together per glyph, which is what makes it read as distance
       rather than as one flat wall of letters.

       "not just from the top of the screen" was a real bug, not a taste
       note — see the origin passed in measure() below. */
    var FLIGHT = {
      win: 0.55, landBy: 0.78, fadeMin: 0.42,
      curve: "in", scaleFrom: 2.8, blur: 22
    };

    /* THE BEATS, on the pin's own 0..1:
         0.00 - 0.62   the headline assembles from outside the frame
         0.62 - 0.70   it stands there, alone and finished
         0.70 - 0.94   everything else fades up, staggered
         0.94 - 1.00   a beat before the pin releases
       Amanda: "Wait until the headline took place, after that the other
       appears." The gap between 0.62 and 0.70 is that wait — a span no tween
       covers, so the finished headline simply holds. */
    var HEAD_TO = 0.62;
    var FADE_FROM = 0.70, FADE_TO = 0.94;
    var FADE_Y = 34;

    /* Split each LINE separately, so the two blocks the markup declares stay
       two blocks. Cells come out in reading order across both, which is the
       order the stagger runs in. */
    var cells = [];
    Array.prototype.forEach.call(title.querySelectorAll(".cta__line"), function (line) {
      Arrival.splitLine(line, "cta__word", "cta__ch").cells.forEach(function (el) {
        cells.push({ el: el, ch: el.textContent, home: null, from: null, w: 0 });
      });
    });
    if (!cells.length) return;

    function measure() {
      // Clear this scene's own writes before reading anything back, or a
      // refresh mid-entrance feeds its output in as its new input.
      cells.forEach(function (c) {
        c.el.style.transform = "none";
        c.el.style.width = "";
        c.el.style.filter = "none";
        c.el.style.opacity = "1";
        c.el.textContent = c.ch;
      });
      title.style.visibility = "hidden";

      Arrival.measure(cells, {
        fontSize: parseFloat(getComputedStyle(title).fontSize) || 1,
        viewW: window.innerWidth, viewH: window.innerHeight,
        seed: SEED,
        /* THE FRAME THE FLIGHT HAPPENS IN. This block is measured while it is
           still far down the page and flown while it is PINNED at the top of
           the screen, so a home read in raw viewport coordinates is out by the
           whole distance between those two positions. Measured before this
           argument existed: every glyph started between 17,462 and 19,157px
           ABOVE the viewport, so all 33 streamed in from the top instead of
           scattering — "not just from the top of the screen".

           #outro's own rect is that frame: while pinned its top and left are
           zero, so subtracting it here expresses every home exactly where it
           will be when the glyphs fly home to it. */
        origin: outro.getBoundingClientRect(),
        // Glyphs start at scaleFrom, so clearing the frame by one glyph-width
        // would still leave them on screen. Clear by their drawn size instead.
        padScale: FLIGHT.scaleFrom
      });
      // Pin every glyph's width for good. Unlike the display headline these
      // never change character, so the pin is exact and permanent — it is here
      // purely so the scramble cannot relayout the sentence while it runs.
      cells.forEach(function (c) { c.el.style.width = c.w.toFixed(4) + "em"; });
    }

    /* PARKED — every glyph at home, nothing transformed. This is the state
       whenever the entrance is not running, and it is not merely tidiness.

       Unlike the display headline, which lives inside a position: fixed
       element, this block is ordinary flow. A transformed child of ordinary
       flow COUNTS AS SCROLLABLE OVERFLOW, so leaving the glyphs parked off
       screen gave the whole page a real horizontal scrollbar — measured at an
       845px viewport, the document became 1,251px wide and could be dragged
       406px sideways. (`overflow: clip` on #outro fixes the scrollbar and
       breaks the effect, since the glyphs are then clipped at the block's own
       edges rather than arriving from beyond them; `overflow-clip-margin`
       paints them again but puts every pixel of the margin straight back into
       the page's scroll area — measured: a 10px margin widened the document by
       exactly 10px, 200px by 200px.)

       Parking is the fix that costs nothing, because the glyphs only need to
       be off-frame while the entrance is actually playing — and while it is
       playing this section is PINNED, which means position: fixed, which means
       its children contribute nothing to the document's scroll area at all. */
    function park() {
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        c.el.style.transform = "none";
        c.el.style.opacity = "1";
        c.el.style.filter = "none";
        if (c.el.textContent !== c.ch) c.el.textContent = c.ch;
      }
    }

    function render(p) {
      // Written on every call, never skipped: an instant jump past this range
      // renders none of the frames in between, so the state has to be a pure
      // function of where the scroll is now.
      title.style.visibility = p > 0 ? "visible" : "hidden";
      if (p <= 0) park();
      else Arrival.render(cells, p / HEAD_TO > 1 ? 1 : p / HEAD_TO, FLIGHT);

      var n = fades.length;
      for (var i = 0; i < n; i++) {
        // Staggered across the fade span, each item over half of it, so they
        // arrive in order rather than as one block.
        var start = FADE_FROM + (FADE_TO - FADE_FROM) * (i / n) * 0.5;
        var end = start + (FADE_TO - FADE_FROM) * 0.5;
        var f = p <= start ? 0 : (p >= end ? 1 : (p - start) / (end - start));
        f = Arrival.smoothstep(f);
        fades[i].style.opacity = f.toFixed(3);
        fades[i].style.transform = f >= 1 ? "none"
          : "translateY(" + (FADE_Y * (1 - f)).toFixed(1) + "px)";
      }
    }

    measure();
    render(0);

    ScrollTrigger.create({
      trigger: "#outro",
      start: "top top",
      // A fixed distance rather than the section's own height: what is being
      // scrolled through here is the ENTRANCE, which is the same gesture
      // whatever the block below it happens to measure. Functional so it is
      // re-evaluated on refresh and stays right across a resize.
      end: function () { return "+=" + Math.round(window.innerHeight * PIN_VH); },
      pin: true,
      pinSpacing: true,
      /* STATED, not inherited. ScrollTrigger picks "fixed" or "transform" for
         itself depending on the scroller, and which one it picks matters here:
         a transform-pinned block stays in ordinary flow, and the glyphs this
         scene throws outside the frame would then count as the page's own
         scrollable overflow and give it a horizontal scrollbar mid-entrance.
         Under "fixed" they cost nothing, because a fixed element's children
         are invisible to the document's scroll area. Verified live — pinned at
         progress 0.4, position: fixed, document width equal to the viewport's
         with every glyph off-frame. Written down so a future default cannot
         quietly change it. (The at-rest half of the same problem is park();
         see its note.) */
      pinType: "fixed",
      // No scrub: nothing is attached to this trigger to smooth. Everything is
      // written by hand in onUpdate from self.progress, which is the raw,
      // un-smoothed scroll-derived value — the same arrangement js/headline.js
      // uses and for the same reason.
      onUpdate: function (self) { render(self.progress); },
      onRefresh: function (self) { measure(); render(self.progress); }
    });

    /* ---------- the contact block, on its own way up ----------
       NOT part of the entrance above. Amanda: "The bottom CTA section should
       appears first, then once we scroll, the footer appears." The CTA fills
       the whole first screen (css/v3.css), so while the headline is arriving
       none of this is visible — fading it in there would spend the animation
       on something nobody can see, and would have it already finished by the
       time it scrolled into view.

       Its own scrubbed trigger instead, so each piece arrives as it reaches
       the screen. Same shape as everything else on this page: a start state in
       CSS, one writer, and a scrub rather than a one-shot so scrolling back up
       takes it away again. */
    var rising = document.querySelectorAll("#outro .outro__rise");
    if (rising.length) {
      gsap.to(rising, {
        opacity: 1, y: 0, ease: "none", stagger: 0.2,
        scrollTrigger: {
          trigger: ".contact",
          // .contact sits INSIDE #outro, which is pinned above. Without this,
          // ScrollTrigger measures this trigger's start/end from the unpinned
          // layout and every position is out by the whole pinned distance —
          // the reveal would fire a screen and a bit before the block arrives.
          pinnedContainer: "#outro",
          start: "top 82%",
          end: "top 30%",
          scrub: 0.7
        }
      });
    }
  })();
})();
