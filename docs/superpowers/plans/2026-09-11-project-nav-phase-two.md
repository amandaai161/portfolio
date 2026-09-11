# Project Page Navbar — Phase Two (Aspire, Kayn, NOBI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the remaining three project pages the same navbar Identity now has — Aspire with two tabs, Kayn and NOBI with three — so all four projects read as one system.

**Architecture:** Unchanged from phase one, and that is the point: `css/pf-projectnav.css`, `js/pf-projectnav.js` and `css/pf-brand.css` are copied to these pages **by reference, not by edit**. Each page gets three (or two) panels, its own fixed chrome and viewport-height maths offset by `--pf-nav-h`, and — for Kayn and NOBI — a brand sub-page that is deliberately simpler than Identity's: a masthead and a flush stack of showcase images, nothing else.

**Tech Stack:** Hand-written HTML/CSS/ES5. No build step. Static files served by the dev server already running.

---

## Global Constraints

- **Localhost only.** Commit locally and **stop**. `git push` is Amanda's call, every time.
- **ES5 only** in JavaScript. No arrow functions, `const`/`let`, template literals, optional chaining.
- **No custom properties on `:root` in shared files.** `--pf-nav-h` is the sole sanctioned exception.
- **The three shared files stay project-agnostic.** If a page needs something only it needs, that belongs in the page's own stylesheet or an inline custom property — never in `pf-projectnav.css`, `pf-projectnav.js` or `pf-brand.css`. Phase one already had to fix one such leak; do not add another.
- **`--pf-nav-h` is `64px` desktop, `52px` at `max-width: 760px`** — Amanda stepped it down from 80/56 after reviewing Identity. Never hard-code either number.
- **The brand ground is one inline value per page**, `--pf-brand-bg` on the brand panel.
- **Images cap at `max-width: 1400px`.** Kayn's and NOBI's showcase files are 2800px wide — 2× assets, so they render at 1400 and stay crisp.
- **Amanda's brief for the Kayn and NOBI brand pages, verbatim:** *"it is simpler than identity. It only needs header, sub heading and the showcase images with no gaps between them."* No block headings, no sub-brand rows, no description columns.
- **Aspire gets two tabs only:** Web design preview and Case study. No brand sub-page.
- **Do not edit `js/pf-outro.js` or `css/master-bridge.css`.** By the end of this plan nothing references them, but the files stay on disk — deleting them is a separate decision and `project_hazen/` is not part of this work.
- **Do not touch any `casestudy/` directory.**

---

## What phase one already proved, so nobody re-derives it

- **The shared JS needs ONE guard for a page with fewer than three tabs, and phase one did not have it.** This plan originally claimed the file worked untouched. That was wrong, and Aspire proved it: `valid()` checks that both a tab *and* a panel exist, but the tab-wiring loop did not — it walked `ORDER` and called `tabs[name].addEventListener` unguarded, so on a page with no brand tab it threw a TypeError mid-IIFE and took everything below it down with it: hash routing, the initial state, `window.PFProjectNav`, and the progress bar. Loud in the console, silent in the UI — a page whose tabs never got listeners just looks inert.
  The fix gates the loop on the predicate that already exists, so "does this sub-page exist on this page" has exactly one definition:
  ```js
  for (i = 0; i < ORDER.length; i++) {
    if (!valid(ORDER[i])) continue;   /* a page need not carry all three */
    (function (name) { ... })(ORDER[i]);
  }
  ```
  Everything else about the two-tab case held as described: `fromHash()` falls back to `"web"` for a `#brand` link, and `forward` still computes correctly from `indexOf` (web 0 → case 2 is forward).
- **The panel mechanism.** Exactly one panel is in the flow; the rest carry `hidden`. `.pf-panel` must never set `transform`, `filter`, `perspective`, `backdrop-filter` or `contain` — each would trap that page's `position: fixed` descendants.
- **`commit()` scrolls to 0 and dispatches a synthetic `resize`** on every switch, which is what lets a page's scroll engine re-measure after being laid out at zero size inside `display: none`.
- **The push transition cannot be observed in this environment.** `document.visibilityState` is stuck `"hidden"` with a frozen `requestAnimationFrame`, and browsers skip view transitions on a hidden document. Its keyframes were proxy-verified in phase one. Do not report it broken and do not spend budget on it.

