/* ============================================================================
   SELECTED-WORK THUMBNAILS — rest, play, rewind
   ----------------------------------------------------------------------------
   The four selected projects are 800x500 webm clips, 21 frames at 30fps. Each
   rests on its first frame, plays forward while its card is hovered, stops on
   its last frame, and plays BACKWARDS from wherever it got to when the pointer
   leaves. Amanda: "just like what I did on Aspire's feature section icons."

   A pass takes --thumb-duration, 0.4s, in both directions and by both routes:
   the canvas travels the whole cache in that time, and the first pass -- which
   is the <video> itself -- gets a playbackRate of duration/0.4 to match. The
   clips' own 0.7s is left alone; re-exporting them shorter needs no change
   here, which is the point of specifying a duration rather than a rate.

   A HOVER IS HONOURED WHENEVER THE CARD IS HIT-TESTABLE, transition or not.
   It was gated on the slide being at rest for a while, which cost more than it
   bought: hovering a card and then scrolling on snapped the thumbnail back to
   frame 1 with no animation, right while the reader was looking at it. Amanda:
   "it's better to revert back the interaction where the thumbnail can be
   hovered (and animating) while in-transition." So the only reset left fires
   when a slide stops being the LIVE one, by which point it has finished its
   exit and is not on screen for the snap to be seen.

   A <video> cannot play backwards, and it turns out it cannot be scrubbed
   backwards either. Measured, on these files:

     - Through a server with no HTTP Range support (our devserver, and any
       plain SimpleHTTPRequestHandler) `video.seekable` is EMPTY. Every
       currentTime write clamps to 0 -- while `seeked` still fires, so a naive
       timing test reports a fast seek that never happened.
     - Through a Range-capable server seeks land correctly but cost 19-94ms
       each. A rewind needs one per frame inside 16ms. Not viable either.

   So the frames are cached, as they are for the Aspire icons: the clip is
   decoded once into ImageBitmaps and a canvas blits whichever frame the
   interaction asks for.

   WHERE THIS DIFFERS FROM THE ASPIRE ICONS, AND WHY. Those icons are 300x112
   and all six are decoded up front. These are 800x500 -- about 34MB of texture
   per clip, 134MB if all four were decoded the same way, on a homepage.

   They are not decoded up front. A clip is captured during the FIRST hover, in
   the one real-time play-through the reader is already watching: the <video>
   itself is what is on screen for that pass, at native quality and native
   pacing, while every presented frame is grabbed behind it. That works because
   the frames a rewind needs are exactly the frames the reader just played. A
   visitor who hovers one card pays for one clip, and one who hovers none pays
   nothing.

   LOADING. The markup carries preload="none" and a poster of frame 1, so the
   resting thumbnail costs one ~50KB webp. The 1.9MB of webm is fetched only
   when the section comes near AND the device has a real hover -- a phone,
   which can never play them, never downloads one.

   ES5, matching the rest of js/ on this page.
   ========================================================================== */
