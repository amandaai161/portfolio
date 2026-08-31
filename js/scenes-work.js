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

    /* ---------- entries run on their own clock ----------
       Amanda: "when it's like 1 or 2 frames near the is-settled I can't really
       spot whether the thumbnails already done transitioning or still
       in-transition... The transition should keep playing automatically until
       they reach is-settled. So not every single frames of this section
       controlled by scroll-driven."

       A scrubbed entry can be parked anywhere, and its last frames are the
       ones nobody can see: at 96% the cards look landed but .is-settled is
       false, so hovering does nothing and there is no way to tell why. Reading
       until the content arrives and then STOPPING is exactly what a reader
       does, so that is where they got stuck.

       So the entries -- and only the entries, on the HAZEN slide and the two
       pairs -- came out of the scrubbed timeline. Crossing into a slot starts
       one; it then plays to the end on its own, whether or not scrolling
       continues. There is no partial arrival to be stranded in any more.

       The HOLD and the EXIT are still scrubbed. Scrolling is what carries a
       slide away, and an exit that auto-played would mean a pixel past the
       hold committing the whole slide to leave.

       ENTRY_SCALE converts the positions and durations below from the
       timeline's 0..1 units to seconds. It is 10 because that is what makes
       the entries take roughly as long as they used to at an ordinary scroll
       speed -- ~300px of scrubbing, per the note above. Every beat keeps its
       old proportions, so the choreography Amanda tuned is unchanged; only
       the clock driving it is different.

       ENTRY_EASE is the one real judgment call here, and it is a change. The
       old tweens are all `ease: "none"` because a scrubbed tween borrows its
       easing from the reader's own scroll. On their own clock they have no
       such input, and linear reads mechanical. Set it back to "none" to have
       the literal original. */
    var ENTRY_SCALE = 10;
    var ENTRY_EASE = "power2.out";

    /* The exit is played in BOTH directions -- forward as a slide leaves, and
       in reverse as the reader scrolls back up to it -- so it gets a symmetric
       ease rather than an out. A power2.out run backwards starts slow and ends
       in a rush, which is the wrong shape for an arrival. */
    var EXIT_EASE = "power2.inOut";

    function slotStart(i) { return i * SLOT; }
    function exitAt(i) { return i * SLOT + IN_D + HOLD_D; }

    /* One paused timeline per slide, or null where a slide has none of its own
       (the headline slide has no entry; the last slide has no exit). */
    var entries = new Array(N);
    var exits = new Array(N);

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
       one holds until the pin releases and the CTA scrolls up over it.

       ON ITS OWN CLOCK, like the entries, and for the same complaint one step
       further on. Amanda: "The scroll down is all good. The scroll up (going
       back to the previous section) is still an issue... when I scroll up to
       go back to pair 1, the pair 1 is already in place too fast."

       Coming back up to a slide is not that slide's entry replaying -- it is
       its EXIT running backwards, and while that was scrubbed it un-faded a
       whole slide across the ~195px the exit occupies. One flick of a
       trackpad and pair 1 was simply back. The arrival going down took 0.66s
       on a clock; going up it took as long as the flick did. That asymmetry
       is what read as "too fast".

       Driven the same declarative way as the entries, so it plays forward
       below the boundary and reverses above it, at the same pace either way.
       The trigger point is unchanged, so the slot rhythm is exactly as it
       was; only what happens once it fires is on a clock now. */
    slides.forEach(function (slide, i) {
      if (i === N - 1) return;
      exits[i] = gsap.timeline({ paused: true })
        .to(slide, { opacity: 0, y: -OUT_Y, ease: EXIT_EASE,
                     duration: OUT_D * ENTRY_SCALE });
    });

    /* ---------- slide 1: HAZEN ----------
       Kept exactly as it was (Amanda: "Hazen intro, please keep as it is right
       now") — the rules wipe in from opposite edges, the thumbnail grows from
       20%, then the text and pill arrive in reading order. */
    (function () {
      var S = ENTRY_SCALE;
      entries[0] = gsap.timeline({ paused: true })
        .to(".srule--top", { scaleX: 1, ease: ENTRY_EASE, duration: 0.030 * S }, 0.004 * S)
        .to(".srule--bottom", { scaleX: 1, ease: ENTRY_EASE, duration: 0.030 * S }, 0.004 * S)
        .to(".hazen__media", { scale: 1, opacity: 1, ease: ENTRY_EASE, duration: 0.042 * S }, 0.014 * S)
        .to(".hazen__title", { opacity: 1, ease: ENTRY_EASE, duration: 0.020 * S }, 0.040 * S)
        .to(".hazen__pill", { opacity: 1, ease: ENTRY_EASE, duration: 0.020 * S }, 0.048 * S)
        .to(".hazen__desc", { opacity: 1, ease: ENTRY_EASE, duration: 0.020 * S }, 0.055 * S);
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
      var S = ENTRY_SCALE;
      var entry = gsap.timeline({ paused: true });
      entries[si + 1] = entry;

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
        var mediaEnd = (lead + 0.048) * S;

        entry.fromTo(media, {
          x: function () { return dir * CARD_TRAVEL * media.offsetWidth; },
          y: function () { return dir * CARD_TRAVEL * media.offsetHeight; },
          scale: 1.38,
          opacity: 0,
          filter: "blur(18px)"
        }, {
          x: 0, y: 0, scale: 1, opacity: 1, filter: "blur(0px)",
          ease: ENTRY_EASE, duration: 0.048 * S
        }, lead * S);

        if (meta) {
          entry.to(meta, { opacity: 1, ease: ENTRY_EASE, duration: 0.018 * S }, mediaEnd);
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
    var lastP = 0;

    /* Start, finish or unwind each entry to match where the scroll now is.
       Written as a statement about every slide rather than as a reaction to
       crossing a boundary, so it lands in the right place however far and
       however fast the reader jumped. */
    function driveEntries(p) {
      var live = Math.min(N - 1, Math.floor(p / SLOT));
      for (var j = 0; j < N; j++) {
        var e = entries[j];
        if (!e) continue;

        if (j < live) {
          // passed. It is leaving or gone; do not animate it in behind that.
          if (e.progress() < 1) e.pause().progress(1);
        } else if (j > live) {
          // not reached yet, or the reader has scrolled back above it.
          if (e.progress() > 0 && !e.reversed()) e.reverse();
        } else if (p >= exitAt(j)) {
          // scrolled into this slide's exit before its entry finished: land it
          // rather than let it arrive and leave at the same time.
          if (e.progress() < 1) e.pause().progress(1);
        } else if (e.progress() < 1 || e.reversed()) {
          e.play();
        }
      }
    }

    /* The same shape for the exits. Only the live slide's exit is in motion:
       everything behind it has gone, everything ahead has not started. */
    function driveExits(p) {
      var live = Math.min(N - 1, Math.floor(p / SLOT));
      for (var j = 0; j < N - 1; j++) {
        var x = exits[j];
        if (!x) continue;

        if (j < live) {
          if (x.progress() < 1) x.pause().progress(1);
        } else if (j > live) {
          if (x.progress() > 0) x.pause().progress(0);
        } else if (p >= exitAt(j)) {
          if (x.progress() < 1 || x.reversed()) x.play();
        } else if (x.progress() > 0 && !x.reversed()) {
          x.reverse();
        }
      }
    }

    /* Which slide owns the pointer. Derived from the scroll position alone, so
       it is correct the moment onWorkUpdate runs and needs no help from the
       entry and exit timelines.

       There WAS a second, narrower class here -- .is-settled, true only between
       the end of a slide's entry and the start of its exit -- so the thumbnail
       hover could be held off during transitions. It is gone: it closed the
       instant an exit began, while the card was still fully on screen, so
       hovering a thumbnail and scrolling on snapped it back to frame 1 in plain
       sight. js/thumb-video.js follows .is-live now, which closes only once the
       slot is behind the scroll and the slide is off screen. */
    function syncClasses() {
      var live = Math.min(N - 1, Math.floor(lastP / SLOT));
      for (var i = 0; i < N; i++) {
        slides[i].classList.toggle("is-live", i === live);
      }
    }

    function onWorkUpdate(p) {
      lastP = p;
      driveEntries(p);
      driveExits(p);
      syncClasses();
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
    /* The pairs' travel is a function of each card's measured size, and only
       tweens inside the scrubbed timeline get those re-evaluated by
       invalidateOnRefresh. The entries are outside it now, so they need the
       same treatment by hand -- holding each one's position across the
       invalidate, or a resize would restart an arrival that had finished. */
    function reflowEntries() {
      for (var i = 0; i < N; i++) {
        var each = [entries[i], exits[i]];
        for (var k = 0; k < 2; k++) {
          var e = each[k];
          if (!e) continue;
          var at = e.progress();
          e.invalidate();
          e.progress(at);
        }
      }
    }
    ScrollTrigger.addEventListener("refresh", reflowEntries);

    return function () {
      ScrollTrigger.removeEventListener("refresh", reflowEntries);
      for (var i = 0; i < N; i++) {
        slides[i].classList.remove("is-live");
        if (entries[i]) entries[i].kill();
        if (exits[i]) exits[i].kill();
      }
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