---

## File Structure

**Modified — per page, and the shape is identical on all three:**

| File | Change |
|---|---|
| `project_<name>/index.html` | Insert the navbar, move `.pf-dock` into it, wrap into panels, delete `.master-bridge`, drop `data-pf-outro`, swap the `pf-outro.js` script tag for `pf-projectnav.js`, add the `<noscript>` fallback, and (Kayn/NOBI) add the brand panel. Drop the `master-bridge.css` `<link>`; add `pf-projectnav.css` and (Kayn/NOBI) `pf-brand.css`. |
| `project_<name>/<its stylesheet>` | Offset its own fixed header and every full-viewport rule by `--pf-nav-h`. |

**Modified — shared, once, in Task 1:** `css/pf-projectnav.css`.

**Not modified:** `js/pf-projectnav.js`, `css/pf-brand.css`, `css/pf-outro.css`, `js/pf-outro.js`, `css/master-bridge.css`, every `casestudy/`, and `project_hazen/`.

Per-page facts, gathered and verified — use these rather than re-deriving them:

| | Own fixed header | Scroll engine | Full-viewport rules to offset | Brand ground | Brand images |
|---|---|---|---|---|---|
| **Aspire** | `.nav` `position:fixed; inset:0 0 auto; z-index:100` (`styles.css:482`) | hand-rolled `scroll.js`; `window.smoothScroll` exposes no tick hook | `.scene__pin` `styles.css:592-602` — sticky `top:0`, `height:100vh/100svh`, **and** `padding-top:var(--nav-h)` which `hero.js` reads back resolved | — (no brand tab) | — |
| **Kayn** | `.masthead` `position:fixed; inset:0 0 auto; z-index:60` (`styles.css:357`) | GSAP ScrollTrigger + Lenis (module-local, not `window.lenis`) | `.hero__stage` `:476`, `.film__stage` `:597`, `.usp` `:666` (`margin-top:-100svh; height:100svh`), `html[data-motion="off"] .hero` `:1098` | `#2A462D` (`--forest`, the ground its own footer sits on) | `images/project_kayn/kayn_showcase_1..6.webp`, 2800px wide |
| **NOBI** | `.nav#nav` `position:fixed; inset:0 0 auto 0; z-index:100` (`css/style.css:193`) | GSAP ScrollTrigger + Lenis (module-local) | `.hero` `:255` `min-height:100svh`; `.hero__vert` `:287` `top:calc(100svh - clamp(180px,20.31vw,390px))` | `#291217` (sampled from Amanda's own `New project nav - Brand NOBI.png`; note it is within a hair of the page's own `--burgundy-ink` `#2B1317`, but her sketch is the spec) | `images/project_nobi/nobi_showcase_1..5.webp`, 2800px wide |

---

## Verification, in place of unit tests

No test runner exists. The loop is the browser. A dev server is already running — **do not start another and do not change its port.** Check what it is and reuse it.

Five confirmed environment quirks. Trust them; re-deriving them has cost prior agents an hour each:

1. `location.reload(true)` is ignored — bust with a `?cb=N` query string (hash after it: `…/?cb=N#brand`).
2. A `?cb=N` on the **page** URL does not bust the cache for linked `.css`/`.js`. Confirm you are reading your edited source before trusting any measurement.
3. Screenshots after a scripted `scrollTo` come back blank or misrender `position: fixed` elements. Measure with `getBoundingClientRect()`; to see a lower section, `display:none` the sections above it so it paints at scroll 0.
4. `document.visibilityState` is stuck `"hidden"` with a frozen `requestAnimationFrame`. View transitions are skipped entirely; rAF-driven code may not fire. Neither is a defect.
5. `resize_window` floors at ~335px. Render the page in an iframe of the target width to test a true 320px.

---

