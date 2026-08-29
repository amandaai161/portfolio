/* =============================================================================
   Aspire 2026 — mobile navigation
   -----------------------------------------------------------------------------
   Below 1100 the header collapses to a logo and a burger, and `.nav__menu` holds
   the links, Login and Get Started. That breakpoint is where `.nav__links` was
   already being hidden, so this is also the first time those links are reachable
   at all between 721 and 1100.

   All the visual work is CSS (see .nav__menu). This file only toggles `is-open`
   on `.nav` and keeps `aria-expanded` in step with it. The closed panel is
   `visibility: hidden`, so the links leave the tab order and the accessibility
   tree on their own — there is no focus trap to maintain and nothing to hide by
   hand.
   ========================================================================== */

(function () {
  'use strict';

  var nav    = document.querySelector('.nav');
  var burger = document.getElementById('navBurger');
  var menu   = document.getElementById('navMenu');
  if (!nav || !burger || !menu) return;

  function isOpen() { return nav.classList.contains('is-open'); }

  function open() {
    nav.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
  }

  /* `returnFocus` is for the keyboard paths only. On a click the focus is already
     where the user put it, and pulling it back to the burger would be surprising. */
  function close(returnFocus) {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    if (returnFocus) burger.focus();
  }

  burger.addEventListener('click', function () {
    if (isOpen()) close(false); else open();
  });

  /* Every link in here is a placeholder that links.js neutralises, so nothing
     navigates yet — but a real destination would, and leaving the panel open
     across a page change is the kind of thing that only shows up later. */
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) close(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) close(true);
  });

  /* Anywhere outside the header dismisses it. The burger's own click has already
     been handled by the time this runs — it is inside `nav`, so it returns early
     rather than immediately undoing the toggle. */
  document.addEventListener('click', function (e) {
    if (!isOpen()) return;
    if (nav.contains(e.target)) return;
    close(false);
  });

  /* Crossing back up to the full nav has to clear the flag: `is-open` would
     otherwise still be sitting on `.nav`, and the burger's X state with it, ready
     to reappear the next time the viewport narrows. */
  var wide = matchMedia('(min-width: 1101px)');
  function onWide() { if (wide.matches) close(false); }
  if (wide.addEventListener) wide.addEventListener('change', onWide);
  else if (wide.addListener) wide.addListener(onWide);

  /* --------------------------------------------------------- debug hook */
  window.navMenu = {
    get state() {
      return {
        open: isOpen(),
        expanded: burger.getAttribute('aria-expanded'),
        burgerShown: getComputedStyle(burger).display !== 'none',
        menuVisibility: getComputedStyle(menu).visibility,
        links: menu.querySelectorAll('a').length
      };
    },
    open: open,
    close: close
  };
})();
