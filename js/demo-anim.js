/* ============================================================
   Demo animation — the card-grid animation that plays in the
   middle of the intro. Called the DEMO animation (not the "intro
   animation") so it is never confused with the intro SECTION's own
   state-to-state transitions, which js/scenes-intro.js owns.

   Extracted verbatim (construction + render math unchanged) from
   claude-handover/intro-animation/index.html, a built, dependency-
   free standalone demo. Only three things were stripped from the
   source:
     - the rAF clock (the `start` var and `frame()` loop),
     - the click-to-replay listener,
     - the prefers-reduced-motion branch.
   Motion gating is the host page's job now (see motion-core.js,
   html.motion). Task 3 drives this by calling render(t) directly
   from a scrubbed ScrollTrigger — render(t) was already a pure
   time-to-visual function in the source, which is what makes that
   possible; see task-2-report.md for the purity proof.

   That handoff was incomplete for a while: extraction stripped the
   reduced-motion branch on the assumption the host page would render
   an end state under no motion, but js/scenes-intro.js's early
   V3.ready return skipped DemoAnim.mount entirely, so a no-motion
   visitor got an empty #demoAnim box instead — never this module's
   fault (it does exactly what it's called to do), but worth naming
   here since this exact comment is what someone re-deriving the gap
   would land on. js/scenes-intro.js now mounts unconditionally and
   calls render(END) on the no-motion path, so the job described above
   is actually being done, not just assigned.

   The only structural change is wrapping the source's "runs once
   at page load into a hardcoded #stage" top-level script into a
   mount(el) call, so construction happens on demand into whatever
   element the host page provides, and an equivalent-but-relocated
   inline version of the source's <style> block (previously
   external, scoped to #fit/#stage) since this module owns no
   stylesheet of its own.
   ============================================================ */
