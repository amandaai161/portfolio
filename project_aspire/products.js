/* =============================================================================
   Aspire 2026 — product section
   -----------------------------------------------------------------------------
   Two things happen here.

   1. Intro. The headline drops in from above and the six cards rise from below,
      staggered, cued by hero.js as the section docks under the animation. Just
      a class; the motion itself is CSS.

   2. Icon animations. Each card's icon is a 22–23 frame WEBM with alpha. It
      rests on frame 1, plays forward while the card is hovered at --icon-speed ×
      its native rate, stops on its last frame, and plays *backwards* from
      wherever it got to when the pointer leaves.

      A <video> cannot play backwards, so — exactly as in hero.js — each clip is
      decoded once into a cache of ImageBitmaps and a canvas blits whichever
      frame the interaction asks for. The clips are tiny (300×112), so all six
      together cost around 19MB of texture.

      Decoding is serialised: six simultaneous play-throughs would fight each
      other, and the hero's own capture, for decoders. It starts while the
      section is still a screen and a half away, and a card that gets hovered
      before its turn jumps the queue.
   ========================================================================== */

(function () {
  'use strict';

  var section = document.getElementById('products');
  if (!section) return;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var root = document.documentElement;

  function num(name, fallback) {
    var v = parseFloat(getComputedStyle(root).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }
  var FPS   = num('--icon-fps', 30);
  var SPEED = num('--icon-speed', 1.7);

  /* ==================================================== 1. INTRO REVEALS
     The cue comes from hero.js, which fires `hero:dock` on this section as it
     comes within --intro-lead of docking under the animation. That is the right
     moment: until then the section is white-on-white behind the gradient mask,
     and an IntersectionObserver — which fires the instant the section crosses
     the fold — would reveal the headline a long way below where it belongs.

     hero.js also re-arms the cue once the section is back below the fold, so the
     intro plays again on a second pass instead of the contents simply being
     parked in view on the long way up.

     The observer is only the fallback for a page without the pinned hero. */
  var revealable = section.querySelectorAll('.reveal');
  var r;

  function reveal(on) {
    for (var i = 0; i < revealable.length; i++) {
      revealable[i].classList.toggle('is-in', on !== false);
    }
  }

  if (reduced.matches) {
    reveal();
  } else {
    section.addEventListener('hero:dock', function () { reveal(true); });
    section.addEventListener('hero:undock', function () { reveal(false); });

    /* `hero:dock` only ever fires while the hero is a pin. On phones it is not —
       hero.js runs in flat mode and there is no dock to be near — so the cue never
       arrived and this whole section sat at opacity 0, invisible. The observer is
       the fallback for that as well as for a page with no hero.js at all.

       Two-way, like reveal.js, rather than disconnecting on the first hit: every
       other section on the page replays its intro when you scroll back up, and
       there is no reason this one should be the exception. */
    var flat = window.hero && window.hero.flat;
    if ((!window.hero || flat) && window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        reveal(entries[0].isIntersecting);
      }, { rootMargin: '0px 0px -20% 0px', threshold: 0.01 });
      io.observe(section);
    } else if (!window.hero) {
      reveal();
    }
  }


  /* ==================================================== 2. ICON ANIMATIONS */

  function Icon(card, onDecoded) {
    var box    = card.querySelector('.card__icon');
    var video  = box && box.querySelector('video');
    var canvas = box && box.querySelector('canvas');
    if (!box || !video || !canvas) return null;

    var ctx = canvas.getContext('2d', { alpha: true });
    var frames = [];          // ImageBitmaps, in playback order
    var count = 0;            // how many are usable, counting from frame 0
    var drawn = -1;
    var state = 'idle';       // idle | busy | done | failed

    var pos = 0;              // current frame; fractional while animating
    var dir = 0;              // +1 forward, -1 rewinding, 0 at rest
    var last = 0;
    var raf = 0;
    var hovered = false;

    /* ---------------------------------------------------------- decoding */
    var off, octx, capW = 0, capH = 0;

    function expected() {
      var d = video.duration;
      return d && isFinite(d) ? Math.max(1, Math.round(d * FPS)) : 23;
    }

    function begin() {
      /* Displayed at 200×75; capture at the source resolution unless the
         display box on this screen would want less than that. */
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var srcW = video.videoWidth || 300;
      var srcH = video.videoHeight || 112;
      var want = Math.round(box.getBoundingClientRect().width * dpr) || 400;
      capW = Math.max(200, Math.min(srcW, want));
      capH = Math.round(capW * srcH / srcW);

      canvas.width = capW;
      canvas.height = capH;
      off = document.createElement('canvas');
      off.width = capW;
      off.height = capH;
      octx = off.getContext('2d', { alpha: true });

      for (var i = 0; i < frames.length; i++) {
        if (frames[i] && frames[i].close) frames[i].close();
      }
      frames.length = 0;
      count = 0;
      drawn = -1;
    }

    function grab() {
      octx.clearRect(0, 0, capW, capH);
      octx.drawImage(video, 0, 0, capW, capH);
      var i = frames.length;
      frames.push(null);
      return createImageBitmap(off).then(function (b) {
        frames[i] = b;
        /* Frames only become usable in an unbroken run from the start. */
        while (count < frames.length && frames[count]) count++;
        if (count === 1) { box.classList.add('is-canvas'); paint(); }
      }, function () {
        frames[i] = frames[i - 1] || null;
      });
    }

    function settle(how) {
      state = how;
      try { video.pause(); } catch (e) {}
      paint();
      /* If the pointer is already on the card, start playing for real now. */
      if (how === 'done' && hovered) run(1);
      onDecoded();
    }

    function decode() {
      state = 'busy';
      begin();
      if (video.requestVideoFrameCallback && !document.hidden) byPlayback();
      else bySeeking();
    }

    /* Fast path: one real-time play-through (~0.75s), grabbing every frame
       requestVideoFrameCallback presents. */
    function byPlayback() {
      var seen = Object.create(null);
      var closed = false;

      /* The callback for the last frame runs *before* `ended` is set, and rVFC
         never fires again after it — so a pass that only watches video.ended
         from inside the callback never finishes. That left this clip stuck at
         'busy', and since the decode queue is serialised, every clip behind it
         never decoded at all: only the first card's icon ever animated. Close
         on whichever signal lands first, and keep a backstop for neither. */
      function close() {
        if (closed) return;
        closed = true;
        video.removeEventListener('ended', close);
        clearTimeout(guard);
        settle('done');
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

      var guard = setTimeout(close, (video.duration || 1) * 1000 + 2000);
      video.addEventListener('ended', close);
      video.requestVideoFrameCallback(step);

      var p = video.play();
      if (p && p['catch']) p['catch'](function () {
        closed = true;
        clearTimeout(guard);
        bySeeking();
      });
    }

    /* Fallback: walk the timeline. Used when rVFC is missing, or when the page
       is in a background tab, where rVFC never fires. */
    function bySeeking() {
      var n = expected();
      var i = 0;

      function step() {
        if (i >= n) { settle('done'); return; }
        var t = Math.min((i + 0.5) / FPS, video.duration - 0.001);
        var onSeeked = function () {
          video.removeEventListener('seeked', onSeeked);
          grab().then(function () { i++; setTimeout(step, 0); });
        };
        video.addEventListener('seeked', onSeeked);
        try { video.currentTime = t; } catch (e) { settle('done'); }
      }
      try { video.pause(); } catch (e) {}
      step();
    }

    /* Park the <video> on frame 1 — it is what shows until the cache exists. */
    video.addEventListener('loadeddata', function () {
      try { video.currentTime = 0; } catch (e) {}
    });
    video.addEventListener('error', function () { state = 'failed'; onDecoded(); });

    /* --------------------------------------------------------- rendering */
    function paint() {
      if (!count) return;
      var i = Math.round(pos);
      if (i > count - 1) i = count - 1;
      if (i < 0) i = 0;
      if (i === drawn) return;
      drawn = i;
      var b = frames[i];
      if (!b) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(b, 0, 0, canvas.width, canvas.height);
    }

    function frame(now) {
      raf = 0;
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;

      var end = (count || 1) - 1;
      pos += dir * dt * FPS * SPEED;

      /* Clamp either way, but only *stop* at the end we are actually heading
         for — the first frame after a hover has dt 0, and a bare `pos <= 0`
         test would cancel the play before it ever left frame 1. */
      if (pos >= end) { pos = end; if (dir > 0) dir = 0; }   // stop on the last
      if (pos <= 0)   { pos = 0;   if (dir < 0) dir = 0; }   // …and on the first
      paint();

      if (dir) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    /* Cancel and re-arm rather than guarding with a flag, so a frame that was
       requested but never delivered (a hover that happened as the tab went to
       the background, say) can't wedge the loop. */
    function run(d) {
      if (reduced.matches) return;
      dir = d;
      if (raf) cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    return {
      card: card,
      video: video,
      get settled() { return state === 'done' || state === 'failed'; },
      get ready() { return video.readyState >= 3; },
      get busy() { return state === 'busy'; },
      decode: decode,
      enter: function () { hovered = true; run(1); },
      leave: function () { hovered = false; run(-1); },
      get debug() {
        return { state: state, count: count, pos: Math.round(pos * 100) / 100,
                 dir: dir, capture: capW + '×' + capH, drawn: drawn };
      }
    };
  }

  /* ------------------------------------------------- serialised decode queue
     One clip at a time. pump() is idempotent and re-entrant-safe: it is called
     from the warm-up observer, from each video as it becomes playable, on tab
     focus, and whenever a clip finishes. */
  var icons = [];
  var queue = [];
  var working = null;
  var started = false;      // nothing decodes until the section is near, or hovered

  function start() { started = true; pump(); }

  function pump() {
    if (!started) return;
    if (working && working.busy) return;
    working = null;

    while (queue.length && queue[0].settled) queue.shift();
    if (!queue.length) return;

    var ic = queue[0];
    if (!ic.ready) return;            // not playable yet; canplay will call back
    if (!window.createImageBitmap) return;

    working = ic;
    ic.decode();                      // calls back through onDecoded -> pump()
  }

  /* A hovered card gets decoded before anything still waiting behind it. */
  function queueFirst(ic) {
    var at = queue.indexOf(ic);
    if (at > 0) { queue.splice(at, 1); queue.unshift(ic); }
    start();
  }

  var cards = section.querySelectorAll('.card');
  for (var c = 0; c < cards.length; c++) {
    var icon = Icon(cards[c], pump);
    if (!icon) continue;
    icons.push(icon);
    queue.push(icon);

    (function (ic) {
      ic.card.addEventListener('pointerenter', function () { queueFirst(ic); ic.enter(); });
      ic.card.addEventListener('pointerleave', function () { ic.leave(); });
      /* Both, because canplaythrough is not guaranteed to fire — decode() only
         needs readyState 3, which is what canplay signals. */
      ic.video.addEventListener('canplay', pump);
      ic.video.addEventListener('canplaythrough', pump);
    })(icon);
  }

  /* Start warming up while the section is still a screen and a half away. Every
     other trigger only calls pump(), which does nothing until this fires — so a
     visitor who never scrolls that far never pays for six video decodes. */
  if (window.IntersectionObserver) {
    var warm = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      warm.disconnect();
      start();
    }, { rootMargin: '150% 0px' });
    warm.observe(section);
  } else {
    addEventListener('load', start);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) pump();
  });

  /* ------------------------------------------------------------- debug hook */
  window.products = {
    icons: icons,
    warm: function () {
      queue = icons.slice();
      start();
    },
    get state() {
      return icons.map(function (i) { return i.debug; });
    }
  };
})();
