/* ============================================================================
   THE PROJECT NAVBAR — behaviour
   ----------------------------------------------------------------------------
   Three sub-pages, one document, one in the flow at a time.

   WHY NOT A HORIZONTAL TRACK. The obvious build for a left/right push is three
   panels side by side in a flex row that translates. It cannot work here: the
   web panel contains identity's scroll deck and gradient, both of which read
   window.scrollY and documentElement.scrollHeight, and neither reads anything
   useful from inside an overflow container. Aspire and kayn have the same
   problem in their own dialects. So the panels take turns being the document,
   and the push is drawn by the View Transitions API over a snapshot -- which
   costs one viewport-sized capture and no layout at all.

   NO VIEW TRANSITIONS, OR REDUCED MOTION: the swap still happens, instantly.
   The animation is decoration on top of a state change that stands on its own.

   ES5 on purpose -- see js/pf-chrome.js's header.
   ========================================================================== */
(function (window, document) {
  "use strict";

  var bar = document.querySelector("[data-pf-projnav]");
  var wrap = document.querySelector("[data-pf-panels]");
  if (!bar || !wrap) return;

  var ORDER = ["web", "brand", "case"];

  var tabs = {};
  var panels = {};
  var i, el, list;

  list = bar.querySelectorAll(".pf-projnav__tab");
  for (i = 0; i < list.length; i++) {
    el = list[i];
    tabs[el.getAttribute("data-tab")] = el;
  }

  list = wrap.querySelectorAll(".pf-panel");
  for (i = 0; i < list.length; i++) {
    el = list[i];
    panels[el.getAttribute("data-panel")] = el;
  }

  var current = "web";

  function valid(name) {
    return ORDER.indexOf(name) !== -1 && tabs[name] && panels[name];
  }

  /* The state change itself. Deliberately synchronous and animation-free: the
     view transition in show() wraps this, and everything that cannot run one
     calls it directly. */
  function commit(name) {
    var k, n;
    for (k = 0; k < ORDER.length; k++) {
      n = ORDER[k];
      panels[n].hidden = n !== name;
      tabs[n].setAttribute("aria-selected", n === name ? "true" : "false");
    }
    current = name;

    /* Amanda: every tab opens at its own top. Also the one state in which the
       deck is guaranteed correct before it re-measures below. */
    window.scrollTo(0, 0);

    /* deck.js and gradient.js both re-measure on resize (debounced 120ms) and
       have been sitting in a display:none subtree, where every box measured
       zero. At scrollY 0 the deck's correct rendering is slide 0, which is what
       is on screen right now, so the re-measure lands invisibly. */
    window.dispatchEvent(new Event("resize"));

    if (window.PFProjectNav && window.PFProjectNav.onChange) {
      window.PFProjectNav.onChange(name);
    }
  }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Bumped once per transition actually started below. Not just a boolean --
     see the comment at its use site in show(). */
  var slideToken = 0;

  function show(name) {
    if (!valid(name) || name === current) return;

    var forward = ORDER.indexOf(name) > ORDER.indexOf(current);
    var root = document.documentElement;

    if (!document.startViewTransition || reduced.matches) {
      commit(name);
      return;
    }

    /* The direction is read by the keyframes in css/pf-projectnav.css. Set
       before the transition starts and cleared when it has finished, so a
       transition never runs against the previous one's direction. */
    root.setAttribute("data-pf-slide", forward ? "forward" : "back");

    /* A second tab click inside the ~520ms animation starts a new transition
       (call it VT2) while the first (VT1) is still live. Per spec, starting
       VT2 skips VT1 outright, which settles VT1's `finished` immediately --
       BEFORE VT2 has run its own updateCallback or set its own direction. If
       VT1's cleanup below just unconditionally cleared the attribute, it
       would do so at that moment, so by the time VT2's snapshots are actually
       sampled `data-pf-slide` is gone and matches neither `="forward"` nor
       `="back"` in css/pf-projectnav.css -- VT2 silently falls back to the
       browser's default cross-fade instead of the push. Tagging each
       transition with a token and only clearing the attribute when that
       token is still the most recent one lets VT1's premature settle no-op
       instead of stepping on VT2's direction. */
    var token = ++slideToken;

    var vt = document.startViewTransition(function () { commit(name); });
    /* .ready rejects (InvalidStateError) whenever the browser skips the
       animation outright -- document hidden or not fully active at the
       moment the transition would start, which a stray tab switch or a
       backgrounded window makes ordinary. commit() already ran via the
       callback above either way; this just keeps that rejection from
       surfacing as an uncaught promise. */
    vt.ready["catch"](function () { });
    vt.finished["catch"](function () { }).then(function () {
      if (token === slideToken) root.removeAttribute("data-pf-slide");
    });
  }

  /* ---- the tabs ---------------------------------------------------------- */
  for (i = 0; i < ORDER.length; i++) {
    (function (name) {
      tabs[name].addEventListener("click", function () {
        if (name === current) return;
        setHash(name);
        show(name);
      });
    })(ORDER[i]);
  }

  /* ---- the hash ----------------------------------------------------------
     A sub-page is worth a URL: it is how Amanda sends a recruiter straight to
     the brand work, and it is what makes the back button undo a tab switch.
     "web" writes no hash, because it is what a bare /project_identity/ means. */
  function setHash(name) {
    var url = window.location.pathname + window.location.search +
              (name === "web" ? "" : "#" + name);
    window.history.pushState({ pfTab: name }, "", url);
  }

  function fromHash() {
    var h = window.location.hash.replace(/^#/, "");
    return valid(h) ? h : "web";
  }

  window.addEventListener("popstate", function () {
    var name = fromHash();
    if (name !== current) show(name);
  });

  /* ---- initial state ------------------------------------------------------
     The markup ships with "web" selected, so a deep link has to be applied
     before anything is painted from it. commit(), not show(): there is no
     previous sub-page to push away from. */
  var start = fromHash();
  if (start !== "web") commit(start);

  /* ---- reading progress ---------------------------------------------------
     Amanda: "please also add the progress bar underneath the nav bar just like
     the case study pages and the hazen page." Same maths as
     js/case-study.js's, and the same rAF-coalesced scroll listener: scroll
     position over scrollable height, written as a scaleX.

     It reads the DOCUMENT, and the document is whichever sub-page is in the
     flow -- so the bar measures the sub-page the reader is actually in, and
     resets to 0 on every switch because commit() scrolls to the top. */
  var progress = document.getElementById("pfProgress");
  var pTicking = false;

  /* Declared at the top level of the IIFE, not inside the `if (progress)`
     below. This file is in strict mode, where a function declaration inside a
     block is scoped to that block -- so defining it in there would leave
     onChange, further down, calling an undefined name. */
  function updateProgress() {
    pTicking = false;
    if (!progress) return;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var p = max > 0 ? window.scrollY / max : 0;
    if (p < 0) p = 0;
    if (p > 1) p = 1;
    progress.style.transform = "scaleX(" + p.toFixed(4) + ")";
  }

  function onProg() {
    if (!pTicking) {
      pTicking = true;
      window.requestAnimationFrame(updateProgress);
    }
  }

  if (progress) {
    window.addEventListener("scroll", onProg, { passive: true });
    window.addEventListener("resize", onProg);
    /* identity and aspire hijack the wheel and ease scrollY themselves, so a
       plain scroll event can lag a frame behind what is on screen; kayn and
       nobi run Lenis. Subscribing to whichever engine is present keeps the bar
       exactly in step. Both are optional and absent on a page without one. */
    if (window.ID && window.ID.onTick) window.ID.onTick(onProg);
    if (window.lenis && window.lenis.on) window.lenis.on("scroll", onProg);

    updateProgress();
  }

  window.PFProjectNav = {
    show: show,
    onChange: null,
    get current() { return current; },
    get panels() { return panels; }
  };

  /* The new sub-page is a different height, and scrollY is back at 0. Both
     reach the bar through the resize commit() already dispatches, but that is
     an implementation detail of another function -- ask for it explicitly. */
  window.PFProjectNav.onChange = function () {
    if (progress) updateProgress();
  };
})(window, document);