(function () {
  "use strict";

  /* Both blocks. The pairs are .wcard, HAZEN is .hazen; each is an <a> with a
     __media box holding the clip, which is all this file needs of either. */
  var videos = document.querySelectorAll(".wcard__video, .hazen__video");
  if (!videos.length) return;

  var reduced = matchMedia("(prefers-reduced-motion: reduce)");
  var hoverable = matchMedia("(hover: hover) and (pointer: fine)");

  /* How long one pass should take, end to end. A DURATION rather than a rate
     multiplier because that is what Amanda specifies ("can you make them 0.4s")
     and because it survives a re-export: change the clips' own length or frame
     count and the hover still takes 0.4s without touching anything here.
     Read per element, so one card could be given its own timing from CSS. */
  function secondsOf(el) {
    var raw = String(getComputedStyle(el).getPropertyValue("--thumb-duration")).trim();
    var v = parseFloat(raw);
    if (isNaN(v) || v <= 0) return 0.4;
    return /ms$/.test(raw) ? v / 1000 : v;
  }

  function Thumb(card, video) {
    var box = video.parentNode;
    var canvas = document.createElement("canvas");
    canvas.className = "thumb-canvas";
    canvas.setAttribute("aria-hidden", "true");
    box.appendChild(canvas);

    var ctx = canvas.getContext("2d", { alpha: true });
    var frames = [];          /* ImageBitmaps, in presentation order */
    var times = [];           /* each frame's mediaTime, for the mid-play handover */
    var count = 0;            /* usable frames, counting from 0 */
    var drawn = -1;

    var state = "cold";       /* cold | capturing | ready | failed */
    var attempts = 0;         /* capture passes tried; see finish() */
    var pos = 0;              /* current frame; fractional while animating */
    var dir = 0;
    var last = 0;
    var raf = 0;
    var over = false;         /* the pointer is physically on the card */
    var warmed = false;

    var off, octx, capW = 0, capH = 0;

    /* ------------------------------------------------------------- capture */
    function begin() {
      /* CAPTURE AT THE SOURCE'S OWN SIZE, always.

         This used to size itself from the display box -- box width x dpr,
         capped at the source -- to avoid holding more texture than the screen
         could show. It measured with getBoundingClientRect(), which reports the
         TRANSFORMED size, and js/scenes-work.js parks .hazen__media at
         scale(0.2) before its entry. So a hover during that entry measured
         129.7px instead of the box's real 648px, and cached an 850px clip at
         320. Displayed at 1296 device pixels on a 2x screen, that is a 4x
         upscale: Amanda, "why it looks pixelated?"

         offsetWidth would have dodged the transform, but the source resolution
         is the ceiling regardless and these clips are small enough that the
         saving was never worth a size that depends on when you hovered. */
      var srcW = video.videoWidth || 800;
      var srcH = video.videoHeight || 500;
      capW = srcW;
      capH = srcH;

      canvas.width = capW;
      canvas.height = capH;
      off = document.createElement("canvas");
      off.width = capW;
      off.height = capH;
      octx = off.getContext("2d", { alpha: true });
    }

    function grab(mediaTime) {
      octx.clearRect(0, 0, capW, capH);
      octx.drawImage(video, 0, 0, capW, capH);
      var i = frames.length;
      frames.push(null);
      times.push(mediaTime);
      return createImageBitmap(off).then(function (b) {
        frames[i] = b;
        /* Frames are usable only in an unbroken run from the start. */
        while (count < frames.length && frames[count]) count++;
      }, function () {
        frames[i] = frames[i - 1] || null;
      });
    }

    /* A pass only counts if it ran to the end AND came back with a believable
       number of frames. Backgrounding the tab mid-hover presents no frames at
       all, and accepting the two or three that pass caught would cache a stub
       and animate it forever after. Discard and let the next hover try again --
       but not indefinitely, or a browser that never presents would replay the
       clip on every hover. */
    var MIN_FPS = 12;
    var MAX_ATTEMPTS = 2;

    function usable() {
      var floor = Math.max(2, Math.round((video.duration || 1) * MIN_FPS));
      return video.ended && frames.length >= floor;
    }

    function discard() {
      for (var i = 0; i < frames.length; i++) {
        if (frames[i] && frames[i].close) frames[i].close();
      }
      frames.length = 0;
      times.length = 0;
      count = 0;
      drawn = -1;
    }

    function finish() {
      if (state !== "capturing") return;
      attempts++;

      if (!usable() && attempts < MAX_ATTEMPTS) {
        discard();
        state = "cold";
        try { video.pause(); } catch (e) {}
        /* Back to the top so a retry has somewhere to play from. Seeking to 0
           is the one seek that works without Range support. */
        try { video.currentTime = 0; } catch (e) {}
        return;
      }

      state = frames.length ? "ready" : "failed";
      try { video.pause(); } catch (e) {}
      /* From here the canvas owns the picture in both directions: the <video>
         is at its end and, with seeking unavailable, can never go back. */
      if (state === "ready") {
        /* THE FIRST-HOVER GLITCH. The <video> is what plays on the capture
           pass, and `pos` -- the canvas's own playhead -- is not moved by it.
           So when the canvas took over at the end of that pass it was still
           reading 0: it painted frame 1 and then played the whole thing again
           from the start, on top of an animation the reader had just watched.
           Amanda: "the animation restarted directly before even finished the
           on going animation... only occurs on very first hover."

           Adopt where the video actually got to. Not when leave() has already
           handed over mid-pass, though -- it set `pos` to the frame it broke
           away at and started rewinding from there, and the video has run on to
           its end behind the canvas since. Taking the video's position then
           would throw the picture forward to the last frame mid-rewind. */
        if (!box.classList.contains("is-canvas")) {
          pos = Math.max(0, count - 1);
          box.classList.add("is-canvas");
        }
        paint();
        if (over) run(1);
        else if (pos > 0) run(-1);
      }
    }

    /* One real-time play-through. The reader is watching the <video> itself for
       this pass, so nothing here has to be hidden or hurried. */
    function capture() {
      if (state !== "cold") return;
      state = "capturing";
      begin();
      /* On a retry the clip is parked at its end. */
      if (video.currentTime > 0) { try { video.currentTime = 0; } catch (e) {} }

      var closed = false;
      function close() {
        if (closed) return;
        closed = true;
        video.removeEventListener("ended", close);
        clearTimeout(guard);
        finish();
      }
      var guard = setTimeout(close, (video.duration || 1) * 1000 + 3000);
      video.addEventListener("ended", close);

      /* rVFC is frame-exact, but it only fires for frames actually PRESENTED --
         in a background tab it never fires at all, which would end the pass with
         an empty cache. Same test the Aspire icons make. */
      if (video.requestVideoFrameCallback && !document.hidden) {
        var seen = Object.create(null);
        /* The callback for the final frame runs BEFORE `ended` is set and rVFC
           never fires again after it, so watching video.ended from inside the
           callback alone would hang. Close on whichever signal lands first. */
        video.requestVideoFrameCallback(function step(now, meta) {
          var key = Math.round(meta.mediaTime * 1000);
          if (!(key in seen)) { seen[key] = true; grab(meta.mediaTime); }
          if (video.ended) { close(); return; }
          video.requestVideoFrameCallback(step);
        });
      } else {
        /* No rVFC (Firefox), or a hidden tab. Sample the timeline instead --
           seeking, which is what the Aspire icons fall back to, is not available
           here at all. A 60Hz loop would take two samples of every frame of a
           30fps clip and double the texture cost for no extra motion, so hold
           each sample for SAMPLE_STEP of media time. */
        var SAMPLE_STEP = 1 / 30;
        var lastT = -1;
        (function tick() {
          if (closed) return;
          var t = video.currentTime;
          if (lastT < 0 || t - lastT >= SAMPLE_STEP) { lastT = t; grab(t); }
          if (video.ended) { close(); return; }
          requestAnimationFrame(tick);
        })();
      }
    }

    /* ----------------------------------------------------------- rendering */
    function paint() {
      if (!count) return;
      var i = Math.round(pos);
      if (i > count - 1) i = count - 1;
      if (i < 0) i = 0;
      if (i === drawn) return;
      var b = frames[i];
      if (!b) return;
      drawn = i;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(b, 0, 0, canvas.width, canvas.height);
    }

    function frame(now) {
      raf = 0;
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;

      var end = (count || 1) - 1;
      /* Travel the whole cache in --thumb-duration, whatever it holds. */
      pos += dir * dt * (Math.max(1, end) / secondsOf(video));

      /* Clamp both ways, but only stop at the end being travelled towards: the
         first frame after a hover has dt 0, and a bare `pos <= 0` test would
         cancel the play before it ever left frame 1. */
      if (pos >= end) { pos = end; if (dir > 0) dir = 0; }
      if (pos <= 0)   { pos = 0;   if (dir < 0) dir = 0; }
      paint();

      if (dir) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function run(d) {
      if (reduced.matches) return;
      dir = d;
      if (raf) cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      dir = 0;
      last = 0;
    }

    /* Where the <video> had got to, as a frame index, so the canvas can take
       over mid-play without the picture jumping. */
    function posFromVideo() {
      var t = video.currentTime;
      var i = 0;
      while (i < times.length - 1 && times[i + 1] <= t) i++;
      return i;
    }

    /* ------------------------------------------------------------ warm-up */
    function warm() {
      if (warmed) return;
      warmed = true;
      video.preload = "auto";
      try { video.load(); } catch (e) {}
    }

    /* -------------------------------------------------------- interaction */
    function isLive() {
      if (!(window.V3 && window.V3.work)) return true;
      var slide = card.closest ? card.closest(".wslide") : null;
      return !slide || slide.classList.contains("is-live");
    }

    function enter() {
      over = true;
      if (reduced.matches) return;

      if (state === "ready") { run(1); return; }
      if (state === "capturing") {
        /* Still on the first pass. The video is on screen and already playing
           forward, which is exactly what a hover should look like. */
        var p = video.play();
        if (p && p["catch"]) p["catch"](function () {});
        return;
      }
      if (state === "failed") return;

      /* The first pass is the <video> itself, so it is the playbackRate that
         has to hit the target rather than the canvas clock. */
      try {
        var d = video.duration;
        video.playbackRate = d > 0 ? Math.min(8, d / secondsOf(video)) : 1;
      } catch (e) {}
      var pl = video.play();
      if (pl && pl.then) {
        pl.then(function () {
          capture();
          if (!over) leave();         /* the pointer can leave while play() is pending */
        }, function () { state = "failed"; });
      } else {
        capture();
      }
    }

    function leave() {
      over = false;
      if (reduced.matches) return;

      if (state === "ready") { run(-1); return; }
      if (state !== "capturing") return;

      /* Mid-capture. Hand the picture to the canvas at the frame the video is
         showing, rewind from there, and let the video run on to the end behind
         it -- the cache has to be finished or a later hover would stop short. */
      if (count) {
        pos = Math.min(posFromVideo(), count - 1);
        box.classList.add("is-canvas");
        paint();
        run(-1);
      }
    }

    return {
      card: card,
      video: video,
      warm: warm,
      enter: enter,
      leave: leave,
      /* Called when the slide stops being the live one -- its slot is behind or
         ahead of the scroll now, so it has finished its exit and is off screen.
         Park on frame 1 so it does not come back mid-animation later. `over` is
         deliberately NOT cleared: the pointer may still be on the card, and if
         the slide comes round again it should pick the animation back up. */
      freeze: function () {
        stop();
        if (state === "ready") { pos = 0; paint(); }
        else if (state === "capturing" && count) {
          /* Interrupted on the first pass, where the <video> is still what is
             on screen and cannot be wound back -- there is no seeking on these
             files. Hand over to the canvas on frame 1 and let the capture run
             on behind it. */
          pos = 0;
          box.classList.add("is-canvas");
          paint();
        }
      },
      /* The slide is live again. If the pointer sat on the card the whole time,
         pointerenter will not fire again -- start it here. Goes through enter()
         rather than straight to run(1) because this may be the first hover the
         card has had, in which case there is no cache yet and the capture has
         to begin. */
      resettle: function () {
        if (over) enter();
      },
      get debug() {
        return { src: video.src.split("/").pop(), state: state, frames: count,
                 secs: secondsOf(video), pos: Math.round(pos * 100) / 100,
                 dir: dir, over: over, live: isLive(),
                 capture: capW + "x" + capH, warmed: warmed,
                 canvas: box.classList.contains("is-canvas") };
      }
    };
  }

  var thumbs = [];

  Array.prototype.forEach.call(videos, function (video) {
    var card = video.closest ? video.closest("a") : null;
    if (!card) return;
    var t = Thumb(card, video);
    thumbs.push(t);
    card.addEventListener("pointerenter", function () { t.enter(); });
    card.addEventListener("pointerleave", function () { t.leave(); });
  });

  if (!thumbs.length) return;

  /* ---- when to spend the bytes -------------------------------------------
     Nothing downloads until the section is within a screen and a half AND the
     device has a real pointer. A reader who never scrolls to the work, and
     every phone, pays only for the posters. */
  var near = false;

  function maybeWarm() {
    if (!near || !hoverable.matches) return;
    for (var i = 0; i < thumbs.length; i++) thumbs[i].warm();
  }

  var work = document.getElementById("work");
  if (work && window.IntersectionObserver) {
    var watch = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      watch.disconnect();
      near = true;
      maybeWarm();
    }, { rootMargin: "150% 0px" });
    watch.observe(work);
  } else {
    near = true;
    addEventListener("load", maybeWarm);
  }

  /* A mouse plugged into a tablet mid-visit should get the animation. */
  if (hoverable.addEventListener) hoverable.addEventListener("change", maybeWarm);
  else if (hoverable.addListener) hoverable.addListener(maybeWarm);

  /* ---- the pinned stage --------------------------------------------------
     One gap hover alone does not cover: a slide can stop being live under a
     stationary pointer, and the browser does not reliably fire pointerleave for
     that -- so a clip could sit parked mid-animation and come back that way the
     next time its slide came round.

     .is-live is the right signal, and the only one used here now. It closes
     when the scroll leaves the slot, by which point the slide has finished its
     exit and is off screen, so parking it on frame 1 is invisible. (The
     narrower .is-settled was tried and reverted: it closes the moment an exit
     STARTS, while the card is still fully visible, which is exactly the
     no-animation snap Amanda reported.) */
  var slides = document.querySelectorAll(".wslide");
  if (slides.length && window.MutationObserver) {
    var mo = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var slide = records[i].target;
        var live = slide.classList.contains("is-live");
        for (var j = 0; j < thumbs.length; j++) {
          if (!slide.contains(thumbs[j].card)) continue;
          if (live) thumbs[j].resettle();
          else thumbs[j].freeze();
        }
      }
    });
    Array.prototype.forEach.call(slides, function (slide) {
      mo.observe(slide, { attributes: true, attributeFilter: ["class"] });
    });
  }

  /* ------------------------------------------------------------- debug hook */
  window.thumbVideo = {
    thumbs: thumbs,
    warm: function () { near = true; maybeWarm(); },
    get state() { return thumbs.map(function (t) { return t.debug; }); }
  };
})();
