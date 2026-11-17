/* ============================================================
   HOME — what the v5 homepage's own sections do (css/home.css)

     1  links to #work ("See my work", "Works" in the footer) scroll
        down to the works and stop under the header; the hero's
        "6 years" link does the same for #offer
     2  "What I bring to the team": picking an item shows its visual
     3  "Works": the two tabs, Design works and AI works
     4  "See more" opens the rest of the design work

   None of it needs GSAP or Lenis. Where Lenis is running, the scroll
   in (1) goes through it so the two never fight over the page; where
   it is not, the browser's own smooth scroll does the job. The fades
   between the sections are a separate file, js/scenes-home.js.

   ES5, matching the rest of js/ on this page.
   ============================================================ */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  function headerHeight() {
    var header = document.querySelector(".header");
    return header ? Math.round(header.getBoundingClientRect().height) : 0;
  }

  /* The page below has changed height: the closing block's pin, and every
     scroll-driven fade, were measured against the old one. */
  function remeasure() {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  /* ---------- 1. links to #work, and to #offer ----------
     Delegated, so every link to the works on the page gets the same
     landing: the works on screen, their top edge directly under the
     sticky header. The hero's "6 years" link goes to "What I bring to the
     team" (#offer) and lands the same way (Amanda, 17 Nov 2026).

     WHERE THAT IS. Where the top three sections share one stage
     (js/scenes-home.js), the works are stacked under the hero at the top
     of the page and only on screen once the stage has run its course; that
     file publishes the scroll position as V3.workAt(), and the USP's as
     V3.uspAt(). Anywhere else they are simply where they sit in the page. */
  var work = document.getElementById("work");
  var offer = document.getElementById("offer");

  function landing(id) {
    var at = window.V3 && (id === "work" ? window.V3.workAt : window.V3.uspAt);
    if (at) return at();
    var el = id === "work" ? work : offer;
    return Math.round(el.getBoundingClientRect().top + window.pageYOffset - headerHeight());
  }

  function scrollToSection(id, instant) {
    var top = landing(id);
    var now = instant || reduced.matches;
    var lenis = window.V3 && window.V3.lenis;
    if (lenis && lenis.scrollTo) {
      lenis.scrollTo(top, now ? { immediate: true, force: true } : {
        duration: 1.4,
        easing: function (t) { return 1 - Math.pow(1 - t, 4); }
      });
    } else {
      try {
        /* "instant", not "auto": the site sets scroll-behavior: smooth, and
           auto means whatever that says. */
        window.scrollTo({ top: top, behavior: now ? "instant" : "smooth" });
      } catch (e) {
        window.scrollTo(0, top);
      }
    }
    /* The scroll moves the page, not the focus. Without this a keyboard
       visitor's next Tab would carry on from the link they left behind. */
    try { (id === "work" ? work : offer).focus({ preventScroll: true }); } catch (e) {}
  }

  if (work && offer) {
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href="#work"], a[href="#offer"]') : null;
      if (!a) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      scrollToSection(a.getAttribute("href").slice(1), false);
    });

    /* ARRIVING AT /#work FROM ANOTHER PAGE, which is where the footer of
       every other page sends the reader. The browser's own jump to the
       anchor cannot be right on the shared stage: the works sit under the
       hero at scroll zero, so it would not move at all. So: land where a
       click on this page would, now, and once more when the page has
       finished loading in case the browser's jump came after this one,
       unless the reader has started scrolling by then. */
    var arriving = location.hash.slice(1);
    if (arriving === "work" || arriving === "offer") {
      var moved = false;
      var mark = function () { moved = true; };
      ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (type) {
        window.addEventListener(type, mark, { passive: true, once: true });
      });
      scrollToSection(arriving, true);
      window.addEventListener("load", function () {
        window.setTimeout(function () { if (!moved) scrollToSection(arriving, true); }, 0);
      });
    }
    window.addEventListener("hashchange", function () {
      var id = location.hash.slice(1);
      if (id === "work" || id === "offer") scrollToSection(id, true);
    });
  }

  /* ---------- tabs, for (2) and (3) ----------
     Both are a tab list in the ARIA sense: one tab selected, its panel the
     one showing, arrow keys to move between them. Only classes and ARIA
     state change here; css/home.css owns what selected looks like, and
     `show` is how each list reveals a panel. */
  function tabs(list, show) {
    var items = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    var panels = items.map(function (tab) {
      return document.getElementById(tab.getAttribute("aria-controls"));
    });

    function select(index, moveFocus) {
      items.forEach(function (tab, i) {
        var on = i === index;
        tab.classList.toggle("is-active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
        if (panels[i]) show(panels[i], on, tab);
      });
      if (moveFocus) items[index].focus();
    }

    items.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        if (!tab.classList.contains("is-active")) select(i, false);
      });
      tab.addEventListener("keydown", function (e) {
        var next = -1;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % items.length;
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = items.length - 1;
        if (next < 0) return;
        e.preventDefault();
        select(next, true);
      });
    });
  }

  /* ---------- 2. "What I bring to the team" ----------
     All three panels are stacked in the visual and cross-fade. */
  var uspList = document.querySelector(".usp__list");
  if (uspList) {
    tabs(uspList, function (panel, on) { panel.classList.toggle("is-active", on); });

    /* ON A PHONE THE VISUAL FOLLOWS THE SELECTED ITEM (css/home.css), so
       picking the third item takes the visual out from under the first and
       everything between moves up by its height, the item just tapped
       included. Undo that for the one item that matters: note where every
       item is before the tab's own handler runs (capture), find the one
       now selected after it (bubble), and scroll by however far it moved,
       so it stays under the finger with its visual opening beneath it. */
    var items = Array.prototype.slice.call(uspList.querySelectorAll('[role="tab"]'));
    var tops = null;
    var stepsAside = function () { return getComputedStyle(uspList).display === "contents"; };
    var note = function () {
      tops = stepsAside() ? items.map(function (t) { return t.getBoundingClientRect().top; }) : null;
    };
    var hold = function () {
      if (!tops) return;
      var i = items.indexOf(uspList.querySelector('[role="tab"].is-active'));
      var moved = i < 0 ? 0 : items[i].getBoundingClientRect().top - tops[i];
      tops = null;
      var lenis = window.V3 && window.V3.lenis;
      if (Math.abs(moved) >= 1) {
        var y = window.pageYOffset + moved;
        if (lenis && lenis.scrollTo) lenis.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo({ top: y, behavior: "instant" });
        remeasure();
      }

      /* Then, if the visual has opened below the bottom of the screen, ease
         the page up until it is in view: the point of picking an item is
         seeing its visual. Never so far that the item itself goes under the
         header. */
      var visual = document.querySelector(".usp__visual");
      if (i < 0 || !visual) return;
      var room = window.innerHeight - 16;
      var under = visual.getBoundingClientRect().bottom - room;
      var spare = items[i].getBoundingClientRect().top - headerHeight() - 16;
      var by = Math.min(under, spare);
      if (by < 1) return;
      var to = window.pageYOffset + by;
      if (lenis && lenis.scrollTo && !reduced.matches) {
        lenis.scrollTo(to, { duration: 0.6, easing: function (t) { return 1 - Math.pow(1 - t, 3); } });
      } else {
        try { window.scrollTo({ top: to, behavior: reduced.matches ? "instant" : "smooth" }); }
        catch (e) { window.scrollTo(0, to); }
      }
    };
    ["click", "keydown"].forEach(function (type) {
      uspList.addEventListener(type, note, true);
      uspList.addEventListener(type, hold);
    });
  }

  /* ---------- 3. "Works" ----------
     One panel is in the page at a time, so the section is only ever as
     tall as the work it is showing. data-active moves the black lozenge. */
  var workTabs = document.querySelector(".pj__tabs");
  if (workTabs) {
    tabs(workTabs, function (panel, on, tab) {
      panel.hidden = !on;
      panel.classList.toggle("is-active", on);
      /* From the first switch on, a panel fades up as it is shown. */
      panel.classList.add("is-switched");
      if (on) workTabs.setAttribute("data-active", tab.getAttribute("data-key"));
    });
    workTabs.addEventListener("click", function () { window.setTimeout(remeasure, 0); });
    workTabs.addEventListener("keyup", function () { window.setTimeout(remeasure, 0); });
  }

  /* ---------- 4. "See more" ----------
     The rest of the design work is in the page from the start and only
     closed. This file is what closes it, so a visitor without scripts has
     nothing hidden from them and no button that does nothing. */
  var more = work && work.querySelector(".pj__more");
  var actions = work && work.querySelector(".pj__actions");
  var button = actions && actions.querySelector(".pj__morebtn");

  if (more && button) {
    work.classList.add("is-collapsible");
    more.setAttribute("inert", "");

    button.addEventListener("click", function () {
      var settled = false;

      /* Once the row has finished opening: let focus rings past the clip,
         take the spent button out of the page, and re-measure. */
      function settle() {
        if (settled) return;
        settled = true;
        more.classList.add("is-settled");
        actions.hidden = true;
        remeasure();
      }

      more.removeAttribute("inert");
      more.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
      actions.classList.add("is-leaving");

      var first = more.querySelector("a[href]");
      if (first) { try { first.focus({ preventScroll: true }); } catch (e) {} }

      more.addEventListener("transitionend", function (e) {
        if (e.target === more && e.propertyName === "grid-template-rows") settle();
      });
      /* If the transition never reports in: a browser that cannot animate
         grid rows, or reduced motion collapsing it to nothing. */
      window.setTimeout(settle, 1200);
    });
  }
})();
