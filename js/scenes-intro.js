/* ============================================================
   Intro: three states arranged around the DEMO animation, all
   driven by one scrubbed timeline so scrolling up rewinds the
   whole sequence.

   Layout (css/v3.css owns the geometry; "Intro v2" frames 1-4):
     the demo animation sits dead-centre of the stage,
     headline 1 sits ABOVE it, headline 2 sits BELOW it,
     and the bio/avatar frame sits dead-centre, where the demo
     will later be.

   Beat order (Amanda's own list):
     1. headline 1 intro                    — at the centre
     2. headline 1 moves up + demo intro    — pushed to its slot above
     3. headline 1 out, headline 2 in       + DEMO PAUSES
     4. headline 2 font-change scan         — still paused
     5. demo continues                      — to its final frame
     6. the finished frame HOLDS, then leaves — demo and headline 2
        fade out together, drifting up, and the stage is empty
   Beat 7, the arrival of "SELECTED WORK.", is the one thing NOT on
   this page at all: js/headline.js owns that headline for its whole
   life, and it shares no element, no letter and no register with
   this sequence. What the two DO share is the pixel where beat 6
   begins — the arrival starts on it too, so the sentence dissolving
   and the headline assembling are one continuous move rather than
   two. See the tail block at the bottom of this file.
   ============================================================ */
