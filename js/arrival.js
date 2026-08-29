/* ============================================================
   ARRIVAL — letters coming into the frame from outside it.

   The page does this twice: "SELECTED WORK." assembling at the end
   of the intro (js/headline.js) and the closing CTA headline
   assembling at the bottom (js/scenes-outro.js). Amanda asked for
   the second one explicitly in the first one's terms — "The intro
   animation of the bottom CTA headline should be like the 13
   characters' (the letters scattered everywhere outframe, and
   coming into the frame)" — so it is one piece of code with two
   callers rather than two that have to be kept looking alike.

   What lives here is only what is genuinely the same: splitting a
   line into per-glyph boxes that can be transformed, choosing
   points outside the frame to come in from, and writing one frame
   of the arrival. What does NOT live here is anything either caller
   does on its own — the big headline's watermark/landed states and
   its word change, the CTA's hold-then-release — because sharing
   those would mean one caller carrying flags for the other's
   behaviour, which is how the version before this one ended up
   unmaintainable.

   Nothing here touches GSAP or ScrollTrigger: every function is a
   pure function of a progress number the caller supplies, which is
   what makes tests/arrival.html able to exercise all of it in a
   bare page.
   ============================================================ */
(function () {
  "use strict";

  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$*";

  /* ---------- pure maths ---------- */
  function smoothstep(t) { return t * t * (3 - 2 * t); }

  /**
   * Each glyph's own window inside a shared 0..1 progress, so at any single
   * moment every glyph is at a DIFFERENT point in its own journey — never
   * moving as a block. `landBy` is where the LAST one finishes, leaving the
   * rest of the range for the line to stand there finished.
   */
  function localOf(i, n, p, win, landBy) {
    var start = n > 1 ? (i / n) * (landBy - win) : 0;
    var l = (p - start) / win;
    return l < 0 ? 0 : (l > 1 ? 1 : l);
  }

  /**
   * n start points scattered OUTSIDE the frame — some above it, some below,
   * some to either side.
   *
   * `box` is { w, h, pad }: the viewport's own dimensions, and the largest
   * glyph's largest dimension. pad is what makes "outside the frame" true of
   * the whole glyph rather than of its top-left corner: these points are
   * consumed as top-left corners, so a start of y = -0.15h would leave most
   * of a 230px capital still on screen. Every point returned clears the edge
   * it is behind by at least pad.
   *
   * Each point also carries `d`, a 0..1 "how close to the lens this one
   * started" value. render()'s approach curve uses it to vary how large and
   * how out-of-focus each glyph begins, so the field reads as having depth
   * rather than as one flat wall of letters at a uniform size.
   *
   * The four edges are DEALT from a shuffled deck rather than drawn
   * independently per glyph — an independent draw leaves a whole side of the
   * frame unused often enough to see, and all four sides are the requirement.
   *
   * Deterministic (a plain LCG), never Math.random(): these points are
   * recomputed on every ScrollTrigger refresh, which fires on resize and on
   * webfont load, and a re-roll there would teleport a glyph mid-arrival.
   */
  function scatter(n, box, seed) {
    var r = seed || 1;
    function rnd() { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; }

    var deck = [];
    for (var d = 0; d < n; d++) deck.push(d % 4);
    for (var k = deck.length - 1; k > 0; k--) {
      var j = Math.floor(rnd() * (k + 1));
      var tmp = deck[k]; deck[k] = deck[j]; deck[j] = tmp;
    }

    var pad = box.pad || 0;
    // how far ALONG the edge — deliberately overshooting both corners, so
    // glyphs also arrive from beyond the frame's diagonals
    var along = function (extent) { return extent * (-0.15 + rnd() * 1.3); };
    // how far BEYOND it, on top of the pad that clears it
    var beyond = function (extent) { return pad + extent * (0.05 + rnd() * 0.35); };

    var pts = [];
    for (var i = 0; i < n; i++) {
      var e = deck[i], pt;
      if (e === 0)      pt = { x: along(box.w), y: -beyond(box.h) };          // top
      else if (e === 1) pt = { x: box.w + beyond(box.w), y: along(box.h) };   // right
      else if (e === 2) pt = { x: along(box.w), y: box.h + beyond(box.h) };   // bottom
      else              pt = { x: -beyond(box.w), y: along(box.h) };          // left
      pt.d = rnd();
      pts.push(pt);
    }
    return pts;
  }

  /* ---------- splitting ---------- */

  /**
   * Replace one word element's text with one <span> per character, and hand
   * the spans back. The element itself is left alone — its class, its display
   * and its white-space are the caller's business, and the two callers want
   * different ones (a block per word for the display headline's fixed
   * two-line break, an inline-block per word for the CTA's natural wrapping).
   *
   * The caller must give the word element `white-space: nowrap`. Cells are
   * inline-blocks, and without it the browser is free to break a line BETWEEN
   * two of them — i.e. in the middle of a word.
   */
  function splitWord(wordEl, cellClass) {
    var text = wordEl.textContent;
    var frag = document.createDocumentFragment();
    var cells = [];
    for (var i = 0; i < text.length; i++) {
      var sp = document.createElement("span");
      sp.className = cellClass;
      sp.textContent = text.charAt(i);
      frag.appendChild(sp);
      cells.push(sp);
    }
    wordEl.textContent = "";
    wordEl.appendChild(frag);
    return cells;
  }

  /**
   * Split a plain line of text into word elements and per-glyph cells, with
   * real spaces left between the words as ordinary text nodes so the line
   * still wraps where a line of text should.
   *
   * Returns { words, cells } — cells in reading order across the whole line,
   * which is the order the stagger runs in.
   */
  function splitLine(el, wordClass, cellClass) {
    var parts = el.textContent.split(/(\s+)/);
    var frag = document.createDocumentFragment();
    var words = [], cells = [];

    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "") continue;
      if (/^\s+$/.test(parts[i])) {
        frag.appendChild(document.createTextNode(" "));
        continue;
      }
      var w = document.createElement("span");
      w.className = wordClass;
      w.textContent = parts[i];
      frag.appendChild(w);
      words.push(w);
      cells = cells.concat(splitWord(w, cellClass));
    }

    el.textContent = "";
    el.appendChild(frag);
    return { words: words, cells: cells };
  }

  /* ---------- measuring ---------- */

  /**
   * Read every cell's resting rect and pin its width, then choose where each
   * one arrives from. Fills `home`, `from` and `w` on each cell record.
   *
   * WIDTHS ARE PINNED, and in em rather than px. Pinned because the scramble
   * puts glyphs of every width through these boxes and an unpinned box would
   * relayout the whole line on every frame — which is exactly the defect the
   * display headline was rebuilt to remove. In em because a line whose
   * font-size changes (the display headline's does, by a third, between its
   * two states) would be wrong at one end or the other with a px width.
   *
   * `opts.origin` IS THE FRAME THE FLIGHT HAPPENS IN, and getting it wrong is
   * not a subtle error. Rects come back in viewport coordinates, but the
   * transform written later is a fixed delta between a glyph's home and a
   * point on the SCREEN — so the two have to be expressed in the same frame,
   * and "the screen" only means "the viewport" if the element is at the same
   * viewport position when it is measured as when it flies.
   *
   * That holds for a position: fixed headline and does not hold for a block
   * measured while it is still far down the page and flown later while pinned
   * at the top. Measured on the closing CTA before this existed: every glyph
   * started between 17,462 and 19,157 pixels ABOVE the viewport — the whole
   * document's distance — so all 33 of them streamed in from the top instead
   * of scattering, which is exactly what Amanda reported. Passing the pinned
   * element's own rect as the origin puts the homes in the frame the flight
   * uses.
   *
   * `opts.padScale` widens the off-frame clearance for callers whose glyphs
   * START LARGER than their layout box (see render()'s scaleFrom): a glyph
   * cleared by its own width is still on screen if it is drawn at 2.8x.
   *
   * `cells` is an array of { el } records, which this fills in. Everything is
   * read in ONE pass before anything is written, so no measurement can pick up
   * this function's own output.
   */
  function measure(cells, opts) {
    var fs = opts.fontSize || 1;
    var ox = opts.origin ? opts.origin.x : 0;
    var oy = opts.origin ? opts.origin.y : 0;
    var i;

    for (i = 0; i < cells.length; i++) cells[i].el.style.width = "";

    var rects = [];
    for (i = 0; i < cells.length; i++) rects.push(cells[i].el.getBoundingClientRect());

    var pad = 0;
    for (i = 0; i < rects.length; i++) {
      if (rects[i].width > pad) pad = rects[i].width;
      if (rects[i].height > pad) pad = rects[i].height;
    }
    pad *= (opts.padScale || 1);

    var starts = scatter(cells.length, {
      w: opts.viewW, h: opts.viewH, pad: pad
    }, opts.seed);

    for (i = 0; i < cells.length; i++) {
      cells[i].home = { x: rects[i].left - ox, y: rects[i].top - oy };
      cells[i].w = rects[i].width / fs;
      cells[i].from = starts[i];
      cells[i].d = starts[i].d;
    }
    return { pad: pad };
  }

  /* ---------- one frame ---------- */

  /**
   * Write one frame of the arrival: every cell's transform, opacity, blur and
   * character, as a pure function of `p`.
   *
   * Every property is written for every cell on every call — never skipped
   * because "nothing changed". A value that is only sometimes written is a
   * value that can be stale, and an instant jump (End key, a #hash link, a
   * fast flick) renders none of the frames in between.
   *
   * TWO CURVES, chosen with `opts.curve`.
   *
   * "bell" (the default) rides sin(local * PI) — zero at both ends of a
   * glyph's own window, peaking in the middle. Every glyph is exactly itself,
   * fully opaque and perfectly sharp, both as it leaves and as it lands. This
   * is the display headline's.
   *
   * "in" decays instead: everything is at its maximum when the glyph is
   * furthest out and gone by the time it arrives. With `scaleFrom` above 1
   * that reads as depth — Amanda's description of what she wanted at the
   * bottom of the page: "All the letters are in significantly bigger size
   * first + add more blurry effect before coming into the frame. So, it
   * creates a realistic effect like they are coming from the front of the
   * screen." A glyph starts oversized and badly out of focus, the way a thing
   * near a lens does, and resolves to its real size and edge as it settles
   * back into the line.
   *
   * Under "in" each glyph's own `d` (from scatter) decides how far toward the
   * lens it started, and the SAME number drives both its size and its blur —
   * which is what makes it read as distance rather than as an effect. One flat
   * size for all of them looks like a wall of letters, not a field.
   */
  function render(cells, p, opts) {
    opts = opts || {};
    var n = cells.length;
    if (!n) return;

    var win = opts.win || 0.55;
    var landBy = opts.landBy || 0.78;
    var fadeMin = opts.fadeMin != null ? opts.fadeMin : 0.42;
    var blurMax = opts.blur != null ? opts.blur : 5;
    var scaleFrom = opts.scaleFrom != null ? opts.scaleFrom : 1;
    var approach = opts.curve === "in";
    var rnd = opts.rnd || Math.random;
    var scramble = opts.scramble !== false;

    for (var i = 0; i < n; i++) {
      var c = cells[i];
      if (!c.home || !c.from) continue;

      var l = localOf(i, n, p, win, landBy);
      var e = smoothstep(l);
      // The transform is the delta from where the glyph should be right now
      // to where the browser has already laid it out, so it is exactly zero
      // on landing — there is nothing to unwind and nothing to drift.
      var dx = (c.from.x - c.home.x) * (1 - e);
      var dy = (c.from.y - c.home.y) * (1 - e);

      // k is 0 at the landing under either curve, which is what guarantees a
      // glyph arrives at exactly its own size, opacity and sharpness.
      var k = approach ? (1 - e) : Math.sin(l * Math.PI);
      // How far toward the lens this one started. Flat under "bell", so that
      // curve's output is unchanged to the digit.
      var near = approach ? (0.55 + 0.45 * (c.d != null ? c.d : 0.5)) : 1;
      var scale = 1 + (scaleFrom - 1) * near * k;
      var blur = blurMax * near * k;

      c.el.style.transform = (dx || dy || scale !== 1)
        ? "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + scale.toFixed(3) + ")"
        : "none";
      c.el.style.opacity = (1 - (1 - fadeMin) * k).toFixed(3);
      c.el.style.filter = blur > 0.05 ? "blur(" + blur.toFixed(2) + "px)" : "none";

      if (scramble) {
        var ch = (l <= 0 || l >= 1) ? c.ch : GLYPHS.charAt(Math.floor(rnd() * GLYPHS.length));
        if (c.el.textContent !== ch) c.el.textContent = ch;
      }
    }
  }

  window.Arrival = {
    splitWord: splitWord, splitLine: splitLine,
    scatter: scatter, measure: measure, render: render,
    localOf: localOf, smoothstep: smoothstep, GLYPHS: GLYPHS
  };
})();
