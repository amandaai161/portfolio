/* ============================================================
   Amanda Idris — Case Study page interactions
   - Table-of-contents scroll-spy (active section highlight)
   - Deliverables accordion (exclusive open)
   - New Design Preview tabs
   - Before/After comparison slider (pointer + keyboard)
   Anchor smooth-scroll is handled by script.js (Lenis).
   ============================================================ */
(function () {
  "use strict";

  /* ---------- One-shot reveals ----------
     The shared script.js re-toggles `.reveal`/`.in-view` on every scroll in & out.
     On this page the entrance should play only ONCE per session: after an element
     has first appeared and finished animating, strip its `reveal` class so the
     shared observer can no longer re-hide or re-animate it (its toggling then has
     no `.reveal` styles to act on, and the element stays permanently visible).
     EXCEPTION: the deliverables accordion is interactive (expand/collapse anytime),
     so its reveals are left un-locked — they keep re-animating on every interaction. */
  if ("IntersectionObserver" in window) {
    const revealEls = Array.from(document.querySelectorAll(".reveal")).filter(
      (el) => !el.closest(".cs-accordion")
    );
    if (revealEls.length) {
      const REVEAL_MS = 1200; // shared transition (0.8s) + max stagger (0.32s)
      const lockIO = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            obs.unobserve(el);
            setTimeout(() => {
              el.classList.add("in-view");
              el.classList.remove("reveal");
            }, REVEAL_MS);
          });
        },
        { threshold: 0.15 }
      );
      revealEls.forEach((el) => lockIO.observe(el));
    }
  }

  /* ---------- Table-of-contents scroll-spy ---------- */
  const links = Array.from(document.querySelectorAll(".cs-toc__link"));
  const sections = links
    .map((l) => document.getElementById(l.getAttribute("href").slice(1)))
    .filter(Boolean);

  if (links.length && sections.length) {
    let current = null;
    const setActive = (id) => {
      if (id === current) return;
      current = id;
      links.forEach((l) =>
        l.classList.toggle("is-active", l.getAttribute("href").slice(1) === id)
      );
    };

    let ticking = false;
    const spy = () => {
      ticking = false;
      const line = window.innerHeight * 0.32; // trigger line near the top third
      let activeId = sections[0].id;
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= line) activeId = s.id;
        else break;
      }
      // snap to the last section once the page bottom is reached
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4
      ) {
        activeId = sections[sections.length - 1].id;
      }
      setActive(activeId);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(spy);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    if (window.lenis && window.lenis.on) window.lenis.on("scroll", onScroll);
    spy();
  }

  /* ---------- Deliverables accordion (one open at a time, animated height) ----------
     Driven in JS so the expand/collapse height animates reliably (CSS grid-rows
     transitions are flaky). We control the <details> open state ourselves. */
  const accs = Array.from(document.querySelectorAll(".cs-acc"));
  const DUR = 420; // ms, matches the CSS height transition
  const bodyOf = (acc) => acc.querySelector(".cs-acc__body");

  const expand = (acc) => {
    const body = bodyOf(acc);
    if (!body) return;
    acc.dataset.animating = "1";
    acc.setAttribute("open", "");
    body.style.height = "0px";
    void body.offsetHeight; // force reflow so the start height is committed
    body.style.height = body.scrollHeight + "px";
    const done = () => {
      if (acc.hasAttribute("open")) body.style.height = "auto"; // let it reflow naturally
      delete acc.dataset.animating;
      body.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
    };
    const onEnd = (e) => { if (e.propertyName === "height") done(); };
    body.addEventListener("transitionend", onEnd);
    const timer = setTimeout(done, DUR + 120); // fallback if transitionend doesn't fire
  };

  const collapse = (acc) => {
    const body = bodyOf(acc);
    if (!body) return;
    acc.dataset.animating = "1";
    body.style.height = body.scrollHeight + "px";
    void body.offsetHeight; // reflow
    body.style.height = "0px";
    const done = () => {
      acc.removeAttribute("open");
      body.style.height = "";
      delete acc.dataset.animating;
      body.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
    };
    const onEnd = (e) => { if (e.propertyName === "height") done(); };
    body.addEventListener("transitionend", onEnd);
    const timer = setTimeout(done, DUR + 120);
  };

  accs.forEach((acc) => {
    const head = acc.querySelector(".cs-acc__head");
    if (!head) return;
    head.addEventListener("click", (e) => {
      e.preventDefault(); // we manage open/close (and the animation) ourselves
      if (acc.dataset.animating) return;
      if (acc.hasAttribute("open")) {
        collapse(acc);
      } else {
        accs.forEach((o) => { if (o !== acc && o.hasAttribute("open")) collapse(o); });
        expand(acc);
      }
    });
  });

  /* ---------- Mobile TOC dropdown ("Jump into section") ----------
     In-flow the TOC is a normal expanded section that scrolls away with the page.
     Only once its WHOLE box has cleared the navbar do we pin it as a fixed,
     collapsed dropdown (.is-stuck). A placeholder of the same height holds the
     vacated grid space so the content below it never jumps. Pinning fades in;
     un-pinning plays an exit fade (.is-leaving) before returning to flow. */
  const toc = document.querySelector(".cs-toc");
  const tocToggle = document.querySelector(".cs-toc__toggle");
  const tocClose = document.querySelector(".cs-toc__close");
  if (toc && tocToggle) {
    const mqMobile = window.matchMedia("(max-width: 760px)");
    const headerEl = document.querySelector(".header");
    const LEAVE_MS = 280; // matches the csTocOut animation
    let placeholder = null;
    let leaveTimer = 0;

    const setTocOpen = (open) => {
      toc.classList.toggle("is-open", open);
      tocToggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    // toggle/close only act while pinned; in-flow it's an already-expanded section
    tocToggle.addEventListener("click", () => {
      if (!toc.classList.contains("is-stuck")) return;
      setTocOpen(!toc.classList.contains("is-open"));
    });
    if (tocClose) tocClose.addEventListener("click", () => setTocOpen(false));
    toc.querySelectorAll(".cs-toc__link").forEach((l) =>
      l.addEventListener("click", () => setTocOpen(false))
    );

    const removePlaceholder = () => {
      if (placeholder) { placeholder.remove(); placeholder = null; }
    };
    const resetToc = () => {
      clearTimeout(leaveTimer);
      toc.classList.remove("is-stuck", "is-leaving", "is-open");
      tocToggle.setAttribute("aria-expanded", "false");
      removePlaceholder();
    };

    // want === true → pin (fixed, collapsed); want === false → release back to flow
    const applyStuck = (want) => {
      const stuck = toc.classList.contains("is-stuck");
      const leaving = toc.classList.contains("is-leaving");
      if (want) {
        if (!stuck) {
          clearTimeout(leaveTimer);
          const h = toc.getBoundingClientRect().height;
          placeholder = document.createElement("div");
          placeholder.className = "cs-toc__placeholder";
          placeholder.style.height = h + "px";
          placeholder.setAttribute("aria-hidden", "true");
          toc.parentNode.insertBefore(placeholder, toc);
          toc.classList.add("is-stuck");
        } else if (leaving) {
          // scrolled back up before the exit finished → cancel it
          clearTimeout(leaveTimer);
          toc.classList.remove("is-leaving");
        }
      } else if (stuck && !leaving) {
        toc.classList.add("is-leaving");
        setTocOpen(false);
        clearTimeout(leaveTimer);
        leaveTimer = setTimeout(() => {
          toc.classList.remove("is-stuck", "is-leaving", "is-open");
          removePlaceholder();
        }, LEAVE_MS);
      }
    };

    let stuckTick = false;
    const updateStuck = () => {
      stuckTick = false;
      if (!mqMobile.matches) { resetToc(); return; }
      const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : 0;
      if (toc.classList.contains("is-stuck")) {
        // measure the in-flow placeholder to know when the section re-enters
        const ref = placeholder || toc;
        applyStuck(ref.getBoundingClientRect().bottom <= headerBottom + 1);
      } else {
        // pin only once the entire TOC box has scrolled above the navbar
        applyStuck(toc.getBoundingClientRect().bottom <= headerBottom + 1);
      }
    };
    const onStuck = () => {
      if (!stuckTick) { stuckTick = true; requestAnimationFrame(updateStuck); }
    };
    window.addEventListener("scroll", onStuck, { passive: true });
    window.addEventListener("resize", onStuck);
    if (window.lenis && window.lenis.on) window.lenis.on("scroll", onStuck);
    updateStuck();
  }

  /* ---------- New Design Preview tabs ---------- */
  const tabs = Array.from(document.querySelectorAll(".cs-tab"));
  const cap = document.querySelector("[data-preview-cap]");
  const cmpAfter = document.getElementById("cmpAfter");
  const cmpBefore = document.getElementById("cmpBefore");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (cap) cap.textContent = tab.dataset.tab || "Homepage";
      if (cmpAfter && tab.dataset.after) cmpAfter.src = tab.dataset.after;
      if (cmpBefore && tab.dataset.before) cmpBefore.src = tab.dataset.before;
    });
  });

  /* ---------- Before/After comparison slider ---------- */
  const compare = document.querySelector(".cs-compare");
  if (compare) {
    const handle = compare.querySelector(".cs-compare__handle");
    const clamp = (n) => (n < 0 ? 0 : n > 100 ? 100 : n);
    const setPos = (pct) => {
      pct = clamp(pct);
      compare.style.setProperty("--pos", pct + "%");
      if (handle) handle.setAttribute("aria-valuenow", Math.round(pct));
    };
    const pctFromEvent = (e) => {
      const r = compare.getBoundingClientRect();
      const clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX);
      return ((clientX - r.left) / r.width) * 100;
    };

    let dragging = false;
    compare.addEventListener("pointerdown", (e) => {
      dragging = true;
      compare.setPointerCapture && compare.setPointerCapture(e.pointerId);
      setPos(pctFromEvent(e));
      e.preventDefault();
    });
    compare.addEventListener("pointermove", (e) => {
      if (dragging) setPos(pctFromEvent(e));
    });
    const stop = () => { dragging = false; };
    compare.addEventListener("pointerup", stop);
    compare.addEventListener("pointercancel", stop);

    if (handle) {
      handle.addEventListener("keydown", (e) => {
        const cur = parseFloat(compare.style.getPropertyValue("--pos")) || 50;
        if (e.key === "ArrowLeft") { setPos(cur - 4); e.preventDefault(); }
        else if (e.key === "ArrowRight") { setPos(cur + 4); e.preventDefault(); }
        else if (e.key === "Home") { setPos(0); e.preventDefault(); }
        else if (e.key === "End") { setPos(100); e.preventDefault(); }
      });
    }

    /* ---- grip follows the viewport while the comparison is on screen ---- */
    const grip = compare.querySelector(".cs-compare__grip");
    if (grip) {
      const bar = document.querySelector(".cs-preview__bar");
      const header = document.querySelector(".header");
      const M = 40; // keep the grip fully inside the frame
      let gTicking = false;
      const placeGrip = () => {
        gTicking = false;
        const r = compare.getBoundingClientRect();
        // visible area starts below whatever is pinned at the top: the navbar
        // (always) or the sticky preview bar on desktop. On mobile the bar is
        // static (scrolls away), so the navbar bottom takes over — this is what
        // makes the grip follow the viewport on mobile.
        const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
        const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
        const top = Math.max(headerBottom, barBottom, 0);
        const vh = window.innerHeight;
        const visTop = Math.min(Math.max(r.top, top), vh);
        const visBot = Math.min(Math.max(r.bottom, top), vh);
        let y = (visTop + visBot) / 2 - r.top; // centre of the visible slice, in container coords
        y = Math.max(M, Math.min(y, r.height - M));
        compare.style.setProperty("--grip-y", y + "px");
      };
      const onGrip = () => { if (!gTicking) { gTicking = true; requestAnimationFrame(placeGrip); } };
      window.addEventListener("scroll", onGrip, { passive: true });
      window.addEventListener("resize", onGrip);
      if (window.lenis && window.lenis.on) window.lenis.on("scroll", onGrip);
      compare.querySelectorAll(".cs-compare__shot").forEach((im) => im.addEventListener("load", onGrip));
      placeGrip();
    }
  }

  /* ---------- Deliverables image lightbox (magnify + pinch-zoom) ----------
     Deliverable images get small on mobile, so each one gets a magnify button that
     opens a fullscreen overlay. The overlay supports pinch-zoom, drag-to-pan, and
     double-tap, with a close button and tap-the-backdrop to dismiss. The trigger
     button is hidden on desktop via CSS, so this only ever fires on small screens. */
  const mediaFrames = Array.from(document.querySelectorAll(".cs-acc__media .cs-ph--img"));
  if (mediaFrames.length) {
    const MAGNIFY_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>';

    // build the overlay once
    const lb = document.createElement("div");
    lb.className = "cs-lightbox";
    lb.setAttribute("aria-hidden", "true");
    lb.innerHTML =
      '<div class="cs-lightbox__stage"><img class="cs-lightbox__img" alt="" /></div>' +
      '<button class="cs-lightbox__close" type="button" aria-label="Close image preview">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    document.body.appendChild(lb);
    const lbImg = lb.querySelector(".cs-lightbox__img");
    const lbStage = lb.querySelector(".cs-lightbox__stage");
    const lbClose = lb.querySelector(".cs-lightbox__close");

    // ---- transform state ----
    const MIN = 1, MAX = 4;
    let scale = 1, tx = 0, ty = 0;
    const pts = new Map();
    let startDist = 0, startScale = 1, startMid = { x: 0, y: 0 }, startTx = 0, startTy = 0;
    let lastTap = 0;

    const apply = () => { lbImg.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")"; };
    const resetView = () => { scale = 1; tx = 0; ty = 0; apply(); };

    const open = (src, alt) => {
      lbImg.src = src;
      lbImg.alt = alt || "";
      resetView();
      lb.classList.add("is-open");
      lb.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      if (window.lenis && window.lenis.stop) window.lenis.stop();
    };
    const close = () => {
      lb.classList.remove("is-open");
      lb.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (window.lenis && window.lenis.start) window.lenis.start();
      pts.clear();
    };

    lbClose.addEventListener("click", close);
    // tap empty space (backdrop or stage padding) closes; tapping the image does not
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target === lbStage) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && lb.classList.contains("is-open")) close(); });

    // ---- pinch + pan via pointer events ----
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const refreshPanStart = () => {
      if (pts.size === 1) {
        const only = pts.values().next().value;
        startMid = { x: only.x, y: only.y };
        startTx = tx; startTy = ty;
      }
    };

    lbStage.addEventListener("pointerdown", (e) => {
      if (lbStage.setPointerCapture) lbStage.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const v = [...pts.values()];
        startDist = dist(v[0], v[1]);
        startScale = scale;
        startMid = mid(v[0], v[1]);
        startTx = tx; startTy = ty;
      } else {
        refreshPanStart();
        // double-tap to toggle zoom
        const now = Date.now();
        if (now - lastTap < 300) {
          scale = scale > 1 ? 1 : 2.4;
          if (scale === 1) { tx = 0; ty = 0; }
          apply();
        }
        lastTap = now;
      }
    });
    lbStage.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && startDist) {
        const v = [...pts.values()];
        scale = Math.max(MIN, Math.min(MAX, startScale * (dist(v[0], v[1]) / startDist)));
        const m = mid(v[0], v[1]);
        tx = startTx + (m.x - startMid.x);
        ty = startTy + (m.y - startMid.y);
        apply();
        e.preventDefault();
      } else if (pts.size === 1 && scale > 1) {
        tx = startTx + (e.clientX - startMid.x);
        ty = startTy + (e.clientY - startMid.y);
        apply();
        e.preventDefault();
      }
    });
    const upPt = (e) => {
      pts.delete(e.pointerId);
      if (scale <= 1.02) resetView();
      refreshPanStart();
    };
    lbStage.addEventListener("pointerup", upPt);
    lbStage.addEventListener("pointercancel", upPt);

    // inject a magnify button into every deliverable image frame
    mediaFrames.forEach((frame) => {
      const img = frame.querySelector("img");
      if (!img) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cs-zoom-btn";
      btn.setAttribute("aria-label", "View full image");
      btn.innerHTML = MAGNIFY_SVG;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        open(img.currentSrc || img.src, img.alt);
      });
      frame.appendChild(btn);
    });
  }

  /* ---------- Sidebar show/hide toggle ---------- */
  const asideToggle = document.getElementById("asideToggle");
  const shell = document.querySelector(".cs-shell");
  if (asideToggle && shell) {
    asideToggle.addEventListener("click", () => {
      const hidden = shell.classList.toggle("is-aside-hidden");
      asideToggle.setAttribute("aria-expanded", hidden ? "false" : "true");
    });
  }

  /* ---------- Reading progress bar (fills left→right to the page end) ---------- */
  const progress = document.getElementById("readingProgress");
  if (progress) {
    let pTicking = false;
    const updateProgress = () => {
      pTicking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      progress.style.transform = "scaleX(" + Math.max(0, Math.min(1, p)).toFixed(4) + ")";
    };
    const onProg = () => {
      if (!pTicking) { pTicking = true; requestAnimationFrame(updateProgress); }
    };
    window.addEventListener("scroll", onProg, { passive: true });
    window.addEventListener("resize", onProg);
    if (window.lenis && window.lenis.on) window.lenis.on("scroll", onProg);
    updateProgress();
  }
})();
