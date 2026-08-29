/* ============================================================================
   KAYN 2026 — film.js
   Scroll-scrubbed WebM (VP9 + alpha).

   The asset is deliberately all-intra (every one of the 95 frames is a
   keyframe, verified with check-alpha.py): an inter-coded encode makes a seek
   decode the whole GOP, which is what turns scroll-scrubbing into mud.

   Three things make the scrub feel attached to the wheel:

   1. The whole file is fetched into a blob before first paint, so a seek never
      waits on the network.
   2. Scroll writes a *target frame*; a single ticker pass issues at most one
      seek per animation frame. Without that decoupling, a fast wheel queues
      dozens of seeks the decoder then has to walk through in order.
   3. The in-flight guard's timeout is derived from measured seek latency rather
      than fixed. A fixed low value aborts and re-issues every seek on a slow
      decoder, so the decoder restarts forever and never presents a frame.

   Public surface: window.KAYNFilm
   ========================================================================= */
(function (window, document) {
  "use strict";

  var CONFIG = {
    src: "images/2026kayn-bottle-animation.webm",
    fps: 30,
    totalFrames: 95,          /* 95 @ 30fps = 3.1667s */

    /* Fraction of the film at which the dropper cap is fully seated on the
       bottle — Storyboard 2.3 hangs the USP ring off this moment.
       Measured by rendering frames 1/30/55/65/75/85/95 out of the container:
       the alpha bbox is still growing at frame 95 (y1 87.3% -> 88.0%, coverage
       4.06% -> 4.21%), so the seat *is* the last frame. */
    capSeat: 1.0,

    /* Geometry of the settled bottle in the LAST frame, as fractions of the
       picture. app.js (fitFilm) positions the film from these so the bottle
       finishes centred in the USP ring, so they are load-bearing — re-measure
       after any re-encode or the composition drifts.

       Measured off frame 95 at 1920x1080: alpha bbox (846, 315) → (1107, 1025),
       i.e. x 44.06→57.66%, y 29.17→94.91%. Nothing touches a frame edge; the
       whole bottle is in shot with room beneath its base.

       That last sentence is the assertion worth re-testing. An earlier encode of
       this asset scaled 2400x1350 into a 1920x1080 render without setting the
       strip transform, which centre-cropped it: 240px off each side, 135px off
       top and bottom, and the bottle's base went with the bottom 135px. The
       giveaway is a bbox that ends at exactly 100% — bounded by the frame rather
       than by the object. Compare against the AE master before trusting a
       re-export's framing.

       The render also holds still twice — frames 46–51 and 92–95, with a slow
       push-in between — which is what app.js CONFIG.holdFrame parks the scrub on. */
    object: { h: 0.6574, cx: 0.5086, cy: 0.6204, visible: 1.0 },

    seekWatchdogFloorMs: 160, /* never abort a seek sooner than this */
    seekWatchdogFactor: 2.5,  /* …or sooner than 2.5x the measured average */
    slowSeekWarnFactor: 3     /* warn once if the encode can't keep up */
  };

  var video = null;
  var objectURL = null;
  var ready = false;

  /* ── seek scheduler ───────────────────────────────────────────────────── */
  var targetFrame = 0;
  var appliedFrame = -1;
  var seekBusy = false;
  var seekStamp = 0;
  var seekLatencyEma = 0;
  var seekSamples = 0;
  var warnedSlow = false;
  var rvfcHandle = null;
  var ticking = false;

  function duration() { return CONFIG.totalFrames / CONFIG.fps; }

  function frameTime(f) {
    /* Seek to the centre of the frame, not its boundary: landing exactly on a
       boundary lets the decoder pick either neighbour, which flickers. */
    return (f + 0.5) / CONFIG.fps;
  }

  function watchdogMs() {
    return Math.max(CONFIG.seekWatchdogFloorMs, seekLatencyEma * CONFIG.seekWatchdogFactor);
  }

  function noteSeekLatency(ms) {
    seekSamples += 1;
    var alpha = seekSamples < 5 ? 0.5 : 0.15;
    seekLatencyEma = seekSamples === 1 ? ms : seekLatencyEma + alpha * (ms - seekLatencyEma);
    if (!warnedSlow && seekSamples >= 8 &&
        seekLatencyEma > (1000 / CONFIG.fps) * CONFIG.slowSeekWarnFactor) {
      warnedSlow = true;
      console.warn(
        "[KAYN] Film seeks are averaging " + Math.round(seekLatencyEma) + "ms against a " +
        Math.round(1000 / CONFIG.fps) + "ms frame budget. The scrub will feel heavy. " +
        "This is decode cost, not scroll code — re-encoding the webm at a smaller " +
        "pixel size is the fix."
      );
    }
  }

  function releaseSeek() {
    if (seekBusy) noteSeekLatency(performance.now() - seekStamp);
    seekBusy = false;
  }

  function watchFrame() {
    if (!video || typeof video.requestVideoFrameCallback !== "function") return;
    /* rVFC fires when a frame is actually *presented*; `seeked` fires before
       paint, so it over-reports how fast the decoder is. */
    rvfcHandle = video.requestVideoFrameCallback(function () {
      rvfcHandle = null;
      releaseSeek();
      watchFrame();
    });
  }

  function applySeek() {
    if (!ready || !video) return;
    var f = targetFrame;
    /* Trust the element, not the bookkeeping. appliedFrame is set optimistically
       before currentTime is assigned, so a seek that gets dropped or overwritten
       — the autoplay kick in attach() resetting to frame 0 after its promise
       resolves, say — would otherwise stick forever, because every later pass
       sees f === appliedFrame and returns. Scrubbing never re-issues off this:
       assigning currentTime updates the property synchronously, so the check
       passes on the very next pass. */
    if (f === appliedFrame &&
        Math.abs(video.currentTime - frameTime(f)) < 1 / CONFIG.fps) return;
    if (seekBusy && performance.now() - seekStamp < watchdogMs()) return;

    appliedFrame = f;
    seekBusy = true;
    seekStamp = performance.now();
    try { video.currentTime = frameTime(f); } catch (err) { seekBusy = false; }
  }

  function startTicker() {
    if (ticking || !window.gsap) return;
    ticking = true;
    window.gsap.ticker.add(applySeek);
  }

  /* ── public ───────────────────────────────────────────────────────────── */

  var KAYNFilm = {
    config: CONFIG,

    frames: function () { return CONFIG.totalFrames; },
    fps: function () { return CONFIG.fps; },
    duration: duration,

    /* Fetch the whole film into a blob URL, reporting 0→1 as it streams.
       Falls back to the plain URL if the stream can't be read. */
    preload: function (onProgress) {
      return fetch(CONFIG.src, { cache: "force-cache" }).then(function (res) {
        if (!res.ok) throw new Error("film HTTP " + res.status);
        var total = Number(res.headers.get("content-length")) || 0;
        if (!res.body || !total) {
          return res.blob().then(function (b) {
            if (onProgress) onProgress(1);
            return b;
          });
        }
        var reader = res.body.getReader();
        var chunks = [];
        var seen = 0;
        return (function pump() {
          return reader.read().then(function (r) {
            if (r.done) return new Blob(chunks, { type: "video/webm" });
            chunks.push(r.value);
            seen += r.value.byteLength;
            if (onProgress) onProgress(Math.min(1, seen / total));
            return pump();
          });
        })();
      }).then(function (blob) {
        objectURL = URL.createObjectURL(blob);
        return objectURL;
      }).catch(function (err) {
        console.warn("[KAYN] Film blob preload failed; streaming instead.", err);
        if (onProgress) onProgress(1);
        return CONFIG.src;
      });
    },

    /* Wire the element and hold until frame 0 is actually on screen. */
    attach: function (el, url) {
      video = el;
      return new Promise(function (resolve) {
        var settled = false;
        function done() {
          if (settled) return;
          settled = true;

          /* Reconcile the declared frame count against what the container
             actually reports, so a re-export can't silently desync the
             captions and the ring from the film. */
          var d = video.duration;
          if (isFinite(d) && d > 0) {
            var counted = Math.round(d * CONFIG.fps);
            if (Math.abs(counted - CONFIG.totalFrames) > 1) {
              console.warn("[KAYN] Film declares " + CONFIG.totalFrames + " frames but the file " +
                           "holds " + counted + " (" + d.toFixed(4) + "s @ " + CONFIG.fps + "fps). " +
                           "Using " + counted + ".");
              CONFIG.totalFrames = counted;
            }
          }

          ready = true;
          watchFrame();
          startTicker();
          resolve(KAYNFilm);
        }

        video.addEventListener("loadeddata", done, { once: true });
        video.addEventListener("error", function () {
          console.warn("[KAYN] Film failed to load — the section stays static.");
          if (!settled) { settled = true; resolve(KAYNFilm); }
        }, { once: true });

        video.src = url;
        video.load();

        /* On iOS the decoder stays cold until a play() has been granted, and
           the attribute-level `muted` is what unlocks it. One frame is enough. */
        var kick = video.play();
        if (kick && typeof kick.then === "function") {
          kick.then(function () {
            video.pause();
            /* Only park on frame 0 if nothing has asked for a frame yet. This
               promise resolves well after attach() returns, so on a build that
               seeks once and then stops — the portrait still — it would land
               after that seek and quietly undo it. */
            if (appliedFrame < 0) video.currentTime = frameTime(0);
          }).catch(function () { /* autoplay refused: seeking still works */ });
        }

        /* Belt and braces for browsers that never fire loadeddata on a blob. */
        setTimeout(done, 4000);
      });
    },

    /* 0→1 across the film. Called from the scroll timeline. */
    setProgress: function (p) {
      var last = CONFIG.totalFrames - 1;
      var f = Math.round(Math.min(1, Math.max(0, p)) * last);
      targetFrame = f;
    },

    frame: function () { return appliedFrame; },
    isReady: function () { return ready; },

    /* Issue the pending seek now instead of waiting for the next ticker pass.
       Only needed when something outside the normal scroll loop moved the
       target — a test harness, or a headless/throttled context where rAF is
       not running. */
    pump: function () { seekBusy = false; applySeek(); return appliedFrame; },

    stats: function () {
      return {
        ready: ready, frames: CONFIG.totalFrames, fps: CONFIG.fps,
        duration: +duration().toFixed(4),
        target: targetFrame, applied: appliedFrame,
        seekLatencyEmaMs: Math.round(seekLatencyEma), seekSamples: seekSamples,
        watchdogMs: Math.round(watchdogMs()), blob: !!objectURL
      };
    },

    /* Diagnostic: walk the film and report where motion stops, i.e. the frame
       at which the dropper has finished seating. Run from the console:
       `await KAYNFilm.findSettle()` — then set CONFIG.capSeat to the ratio. */
    findSettle: function () {
      if (!ready) return Promise.resolve(null);
      var w = 160, h = Math.round(w * video.videoHeight / video.videoWidth);
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var ctx = c.getContext("2d", { willReadFrequently: true });
      var prev = null, diffs = [];
      var i = 0;

      function step() {
        if (i >= CONFIG.totalFrames) {
          var peak = Math.max.apply(null, diffs) || 1;
          var quiet = -1;
          for (var k = diffs.length - 1; k >= 0; k--) {
            if (diffs[k] > peak * 0.06) { quiet = k + 1; break; }
          }
          return {
            frames: CONFIG.totalFrames,
            settleFrame: quiet,
            capSeat: +(quiet / (CONFIG.totalFrames - 1)).toFixed(3),
            diffs: diffs.map(function (d) { return Math.round(d); })
          };
        }
        return new Promise(function (res) {
          var f = i;
          function grab() {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(video, 0, 0, w, h);
            var d = ctx.getImageData(0, 0, w, h).data;
            if (prev) {
              var s = 0;
              for (var j = 3; j < d.length; j += 4) s += Math.abs(d[j] - prev[j]);
              diffs.push(s / (w * h));
            }
            prev = d;
            i += 1;
            res();
          }
          video.addEventListener("seeked", function () {
            if (typeof video.requestVideoFrameCallback === "function") {
              video.requestVideoFrameCallback(grab);
            } else { setTimeout(grab, 40); }
          }, { once: true });
          video.currentTime = frameTime(f);
        }).then(step);
      }
      return Promise.resolve().then(step);
    }
  };

  window.KAYNFilm = KAYNFilm;
})(window, document);
