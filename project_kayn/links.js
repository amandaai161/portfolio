/* ============================================================================
   KAYN 2026 — dead placeholder links

   Nothing on the page is wired to a destination. Every masthead link, drawer
   link, product link, CTA and footer link carries `href="#"`, which keeps it
   focusable, keyboard-activatable and announced as a link — but activating it
   scrolls the document to the top, and with the loader and the scrubbed film
   scene up there that reads as being thrown back into the hero.

   So: swallow the activation. One delegated listener rather than an `onclick`
   on every element, and it keeps working for markup added later.

   Propagation is deliberately NOT stopped — the drawer closes itself by
   listening for clicks on its own links (see initDrawer in app.js), and that
   has to keep firing.

   Lenis resolves in-page anchors when `anchors` is on; it is off for the same
   reason this file exists (see CONFIG.lenis in app.js).
   ========================================================================= */
(function (document) {
  "use strict";

  document.addEventListener("click", function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    if (el.closest('a[href="#"]')) e.preventDefault();
  });
})(document);
