/* =============================================================================
   Aspire 2026 — testimonial switcher
   -----------------------------------------------------------------------------
   Three customers, one card. Clicking a logo on the left selects that customer:
   its tile becomes the photograph and its quote comes up on the right. That click
   is the whole interaction as specified — there is no autoplay and no next/prev.

   Implemented as an ARIA tab set, so it costs nothing to also support the
   keyboard: arrows move between tabs, Home/End jump to the ends. Selection
   follows focus, which is the right choice here because the panels are already
   in the DOM — nothing loads on switch, so there is no reason to make a keyboard
   user press Enter as well.

   Everything visual is CSS (see .tstl__* in styles.css). This file only moves
   `aria-selected` and the `.is-on` class, and both the constant card height and
   the crossfade fall out of that.
   ========================================================================== */

(function () {
  'use strict';

  var list = document.querySelector('.tstl__tabs');
  if (!list) return;

  var tabs = [].slice.call(list.querySelectorAll('[role="tab"]'));
  if (tabs.length < 2) return;

  function panelOf(tab) {
    return document.getElementById(tab.getAttribute('aria-controls'));
  }

  /* ------------------------------------------------------------ carousel mode
     Below 720 the same DOM is a swipeable carousel instead of an accordion: the
     panels are a scroll-snap row and the tabs are the dots under it. The gesture
     is the browser's, not ours — this only keeps the two representations in step.

     Breakpoint duplicated from the 720px block in styles.css, which is the only
     way to read a media query from script. */
  var mobile = matchMedia('(max-width: 720px)');
  var strip  = document.querySelector('.tstl__panels');

  function carousel() { return mobile.matches && !!strip; }

  /* Distance from the strip's scroll origin to a panel's centre. Measured off
     rects rather than offsetLeft, which is relative to whichever ancestor happens
     to be the offsetParent and is not guaranteed to be the strip. */
  function centreOf(panel) {
    return panel.getBoundingClientRect().left
         - strip.getBoundingClientRect().left
         + strip.scrollLeft
         + panel.offsetWidth / 2;
  }

  function nearestTab() {
    var mid = strip.scrollLeft + strip.clientWidth / 2;
    var best = tabs[0], bestD = Infinity;
    for (var i = 0; i < tabs.length; i++) {
      var p = panelOf(tabs[i]);
      if (!p) continue;
      var d = Math.abs(centreOf(p) - mid);
      if (d < bestD) { bestD = d; best = tabs[i]; }
    }
    return best;
  }

  /* A tab is only reachable by Tab key when it is the selected one; the arrows
     move within the set. That is the standard tablist contract, and it keeps the
     three tiles from costing a keyboard user three stops. */
  /* The state, without touching the scroll position — this is what a scroll event
     calls, so it cannot be the thing that scrolls. */
  function mark(tab) {
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i] === tab;
      var panel = panelOf(tabs[i]);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[i].tabIndex = on ? 0 : -1;
      if (!panel) continue;
      panel.classList.toggle('is-on', on);
      if (carousel()) {
        /* Every slide is on screen and reachable by swiping, so hiding the ones
           that are not centred would be a lie — and would make the carousel
           unreadable to a screen reader the moment it moved. */
        panel.removeAttribute('aria-hidden');
        panel.tabIndex = 0;
      } else {
        /* The outgoing panel stays visible while it fades, so it cannot be hidden
           with `visibility` — these two are what take it out of the tab order and
           the a11y tree in the same frame the class changes. See .tstl__panel. */
        panel.tabIndex = on ? 0 : -1;
        panel.setAttribute('aria-hidden', on ? 'false' : 'true');
      }
    }
  }

  /* Set while a programmatic scroll is in flight, so the scroll events it fires
     do not feed back in and re-mark from an intermediate position. */
  var settling = 0;

  function select(tab, moveFocus) {
    mark(tab);
    if (carousel()) {
      var p = panelOf(tab);
      if (p) {
        settling = Date.now() + 500;
        strip.scrollTo({ left: centreOf(p) - strip.clientWidth / 2, behavior: 'smooth' });
      }
    }
    if (moveFocus) tab.focus();
  }

  if (strip) {
    var queued = false;
    strip.addEventListener('scroll', function () {
      if (!carousel() || Date.now() < settling) return;
      if (queued) return;
      queued = true;
      /* Coalesce a scroll burst into one update per frame. */
      requestAnimationFrame(function () {
        queued = false;
        var t = nearestTab();
        if (t.getAttribute('aria-selected') !== 'true') mark(t);
      });
    }, { passive: true });
  }

  /* Crossing the breakpoint changes what `aria-hidden` should say on every panel,
     so re-apply the current selection under the new mode. */
  function onMode() {
    var current = tabs.filter(function (t) {
      return t.getAttribute('aria-selected') === 'true';
    })[0] || tabs[0];
    mark(current);
  }
  if (mobile.addEventListener) mobile.addEventListener('change', onMode);
  else if (mobile.addListener) mobile.addListener(onMode);

  function step(from, delta) {
    var i = tabs.indexOf(from);
    return tabs[(i + delta + tabs.length) % tabs.length];
  }

  for (var t = 0; t < tabs.length; t++) {
    (function (tab) {
      tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;

      /* Focus follows the click as well as the selection. Safari does not focus a
         <button> on click, so without this the roving tabindex could sit on one tab
         while focus sat on another, and the next arrow press would step from the
         wrong place. :focus-visible keeps the ring off for the mouse. */
      tab.addEventListener('click', function () { select(tab, true); });

      tab.addEventListener('keydown', function (e) {
        var next = null;
        /* Both axes: the list is vertical, but left/right is what a lot of people
           reach for on something that looks like a set of tabs. */
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = step(tab, 1);
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = step(tab, -1);
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (!next) return;
        e.preventDefault();
        select(next, true);
      });
    })(tabs[t]);
  }

  /* --------------------------------------------------------- debug hook */
  window.testimonial = {
    get carousel() { return carousel(); },
    get scroll() {
      if (!strip) return null;
      return { left: Math.round(strip.scrollLeft), page: strip.clientWidth,
               max: strip.scrollWidth - strip.clientWidth,
               nearest: strip ? nearestTab().id : null };
    },
    get state() {
      return tabs.map(function (tab) {
        var panel = panelOf(tab);
        return {
          tab: tab.id,
          logo: (tab.querySelector('.tstl__logo') || {}).alt,
          selected: tab.getAttribute('aria-selected') === 'true',
          tabIndex: tab.tabIndex,
          panel: panel ? panel.id : null,
          panelOn: panel ? panel.classList.contains('is-on') : null
        };
      });
    },
    select: function (n) { select(tabs[n] || tabs[0], false); }
  };
})();