### Task 1: Let the in-bar hamburger survive the loaders

Kayn and NOBI both hold a loading flag on the document while their intro animations run, and `css/pf-chrome.css:139-143` hides the dock while either is set:

```css
html[data-motion="pending"] .pf-dock,
body.is-loading .pf-dock { opacity: 0; pointer-events: none; }
```

That selector computes **0-2-1**, which outranks `.pf-projnav .pf-dock` at **0-2-0**. So without this task, the hamburger inside the bar would be invisible on Kayn and NOBI while the rest of the bar sits there fully painted — a hole in the chrome, on load, on the two pages with the longest intros. It was correct behaviour for a dock floating over a loading page; it is wrong for one that is part of a bar.

**Files:** Modify `css/pf-projectnav.css` (the dock-relocation block).

**Interfaces:** Produces nothing new. Consumes `.pf-projnav .pf-dock` from phase one.

- [ ] **Step 1: Add the override**

Append to the dock-relocation block in `css/pf-projectnav.css`:

```css
/* The loaders must not punch a hole in the bar.
   css/pf-chrome.css hides the dock while a page is still loading --
   html[data-motion="pending"] on kayn, body.is-loading on nobi. That is right
   for a dock floating loose over a page mid-intro, and wrong for one that is
   the third cell of a bar: the bar itself stays painted, so hiding only the
   hamburger leaves a gap where a control should be.

   Both of those selectors compute 0-2-1, which beats a plain
   `.pf-projnav .pf-dock` at 0-2-0 -- so this has to restate the ancestor
   condition rather than just naming the dock again. */
html[data-motion="pending"] .pf-projnav .pf-dock,
body.is-loading .pf-projnav .pf-dock {
  opacity: 1;
  pointer-events: auto;
}
```

- [ ] **Step 2: Verify it changes nothing yet**

Kayn and NOBI have no navbar at this point, so this rule cannot match. That is the check: load `/project_identity/`, `/project_kayn/` and `/project_nobi/` and confirm all three are visually unchanged and console-clean. Record `getComputedStyle(document.querySelector('.pf-projnav .pf-dock')).opacity` on Identity — expect `"1"`, as before.

- [ ] **Step 3: Commit**

```bash
git add css/pf-projectnav.css
git commit -m "$(cat <<'MSG'
fix(project-nav): keep the in-bar hamburger through the loaders

pf-chrome hides the dock while kayn's data-motion="pending" or nobi's
body.is-loading is set. Correct for a dock floating over a page mid-intro;
wrong for one that is a cell of a bar that stays painted. Those selectors
compute 0-2-1, so the override has to restate the ancestor, not just the dock.

Inert until phase two gives those pages a navbar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: Aspire — two tabs

Deliberately first. Aspire is the simplest of the three and it is the one that proves the shared files are portable: if anything in them turns out to be Identity-specific, it surfaces here, cheaply, before Kayn and NOBI copy the same pattern.

**Files:**
- Modify: `project_aspire/index.html`
- Modify: `project_aspire/styles.css` (`.nav` at `:482`, `.scene__pin` at `:592-602`)

**Interfaces:**
- Consumes `--pf-nav-h`, `.pf-panel`, `.pf-projnav`, `window.PFProjectNav` — all from phase one, all unchanged.
- Produces the two-tab pattern that Tasks 3 and 4 extend to three.

- [ ] **Step 1: Head and navbar**

In `project_aspire/index.html`'s `<head>`: remove the `master-bridge.css` `<link>`, add `<link rel="stylesheet" href="/css/pf-projectnav.css">` after the existing `pf-*` sheets, and add the no-JS fallback:

```html
  <!-- Without JS the panels would be unreachable: they ship with `hidden` in
       the markup. Before this navbar, the process section simply rendered flat
       at the end of the page. This restores that. -->
  <noscript><style>.pf-panel[hidden]{display:block!important}</style></noscript>
