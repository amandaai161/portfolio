/* =============================================================================
   Aspire 2026 — dead placeholder links
   -----------------------------------------------------------------------------
   Nothing on the page is wired to a destination yet. Every nav item, footer link,
   arrow link and button carries `href="#"`, which keeps it focusable, keyboard-
   activatable and announced as a link — but activating it scrolls the document to
   the top, and with a pinned scroll scene up there that reads as being thrown back
   into the hero.

   So: swallow the activation. One delegated listener rather than an `onclick` on
   every element, and it keeps working for markup added later.

   Only `href="#"` is neutralised, so any real destination added later still works.

   Both forms post to `#` too, which would do the same thing on Enter or on the
   Get Started button, so submit gets the same treatment.
   ========================================================================== */

(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    if (el.closest('a[href="#"]')) e.preventDefault();
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form && form.getAttribute && form.getAttribute('action') === '#') {
      e.preventDefault();
    }
  });
})();
