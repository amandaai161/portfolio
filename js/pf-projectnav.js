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

    var vt = document.startViewTransition(function () { commit(name); });
    /* .ready rejects (InvalidStateError) whenever the browser skips the
       animation outright -- document hidden or not fully active at the
       moment the transition would start, which a stray tab switch or a
       backgrounded window makes ordinary. commit() already ran via the
       callback above either way; this just keeps that rejection from
       surfacing as an uncaught promise. */
    vt.ready["catch"](function () { });
    vt.finished["catch"](function () { }).then(function () {
      root.removeAttribute("data-pf-slide");
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

  window.PFProjectNav = {
    show: show,
    onChange: null,
    get current() { return current; },
    get panels() { return panels; }
  };
})(window, document);
