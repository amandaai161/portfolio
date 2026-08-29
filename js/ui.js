/* ============================================================
   v3 chrome: mobile menu, header divider, click-to-copy email.
   Header + contact markup is v1's, so this is v1's script.js
   behaviour for exactly the parts the homepage uses.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Header divider line ---------- */
  var header = document.querySelector(".header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Header height sync (--header-h) ----------
     The hero must be exactly one viewport INCLUDING the header, so the
     token has to track the header's real height. styles.css sets a
     min-height of 88px, not a fixed height — it grows if the header
     wraps (long name, a narrow-but-not-mobile width, larger default
     browser font) — so hardcoding 88px would reintroduce the dead-scroll
     overshoot at those widths. The CSS var() calls still fall back to
     88px so layout is sane before this runs. */
  if (header) {
    var headerRefreshTimer = null;

    var syncHeaderHeight = function (fromResize) {
      var h = Math.round(header.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--header-h", h + "px");

      // ScrollTrigger's cached trigger positions go stale once the token
      // changes their layout. Only refresh on resize-driven changes, not
      // the initial synchronous run (ScrollTrigger may not exist yet —
      // motion-core.js's own load/fonts.ready refresh covers first paint),
      // and debounce so a drag-resize doesn't spam refresh() mid-drag.
      if (fromResize && window.V3 && window.V3.ready) {
        clearTimeout(headerRefreshTimer);
        headerRefreshTimer = setTimeout(function () {
          ScrollTrigger.refresh();
        }, 150);
      }
    };

    syncHeaderHeight(false);
    window.addEventListener("resize", function () {
      syncHeaderHeight(true);
    });
  }

  /* ---------- Scroll reveals ----------
     GONE, because nothing on the page carries `.reveal` any more. The four
     elements that did — the CTA headline and buttons, the contact block — are
     now part of #outro's own pinned entrance (js/scenes-outro.js), which owns
     their opacity and position outright. Two mechanisms writing the same
     properties on the same elements is the exact failure this codebase keeps
     paying for, so the IntersectionObserver, the `html.js` arming class and
     its failsafe timer went with the last element that needed them.

     css/styles.css's own .reveal rules are LEFT ALONE on purpose: that file is
     v1's, shared with the case-study pages, and they are still live there.
     Nothing here arms them, so on this page they are inert. */

  /* ---------- Reading progress ----------
     Drives the hairline across the bottom of the header (css/v3.css's
     .cs-progress, the case studies' own component). Plain scroll listener,
     not GSAP: this is chrome and must report honestly in every mode —
     reduced motion, ?nomotion=1, or a failed CDN. Writes a transform rather
     than a width so each scroll frame stays a compositor update instead of a
     layout pass.

     The dark/light flip the old right-edge version needed is gone with it:
     this sits inside the header, which is white for the entire page, so the
     bar is never over the black contact section. */
  var readingProgress = document.getElementById("readingProgress");
  if (readingProgress) {
    var onProgressScroll = function () {
      var doc = document.documentElement;
      var span = (document.body.scrollHeight || doc.scrollHeight) - window.innerHeight;
      var p = span > 0 ? window.scrollY / span : 0;
      if (p < 0) p = 0; else if (p > 1) p = 1;
      readingProgress.style.transform = "scaleX(" + p.toFixed(4) + ")";
    };

    onProgressScroll();
    window.addEventListener("scroll", onProgressScroll, { passive: true });
    window.addEventListener("resize", onProgressScroll);
  }

  /* ---------- Scroll cue ----------
     Nothing to drive any more. The cue used to be fixed chrome overlaying the
     whole page, so it needed its own scroll-driven fade to get out of the way
     — this block wrote a --cue-opacity custom property that css/styles.css's
     .scroll-cue read. It now lives inside the hero's bio frame instead
     (index.html), below the titles line, and leaves when that frame leaves.
     A second fade on the same element would only have made it vanish BEFORE
     the block it belongs to, which reads as a glitch rather than as chrome
     politely stepping aside.

     .scroll-cue's opacity: var(--cue-opacity, 0.35) still resolves — to its
     0.35 fallback, which is the resting value this ever scaled from — so the
     stylesheet remains the single source of truth for how the cue looks, in
     every mode including no-motion. */

  /* ---------- Mobile menu ---------- */
  var toggle = document.getElementById("navToggle");
  var menu = document.getElementById("mobileMenu");

  function closeMenu() {
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    setTimeout(function () {
      if (!menu.classList.contains("is-open")) menu.hidden = true;
    }, 480);
  }

  function openMenu() {
    menu.hidden = false;
    void menu.offsetHeight; // force reflow so the max-height transition runs
    menu.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      if (menu.classList.contains("is-open")) closeMenu();
      else openMenu();
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
  }

  /* ---------- Click-to-copy email + toast ---------- */
  var emailBtn = document.querySelector(".contact__email");
  var toast = document.querySelector(".copy-toast");
  if (emailBtn && toast) {
    var toastTimer = null;
    emailBtn.addEventListener("click", async function () {
      var text = emailBtn.dataset.copy || emailBtn.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { document.execCommand("copy"); } catch (_) {}
        ta.remove();
      }
      toast.classList.add("is-shown");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toast.classList.remove("is-shown");
      }, 1900);
    });
  }
})();
