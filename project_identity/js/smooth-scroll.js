/* ==========================================================================
   Identity — smooth scrolling
   --------------------------------------------------------------------------
   Keeps the native scrollbar and native scroll position (so anchors, focus
   and deep links all behave) but eases the position towards a target that
   the wheel / keyboard writes to. One rAF loop drives everything on the page;
   other modules subscribe through ID.onTick().
   ========================================================================== */

(function () {
  "use strict";

  var ID = (window.ID = window.ID || {});
  var subscribers = [];

  /* set here because this is the first script to run: CSS that only makes
     sense with scripting (the collapsed header, chiefly) hangs off it */
  document.documentElement.classList.add("has-js");

  ID.onTick = function (fn) {
    subscribers.push(fn);
    return fn;
  };

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isCoarse = window.matchMedia("(pointer: coarse)").matches;
  var smooth = !prefersReduced && !isCoarse;

  var DAMPING = 9.5;          /* higher = snappier; ~0.13 lerp at 60fps */
  var WHEEL_MULTIPLIER = 1;
  var LINE_HEIGHT = 16;

  var target = window.scrollY;
  var current = target;
  var lastSet = -1e9;             /* the last position we wrote ourselves;
                                     starts far away so a genuine scroll to
                                     the very top is never mistaken for ours */
  var last = performance.now();

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function clamp(v) {
    return Math.max(0, Math.min(maxScroll(), v));
  }

  function tick(now) {
    var dt = Math.min(0.064, (now - last) / 1000);
    last = now;

    if (smooth) {
      if (Math.abs(target - current) > 0.05) {
        current += (target - current) * (1 - Math.exp(-DAMPING * dt));
        if (Math.abs(target - current) < 0.05) current = target;
        lastSet = current;
        window.scrollTo(0, current);
      }
    } else {
      current = target = window.scrollY;
    }

    /* one bad subscriber must not take the whole page's loop down with it */
    for (var i = 0; i < subscribers.length; i++) {
      try { subscribers[i](current); } catch (err) { /* keep ticking */ }
    }
    requestAnimationFrame(tick);
  }

  function onWheel(e) {
    if (e.ctrlKey) return;                       /* pinch-zoom */
    if (e.target.closest && e.target.closest("[data-native-scroll]")) return;
    e.preventDefault();
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= LINE_HEIGHT;
    else if (e.deltaMode === 2) delta *= window.innerHeight;
    target = clamp(target + delta * WHEEL_MULTIPLIER);
  }

  var KEY_STEP = 90;

  function onKeyDown(e) {
    var t = e.target;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
    /* let space/enter activate whatever has focus */
    if (e.key === " " && t && /^(button|a|summary)$/i.test(t.tagName)) return;
    var vh = window.innerHeight;
    var handled = true;
    switch (e.key) {
      case "ArrowDown": target = clamp(target + KEY_STEP); break;
      case "ArrowUp":   target = clamp(target - KEY_STEP); break;
      case "PageDown":  target = clamp(target + vh * 0.9); break;
      case "PageUp":    target = clamp(target - vh * 0.9); break;
      case "Home":      target = 0; break;
      case "End":       target = maxScroll(); break;
      case " ":         target = clamp(target + (e.shiftKey ? -1 : 1) * vh * 0.9); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }

  function onScroll() {
    /* scroll events are dispatched a frame late, so a flag set around
       scrollTo() is useless here — compare against the value we wrote instead.
       Anything else (scrollbar drag, deep link, find-in-page) resyncs. */
    var y = window.scrollY;
    if (Math.abs(y - lastSet) <= 2) return;
    current = target = y;
  }

  ID.scrollTo = function (value, opts) {
    opts = opts || {};
    var to = typeof value === "number"
      ? value
      : (value.getBoundingClientRect().top + window.scrollY - (opts.offset || 0));
    target = clamp(to);
    if (!smooth) window.scrollTo({ top: target, behavior: "auto" });
  };

  ID.isSmooth = smooth;

  function init() {
    /* pick up wherever the browser actually put us — a #fragment, a restored
       scroll position or a reload all land after this script is parsed */
    current = target = window.scrollY;

    if (smooth) {
      document.documentElement.classList.add("has-smooth-scroll");
      window.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("keydown", onKeyDown);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { target = clamp(target); });

    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href").slice(1);
      if (!id) { e.preventDefault(); return; }   /* bare "#" placeholder link */
      var el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();

      /* deck slides are pinned, so their box is useless — scroll to the
         position that brings that slide up in the dissolve instead */
      var deck = ID.deck;
      if (deck) {
        var slide = deck.indexOf(el);
        if (slide >= 0) { ID.scrollTo(deck.offsetOf(slide)); return; }
      }
      ID.scrollTo(el);
    });

    /* late layout (fonts, images) can move the browser's restored position —
       only resync if the visitor hasn't started scrolling yet */
    window.addEventListener("load", function () {
      if (Math.abs(target - current) < 0.5) current = target = window.scrollY;
    });

    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
