/* ============================================================
   WORK — four slides through one pinned stage.
   claude-handover/new-interaction-work/.

     1  Claude design skills: HAZEN
     2  pair 1 — Identity 2.0 + Aspire Web Design System
     3  pair 2 — Kayn Argan Oil + NOBI Bakery
     4  the OTHER WORK. headline

   FOUR slides. The three other projects are a slide too, but not
   one of THESE — they have their own stage and their own scene
   (js/scenes-outro.js), so this pin can release cleanly at the end
   of slide 4 and the OTHER WORK. headline can be back to its
   watermark before they arrive under it.

   Every slide has an ENTRY of its own, a HOLD of several scroll
   points, and a shared EXIT: upward while fading out. The holds
   are spans no tween covers, so the slide simply sits there while
   the reader scrolls — the same "a pause is the absence of a
   tween, not a tween that does nothing" shape the intro uses.

   Slide containers are NOT faded in, only out. Their entries are
   entirely their children's own animations (which already carry
   opacity), because fading the container in as well would mean
   every element fading twice over the same span and arriving at
   half speed.
   ============================================================ */
(function () {
  "use strict";

  var work = document.getElementById("work");
  if (!work) return;

  var slides = work.querySelectorAll(".wslide");
  if (!slides.length) return;

  // No-motion: css/v3.css stacks all four slides in normal flow at full
  // opacity and nothing here runs. That IS the readable page.
  if (!window.V3 || !window.V3.ready) return;

  /* The whole scene is desktop-only, on the SAME breakpoint css/v3.css gates
     the pin, the stacking and the start states on — see its note for why (a
     pinned slide has to fit one screen, and the pairs' cards do not at 375px).

     gsap.matchMedia, not a plain `if`: crossing the breakpoint on a resize
     has to REVERT everything this builds, not just stop updating it. A bare
     early return would leave a timeline and five ScrollTrigger-driven
     transforms alive from before the resize, writing to elements that CSS has
     since put back into normal flow. matchMedia's context reverts every tween
     and trigger created inside it, and rebuilds them if the viewport crosses
     back. */
  var mm = gsap.matchMedia();

  mm.add("(min-width: 761px)", function () {

    /* ---------- slide windows ----------
       Five equal slots on the timeline's own 0..1 scale. Inside each slot the
       entry runs, then nothing at all for HOLD_D, then the exit — which spills
       0.01 past the slot boundary so the outgoing and incoming slides cross
       briefly rather than leaving a blank frame between them.

       At a 520vh section and an 820px viewport this is ~3,530px of scrubbing:
       roughly 300px per entry, 370px per hold and 195px per exit. */
    var N = slides.length;                 // four
    var SLOT = 1 / N;                      // 0.25 each
    var IN_D = 0.085;
    var HOLD_D = 0.105;
    var OUT_D = 0.055;
    var OUT_Y = 90;          // px each slide travels upward as it leaves

    function slotStart(i) { return i * SLOT; }
    function exitAt(i) { return i * SLOT + IN_D + HOLD_D; }

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: "#work",
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        // The pair cards' entry offsets are functions of their own measured
        // size, so they have to be recomputed whenever layout changes.
        invalidateOnRefresh: true,
        onUpdate: function (self) { onWorkUpdate(self.progress); }
      }
    });

    /* ---------- make the timeline exactly 1.0 long ----------
       GSAP derives a timeline's duration from where its LAST tween ends, and
       the slide exits end at 0.745. Everything else in this file — every slot
       boundary, and every headline constant below — is written as a position
       on a 0..1 scale, while onWorkUpdate is handed the ScrollTrigger's raw
       self.progress, which is ALWAYS 0..1. With a duration of 0.745 those were
       two different clocks: position 0.514 and progress 0.69 named the same
       moment, so the headline's morph fired a third of the way through pair 2
       instead of after it, and the last quarter of the section's scroll drove
       nothing at all.

       This pad makes the two scales identical, which is what the rest of the
       file has always assumed. (js/scenes-intro.js carries the same pad for
       the same reason; this file was written without it.) */
    tl.to({ _pad: 0 }, { _pad: 1, ease: "none", duration: 1 }, 0);

    /* ---------- the shared exit ----------
       Every slide but the last leaves the same way: upward, fading. The last
       one holds until the pin releases and the CTA scrolls up over it. */
    slides.forEach(function (slide, i) {
      if (i === N - 1) return;
      tl.to(slide, { opacity: 0, y: -OUT_Y, ease: "none", duration: OUT_D }, exitAt(i));
    });

    /* ---------- slide 1: HAZEN ----------
       Kept exactly as it was (Amanda: "Hazen intro, please keep as it is right
       now") — the rules wipe in from opposite edges, the thumbnail grows from
       20%, then the text and pill arrive in reading order. */
    (function () {
      var t = slotStart(0);
      tl.to(".srule--top", { scaleX: 1, ease: "none", duration: 0.030 }, t + 0.004)
        .to(".srule--bottom", { scaleX: 1, ease: "none", duration: 0.030 }, t + 0.004)
        .to(".hazen__media", { scale: 1, opacity: 1, ease: "none", duration: 0.042 }, t + 0.014)
        .to(".hazen__title", { opacity: 1, ease: "none", duration: 0.020 }, t + 0.040)
        .to(".hazen__pill", { opacity: 1, ease: "none", duration: 0.020 }, t + 0.048)
        .to(".hazen__desc", { opacity: 1, ease: "none", duration: 0.020 }, t + 0.055);
    })();

    /* ---------- slides 2 and 3: the paired projects ----------
       Both pairs arrive already in their staggered, "not aligned" positions —
       Amanda changed her mind about the flush-then-split opening ("instead of
       appearing aligned first, each pair can directly appear in that not
       aligned position, to reduce the intro scrolling time"), so the resting
       offset is pure CSS now and nothing animates toward it.

       Each thumbnail flies in from well outside the frame, diagonally: the
       left card from the top-left, the right card from the bottom-right. The
       travel is 65% of the card's OWN width and height, expressed as a GSAP
       function value so it is re-evaluated on every refresh (the ScrollTrigger
       above sets invalidateOnRefresh) — a fixed px offset would put a 1920px
       card and a 375px card in completely different places relative to the
       frame they are supposed to be mostly outside of.

       Its text follows immediately after its own thumbnail lands, per card,
       rather than both cards' text arriving together. */
    var CARD_TRAVEL = 0.65;

    Array.prototype.forEach.call(work.querySelectorAll(".wslide--pair"), function (slide, si) {
      var t = slotStart(si + 1);

      Array.prototype.forEach.call(slide.querySelectorAll(".wcard"), function (card, ci) {
        var media = card.querySelector(".wcard__media");
        var meta = card.querySelector(".wcard__meta");
        if (!media) return;

        // -1 = comes from the top-left, +1 = from the bottom-right.
        var dir = card.classList.contains("wcard--l") ? -1 : 1;
        // No lead. Both cards of a pair start and land TOGETHER — Amanda:
        // "you made it like, Identity first, then Aspire is a bit late;
        // please make both items of each pair appearing at the same time."
        // They already arrive from opposite corners, which is all the
        // difference the pair needs.
        var lead = 0;
        var mediaEnd = t + lead + 0.048;

        tl.fromTo(media, {
          x: function () { return dir * CARD_TRAVEL * media.offsetWidth; },
          y: function () { return dir * CARD_TRAVEL * media.offsetHeight; },
          scale: 1.38,
          opacity: 0,
          filter: "blur(18px)"
        }, {
          x: 0, y: 0, scale: 1, opacity: 1, filter: "blur(0px)",
          ease: "none", duration: 0.048
        }, t + lead);

        if (meta) {
          tl.to(meta, { opacity: 1, ease: "none", duration: 0.018 }, mediaEnd);
        }
      });
    });

    /* ---------- which slide owns the pointer ----------
       Without this all four stacked layers stay hit-testable and the topmost
       invisible one swallows every click meant for the visible one.

       This is now the ONLY thing this function does. It used to drive the big
       headline too — its blur, its clip, its size, its position, its colour
       and its scramble — from here, while js/scenes-selected.js drove the same
       properties from its own scenes earlier on the page. That split ownership
       was the source of the whole feature's defects. The headline is now owned
       end to end by js/headline.js, which reads the mapping published below
       and writes every one of its own properties itself. This file publishes
       WHEN things happen; it no longer says what the headline looks like. */
    /* A slide is SETTLED only during its hold: after its entry has finished and
       before its exit starts. is-live is a wider window -- it opens the moment
       the slot does, while the cards are still flying in -- and that is the
       right window for owning the pointer but the wrong one for animating
       anything. Amanda: "keep them frozen in frame 1 when in-transition
       (whether intro or outro). The hover animation only occurs when the
       thumbnails are already in their places."

       The last slide has no exit tween; it holds until the pin releases. */
    function settledIndex(p) {
      var i = Math.min(N - 1, Math.floor(p / SLOT));
      var into = p - slotStart(i);
      if (into < IN_D) return -1;                          // still arriving
      if (i < N - 1 && into >= IN_D + HOLD_D) return -1;   // already leaving
      return i;
    }

    function onWorkUpdate(p) {
      var live = Math.min(N - 1, Math.floor(p / SLOT));
      var settled = settledIndex(p);
      for (var i = 0; i < N; i++) {
        slides[i].classList.toggle("is-live", i === live);
        slides[i].classList.toggle("is-settled", i === settled);
      }
    }

    /* Published for js/headline.js: where a position on this timeline falls
       in DOCUMENT SCROLL PIXELS. The headline's own beats are specified
       against the slides ("after pair 2 has gone", "while HAZEN is up"), and
       this is the one honest way to express that without either file guessing
       at the other's numbers. Read fresh on every ScrollTrigger refresh, so it
       survives a resize and the pin spacer changing height. */
    window.V3.work = {
      tl: tl,
      at: function (p) {
        var st = tl.scrollTrigger;
        return st.start + (st.end - st.start) * p;
      }
    };

    // Returned to matchMedia as the context's cleanup: the is-live class is
    // written directly rather than through a tween GSAP can revert, so a
    // narrow viewport would otherwise inherit a stale one from the wide layout.
    // Dropping V3.work is what tells js/headline.js there is no pinned slide
    // sequence any more, so it re-anchors its own beats on the next refresh.
    return function () {
      for (var i = 0; i < N; i++) slides[i].classList.remove("is-live", "is-settled");
      window.V3.work = null;
    };
  });

  /* ---------- phones: five projects in a column ----------
     There is no slideshow here — a pinned slide has to fit one screen and
     these do not — so the five simply stack and scroll. What they were
     missing was any arrival at all: every start state above is gated to
     761px and up, so on a phone they were just there, all five, from the
     moment the section entered the document.

     Amanda: "Do the same headline animation + project interaction of the
     selected work section to the other work section." Same shape as the three
     other-work projects get in js/scenes-outro.js, and deliberately identical
     to it: one trigger PER project, keyed to its own top, so each arrives as
     it reaches the screen. A single trigger for the whole column would fire
     all five off the section's own top, which on a phone is thousands of
     pixels above the last of them.

     Start states are in css/v3.css's mobile block, gated on html.motion, so
     a resting page draws them all. */
  mm.add("(max-width: 760px)", function () {
    var items = work.querySelectorAll(".wslide--hazen .hazen, .wslide--pair .wcard");
    if (!items.length) return;
    var tweens = [];
    Array.prototype.forEach.call(items, function (el) {
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
