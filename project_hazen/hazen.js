/* HAZEN · case study: page behaviour.
   A port of the current HAZEN page's script, renamed to this page's classes.
   Site-wide behaviour (reveals, Lenis, the contents spy, reading progress,
   the scroll cue's fade) comes from /js/script.js and /js/case-study.js; this
   file only does what is particular to Hazen:
   - hands the hero to the outcome and the outcome to the page, the way
     the homepage's hero hands over to its USP and works
   - fills every prompt and character count from the run records (runs.js)
   - plays each graphic once, when it arrives
   - pins the five-skill walk-through at desktop widths, one skill at a time
   - fills the worked examples' spines as you read down them
   Add ?static=1 to the URL to lay the page out flat (no hand-over, no pinned
   walk-through; for full-page screenshots); window.HZ.play() shows every end
   state at once, and window.HZ.lead.seek(t) puts the hand-over at t screens
   (0 to 1.5). */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var HEAD = 88; /* the site header, which stays put on this page */

  var LOG = window.HZ_LOG || [];
  var byId = {};
  LOG.forEach(function (r) { byId[r.id] = r; });
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  var STATIC = /[?&]static=1(&|$)/.test(location.search);
  root.classList.add(STATIC ? "hz-static" : "hz-pin");
  /* for the screenshot harness: proof that this page's own stylesheet arrived */
  if (getComputedStyle(doc.body).getPropertyValue("--mono")) root.classList.add("hz-styled");
  /* keep in step with the pinned rules in hazen.css */
  var wide = matchMedia("(min-width: 1200px) and (min-height: 620px)");
  function pinned() { return !STATIC && wide.matches; }

  /* timed rather than eased per frame, so a jump lands on time even when
     frames are scarce */
  function scrollToY(y) {
    y = Math.max(0, Math.round(y));
    if (window.lenis && window.lenis.scrollTo) window.lenis.scrollTo(y, RM ? { immediate: true } : { duration: 1.1 });
    else scrollTo({ top: y, behavior: RM ? "auto" : "smooth" });
  }

  /* ── run blocks, filled straight out of the records ─────────────────── */
  function clampPrompt(pt) {
    if (pt.textContent.length <= 420) return;
    var w = doc.createElement("div");
    w.className = "hz-pclamp";
    pt.parentNode.insertBefore(w, pt);
    w.appendChild(pt);
    var b = doc.createElement("button");
    b.type = "button";
    b.className = "hz-pmore";
    b.textContent = "Read the whole prompt";
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function () {
      var open = w.classList.toggle("is-open");
      b.textContent = open ? "Collapse" : "Read the whole prompt";
      b.setAttribute("aria-expanded", open ? "true" : "false");
      if (window.lenis && window.lenis.resize) window.lenis.resize();
    });
    w.parentNode.insertBefore(b, w.nextSibling);
  }
  $$("[data-run]").forEach(function (el) {
    var r = byId[el.getAttribute("data-run")];
    if (!r) { el.style.display = "none"; return; }
    var pn = $("[data-pn]", el), pt = $("[data-ptext]", el);
    if (pn) pn.textContent = commas(r.chars) + " characters";
    if (pt) { pt.textContent = r.prompt; clampPrompt(pt); }
  });
  $$("[data-full]").forEach(function (el) {
    var r = byId[el.getAttribute("data-full")];
    if (r) el.textContent = r.prompt;
  });

  /* the gap: the undirected prompt, with the words the engine ignores struck */
  (function () {
    var ctrl = byId["0811 meja-control-undirected 01"], p = $("#gapPrompt");
    if (!ctrl || !p) return;
    var cut = ctrl.prompt.indexOf("8k,");
    if (cut > 0) {
      p.textContent = ctrl.prompt.slice(0, cut);
      var g = doc.createElement("span");
      g.className = "hz-garland";
      g.textContent = ctrl.prompt.slice(cut);
      p.appendChild(g);
    } else p.textContent = ctrl.prompt;
    var n = $("#gapChars");
    if (n) n.textContent = commas(ctrl.chars);
  })();

  /* the map draws its edges, so each one needs its own length */
  $$("#flowchart .fc-edge").forEach(function (p) {
    if (p.classList.contains("fc-edge--loop")) return;
    try { p.style.setProperty("--len", Math.ceil(p.getTotalLength()) + 1); } catch (e) {}
  });

  /* ── graphics play once, when they arrive ───────────────────────────── */
  var players = $$("[data-play]");
  function play(el) {
    if (el.classList.contains("is-on")) return;
    el.classList.add("is-on");
    if (playIO) playIO.unobserve(el);
  }
  /* while the walk-through is pinned, the five skills share one stage, so a
     skill's graphic waits until that skill is the one on show */
  function canPlay(el) {
    var d = el.closest(".hz-dos");
    if (d && pinned() && !d.classList.contains("is-on")) return false;
    /* nor while the page is still waiting, unseen, behind the cover */
    return !(Lead && Lead.waiting(el));
  }
  var playIO = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting && canPlay(e.target)) play(e.target); });
  }, { threshold: 0.3 }) : null;
  players.forEach(function (el) { if (playIO) playIO.observe(el); });

  /* anything already on screen plays now. this also covers headless captures
     whose viewport is the whole page. */
  function sweep(list) {
    var vh = innerHeight;
    (list || players).forEach(function (el) {
      if (el.classList.contains("is-on") || !canPlay(el)) return;
      var r = el.getBoundingClientRect();
      if (r.height > 0 && r.top < vh * 0.96 && r.bottom > HEAD) play(el);
    });
  }

  /* ── the hero hands over to the outcome, the outcome to the page ──── */
  /* The homepage's hero, USP and works (js/scenes-home.js), with its
     numbers. Where the hero fits one screen (the same query as the
     homepage's), all three share a stage that sticks under the header for
     RUN screens of scroll, a screen being the viewport plus the header:
       0.00 - 0.08   the hero, as it loaded
       0.08 - 0.30   the hero fades out, carrying DRIFT px upward
       0.30 - 0.50   the outcome fades in from DRIFT px below, in the same place
       0.50 - 1.00   the outcome holds: time to read it
       1.00 - 1.22   the outcome leaves upward, as the hero did
       1.22 - 1.42   the page arrives from below, as the outcome did
       1.42 - 1.50   a beat, and the stage lets go; the page scrolls on
     The motion trails the scroll slightly, as the homepage's scrub of 0.6
     does, and scrolling back rewinds it. hazen.css holds the runway
     (.hz-lead::after, RUN screens tall) under the same query. */
  var Lead = (function () {
    var lead = $("#hzLead"), stage = lead && $(".hz-lead__stage", lead), hero = $("#hzHero"), oc = $("#hzOutcome"), body = $("#hzPage");
    var none = function () {}, no = function () { return false; };
    if (!lead || !stage || !hero || !oc || !body) return { sync: none, seek: none, shift: function () { return 0; }, on: no, waiting: no, quietly: function (f) { f(); } };
    var Q = matchMedia("(min-width: 1200px) and (min-height: 680px) and (max-aspect-ratio: 9/4)");
    var RUN = 1.5, LEAVE = 0.22, ARRIVE = 0.20, DRIFT = 28;
    var HERO_OUT = 0.08, OC_IN = 0.30, OC_OUT = 1.00, PAGE_IN = 1.22;
    /* the time constant of the trail: GSAP's scrub of 0.6 eases out on an
       expo curve, which is close to this */
    var TAU = 0.09;
    var staged = false, target = 0, shown = 0, last = 0, raf = 0;

    function wants() { return !STATIC && !RM && Q.matches; }
    /* the lead's top meets the header's bottom where the runway starts */
    function start() { return lead.getBoundingClientRect().top + scrollY - HEAD; }
    function runPx() { return Math.max(0, lead.offsetHeight - stage.offsetHeight); }
    function at(t) { return start() + runPx() * t / RUN; }
    function now() {
      var r = runPx();
      return r > 0 ? clamp((scrollY - start()) / r, 0, 1) * RUN : RUN;
    }
    /* while the stage sticks, everything on it reads higher up the page than
       it will sit once the stage lets go; this is by how much */
    function shift() {
      if (!staged) return 0;
      var r = runPx();
      return r - clamp(scrollY - start(), 0, r);
    }
    function show(el, o, y) {
      el.style.opacity = String(+o.toFixed(3));
      el.style.transform = "translate3d(0," + y.toFixed(2) + "px,0)";
    }
    function plain(el) { el.style.opacity = el.style.transform = ""; }
    function paint(t) {
      var h = clamp((t - HERO_OUT) / LEAVE, 0, 1),
          a = clamp((t - OC_IN) / ARRIVE, 0, 1),
          o = clamp((t - OC_OUT) / LEAVE, 0, 1),
          b = clamp((t - PAGE_IN) / ARRIVE, 0, 1);
      if (h > 0) show(hero, 1 - h, -DRIFT * h); else plain(hero);
      /* the outcome has no resting place on the page, so it always carries
         its state: coming up from below, then leaving upward */
      if (o > 0) show(oc, 1 - o, -DRIFT * o); else show(oc, a, DRIFT * (1 - a));
      if (b < 1) show(body, b, DRIFT * (1 - b)); else plain(body);
      /* they sit in one place, so only the one on screen takes the pointer,
         handing over halfway through each fade */
      hero.classList.toggle("is-live", t < HERO_OUT + LEAVE / 2);
      oc.classList.toggle("is-live", t > OC_IN + ARRIVE / 2 && t < OC_OUT + LEAVE / 2);
      var was = body.classList.contains("is-live");
      body.classList.toggle("is-live", t > PAGE_IN + ARRIVE / 2);
      /* graphics that waited behind the cover play as the page arrives */
      if (!was && body.classList.contains("is-live")) sweep();
    }
    function tick(ts) {
      raf = 0;
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 1 / 60;
      last = ts;
      shown += (target - shown) * (1 - Math.exp(-dt / TAU));
      if (Math.abs(target - shown) < 0.0005) shown = target;
      paint(shown);
      if (shown !== target) raf = requestAnimationFrame(tick);
      else last = 0;
    }
    function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
    function set(on) {
      if (on === staged) return;
      staged = on;
      root.classList.toggle("hz-staged", on);
      halt();
      if (on) { target = shown = now(); paint(shown); return; }
      plain(hero); plain(oc); plain(body);
      hero.classList.add("is-live");
      oc.classList.remove("is-live");
      body.classList.remove("is-live");
    }
    function sync() {
      set(wants());
      if (!staged) return;
      target = now();
      if (!raf && shown !== target) raf = requestAnimationFrame(tick);
    }
    /* for tests: the preview pane runs no frames, so put the hand-over at t
       (in screens, 0 to RUN) */
    function seek(t) {
      if (!staged) return;
      halt();
      target = shown = clamp(t, 0, RUN);
      paint(shown);
    }
    function jump(y) {
      y = Math.max(0, Math.round(y));
      if (window.lenis && window.lenis.scrollTo) window.lenis.scrollTo(y, { immediate: true, force: true });
      /* Lenis skips a jump to where it believes it already is, and after
         the browser has scrolled on its own (to show a focused link) that
         belief can be out of date */
      if (Math.abs(scrollY - y) > 1) scrollTo(0, y);
    }

    /* A keyboard visitor can Tab into the layer that is not on screen. Bring
       the one they are in onto the stage instead, as the homepage does.
       Focus this script moves itself (quietly, below) is left alone: the
       scroll that goes with it is already on its way. */
    var hushed = false;
    function quietly(f) { hushed = true; try { f(); } finally { hushed = false; } }
    lead.addEventListener("focusin", function (e) {
      if (!staged || hushed) return;
      var n = now(), to = -1;
      if (hero.contains(e.target) && n > HERO_OUT + LEAVE / 2) to = 0;
      else if (oc.contains(e.target) && (n < OC_IN + ARRIVE / 2 || n > OC_OUT + LEAVE / 2)) to = (OC_IN + ARRIVE + OC_OUT) / 2;
      else if (body.contains(e.target) && n < PAGE_IN + ARRIVE / 2) to = RUN;
      if (to >= 0) jump(at(to));
    });

    /* The site scrolls to a #link by reading where its target is now. On the
       runway that is short by shift(), so links into the page are caught
       first and sent to where their target will be. (The five cover cards
       are the walk-through's, below.) */
    doc.addEventListener("click", function (e) {
      if (!staged || e.defaultPrevented) return;
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a || a.classList.contains("hz-cc")) return;
      var id = a.getAttribute("href"), el = null, s = shift();
      if (id.length < 2 || s < 1) return;
      try { el = doc.querySelector(id); } catch (x) { return; }
      if (!el || !stage.contains(el)) return;
      e.preventDefault();
      e.stopPropagation();
      scrollToY(el.getBoundingClientRect().top + scrollY + s - HEAD);
    }, true);

    /* A page opened at #something in the page: the browser scrolled there
       while the stage stuck, so it stopped short. */
    addEventListener("load", function () {
      setTimeout(function () {
        if (!staged || location.hash.length < 2) return;
        var el = null;
        try { el = doc.querySelector(decodeURIComponent(location.hash)); } catch (x) { return; }
        if (!el || !stage.contains(el)) return;
        var m = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        jump(el.getBoundingClientRect().top + scrollY + shift() - Math.max(m, HEAD));
      }, 60);
    });

    set(wants());
    return {
      sync: sync,
      seek: seek,
      shift: shift,
      at: at,
      on: function () { return staged; },
      quietly: quietly,
      waiting: function (el) { return staged && !body.classList.contains("is-live") && body.contains(el); },
      state: function () { return { staged: staged, now: shown, target: target, run: runPx(), shift: shift() }; }
    };
  })();

  /* ── the walk-through. pinned, one skill at a time. ─────────────────── */
  var Descent = (function () {
    var track = $("#desctrack"), nav = $("#descnav"), stage = $("#descstage"), spine = $("#spineFill");
    var none = function () {};
    if (!track || !nav || !stage) return { goto: none, sync: none, measure: none };
    var cards = $$(".hz-sk", nav), dossiers = $$(".hz-dos", stage), N = dossiers.length;
    var cur = null, dotY = [], navH = 0;

    function measure() {
      dotY = [];
      if (!pinned()) return;
      var nr = nav.getBoundingClientRect();
      navH = nr.height;
      if (navH <= 0) return;
      /* pin the gradient to the whole nav, so each colour lands on its own dot */
      if (spine) spine.style.backgroundSize = "100% " + navH + "px";
      dotY = cards.map(function (c) {
        var d = $(".hz-sk__dot", c).getBoundingClientRect();
        return d.top + d.height / 2 - nr.top;
      });
    }
    function fill(i, f) {
      if (!spine || !dotY.length) return;
      var a = dotY[i], b = i + 1 < dotY.length ? dotY[i + 1] : navH;
      spine.style.height = Math.max(0, a + (b - a) * clamp(f, 0, 1)) + "px";
    }
    function select(i) {
      if (i === cur) return;
      cur = i;
      cards.forEach(function (c, k) {
        c.classList.toggle("is-on", k === i);
        c.classList.toggle("is-done", k < i);
        if (k === i) c.setAttribute("aria-current", "step");
        else c.removeAttribute("aria-current");
      });
      dossiers.forEach(function (d, k) { d.classList.toggle("is-on", k === i); });
    }
    function sync() {
      if (!pinned()) {
        if (cur !== "flat") {
          cur = "flat";
          cards.forEach(function (c) { c.classList.remove("is-on", "is-done"); c.removeAttribute("aria-current"); });
          dossiers.forEach(function (d) { d.classList.add("is-on"); });
          if (spine) spine.style.height = "0px";
        }
        return;
      }
      if (!dotY.length) measure();
      var r = track.getBoundingClientRect();
      var run = r.height - (innerHeight - HEAD);
      var p = clamp((HEAD - r.top) / (run > 0 ? run : 1), 0, 1);
      var raw = p * N, i = clamp(Math.floor(raw), 0, N - 1);
      select(i);
      fill(i, raw - i);
      /* a skill taller than the stage reads down as you scroll its share of
         the track: still at first, then moving, then still at its end */
      var d = dossiers[i], over = d.scrollHeight - d.clientHeight;
      var st = over > 0 ? Math.round(over * clamp((raw - i - 0.12) / 0.6, 0, 1)) : 0;
      d.scrollTop = st;
      /* soften whichever edge has more of the skill beyond it */
      d.style.setProperty("--fade-t", st > 1 ? "32px" : "0px");
      d.style.setProperty("--fade-b", over - st > 1 ? "32px" : "0px");
      sweep($$("[data-play]", d));
    }
    /* lift: where the cover still holds the stage, the track is that much
       further down the page than it reads now */
    function goto(i) {
      var lift = Lead.shift();
      if (!pinned()) {
        var d = dossiers[i];
        if (d) scrollToY(d.getBoundingClientRect().top + scrollY + lift - HEAD - 24);
        return;
      }
      var r = track.getBoundingClientRect(), top = r.top + scrollY + lift;
      var run = r.height - (innerHeight - HEAD);
      scrollToY(top - HEAD + run * ((i + 0.5) / N));
    }

    cards.forEach(function (c) {
      c.addEventListener("click", function () { goto(+c.getAttribute("data-i")); });
    });
    /* the five cover cards jump straight to their skill. caught before the
       site's own anchor scrolling, which cannot see into the pinned stage. */
    doc.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a.hz-cc[data-skill]") : null;
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      var i = +a.getAttribute("data-skill"), d = dossiers[i];
      goto(i);
      /* focus goes with the visitor, so the next Tab carries on from the
         skill rather than from a card that has faded away */
      if (!d) return;
      if (!d.hasAttribute("tabindex")) d.setAttribute("tabindex", "-1");
      Lead.quietly(function () { d.focus({ preventScroll: true }); });
    }, true);

    return { goto: goto, sync: sync, measure: measure, state: function () { return { i: cur, h: spine ? spine.style.height : null }; } };
  })();

  /* ── the worked examples' spines ────────────────────────────────────── */
  var spines = $$("ol.hz-steps").map(function (ol) { return { ol: ol, steps: $$(".hz-step", ol) }; });
  function paintSpines() {
    if (STATIC) { /* a flat capture shows each spine as it ends, read through */
      spines.forEach(function (s) {
        s.ol.style.setProperty("--fill", "1");
        s.steps.forEach(function (st) { st.classList.add("is-seen"); });
      });
      return;
    }
    var vh = innerHeight, line = vh * 0.58;
    spines.forEach(function (s) {
      var r = s.ol.getBoundingClientRect();
      /* starts as the list's top passes 60% down the screen, ends as its
         bottom passes the halfway line */
      var p = clamp((vh * 0.6 - r.top) / (r.height + vh * 0.1), 0, 1);
      s.ol.style.setProperty("--fill", p.toFixed(4));
      s.steps.forEach(function (st) {
        if (!st.classList.contains("is-seen") && st.getBoundingClientRect().top <= line) st.classList.add("is-seen");
      });
    });
  }

  /* ── the looping clip plays itself, unless motion is unwelcome ──────── */
  (function () {
    var v = $(".hz-kv__vid");
    if (!v) return;
    v.muted = true;
    if (RM) { v.removeAttribute("autoplay"); v.pause(); return; }
    var go = v.play();
    if (go && go.catch) go.catch(function () {});
  })();

  /* ── one scroll clock ───────────────────────────────────────────────── */
  var queued = false;
  function frame() { queued = false; Lead.sync(); Descent.sync(); paintSpines(); }
  function req() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  function refresh() { Lead.sync(); Descent.measure(); frame(); sweep(); }
  addEventListener("scroll", req, { passive: true });
  addEventListener("resize", refresh, { passive: true });
  addEventListener("load", function () { refresh(); setTimeout(refresh, 400); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(refresh);
  refresh();

  /* ── test surface: the preview pane never fires scroll or observers ─── */
  window.HZ = {
    log: LOG,
    lead: Lead,
    descent: Descent,
    play: function () {
      players.forEach(function (el) { el.classList.add("is-on"); });
      $$(".hz-step").forEach(function (s) { s.classList.add("is-seen"); });
      $$("ol.hz-steps").forEach(function (o) { o.style.setProperty("--fill", "1"); });
      $$(".reveal").forEach(function (e) { e.classList.add("in-view"); });
    }
  };
})();