```

Replace the floating `.pf-dock` block (opens ~line 51) with the bar. **Two tabs only** — no Brand design button:

```html
<div class="pf-projnav" data-pf-projnav>
  <div class="pf-projnav__inner">
    <a class="pf-projnav__name" href="/">Amanda Idris</a>

    <div class="pf-projnav__tabs" role="tablist" aria-label="Project views">
      <button class="pf-projnav__tab" type="button" role="tab" id="pfTabWeb"
              data-tab="web" aria-selected="true" aria-controls="pfPanelWeb">Web design preview</button>
      <button class="pf-projnav__tab" type="button" role="tab" id="pfTabCase"
              data-tab="case" aria-selected="false" aria-controls="pfPanelCase">Case study</button>
    </div>

    <!-- the existing .pf-dock block, markup unchanged, moved in here -->
  </div>

  <div class="pf-projnav__progress" aria-hidden="true"><span class="pf-projnav__bar" id="pfProgress"></span></div>
</div>
```

- [ ] **Step 2: Panels**

Wrap everything from the page's first content element after the dock (`<header class="nav">`, ~line 75) through the site footer's close (`</footer>`, ~line 883) in the web panel; **verify those boundaries against the file rather than trusting the line numbers.**

```html
<div class="pf-panels" data-pf-panels>

  <div class="pf-panel" id="pfPanelWeb" data-panel="web" role="tabpanel" aria-labelledby="pfTabWeb">
    ... header through the site </footer>, unchanged ...
  </div>

  <div class="pf-panel" id="pfPanelCase" data-panel="case" role="tabpanel" aria-labelledby="pfTabCase" hidden>
    <div class="pf-outro">
      <div class="pf-outro__sheet">
        ... the existing .pf-outro__sheet contents, unchanged ...
      </div>
    </div>
  </div>

