/* ============================================================
   Amanda Idris — Portfolio interactions
   ============================================================ */
(function () {
  "use strict";

  // Mark that JS is active — the hidden .reveal state is gated on this, so if
  // JS ever fails the content stays fully visible instead of stuck invisible.
  document.documentElement.classList.add("js");

  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ---------- Header line + fixed-hero fade/parallax + scroll cue ---------- */
  const header = document.querySelector(".header");
  const cue = document.querySelector(".scroll-cue");
  const stage = document.querySelector(".intro__stage");
  const CUE_BASE = 0.35; // resting opacity (65% transparency)
  const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

  // Framer-style image parallax: image sits zoomed inside an overflow-hidden
  // frame and drifts vertically as the frame passes through the viewport.
  const PARALLAX_SCALE = 1.14; // resting zoom (gives headroom for the drift)
  const PARALLAX_RANGE = 0.1; // vertical travel as a fraction of frame height
  // The home featured thumbnails (.project__media) are pre-cropped to the exact
  // frame ratio and must stay fully visible — exclude them from the parallax so
  // no zoom/drift is applied. (Currently these are the only .media-parallax
  // layers, so this leaves the effect available for any future non-featured use.)
  const parallaxLayers = Array.from(
    document.querySelectorAll(".media-parallax")
  ).filter((l) => !l.closest(".project__media"));
  const runParallax = (vh) => {
    if (prefersReduced) return;
    for (const layer of parallaxLayers) {
      const frame = layer.parentElement;
      const r = frame.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) continue; // offscreen
      const p = (r.top + r.height / 2) / vh; // 0 (top) … 1 (bottom of viewport)
      const shift = (p - 0.5) * r.height * PARALLAX_RANGE;
      layer.style.transform =
        "translate3d(0," + shift.toFixed(1) + "px,0) scale(" + PARALLAX_SCALE + ")";
    }
  };

  const update = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;

    if (y > 8) header.classList.add("is-scrolled");
    else header.classList.remove("is-scrolled");

    runParallax(vh);

    // Fixed hero (desktop only): fade out FAST (so it's gone before the projects
    // scroll up over it) + drift up. Accelerated curve = mostly gone by ~25% scroll.
    if (stage && window.matchMedia("(min-width: 761px)").matches) {
      const p = clamp01(y / (vh * 0.44));
      // (1 - p)^2 drops fast immediately → mostly gone within ~0.3 screen.
      stage.style.opacity = ((1 - p) * (1 - p)).toFixed(3);
      stage.style.transform = prefersReduced
        ? "none"
        : "translate3d(0," + (-p * 130).toFixed(1) + "px,0)";
      stage.style.pointerEvents = p > 0.3 ? "none" : "auto";
    } else if (stage) {
      stage.style.opacity = "";
      stage.style.transform = "";
      stage.style.pointerEvents = "";
    }

    // Scroll cue: fades quickly (gone within ~28% of a screen) + slight drift.
    if (cue) {
      const p = clamp01(y / (vh * 0.28));
      const o = CUE_BASE * (1 - p);
      cue.style.opacity = o.toFixed(3);
      cue.style.transform = prefersReduced
        ? "translateX(-50%)"
        : "translateX(-50%) translateY(" + (p * 16).toFixed(1) + "px)";
      cue.style.pointerEvents = o < 0.04 ? "none" : "auto";
    }
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  /* ---------- Mobile menu ---------- */
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("mobileMenu");

  const closeMenu = () => {
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    // wait for the transition before hiding from a11y tree
    setTimeout(() => {
      if (!menu.classList.contains("is-open")) menu.hidden = true;
    }, 480);
  };

  const openMenu = () => {
    menu.hidden = false;
    // force reflow so the max-height transition runs
    void menu.offsetHeight;
    menu.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
  };

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      if (menu.classList.contains("is-open")) closeMenu();
      else openMenu();
    });
    menu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", closeMenu)
    );
  }

  /* ---------- Click-to-copy email + toast ---------- */
  const emailBtn = document.querySelector(".contact__email");
  const toast = document.querySelector(".copy-toast");
  if (emailBtn && toast) {
    let toastTimer = null;
    emailBtn.addEventListener("click", async () => {
      const text = emailBtn.dataset.copy || emailBtn.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        // fallback for non-secure contexts / older browsers
        const ta = document.createElement("textarea");
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
      toastTimer = setTimeout(() => toast.classList.remove("is-shown"), 1900);
    });
  }

  /* ---------- Scroll reveal — repeats (in → static → out → in …) ---------- */
  const revealables = Array.from(document.querySelectorAll(".reveal"));
  const reveal = (el) => el.classList.add("in-view");
  const inViewport = (el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight * 0.96 && r.bottom > 0;
  };

  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealables.forEach(reveal);
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;
          if (entry.isIntersecting) {
            // stagger siblings on the way in
            const siblings = Array.from(
              el.parentElement.querySelectorAll(":scope > .reveal")
            );
            const idx = Math.max(0, siblings.indexOf(el));
            el.style.transitionDelay = Math.min(idx * 80, 320) + "ms";
            el.classList.add("in-view");
          } else {
            // animate back out when it leaves, so it re-animates on return
            el.style.transitionDelay = "0ms";
            el.classList.remove("in-view");
          }
        });
      },
      { threshold: 0.18 }
    );
    revealables.forEach((el) => io.observe(el));

    // Above-the-fold safety: show in-view items immediately (covers slow IO).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        revealables.forEach((el) => {
          if (inViewport(el)) reveal(el);
        });
      })
    );
  }

  /* ---------- Smooth scrolling via Lenis (premium momentum feel) ---------- */
  if (window.Lenis && !prefersReduced) {
    const lenis = new window.Lenis({
      lerp: 0.12, // smoothing — higher = snappier, lower = more glide
      wheelMultiplier: 1,
      smoothWheel: true,
      touchMultiplier: 1.8,
    });

    // Expose the instance so per-page scripts (e.g. the About mobile nav) can
    // drive smooth scrolling through Lenis instead of fighting it.
    window.lenis = lenis;

    // Drive Lenis and keep scroll-linked effects (hero fade, parallax) in sync.
    lenis.on("scroll", update);
    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    // Anchor links scroll smoothly through Lenis.
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id.length < 2) return;
        const el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        lenis.scrollTo(el, { offset: -88 }); // clear the sticky header
      });
    });
  }
})();
