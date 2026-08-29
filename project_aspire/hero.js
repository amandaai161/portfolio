/* =============================================================================
   Aspire 2026 — scroll-driven hero
   -----------------------------------------------------------------------------
   The interaction is four stretches of scroll, all driven off one number: how
   far the page has scrolled into `.scene`, in pixels.

     --anim-lead      nothing happens (≈2 wheel notches)
     --scrub-length   PHASE 1: the webm is scrubbed frame by frame. The
                      composition does not move at all.
     --move-length    PHASE 2: begins on the webm's last frame. The webm
                      shrinks and travels up until its top sits just under the
                      nav; the copy and client logos fade out at the same time;
                      the blurred field follows with parallax; the fade tightens.
     --settle-length  PHASE 3: one more shrink, so the webm ends up as the
                      product section's header. The section is lifted by
                      --dock-span (see measure) so that it docks against the
                      webm's bottom edge exactly as this phase ends, and its
                      contents are cued to animate in on the approach.

   Scrolling back up runs all of it in reverse, frame by frame.

   Past the runway the pin stays stuck, so the composition and its gradient are
   the header the product section slides under. The pin releases at the end of
   `.scene`, i.e. when the product section is done.

   -----------------------------------------------------------------------------
   Why a canvas and not the <video>

   Scrubbing a video means seeking, and this WEBM only carries keyframes at
   frames 0 and 60 — a mid-video seek costs ~600ms in Chrome, so `currentTime`
   is unusable for this. Instead the video is played through once, off-screen,
   and every frame is captured into an ImageBitmap cache; the canvas then blits
   whichever frame the scroll position asks for. Alpha survives the round trip.

   Everything is read from CSS custom properties, so styles.css stays the
   single place to tune the interaction.
   ========================================================================== */

