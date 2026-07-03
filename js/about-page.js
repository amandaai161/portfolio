/* ============================================================
   Amanda Idris — About page interactions
   (shared chrome — header, reveal, mobile menu, email copy, Lenis —
    is handled by script.js)

   Desktop: the Experience timeline shows one panel at a time.
   Mobile (≤760px): a sticky 3-section nav, a swipeable Experience
   carousel with sticky chapter tabs, and a 2-tab Skillsets filter.
   ============================================================ */
(function () {
  "use strict";

  const mq = window.matchMedia("(max-width: 760px)");

  // Set by the Experience block; called by the section nav when the Experience
  // tab is (re)shown, so the carousel can measure itself once it has width.
  let refitExperience = null;

  // Re-trigger a simple fade-in-from-bottom on an element (mobile micro-interaction).
  // The class is removed when the animation ends so no transform lingers.
  const animateIn = (el) => {
    if (!el || !mq.matches) return;
    el.classList.remove("m-anim");
    void el.offsetWidth; // reflow so the animation restarts
    el.classList.add("m-anim");
    const done = () => {
      el.classList.remove("m-anim");
      el.removeEventListener("animationend", done);
    };
    el.addEventListener("animationend", done);
  };

  /* ============================================================
     EXPERIENCE — chapters (desktop panels / mobile carousel)
     ============================================================ */
  const bars = Array.from(document.querySelectorAll("[data-exp]"));
  const panels = Array.from(document.querySelectorAll(".exp-panel"));
  const detail = document.querySelector(".tl__detail");

  if (bars.length && panels.length && detail) {
    const order = panels.map((p) => p.dataset.panel);

    const setActiveBars = (key) => {
      bars.forEach((b) => {
        const on = b.dataset.exp === key;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    };

    // Desktop: show only the selected panel.
    const selectDesktop = (key) => {
      setActiveBars(key);
      panels.forEach((p) => { p.hidden = p.dataset.panel !== key; });
    };

    // Mobile carousel helpers. "Carousel mode" = the CSS has switched .tl__detail
    // to a horizontal flex row (only happens at ≤760px) — more reliable than mq.
    const isCarousel = () => getComputedStyle(detail).display === "flex";
    // One "slide" = a panel's width + the inter-panel gap. Measuring/snapping must
    // use this stride or the carousel drifts once a gap is added between chapters.
    const stride = () => {
      const gap = parseFloat(getComputedStyle(detail).columnGap) || 0;
      return detail.clientWidth + gap;
    };
    const idxNow = () => {
      const s = stride();
      return s ? Math.round(detail.scrollLeft / s) : 0;
    };
    const clampIdx = (i) => Math.max(0, Math.min(panels.length - 1, i));
    const fitHeight = () => {
      if (!isCarousel()) { detail.style.height = ""; return; }
      detail.style.height = panels[clampIdx(idxNow())].scrollHeight + "px";
    };
    // Set scrollLeft directly (programmatic scrollTo + mandatory snap don't play nicely).
    const scrollToKey = (key) => {
      const i = order.indexOf(key);
      if (i >= 0) detail.scrollLeft = i * stride();
    };

    // Keep the active chapter chip in view inside the (scrollable) picker —
    // matters now that the default chapter (Aspire) is the right-most chip.
    const picker = document.querySelector(".tl__picker");
    const scrollPickerToActive = () => {
      if (!picker) return;
      const chip = picker.querySelector(".tl-bar.is-active");
      if (!chip) return;
      const target = chip.offsetLeft - (picker.clientWidth - chip.offsetWidth) / 2;
      picker.scrollLeft = Math.max(0, target);
    };

    let rafId = 0;
    let lastKey = null;
    detail.addEventListener(
      "scroll",
      () => {
        if (!isCarousel()) return;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const key = order[clampIdx(idxNow())];
          setActiveBars(key);
          fitHeight();
          if (key !== lastKey) { lastKey = key; scrollPickerToActive(); }
        });
      },
      { passive: true }
    );

    bars.forEach((b) => {
      b.setAttribute("role", "button");
      b.setAttribute("aria-pressed", "false");
      const act = () => {
        const key = b.dataset.exp;
        if (isCarousel()) {
          lastKey = key;
          setActiveBars(key); scrollToKey(key); fitHeight(); scrollPickerToActive();
        } else { selectDesktop(key); }
      };
      b.addEventListener("click", act);
      b.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); }
      });
    });

    const applyExpMode = () => {
      if (isCarousel()) {
        panels.forEach((p) => { p.hidden = false; });   // show all for the carousel
        lastKey = "aspire";
        setActiveBars("aspire");
        scrollToKey("aspire");
        requestAnimationFrame(() =>
          requestAnimationFrame(() => { fitHeight(); scrollPickerToActive(); })
        );
      } else {
        detail.style.height = "";
        selectDesktop("aspire");
      }
    };

    mq.addEventListener("change", applyExpMode);
    window.addEventListener("resize", fitHeight);
    refitExperience = applyExpMode;
    applyExpMode();
  }

  /* ============================================================
     MOBILE — bottom section nav: show ONE section at a time
     (Profile / Experience / Skillsets / Tools). Inactive sections get
     .m-sec-hidden, which only resolves to display:none at ≤760px, so the
     desktop layout (all sections visible) is untouched.
     ============================================================ */
  const secnav = document.querySelector(".m-secnav");
  const secTabs = Array.from(document.querySelectorAll(".m-secnav__tab"));
  const secEls = {
    profile: document.querySelector(".ab-hero"),
    experience: document.getElementById("experience"),
    skillsets: document.getElementById("skillsets"),
    tools: document.getElementById("tools"),
  };
  if (secnav && secTabs.length) {
    const showSection = (key) => {
      Object.keys(secEls).forEach((k) => {
        if (secEls[k]) secEls[k].classList.toggle("m-sec-hidden", k !== key);
      });
      secTabs.forEach((t) =>
        t.classList.toggle("is-active", t.dataset.sec === key)
      );
    };

    const goTo = (key) => {
      showSection(key);
      animateIn(secEls[key]);                        // fade in from the bottom
      // start the freshly revealed section at the top, under the sticky header
      if (window.lenis) window.lenis.scrollTo(0, { immediate: true });
      else window.scrollTo(0, 0);
      // the Experience carousel was display:none (width 0) — re-measure now
      if (key === "experience" && refitExperience) {
        requestAnimationFrame(() => requestAnimationFrame(refitExperience));
      }
    };

    secTabs.forEach((t) =>
      t.addEventListener("click", () => goTo(t.dataset.sec))
    );

    // Enable single-section mode on mobile; clear it (show everything) on desktop.
    const applyNavMode = () => {
      if (mq.matches) {
        const active =
          secTabs.find((t) => t.classList.contains("is-active")) || secTabs[0];
        showSection(active.dataset.sec);
      } else {
        Object.keys(secEls).forEach((k) => {
          if (secEls[k]) secEls[k].classList.remove("m-sec-hidden");
        });
        secTabs.forEach((t) => t.classList.remove("is-active"));
      }
    };
    mq.addEventListener("change", applyNavMode);
    applyNavMode();
  }

  /* ============================================================
     MOBILE — Skillsets 2-tab filter (Deep Mastery / Collaborative)
     ============================================================ */
  const tshape = document.querySelector(".tshape");
  const skillTabs = Array.from(document.querySelectorAll(".m-tshape__tab"));
  const tgrid = document.querySelector(".tshape__grid");
  const tcap = document.querySelector(".m-tshape__cap");
  if (tshape && skillTabs.length) {
    skillTabs.forEach((t) => {
      t.addEventListener("click", () => {
        const broad = t.dataset.skill === "broad";
        tshape.classList.toggle("is-broad", broad);
        skillTabs.forEach((x) => x.classList.toggle("is-active", x === t));
        // fade the filtered boxes + caption in from the bottom
        animateIn(tgrid);
        animateIn(tcap);
      });
    });
  }
})();
