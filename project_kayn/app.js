/* ============================================================================
   KAYN 2026 — app.js

   Storyboard 1  → the loader and the hero entrance  (buildIntro)
   Storyboard 2  → the scroll-scrubbed film and the USP ring  (buildFilm)
   Everything else → section reveals, masthead, drawer, parallax

   Motion states live on <html data-motion>:
     "pending"  loader up, scroll locked, all reveal targets pre-hidden by CSS
     "ready"    handed over; reveals are driven by ScrollTrigger
     "off"      reduced motion, or GSAP unavailable — everything is visible
   ========================================================================= */
(function (window, document) {
  "use strict";

  var CONFIG = {
    /* Smooth scroll. Lenis animates the *real* scrollTop, so position:sticky and
       the native scrollbar keep working — a transform-based scroller would break
       every pinned stage on this page. */
    smoothScroll: true,
    /* `anchors: false` — nothing on the page links to a section any more. Every
       nav, footer and CTA link is a bare `#` placeholder (see links.js), so
       Lenis has no anchor to resolve and must not try. */
    lenis: { duration: 1.05, wheelMultiplier: 1, syncTouch: false, anchors: false, autoRaf: false },

    /* Lenis easing and ScrollTrigger scrub stack in series. Two full-strength
       easings feel floaty, so scrub drops while Lenis is driving. */
    scrub: 0.5,
    smoothScrub: 0.18,

    /* Loader (Storyboard 1.1–1.3). The ring is a progress bar bent into a
       circle: it fills clockwise from 12 o'clock tracking the real asset load,
       then erases clockwise from the same point. */
    ringMinMs:  900,    /* ms — floor, so a warm cache still shows the count */
    ringHold:   0.45,   /* s — scene 1.2, the beat at 100% */
    ringErase:  0.95,   /* s — scene 1.3, same rotational direction */
    assetTimeout: 9000, /* ms — never trap the page behind a stalled asset */

    /* Film section (Storyboard 2). Fractions of the section's scroll run.
       The stage is pinned from scroll 0 and the hero dissolves on top of it, so
       the opening beats play under the hero on purpose — the two are meant to
       overlap.

       The film is not a single linear scrub. It lands, rests, then creeps: the
       render itself holds dead still on frames 46–51 and again on 92–95, with a
       slow push-in between them. holdFrame parks the scrub on the first of those
       stills so the landing gets a real beat before the push-in starts. */
    filmLead:   0.03,   /* frame 0 held this long — ~100px on a 720-tall screen */
    holdFrame:  45,     /* the frame the bottle rests on (source still 46–51) */
    filmSettle: 0.278,  /* frames 0 → holdFrame land here */
    holdEnd:    0.463,  /* …and hold until here */
    filmEnd:    0.710,  /* the push-in to the last frame finishes here */
    ringStart:  0.340,  /* the USP ring begins during the hold */
    ringEnd:    0.895,  /* …and finishes here; the rest is a held beat */
    uspSpan:    0.055   /* how long one USP takes to arrive */
  };

  var html = document.documentElement;
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var HAS_GSAP = !!(gsap && ScrollTrigger);

  var lenis = null;
  var lenisTick = null;

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

  /* ─────────────────────────────────────────────────────────────────────────
     Bail-out path. No GSAP or reduced motion: show the page, no choreography.
     ───────────────────────────────────────────────────────────────────────── */
  function standDown(reason) {
    html.setAttribute("data-motion", "off");
    var loader = $("#loader");
    if (loader) loader.hidden = true;
    var rule = $(".masthead__rule");
    if (rule) rule.style.transform = "none";
    if (reason) console.info("[KAYN] Motion disabled — " + reason);

    /* The arcs are drawn by the timelines, so with motion off they have no
       geometry at all until we close them here. */
    $$(".loader__arc, .hero__arc, .origin__arc, .film__arc").forEach(ringSolid);
    $$(".film__pins circle").forEach(function (c) { c.style.opacity = "1"; });

    /* The film still gets its last frame so the section isn't an empty box. */
    var v = $("#film-video");
    if (v && window.KAYNFilm) {
      window.KAYNFilm.attach(v, window.KAYNFilm.config.src).then(function (f) {
        f.setProgress(1);
      });
    }
    initDrawer();
  }

  if (!HAS_GSAP) { document.addEventListener("DOMContentLoaded", function () { standDown("GSAP did not load"); }); return; }
  if (REDUCED)   { standDown("prefers-reduced-motion"); return; }

  gsap.registerPlugin(ScrollTrigger);

  /* ─────────────────────────────────────────────────────────────────────────
     SMOOTH SCROLL
     ───────────────────────────────────────────────────────────────────────── */
  function initLenis() {
    if (!CONFIG.smoothScroll || typeof window.Lenis !== "function") return null;
    try {
      var l = new window.Lenis(CONFIG.lenis);
      /* Wrapped, not passed by reference: Lenis hands its instance to the
         listener and ScrollTrigger.update() reads argument 0 as a `force` flag,
         which would make every scroll event a full recalculation. */
      l.on("scroll", function () { ScrollTrigger.update(); });
      lenisTick = function (time) { l.raf(time * 1000); };
      gsap.ticker.add(lenisTick);
      gsap.ticker.lagSmoothing(0);
      return l;
    } catch (err) {
      console.warn("[KAYN] Smooth scroll unavailable — native scroll.", err);
      return null;
    }
  }

  function scrubValue() { return lenis ? CONFIG.smoothScrub : CONFIG.scrub; }

  /* ─────────────────────────────────────────────────────────────────────────
     ASSET GATE — what the loader is actually waiting for
     ───────────────────────────────────────────────────────────────────────── */
  function decodeImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        if (img.decode) img.decode().then(resolve, resolve); else resolve();
      };
      img.onerror = resolve;
      img.src = src;
    });
  }

  function loadAssets(onProgress) {
    var filmDone = 0, heroDone = 0;
    function report() { onProgress(filmDone * 0.72 + heroDone * 0.28); }

    var film = window.KAYNFilm
      ? window.KAYNFilm.preload(function (p) { filmDone = p; report(); })
      : Promise.resolve(null);

    var hero = decodeImage("images/2026kayn-hero.webp").then(function () { heroDone = 1; report(); });

    var both = Promise.all([film, hero]).then(function (r) { return r[0]; });
    var cap = new Promise(function (res) { setTimeout(function () { res(null); }, CONFIG.assetTimeout); });
    return Promise.race([both, cap.then(function () { return film; })]);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     STORYBOARD 1 — loader → hero entrance
     ───────────────────────────────────────────────────────────────────────── */
  function buildIntro(filmURL) {
    var loader     = $("#loader");
    var loaderArc  = $(".loader__arc");
    var loaderMark = $(".loader__mark");
    var navMark    = $(".masthead__mark");
    var heroArc    = $(".hero__arc");
    var heroImg    = $(".hero__img");
    var heroScrim  = $(".hero__scrim");
    var heroTitle  = $(".hero__title");
    var heroLines  = $$(".hero__title .line__in");
    var heroLede   = $(".hero__lede");
    var heroCta    = $(".hero__cta");
    var navLinks   = $$(".masthead .navlink");
    var navRule    = $(".masthead__rule");

    /* Narrow and portrait rewrap the H1, so its spans are inline and cannot be
       masked or transformed — the whole title lifts instead. Mirrors the
       matching query in styles.css. */
    var titleInline = window.matchMedia("(max-width: 900px), (max-aspect-ratio: 3/4)").matches;

    /* Pre-state for the pieces the timeline drives. */
    gsap.set(heroImg,   { opacity: 0, yPercent: -3 });
    gsap.set(heroScrim, { opacity: 0, xPercent: -22 });
    gsap.set([heroLede, heroCta], { opacity: 0, x: -34 });
    gsap.set(navLinks,  { opacity: 0, y: -10 });
    if (titleInline) gsap.set(heroTitle, { opacity: 0, y: 34 });
    else gsap.set(heroLines, { yPercent: 108 });

    /* Scenes 1.1 and 1.2 — the fill and the count — are not on this timeline;
       they run for as long as the assets take (see runLoadRing). This one is
       everything after 100%, and is played once the ring is full. */
    var tl = gsap.timeline({
      paused: true,
      defaults: { ease: "power2.inOut" },
      onComplete: function () {
        loader.hidden = true;
        html.setAttribute("data-motion", "ready");
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
      }
    });

    /* The readout goes first, then a beat on the closed circle. */
    tl.to($("#loaderPct"), { opacity: 0, duration: 0.3, ease: "power2.out" }, 0)
      .to({}, { duration: CONFIG.ringHold }, 0);

    /* Scene 1.3 — the circle erases clockwise from the same point it started, as
       if rubbed out with the pen still travelling; the wordmark shrinks into the
       slot it will occupy in the masthead. Measured, not guessed. */
    var flip = measureFlip(loaderMark, navMark);
    /* The portrait masthead sets the wordmark in gold, so the flight carries the
       colour across too — otherwise the handover pops. */
    var landingFill = getComputedStyle(navMark).fill;
    var loaderErase = { p: 0 };
    tl.addLabel("erase", CONFIG.ringHold + 0.3)
      .to(loaderErase, {
        p: 1, duration: CONFIG.ringErase, ease: "power1.inOut",
        onUpdate: function () { ringErase(loaderArc, loaderErase.p); }
      }, "erase");

    /* The wordmark leaves at 5% of the erase, so the two gestures overlap almost
       from the first stroke of the rubber. The flight lasts as long as the erase
       itself, which lands the mark on the masthead a beat after the ring is gone.
       Everything downstream hangs off this label, so the whole opening re-times
       with `flightAt`. */
    var flightAt = CONFIG.ringHold + 0.3 + CONFIG.ringErase * 0.05;
    tl.addLabel("flight", flightAt)
      .to(loaderMark, {
        x: flip.dx, y: flip.dy, scale: flip.scale, fill: landingFill,
        duration: CONFIG.ringErase, ease: "power3.inOut"
      }, "flight")
      /* Cross-dissolve at the landing: the flying mark goes out with the loader
         while the real masthead mark comes up underneath it. */
      .to(loader, { opacity: 0, duration: 0.5, ease: "power2.out" }, "flight+=0.60")
      .set(navMark, { opacity: 1 }, "flight+=0.84");

    /* Scene 1.4 — the next arc starts while the mark is still travelling, so the
       line reads as one continuous gesture; the hero fades in from slightly above. */
    var heroDraw = { p: 0 };
    tl.to(heroDraw, {
        p: 1, duration: 1.5, ease: "power1.out",
        onUpdate: function () { ringDraw(heroArc, heroDraw.p); },
        onComplete: function () { ringSolid(heroArc); }
      }, "flight+=0.50")
      .to(heroImg, { opacity: 1, yPercent: 0, duration: 1.7, ease: "power2.out" }, "flight+=0.43")
      .to(navRule, { scaleX: 1, duration: 1.25, ease: "power2.inOut" }, "flight+=0.73")
      .to(navLinks, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, ease: "power2.out" }, "flight+=0.83");

    /* Scene 1.5 — the frosted plate pans in from the left while it fades, then
       the copy arrives from the left while the plate is still settling. */
    tl.to(heroScrim, { opacity: 1, xPercent: 0, duration: 1.35, ease: "power3.out" }, "flight+=0.66");

    if (titleInline) {
      tl.to(heroTitle, { opacity: 1, y: 0, duration: 1.3, ease: "expo.out" }, "flight+=0.93");
    } else {
      tl.to(heroLines, {
        yPercent: 0, opacity: 1, duration: 1.25, stagger: 0.11, ease: "expo.out"
      }, "flight+=0.93");
    }

    tl.to([heroLede, heroCta], {
        opacity: 1, x: 0, duration: 1.05, stagger: 0.1, ease: "expo.out"
      }, "flight+=1.20");

    return tl;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     RINGS
     Every ring on the page is drawn and erased through these, by generating the
     arc geometry outright rather than by masking a full circle with a dash.

     Dashes are the usual trick and they are a trap here: `stroke-dashoffset`
     reverses which end of the arc the gap eats into depending on sign, a
     1000/1000 pattern on a 1000-unit path renders identically at both ends of a
     draw, and the browser's start point and winding for `<circle>` are implicit.
     Between them, an inverted erase is invisible in the source and only shows up
     on screen. Emitting the path means the angles are stated, not inferred:

       ringDraw(el, p)   ink from the start point up to p   — the pencil
       ringErase(el, p)  ink from p to the end              — the rubber, moving
                                                              the same way round
       ringSolid(el)     the closed circle, with no join to see

     Angles run clockwise from 12 o'clock. An element with data-dir="ccw" runs
     the other way (the USP ring, Storyboard 2.3). Centre and radius come from
     data-cx / data-cy / data-r.
     ───────────────────────────────────────────────────────────────────────── */
  function polar(cx, cy, r, deg) {
    var rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx, cy, r, a0, a1) {
    var sweep = a1 - a0;
    if (Math.abs(sweep) < 0.01) return "";
    /* A single elliptical arc cannot close on itself — start and end would be
       the same point — so a full turn is emitted as two halves. */
    if (Math.abs(sweep) >= 359.99) {
      var top = polar(cx, cy, r, 0), bottom = polar(cx, cy, r, 180);
      var d = sweep > 0 ? 1 : 0;
      return "M " + top.x + " " + top.y +
             " A " + r + " " + r + " 0 1 " + d + " " + bottom.x + " " + bottom.y +
             " A " + r + " " + r + " 0 1 " + d + " " + top.x + " " + top.y + " Z";
    }
    var p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
    return "M " + p0.x + " " + p0.y +
           " A " + r + " " + r + " 0 " + (Math.abs(sweep) > 180 ? 1 : 0) +
           " " + (sweep > 0 ? 1 : 0) + " " + p1.x + " " + p1.y;
  }

  function ringSpan(el, from, to) {
    if (!el) return;
    var cx = parseFloat(el.getAttribute("data-cx")) || 0;
    var cy = parseFloat(el.getAttribute("data-cy")) || 0;
    var r  = parseFloat(el.getAttribute("data-r"))  || 0;
    var sign = el.getAttribute("data-dir") === "ccw" ? -1 : 1;
    el.setAttribute("d", arcPath(cx, cy, r, sign * from * 360, sign * to * 360));
  }

  function ringDraw(el, p)  { ringSpan(el, 0, clamp01(p)); }
  function ringErase(el, p) { ringSpan(el, clamp01(p), 1); }
  function ringSolid(el)    { ringSpan(el, 0, 1); }

  /* Scenes 1.1–1.2 — the ring as a progress bar bent into a circle.

     This deliberately is NOT a fixed-duration tween: it starts on the first
     frame and fills at the rate the assets actually arrive, so the ring is doing
     the job it appears to be doing. `ringMinMs` is a floor, so a warm cache
     still gets a readable count instead of a flash. The displayed value chases
     the target rather than snapping, which keeps the count smooth when a large
     chunk lands at once. */
  function runLoadRing(getProgress) {
    var arc = $(".loader__arc");
    var pct = $("#loaderPct");
    var shown = 0;
    var startedAt = 0;

    function paint(p) {
      ringDraw(arc, p);
      if (pct) pct.textContent = Math.round(p * 100) + "%";
    }

    paint(0);

    return new Promise(function (resolve) {
      function tick(time) {
        if (!startedAt) startedAt = time;
        var floor = Math.min(1, (time - startedAt) * 1000 / CONFIG.ringMinMs);
        var target = Math.min(getProgress(), floor);
        shown += (target - shown) * 0.12;
        if (target >= 1 && 1 - shown < 0.004) shown = 1;
        paint(shown);
        if (shown >= 1) {
          gsap.ticker.remove(tick);
          ringSolid(arc);          /* closed circle, no join to see */
          if (pct) pct.textContent = "100%";
          resolve();
        }
      }
      gsap.ticker.add(tick);
    });
  }

  /* FLIP: what transform carries `from` onto `to`, given `from` is untransformed. */
  function measureFlip(from, to) {
    var a = from.getBoundingClientRect();
    var b = to.getBoundingClientRect();
    var scale = b.width / a.width;
    return {
      scale: scale,
      dx: (b.left + b.width / 2) - (a.left + a.width / 2),
      dy: (b.top + b.height / 2) - (a.top + a.height / 2)
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     STORYBOARD 2.1 — the hero leaves, the still stays put
     ───────────────────────────────────────────────────────────────────────── */
  function buildHeroExit() {
    var heroArc = $(".hero__arc");
    var wipe = { p: 0 };
    function paintWipe() { ringErase(heroArc, wipe.p); }
    var tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: ".hero", start: "top top", end: "bottom bottom",
        scrub: scrubValue(), invalidateOnRefresh: true,
        onUpdate: paintWipe, onRefresh: paintWipe   /* see the note in buildFilm */
      }
    });
    /* The still no longer pushes in — it dissolves. The whole stage goes, so the
       paper underneath (and the film stage already pinned behind it) is what
       comes through, rather than the hero's own under-colour. */
    /* Fractions of a 90svh run. The stage dissolve deliberately owns three
       quarters of it and finishes only at the very end, so the hero leaves
       slowly while the film is already scrubbing underneath. */
    tl.to(".hero__copy", { opacity: 0, y: -70, duration: 0.30, ease: "power1.in" }, 0)
      .to(wipe, { p: 1, duration: 0.36, ease: "power1.inOut", onUpdate: paintWipe }, 0)
      /* The plate leaves the way it arrived — pushed back out to the left as it
         fades, mirroring Scene 1.5. */
      .to(".hero__scrim", { xPercent: -26, opacity: 0, duration: 0.40, ease: "power2.in" }, 0)
      .to(".hero__stage", { opacity: 0, duration: 0.75, ease: "power2.inOut" }, 0.25)
      .set(".hero__stage", { pointerEvents: "none" }, 0.99);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     FILM FRAMING
     Sit the seated bottle concentric with the USP ring, at the size the comp
     gives it (bottle 839px tall against a 574px ring = 1.46x).

     This has to be JS: once object-fit:contain starts letterboxing — which it
     does the moment the stage aspect leaves 16/9 — the bottle's position
     inside the element stops tracking the element box, so no fixed CSS scale or
     object-position can hold it on the ring.
     ───────────────────────────────────────────────────────────────────────── */
  var HERO_ASPECT = 3840 / 2774;

  /* Size and place the hero still: the smallest render that still fills the
     frame (× --hero-zoom), with --focal-x/--focal-y put at the frame's centre.

     Zoom 1 is the floor — you cannot shrink the subject further without
     letterboxing the hero — and it is 33% smaller than the 1.5× the comp used.
     Both the size and the offset are written as pixels here rather than left to
     CSS, because GSAP owns `transform` on this element for the entrance and the
     scroll dissolve, and its CSSPlugin also clears the independent `translate`,
     `rotate` and `scale` properties. Margins it leaves alone. */
  function fitHero() {
    var media = $(".hero__media"), img = $(".hero__img");
    if (!media || !img) return;
    var fw = media.clientWidth, fh = media.clientHeight;
    if (!fw || !fh) return;

    var cs = getComputedStyle(img);
    var zoom = parseFloat(cs.getPropertyValue("--hero-zoom")) || 1;
    var fx = parseFloat(cs.getPropertyValue("--focal-x")) / 100;
    var fy = parseFloat(cs.getPropertyValue("--focal-y")) / 100;
    if (isNaN(fx) || isNaN(fy)) return;

    var w = Math.max(fw, fh * HERO_ASPECT) * zoom;
    var h = w / HERO_ASPECT;
    img.style.width  = w.toFixed(2) + "px";
    img.style.height = h.toFixed(2) + "px";
    img.style.marginLeft = (-fx * w).toFixed(2) + "px";
    img.style.marginTop  = (-fy * h).toFixed(2) + "px";
    return { frame: [fw, fh], w: Math.round(w), h: Math.round(h), zoom: zoom,
             ml: Math.round(-fx * w), mt: Math.round(-fy * h) };
  }

  var FILM_ASPECT = 1920 / 1080;   /* fallback until the decoder reports its own */
  var FILM_MIN_W  = 1000;          /* px — the film never renders narrower */
  var FILM_INSET  = 200;           /* px of paper held either side of the film */
  /* Portrait only: bottle height / ring diameter. Paired with the 145vw media
     area and the 56.7vw ring offset in styles.css — the three are derived from
     each other, so changing this one alone makes the picture overhang. */
  var FILM_RING_RATIO = 1.35;

  /* The one breakpoint that decides the film's whole layout. Declared here so
     the two matchMedia contexts and fitFilm cannot drift apart; the same split
     is mirrored in the `max-aspect-ratio: 1/1` block in styles.css. */
  var Q_LANDSCAPE = "(min-aspect-ratio: 1001/1000)";
  var Q_PORTRAIT  = "(max-aspect-ratio: 1/1)";
  function isPortrait() { return window.matchMedia(Q_PORTRAIT).matches; }

  /* Size, then place.

     SIZE — the film keeps its locked aspect and stays whole: as wide as the
     stage will take it less FILM_INSET either side, but never wider than the
     stage is tall enough to show, so no edge of the picture is ever cut. The
     `min(…, sh * aspect)` term is what does that: take the width alone and any
     viewport wider than the film's own aspect pushes the picture off the screen.
     FILM_MIN_W is the floor and the only case where cropping is allowed — below
     it the picture overhangs left and right rather than shrinking to a sliver on
     a phone. On a narrow screen the floor wins and eats into the inset.

     PLACE — not bottom-aligned, and not centred in the stage either: the film is
     hung off the object, so the settled bottle in the LAST frame lands dead
     centre in the USP ring. That is what keeps the two locked together at every
     viewport, since the bottle is neither centred nor square in its own picture
     (cx 50.86%, cy 62.04%).

     Because cx is not exactly 50%, centring the bottle leaves the picture very
     slightly off-centre — about 13px of difference between the left and right
     insets at 1920. The ring alignment is the thing worth being exact about.

     The box is sized directly rather than scaled: with `object-fit: fill` on a
     box already at the native aspect there is no letterbox padding in the
     geometry, so the numbers here are the numbers on screen. */
  function fitFilm() {
    var stage = $(".film__stage"), v = $(".film__video"), ring = $(".film__ring");
    if (!stage || !v) return;
    var sw = stage.clientWidth, sh = stage.clientHeight;
    if (!sw || !sh) return;
    var obj = (window.KAYNFilm && window.KAYNFilm.config.object) ||
              { h: 0.6574, cx: 0.5086, cy: 0.6204 };

    /* Prefer the decoder's own aspect: a re-export at a different frame size
       then needs no code change. */
    var aspect = (v.videoWidth && v.videoHeight) ? v.videoWidth / v.videoHeight
                                                 : FILM_ASPECT;
    /* Where the bottle has to end up. Measure the ring rather than recomputing
       it from tokens; if it is ever hidden, fall back to the same --ring-cy the
       ring itself would have used. */
    var rb = ring ? ring.getBoundingClientRect() : null;
    var ringVisible = !!(rb && rb.width > 0);
    var sb = stage.getBoundingClientRect();
    var target;
    if (ringVisible) {
      target = { x: rb.left - sb.left + rb.width / 2,
                 y: rb.top - sb.top + rb.height / 2 };
    } else {
      var cy = parseFloat(getComputedStyle(stage).getPropertyValue("--ring-cy"));
      target = { x: sw / 2, y: sh * ((isNaN(cy) ? 62 : cy) / 100) };
    }

    var avail = Math.max(0, sw - 2 * FILM_INSET);
    var w, h, ringSized = false;
    if (isPortrait() && ringVisible) {
      ringSized = true;
      /* Portrait sizes off the ring, not the stage. The stage is normal flow
         there and taller than the viewport, so stage width and height say
         nothing about how big the bottle should read; the ring is the only thing
         in the composition at a known scale. */
      h = (FILM_RING_RATIO * rb.width) / obj.h;
      w = h * aspect;
    } else {
      w = Math.max(FILM_MIN_W, Math.min(avail, sh * aspect));
      h = w / aspect;
    }

    var left = target.x - obj.cx * w;
    var top  = target.y - obj.cy * h;

    v.style.width  = w.toFixed(2) + "px";
    v.style.height = h.toFixed(2) + "px";
    v.style.left   = left.toFixed(2) + "px";
    v.style.top    = top.toFixed(2) + "px";
    v.style.transform = "none";

    return { stage: [sw, sh], box: [Math.round(w), Math.round(h)],
             left: Math.round(left), top: Math.round(top),
             inset: [Math.round(left), Math.round(sw - (left + w))],
             ringCentre: [Math.round(target.x), Math.round(target.y)],
             bottleCentre: [Math.round(left + obj.cx * w),
                            Math.round(top + obj.cy * h)],
             bottleTop: Math.round(top + (obj.cy - obj.h / 2) * h),
             bottleBase: Math.round(top + (obj.cy + obj.h / 2) * h),
             aspect: +aspect.toFixed(4),
             sizedFrom: ringSized ? "ring" : "stage",
             flooredToMin: !ringSized && w > avail,
             cropped: w > sw || h > sh };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     STORYBOARD 2.2 / 2.3 — the film, the headline, the ring
     ───────────────────────────────────────────────────────────────────────── */
  /* The scrub position of the frame the bottle rests on, as a 0–1 fraction.
     film.js maps p onto Math.round(p * (totalFrames - 1)), so this has to invert
     that rather than divide by the frame count. */
  function holdP() {
    var n = (window.KAYNFilm && window.KAYNFilm.frames()) || 95;
    return clamp01(CONFIG.holdFrame / (n - 1));
  }

  function buildFilm() {
    var film   = window.KAYNFilm;
    var lineL  = $(".film__title .line--from-left .line__in");
    var lineR  = $(".film__title .line--from-right .line__in");
    var arc    = $(".film__arc");
    var head   = $(".film__head");
    var pins   = $$(".film__pins circle");
    var items  = $$(".usp__item");

    var R = 287;                                  /* matches the SVG path radius */
    /* The ring no longer waits for the dropper to seat — it begins during the
       bottle's held beat so the six points arrive around a settled object. */
    var ringStart = CONFIG.ringStart;
    var ringRun = CONFIG.ringEnd - ringStart;

    /* Anchors, read off the markup so the copy and the line can never drift. */
    var anchors = items.map(function (el, i) {
      return {
        el: el,
        at: parseFloat(el.getAttribute("data-at")),
        dir: el.getAttribute("data-side") === "left" ? -1 : 1,
        pin: pins[i] || null,
        angle: parseFloat(el.getAttribute("data-angle"))
      };
    });

    /* Pin coordinates. `data-angle` is degrees clockwise from 12 o'clock. */
    anchors.forEach(function (a) {
      if (!a.pin) return;
      var r = a.angle * Math.PI / 180;
      a.pin.setAttribute("cx", (R * Math.sin(r)).toFixed(2));
      a.pin.setAttribute("cy", (-R * Math.cos(r)).toFixed(2));
    });

    /* Set the from-state in JS rather than leaving GSAP to parse a percentage
       translate out of the cascade. */
    gsap.set(lineL, { xPercent: -14, opacity: 0 });
    gsap.set(lineR, { xPercent: 14, opacity: 0 });

    var ring = { t: 0 };
    var proxy = { p: 0 };

    /* Same reason paintRing is wired to the trigger as well as the tween: a
       suppressed render applies tween values without firing onUpdate, and during
       the lead-in the film tween has not started at all, so nothing would tell
       film.js to go back to frame 0 when scrolling up into the section. */
    function paintFilm() {
      if (window.KAYNFilm) window.KAYNFilm.setProgress(proxy.p);
    }

    function paintRing() {
      var t = ring.t;
      ringDraw(arc, t);

      /* The travelling head runs counter-clockwise from 12 o'clock, matching the
         path's own direction (sweep-flag 0). */
      var a = 2 * Math.PI * t;
      head.setAttribute("cx", (-R * Math.sin(a)).toFixed(2));
      head.setAttribute("cy", (-R * Math.cos(a)).toFixed(2));
      head.style.opacity = t > 0.002 && t < 0.999 ? "1" : "0";

      anchors.forEach(function (an) {
        var k = clamp01((t - an.at) / CONFIG.uspSpan);
        var eased = k * k * (3 - 2 * k);                       /* smoothstep */
        an.el.style.opacity = String(eased);
        an.el.style.transform = "translateX(" + (an.dir * (1 - eased) * 20).toFixed(2) + "px)";
        if (an.pin) an.pin.style.opacity = String(eased);
      });
    }

    var tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: ".film", start: "top top", end: "bottom bottom",
        scrub: scrubValue(), invalidateOnRefresh: true,
        /* Painted from the trigger as well as from the tween. A tween's onUpdate
           is skipped whenever the timeline is rendered with events suppressed —
           which is what any manual seek does — while the tween's *values* are
           still applied. Repainting here keeps the line, the pins and the copy
           in step with ring.t no matter how the timeline got there. */
        onUpdate: function () { paintRing(); paintFilm(); },
        onRefresh: function () { paintRing(); paintFilm(); }
      }
    });

    /* The film itself. setProgress only records a target frame; film.js issues
       at most one seek per animation frame. */
    if (film) {
      var hp = holdP();
      /* Three tweens, not one. A single linear scrub across the whole run gives
         the landing no weight — the bottle arrives and immediately starts
         creeping again. Splitting it lets the scroll stop where the render
         stops: drop, rest, push in. */
      tl.to(proxy, {                                        /* the drop */
        p: hp, duration: CONFIG.filmSettle - CONFIG.filmLead, onUpdate: paintFilm
      }, CONFIG.filmLead)
        .to(proxy, {                                        /* the push-in */
          p: 1, duration: CONFIG.filmEnd - CONFIG.holdEnd, onUpdate: paintFilm
        }, CONFIG.holdEnd);
      /* filmSettle → holdEnd is deliberately empty: no tween is the hold. */
    }

    /* Scene 2.2 — line one in from the left, line two in from the right. */
    tl.to(lineL, { xPercent: 0, opacity: 1, duration: 0.14, ease: "expo.out" },
          CONFIG.filmLead)
      .to(lineR, { xPercent: 0, opacity: 1, duration: 0.14, ease: "expo.out" },
          CONFIG.filmLead + 0.035);

    /* Scene 2.3 — counter-clockwise from 12 o'clock; each USP is released as the
       head reaches its pin. */
    tl.to(ring, { t: 1, duration: ringRun, onUpdate: paintRing }, ringStart);

    /* Without this the timeline's own duration would be ringEnd, so ringEnd would
       land on the last pixel of the scroll run and the finished composition would
       never be held. The spacer buys that beat before the section unpins. */
    tl.to({}, { duration: 1 - CONFIG.ringEnd }, CONFIG.ringEnd);

    paintRing();
    return tl;
  }

  /* Portrait: no ring — the comp stacks the USPs under the bottle. */
  function buildFilmPortrait() {
    var film  = window.KAYNFilm;
    var title = $(".film__title");
    var arc   = $(".film__arc");
    var media = [$(".film__ring"), $(".film__video")].filter(Boolean);
    var items = $$(".usp__item");

    /* Nothing here scrubs. The bottle is its last frame and the ring is a closed
       circle — a still life the page scrolls past, not a sequence it drives.

       The film element stays a <video> rather than becoming an <img>: the same
       markup has to serve landscape, and matchMedia swaps these two builds live
       when the device rotates. That does mean a phone still downloads the whole
       2.4MB webm to show one frame of it. */
    function showLastFrame() {
      if (window.KAYNFilm) window.KAYNFilm.setProgress(1);
      ringSolid(arc);
    }
    showLastFrame();
    /* Re-assert on refresh: a seek can be dropped while the decoder is still
       warming up, and a resize re-runs fitFilm underneath it either way. */
    ScrollTrigger.addEventListener("refresh", showLastFrame);

    /* The headline is the one thing still hung off the hero's exit. The section
       is pulled up under the hero by 90svh (see styles.css), so measured against
       its own box this would fire while the hero was still opaque on top of it
       and be fully in before you could see it. "bottom bottom" on .hero is the
       scroll at which the hero has finished leaving. Everything further down the
       section clears the hero on its own and uses ordinary triggers. */
    gsap.set(title, { opacity: 0, x: -34 });
    gsap.to(title, {
      opacity: 1, x: 0, duration: 1.1, ease: "expo.out",
      scrollTrigger: { trigger: ".hero", start: "bottom bottom+=140", once: true }
    });

    /* The still fades up as it arrives, like any other figure on the page — but
       it sits inside the stretch that is overlapped by the hero, so a plain
       "top 80%" fires at scroll 309, behind an opaque hero, and the fade is
       spent before anyone can see it. Anchored only to the hero's exit it would
       instead fire whether or not the still had reached the screen yet. The
       start is the later of the two. */
    function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }
    function stillStart() {
      var hero = $(".hero"), ring = $(".film__ring");
      if (!hero || !ring) return 0;
      var heroOut = docTop(hero) + hero.offsetHeight - window.innerHeight;
      var onScreen = docTop(ring) - window.innerHeight * 0.80;
      return Math.max(heroOut + 60, onScreen);
    }
    if (media.length) {
      gsap.fromTo(media, { opacity: 0, y: 26 }, {
        opacity: 1, y: 0, duration: 1.05, ease: "expo.out",
        scrollTrigger: { trigger: ".film__stage", start: stillStart,
                         invalidateOnRefresh: true, once: true }
      });
    }

    /* The six points are now just a stacked group: same fade-up, same stagger and
       the same trigger geometry as every other [data-reveal-group] on the page,
       with nothing to synchronise against since the ring no longer moves. */
    gsap.fromTo(items, { y: 26, opacity: 0 }, {
      opacity: 1, y: 0, duration: 1.05, stagger: 0.085, ease: "expo.out",
      scrollTrigger: { trigger: ".usp", start: "top 84%", once: true }
    });

    /* matchMedia reverts the tweens and triggers it created here, but not a raw
       listener. Left attached, this one would keep forcing the last frame after
       a rotation into landscape and fight that build's scrub. */
    return function () { ScrollTrigger.removeEventListener("refresh", showLastFrame); };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     SECTION REVEALS
     ───────────────────────────────────────────────────────────────────────── */
  function initReveals() {
    /* Display headings unmask line by line. fromTo, because the from-state is a
       percentage translate that only JS can express to GSAP correctly. */
    $$(".duo__title, .origin__title").forEach(function (h) {
      /* The heading itself is never the animated thing — only its lines are. If
         it also carries data-reveal, the CSS pre-hide pins it at opacity 0 and
         the group pass (which skips line-owning headings) never clears it, so
         the whole heading silently disappears. Clear it here so the markup and
         the passes cannot disagree. */
      gsap.set(h, { opacity: 1 });
      gsap.fromTo($$(".line__in", h), { yPercent: 108, opacity: 0 }, {
        yPercent: 0, opacity: 1, duration: 1.2, stagger: 0.09, ease: "expo.out",
        scrollTrigger: { trigger: h, start: "top 86%", once: true }
      });
    });

    /* Grouped fade-ups, staggered in reading order. A heading that owns lines is
       handled above, so it is skipped here. */
    $$("[data-reveal-group]").forEach(function (group) {
      var items = $$("[data-reveal]", group).filter(function (el) { return !$(".line", el); });
      if (!items.length) return;
      gsap.fromTo(items, { y: 26, opacity: 0 }, {
        opacity: 1, y: 0, duration: 1.05, stagger: 0.085, ease: "expo.out",
        scrollTrigger: { trigger: group, start: "top 84%", once: true }
      });
    });

    /* Anything standing on its own. */
    $$("[data-reveal]").forEach(function (el) {
      if (el.closest("[data-reveal-group]")) return;
      if ($(".line", el)) return;
      gsap.fromTo(el, { y: 26, opacity: 0 }, {
        opacity: 1, y: 0, duration: 1.05, ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });

    /* The three products drop in one after another from above, so they read as
       having come out of the bottle held over them. */
    var cards = $$(".card");
    if (cards.length) {
      gsap.fromTo(cards, { opacity: 0, y: -46 }, {
        opacity: 1, y: 0, duration: 1.05, stagger: 0.14, ease: "expo.out",
        scrollTrigger: { trigger: ".shop__grid", start: "top 88%", once: true }
      });
    }

    /* The end-CTA ring draws itself as the section arrives, same gesture as the
       hero's: clockwise from 12 o'clock. */
    var originArc = $(".origin__arc");
    if (originArc) {
      var oDraw = { p: 0 };
      gsap.to(oDraw, {
        p: 1, duration: 1.8, ease: "power1.out",
        onUpdate: function () { ringDraw(originArc, oDraw.p); },
        onComplete: function () { ringSolid(originArc); },
        scrollTrigger: { trigger: ".origin", start: "top 78%", once: true }
      });
    }

    /* Figures wipe open and settle out of a slow scale — the one place a
       transform and a clip run together, which reads as unhurried. */
    $$("[data-reveal-wipe]").forEach(function (fig) {
      var img = $("img", fig);
      var tl = gsap.timeline({ scrollTrigger: { trigger: fig, start: "top 86%", once: true } });
      tl.fromTo(fig, { clipPath: "inset(0 0 100% 0)" },
                     { clipPath: "inset(0 0 0% 0)", duration: 1.35, ease: "expo.out" }, 0);
      if (img) tl.fromTo(img, { scale: 1.14 }, { scale: 1, duration: 1.8, ease: "expo.out" }, 0);
    });
  }

  /* Slow vertical drift on the full-bleed media, and on the footer wordmark. */
  function initParallax() {
    var origin = $(".origin__img");
    if (origin) {
      gsap.fromTo(origin, { yPercent: -6 }, {
        yPercent: 6, ease: "none",
        scrollTrigger: { trigger: ".origin", start: "top bottom", end: "bottom top", scrub: scrubValue() }
      });
    }
    var mark = $(".foot__watermark");
    if (mark) {
      gsap.fromTo(mark, { yPercent: 26 }, {
        yPercent: 0, ease: "none",
        scrollTrigger: { trigger: ".foot", start: "top bottom", end: "bottom bottom", scrub: scrubValue() }
      });
    }
    /* Product plates drift like the end-CTA photograph, just gentler. The travel
       is spent against the frame's overscan in styles.css — 8% each side, so
       anything past ~6.9 here swings an edge into view. */
    $$(".card__figure > *").forEach(function (plate) {
      gsap.fromTo(plate, { yPercent: -5 }, {
        yPercent: 5, ease: "none",
        scrollTrigger: {
          trigger: plate.closest(".card"),
          start: "top bottom", end: "bottom top", scrub: scrubValue()
        }
      });
    });

    $$(".duo__figure img").forEach(function (img) {
      gsap.fromTo(img, { yPercent: -3.5 }, {
        yPercent: 3.5, ease: "none",
        scrollTrigger: { trigger: img.closest(".duo"), start: "top bottom", end: "bottom top", scrub: scrubValue() }
      });
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     MASTHEAD
     ───────────────────────────────────────────────────────────────────────── */
  function initMasthead() {
    var bar = $("#masthead");

    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: function (self) {
        /* Mode 2 takes over once the hero has essentially gone. The bar never
           hides — it stays pinned at the top the whole way down. */
        bar.setAttribute("data-solid",
          self.scroll() > window.innerHeight * 0.8 ? "1" : "0");
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     MOBILE DRAWER
     ───────────────────────────────────────────────────────────────────────── */
  function initDrawer() {
    var burger = $("#burger");
    var drawer = $("#drawer");
    if (!burger || !drawer) return;
    var links = $$("a", drawer);
    var open = false;
    var tl = null;

    function build() {
      if (!window.gsap) return null;
      var t = gsap.timeline({ paused: true });
      t.fromTo(drawer, { clipPath: "inset(0 0 100% 0)" },
                       { clipPath: "inset(0 0 0% 0)", duration: 0.72, ease: "expo.inOut" }, 0)
       .to(links, { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "expo.out" }, 0.24);
      return t;
    }

    function set(next) {
      open = next;
      burger.setAttribute("aria-expanded", open ? "true" : "false");

      if (open) drawer.hidden = false;
      if (!window.gsap) { if (!open) drawer.hidden = true; return; }
      if (!tl) { gsap.set(links, { opacity: 0, y: 16 }); tl = build(); }

      if (open) { if (lenis) lenis.stop(); tl.play(); }
      else {
        tl.reverse().eventCallback("onReverseComplete", function () {
          drawer.hidden = true;
          if (lenis) lenis.start();
        });
      }
    }

    burger.addEventListener("click", function () { set(!open); });
    links.forEach(function (a) { a.addEventListener("click", function () { if (open) set(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) set(false); });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     BOOT
     ───────────────────────────────────────────────────────────────────────── */
  function boot() {
    var intro = null;
    lenis = initLenis();
    if (lenis) lenis.stop();                       /* held until the loader lifts */
    initDrawer();
    initMasthead();

    var progress = 0;
    var settled = false;
    var assets = loadAssets(function (p) { progress = p; })
      .then(function (v) { settled = true; return v; },
            function (e) { settled = true; throw e; });

    /* The ring starts filling on the first frame, not after the assets land —
       otherwise it is a "loading" indicator that only appears once loading is
       over. If the load times out, `settled` releases it anyway. */
    var ringFull = runLoadRing(function () { return settled ? 1 : progress; });

    /* Fonts must be resolved before anything measures a box: the display face
       changes the size of every heading, and the FLIP target is a logo. */
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();

    Promise.all([assets, fonts]).then(function (r) {
      var filmURL = r[0] || (window.KAYNFilm ? window.KAYNFilm.config.src : null);
      var video = $("#film-video");
      var attach = (window.KAYNFilm && video && filmURL)
        ? window.KAYNFilm.attach(video, filmURL)
        : Promise.resolve(null);

      return attach.then(function () {
        fitHero();
        buildHeroExit();

        /* One breakpoint decides the whole film section: landscape gets the
           ring, portrait gets the stacked list. matchMedia tears the wrong one
           down on resize rather than leaving two live timelines.
           These two queries must stay disjoint and must match the
           `max-aspect-ratio: 1/1` block in styles.css. */
        gsap.matchMedia()
          .add(Q_LANDSCAPE, function () { fitFilm(); return buildFilm(); })
          .add(Q_PORTRAIT,  function () { fitFilm(); return buildFilmPortrait(); });

        /* Both framings depend on their box, so they are recomputed whenever
           ScrollTrigger re-measures the page (which includes every resize). */
        ScrollTrigger.addEventListener("refresh", function () { fitHero(); fitFilm(); });

        initReveals();
        initParallax();
        intro = buildIntro(filmURL);

        /* Everything is built; hand over the moment the ring reads 100%. */
        return ringFull.then(function () { intro.play(); });
      });
    }).catch(function (err) {
      console.error("[KAYN] Boot failed.", err);
      standDown("boot error");
    });

    /* ─── debug handle ─────────────────────────────────────────────────── */
    window.KAYN = {
      lenis: function () { return lenis; },
      film: function () { return window.KAYNFilm; },
      config: CONFIG,
      loadProgress: function () { return progress; },
      intro: function () { return intro; },
      /* Land the intro on its final frame and stop the clock there. */
      finishIntro: function () { if (intro) intro.progress(1).pause(); return !!intro; },
      fitFilm: fitFilm,
      fitHero: fitHero,
      /* Jump to a fraction of the film section's scroll run. */
      seekFilm: function (p) {
        var st = ScrollTrigger.getAll().filter(function (t) {
          return t.trigger && t.trigger.classList && t.trigger.classList.contains("film");
        })[0];
        if (!st) return null;
        var y = st.start + (st.end - st.start) * clamp01(p);
        if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
        return y;
      },
      stats: function () {
        var st = ScrollTrigger.getAll();
        return {
          motion: html.getAttribute("data-motion"),
          lenis: !!lenis,
          scrub: scrubValue(),
          triggers: st.length,
          scrollY: window.scrollY,
          film: window.KAYNFilm ? window.KAYNFilm.stats() : null
        };
      }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})(window, document);
