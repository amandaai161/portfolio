/* =============================================================================
   Aspire 2026 — benefit section video pacing
   -----------------------------------------------------------------------------
   One job. Any 600×600 video in the section autoplays and loops at
   --benefit-speed of its native rate. Autoplay needs `muted` + `playsinline`
   (both set in the markup); playbackRate has to be set from script, and re-set
   after every `loadedmetadata`, because a reload or a source swap resets it to 1.

   Only the FX row is a video now — the cashback row is a still, and the perks row
   is a still with a CSS logo rail over it (see .rail in styles.css, which needs
   nothing from here). The loop below is still written for a list, so restoring a
   video to any row needs no change here.

   No frame cache, unlike hero.js and products.js: the clip carries no alpha and
   nothing scrubs or rewinds it, so a plain <video> is right.

   The section's intro is not here — reveal.js runs one observer across every
   [data-reveal] section, this one included.
   ========================================================================== */

(function () {
  'use strict';

  var section = document.getElementById('benefits');
  if (!section) return;

  function num(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }

  /* ------------------------------------------------------------- 1. video */
  var videos = section.querySelectorAll('.benefit__media video');

  /* Read per element, not once from :root — --benefit-speed inherits, so a row
     can slow its own clip down with nothing more than a --benefit-speed of its
     own. Only the FX row has a video today, so nothing overrides it. */
  function speedOf(video) {
    var v = parseFloat(getComputedStyle(video).getPropertyValue('--benefit-speed'));
    return isNaN(v) || v <= 0 ? num('--benefit-speed', 0.5) : v;
  }

  function pace(video) {
    try { video.playbackRate = speedOf(video); } catch (e) {}
  }

  function nudge(video) {
    pace(video);
    /* Autoplay can still be refused (a data-saver setting, a paused tab at load).
       play() is idempotent, so it is safe to ask again whenever we get a chance. */
    if (video.paused) {
      var p = video.play();
      if (p && p['catch']) p['catch'](function () {});
    }
  }

  for (var v = 0; v < videos.length; v++) {
    (function (video) {
      pace(video);
      video.addEventListener('loadedmetadata', function () { pace(video); });
      /* Chrome resets playbackRate on the seek back to 0 at each loop point. */
      video.addEventListener('seeked', function () { pace(video); });
      video.addEventListener('play', function () { pace(video); });
    })(videos[v]);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    for (var i = 0; i < videos.length; i++) nudge(videos[i]);
  });

  /* The `autoplay` attribute is a request, not a guarantee — a data-saver
     setting or a load in a background tab will refuse it, and the clip would
     then sit on frame 1 forever. Asking again as each row comes into view both
     covers that and keeps three looping decoders idle while off screen. */
  if (window.IntersectionObserver) {
    var watch = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var video = entries[i].target;
        if (entries[i].isIntersecting) nudge(video);
        else if (!video.paused) video.pause();
      }
    }, { rootMargin: '25% 0px', threshold: 0 });

    for (var w = 0; w < videos.length; w++) watch.observe(videos[w]);
  }

  /* --------------------------------------------------------- debug hook */
  window.benefits = {
    get state() {
      return Array.prototype.map.call(videos, function (x) {
        var speed = speedOf(x);
        return {
          src: x.src.split('/').pop(),
          size: x.videoWidth + '×' + x.videoHeight,
          rate: x.playbackRate,
          loop: x.loop,
          paused: x.paused,
          duration: Math.round((x.duration || 0) * 1000) / 1000,
          effectiveSecs: Math.round((x.duration || 0) / speed * 100) / 100
        };
      });
    }
  };
})();