</div><!-- /.pf-panels -->
```

Delete the `.master-bridge` block outright (~line 894). Drop the `data-pf-outro` attribute from the `.pf-outro` div. The `BEGIN`/`END master-suggestion` markers inside must survive verbatim — `scripts/gen-master-suggestion.py` rewrites between them.

Replace `<script src="/js/pf-outro.js"></script>` with `<script src="/js/pf-projectnav.js"></script>`.

- [ ] **Step 3: Offset Aspire's geometry**

`project_aspire/styles.css:482` — `inset` sets `top: 0`, so `top` must be restated *after* it:

```css
.nav{
  position:fixed;
  inset:0 0 auto;
  top:var(--pf-nav-h, 0px);
  z-index:100;
  height:var(--nav-h);
  background:var(--white);   /* opaque — the composition scrolls under it */
}
```

`project_aspire/styles.css:592-602` — the pinned scene. Note `padding-top:var(--nav-h)` is **Aspire's own** nav height, not the project bar's, and `hero.js` reads it back resolved — leave it alone:

```css
.scene__pin{
  position:sticky;
  top:var(--pf-nav-h, 0px);
  z-index:2;
  height:calc(100vh - var(--pf-nav-h, 0px));
  height:calc(100svh - var(--pf-nav-h, 0px));
  overflow:hidden;
  padding-top:var(--nav-h);
```

Then **grep `project_aspire/styles.css` for every remaining `100vh`, `100svh`, `100dvh` and `100lvh`** and judge each: a full-viewport box needs the offset, a bounded maximum on a smaller element usually does not. Report what you found and what you decided for each.

- [ ] **Step 4: Verify**

- `--pf-nav-h` computes `64px`; `.pf-projnav` is at `top: 0` with height 64; `.nav` sits at `top: 64`.
- `.scene__pin` height equals `innerHeight − 64`.
- Two tabs render; there is no Brand design button.
- `…/project_aspire/#brand` — a hash for a tab that does not exist here — falls back to the web tab with `pfTabWeb` selected. **This is the check that proves the shared JS needed no change.**
- Switching to Case study and back leaves the hero composition correct; scroll through the pinned scene after a round trip.
- The progress bar runs 0 → 1 on each tab, and the two panels report different `scrollHeight`.
- No "Scroll down to see the full process" text anywhere; the web panel ends at Aspire's own footer.
- At 375px: the thumbnail stacks above the copy on the Case study tab; the hamburger is not clipped (measure `getBoundingClientRect().right` against `innerWidth` — a fixed bar overflows silently and `scrollWidth` will not show it).
- Console clean; no horizontal overflow.

- [ ] **Step 5: Commit**

```bash
git add project_aspire/index.html project_aspire/styles.css
git commit -m "$(cat <<'MSG'
feat(project-nav): Aspire's two sub-pages switch from the bar

Web design preview and Case study; no brand tab, per Amanda. The shared
js/pf-projectnav.js is untouched and did not need to be: valid() requires both
a tab and a panel, so "brand" is simply never valid here and a #brand deep
link falls back to web.

The bridge band is gone and the preview ends at Aspire's own footer.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: NOBI — three tabs and a simple brand page

**Files:**
- Modify: `project_nobi/index.html`
- Modify: `project_nobi/css/style.css` (`.nav` at `:193`, `.hero` at `:255`, `.hero__vert` at `:287`)

**Interfaces:** Consumes everything Task 2 consumed, plus `css/pf-brand.css` and its `.pf-brand__stack--flush` modifier. Produces the simple-brand-page pattern Task 4 reuses.

- [ ] **Step 1: Head, navbar, panels**

Exactly as Task 2 Steps 1–2, with these differences: the `<head>` also gains `<link rel="stylesheet" href="/css/pf-brand.css">`; the tab row carries all three buttons (`pfTabWeb` / `pfTabBrand` / `pfTabCase` controlling `pfPanelWeb` / `pfPanelBrand` / `pfPanelCase`, copy exactly "Web design preview", "Brand design", "Case study"); and the web panel wraps `<header class="nav" id="nav">` (~line 72) through the site `</footer>` (~line 381) — verify against the file.

- [ ] **Step 2: The brand panel**

Goes between the web and case panels. Amanda: *"It only needs header, sub heading and the showcase images with no gaps between them."* Nothing else — no block headings, no description column.

The title and sub-heading are read off her own sketch, `resources/new project nav/New project nav - Brand NOBI.png`. The alt text is lifted verbatim from `project_nobi/casestudy/index.html`, which already carries it.

```html
  <!-- ==================== 2 · BRAND DESIGN ====================
       Simpler than Identity's by Amanda's instruction: a masthead and one
       flush stack, no section blocks. The ground is the one per-project value;
       #291217 is sampled from her own "New project nav - Brand NOBI.png".
       The images are 2800px wide -- 2x assets rendering at the 1400px cap. -->
  <div class="pf-panel pf-brand" id="pfPanelBrand" data-panel="brand"
       role="tabpanel" aria-labelledby="pfTabBrand"
       style="--pf-brand-bg: #291217" hidden>
    <div class="pf-brand__wrap">

      <header class="pf-brand__head">
        <h2 class="pf-brand__title">Nobi Bakery</h2>
        <p class="pf-brand__tagline">A modern Japanese fusion bakery</p>
      </header>

      <div class="pf-brand__stack pf-brand__stack--flush">
        <img src="/images/project_nobi/nobi_showcase_1.webp" width="2800" height="1729" loading="lazy" alt="NOBI Bakery landing page — hero and brand introduction" />
        <img src="/images/project_nobi/nobi_showcase_2.webp" width="2798" height="3769" loading="lazy" alt="NOBI Bakery landing page — fusion menu and product showcase" />
        <img src="/images/project_nobi/nobi_showcase_3.webp" width="2800" height="827" loading="lazy" alt="NOBI Bakery landing page — brand story and craftsmanship" />
        <img src="/images/project_nobi/nobi_showcase_4.webp" width="2800" height="8434" loading="lazy" alt="NOBI Bakery landing page — interaction preview" />
        <img src="/images/project_nobi/nobi_showcase_5.webp" width="2800" height="1969" loading="lazy" alt="NOBI Bakery landing page — full page layout" />
      </div>

    </div>
  </div>
```

Note `.pf-brand__tagline` — that is the masthead sub-heading's class after phase one's rename; `.pf-brand__sub` now means a sub-brand board and must not be used here.

- [ ] **Step 3: Offset NOBI's geometry**

`css/style.css:193` — again `inset` sets `top`, so restate it after:

```css
.nav{
  position:fixed;inset:0 0 auto 0;top:var(--pf-nav-h, 0px);z-index:100;
  height:var(--nav-h);color:var(--white);
  transition:height .55s var(--ease),background-color .5s var(--ease),backdrop-filter .5s var(--ease);
}
```

`:255` and `:287` — the hero fills what is visible, and the vertical rule that is positioned off the hero's foot must move with it:

```css
.hero{
  position:relative;min-height:calc(100svh - var(--pf-nav-h, 0px));
  display:flex;flex-direction:column;
  overflow:hidden;isolation:isolate;
}
```

```css
.hero__vert{
  position:absolute;z-index:5;
  /* keyed to the hero's own foot, which is now a navbar shorter */
  top:calc(100svh - var(--pf-nav-h, 0px) - clamp(180px,20.31vw,390px));
```

Then grep `project_nobi/css/style.css` for every remaining `100vh`/`100svh`/`100dvh`/`100lvh` and judge each, reporting your decisions.

- [ ] **Step 4: Verify**

Everything from Task 2 Step 4 (minus the two-tab checks), plus:

- The brand panel's computed background is `rgb(41, 18, 23)`.
- All five images report `max-width: 1400px`, and the seams between adjacent bounding rects are **exactly 0** — measure `next.top - prev.bottom` for each pair.
- All five load `200` (`read_network_requests {urlPattern: "nobi_showcase"}`).
- The panel ends at the last image: no suggestion grid, no contact footer.
- NOBI's loader: reload and confirm the hamburger inside the bar is visible throughout (Task 1's override doing its job) — check `getComputedStyle` on `.pf-projnav .pf-dock` while `body.is-loading` is set.
- The hero and its vertical rule sit correctly below the bar.
- GSAP/Lenis choreography still runs after a Brand → Web round trip.

- [ ] **Step 5: Commit**

```bash
git add project_nobi/index.html project_nobi/css/style.css
git commit -m "$(cat <<'MSG'
feat(project-nav): NOBI's three sub-pages, and a simpler brand page

Amanda: "it is simpler than identity. It only needs header, sub heading and
the showcase images with no gaps between them." So a masthead and one flush
stack on #291217, sampled from her own sketch. No section blocks.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: Kayn — three tabs, and the delicate one

Last, deliberately. Kayn's hero is a sticky film sequence: three stacked `100svh` stages, one of them pulled up over another by `margin-top: -100svh`, driven by GSAP ScrollTrigger over Lenis. **The negative margin and the stage height must stay exactly equal to each other** — the moment they disagree, the USP overlay desynchronises from the film behind it, and it fails as a visual glitch rather than an error. Every `100svh` in that choreography moves together or none of them do.

**Files:**
- Modify: `project_kayn/index.html`
- Modify: `project_kayn/styles.css` (`.masthead` `:357`, `.hero__stage` `:476`, `.film__stage` `:597`, `.usp` `:666`, `html[data-motion="off"] .hero` `:1098`)

- [ ] **Step 1: Head, navbar, panels**

As Task 3 Step 1. The web panel wraps `<header class="masthead" id="masthead">` (~line 121) through the site `</footer>` (~line 465) — verify against the file. Kayn's scripts carry `defer`; keep `pf-projectnav.js` consistent with its neighbours.

- [ ] **Step 2: The brand panel**

Same shape as NOBI's. Alt text is lifted verbatim from `project_kayn/casestudy/index.html`.

**The sub-heading is the one value in this plan I wrote rather than read.** Amanda supplied a sketch for NOBI but not for Kayn; "100% pure Moroccan argan oil" is derived from the page's own `<title>` ("KAYN — Golden Drop of Nature | 100% Pure Moroccan Argan Oil") to match the register of NOBI's "A modern Japanese fusion bakery". Flag it to her at review — it is a one-line edit if she wants different words.

The ground `#2A462D` is Kayn's own `--forest`, the colour its footer sits on and the one its bridge band used to fade into. Also flag it: it is the reasoned choice, not a sampled one.

```html
  <div class="pf-panel pf-brand" id="pfPanelBrand" data-panel="brand"
       role="tabpanel" aria-labelledby="pfTabBrand"
       style="--pf-brand-bg: #2A462D" hidden>
    <div class="pf-brand__wrap">

      <header class="pf-brand__head">
        <h2 class="pf-brand__title">Kayn Argan Oil</h2>
        <p class="pf-brand__tagline">100% pure Moroccan argan oil</p>
      </header>

      <div class="pf-brand__stack pf-brand__stack--flush">
        <img src="/images/project_kayn/kayn_showcase_1.webp" width="2800" height="2244" loading="lazy" alt="Kayn landing page — hero and brand introduction" />
        <img src="/images/project_kayn/kayn_showcase_2.webp" width="2800" height="2128" loading="lazy" alt="Kayn landing page — product benefits and Argan oil story" />
        <img src="/images/project_kayn/kayn_showcase_3.webp" width="2800" height="1679" loading="lazy" alt="Kayn landing page — product detail and ingredients" />
        <img src="/images/project_kayn/kayn_showcase_4.webp" width="2800" height="2456" loading="lazy" alt="Kayn landing page — trust signals and testimonials" />
        <img src="/images/project_kayn/kayn_showcase_5.webp" width="2800" height="2734" loading="lazy" alt="Kayn landing page — closing call to action" />
        <img src="/images/project_kayn/kayn_showcase_6.webp" width="2800" height="12706" loading="lazy" alt="Kayn landing page — full page layout" />
      </div>

    </div>
  </div>
```

`kayn_showcase_6` is 12706px tall — at the 1400px cap it renders about 6350px tall, roughly seven screens. That is intended; it is the full-page layout board. Keep it lazy.

- [ ] **Step 3: Offset Kayn's geometry — all of it, together**

Introduce one token so the film sequence cannot drift, declared on Kayn's own root block (not `:root` in a shared file — this is the page's own stylesheet, which is where page-specific tokens belong):

```css
  /* One name for "a viewport below the project navbar". The film sequence
     stacks three of these and pulls one up over another by exactly minus one
     of them; if the height and the negative margin ever stop agreeing, the USP
     overlay slides out of register with the film behind it and nothing errors.
     So they read the same token. */
  --stage-h: calc(100svh - var(--pf-nav-h, 0px));
```

Then:

```css
.masthead {
  position: fixed; inset: 0 0 auto; top: var(--pf-nav-h, 0px); z-index: 60;
```

```css
.hero__stage {
  position: sticky; top: var(--pf-nav-h, 0px);
  height: var(--stage-h); min-height: 560px;
```

```css
.film__stage {
  position: sticky; top: var(--pf-nav-h, 0px); z-index: 2;
  height: var(--stage-h); min-height: 560px;
```

```css
.usp {
  position: sticky; top: var(--pf-nav-h, 0px); z-index: 1;
  margin-top: calc(-1 * var(--stage-h)); height: var(--stage-h);
  pointer-events: none;
}
```

```css
html[data-motion="off"] .hero { height: var(--stage-h); }
```

`min-height: 560px` stays as it is: it is a floor for very short viewports and is not a viewport-height expression.

Then grep `project_kayn/styles.css` for every remaining `100vh`/`100svh`/`100dvh`/`100lvh` — including inside media queries, where line 967's comment mentions a `190svh` section built out of these — and judge each. **Anything that is arithmetic over stage heights must use `--stage-h` too, or it will drift.** Report every site you found and what you decided.

- [ ] **Step 4: Verify — the film sequence is the whole test**

Beyond the standard checks from Task 3 Step 4 (with `rgb(42, 70, 45)` as the expected brand ground and `kayn_showcase` as the network filter):

- `.hero__stage`, `.film__stage` and `.usp` all compute the **same** height, and it equals `innerHeight − 64`.
- `.usp`'s computed `margin-top` is exactly the negative of that height. Read both with `getComputedStyle` and compare the numbers; do not assume the `calc` resolved as intended.
- All three stages pin at `top: 64`.
- Drive the page through the film sequence and confirm the USP overlay stays in register with the film. Because rAF is frozen here, scripted scrolling may not advance GSAP — if so, say plainly that you could not exercise the sequence and that it needs a real browser, rather than reporting a pass you did not observe.
- Kayn's `data-motion="pending"` loader: the in-bar hamburger stays visible throughout.
- `html[data-motion="off"]` fallback: force it and confirm the hero is still a sensible height.

- [ ] **Step 5: Commit**

```bash
git add project_kayn/index.html project_kayn/styles.css
git commit -m "$(cat <<'MSG'
feat(project-nav): Kayn's three sub-pages, and the film sequence keeps time

Kayn stacks three sticky stages and pulls one up over another by exactly minus
one stage. Height and negative margin now read a single --stage-h so they
cannot drift apart -- if they did, the USP overlay would slide out of register
with the film and nothing would error.

Brand ground is --forest, the colour its own footer sits on. The sub-heading is
mine, not Amanda's: she supplied a sketch for NOBI but not for Kayn.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: The whole-site pass

No new behaviour. This is the sweep across all four project pages at once, which is the only place the system can be judged as a system.

- [ ] **Step 1: All four pages, three widths, every tab**

At 1600px, 1024px and 375px, on `/project_identity/`, `/project_aspire/`, `/project_kayn/`, `/project_nobi/`, every tab:

- The bar is at `top: 0`, painted, above everything; nothing overlaps it mid-scroll.
- The active pill matches the panel on screen.
- The hamburger opens, its menu is fully on screen and its links work.
- No horizontal overflow; console clean.
- The progress bar reaches ~1 at the foot of each sub-page and resets on switch.

- [ ] **Step 2: What this change was most likely to break**

1. **Each page's own scroll engine after a panel round trip.** Switch away and back, then exercise the page's signature motion: Aspire's pinned scene, Kayn's film sequence, NOBI's hero. Identity's deck is already covered but re-check it.
2. **The generator**, which rewrites all thirteen target pages:
   ```bash
   python3 scripts/gen-master-suggestion.py && git status --porcelain
   ```
   Expected: no change, or an identical rewrite. If it errors or hits the wrong region, a `BEGIN`/`END master-suggestion` marker did not survive a panel wrap — fix the markup, not the script. If it leaves the tree dirty with an equivalent-but-reformatted block, revert rather than commit.
3. **Nothing references the retired machinery.** `grep -rn "pf-outro.js\|master-bridge" --include=*.html .` should return only `project_hazen/` (which never had either) and comments. `js/pf-outro.js` and `css/master-bridge.css` stay on disk, unreferenced — retiring them is a separate decision for Amanda.
4. **`project_hazen/` and every `casestudy/` are untouched.** `git status` and a load of each confirm it.
5. **The four intro covers** still lift correctly, and each page's `--pf-intro-bg` still matches the thumbnail that led there.

- [ ] **Step 3: Confirm Amanda's phase-two requirements, one by one**

Write down the evidence for each:

1. Aspire has exactly two tabs: Web design preview and Case study.
2. Kayn and NOBI each have three: Web design preview, Brand design, Case study.
3. Kayn's and NOBI's brand pages are header + sub-heading + showcase images only, with **no gaps** between the images.
4. Every brand page uses its project's own brand colour as the ground.
5. All four pages carry the navbar, the progress bar, and no floating hamburger.

Anything you cannot evidence is unfinished — say so plainly rather than reporting complete.

- [ ] **Step 4: Commit whatever the pass fixed, and stop**

**Do not push.** Hand back the four URLs, and name for Amanda:

- Kayn's sub-heading and brand ground, both of which are reasoned choices rather than values she supplied;
- that the push transition on all four pages is still the one thing never watched running, and needs her browser;
- that `js/pf-outro.js` and `css/master-bridge.css` are now unreferenced and could be deleted whenever she wants.