(function () {
  'use strict';

  var scene    = document.getElementById('scene');
  var pin      = document.querySelector('.scene__pin');
  var runway   = document.getElementById('sceneRunway');
  var products = document.getElementById('products');
  var grid     = document.querySelector('.products__grid');
  var anim     = document.getElementById('heroAnim');
  var bg       = document.getElementById('heroBg');
  var fade     = document.getElementById('heroFade');
  var copy     = document.getElementById('heroCopy');
  var text     = document.querySelector('.hero__text');
  var video    = document.getElementById('heroVideo');
  var canvas   = document.getElementById('heroCanvas');
  if (!scene || !anim) return;

  var root = document.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var cctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;

  /* --------------------------------------------------------------- flat mode
     On phones the scene is not a pin — `.scene__pin` goes `position: static` and
     the runway collapses, so the hero is ordinary page content that scrolls away
     (see the 720px block in styles.css).

     The scrub survives that; only the pin goes. What changes is where progress
     comes from. Pinned, it is how far the page has scrolled INTO the scene, which
     is what the runway exists to provide. Unpinned there is no runway, so progress
     is the animation's own travel through the viewport instead: frame 0 as its top
     edge crosses the bottom of the screen, the last frame as its bottom edge leaves
     the top. Same frame-for-frame connection to the wheel, no pin.

     Phases 2 and 3 have no meaning without a pin — there is nothing to shrink into
     and nothing to dock under — so flat mode paints the frame and writes no
     transforms at all. Everything it would have written has a CSS fallback at its
     var(), so what is left is a correct static composition.

     The breakpoint is duplicated here because a media query cannot be read out of
     the stylesheet; it has to match the one in the 720px block. */
  var flat = matchMedia('(max-width: 720px)');

  /* ---------------------------------------------------------------- config */
  var cfg = {};

  function num(name, fallback) {
    var v = parseFloat(getComputedStyle(root).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }

  function readConfig() {
    cfg.lead        = num('--anim-lead', 200);
    cfg.scrub       = num('--scrub-length', 900);
    cfg.move        = num('--move-length', 700);
    cfg.settle      = num('--settle-length', 450);
    cfg.introLead   = num('--intro-lead', 200);
    cfg.ease        = num('--scroll-ease', 0.28);
    cfg.scaleEnd    = num('--anim-scale-end', 0.75);
    cfg.endGap      = num('--anim-end-gap', 18);
    cfg.shrinkS2    = num('--anim-shrink-s2', 1);
    cfg.s2Gap       = num('--anim-s2-gap', 18);
    cfg.dockTail    = num('--dock-tail', 32);
    cfg.s2Min       = num('--anim-s2-min', 0.35);
    cfg.fadeStart   = num('--fade-start', 0.49);
    cfg.fadeEnd     = num('--fade-end', 0.37);
    cfg.parallax    = num('--bg-parallax', 0.95);
    cfg.parallaxS2  = num('--bg-parallax-s2', 0.40);
    cfg.copyFadeEnd = num('--copy-fade-end', 0.42);
    /* the pin's padding-top *is* --nav-h, read back resolved */
    cfg.navH        = parseFloat(getComputedStyle(pin).paddingTop) || num('--nav-h', 76);
    cfg.budgetMB    = num('--frame-budget-mb', 240);
  }

  /* ------------------------------------------------------------- geometry */
  var geo = {
    animH: 0, animTop: 0, pinH: 0, runwayH: 0, bgTop: 0, bgH: 0,
    total: 0, dockTop: 0, dockSpan: 0,
    /* the webm box at each of the three rest states it passes through */
    kf: [{ top: 0, scale: 1 }, { top: 0, scale: 1 }, { top: 0, scale: 1 }],
    bgTravel1: 0, bgTravel2: 0
  };

  function centreOf(k) { return k.top + geo.animH * k.scale / 2; }

  /* How big the webm is once it has become the product section's header.
     --anim-shrink-s2 asks for a size; the section's own content gets a veto,
     because the docked composition is the page's resting state and the cards
     have to be under the header rather than behind it. On the reference's
     1198-tall screen the veto never bites and the composition is simply held
     where phase 2 left it; on a shorter one the header gives way. */
  function dockScale() {
    var want = cfg.scaleEnd * cfg.shrinkS2;
    if (!grid || !products || !geo.animH) return want;

    var contentH = grid.getBoundingClientRect().bottom
                 - products.getBoundingClientRect().top;
    var room = geo.pinH - contentH - cfg.dockTail - (cfg.navH + cfg.s2Gap);
    var fit = room / geo.animH;

    /* Below the floor there is no size that would make it fit — a re-flowed
       grid, say — so leave the header alone and let the section scroll. */
    return (fit < want && fit >= cfg.s2Min) ? fit : want;
  }

  var waits = 0;

  function measure() {
    readConfig();
    /* cfg is read above because the scrub still needs it; the rest of measure is
       pin geometry, and writing --stage-w / --anim-avail-h would put the mobile
       sizing back under the pin's cap. */
    if (flat.matches) return;

    var pinRect = pin.getBoundingClientRect();
    /* A measure can land before the pin has a layout box at all — a cold
       navigation, or a tab that starts with a zero-size viewport. Writing
       zeroes then would collapse the webm, so bail and come back. The
       ResizeObserver below usually gets there first; the timer is the backstop
       for when it doesn't. */
    if (pinRect.width < 1 || pinRect.height < 1) {
      if (waits++ < 40) setTimeout(measure, 100);
      return;
    }
    waits = 0;

    geo.pinH = pinRect.height;
    geo.runwayH = runway ? runway.getBoundingClientRect().height
                         : cfg.lead + cfg.scrub + cfg.move;
    root.style.setProperty('--stage-w', pinRect.width + 'px');

    /* Cap the webm's height to whatever room is left under the client logos, so
       the whole thing — fade included — fits the first screen, as in
       "Homepage Section 1 (Revised).png".

       The two spacings are read back off the elements that carry them, not off
       the custom properties: getComputedStyle returns a custom property's
       *specified* token list, so a clamp() in one never resolves to a number. */
    var copyRect  = copy.getBoundingClientRect();
    var gapToAnim = parseFloat(getComputedStyle(anim).marginTop) || 0;
    var bottomPad = parseFloat(getComputedStyle(pin).paddingBottom) || 0;
    var avail = Math.max(160, geo.pinH - (copyRect.bottom - pinRect.top) - gapToAnim - bottomPad);
    root.style.setProperty('--anim-avail-h', avail + 'px');

    /* Read the resulting box with transforms neutralised. */
    var prevShift = anim.style.getPropertyValue('--anim-shift');
    var prevScale = anim.style.getPropertyValue('--anim-scale');
    anim.style.setProperty('--anim-shift', '0px');
    anim.style.setProperty('--anim-scale', '1');

    var animRect = anim.getBoundingClientRect();
    geo.animTop = animRect.top - pinRect.top;
    geo.animH   = animRect.height;

    anim.style.setProperty('--anim-shift', prevShift);
    anim.style.setProperty('--anim-scale', prevScale);

    /* The three states the box interpolates between:
         0  at rest, where it sits in the hero
         1  hero end state — top lands --anim-end-gap below the nav
         2  product-section header — smaller again, tucked --anim-s2-gap up  */
    geo.kf[0] = { top: geo.animTop,           scale: 1 };
    geo.kf[1] = { top: cfg.navH + cfg.endGap, scale: cfg.scaleEnd };
    geo.kf[2] = { top: cfg.navH + cfg.s2Gap,  scale: dockScale() };

    /* The webm also shrinks towards its top edge, so its visual centre travels
       further than its top edge does. Parallax is expressed against that
       perceived travel — which is what "moves a little less" refers to. Phase 3
       has its own, much weaker factor; both are fitted to the references. */
    geo.bgTravel1 = (centreOf(geo.kf[0]) - centreOf(geo.kf[1])) * cfg.parallax;
    geo.bgTravel2 = (centreOf(geo.kf[1]) - centreOf(geo.kf[2])) * cfg.parallaxS2;

    /* Where the section docks: its top edge meets the webm's bottom edge, which
       is the moment "Homepage Section 2.png" captures. --dock-span is the room
       left below that, and the product section uses it *twice* — as a negative
       top margin and as its height. The lift is what makes the section land
       exactly as the runway ends instead of a whole screen later; the matching
       height is what makes that docked composition the page's resting state
       rather than something you scroll past. */
    geo.dockTop  = geo.kf[2].top + geo.animH * geo.kf[2].scale;
    geo.dockSpan = Math.max(0, geo.pinH - geo.dockTop);
    root.style.setProperty('--dock-span', geo.dockSpan.toFixed(2) + 'px');

    geo.total = cfg.lead + cfg.scrub + cfg.move + cfg.settle;

    /* Park the band over the webm. In the reference its colour starts a little
       below the webm's top edge, so nudge it down. It never scales.

       Its height is the area the animation would cover *uncapped* — i.e. at the
       full content width — not the webm's own height and not the room left in
       the pin. The webm is capped at --anim-max-w and squeezed by whatever sits
       above it, and the field should keep covering the area it does in the
       reference either way (1437 × 660 at a 1440-wide viewport). */
    var textW = text ? text.getBoundingClientRect().width : pinRect.width;
    geo.bgH = Math.max(geo.animH, textW * 1324 / 2880);
    geo.bgTop = geo.animTop + geo.bgH * 0.01;
    bg.style.setProperty('--bg-top', geo.bgTop + 'px');
    bg.style.setProperty('--bg-h', geo.bgH + 'px');

    sizeCanvas();
    readRect();
    apply(current, true);
  }

  /* -------------------------------------------------------------- easings */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }

  /* ============================================================ FRAMES */
  var frames = [];        // ImageBitmaps, in playback order
  var ready = 0;          // how many are usable right now
  var totalFrames = 0;    // final count, once extraction finishes
  var drawn = -1;         // frame index currently on the canvas
  var extractState = 'idle';   // idle | seeking | playback | done | failed
  var capW = 0, capH = 0;

  function expectedFrames() {
    /* The source is 30fps; derived rather than hard-coded so a re-export with
       a different length still works. */
    var d = video && video.duration;
    return d && isFinite(d) ? Math.max(1, Math.round(d * 30)) : 61;
  }

  function captureWidth() {
    var vw = video.videoWidth || 2880;
    var vh = video.videoHeight || 1324;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var box = anim.getBoundingClientRect();
    var want = Math.round((box.width || 1440) * dpr);

    /* Keep the cache inside a memory ceiling: n frames × w × h × 4 bytes. */
    var perFrame = (cfg.budgetMB * 1024 * 1024 / 4) / expectedFrames();
    var budgetW = Math.floor(Math.sqrt(perFrame * (vw / vh)));

    return Math.max(480, Math.min(vw, want, budgetW));
  }

  function sizeCanvas() {
    /* Provisional size before extraction starts, so the canvas isn't 300×150. */
    if (!canvas || capW) return;
    if (!video || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  /* --- shared cache plumbing ------------------------------------------- */
  var off, octx, slots = [];

  function beginCache() {
    capW = captureWidth();
    capH = Math.round(capW * video.videoHeight / video.videoWidth);
    canvas.width = capW;
    canvas.height = capH;

    off = document.createElement('canvas');
    off.width = capW;
    off.height = capH;
    octx = off.getContext('2d', { alpha: true });

    /* Release anything a previous (aborted) pass had already decoded. */
    for (var i = 0; i < frames.length; i++) {
      if (frames[i] && frames[i].close) frames[i].close();
    }
    slots = [];
    ready = 0;
    totalFrames = 0;
    drawn = -1;
    frames.length = 0;
  }

  function commit() {
    while (ready < slots.length && slots[ready]) {
      frames[ready] = slots[ready];
      ready++;
    }
    if (ready === 1) anim.classList.add('is-canvas');
    drawn = -1;                 // force a repaint now that more frames exist
    paintFrame();
  }

  function grab() {
    octx.clearRect(0, 0, capW, capH);
    octx.drawImage(video, 0, 0, capW, capH);
    var i = slots.length;
    slots.push(null);
    return createImageBitmap(off).then(
      function (b) { slots[i] = b; commit(); },
      function () { slots[i] = frames[i - 1] || null; commit(); }
    );
  }

  function finish() {
    totalFrames = slots.length;
    extractState = 'done';
    try { video.pause(); } catch (e) {}
    commit();
  }

  function extract() {
    if (!video || !canvas) return;
    if (extractState === 'done' || extractState === 'playback') return;
    if (!window.createImageBitmap) { extractState = 'failed'; return; }
    if (video.readyState < 3) return;            // wait for canplay

    /* Preferred: one real-time play-through, capturing every presented frame
       (~2s for this file). requestVideoFrameCallback does not fire in a hidden
       tab, so fall back to walking the timeline with seeks. */
    if (video.requestVideoFrameCallback && !document.hidden) {
      if (extractState === 'seeking') abortSeek = true;   // upgrade
      extractByPlayback();
    } else if (extractState === 'idle') {
      extractBySeeking();
    }
  }

  /* --- fast path: capture during a single play-through ----------------- */
  function extractByPlayback() {
    extractState = 'playback';
    beginCache();

    var seen = Object.create(null);
    var closed = false;

    /* The last frame's callback usually runs *before* `ended` is set, and no
       further callback comes after it — so waiting for rVFC to observe
       video.ended can leave the pass running forever. Close it out on whichever
       signal arrives first. */
    function close() {
      if (closed) return;
      closed = true;
      video.removeEventListener('ended', close);
      finish();
    }

    function step(now, meta) {
      var key = Math.round(meta.mediaTime * 1000);
      if (!(key in seen)) { seen[key] = true; grab(); }
      if (video.ended) { close(); return; }
      video.requestVideoFrameCallback(step);
    }

    video.muted = true;
    video.loop = false;
    try { video.currentTime = 0; } catch (e) {}
    video.addEventListener('ended', close);
    video.requestVideoFrameCallback(step);

    var p = video.play();
    if (p && p['catch']) p['catch'](function () {
      /* Autoplay refused — walk the timeline instead. */
      closed = true;
      extractState = 'idle';
      extractBySeeking();
    });
  }

  /* --- slow path: walk the timeline with seeks ------------------------
     Costs a few hundred ms per frame on this file (only 2 keyframes), so it
     fills in the background while the hero sits at rest. */
  var abortSeek = false;

  function extractBySeeking() {
    extractState = 'seeking';
    abortSeek = false;
    beginCache();

    var n = expectedFrames();
    var i = 0;

    function next() {
      if (abortSeek) return;
      if (i >= n) { finish(); return; }

      var t = Math.min((i + 0.5) / 30, video.duration - 0.001);
      var onSeeked = function () {
        video.removeEventListener('seeked', onSeeked);
        if (abortSeek) return;
        grab().then(function () { i++; setTimeout(next, 0); });
      };
      video.addEventListener('seeked', onSeeked);
      try { video.currentTime = t; } catch (e) { finish(); }
    }
    try { video.pause(); } catch (e) {}
    next();
  }

  /* Draw the frame the current scrub position asks for. */
  function paintFrame() {
    if (!cctx) return;

    var n = totalFrames || expectedFrames();
    var i = Math.round(frameP * (n - 1));

    if (extractState !== 'done') {
      /* Still filling the cache — clamp to what has arrived. Extraction runs
         forwards, and so does the scroll, so this rarely bites. */
      if (ready === 0) return;
      if (i > ready - 1) i = ready - 1;
    }
    if (i === drawn) return;
    drawn = i;

    var b = frames[i];
    if (!b) return;
    cctx.clearRect(0, 0, canvas.width, canvas.height);
    cctx.drawImage(b, 0, 0, canvas.width, canvas.height);
  }

  /* Fallback when no frame cache is available: seek the <video> itself. Slow
     on this file, but it keeps the interaction functional. */
  var seekWanted = -1;
  function seekFallback() {
    if (!video || !video.duration) return;
    var t = frameP * video.duration;
    seekWanted = t;
    if (video.seeking) return;
    try { video.currentTime = seekWanted; } catch (e) {}
  }
  if (video) {
    video.addEventListener('seeked', function () {
      if (extractState !== 'failed') return;
      if (seekWanted >= 0 && Math.abs(video.currentTime - seekWanted) > 0.02) {
        try { video.currentTime = seekWanted; } catch (e) {}
      }
    });
  }

  /* ============================================================== APPLY */
  var frameP  = 0;   // 0→1 across PHASE 1
  var moveP   = 0;   // 0→1 across PHASE 2
  var settleP = 0;   // 0→1 across PHASE 3

  /* `s` is pixels scrolled into the scene. */
  function apply(s, force) {
    frameP  = clamp01((s - cfg.lead) / cfg.scrub);
    moveP   = clamp01((s - cfg.lead - cfg.scrub) / cfg.move);
    settleP = clamp01((s - cfg.lead - cfg.scrub - cfg.move) / cfg.settle);

    /* --- the webm's own timeline ------------------------------------- */
    if (force) drawn = -1;
    if (extractState === 'failed') seekFallback();
    else paintFrame();

    /* Flat mode stops here. Everything below is pin geometry — it reads geo.kf,
       which measure() does not compute without a pin, and it would write transforms
       for a travel that is not happening. */
    if (flat.matches) return;

    /* --- PHASES 2 + 3: travel + scale, anchored at the top edge --------
       One scalar walks the three keyframes: 0 = at rest, 1 = hero end,
       2 = product-section header. */
    var m = moveP + settleP;
    var i = m < 1 ? 0 : 1;
    var f = m < 1 ? m : m - 1;
    var a = geo.kf[i], b = geo.kf[i + 1];

    var scale = a.scale + (b.scale - a.scale) * f;
    var top   = a.top   + (b.top   - a.top)   * f;

    anim.style.setProperty('--anim-shift', (top - geo.animTop).toFixed(2) + 'px');
    anim.style.setProperty('--anim-scale', scale.toFixed(5));

    /* --- white fade: bottom pinned to the webm's bottom edge ---------- */
    var visH  = geo.animH * scale;
    var fadeH = visH * (cfg.fadeStart + (cfg.fadeEnd - cfg.fadeStart) * moveP);
    var fadeTop = top + visH - fadeH;

    /* The solid part exists to hide the blurred band's tail. The product
       section's own white background does that job from its top edge down, so
       stop the mask at whichever comes first — otherwise it would swallow the
       section's headline as it rises. */
    var bandBottom = geo.bgTop - bgShiftFor(m) + geo.bgH;
    var pinTop = pinOffset();
    /* The section sits --dock-span higher than its natural place in the flow. */
    var productsTop = sceneTop + geo.pinH + geo.runwayH - geo.dockSpan - pinTop;
    var maskTo = Math.min(bandBottom, productsTop);
    var totalH = Math.max(fadeH, maskTo - fadeTop);

    fade.style.setProperty('--fade-top', fadeTop.toFixed(2) + 'px');
    fade.style.setProperty('--fade-h', fadeH.toFixed(2) + 'px');
    fade.style.setProperty('--fade-total-h', totalH.toFixed(2) + 'px');

    /* --- background: same direction, shorter distance, no scaling -----
       It is fixed to the viewport (it has to paint under the product section),
       so it needs the pinned stage's own offset added to stay glued to it once
       the pin releases at the end of the scene. */
    bg.style.setProperty('--bg-shift', (-bgShiftFor(m)).toFixed(2) + 'px');
    bg.style.setProperty('--bg-pin', pinTop.toFixed(2) + 'px');

    /* --- copy: fades out where it stands, during PHASE 2 -------------- */
    var o = 1 - smooth(moveP / cfg.copyFadeEnd);
    copy.style.setProperty('--copy-opacity', o.toFixed(4));
    copy.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
    copy.style.pointerEvents = o < 0.4 ? 'none' : 'auto';

    /* --- hand the product section its cue ----------------------------
       Fired on approach to the docked position rather than on entering the
       viewport: the section's contents are white-on-white behind the mask until
       roughly here, and revealing them any earlier is what left the headline
       stranded a long way below the animation.

       It re-arms once the section is entirely below the fold, so a second pass
       down the page gets the same clean arrival rather than the old gap. That
       threshold is exactly where the contents cannot be on screen, so the reset
       itself is never visible. */
    if (products) {
      if (!cued && productsTop - geo.dockTop <= cfg.introLead) {
        cued = true;
        products.dispatchEvent(new CustomEvent('hero:dock'));
      } else if (cued && productsTop >= geo.pinH) {
        cued = false;
        products.dispatchEvent(new CustomEvent('hero:undock'));
      }
    }
  }

  var cued = false;

  /* How far the band has travelled up, for a morph position m in [0,2]. */
  function bgShiftFor(m) {
    return geo.bgTravel1 * Math.min(m, 1) + geo.bgTravel2 * Math.max(0, m - 1);
  }

  /* The sticky pin's own top: 0 while stuck, negative once it releases at the
     end of the scene. Derived from the scene rect, so apply() needs no rect
     reads of its own. */
  function pinOffset() {
    return Math.max(sceneTop, Math.min(0, sceneBottom - geo.pinH));
  }

  /* ----------------------------------------------------------- the loop */
  var target = 0;      // scene scroll straight from the scroll position, px
  var current = 0;     // eased value actually rendered
  var pending = false;
  var sceneTop = 0, sceneBottom = 0;   // last known scene rect, viewport coords

  function readRect() {
    var r = scene.getBoundingClientRect();
    sceneTop = r.top;
    sceneBottom = r.bottom;
    return r;
  }

  function readScroll() {
    readRect();
    if (flat.matches) return readScrollFlat();
    /* scene top: 0 at the start, increasingly negative as we scroll. */
    var s = -sceneTop;
    return s < 0 ? 0 : s > geo.total ? geo.total : s;
  }

  /* Unpinned: the animation's own pass through the viewport is the runway. 0 with
     its top edge level with the bottom of the screen, 1 once its bottom edge has
     cleared the top — so the whole clip plays over one screen-plus-its-own-height
     of scrolling, and it is always on screen while it does. Mapped onto the scrub
     phase only, which keeps apply() out of phases 2 and 3. */
  function readScrollFlat() {
    var r = anim.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var travel = vh + r.height;
    var p = travel > 0 ? (vh - r.top) / travel : 0;
    return cfg.lead + clamp01(p) * cfg.scrub;
  }

  /* The flag is flipped before/after the rAF call rather than storing its
     returned id, so the guard can't get stuck if the callback runs early. */
  function queue() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(tick);
  }

  function tick() {
    pending = false;
    var d = target - current;

    if (reduced.matches || Math.abs(d) < 0.25) {
      current = target;
      apply(current);
      return;
    }
    /* A little inertia: the composition trails the scroll just enough to feel
       smooth without losing the frame-for-frame connection. */
    current += d * cfg.ease;
    apply(current);
    queue();
  }

  function schedule() {
    target = readScroll();
    queue();
  }

  /* ------------------------------------------------------------- wiring */
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', function () { measure(); schedule(); });
  if (reduced.addEventListener) reduced.addEventListener('change', measure);

  /* The copy block's height depends on font loading and text wrapping; the pin
     is observed too so the first real layout box always triggers a measure. */
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(measure);
    ro.observe(copy);
    ro.observe(pin);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  if (video) {
    video.addEventListener('loadedmetadata', function () { sizeCanvas(); measure(); });
    video.addEventListener('canplaythrough', extract);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { extract(); schedule(); }
    });
    if (video.readyState >= 3) extract();
  }

  /* Crossing the breakpoint has to hand the composition over both ways: into flat
     mode the clip starts playing and the transforms are abandoned at their fallback
     values; out of it the cache is built and the scene re-measures. */
  function onFlatChange() {
    measure();
    extract();
    schedule();
  }
  if (flat.addEventListener) flat.addEventListener('change', onFlatChange);
  else if (flat.addListener) flat.addListener(onFlatChange);

  measure();
  schedule();

  /* --------------------------------------------------- debug / preview hook
     window.hero.setProgress(0.5) jumps straight to a point in the runway.
     window.hero.setPhase('scrub', 1) / ('move', 0.264) / ('settle', 1) targets
     one phase, so a state can be lined up against a reference screenshot.   */
  window.hero = {
    /* `flat` reports whether the pin is switched off. When it is, setProgress and
       setScroll still run — they are how you inspect the scene from a desktop
       console — but nothing is driving them, so the page will not reflect them. */
    get flat() { return flat.matches; },
    /* Both of these pretend the page is scrolled, so the quantities derived
       from the scene rect (the pin's offset, the product section's top) come
       out exactly as they would for real. setScroll takes raw pixels, so it can
       also reach past the runway — where the product section docks. */
    setProgress: function (t) { this.setScroll(clamp01(t) * this.range); },
    /* geo.total is the pinned runway, and measure() does not compute it without a
       pin — so in flat mode the ceiling is the scrub phase, which is the only phase
       that exists there. Without this both helpers clamp to 0 on a phone. */
    get range() { return flat.matches ? cfg.lead + cfg.scrub : geo.total; },
    setScroll: function (px) {
      var h = scene.getBoundingClientRect().height;
      current = target = Math.min(Math.max(px, 0), this.range);
      sceneTop = -Math.max(px, 0);
      sceneBottom = sceneTop + h;
      apply(current, true);
    },
    setPhase: function (phase, v) {
      var at = phase === 'settle' ? cfg.lead + cfg.scrub + cfg.move + clamp01(v) * cfg.settle
             : phase === 'move'   ? cfg.lead + cfg.scrub + clamp01(v) * cfg.move
             :                      cfg.lead + clamp01(v) * cfg.scrub;
      this.setScroll(at);
    },
    measure: measure,
    get state() {
      return {
        s: current, frameP: frameP, moveP: moveP, settleP: settleP,
        frames: { ready: ready, total: totalFrames, state: extractState,
                  capture: capW + '×' + capH, drawn: drawn },
        animTop: geo.animTop, animH: geo.animH,
        keyframes: geo.kf, total: geo.total,
        dockTop: geo.dockTop, dockSpan: geo.dockSpan, cued: cued,
        bgTravel: [geo.bgTravel1, geo.bgTravel2], config: cfg
      };
    }
  };
})();