(function () {
  "use strict";

  /* ── Easing (from animations-v3.jsx) ─────────────────────────────────────── */
  var Easing = {
    easeOutQuart:   function (t) { return 1 - Math.pow(1 - t, 4); },
    easeInOutCubic: function (t) {
      return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    },
    easeOutBack: function (t) {
      var c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
  };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /* animate({from,to,start,end,ease})(t), flattened to one call */
  function tween(from, to, start, end, ease, t) {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  }
  function ENTER(f, to, s, e, t) { return tween(f, to, s, e, Easing.easeOutQuart, t); }
  function DRAW(f, to, s, e, t)  { return tween(f, to, s, e, Easing.easeInOutCubic, t); }
  function POP(f, to, s, e, t)   { return tween(f, to, s, e, Easing.easeOutBack, t); }

  /* ── Tokens & geometry ───────────────────────────────────────────────────── */
  var TOK = {
    ink900: '#181818', green: '#2E332F', ink500: '#767676',
    grey02: '#D6D6D6', grey01: '#FAFAFA',
  };

  var MW = 168, MH = 112, PX = 192, PY = 136, ROWS = 2;
  var PER = 2 * (MW + MH);
  var STAGE_W = 1200, STAGE_H = 400;

  var SPARK = 'm13.928 6.072-2.053-.76 2.053-.76.76-2.052.76 2.053 2.052.76-2.053.76-.76 2.052-.76-2.053Zm-6.409 6.409L2.5 10.625l5.019-1.857L9.375 3.75l1.856 5.018 5.019 1.857-5.019 1.856L9.375 17.5l-1.856-5.019Z';

  /* Scene timeline — mirrors window.OM_SCENES in the .dc.html.
     No `nat` overrides, so authored time == play time. */
  var SCENES = [
    { name: 'Build', dur: 3 },   // construction lines up, one module drawn + dimensioned
    { name: 'Hold',  dur: 1 },   // the finished module holds
    { name: 'Scale', dur: 3.4 }, // sparks fire, the module multiplies, an AI pass polishes
  ];
  var CUES = {}, _acc = 0;
  for (var si = 0; si < SCENES.length; si++) { CUES[SCENES[si].name] = _acc; _acc += SCENES[si].dur; }
  var TOTAL = _acc;               // 7.4s
  var END = CUES.Scale + 3.4;     // 7.4s
  var HOLD_AFTER = 1.4;           // beat the source held on the finished field before looping;
                                   // unused now that the loop itself is gone, kept for fidelity.

  /* Twelve layouts off one system: 16px margins, 4pt grid, bars at 10 / 6,
     one solid accent mark each. Index 0 is the module built by hand in phase 1. */
  var LAYOUTS = [
    [['h', 16, 16, 70, 10], ['b', 16, 44, 104, 6], ['b', 16, 58, 74, 6], ['a', 124, 68, 28, 28]],
    [['h', 16, 16, 52, 10], ['b', 16, 40, 100, 6], ['b', 16, 54, 84, 6], ['b', 16, 68, 60, 6], ['a', 132, 16, 20, 20]],
    [['a', 16, 16, 24, 24], ['h', 48, 23, 80, 10], ['b', 16, 56, 120, 6], ['b', 16, 70, 96, 6]],
    [['h', 16, 16, 96, 10], ['k', 16, 36, 136, 28], ['b', 16, 74, 80, 6], ['a', 136, 74, 16, 16]],
    [['b', 16, 16, 56, 6], ['b', 96, 16, 56, 6], ['b', 16, 30, 40, 6], ['b', 96, 30, 48, 6], ['h', 16, 52, 70, 10], ['a', 124, 76, 28, 20]],
    [['h', 16, 16, 40, 10], ['b', 16, 38, 136, 6], ['b', 16, 52, 136, 6], ['b', 16, 66, 104, 6], ['a', 128, 86, 24, 10]],
    [['a', 16, 16, 136, 8], ['h', 16, 34, 88, 10], ['b', 16, 58, 104, 6], ['b', 16, 72, 68, 6]],
    [['h', 16, 16, 64, 10], ['a', 16, 38, 32, 32], ['b', 56, 42, 84, 6], ['b', 56, 56, 68, 6], ['b', 16, 82, 48, 6]],
    [['b', 16, 16, 120, 6], ['b', 16, 28, 96, 6], ['h', 16, 48, 76, 10], ['a', 16, 72, 20, 20], ['b', 44, 79, 56, 6]],
    [['h', 16, 16, 108, 10], ['b', 16, 42, 72, 6], ['b', 16, 56, 128, 6], ['b', 16, 70, 88, 6], ['a', 128, 88, 24, 8]],
    [['k', 16, 16, 136, 32], ['h', 16, 60, 60, 10], ['b', 16, 80, 92, 6], ['a', 132, 76, 20, 20]],
    [['h', 16, 16, 80, 10], ['b', 16, 38, 64, 6], ['b', 16, 52, 112, 6], ['a', 16, 68, 24, 24], ['b', 48, 77, 56, 6]],
  ];

  /* ── Colour mixing ───────────────────────────────────────────────────────── */
  function hx(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function mix(a, b, t) {
    var A = hx(a), B = hx(b), k = clamp(t, 0, 1);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * k) + ',' +
                    Math.round(A[1] + (B[1] - A[1]) * k) + ',' +
                    Math.round(A[2] + (B[2] - A[2]) * k) + ')';
  }

  /* ── DOM helpers ─────────────────────────────────────────────────────────── */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, style, parent) {
    var n = document.createElement(tag);
    n.style.boxSizing = 'border-box'; // was `#stage div { box-sizing: border-box }`
    if (style) for (var k in style) n.style[k] = style[k];
    if (parent) parent.appendChild(n);
    return n;
  }
  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* A sparkle: 20x20 glyph, centred on (x, y), scaled and rotated per frame. */
  function makeSparkle(parent, color) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('width', 20);
    s.setAttribute('height', 20);
    s.setAttribute('viewBox', '0 0 20 20');
    s.style.position = 'absolute';
    s.style.display = 'block';
    s.style.transformOrigin = '50% 50%';
    svgEl('path', { d: SPARK, fill: color || TOK.ink900 }, s);
    parent.appendChild(s);
    return {
      node: s,
      set: function (x, y, op, sc, rot) {
        if (!(op > 0.004)) { s.style.opacity = 0; s.style.visibility = 'hidden'; return; }
        s.style.visibility = 'visible';
        s.style.left = (x - 10) + 'px';
        s.style.top = (y - 10) + 'px';
        s.style.opacity = op;
        s.style.transform = 'scale(' + sc + ') rotate(' + rot + 'deg)';
      },
    };
  }

  /* ── Scene-graph state, populated by mount() ─────────────────────────────── */
  var stage, field, mods;
  var fx, fy, ocx, ocy, fieldW, fieldH, oc, or_;
  var gv1, gv2, gh1, gh2, specHBox, specVBox;
  var burst1, burst2, burst3, passLine, passHead;

  /* ── Build the scene graph once, then mutate it per frame ────────────────── */
  function build(host) {
    while (host.firstChild) host.removeChild(host.firstChild);

    /* was the standalone demo's #fit — a flex-centred viewport wrapper.
       Here it centres the stage inside whatever element mount() was given,
       instead of being fixed to the whole browser viewport. */
    var fit = el('div', {
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }, host);

    /* was the standalone demo's #stage, previously styled via external CSS */
    stage = el('div', {
      position: 'relative', width: STAGE_W + 'px', height: STAGE_H + 'px',
      flexShrink: '0', overflow: 'hidden', transformOrigin: 'center center',
      background: '#FFFFFF',
    }, fit);

    var params = new URLSearchParams(location.search);
    var COLS = clamp(Math.round(+params.get('cols') || 6), 3, 8);
    var SURFACE = params.get('surface') || '#FFFFFF';
    stage.style.background = SURFACE;

    oc = Math.min(2, COLS - 1); or_ = 0;               // origin column / row
    fieldW = COLS * PX - (PX - MW); fieldH = ROWS * PY - (PY - MH);
    fx = (STAGE_W - fieldW) / 2; fy = (STAGE_H - fieldH) / 2;
    ocx = oc * PX + MW / 2; ocy = or_ * PY + MH / 2;

    var viewport = el('div', { position: 'absolute', inset: '0', overflow: 'hidden' }, stage);
    field = el('div', {
      position: 'absolute', left: fx + 'px', top: fy + 'px',
      width: fieldW + 'px', height: fieldH + 'px',
      transformOrigin: ocx + 'px ' + ocy + 'px',
    }, viewport);

    /* Modules */
    mods = [];
    var v = 0;
    for (var r = 0; r < ROWS; r++) {
      for (var col = 0; col < COLS; col++) {
        var isOrigin = (col === oc && r === or_);
        var layout = isOrigin ? 0 : (1 + (v++) % (LAYOUTS.length - 1));

        var box = el('div', {
          position: 'absolute', left: (col * PX) + 'px', top: (r * PY) + 'px',
          width: MW + 'px', height: MH + 'px',
        }, field);

        var bsvg = document.createElementNS(SVGNS, 'svg');
        bsvg.setAttribute('width', MW);
        bsvg.setAttribute('height', MH);
        bsvg.style.position = 'absolute';
        bsvg.style.left = '0'; bsvg.style.top = '0'; bsvg.style.display = 'block';
        var rect = svgEl('rect', {
          x: 0.75, y: 0.75, width: MW - 1.5, height: MH - 1.5,
          fill: 'none', 'stroke-width': 1.5, 'stroke-dasharray': PER,
        }, bsvg);
        box.appendChild(bsvg);

        var items = [];
        for (var i = 0; i < LAYOUTS[layout].length; i++) {
          var it = LAYOUTS[layout][i];
          items.push({
            kind: it[0], w: it[3],
            node: el('div', {
              position: 'absolute', left: it[1] + 'px', top: it[2] + 'px',
              height: it[4] + 'px', transformOrigin: '50% 50%',
            }, box),
          });
        }

        mods.push({
          box: box, rect: rect, items: items, layout: layout, isOrigin: isOrigin,
          col: col, row: r, cx: col * PX + MW / 2, cy: r * PY + MH / 2,
        });
      }
    }

    /* Construction guides around the origin module */
    var VGRAD = 'linear-gradient(180deg, rgba(214,214,214,0) 0%, #D6D6D6 20%, #D6D6D6 80%, rgba(214,214,214,0) 100%)';
    var HGRAD = 'linear-gradient(90deg, rgba(214,214,214,0) 0%, #D6D6D6 20%, #D6D6D6 80%, rgba(214,214,214,0) 100%)';
    gv1 = el('div', { position: 'absolute', left: (oc * PX - 1) + 'px', top: (or_ * PY + MH / 2 - 105) + 'px', width: '1px', height: '210px', background: VGRAD }, field);
    gv2 = el('div', { position: 'absolute', left: (oc * PX + MW) + 'px', top: (or_ * PY + MH / 2 - 105) + 'px', width: '1px', height: '210px', background: VGRAD }, field);
    gh1 = el('div', { position: 'absolute', left: (oc * PX + MW / 2 - 320) + 'px', top: (or_ * PY - 1) + 'px', width: '640px', height: '1px', background: HGRAD }, field);
    gh2 = el('div', { position: 'absolute', left: (oc * PX + MW / 2 - 320) + 'px', top: (or_ * PY + MH) + 'px', width: '640px', height: '1px', background: HGRAD }, field);

    /* Dimension marks — width below, height to the right */
    specHBox = el('div', { position: 'absolute', left: (oc * PX) + 'px', top: (or_ * PY + MH + 14) + 'px', height: '9px' }, field);
    el('div', { position: 'absolute', left: '0', top: '4px', width: '100%', height: '1px', background: TOK.ink500 }, specHBox);
    el('div', { position: 'absolute', left: '0', top: '0', width: '1px', height: '9px', background: TOK.ink500 }, specHBox);
    el('div', { position: 'absolute', right: '0', top: '0', width: '1px', height: '9px', background: TOK.ink500 }, specHBox);

    specVBox = el('div', { position: 'absolute', left: (oc * PX + MW + 14) + 'px', top: (or_ * PY) + 'px', width: '9px' }, field);
    el('div', { position: 'absolute', left: '4px', top: '0', width: '1px', height: '100%', background: TOK.ink500 }, specVBox);
    el('div', { position: 'absolute', left: '0', top: '0', width: '9px', height: '1px', background: TOK.ink500 }, specVBox);
    el('div', { position: 'absolute', left: '0', bottom: '0', width: '9px', height: '1px', background: TOK.ink500 }, specVBox);

    /* Burst sparkles off the origin module */
    burst1 = makeSparkle(field); burst2 = makeSparkle(field); burst3 = makeSparkle(field);

    /* The AI pass: a sweep line, a spark at each module it crosses, and its head */
    passLine = el('div', {
      position: 'absolute', top: '-22px', width: '1px',
      height: (fieldH + 44) + 'px', background: TOK.grey02,
    }, field);
    for (var m = 0; m < mods.length; m++) {
      mods[m].spark = mods[m].isOrigin ? null : makeSparkle(field);
    }
    passHead = makeSparkle(field);
  }

  /* ── Per-frame render ────────────────────────────────────────────────────── */
  function render(T) {
    /* Camera: pull back from the origin module to the whole field, then drift */
    var pull0 = CUES.Scale - 0.1, pull1 = CUES.Scale + 1.5;
    var cam = DRAW(1.6, 1, pull0, pull1, T) + DRAW(0, 0.035, CUES.Scale + 1.6, END + 0.1, T);
    var cdx = DRAW(600 - fx - ocx, 0, pull0, pull1, T);
    var cdy = DRAW(200 - fy - ocy, 0, pull0, pull1, T) + DRAW(0, -3, CUES.Scale + 1.6, END + 0.1, T);
    field.style.transform = 'translate(' + cdx + 'px,' + cdy + 'px) scale(' + cam + ')';

    var passX  = DRAW(-80, fieldW + 80, CUES.Scale + 1.9, END - 0.1, T);
    var passOp = ENTER(0, 1, CUES.Scale + 1.75, CUES.Scale + 2.1, T);

    /* Construction lines fade up, then out once the field starts to grow */
    var fade = 1 - ENTER(0, 1, CUES.Hold + 0.4, CUES.Scale + 0.5, T);
    gv1.style.opacity = ENTER(0, 1, 0.1, 0.85, T) * fade;
    gv2.style.opacity = ENTER(0, 1, 0.2, 0.95, T) * fade;
    gh1.style.opacity = ENTER(0, 1, 0.3, 1.05, T) * fade;
    gh2.style.opacity = ENTER(0, 1, 0.4, 1.15, T) * fade;

    var specOp = ENTER(0, 1, 2.4, 2.85, T) * (1 - ENTER(0, 1, CUES.Scale + 0.1, CUES.Scale + 0.8, T));
    var specW  = DRAW(0, 1, 2.4, 2.75, T);
    var specH  = DRAW(0, 1, 2.55, 2.9, T);
    specHBox.style.opacity = specOp; specHBox.style.width  = (MW * specW) + 'px';
    specVBox.style.opacity = specOp; specVBox.style.height = (MH * specH) + 'px';

    var breath = DRAW(0, 1, CUES.Hold, CUES.Hold + 0.9, T) - DRAW(0, 1, CUES.Hold + 0.9, CUES.Scale + 0.2, T);

    var burst   = ENTER(0, 1, CUES.Scale - 0.05, CUES.Scale + 0.85, T);
    var burstOp = Math.sin(Math.PI * clamp(burst, 0, 1));
    burst1.set(ocx + 96,  ocy - 62, burstOp,        0.6 + 0.9 * burst,  40 * burst);
    burst2.set(ocx + 122, ocy - 20, burstOp * 0.8,  0.4 + 0.6 * burst, -30 * burst);
    burst3.set(ocx + 78,  ocy + 24, burstOp * 0.6,  0.3 + 0.5 * burst,  60 * burst);

    for (var n = 0; n < mods.length; n++) {
      var M = mods[n];
      var on, bp, alpha, tx, ty, g = [];

      if (M.isOrigin) {
        /* Drawn by hand: border first, then contents, accent chip pops last */
        on = 1;
        for (var i = 0; i < LAYOUTS[0].length; i++) {
          var a0 = 1.12 + i * 0.34;
          g.push(i === LAYOUTS[0].length - 1
            ? POP(0, 1, a0, a0 + 0.5, T) * (1 + 0.03 * breath)
            : ENTER(0, 1, a0, a0 + 0.38, T));
        }
        bp = DRAW(0, 1, 0.35, 1.3, T); alpha = 1; tx = 0; ty = 0;
      } else {
        /* Multiplied outward from the origin, then brought up to spec */
        on = clamp((passX - M.cx) / 44, 0, 1);
        var d  = Math.abs(M.col - oc) + Math.abs(M.row - or_) * 1.35;
        var st = CUES.Scale + 0.32 + d * 0.22;
        for (var j = 0; j < LAYOUTS[M.layout].length; j++) {
          g.push(ENTER(0, 1, st + 0.16 + j * 0.05, st + 0.62 + j * 0.05, T));
        }
        bp    = ENTER(0, 1, st, st + 0.5, T);
        alpha = ENTER(0, 1, st, st + 0.4, T);
        tx    = ENTER((oc - M.col) * PX * 0.3, 0, st, st + 0.65, T);
        ty    = ENTER((or_ - M.row) * PY * 0.3, 0, st, st + 0.65, T);

        var hit = Math.max(0, 1 - Math.abs(passX - M.cx) / 70);
        M.spark.set(M.cx + 52, M.cy - 34, hit * alpha, 0.7 + 0.5 * hit, -20 + 60 * hit);
      }

      M.box.style.opacity = alpha;
      M.box.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
      M.rect.style.stroke = M.isOrigin ? TOK.ink900 : mix(TOK.grey02, TOK.ink900, on);
      M.rect.setAttribute('stroke-dashoffset', PER * (1 - bp));

      for (var k = 0; k < M.items.length; k++) {
        var item = M.items[k], kind = item.kind, gk = g[k] || 0;
        var colr = kind === 'h' ? mix(TOK.grey02, TOK.green,  on)
                 : kind === 'b' ? mix(TOK.grey02, TOK.ink500, on)
                 : kind === 'k' ? mix(TOK.grey01, TOK.grey02, on)
                 :                mix(TOK.grey02, TOK.ink900, on);
        var grow = kind === 'a' ? 1 : gk;
        item.node.style.width = (item.w * grow) + 'px';
        item.node.style.background = colr;
        item.node.style.transform = kind === 'a' ? 'scale(' + gk + ')' : 'none';
      }
    }

    passLine.style.left = passX + 'px';
    passLine.style.opacity = 0.9 * passOp;
    passHead.set(passX, fieldH / 2, passOp, 1.9, T * 26);
  }

  /* ── Fit the 1200×400 stage into the viewport ────────────────────────────── */
  function fitStage() {
    var pad = window.innerWidth < 700 ? 16 : 48;
    var s = Math.min(
      (window.innerWidth - pad) / STAGE_W,
      (window.innerHeight - pad) / STAGE_H
    );
    stage.style.transform = 'scale(' + Math.max(0.05, s) + ')';
  }

  /* fitStage() sizes to the viewport, which is right for a full-bleed hero and
     wrong for a mounted box. fitTo() scales the 1200x400 stage to fit whatever
     element it was mounted into, and re-fits on resize (see mount() below —
     only ONE of fitStage/fitTo ever runs on resize for a given mount, never
     both, so they cannot race and fight over stage.style.transform).

     transform-origin is "center center", NOT "top left": build()'s own `fit`
     wrapper flex-centers the unscaled 1200x400 stage inside the host (it is
     wider than any realistic host, so it overflows symmetrically before any
     transform is applied). Scaling from "top left" would anchor the shrink
     to that overflowing corner — which sits outside the visible host box —
     and crop the visible frame asymmetrically instead of centring it.
     Scaling from the box's own centre, which already coincides with the
     host's centre thanks to that flex-centering, keeps the result centred
     and fully contained. Verified empirically: see task-3-report.md. */
  function fitTo(host) {
    if (!host || !stage) return;
    var r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var k = Math.min(r.width / STAGE_W, r.height / STAGE_H);
    stage.style.transformOrigin = "center center";
    stage.style.transform = "scale(" + k + ")";
  }

  /* ── Public interface ─────────────────────────────────────────────────────
     mount(el): builds the scene graph into el, sized-to-fit.
     render(t): draws the frame at time t (seconds). Pure in t — see
       task-2-report.md's purity proof for what "pure" means here in
       practice (the visible/painted output is fully history-independent;
       one narrow, inert quirk on invisible sparkle nodes is documented
       there and does not affect any rendered pixel).
     END / TOTAL: both 7.4s for this animation.
     fitTo(host): scales the stage to fit a mounted host box (see above). */
  function mount(hostEl) {
    build(hostEl);
    // mount() is only ever called against a host box in this codebase (the
    // intro's .intro__demo), never full-viewport, so resize is wired to
    // fitTo(hostEl) — the viewport-relative fitStage() is never attached as
    // a listener here, so there is exactly one writer of stage.style.transform
    // over time (Lesson 2). The one-time fitStage() call below only sets a
    // harmless first-paint placeholder immediately overwritten by the
    // caller's own Field.fitTo(hostEl) call straight after mount() returns.
    fitStage();
    window.addEventListener('resize', function () { fitTo(hostEl); });
  }

  window.DemoAnim = { mount: mount, render: render, fitTo: fitTo, END: END, TOTAL: TOTAL };
})();