(function () {
  "use strict";

  var demoBox = document.getElementById("demoAnim");
  var intro3 = document.getElementById("introHeadline3");

  /* ---------- ink measurement for "AI" / "the polish" ----------
     Both AFTER SVGs and both BEFORE SVGs are cropped tight to their own
     ink, so their sizing has to be driven by the headline's real ink
     height, not by 1em. See css/v3.css's scan block for the full
     reasoning and for what "glitch" this fixes. Runs UNCONDITIONALLY,
     before the motion gate below: the no-motion resting state paints the
     AFTER form too, and it needs the same correct size.

     Ink height rather than advance width on purpose — it is exactly the
     quantity each SVG's viewBox height is, and unlike width it is immune
     to .intro__h's letter-spacing (-0.02em), which the live text applies
     and the traced SVGs do not. */
  var inkCtx = null;

  function measureInk() {
    if (!intro3) return;
    if (!inkCtx) {
      var c = document.createElement("canvas");
      inkCtx = c.getContext && c.getContext("2d");
      if (!inkCtx) return;                     // no canvas: CSS em fallbacks stand
    }
    var cs = getComputedStyle(intro3);
    inkCtx.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;

    var write = function (inkProp, descProp, phrase) {
      var m = inkCtx.measureText(phrase);
      // actualBoundingBox* is what makes this an INK measurement rather than
      // a line-box one. Every current engine has it, but if it is ever
      // missing the right move is to leave css/v3.css's em fallbacks in
      // place rather than write a wrong px value over them.
      if (typeof m.actualBoundingBoxAscent !== "number" ||
          typeof m.actualBoundingBoxDescent !== "number") return;
      var ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      if (ink <= 0) return;
      intro3.style.setProperty(inkProp, ink.toFixed(2) + "px");
      // How far this phrase's ink reaches BELOW the baseline. css/v3.css
      // anchors each image by its bottom edge, which is the bottom of its
      // ink — so any word with a descender has to be pushed back down by
      // exactly this much or it floats above the line it belongs on.
      intro3.style.setProperty(descProp, m.actualBoundingBoxDescent.toFixed(2) + "px");
    };

    write("--ink-ai", "--desc-ai", "AI");                     // cap-height only, 56 units in its SVG
    write("--ink-polish", "--desc-polish", "the polish");     // ascender-to-descender, 74 units
  }

  measureInk();
  // A webfont swap after first paint changes the metrics measureText just
  // reported, so re-measure once the real font is in.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureInk);

  /* ---------- demo animation ----------
     Mounted and fitted UNCONDITIONALLY, before the V3.ready gate below —
     see that gate's own comment for why. mount() only builds the DOM/scene
     graph and fitTo() only sizes it; neither paints a frame. */
  if (demoBox && window.DemoAnim) {
    // is-mounted is what SIZES the box (css/v3.css) — it stays display:none
    // until here, so a visitor with scripting off gets no empty ~233px hole
    // where a JS-built animation would have been. Set before fitTo(), which
    // measures the host box and would read 0x0 from a display:none element.
    demoBox.classList.add("is-mounted");
    DemoAnim.mount(demoBox);
    DemoAnim.fitTo(demoBox);   // fitStage() alone would size it to the VIEWPORT
  }

  if (!window.V3 || !window.V3.ready) {
    // No-motion baseline: prefers-reduced-motion, a GSAP/ScrollTrigger/Lenis
    // CDN failure, or ?nomotion=1 (motion-core.js's diagnostic escape hatch)
    // all leave V3.ready false. This whole file used to return here before
    // ever mounting the demo animation, so #demoAnim stayed an EMPTY box —
    // css/v3.css's sizing applies unconditionally, so that was ~265px of
    // dead space at 1280px where the finished grid belongs, for every
    // visitor on this path. js/demo-anim.js's own note on why its
    // prefers-reduced-motion branch was stripped during extraction says
    // "motion gating is the host page's job now" — this file IS that host
    // page. Rendering the FINISHED frame (DemoAnim.END, the same value the
    // motion path eventually reaches — render() is a pure function of time,
    // so this cannot drift out of sync with it) shows the completed grid
    // statically, consistent with this codebase's "resting CSS is the final
    // state" invariant.
    if (demoBox && window.DemoAnim) DemoAnim.render(DemoAnim.END);
    return;
  }

  var stage = document.querySelector(".intro__stage");
  var s1 = document.querySelector(".intro__state--1");
  var s2 = document.querySelector(".intro__state--2");
  var s3 = document.querySelector(".intro__state--3");
  if (!stage || !s1 || !s2 || !s3) return;

  /* ---------- beat map ----------
     Positions on the timeline's own 0..1 scale, mapped across ~5,830px of
     scrubbing at an 820px viewport (css/v3.css's 800vh).

     The shape of this map is four HELD FRAMES with transitions between them,
     not a continuous crossfade. Amanda's note was that the whole section
     "feels all moving extremely too fast", and the cause was that every beat
     ran back-to-back with nothing between: the sequence never rested on any
     of the four states long enough to be read as a state. Each PAUSE below is
     a span where nothing writes anything — no tween covers it, so the frame
     simply holds while the reader scrolls.

     THE FOUR PAUSES, in runway px at an 820px viewport, and how they got
     there. Amanda reviewed them as screenshots and asked for two changes in
     opposite directions, which is why frame 1 and frame 4 both moved:

       frame 1  headline 1 alone, centred        1,333 -> 661
         "this frame's pause is too long. Please reduce it's pause scroll
         duration." It had been tripled the round before, on her own earlier
         note asking for more; halving it lands between the two.

       frame 2  headline 1 above, demo running     742 -> 739   (unchanged)
       frame 3  headline 2 below, both words scanned 495 -> 486 (unchanged)

       frame 4  the finished demo + headline 2      72 -> 580
         "this frame's pause is too fast, I think you don't apply any pause
         here." She was right, and the code did not show it: the beat map
         reserved ~520px of tail after the demo finished, but the letter
         flight started 451px before the section's end, INSIDE that tail. The
         genuinely still frame was what was left — 72px, about one wheel
         notch. Both numbers looked fine on their own; only their overlap was
         wrong. The tail at the bottom of this file now lays its spans out
         end-to-end instead, and this is the first of them.

       FRAME 1  headline 1 alone, centred
       FRAME 2  headline 1 above, demo animation begun
       FRAME 3  headline 2 below, "AI" and "the polish" scanned
       FRAME 4  demo animation complete

     THE DEMO ANIMATION'S RATE is the reason this section is as long as it is.
     Its two segments get 19.8% and 15.6% of a ~9,723px runway — 1,925px for
     the first 45% of the animation and 1,517px for the remaining 55%. That is
     42.8 and 27.6 px of scrolling per 1% of animation: exactly the 2x Amanda
     asked for, and 4x the rate this started at.

     Those two px figures are the fixed point of this whole map. The section
     grew from 1250vh to 1275vh to buy frame 4 its pause, and the two demo
     FRACTIONS shrank (0.202 -> 0.198, 0.159 -> 0.156) precisely so the
     PIXELS would not move — a longer section at the same fractions would
     have silently slowed the animation again, which nobody asked for. When
     either number here or the height in css/v3.css changes, check this
     product, not the fraction. */
  var BIO_OUT = 0.016, BIO_OUT_D = 0.030;
  var H1_IN = 0.040, H1_IN_D = 0.040;
  /*                       PAUSE 0.080 -> 0.148 — frame 1 held, ~661px */
  var RISE = 0.148, RISE_D = 0.039;
  /*                       SETTLE 0.187 -> 0.216 — headline 1 stops before the
                           demo starts */
  var DEMO_A = 0.216, DEMO_A_D = 0.198, DEMO_PAUSE_AT = 0.45;   // fraction of DemoAnim.END
  /*                       PAUSE 0.414 -> 0.490 — frame 2 held, ~739px */
  var H1_OUT = 0.490, H1_OUT_D = 0.035;
  var H2_IN = 0.517, H2_IN_D = 0.045;
  /*                       SETTLE 0.562 -> 0.588 */
  var SCAN = 0.588, SCAN_D = 0.041, SCAN_STAGGER = 0.021;
  /*                       PAUSE 0.650 -> 0.700 — frame 3 held, ~486px */
  var DEMO_B = 0.700, DEMO_B_D = 0.156;
  /*                       TAIL 0.856 -> 1.000, ~1,400px — frame 4 held, then
                           the outro, then the gap, then the letter flight.
                           See the tail block at the bottom of this file. */

  var DRIFT = 28;   // px of movement carried by each fade

  /* ---------- headline 1's rise ----------
     Amanda's item 4: headline 1 "is started with headline 1 position in the
     middle, and it's pushed to the top when the demo animation appears".
     Its RESTING position (css/v3.css) is the slot above the demo — that is
     where it ends — so the timeline has to start it one rise-distance lower,
     at the stage's centre line, and bring it home.

     riseY is measured rather than derived: it depends on the headline's own
     rendered height, which is a function of viewport width (it wraps to two
     lines at some widths and not others) and of the webfont. */
  var riseY = 0;

  function measureRise() {
    var sr = stage.getBoundingClientRect();
    var r2 = s2.getBoundingClientRect();
    // r2.top already includes whatever y this scene last wrote, so subtract
    // it back out to get the untransformed resting top. Reading the rect
    // without this correction during a mid-scroll refresh would feed the
    // scene's own output back in as its new start — the same class of bug
    // js/headline.js's measure() clears its own writes to avoid.
    var curY = (window.gsap && gsap.getProperty(s2, "y")) || 0;
    var restTop = r2.top - curY;
    riseY = (sr.top + sr.height / 2 - r2.height / 2) - restTop;
  }

  // One writer for s2's y, fed by THREE independent progress channels. Three
  // GSAP tweens writing `y` on the same element in adjacent ranges would each
  // latch their own start value on first render and fight across the
  // boundaries; one function reading three plain numbers cannot.
  //
  //   entry  headline 1 arrives rising from BELOW its centred position while
  //          it fades in, rather than materialising in place (Amanda: "coming
  //          slightly from the bottom while changing opacity to 100% not
  //          still"). Starts at riseY + DRIFT, i.e. one drift below centre.
  //   rise   centre -> the resting slot above the demo animation.
  //   exit   headline 1 leaves UPWARD (Amanda: "the headline 1 outro movement
  //          should go to the top instead of to the bottom") — hence the
  //          MINUS. It is the one state on this timeline that exits upward,
  //          because it is already the top element and sliding it further down
  //          across the demo animation read as it falling back through the
  //          frame it had just climbed out of.
  var s2y = { entry: 0, rise: 0, exit: 0 };
  function writeS2Y() {
    gsap.set(s2, {
      y: riseY * (1 - s2y.rise)
       + DRIFT * (1 - s2y.entry)
       - DRIFT * s2y.exit
    });
  }

  // One writer for s3, on the same two-channel pattern as writeS2Y above and
  // for the same reason. Headline 2 is now written from TWO places — the
  // timeline brings it in at H2_IN, and the outro at the bottom of this file
  // takes it out — and those are separate scroll ranges on separate triggers.
  // Two GSAP tweens on one element's opacity/y would each latch their own
  // start value on first render and fight wherever the ranges meet; one
  // function reading two plain numbers cannot.
  //
  //   entry  headline 2 arrives from just ABOVE its slot, drifting down as it
  //          fades up. (Unchanged — this was a .fromTo on the timeline.)
  //   exit   headline 2 leaves UPWARD, the same DRIFT and the same direction
  //          headline 1 leaves in. Amanda: "The end of intro2 section (The
  //          last frame of demo animation + headline 2) disappears normally,
  //          fading out, with a slight movement to the top just like how the
  //          headline 1's outro."
  var s3state = { entry: 0, exit: 0 };
  function writeS3() {
    gsap.set(s3, {
      opacity: s3state.entry * (1 - s3state.exit),
      y: -DRIFT * (1 - s3state.entry) - DRIFT * s3state.exit
    });
  }

  // Start-states, JS-applied so the resting CSS stays the final state.
  gsap.set(s2, { opacity: 0 });
  measureRise();
  writeS2Y();
  writeS3();

  // riseY depends on three things that all change after first paint: the
  // stage's height (viewport), the headline's own height (it wraps to a
  // different number of lines at different widths) and its font metrics
  // (the webfont swaps in late). Measuring once at build and never again
  // left it visibly wrong — caught in-browser: the pane opened shorter than
  // it settled at, and the headline started its rise 64px below the centre
  // instead of on it, because riseY still held the value computed against a
  // ~503px stage while the live stage was 632px.
  //
  // Both rects are read in the same frame and the stage's own offset
  // cancels out of the arithmetic, so this stays correct at any scroll
  // position — including a resize that fires while the intro is already
  // scrolled past and the sticky stage has released.
  var remeasureRise = function () { measureRise(); writeS2Y(); };
  ScrollTrigger.addEventListener("refreshInit", remeasureRise);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasureRise);

  if (demoBox && window.DemoAnim) DemoAnim.render(0);   // frame 0 paints nothing

  var demoProg = { v: 0 };
  function writeDemo() {
    if (window.DemoAnim) DemoAnim.render(demoProg.v * DemoAnim.END);
  }

  var tl = gsap.timeline({
    scrollTrigger: {
      trigger: "#intro",
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6
    }
  });

  /* Beat 1 — the bio frame leaves UPWARD, headline 1 arrives at the centre,
     rising into place from just below it as it fades up. Both the opacity and
     the entry channel run over the same span so the movement and the fade are
     one gesture rather than two.
     The bio used to drift DOWN as it faded, against the scroll; every other
     exit on this timeline (headline 1, headline 2) already leaves upward, so
     it now carries -DRIFT like the rest. */
  tl.to(s1, { opacity: 0, y: -DRIFT, ease: "none", duration: BIO_OUT_D }, BIO_OUT)
    .to(s2, { opacity: 1, ease: "none", duration: H1_IN_D }, H1_IN)
    .to(s2y, { entry: 1, ease: "none", duration: H1_IN_D, onUpdate: writeS2Y }, H1_IN)

  // s1's opacity fade (not autoAlpha — .intro__me's /about link must stay in
  // the accessibility tree) never removes it from the stack, so the link would
  // keep intercepting clicks meant for whatever is visually on top once it is
  // invisible. Switched off once the fade finishes, so it stays clickable at
  // rest; GSAP reverts this .set() automatically on scroll back up.
  //
  // Targets the LINK, not the state. css/v3.css takes pointer input away from
  // all three states permanently (see its note — an invisible headline sitting
  // over the bio was why the name could not be clicked) and gives it back to
  // this one element; setting it on the state here would have no effect on a
  // child that has opted back in.
    .set(".intro__me", { pointerEvents: "none" }, BIO_OUT + BIO_OUT_D)

  /* Beat 2 — headline 1 rises to its slot. The demo animation deliberately
     does NOT share this beat: it starts at DEMO_A, after a settle gap, so the
     headline has visibly stopped moving before anything appears beneath it.
     (They used to run together, which is what the "Intro v2" frames show —
     Amanda's revision splits them.) */
    .to(s2y, { rise: 1, ease: "none", duration: RISE_D, onUpdate: writeS2Y }, RISE)
    .to(demoProg, { v: DEMO_PAUSE_AT, ease: "none", duration: DEMO_A_D, onUpdate: writeDemo }, DEMO_A)

  /* Beat 3 — headline 1 leaves upward, headline 2 arrives below the demo.
     The demo is PAUSED from here: nothing writes demoProg again until
     DEMO_B. */
    .to(s2y, { exit: 1, ease: "none", duration: H1_OUT_D, onUpdate: writeS2Y }, H1_OUT)
    .to(s2, { opacity: 0, ease: "none", duration: H1_OUT_D }, H1_OUT)
    .to(s3state, { entry: 1, ease: "none", duration: H2_IN_D, onUpdate: writeS3 }, H2_IN)



  /* Beat 5 — the demo runs on to its final frame. (Beat 4, the font-change
     scan, is added below where the word geometry is measured.) */
    .to(demoProg, { v: 1, ease: "none", duration: DEMO_B_D, onUpdate: writeDemo }, DEMO_B)

  /* The quiet tail. This tween exists only to make the timeline's intrinsic
     duration exactly 1.0 rather than "wherever the last real beat happened
     to end" — GSAP derives duration from the last tween's end, and
     self.progress is mapped against that duration, so without this the last
     beat would be pinned to the very end of #intro's scroll and beat 6 (the
     letter flight, which runs on its own trigger over the last ~55vh of
     #intro) would have to happen ON TOP of the demo still finishing. The
     pad is what buys beat 6 a stretch of scroll where the sequence is
     complete and still, which is what "transition to Selected Work" wants
     to start from. */
    .to({ _pad: 0 }, { _pad: 1, ease: "none", duration: 1 - (DEMO_B + DEMO_B_D) }, DEMO_B + DEMO_B_D);

  /* ---------- Beat 4: the "AI" / "the polish" scan ----------
     ONE full-height vertical seam per word, travelling left to right.
     Everything left of the seam is the AFTER (decorative) form; everything
     right of it is the BEFORE (plain) form. Both images are clipped at the
     SAME x, so there is exactly one edge on screen at a time and the two
     letterforms are never both painting the same pixel — which is what
     makes it read as a scan rather than as two superimposed words.

     This replaced a one-sided reveal that clipped AFTER only and left
     BEFORE underneath at full opacity. Because both AFTER SVGs are STROKED
     OUTLINES, BEFORE's solid letterforms showed straight through AFTER's
     transparent interiors, which needed a separate "hide BEFORE once its
     own wipe finishes" step to cover up. Clipping BEFORE away as the seam
     passes removes the overlap by construction, so that step is gone. */
  var words = document.querySelectorAll(".intro__word");
  var afters = document.querySelectorAll(".intro__word-img--after");
  var befores = document.querySelectorAll(".intro__word-img--before");

  if (words.length && afters.length === words.length && befores.length === words.length) {
    var beforeW = [];
    var afterW = [];
    var span = [];      // max(beforeW, afterW) — the distance the seam covers

    var measureWords = function () {
      for (var i = 0; i < words.length; i++) {
        beforeW[i] = befores[i].getBoundingClientRect().width;
        afterW[i] = afters[i].getBoundingClientRect().width;
        span[i] = Math.max(beforeW[i], afterW[i]);
      }
    };

    // Both images' widths follow from the --ink-* custom properties written
    // above, so the ink measurement has to have landed before this runs.
    measureInk();
    measureWords();

    // Pin the pre-scan box to BEFORE's own width ONCE, at build time. This
    // runs only here, never inside measureWords, so a later re-measure
    // (resize, late webfont swap) updates the arrays the scan reads without
    // ever snapping an already-scrolled-into scan back to its start value.
    for (var j = 0; j < words.length; j++) {
      gsap.set(words[j], { width: beforeW[j] });
    }

    var remeasureWords = function () { measureInk(); measureWords(); };
    ScrollTrigger.addEventListener("refreshInit", remeasureWords);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasureWords);

    // One progress driver per word, each reading beforeW/afterW/span fresh
    // on every frame (not values captured at tween-build time) so a
    // re-measure is reflected immediately and smoothly.
    Array.prototype.forEach.call(words, function (word, i) {
      var prog = { v: 0 };
      tl.to(prog, {
        v: 1, ease: "none", duration: SCAN_D,
        onUpdate: function () {
          var p = prog.v;
          var seam = span[i] * p;

          // AFTER shows [0, seam]; its right inset is how much of its own
          // box is still to the right of the seam. Clamped at 0 because the
          // seam runs to span[i], which exceeds afterW whenever the AFTER
          // form is the narrower of the two ("the polish" is 0.84x).
          var afterInset = afterW[i] - seam;
          if (afterInset < 0) afterInset = 0;
          afters[i].style.clipPath = "inset(0 " + afterInset.toFixed(2) + "px 0 0)";

          // BEFORE shows [seam, beforeW]; its left inset IS the seam,
          // clamped so it never exceeds its own width.
          var beforeInset = seam > beforeW[i] ? beforeW[i] : seam;
          befores[i].style.clipPath = "inset(0 0 0 " + beforeInset.toFixed(2) + "px)";

          // The word's own box grows/shrinks from BEFORE's width to AFTER's
          // in step with the seam, which is what moves the neighbouring
          // words to make room ("AI" gets wider and pushes "to" right).
          // The AFTER image is absolutely positioned, so widening it alone
          // would push nothing — the box is the only thing in flow.
          word.style.width = (beforeW[i] + (afterW[i] - beforeW[i]) * p) + "px";
        }
      }, SCAN + i * SCAN_STAGGER);
    });
  }

  /* ============================================================
     THE TAIL — the last stretch of #intro, laid out as three spans:

       1. HOLD    frame 4 simply stands there. The demo animation is
                  complete, headline 2 is under it with both words
                  scanned, and nothing moves. ~720px at a 1044px
                  viewport.
       2. OUTRO   the demo animation and headline 2 fade out together,
                  drifting up. ~310px.
       3. ...and the arrival of "SELECTED WORK." (js/headline.js) runs
                  from the SAME pixel span 2 begins on, through to
                  #intro's own end.

     SPANS 2 AND 3 OVERLAP DELIBERATELY, and that is this round's
     change. Amanda: "The selected headline intro animation should
     start as the last frame of intro2 section is animating to
     disappear. So it creates a continuous transition." They used to
     run one after the other with an empty beat between them — which
     was the previous round's fix for a different complaint, and
     overcorrected into a gap. Starting them together means the first
     letters are already crossing the frame while the sentence is
     still dissolving, so one thing becomes the other instead of one
     thing ending and another starting.

     The overlap is expressed as ONE NUMBER, published below and read
     by js/headline.js as its own start. Two files agreeing on where
     this happens is a fact about the page, not two constants that
     have to be kept equal by hand.

     Measured from #intro's END rather than its start, in viewport
     heights: both spans are compositions of viewport-sized movement,
     so a viewport-relative offset keeps them the same gesture on any
     screen. A percentage of #intro's own height would not — the
     section is 1275vh on desktop and 1106vh on mobile, so the same
     percentage lands at a different point in the sequence on a phone.
     ============================================================ */
  var TAIL_OUTRO_IN = 1.00;    // vh before #intro's end: intro 2 starts leaving
  var TAIL_OUTRO_OUT = 0.70;   // ...and is gone

  // Functional rather than a fixed string because ScrollTrigger re-evaluates
  // it on refresh, which is what keeps it correct across a resize; a literal
  // "bottom-=820 bottom" would be one screen's number frozen onto every other.
  var beforeIntroEnd = function (vhs) {
    return function () {
      return "bottom-=" + Math.round(window.innerHeight * vhs) + " bottom";
    };
  };

  /* Span 2 — the outro. The demo animation and headline 2 are one frame and
     they leave as one gesture: same range, same progress, headline 2 also
     drifting up by the same DRIFT headline 1 exits with.

     Its own trigger rather than a beat on the main timeline, so the tail is
     described in one place, in the units it is actually reasoned about
     (viewport heights from the section's end) rather than as fractions of a
     timeline whose own length is set by the demo's rate.

     Written as a pure function of self.progress (never self.isActive), so an
     instant jump past this range — End key, scrollbar drag, a #hash deep-link
     — still leaves both things hidden rather than stranded at full opacity
     over the work section below. */
  ScrollTrigger.create({
    trigger: "#intro",
    start: beforeIntroEnd(TAIL_OUTRO_IN),
    end: beforeIntroEnd(TAIL_OUTRO_OUT),
    onUpdate: function (self) {
      var p = self.progress;
      s3state.exit = p;
      writeS3();
      if (demoBox) gsap.set(demoBox, { opacity: 1 - p });
    }
  });

  /* Published for js/headline.js: the one number that says where intro 2
     starts leaving, in viewport heights before #intro's end. That file
     measures #intro's bottom itself and starts its arrival on exactly this
     offset, so the two are continuous by construction rather than by two
     constants that happen to match today. */
  window.V3.introTail = { outroIn: TAIL_OUTRO_IN, outroOut: TAIL_OUTRO_OUT };

  // A console/debug handle only — nothing on the page reads it.
  window.V3.intro = { tl: tl };
})();
