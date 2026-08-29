/* ==========================================================================
   Identity — interactive member map
   --------------------------------------------------------------------------
   A port of the signed-off working file
     web page v2 - sections/Interactive Indonesia community map/
       Identity Member Map - Scroll.html
   into the page. Two things changed on the way in:

   1. GEOMETRY IS BAKED. The source derives every territory at load from
      d3 + topojson + a 750 KB world atlas, by rasterising a 1440x880 canvas,
      labelling each cell with its nearest chapter and marching-squares'ing the
      result. That is ~1 MB of dependencies and a long main-thread stall on a
      landing page, so it is precomputed into js/map-data.js — same numbers,
      no libraries.

   2. SCROLL IS THE DECK'S. The source pins itself for 420vh and reads its own
      getBoundingClientRect. Here the map slide simply asks the deck for extra
      viewports of hold (data-dwell) and reads back how far through that hold
      the page is: the dots fly in and morph over the first stretch, and the
      rest of the hold is yours to explore before the slide dissolves on.

   The list under the map is the same data as a plain, focusable list. On
   desktop it is offscreen (the map is the interface); on mobile — where a
   2.85:1 archipelago cannot carry 38 legible labels — it *is* the interface.
   ========================================================================== */

(function () {
  "use strict";

  var D = window.ID_MAP;
  var root = document.getElementById("idmap");
  if (!D || !root) return;

  var NS = "http://www.w3.org/2000/svg";

  /* the framed part of the source's 1440x880 stage: the archipelago occupies
     x 110..1329, y 227..655, and the rest is dead air. The margins left here
     are the room the label collision solver pushes rows out into. */
  var VIEW = [70, 190, 1300, 510];          /* 2.55:1 — see --map-ratio */
  var MOBILE_VIEW = [95, 205, 1255, 480];   /* no labels, so it can be tighter */

  var R_END = 26;         /* radius a dot settles at before it morphs   */
  var STAG = 0.26;        /* spread of the per-territory start times    */
  var IN_START = -0.42;   /* dots start flying this far before the hold */
  var IN_LEN = 0.86;      /* … and are fully formed this far after it   */

  var svg = root.querySelector(".idmap__svg");
  var gZoom = root.querySelector(".idmap__zoom");
  var gGeo = root.querySelector(".idmap__geo");
  var gPills = root.querySelector(".idmap__pills");
  var listEl = root.querySelector(".idmap__list");
  var panel = root.querySelector(".idmap__panel");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var view = "full";       /* "full" | "java"                        */
  var zoomState = { k: 1, x: 0, y: 0 };
  var started = false;     /* intro finished — hover/click are live   */
  var ready = false;
  var hot = null, selected = null;
  var cancelAnim = null;
  var lastQ = -1;
  var pillsOn = true;

  /* ---------------------------------------------------------------- utils */

  function el(t, a) {
    var e = document.createElementNS(NS, t);
    for (var k in a) e.setAttribute(k, a[k]);
    return e;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function avg(list, get) {
    var s = 0;
    for (var i = 0; i < list.length; i++) s += get(list[i]);
    return list.length ? s / list.length : 0;
  }
  var easeO = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeIO = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  function slug(c) {
    return "id." + c.s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  /* closed Catmull-Rom -> cubic bezier: this is what rounds the territories */
  function smoothPath(pts) {
    var n = pts.length;
    if (n < 3) return "";
    var d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += "C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + "," + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) +
           " " + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + "," + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) +
           " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return d + "Z";
  }
  function circlePts(cx, cy, r, n, ref) {
    /* phase-aligned to the shape's own first point so the morph doesn't twist */
    var a0 = ref ? Math.atan2(ref[1] - cy, ref[0] - cx) : -Math.PI / 2;
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = a0 + i / n * Math.PI * 2;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return out;
  }
  function circlePath(cx, cy, r, n) { return smoothPath(circlePts(cx, cy, r, n, null)); }

  /* a rAF that gives up and runs on a timer if the tab is throttled */
  function schedule(fn) {
    var used = false;
    var raf = requestAnimationFrame(function (t) { if (!used) { used = true; clearTimeout(to); fn(t); } });
    var to = setTimeout(function () {
      if (!used) { used = true; cancelAnimationFrame(raf); fn(performance.now()); }
    }, 80);
    return function () { used = true; cancelAnimationFrame(raf); clearTimeout(to); };
  }

  /* ---------------------------------------------------------------- build */

  var T = D.terr.map(function (g) {
    var parts = g.p.map(function (p) {
      var pts = [];
      for (var i = 0; i < p.d.length; i += 2) pts.push([p.d[i], p.d[i + 1]]);
      return { pts: pts, c: p.c };
    });
    return {
      c: D.chapters[g.i], ci: g.i, parts: parts,
      cx: g.x, cy: g.y, small: !!g.sm, rad: g.r,
      el: null, pillEl: null, rowEl: null
    };
  });

  var JAVA = T.filter(function (t) { return t.c.j; });

  T.forEach(function (t) {
    var p = el("path", { "fill-rule": "evenodd", fill: "none" });
    t.el = p;
    gGeo.appendChild(p);
    p.addEventListener("mouseenter", function () { if (started) setHot(t.ci); });
    p.addEventListener("mouseleave", function () { if (started && selected === null) setHot(null); });
    p.addEventListener("click", function (e) { e.stopPropagation(); if (started) pick(t.ci); });
  });
  /* Java last so its thin territories stay hittable once zoomed */
  JAVA.forEach(function (t) { gGeo.appendChild(t.el); });

  /* the same chapters as a real list — offscreen on desktop, the whole
     interface on mobile, and the only keyboard route in on either */
  T.slice().sort(function (a, b) { return b.c.m - a.c.m; }).forEach(function (t) {
    var li = document.createElement("li");
    var b = document.createElement("button");
    b.type = "button";
    b.className = "idmap__row";
    b.innerHTML = '<span class="idmap__row-name"></span><span class="idmap__row-n"></span>';
    b.querySelector(".idmap__row-name").textContent = slug(t.c);
    b.querySelector(".idmap__row-n").textContent = t.c.m + " members";
    b.addEventListener("click", function () { pickRow(t.ci); });
    b.addEventListener("focus", function () { if (started) setHot(t.ci); });
    li.appendChild(b);
    listEl.appendChild(li);
    t.rowEl = b;
  });

  /* 38 rows is a long way down a phone, so the list opens on the biggest few.
     The cap is a CSS rule inside the compact breakpoint only — on desktop the
     list stays whole, because there it is the keyboard's way through the map. */
  var more = document.createElement("button");
  more.type = "button";
  more.className = "idmap__more";
  more.setAttribute("aria-controls", "idmap-list");
  listEl.id = "idmap-list";
  listEl.parentNode.insertBefore(more, listEl.nextSibling);

  function setCollapsed(v) {
    listEl.setAttribute("data-collapsed", String(v));
    more.setAttribute("aria-expanded", String(!v));
    more.textContent = v ? "Show all " + T.length + " chapters" : "Show fewer";
  }
  more.addEventListener("click", function () {
    setCollapsed(listEl.getAttribute("data-collapsed") !== "true");
  });
  setCollapsed(true);

  function bboxOf(list) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    list.forEach(function (t) {
      t.parts.forEach(function (p) {
        p.pts.forEach(function (q) {
          if (q[0] < x0) x0 = q[0];
          if (q[0] > x1) x1 = q[0];
          if (q[1] < y0) y0 = q[1];
          if (q[1] > y1) y1 = q[1];
        });
      });
    });
    return [x0, y0, x1, y1];
  }
  var JAVA_BOX = bboxOf(JAVA);

  /* ------------------------------------------------------------- viewport */

  var VX, VY, VW, VH, ZOOM;

  function applyView() {
    var v = pillsOn ? VIEW : MOBILE_VIEW;
    VX = v[0]; VY = v[1]; VW = v[2]; VH = v[3];
    svg.setAttribute("viewBox", VX + " " + VY + " " + VW + " " + VH);

    /* fit Java into the frame, leaving the margins its two label rows and the
       back control need */
    var jw = JAVA_BOX[2] - JAVA_BOX[0], jh = JAVA_BOX[3] - JAVA_BOX[1];
    var k = Math.min((VW - VW * 0.30) / jw, (VH - VH * 0.45) / jh);
    ZOOM = {
      k: k,
      x: (VX + VW / 2) - k * (JAVA_BOX[0] + JAVA_BOX[2]) / 2,
      y: (VY + VH / 2) - k * (JAVA_BOX[1] + JAVA_BOX[3]) / 2
    };
    if (view === "java") {
      zoomState = { k: ZOOM.k, x: ZOOM.x, y: ZOOM.y };
      gZoom.setAttribute("transform",
        "translate(" + ZOOM.x.toFixed(2) + " " + ZOOM.y.toFixed(2) + ") scale(" + ZOOM.k.toFixed(4) + ")");
    }
  }

  function readMode() {
    /* pills carry 11px labels in user units; below the desktop breakpoint the
       stage is too small for 38 of them to be readable, so the list takes over */
    pillsOn = window.matchMedia("(min-width: 900px)").matches;
    root.classList.toggle("idmap--compact", !pillsOn);
  }

  readMode();
  applyView();

  /* ------------------------------------------------------------- intro */

  function reseed(t) {
    var a = Math.random() * 6.283, d = 0.72 + Math.random() * 0.6;
    t.seed = { x: VX + VW / 2 + Math.cos(a) * VW * 1.15 * d, y: VY + VH / 2 + Math.sin(a) * VH * 1.4 * d };
    t.r0 = R_END * (1.7 + Math.random() * 2.3);
    t.b0 = t.r0 * 0.24;
    t.dl = Math.random() * STAG;
  }
  T.forEach(reseed);

  function setFinal(t) {
    t.el.style.filter = "";
    t.el.style.stroke = "";
    t.el.style.strokeOpacity = "";
    t.el.style.strokeWidth = "";
    t.el.setAttribute("d", t.parts.map(function (p) { return smoothPath(p.pts); }).join(""));
    t.el.setAttribute("opacity", 1);
  }

  function setIntro(q) {
    q = clamp(q, 0, 1);
    /* the fly-in is the largest movement on the page; asked to tone motion
       down, the map simply arrives built */
    if (reduced) q = q > 0.05 ? 1 : 0;
    if (q === lastQ) return;
    lastQ = q;

    if (q >= 1) {
      if (!ready) { T.forEach(setFinal); ready = true; started = true; layoutPills(); }
      return;
    }
    if (ready) {
      ready = false; started = false; closePanel();
      if (cancelAnim) { cancelAnim(); cancelAnim = null; }
      if (view !== "full") { view = "full"; applyFills(); zoomState = { k: 1, x: 0, y: 0 }; gZoom.removeAttribute("transform"); }
    }
    gPills.style.opacity = 0;

    for (var i = 0; i < T.length; i++) {
      var t = T[i];
      var local = clamp((q - t.dl) / (1 - STAG), 0, 1);
      var fp = clamp(local / 0.58, 0, 1);          /* fly in            */
      var mp = clamp((local - 0.64) / 0.36, 0, 1);  /* then morph        */
      var f = easeO(fp);
      var cx = t.seed.x + (t.cx - t.seed.x) * f;
      var cy = t.seed.y + (t.cy - t.seed.y) * f;
      var rr = t.r0 + (R_END - t.r0) * f;
      var b = t.b0 * Math.pow(1 - fp, 1.35);

      t.el.style.filter = b > 0.25 ? "blur(" + b.toFixed(2) + "px)" : "";
      /* dots arrive white and bleed into the map's purple outline as they morph */
      var cm = easeIO(mp);
      t.el.style.stroke = "rgb(" + Math.round(255 + (138 - 255) * cm) + "," +
                                    Math.round(255 + (92 - 255) * cm) + "," +
                                    Math.round(255 + (240 - 255) * cm) + ")";
      t.el.style.strokeOpacity = (1 - 0.32 * cm).toFixed(3);
      t.el.style.strokeWidth = (3.2 - 1.85 * f).toFixed(2) + "px";
      t.el.setAttribute("opacity", fp < 0.3 ? (0.24 + 0.76 * fp / 0.3).toFixed(3) : 1);

      if (mp <= 0) {
        t.el.setAttribute("d", circlePath(cx, cy, rr, t.parts[0].pts.length));
      } else {
        var d = "";
        for (var j = 0; j < t.parts.length; j++) {
          var pt = t.parts[j];
          if (j === 0) {
            var ci = circlePts(cx, cy, rr, pt.pts.length, pt.pts[0]);
            d += smoothPath(pt.pts.map(function (p, n) {
              return [ci[n][0] + (p[0] - ci[n][0]) * cm, ci[n][1] + (p[1] - ci[n][1]) * cm];
            }));
          } else {
            var s = clamp((cm - 0.45) / 0.55, 0, 1);
            if (s <= 0) continue;
            d += smoothPath(pt.pts.map(function (p) {
              return [pt.c[0] + (p[0] - pt.c[0]) * s, pt.c[1] + (p[1] - pt.c[1]) * s];
            }));
          }
        }
        t.el.setAttribute("d", d);
      }
    }
  }

  /* ---------------------------------------------------------------- fills */

  function applyFills() {
    var javaView = view === "java";
    T.forEach(function (t) {
      t.el.classList.toggle("is-merged", !javaView && !!t.c.j);
      t.el.classList.toggle("is-off", javaView && !t.c.j);
      if (t.rowEl) t.rowEl.hidden = javaView && !t.c.j;
    });
  }

  /* ----------------------------------------------------------------- zoom */

  function setZoom(target, done) {
    var from = { k: zoomState.k, x: zoomState.x, y: zoomState.y };
    if (cancelAnim) cancelAnim();
    var t0 = performance.now(), DUR = reduced ? 1 : 850;
    (function frame(now) {
      var p = clamp((now - t0) / DUR, 0, 1), e = easeIO(p);
      zoomState = {
        k: from.k + (target.k - from.k) * e,
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e
      };
      gZoom.setAttribute("transform",
        "translate(" + zoomState.x.toFixed(2) + " " + zoomState.y.toFixed(2) + ") scale(" + zoomState.k.toFixed(4) + ")");
      if (p < 1) cancelAnim = schedule(frame);
      else { cancelAnim = null; if (done) done(); }
    })(t0);
  }

  function setView(v) {
    if (v === view) return;
    view = v;
    closePanel();
    gPills.style.opacity = 0;
    applyFills();
    root.classList.toggle("idmap--java", v === "java");
    setZoom(v === "java" ? ZOOM : { k: 1, x: 0, y: 0 }, layoutPills);
  }

  /* ---------------------------------------------------------------- pills */

  function layoutPills() {
    gPills.textContent = "";
    if (!pillsOn) { gPills.style.opacity = 0; return; }

    var items = [];
    function mk(text, cx, cy, ci, big, fixed) {
      var g = el("g", { class: "idmap__pill" + (big ? " is-big" : "") });
      var h = big ? 46 : 22;
      var r = el("rect", { rx: h / 2, height: h, x: 0, y: 0 });
      var tx = el("text", { x: 0, y: 0 });
      tx.textContent = text;
      g.appendChild(r); g.appendChild(tx);
      gPills.appendChild(g);
      var w = tx.getBBox().width + (big ? 52 : 22);
      items.push({ g: g, r: r, tx: tx, w: w, h: h, cx: cx, cy: cy, ax: cx, ay: cy, ci: ci, big: big, fixed: fixed });
    }
    function P(x, y) { return [x * zoomState.k + zoomState.x, y * zoomState.k + zoomState.y]; }

    var javaMidY = avg(JAVA, function (t) { return t.cy; });
    function anchorOf(t) {
      var p = P(t.cx, t.cy);
      if (view === "java") {
        /* label hugs its own shape: northern chapters above it, southern below,
           so the thin strip doesn't collapse into one cramped band */
        var a = 1e9, b = -1e9;
        t.parts.forEach(function (q) {
          q.pts.forEach(function (u) { if (u[1] < a) a = u[1]; if (u[1] > b) b = u[1]; });
        });
        var nm = (t.c.s || "").toLowerCase();
        var down = nm === "bogor" || nm === "depok";
        var up = !down && t.cy < javaMidY;
        return [p[0], up ? P(t.cx, a)[1] - 14 : P(t.cx, b)[1] + 14];
      }
      var off = t.small ? t.rad * zoomState.k + 18 : 0;
      return [p[0], p[1] + off];
    }

    if (view === "full") {
      T.filter(function (t) { return !t.c.j; }).forEach(function (t) {
        var a = anchorOf(t); mk(slug(t.c), a[0], a[1], t.ci, false, false);
      });
      var cx = avg(JAVA, function (t) { return t.cx; });
      var cy = avg(JAVA, function (t) { return t.cy; });
      var p = P(cx, cy);
      mk("Java chapters  ↗", p[0], p[1], -1, true, true);
    } else {
      JAVA.forEach(function (t) {
        var a = anchorOf(t); mk(slug(t.c), a[0], a[1], t.ci, false, false);
      });
    }

    function box(it) { return { x: it.cx - it.w / 2, y: it.cy - it.h / 2, w: it.w, h: it.h }; }
    for (var k = 0; k < 600; k++) {
      var moved = false;
      for (var i = 0; i < items.length; i++) {
        for (var j = i + 1; j < items.length; j++) {
          var A = box(items[i]), B = box(items[j]);
          var ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
          var oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
          if (ox > 0 && oy > -3) {
            var a = items[i], b = items[j];
            if (a.fixed && b.fixed) continue;
            var dir = (A.y >= B.y) ? 1 : -1, push = (oy + 3) / 2 + 0.4;
            if (a.fixed) b.cy -= push * 2 * dir;
            else if (b.fixed) a.cy += push * 2 * dir;
            else { a.cy += push * dir; b.cy -= push * dir; }
            moved = true;
          }
        }
      }
      items.forEach(function (it) {
        if (it.fixed) return;
        it.cx = clamp(it.cx, VX + it.w / 2 + 12, VX + VW - it.w / 2 - 12);
        it.cy = clamp(it.cy, VY + VH * 0.06, VY + VH - 18);
        var dy = it.cy - it.ay;
        if (Math.abs(dy) > 90) it.cy = it.ay + 90 * Math.sign(dy);
      });
      if (!moved) break;
    }

    items.forEach(function (it) {
      it.r.setAttribute("x", (it.cx - it.w / 2).toFixed(1));
      it.r.setAttribute("y", (it.cy - it.h / 2).toFixed(1));
      it.r.setAttribute("width", it.w.toFixed(1));
      it.tx.setAttribute("x", it.cx.toFixed(1));
      it.tx.setAttribute("y", (it.cy + (it.big ? 6 : 3.9)).toFixed(1));
      it.tx.setAttribute("text-anchor", "middle");
      if (it.ci >= 0) {
        T[it.ci].pillEl = it.g;
        if (selected === it.ci) it.g.classList.add("is-sel");
        it.g.addEventListener("mouseenter", function () { setHot(it.ci); });
        it.g.addEventListener("mouseleave", function () { if (selected === null) setHot(null); });
        it.g.addEventListener("click", function (e) { e.stopPropagation(); pick(it.ci); });
      } else {
        it.g.addEventListener("click", function (e) { e.stopPropagation(); setView("java"); });
      }
    });

    if (view === "java") {
      var maxY = -1e9;
      JAVA.forEach(function (t) {
        t.parts.forEach(function (p) { p.pts.forEach(function (q) { if (q[1] > maxY) maxY = q[1]; }); });
      });
      var bx = avg(JAVA, function (t) { return t.cx; }) * zoomState.k + zoomState.x;
      /* clear the lower label row so the back control never lands inside it */
      var lowest = items.reduce(function (m, it) { return Math.max(m, it.cy + it.h / 2); },
                                maxY * zoomState.k + zoomState.y);
      var by = clamp(lowest + 52, VY, VY + VH - 40);
      var g = el("g", { class: "idmap__pill is-big is-back" });
      var tx = el("text", { x: 0, y: 0 });
      tx.textContent = "←  back to full map";
      var r = el("rect", { rx: 23, height: 46 });
      g.appendChild(r); g.appendChild(tx);
      gPills.appendChild(g);
      var w = tx.getBBox().width + 52;
      r.setAttribute("x", (bx - w / 2).toFixed(1));
      r.setAttribute("y", (by - 23).toFixed(1));
      r.setAttribute("width", w.toFixed(1));
      tx.setAttribute("x", bx.toFixed(1));
      tx.setAttribute("y", (by + 6).toFixed(1));
      tx.setAttribute("text-anchor", "middle");
      g.addEventListener("click", function (e) { e.stopPropagation(); setView("full"); });
    }
    gPills.style.opacity = 1;
  }

  /* ---------------------------------------------------------- interaction */

  function setHot(ci) {
    if (hot === ci) return;
    if (hot != null && T[hot]) {
      T[hot].el.classList.remove("is-hot");
      if (T[hot].pillEl) T[hot].pillEl.classList.remove("is-hot");
    }
    hot = ci;
    T.forEach(function (t) { t.el.classList.toggle("is-dim", ci != null && t.ci !== ci); });
    if (ci == null) return;
    T[ci].el.classList.add("is-hot");
    if (T[ci].pillEl) T[ci].pillEl.classList.add("is-hot");
  }

  var F = {
    name: root.querySelector(".idmap__name"),
    region: root.querySelector(".idmap__region"),
    members: root.querySelector(".idmap__members"),
    biz: root.querySelector(".idmap__biz"),
    pic: root.querySelector(".idmap__pic"),
    sector: root.querySelector(".idmap__sector")
  };

  function pick(ci) {
    /* on the full map, Java is one target: it opens the island instead */
    if (view === "full" && T[ci].c.j && pillsOn) { setView("java"); return; }
    T.forEach(function (x) {
      x.el.classList.remove("is-sel");
      if (x.pillEl) x.pillEl.classList.remove("is-sel");
      if (x.rowEl) x.rowEl.setAttribute("aria-current", "false");
    });
    selected = ci; hot = null; setHot(ci);
    T[ci].el.classList.add("is-sel");
    if (T[ci].pillEl) T[ci].pillEl.classList.add("is-sel");
    if (T[ci].rowEl) T[ci].rowEl.setAttribute("aria-current", "true");

    var c = T[ci].c;
    F.name.textContent = slug(c);
    F.region.textContent = c.r;
    F.members.textContent = c.m;
    F.biz.textContent = c.b;
    F.pic.textContent = c.p;
    F.sector.textContent = c.t;

    /* the sheet opens on the far side from the chapter you picked */
    var sx = T[ci].cx * zoomState.k + zoomState.x;
    panel.classList.remove("is-left", "is-right");
    panel.classList.add(sx < VX + VW / 2 ? "is-right" : "is-left");
    panel.classList.add("is-on");
    panel.setAttribute("aria-hidden", "false");
  }

  /* the list is the map's keyboard and small-screen route in, so it selects
     a Java chapter outright rather than bouncing into the island view */
  function pickRow(ci) {
    if (pillsOn && view === "full" && T[ci].c.j) {
      setView("java");
      setTimeout(function () { pick(ci); }, 300);
      return;
    }
    pick(ci);
  }

  function closePanel() {
    panel.classList.remove("is-on", "is-left", "is-right");
    panel.setAttribute("aria-hidden", "true");
    T.forEach(function (t) {
      t.el.classList.remove("is-sel");
      if (t.pillEl) t.pillEl.classList.remove("is-sel");
      if (t.rowEl) t.rowEl.setAttribute("aria-current", "false");
    });
    selected = null;
    setHot(null);
  }

  root.querySelector(".idmap__close").addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && selected !== null) closePanel(); });
  svg.addEventListener("click", function (e) { if (e.target === svg) closePanel(); });

  applyFills();
  root.classList.add("is-ready");   /* the no-script fallback stands down */

  /* --------------------------------------------------------------- drive */

  /* deck.js publishes ID.deck on DOMContentLoaded, so the choice of timeline
     has to wait for it — everything above only needs the markup, which is
     already parsed by the time this script runs */
  function drive() {
    var section = document.getElementById("map");
    var deck = window.ID && window.ID.deck;
    var slideIndex = deck ? deck.indexOf(section) : -1;

    /* the deck stands down on narrow screens, so both timelines are wired and
       each one checks whose turn it is */
    function onDeck() { return !!(deck && deck.live()) && slideIndex >= 0; }

    if (deck && slideIndex >= 0 && window.ID.onTick) {
      /* scroll position through the slide's hold is the animation's timeline */
      var read = function () {
        if (onDeck()) setIntro((deck.slideScroll(slideIndex) - IN_START) / IN_LEN);
      };
      window.ID.onTick(read);
      read();
    }

    if ("IntersectionObserver" in window) {
      /* stacked layout: play it once on the way in */
      var playing = null;
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting || onDeck() || ready || playing) return;
          if (reduced) { setIntro(1); return; }
          var t0 = performance.now(), DUR = 2200;
          playing = requestAnimationFrame(function frame(now) {
            var q = (now - t0) / DUR;
            setIntro(q);
            playing = q < 1 ? requestAnimationFrame(frame) : null;
          });
        });
      }, { threshold: 0.15 }).observe(section);
    } else if (!onDeck()) {
      setIntro(1);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", drive, { once: true });
  } else {
    drive();
  }

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var was = pillsOn;
      readMode();
      applyView();
      if (was !== pillsOn && view === "java") setView("full");
      if (ready) layoutPills();
    }, 160);
  });

  window.ID = window.ID || {};
  window.ID.map = { pick: pick, close: closePanel, setView: setView, chapters: T };
})();
