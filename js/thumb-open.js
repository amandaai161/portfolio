/* ============================================================================
   OPENING A PROJECT — the thumbnail becomes the next page
   ----------------------------------------------------------------------------
   Amanda: "When clicked, the thumbnail enlarges til it covers the entire
   screen, then the next page starts loading... basically, the one that resizes
   actually the thumbnail container, not the thumbnail image itself... Once
   KAYN's thumbnail is clicked, the thumbnail_kayn.webm fading out quickly while
   the #2a462d colored container is enlarging."

   So the CONTAINER travels and the clip does not. The container is a flat
   colour, which is the whole reason this works: a solid rectangle can be scaled
   to any size with no distortion at all, while an image stretched from a
   thumbnail to a full screen would smear. And because css/master-thumb.css
   paints each container in the colour of the page it leads to, what fills the
   screen is already the ground the next page will paint -- so the navigation
   lands on a matching colour rather than a white flash.

   WHAT ACTUALLY MOVES is a copy, not the thumbnail itself. Two of these five
   sit inside a pinned GSAP stage that writes transforms to them every frame,
   and one is inside a slide the scene fades; taking the real element out of
   flow would fight both. A fixed-position clone at the same rect has neither
   problem and leaves the page underneath exactly as it was.

   NAVIGATION WAITS FOR THE COVER TO CLOSE. Amanda: "Right now seems like you
   directly load the page before the container completely cover the entire
   screen, which causes a rough transition. So, I want you to just let the
   container enlarges til it coverst the entire screen completely first, then,
   the respective page loads." So the growth's own transitionend is what fires
   it, and the reader never sees the swap happen behind a half-grown cover.

   The page it lands on opens under a screen of the same colour, which fades
   over 0.5s -- see css/master-intro.css. The two halves meet on one flat
   colour, which is what makes the join invisible.

   ES5, matching the rest of js/ on these pages.
   ========================================================================== */
(function (window, document) {
  "use strict";

  var GROW = 620;      /* ms for the container to reach full screen           */
  var EASE = "cubic-bezier(0.7, 0, 0.3, 1)";
  /* If transitionend never arrives -- a backgrounded tab, a transition the
     browser declines to run -- the navigation still has to happen. */
  var FALLBACK = GROW + 220;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var busy = false;

  function sameOrigin(a) {
    return a.protocol === window.location.protocol && a.host === window.location.host;
  }

  /* A click that the browser is going to treat specially -- a new tab, a
     download, a modified click -- must be left completely alone. */
  function plainClick(e, a) {
    return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey &&
           !a.target && !a.hasAttribute("download") && sameOrigin(a);
  }

  function open(thumb, href) {
    var rect = thumb.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    if (!rect.width || !rect.height) { window.location.href = href; return; }

    var cover = document.createElement("div");
    cover.className = "thumb-open";
    cover.setAttribute("aria-hidden", "true");
    cover.style.left = rect.left + "px";
    cover.style.top = rect.top + "px";
    cover.style.width = rect.width + "px";
    cover.style.height = rect.height + "px";
    /* The container's own resolved colour, so this is the same paint the
       reader was already looking at rather than a second guess at it. */
    cover.style.background = window.getComputedStyle(thumb).backgroundColor;
    document.body.appendChild(cover);

    thumb.classList.add("is-opening");   /* fades the clip out from under it */

    /* Origin at the top-left, so one translate and one scale map the box
       exactly onto the viewport. Scaling a flat colour costs nothing and
       stays on the compositor. */
    var sx = vw / rect.width;
    var sy = vh / rect.height;

    /* Commit the parked position before the transition exists, or the browser
       tweens into it from nothing instead of out of it. */
    void cover.offsetHeight;
    cover.style.transition = "transform " + GROW + "ms " + EASE;
    cover.style.transform =
      "translate(" + (-rect.left) + "px, " + (-rect.top) + "px) scale(" + sx + ", " + sy + ")";

    var gone = false;
    function go() {
      if (gone) return;
      gone = true;
      window.location.href = href;
    }
    cover.addEventListener("transitionend", function (e) {
      if (e.propertyName === "transform") go();
    });
    window.setTimeout(go, FALLBACK);
  }

  document.addEventListener("click", function (e) {
    if (busy) { e.preventDefault(); return; }

    /* Start from the LINK, not from the thumbnail. On the HAZEN row the link is
       the thumbnail; on the pairs and the suggestion cards it wraps the title
       and the tags too, and a click on the title has to open the same way a
       click on the picture does -- otherwise half of each card animates and
       half of it just navigates. Any link with no thumbnail in it, like the
       other-work cards, falls straight through to the browser. */
    var target = e.target;
    var a = target && target.closest ? target.closest("a[href]") : null;
    if (!a) return;
    var thumb = a.closest(".thumb") || a.querySelector(".thumb");
    if (!thumb || !plainClick(e, a)) return;

    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;

    if (reduced.matches) return;      /* let the browser navigate normally */

    e.preventDefault();
    busy = true;
    open(thumb, a.href);
  });

  /* Coming back via the bfcache restores the DOM as it was left -- cover still
     on screen, clip still faded. Clear both, or the reader returns to a page
     under a full-screen colour. */
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    busy = false;
    var covers = document.querySelectorAll(".thumb-open");
    for (var i = 0; i < covers.length; i++) covers[i].parentNode.removeChild(covers[i]);
    var opening = document.querySelectorAll(".thumb.is-opening");
    for (var j = 0; j < opening.length; j++) opening[j].classList.remove("is-opening");
  });
})(window, document);
