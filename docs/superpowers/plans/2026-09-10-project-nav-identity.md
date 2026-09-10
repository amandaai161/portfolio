# Project Page Navbar — Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/project_identity/` a permanent top navbar with three sub-pages — Web design preview, Brand design, Case study — so a recruiter reaches the brand work in one click instead of scrolling to the end of the page and pulling a hidden sheet.

**Architecture:** One document, three sibling panels. The navbar is `position: fixed` at the top; everything below it is a panel and exactly one panel is in the flow at a time (`hidden` on the others). Switching panels is a `hidden` toggle wrapped in `document.startViewTransition()`, which supplies the left/right push; browsers without it swap instantly. The existing floating hamburger (`.pf-dock`) moves inside the navbar unchanged — same markup, same `js/pf-chrome.js`, new position. The sliding process sheet (`js/pf-outro.js`) stops running on this page: `.pf-outro`'s default state is already flat in-flow content, so the case-study panel is that same markup with the JS unhooked.

**Tech Stack:** Hand-written HTML/CSS/ES5. No build step, no framework, no package manager. Static files served by `python3 -m http.server` on port 8000.

---

## Global Constraints

- **Localhost only.** Work in `portfolio_folder/portfolio_v4`, verify at `http://localhost:8000`, commit locally, and **stop**. Do not `git push` — Amanda authorises each push to `amanda-design.com` separately.
- **Identity only.** This plan touches `project_identity/` and three new shared files. Aspire, Kayn and NOBI keep the bridge + sliding sheet until Amanda signs off on Identity, then a second plan adapts them. Do not edit `js/pf-outro.js`, `css/pf-outro.css`, or `css/master-bridge.css` — the other three pages still depend on them exactly as they are.
- **ES5 only.** No arrow functions, no `const`/`let`, no template literals, no optional chaining. These pages ship as plain files with no transpiler. `js/pf-chrome.js` and `js/pf-outro.js` state this in their headers; match them.
- **No custom properties on `:root` in shared files** — except `--pf-nav-h`, which is new, prefixed and unique, and which host page CSS must be able to read. Every other token belongs on the component root. This rule is in `css/pf-chrome.css`'s header and exists because `--nav-h`, `--bg` and `--line` already mean different things on five different pages.
- **Brand ground for Identity: `#140335`** — sampled from Amanda's `New project nav - Brand 2/3.png`. (Brand 1.png exported at `#100518`; she chose `#140335`.)
- **Showcase images cap at `max-width: 1400px`** — which is also their exact native width, so they never upscale.
- **Navbar height: `--pf-nav-h: 80px` desktop, `56px` at `max-width: 760px`.** 80px is measured off the sketches.
- **Every tab opens at its own top.** Switching scrolls to 0; no per-tab scroll memory.
- **Sub-page endings:** Web design preview ends at Identity's own site footer. Brand design ends at its last image. Case study keeps "See other projects" + Amanda's contact footer.
- **Sketches are the spec** and live in `portfolio_folder/resources/new project nav/`. Where a sketch and this plan's pixel values disagree, re-measure the sketch.

### One deliberate departure from the sketch, to raise at review

The sketches lay the brand-design content in an ~834px column (measured at a 1580px export width). Requirement 8 says 1400px, and 1400px is the native width of every `identity_final_*.webp`. **This plan builds 1400px** — the written requirement over the hand-laid sketch. Flag it to Amanda at the localhost review; it is one value in `css/pf-brand.css` if she wants the narrower column back.

---

## File Structure

**New — shared, will serve all four project pages in phase two:**

| File | Responsibility |
|---|---|
| `css/pf-projectnav.css` | The bar: layout, tabs, the in-bar dock overrides, the progress bar, the panel show/hide rules, and the view-transition keyframes. Nothing project-specific. |
| `js/pf-projectnav.js` | Tab state, hash routing, scroll reset, progress bar, and the view-transition wrapper. Exposes `window.PFProjectNav`. |
| `css/pf-brand.css` | The brand-design panel: dark ground, centred masthead, the two-column heading/description rows, the 1400px image column. Ground colour arrives per page as `--pf-brand-bg`. |

**Modified:**

| File | Change |
|---|---|
| `project_identity/index.html` | Insert the navbar, move `.pf-dock` into it, wrap the page into three panels, delete `.master-bridge`, drop `data-pf-outro` and the `pf-outro.js` tag, add the brand panel, load the three new files. |
| `project_identity/css/sections.css` | `.slide`, `.js-deck .deck`, `.js-deck .deck__stage` and `.nav` learn the navbar height. |
| `project_identity/css/base.css` | `.section--viewport` learns the navbar height. |
| `project_identity/css/mobile.css` | The site's own mobile menu sheet learns the navbar height. |
| `project_identity/js/deck.js` | `vh` becomes the height below the navbar, so the deck's scroll maths matches its CSS. |

**Untouched on purpose:** `css/pf-outro.css` (the case-study panel still uses `.pf-process` and `.pf-outro`'s flat default state), `css/master-suggestion.css`, `css/master-footer.css`, `js/pf-chrome.js`, `scripts/gen-master-suggestion.py` (its `BEGIN`/`END` markers survive inside the case-study panel, so it keeps working).

---

## Verification, in place of unit tests

This is a static site with no test runner and no `package.json`. There is nothing to `npm test`. The verification loop for every task is the browser, and each task below states the exact checks and their expected output.

Start the server once, at the beginning:

```bash
python3 -m http.server 8000 --directory "/Users/aspire/Local Files/Amanda Personal/Workspace/AI-KITS/portfolio_folder/portfolio_v4"
```

Prefer the Browser pane tool (`preview_start` with `{name: "portfolio-v4"}`, which reads `.claude/launch.json` at the workspace root). `http.server` sends no cache headers, so **hard-reload after every CSS or JS edit** — `javascript_tool` with `location.reload(true)`, or append a `?v=N` query to the changed file while iterating. A change that "did nothing" is almost always a cached file.

`js/console` must be clean at the end of every task: `read_console_messages` with `onlyErrors: true` returns zero entries.

---

### Task 1: The navbar shell, and the page makes room for it

Builds the bar itself over the untouched website preview. The tabs render and the active pill is correct, but clicking them does nothing yet — that is Task 2. What this task proves is that an 80px fixed bar can sit on top of Identity's scroll deck without breaking its geometry.

**Files:**
- Create: `css/pf-projectnav.css`
- Modify: `project_identity/index.html` (lines 22–29 head block; lines 46–72 the dock; line 88 the site header)
- Modify: `project_identity/css/sections.css:7-19` (`.nav`), `:67-72` (`.slide`), `:76` (deck height), `:78-83` (deck stage)
- Modify: `project_identity/css/base.css:74-78` (`.section--viewport`)
- Modify: `project_identity/css/mobile.css:171-178` (the site's mobile menu sheet)
- Modify: `project_identity/js/deck.js:57-62` (`measure`)

**Interfaces:**
- Produces: `--pf-nav-h` on `:root` — the navbar's height, `80px`, dropping to `56px` at `max-width: 760px`. Every host page reads it to offset its own fixed chrome and viewport-height maths.
- Produces: `.pf-projnav` with `data-pf-projnav`; `.pf-projnav__tab` elements carrying `data-tab="web|brand|case"`; `#pfProgress`, the progress bar's inner span. Task 2 and Task 4 bind to these.
- Consumes: `.pf-dock` markup and `js/pf-chrome.js` behaviour, both unchanged.

- [ ] **Step 1: Write `css/pf-projectnav.css`**

Create the file with this content. The header comment matters — it is how the next person learns why the dock is `position: static` here and hidden everywhere else.

```css
/* ============================================================================
   THE PROJECT NAVBAR — one bar, three sub-pages
   ----------------------------------------------------------------------------
   Amanda: "the recruiters struggled to find the brand design, they need to do
   some extra clicks and scrolls to find it." So the three views of a project --
   the web design preview, the brand design, and the case study -- stop being a
   scroll gesture and become three tabs that are always on screen.

   THE BAR IS FIXED AND ALWAYS VISIBLE. It never hides on scroll. The host page
   makes room for it by reading --pf-nav-h, which is why that one custom
   property is declared on :root and every other token here is not: five
   hand-built pages each own their own meaning of --nav-h, --bg and --line, and
   css/pf-chrome.css's header explains what happens when a shared file forgets
   that. --pf-nav-h is new, prefixed, and used by no page for anything else.

   THE HAMBURGER LIVES HERE NOW. Amanda: "we don't use the floating hamburger
   anymore. Instead, that will be placed on the new navbar as well." The markup
   and js/pf-chrome.js are untouched; the overrides at the bottom of this file
   take .pf-dock out of the viewport corner and sit it in the bar. That includes
   un-hiding it under 760px, where pf-chrome.css hides it -- the reason it hid
   (two hamburgers in the same floating corner) does not apply to a burger that
   is inside a bar.

   Load AFTER css/pf-chrome.css. The dock overrides below win on specificity
   (.pf-projnav .pf-dock is 0-2-0 against 0-1-0) but the type tokens they
   inherit are declared there.
   ========================================================================== */

:root {
  --pf-nav-h: 80px;
}
@media (max-width: 760px) {
  :root { --pf-nav-h: 56px; }
}

.pf-projnav,
.pf-projnav *,
.pf-projnav *::before,
.pf-projnav *::after {
  box-sizing: border-box;
}

/* ---- the bar --------------------------------------------------------------
   z-index 9500 sits above pf-chrome's dock (9000) and every host page's own
   header (identity's is 60, the master header's is 100). */
.pf-projnav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9500;
  height: var(--pf-nav-h);
  margin: 0;
  padding: 0;
  background: #FFFFFF;
  border-bottom: 1px solid rgba(17, 17, 17, 0.10);
  font-family: "Figtree", system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #111111;
  line-height: 1.2;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}

/* Three columns, not space-between: the tab group has to be centred on the
   VIEWPORT, and space-between would centre it between the name and the dock --
   which are different widths, so it would sit off-centre. Measured on
   "New project nav - Website.png": the tab group spans 493-1087 of 1580, whose
   midpoint is 790. The viewport midpoint is 790. */
.pf-projnav__inner {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  padding-inline: clamp(16px, 1.8vw, 28px);
}

.pf-projnav__name {
  justify-self: start;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
  white-space: nowrap;
  color: inherit;
  text-decoration: none;
}
.pf-projnav__name:hover { opacity: 0.62; }
.pf-projnav__name:focus-visible { outline: 2px solid #111111; outline-offset: 3px; }

/* ---- the tabs -------------------------------------------------------------
   Sketch-calibrated: the active pill measures 242 x 57 and the gap between two
   inactive labels measures ~72px. 18px text + 32px of padding either side +
   an 8px gap reproduces both. */
.pf-projnav__tabs {
  justify-self: center;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pf-projnav__tab {
  appearance: none;
  -webkit-appearance: none;
  display: inline-flex;
  align-items: center;
  height: 56px;
  margin: 0;
  padding-inline: 32px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #111111;
  font: inherit;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.02em;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.3s cubic-bezier(0.22, 0.61, 0.36, 1),
              color 0.3s cubic-bezier(0.22, 0.61, 0.36, 1),
              opacity 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.pf-projnav__tab:hover { opacity: 0.6; }
.pf-projnav__tab:focus-visible { outline: 2px solid #111111; outline-offset: 2px; }

.pf-projnav__tab[aria-selected="true"] {
  background: #111111;
  color: #FFFFFF;
  opacity: 1;
}

/* ---- the reading-progress bar --------------------------------------------
   Same 3px black bar, same scaleX(0) rest state and same left origin as
   .cs-progress on the case study pages and #tbar on the hazen page. Amanda
   asked for "the progress bar underneath the nav bar just like the case study
   pages and the hazen page", so it is that bar, not a new one. It is not
   .cs-progress itself because that class lives in css/case-study.css, which
   carries a global reset these pages must not load. */
.pf-projnav__progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 3px;
  z-index: 1;
  pointer-events: none;
}
.pf-projnav__bar {
  display: block;
  height: 100%;
  width: 100%;
  background: #111111;
  transform: scaleX(0);
  transform-origin: left;
  will-change: transform;
}

/* ---- the dock, relocated --------------------------------------------------
   Every declaration here undoes one from css/pf-chrome.css. The menu becomes
   absolutely positioned against the bar rather than stacking under a floating
   button, so it hangs below the bar's bottom edge. */
.pf-projnav .pf-dock {
  position: static;
  justify-self: end;
  display: block;
  z-index: auto;
}
.pf-projnav .pf-dock__btn {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.pf-projnav .pf-dock__btn:hover { transform: none; box-shadow: none; opacity: 0.6; }
.pf-projnav .pf-dock__bars { width: 26px; height: 13px; }
.pf-projnav .pf-dock__bars i { height: 2px; }
.pf-projnav .pf-dock__bars i:nth-child(1) { top: 0; }
.pf-projnav .pf-dock__bars i:nth-child(2) { top: 5.5px; }
.pf-projnav .pf-dock__bars i:nth-child(3) { top: 11px; }
.pf-projnav .pf-dock.is-open .pf-dock__bars i:nth-child(1) { transform: translateY(5.5px) rotate(45deg); }
.pf-projnav .pf-dock.is-open .pf-dock__bars i:nth-child(3) { transform: translateY(-5.5px) rotate(-45deg); }
.pf-projnav .pf-dock__menu {
  position: absolute;
  top: calc(var(--pf-nav-h) + 8px);
  right: clamp(16px, 1.8vw, 28px);
}

/* pf-chrome.css hides the dock under 760px. In the bar it stays -- see the
   header. This override must repeat the breakpoint, not just raise
   specificity, because the rule it beats is itself inside a media query. */
@media (max-width: 760px) {
  .pf-projnav .pf-dock { display: block; }
  .pf-projnav__name { display: none; }
  .pf-projnav__inner { grid-template-columns: 1fr auto; gap: 8px; padding-inline: 12px; }
  .pf-projnav__tabs { justify-self: center; gap: 2px; }
  .pf-projnav__tab { height: 40px; padding-inline: 12px; font-size: 14px; }
  .pf-projnav .pf-dock__menu { right: 12px; top: calc(var(--pf-nav-h) + 6px); }
}
```

- [ ] **Step 2: Load the new stylesheet and move the dock into the bar**

In `project_identity/index.html`, add the stylesheet immediately after the `pf-cursor.css`/`pf-outro.css` pair in `<head>` (around line 28), so it loads after `pf-chrome.css`:

```html
  <link rel="stylesheet" href="/css/pf-projectnav.css">
```

Then replace the whole floating-dock block — the comment at line 46 through the `</div>` at line 71 — with the bar. The `.pf-dock` markup inside it is character-for-character what was there before; only its wrapper changed.

```html
<!-- ==================== THE PROJECT NAVBAR ====================
     Three views of this project, always reachable. Amanda's sketches are in
     resources/new project nav/. The floating hamburger used to sit in the
     top-right corner of the viewport; it is the third cell of this bar now.
     Rules in /css/pf-projectnav.css, behaviour in /js/pf-projectnav.js. -->
<div class="pf-projnav" data-pf-projnav>
  <div class="pf-projnav__inner">
    <a class="pf-projnav__name" href="/">Amanda Idris</a>

    <div class="pf-projnav__tabs" role="tablist" aria-label="Project views">
      <button class="pf-projnav__tab" type="button" role="tab" id="pfTabWeb"
              data-tab="web" aria-selected="true" aria-controls="pfPanelWeb">Web design preview</button>
      <button class="pf-projnav__tab" type="button" role="tab" id="pfTabBrand"
              data-tab="brand" aria-selected="false" aria-controls="pfPanelBrand">Brand design</button>
      <button class="pf-projnav__tab" type="button" role="tab" id="pfTabCase"
              data-tab="case" aria-selected="false" aria-controls="pfPanelCase">Case study</button>
    </div>

    <div class="pf-dock" data-pf-dock>
      <button class="pf-dock__btn" type="button" aria-expanded="false" aria-controls="pfDockMenu" aria-label="Open site menu">
        <span class="pf-dock__bars" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>

      <div class="pf-dock__menu" id="pfDockMenu" hidden>
        <a class="pf-dock__link" href="/"><span class="pf-dock__label">Home</span></a>
        <a class="pf-dock__link" href="/about"><span class="pf-dock__label">About</span></a>
        <a class="pf-dock__link" href="https://drive.google.com/file/d/17xpRZMmFu-NjKafbXy8DL-JBh-s6-kH6/view?usp=drive_link" target="_blank" rel="noopener">
          <span class="pf-dock__label">Resume</span>
          <svg class="pf-dock__ext" viewBox="0 0 14 15" aria-hidden="true"><path d="M3 12L11 4M11 4H4M11 4V11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </a>
        <a class="pf-dock__link" href="https://www.linkedin.com/in/amandaalfattah/" target="_blank" rel="noopener">
          <span class="pf-dock__label">Linkedin</span>
          <svg class="pf-dock__ext" viewBox="0 0 14 15" aria-hidden="true"><path d="M3 12L11 4M11 4H4M11 4V11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </a>
        <a class="pf-dock__link" href="https://www.behance.net/amandaalfattah" target="_blank" rel="noopener">
          <span class="pf-dock__label">Behance</span>
          <svg class="pf-dock__ext" viewBox="0 0 14 15" aria-hidden="true"><path d="M3 12L11 4M11 4H4M11 4V11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </a>
      </div>
    </div>
  </div>

  <div class="pf-projnav__progress" aria-hidden="true"><span class="pf-projnav__bar" id="pfProgress"></span></div>
</div>
```

- [ ] **Step 3: Push Identity's own chrome and viewport maths below the bar**

Six edits. They must all land together: the deck's CSS height and its JS `vh` are two halves of one calculation, and changing one alone desynchronises the slide stops from the scroll position.

`project_identity/css/sections.css:7-13` — the site nav starts below the project navbar:

```css
.nav {
  position: fixed;
  top: var(--pf-nav-h, 0px);
  left: 0;
  right: 0;
  z-index: 60;
  height: var(--nav-h);
```

`project_identity/css/sections.css:67-72` — a slide fills what is visible, not the whole viewport:

```css
.slide {
  display: grid;
  align-content: center;
  min-height: calc(100vh - var(--pf-nav-h, 0px));
  padding-block: 108px;
}
```

`project_identity/css/sections.css:76` and `:78-83` — the deck's total height and its sticky stage:

```css
/* one viewport per slide, plus whatever extra hold the slides asked for
   (data-dwell), plus one for the sticky stage itself. "One viewport" is the
   height BELOW the project navbar -- deck.js measures the same figure, and the
   two have to agree or the slide stops drift from the scroll position. */
.js-deck .deck { height: calc((var(--deck-span, 5) + 1) * (100vh - var(--pf-nav-h, 0px))); }

.js-deck .deck__stage {
  position: sticky;
  top: var(--pf-nav-h, 0px);
  height: calc(100vh - var(--pf-nav-h, 0px));
  overflow: hidden;
}
```

`project_identity/css/base.css:74-78`:

```css
.section--viewport {
  min-height: calc(100vh - var(--pf-nav-h, 0px));
  display: grid;
  align-content: center;
}
```

`project_identity/css/mobile.css:176-177` — the site's own mobile menu sheet is anchored inside `.nav`, which now starts below the navbar, so it must be that much shorter or it overflows the viewport:

```css
    height: calc(100vh - var(--pf-nav-h, 0px));
    height: calc(100dvh - var(--pf-nav-h, 0px));
```

`project_identity/js/deck.js:57-62` — the JS half of the deck calculation:

```js
  function measure() {
    if (!deck) return;
    /* The visible height BELOW the project navbar, which is what one slide
       occupies. sections.css sizes .deck and .deck__stage from the same figure;
       if these two ever disagree the slides stop drifting out of step with the
       scroll. Reads the live custom property so the 80px -> 56px breakpoint
       needs no second definition here. */
    var navH = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--pf-nav-h")
    ) || 0;
    vh = window.innerHeight - navH;
    /* navH comes off BOTH figures, and for two different reasons. vh is how
       much height one slide occupies. deckTop is the scroll position at which
       slide 0 should read as progress 0 -- and .deck__stage now pins at
       top: navH, so it pins navH px of scrolling EARLIER than the deck's own
       document offset. Subtracting it here is what keeps "the stage just
       pinned" and "slide 0 is exactly on its stop" the same moment. Take it
       off vh alone and every slide stop sits navH px late. */
    deckTop = deck.getBoundingClientRect().top + window.scrollY - navH;
    lastP = -1;
  }
```

- [ ] **Step 4: Give the page room at the top**

The bar is `position: fixed`, so it covers the first 80px of the document. Add this to `css/pf-projectnav.css`, at the end of the "the bar" block:

```css
/* The bar is out of flow, so the page has to be pushed down by hand. On the
   panel wrapper rather than on body: body carries the host page's own
   background and several of these pages animate it. */
.pf-panels { padding-top: var(--pf-nav-h); }
```

And wrap the page body in that element — provisionally, for this task only, one wrapper around everything from `.gradient-field` (line 74) to the end of `.pf-outro`. Task 2 splits it into three.

```html
<div class="pf-panels" data-pf-panels>
  ... existing page, unchanged ...
</div>
```

- [ ] **Step 5: Verify the bar and the geometry**

Serve the site and open `http://localhost:8000/project_identity/`, then check:

1. `read_page` — the bar exists, "Amanda Idris" is present, three tabs are present, "Web design preview" has `aria-selected="true"`.
2. `javascript_tool`:
   ```js
   var n = document.querySelector('.pf-projnav').getBoundingClientRect();
   var sn = document.getElementById('site-nav').getBoundingClientRect();
   ({navTop: n.top, navHeight: n.height, siteNavTop: sn.top,
     stage: document.querySelector('.deck__stage') &&
            document.querySelector('.deck__stage').getBoundingClientRect().height,
     inner: window.innerHeight})
   ```
   Expected: `navTop: 0`, `navHeight: 80`, `siteNavTop: 80`, and `stage === inner - 80`.
3. `computer {action: "screenshot"}` — compare against `resources/new project nav/New project nav - Website.png`. The hero headline must be vertically centred in the space **below** the bar, and the "identity" wordmark and its Network/Directory/Partner/About links must be fully visible, not clipped.
4. Scroll to the second and third deck slides (`javascript_tool: window.scrollTo(0, window.innerHeight * 1.5)`), screenshot, and confirm each slide is still centred in the visible area. This is what proves Step 3's CSS/JS pair agree.
5. Click the hamburger. The menu opens below the bar's right edge, not over the tabs. Click it again; it closes.
6. `resize_window {preset: "mobile"}`, reload, screenshot: the name is gone, three tabs fit, the hamburger is visible.
7. `read_console_messages {onlyErrors: true}` — empty.

- [ ] **Step 6: Commit**

```bash
git add css/pf-projectnav.css project_identity/index.html project_identity/css/sections.css project_identity/css/base.css project_identity/css/mobile.css project_identity/js/deck.js
git commit -m "$(cat <<'MSG'
feat(project-nav): the navbar, and Identity makes room for it

The three views of a project become three tabs in a bar that never leaves
the screen. The floating hamburger moves into it. Identity's fixed header,
its deck stage and deck.js's viewport figure all learn --pf-nav-h.

Tabs do not switch yet.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: Three panels, and the tabs switch between them

Splits the page into the three sub-pages and makes the tabs work. No transition yet — the swap is instant, which is also the permanent fallback for browsers without view transitions, so it is worth seeing on its own.

**Files:**
- Create: `js/pf-projectnav.js`
- Modify: `css/pf-projectnav.css` (append the panel rules)
- Modify: `project_identity/index.html` — panel wrappers; delete `.master-bridge` (lines 516–532); drop `data-pf-outro`; drop the `pf-outro.js` script tag

**Interfaces:**
- Consumes: `.pf-projnav__tab[data-tab]` and `#pfProgress` from Task 1.
- Produces: `window.PFProjectNav` with `show(name)` (switch to `"web" | "brand" | "case"`, returns nothing), `current` (getter, returns the active tab name as a string), and `panels` (getter, returns an object mapping each name to its element). Task 4 calls `current`; Task 5 needs no API.
- Produces: `.pf-panel[data-panel="web|brand|case"]` elements with ids `pfPanelWeb`, `pfPanelBrand`, `pfPanelCase`, matching the `aria-controls` written in Task 1.

- [ ] **Step 1: Append the panel rules to `css/pf-projectnav.css`**

```css
/* ---- the panels -----------------------------------------------------------
   Exactly one is in the flow at a time. Not a horizontal track: identity's
   deck and gradient both read window.scrollY and documentElement.scrollHeight,
   and neither works inside an overflow container. So the sub-pages take turns
   being the document, and the left/right push is supplied by the view
   transition in js/pf-projectnav.js rather than by moving these boxes.

   NOTHING HERE MAY SET transform, filter, perspective, backdrop-filter OR
   contain. Each of those makes the panel a containing block for its fixed
   descendants, and .gradient-field and .nav inside the web panel are both
   position: fixed. That is also why the push is done with pseudo-elements. */
.pf-panel {
  position: relative;
  display: block;
  margin: 0;
  padding: 0;
}
/* The attribute alone is not enough: identity's reset does not restate the UA
   default, and a host page's `display` rule on a descendant selector would
   win over it. */
.pf-panel[hidden] { display: none; }
```

- [ ] **Step 2: Wrap the page into three panels**

In `project_identity/index.html`, replace the provisional `.pf-panels` wrapper from Task 1 with three panels.

**Panel one** opens immediately before `.gradient-field` (line 74) and closes immediately after the site `</footer>` (line 514):

```html
<div class="pf-panels" data-pf-panels>

  <!-- ==================== 1 · WEB DESIGN PREVIEW ====================
       The project as it was built: identity's own site, its own fixed header,
       its own scroll deck, its own footer. Default sub-page, per the sketch.
       Ends at identity's footer -- Amanda: "please remove the 'Scroll down to
       see....' part, as well as the black gradient effect. So the end of
       respective web design preview is the respective footer." -->
  <div class="pf-panel" id="pfPanelWeb" data-panel="web" role="tabpanel" aria-labelledby="pfTabWeb">
    ... .gradient-field through the site </footer>, unchanged ...
  </div>
```

**Delete the bridge outright** — the comment block at line 516 and the whole `<div class="master-bridge">…</div>` through line 532. Nothing replaces it. Leave `css/master-bridge.css` on disk and keep its `<link>` out of this page's head (remove the `master-bridge.css` line from `<head>`); Aspire, Kayn and NOBI still load it.

**Panel two** goes where the bridge was — a placeholder for now, filled in Task 5:

```html
  <!-- ==================== 2 · BRAND DESIGN ====================
       Built in Task 3. -->
  <div class="pf-panel pf-brand" id="pfPanelBrand" data-panel="brand"
       role="tabpanel" aria-labelledby="pfTabBrand" hidden>
    <p style="padding:120px;text-align:center;color:#fff">Brand design — placeholder</p>
  </div>
```

**Panel three** wraps the existing `.pf-outro` block. Two changes inside it: the `data-pf-outro` attribute goes (that is the hook `js/pf-outro.js` looks for, and its absence is what stops the sheet running here), and the comment above it is rewritten because it now describes something that is no longer true:

```html
  <!-- ==================== 3 · CASE STUDY ====================
       What used to arrive as a sheet sliding in from the right is a tab now.
       The markup is unchanged and so is /css/pf-outro.css: .pf-outro's DEFAULT
       state is already flat, in-flow content -- position: fixed only ever came
       from .pf-outro--live, which js/pf-outro.js added. Dropping the
       data-pf-outro hook and the script tag leaves exactly the flat rendering
       that file was already written to fall back to.

       Keeps "See other projects" and the contact footer. Amanda's call: the
       brand tab ends on its last image, this one ends somewhere a reader can
       act. The BEGIN/END master-suggestion markers below must survive --
       scripts/gen-master-suggestion.py rewrites between them. -->
  <div class="pf-panel" id="pfPanelCase" data-panel="case"
       role="tabpanel" aria-labelledby="pfTabCase" hidden>
    <div class="pf-outro">
      <div class="pf-outro__sheet">
        ... .pf-process, master-suggestion and master-footer, all unchanged ...
      </div>
    </div>
  </div>

</div><!-- /.pf-panels -->
```

Finally, delete this line from the bottom of the file:

```html
  <script src="/js/pf-outro.js"></script>
```

- [ ] **Step 3: Write `js/pf-projectnav.js`**

```js
/* ============================================================================
   THE PROJECT NAVBAR — behaviour
   ----------------------------------------------------------------------------
   Three sub-pages, one document, one in the flow at a time.

   WHY NOT A HORIZONTAL TRACK. The obvious build for a left/right push is three
   panels side by side in a flex row that translates. It cannot work here: the
   web panel contains identity's scroll deck and gradient, both of which read
   window.scrollY and documentElement.scrollHeight, and neither reads anything
   useful from inside an overflow container. Aspire and kayn have the same
   problem in their own dialects. So the panels take turns being the document,
   and the push is drawn by the View Transitions API over a snapshot -- which
   costs one viewport-sized capture and no layout at all.

   NO VIEW TRANSITIONS, OR REDUCED MOTION: the swap still happens, instantly.
   The animation is decoration on top of a state change that stands on its own.

   ES5 on purpose -- see js/pf-chrome.js's header.
   ========================================================================== */
(function (window, document) {
  "use strict";

  var bar = document.querySelector("[data-pf-projnav]");
  var wrap = document.querySelector("[data-pf-panels]");
  if (!bar || !wrap) return;

  var ORDER = ["web", "brand", "case"];

  var tabs = {};
  var panels = {};
  var i, el, list;

  list = bar.querySelectorAll(".pf-projnav__tab");
  for (i = 0; i < list.length; i++) {
    el = list[i];
    tabs[el.getAttribute("data-tab")] = el;
  }

  list = wrap.querySelectorAll(".pf-panel");
  for (i = 0; i < list.length; i++) {
    el = list[i];
    panels[el.getAttribute("data-panel")] = el;
  }

  var current = "web";

  function valid(name) {
    return ORDER.indexOf(name) !== -1 && tabs[name] && panels[name];
  }

  /* The state change itself. Deliberately synchronous and animation-free: the
     view transition in show() wraps this, and everything that cannot run one
     calls it directly. */
  function commit(name) {
    var k, n;
    for (k = 0; k < ORDER.length; k++) {
      n = ORDER[k];
      panels[n].hidden = n !== name;
      tabs[n].setAttribute("aria-selected", n === name ? "true" : "false");
    }
    current = name;

    /* Amanda: every tab opens at its own top. Also the one state in which the
       deck is guaranteed correct before it re-measures below. */
    window.scrollTo(0, 0);

    /* deck.js and gradient.js both re-measure on resize (debounced 120ms) and
       have been sitting in a display:none subtree, where every box measured
       zero. At scrollY 0 the deck's correct rendering is slide 0, which is what
       is on screen right now, so the re-measure lands invisibly. */
    window.dispatchEvent(new Event("resize"));

    if (window.PFProjectNav && window.PFProjectNav.onChange) {
      window.PFProjectNav.onChange(name);
    }
  }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  function show(name) {
    if (!valid(name) || name === current) return;

    var forward = ORDER.indexOf(name) > ORDER.indexOf(current);
    var root = document.documentElement;

    if (!document.startViewTransition || reduced.matches) {
      commit(name);
      return;
    }

    /* The direction is read by the keyframes in css/pf-projectnav.css. Set
       before the transition starts and cleared when it has finished, so a
       transition never runs against the previous one's direction. */
    root.setAttribute("data-pf-slide", forward ? "forward" : "back");

    var vt = document.startViewTransition(function () { commit(name); });
    vt.finished["catch"](function () { }).then(function () {
      root.removeAttribute("data-pf-slide");
    });
  }

  /* ---- the tabs ---------------------------------------------------------- */
  for (i = 0; i < ORDER.length; i++) {
    (function (name) {
      tabs[name].addEventListener("click", function () {
        if (name === current) return;
        setHash(name);
        show(name);
      });
    })(ORDER[i]);
  }

  /* ---- the hash ----------------------------------------------------------
     A sub-page is worth a URL: it is how Amanda sends a recruiter straight to
     the brand work, and it is what makes the back button undo a tab switch.
     "web" writes no hash, because it is what a bare /project_identity/ means. */
  function setHash(name) {
    var url = window.location.pathname + window.location.search +
              (name === "web" ? "" : "#" + name);
    window.history.pushState({ pfTab: name }, "", url);
  }

  function fromHash() {
    var h = window.location.hash.replace(/^#/, "");
    return valid(h) ? h : "web";
  }

  window.addEventListener("popstate", function () {
    var name = fromHash();
    if (name !== current) show(name);
  });

  /* ---- initial state ------------------------------------------------------
     The markup ships with "web" selected, so a deep link has to be applied
     before anything is painted from it. commit(), not show(): there is no
     previous sub-page to push away from. */
  var start = fromHash();
  if (start !== "web") commit(start);

  window.PFProjectNav = {
    show: show,
    onChange: null,
    get current() { return current; },
    get panels() { return panels; }
  };
})(window, document);
```

Load it beside the other shared scripts at the bottom of `project_identity/index.html`, where `/js/pf-outro.js` used to be:

```html
  <script src="/js/pf-projectnav.js"></script>
```

- [ ] **Step 4: Verify the switching**

1. Load `http://localhost:8000/project_identity/`. Screenshot: the website preview, unchanged, and **no** "Scroll down to see the full process" band and no black gradient at the bottom. Scroll to the very bottom (`javascript_tool: window.scrollTo(0, document.body.scrollHeight)`) and screenshot: the page ends at Identity's own dark footer.
2. Scroll to the bottom again and flick the wheel downward hard. Nothing slides in. `javascript_tool: typeof window.PFOutro` returns `"undefined"`.
3. Click "Case study". The process section appears, scrolled to its top, with "See other projects" and the contact footer below it. The URL is `…/project_identity/#case`.
4. Click "Web design preview". The preview is back, at the hero, and the deck responds to scrolling — scroll one and a half viewports and confirm the second slide is on screen and centred. This is the test that the `resize` dispatch in `commit()` actually re-measures the deck.
5. Click "Brand design". The placeholder shows. URL `#brand`.
6. Press the browser Back button twice; the tabs follow the history backwards.
7. Load `http://localhost:8000/project_identity/#case` directly in a new tab. It opens on the case study with the right pill lit.
8. `read_console_messages {onlyErrors: true}` — empty.

- [ ] **Step 5: Commit**

```bash
git add js/pf-projectnav.js css/pf-projectnav.css project_identity/index.html
git commit -m "$(cat <<'MSG'
feat(project-nav): Identity's three sub-pages switch from the bar

The page splits into three panels and the tabs swap which one is in the
flow. The bridge band and its gradient are gone, and pf-outro.js no longer
runs here -- the case study is a tab, and .pf-outro's flat default state is
exactly what a tab needs. Each sub-page has a URL.

Swap is instant; the push lands next.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: The brand design sub-page

Builds the real second panel from Amanda's three "Brand" sketches. The content is the same work the case study's "Final: Identity 2.0" section shows — same twelve images — but laid out for a standalone dark page rather than for a light case-study column. **The case study page keeps its own copy;** these are two different reading contexts and neither is a duplicate of the other in the reader's path.

**Files:**
- Create: `css/pf-brand.css`
- Modify: `project_identity/index.html` (the `#pfPanelBrand` placeholder from Task 2, and one `<link>` in `<head>`)

**Interfaces:**
- Consumes: `.pf-panel` from Task 2; `--pf-nav-h` from Task 1.
- Produces: `.pf-brand` (the panel's own class, already on the placeholder) reading `--pf-brand-bg` and `--pf-brand-ink` set inline per page. Phase two sets different values for Aspire, Kayn and NOBI and reuses everything else.

- [ ] **Step 1: Write `css/pf-brand.css`**

```css
/* ============================================================================
   THE BRAND DESIGN SUB-PAGE
   ----------------------------------------------------------------------------
   One layout, four brand grounds. Amanda: "In their respective brand design
   sub-page, please use their brand colors as the background accordingly." So
   the ground and the ink arrive per page as --pf-brand-bg and --pf-brand-ink on
   the panel, and nothing else in this file is project-specific.

   THE IMAGE COLUMN CAPS AT 1400px, which is Amanda's requirement and also the
   exact native width of every identity_final_*.webp. Above the cap the images
   would only upscale.

   Type steps are the --pf-fs-* scale from css/pf-chrome.css, which is v3's own
   scale -- load this file after that one.
   ========================================================================== */

.pf-brand,
.pf-brand *,
.pf-brand *::before,
.pf-brand *::after {
  box-sizing: border-box;
}

.pf-brand {
  --pf-brand-bg: #140335;
  --pf-brand-ink: #FFFFFF;
  --pf-brand-ink-soft: rgba(255, 255, 255, 0.72);
  --pf-brand-max: 1400px;
  --pf-brand-gutter: clamp(20px, 5.2vw, 100px);

  background: var(--pf-brand-bg);
  color: var(--pf-brand-ink);
  font-family: "Figtree", system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.2;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  padding-bottom: clamp(80px, 9vw, 160px);
}

.pf-brand__wrap {
  width: 100%;
  max-width: calc(var(--pf-brand-max) + var(--pf-brand-gutter) * 2);
  margin-inline: auto;
  padding-inline: var(--pf-brand-gutter);
}

/* ---- the masthead ---------------------------------------------------------
   Sketch "New project nav - Brand 1.png": title and subtitle centred over the
   image column, title ~48px, subtitle ~24px. */
.pf-brand__head {
  padding-top: clamp(40px, 4.4vw, 68px);
  padding-bottom: clamp(36px, 4vw, 62px);
  text-align: center;
}
.pf-brand__title {
  margin: 0;
  font-size: clamp(2rem, 1.4rem + 1.9vw, 3rem);   /* 32 -> 48 */
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: var(--pf-brand-ink);
}
.pf-brand__sub {
  margin: clamp(10px, 1vw, 16px) 0 0;
  font-size: clamp(1.0625rem, 0.95rem + 0.35vw, 1.5rem);  /* 17 -> 24 */
  font-weight: 400;
  line-height: 1.35;
  letter-spacing: -0.02em;
  color: var(--pf-brand-ink-soft);
}

/* ---- a titled block -------------------------------------------------------
   Sketches "Brand 2" and "Brand 3": the section title sits left, its
   description right, on one row above the images. Measured at the 1580px
   export, the title column runs ~264px against ~576px of description, which is
   the 1fr / 2fr below. It stacks under 900px. */
.pf-brand__block { padding-top: clamp(48px, 5.6vw, 92px); }

.pf-brand__blockhead {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(0, 2fr);
  gap: clamp(24px, 3vw, 48px);
  align-items: start;
  margin-bottom: clamp(20px, 2.4vw, 36px);
}
.pf-brand__blocktitle {
  margin: 0;
  font-size: clamp(1.5rem, 1.31rem + 0.6vw, 2rem);   /* 24 -> 32 */
  font-weight: 500;
  line-height: 1.18;
  letter-spacing: -0.03em;
  color: var(--pf-brand-ink);
}
.pf-brand__blockdesc {
  margin: 0;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.45;
  letter-spacing: -0.01em;
  color: var(--pf-brand-ink-soft);
}

/* ---- the images -----------------------------------------------------------
   width/height are on every <img> so the column reserves its space before the
   files land: the panel is display:none until its tab is picked, and without
   intrinsic sizing the whole sub-page would reflow as it opens. */
.pf-brand__stack {
  display: grid;
  gap: clamp(12px, 1.4vw, 20px);
}
.pf-brand__stack img {
  display: block;
  width: 100%;
  height: auto;
  max-width: var(--pf-brand-max);
  margin-inline: auto;
}

/* A named sub-brand board: a coloured dot, its name, then the board. --sub-c
   is set per article, as on the case study page. */
.pf-brand__subs {
  display: flex;
  flex-direction: column;
  gap: clamp(28px, 3vw, 48px);
}
.pf-brand__sub { display: flex; flex-direction: column; gap: clamp(12px, 1.2vw, 18px); }
.pf-brand__subhead { display: flex; align-items: center; gap: 12px; }
.pf-brand__subdot {
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--sub-c, var(--pf-brand-ink));
}
.pf-brand__subname {
  margin: 0;
  font-size: clamp(1.375rem, 1.25rem + 0.39vw, 1.75rem);  /* 22 -> 28 */
  font-weight: 500;
  letter-spacing: -0.03em;
  color: var(--pf-brand-ink);
}
.pf-brand__sub img {
  display: block;
  width: 100%;
  height: auto;
  max-width: var(--pf-brand-max);
}

@media (max-width: 900px) {
  .pf-brand__blockhead { grid-template-columns: 1fr; gap: 12px; }
}
```

Add the `<link>` to `project_identity/index.html`'s head, after `pf-projectnav.css`:

```html
  <link rel="stylesheet" href="/css/pf-brand.css">
```

- [ ] **Step 2: Replace the brand panel placeholder with the real content**

The `--pf-brand-bg` is set inline on the panel — that is the one value that differs per project, exactly as `--master-bridge-from` used to be.

```html
  <!-- ==================== 2 · BRAND DESIGN ====================
       The work behind the site, on the brand's own ground. Same twelve images
       the case study's "Final: Identity 2.0" section carries, laid out for a
       standalone dark page. The case study keeps its copy: a reader who lands
       here has not read that page, and a reader on that page is mid-argument.

       ONE VALUE PER PROJECT: --pf-brand-bg. Amanda picked #140335 off her own
       "New project nav - Brand 2/3.png". Everything else is /css/pf-brand.css. -->
  <div class="pf-panel pf-brand" id="pfPanelBrand" data-panel="brand"
       role="tabpanel" aria-labelledby="pfTabBrand"
       style="--pf-brand-bg: #140335" hidden>
    <div class="pf-brand__wrap">

      <header class="pf-brand__head">
        <h2 class="pf-brand__title">Identity 2.0</h2>
        <p class="pf-brand__sub">A global network for entrepreneurs, leaders, and creators</p>
      </header>

      <div class="pf-brand__stack">
        <img src="/images/project_identity/identity_final/identity_final_showcase_1.webp" width="1400" height="583" loading="lazy" alt="Identity 2.0 — the primary wordmark on the brand's deep purple gradient" />
        <img src="/images/project_identity/identity_final/identity_final_showcase_2.webp" width="1400" height="674" loading="lazy" alt="id.story — the brand narrative: not a reunion, but a living covenant" />
        <img src="/images/project_identity/identity_final/identity_final_showcase_3.webp" width="1400" height="674" loading="lazy" alt="Logo variations in Latin and Arabic, plus the refreshed @90thgeneration Instagram profile" />
        <img src="/images/project_identity/identity_final/identity_final_showcase_4.webp" width="1400" height="781" loading="lazy" alt="Brand applied to stationery — letterhead, envelopes, and business cards" />
        <img src="/images/project_identity/identity_final/identity_final_showcase_5.webp" width="1400" height="823" loading="lazy" alt="Merchandise and logo construction — pin badge, kerning and spacing specs for both scripts" />
        <img src="/images/project_identity/identity_final/identity_final_showcase_6.webp" width="1400" height="674" loading="lazy" alt="Member ID lanyard — 'the friends of Identity are still here, after ten years'" />
      </div>

      <section class="pf-brand__block">
        <div class="pf-brand__blockhead">
          <h3 class="pf-brand__blocktitle">The social media post</h3>
          <p class="pf-brand__blockdesc">The feed is where the community actually lives, so I rebuilt it as a template system: a consistent grid, a fixed type hierarchy, and reusable layouts any admin can fill in minutes. Now every post finally looks like it belongs to the same voice.</p>
        </div>
        <div class="pf-brand__stack">
          <img src="/images/project_identity/identity_final/identity_final_social_1.webp" width="1400" height="1312" loading="lazy" alt="New social templates — a consistent, on-brand set of Instagram posts" />
          <img src="/images/project_identity/identity_final/identity_final_social_2.webp" width="1400" height="1424" loading="lazy" alt="New social templates — event, quote, and announcement layouts sharing one system" />
        </div>
      </section>

      <section class="pf-brand__block">
        <div class="pf-brand__blockhead">
          <h3 class="pf-brand__blocktitle">The sub-brands</h3>
          <p class="pf-brand__blockdesc">The three intents each became a sub-brand with its own accent colour, a simple, ownable cue that tells members at a glance whether something is about connecting, collaborating, or contributing. The same &ldquo;id.&rdquo; naming then stretches to every city chapter and program.</p>
        </div>

        <div class="pf-brand__subs">
          <article class="pf-brand__sub" style="--sub-c:#AEFF00">
            <div class="pf-brand__subhead">
              <span class="pf-brand__subdot" aria-hidden="true"></span>
              <h4 class="pf-brand__subname">id.connect</h4>
            </div>
            <img src="/images/project_identity/identity_final/identity_final_subbrand_1.webp" width="1400" height="512" loading="lazy" alt="id.connect sub-brand board — logo lockups and social applications in Nexus Green" />
          </article>

          <article class="pf-brand__sub" style="--sub-c:#FAB429">
            <div class="pf-brand__subhead">
              <span class="pf-brand__subdot" aria-hidden="true"></span>
              <h4 class="pf-brand__subname">id.collaborate</h4>
            </div>
            <img src="/images/project_identity/identity_final/identity_final_subbrand_2.webp" width="1400" height="512" loading="lazy" alt="id.collaborate sub-brand board — logo lockups and partnership applications in Synergy Flare" />
          </article>

          <article class="pf-brand__sub" style="--sub-c:#63ACFF">
            <div class="pf-brand__subhead">
              <span class="pf-brand__subdot" aria-hidden="true"></span>
              <h4 class="pf-brand__subname">id.contribute</h4>
            </div>
            <img src="/images/project_identity/identity_final/identity_final_subbrand_3.webp" width="1400" height="512" loading="lazy" alt="id.contribute sub-brand board — logo lockups and social-impact applications in Legacy Azure" />
          </article>

          <article class="pf-brand__sub" style="--sub-c:#B98CFF">
            <div class="pf-brand__subhead">
              <span class="pf-brand__subdot" aria-hidden="true"></span>
              <h4 class="pf-brand__subname">chapters &amp; programs</h4>
            </div>
            <img src="/images/project_identity/identity_final/identity_final_subbrand_4.webp" width="1400" height="899" loading="lazy" alt="Chapters and programs — the id. naming system applied across regional chapters and activity sub-brands" />
          </article>
        </div>
      </section>

    </div>
  </div>
```

- [ ] **Step 3: Verify the brand panel against the sketches**

1. Load `http://localhost:8000/project_identity/#brand`.
2. `javascript_tool`:
   ```js
   var p = document.getElementById('pfPanelBrand');
   var img = p.querySelector('.pf-brand__stack img');
   ({bg: getComputedStyle(p).backgroundColor,
     imgWidth: img.getBoundingClientRect().width,
     topGap: p.getBoundingClientRect().top,
     docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth})
   ```
   Expected: `bg` is `rgb(20, 3, 53)`; `imgWidth` is exactly `1400` on a viewport wider than 1600 and less than that below; `topGap` is `80`; `docOverflowX` is `0`.
3. Screenshot at the top, then at `window.scrollTo(0, 2200)`, then at the bottom. Compare against `New project nav - Brand 1.png`, `- Brand 2.png` and `- Brand 3.png` in order: centred masthead; six stacked showcase images; "The social media post" left with its description right; the two social boards; "The sub-brands" left with its description right; four dotted sub-brand boards ending on "chapters & programs".
4. Confirm the panel ends at the last image — no "See other projects", no contact footer. That is Amanda's choice, not an omission.
5. `resize_window {preset: "mobile"}`, reload, screenshot: the two-column heading rows have stacked, images fill the width, nothing scrolls sideways.
6. `read_console_messages {onlyErrors: true}` — empty. Also `read_network_requests {urlPattern: "identity_final"}` — every image is `200`.

- [ ] **Step 4: Commit**

```bash
git add css/pf-brand.css project_identity/index.html
git commit -m "$(cat <<'MSG'
feat(project-nav): Identity's brand design sub-page

The twelve final-design boards on the brand's own #140335, one click from
the preview instead of buried in the case study. Layout is Amanda's three
Brand sketches; the image column caps at 1400px, the images' native width.
Ground colour is the one per-project value.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: The reading-progress bar

**Files:**
- Modify: `js/pf-projectnav.js` (append, inside the same IIFE, before the `window.PFProjectNav` assignment)

**Interfaces:**
- Consumes: `#pfProgress` from Task 1; `commit()`'s `PFProjectNav.onChange` hook from Task 2.

- [ ] **Step 1: Add the progress reader**

Append to `js/pf-projectnav.js`, immediately before the `window.PFProjectNav = {…}` block:

```js
  /* ---- reading progress ---------------------------------------------------
     Amanda: "please also add the progress bar underneath the nav bar just like
     the case study pages and the hazen page." Same maths as
     js/case-study.js's, and the same rAF-coalesced scroll listener: scroll
     position over scrollable height, written as a scaleX.

     It reads the DOCUMENT, and the document is whichever sub-page is in the
     flow -- so the bar measures the sub-page the reader is actually in, and
     resets to 0 on every switch because commit() scrolls to the top. */
  var progress = document.getElementById("pfProgress");
  var pTicking = false;

  /* Declared at the top level of the IIFE, not inside the `if (progress)`
     below. This file is in strict mode, where a function declaration inside a
     block is scoped to that block -- so defining it in there would leave
     onChange, further down, calling an undefined name. */
  function updateProgress() {
    pTicking = false;
    if (!progress) return;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var p = max > 0 ? window.scrollY / max : 0;
    if (p < 0) p = 0;
    if (p > 1) p = 1;
    progress.style.transform = "scaleX(" + p.toFixed(4) + ")";
  }

  function onProg() {
    if (!pTicking) {
      pTicking = true;
      window.requestAnimationFrame(updateProgress);
    }
  }

  if (progress) {
    window.addEventListener("scroll", onProg, { passive: true });
    window.addEventListener("resize", onProg);
    /* identity and aspire hijack the wheel and ease scrollY themselves, so a
       plain scroll event can lag a frame behind what is on screen; kayn and
       nobi run Lenis. Subscribing to whichever engine is present keeps the bar
       exactly in step. Both are optional and absent on a page without one. */
    if (window.ID && window.ID.onTick) window.ID.onTick(onProg);
    if (window.lenis && window.lenis.on) window.lenis.on("scroll", onProg);

    updateProgress();
  }
```

And give the `onChange` hook a body. Leave `onChange: null` in the object literal — it documents the slot — and assign to it immediately after, so `updateProgress` is already defined when `commit()` first fires it:

```js
  window.PFProjectNav = {
    show: show,
    onChange: null,
    get current() { return current; },
    get panels() { return panels; }
  };

  /* The new sub-page is a different height, and scrollY is back at 0. Both
     reach the bar through the resize commit() already dispatches, but that is
     an implementation detail of another function -- ask for it explicitly. */
  window.PFProjectNav.onChange = function () {
    if (progress) updateProgress();
  };
```

- [ ] **Step 2: Verify**

1. Load `/project_identity/`. `javascript_tool: getComputedStyle(document.getElementById('pfProgress')).transform` — a matrix with an x-scale at or near 0.
2. `window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight))`, wait a frame, read it again — x-scale is 1.
3. Screenshot mid-scroll: a black bar along the navbar's bottom edge, filling from the left.
4. Click "Brand design": the bar snaps back to 0. Scroll to the bottom of the brand page: it reaches 1. This proves it is measuring the sub-page, not the whole document from before.
5. Click "Case study" and repeat.
6. `read_console_messages {onlyErrors: true}` — empty.

- [ ] **Step 3: Commit**

```bash
git add js/pf-projectnav.js
git commit -m "$(cat <<'MSG'
feat(project-nav): reading progress under the bar

The case study pages' bar and the same maths, measuring whichever sub-page
is in the flow. Subscribes to identity's own scroll ticker so it does not
trail the eased position by a frame.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: The left/right push

Last, because everything already works without it and this is the part that degrades.

**Files:**
- Modify: `css/pf-projectnav.css` (append the view-transition block)

**Interfaces:**
- Consumes: `data-pf-slide="forward|back"` on `<html>`, and the `document.startViewTransition()` call, both written in Task 2's `show()`.

- [ ] **Step 1: Append the transition rules**

```css
/* ============================================================================
   THE PUSH
   ----------------------------------------------------------------------------
   Amanda: "There should also be a pushing left and right transition when
   switching between sub pages." Forward through the tabs, the outgoing
   sub-page is pushed off to the left and the new one arrives from the right;
   backward, the reverse.

   Drawn by the View Transitions API over a snapshot the browser takes for us,
   so no real element moves and nothing here can become a containing block for
   the fixed .gradient-field and .nav inside the web panel.

   ::view-transition-group(root) is everything WITHOUT a view-transition-name,
   and the root snapshot is viewport-sized however tall the page is -- so this
   costs one screen-sized capture per switch.

   THE BAR DOES NOT MOVE. It is named, which lifts it out of the root group,
   and its group's animation is switched off so the new state (a different pill
   lit, the bar reset to 0) simply appears. Amanda: the navbar "should be always
   on top and always visible", and a bar that slid out with the page would not
   be.

   js/pf-projectnav.js falls back to an instant swap when
   document.startViewTransition is missing, so nothing here needs a fallback of
   its own. Reduced motion is handled there too, for the same reason.
   ========================================================================== */

.pf-projnav { view-transition-name: pf-projnav; }

::view-transition-group(pf-projnav) { animation: none; }

@keyframes pf-slide-out-left  { to   { transform: translateX(-100%); } }
@keyframes pf-slide-in-right  { from { transform: translateX(100%); } }
@keyframes pf-slide-out-right { to   { transform: translateX(100%); } }
@keyframes pf-slide-in-left   { from { transform: translateX(-100%); } }

/* Both snapshots animate at once and neither fades: a cross-fade under a
   translate reads as a dissolve, not a push. The default root animation IS a
   cross-fade, which is why every one of these sets its own. */
html[data-pf-slide]::view-transition-old(root),
html[data-pf-slide]::view-transition-new(root) {
  animation-duration: 0.52s;
  animation-timing-function: cubic-bezier(0.22, 0.61, 0.36, 1);
  animation-fill-mode: both;
  mix-blend-mode: normal;
}
html[data-pf-slide]::view-transition-old(root) { opacity: 1; }
html[data-pf-slide]::view-transition-new(root) { opacity: 1; }

html[data-pf-slide="forward"]::view-transition-old(root) { animation-name: pf-slide-out-left; }
html[data-pf-slide="forward"]::view-transition-new(root) { animation-name: pf-slide-in-right; }
html[data-pf-slide="back"]::view-transition-old(root)    { animation-name: pf-slide-out-right; }
html[data-pf-slide="back"]::view-transition-new(root)    { animation-name: pf-slide-in-left; }

/* NOTE, on the horizontal overflow a translate normally causes: it does not
   apply here. The ::view-transition tree is rendered in the top layer, against
   the snapshot containing block -- it is not a descendant of anything in the
   document and it contributes no scrollable overflow, so a snapshot sliding a
   full viewport to the right does not widen the page. There is deliberately no
   `overflow-x: hidden` guard for it: an untargeted one would clip the page's
   own content for the rest of the visit, and the obvious targeted form,
   `html:has(::view-transition)`, is not a valid selector -- :has() matches
   elements, never pseudo-elements. Task 5's verification measures scrollWidth
   DURING a switch precisely so this claim is checked rather than trusted. If
   it ever does overflow, the fix is `:root { overflow-x: clip; }` scoped to
   these project pages, not a global hidden. */
```

- [ ] **Step 2: Verify the push**

1. Load `/project_identity/`. `javascript_tool: typeof document.startViewTransition` — expect `"function"` in the Browser pane's engine. If it reports `"undefined"`, the fallback is what is under test instead: confirm the swap is instant and correct, note it, and move on.
2. Click "Brand design" and immediately screenshot (`computer` batch: click, then screenshot with no wait). The old page should be part-way off to the left with the brand ground arriving from the right, and **the navbar sitting still, unmoved and fully painted**.
3. Click "Web design preview" and screenshot immediately: the push runs the other way.
4. `javascript_tool: document.documentElement.getAttribute('data-pf-slide')` a second after a switch — `null`. The attribute must not survive its transition.
5. `javascript_tool: document.documentElement.scrollWidth - document.documentElement.clientWidth` during and after a switch — `0` both times.
6. Click two tabs in fast succession. The page lands on the second one; nothing is left half-translated and no panel is left `hidden` when it should be visible.
7. Emulate reduced motion — `resize_window` cannot do this, so use `javascript_tool` to confirm the branch instead: `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. If the environment cannot report `true`, read `show()` and confirm by inspection that the reduced branch calls `commit()` and returns before touching `startViewTransition`.
8. `read_console_messages {onlyErrors: true}` — empty.

- [ ] **Step 3: Commit**

```bash
git add css/pf-projectnav.css
git commit -m "$(cat <<'MSG'
feat(project-nav): push left and right between sub-pages

View-transition keyframes over the root snapshot, so no real element moves
and nothing becomes a containing block for the web panel's fixed gradient
and header. The bar is named out of the group and does not travel with the
page. Browsers without the API keep the instant swap.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: Full pass, and hand it to Amanda

No new behaviour. This is the sweep that catches what task-by-task verification cannot: the interactions between them.

**Files:** whichever the pass turns up.

- [ ] **Step 1: Walk the whole page at three widths**

At 1600px, 1024px and 375px (`resize_window`, reloading after each switch so load-time device gates re-run), on every tab:

- The bar is at `top: 0`, painted, and above everything. Scroll to the middle of a sub-page and confirm it has not been overlapped by Identity's site header, the gradient field, the map, or the CTA.
- Nothing scrolls sideways: `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
- The hamburger opens, its menu is fully on screen and its links are clickable.
- The tab pill matches the panel on screen.

- [ ] **Step 2: Re-check the things this change was most likely to break**

1. **The deck.** Web tab, scroll slowly through every slide. Each is centred below the bar and none is clipped. Then switch away to Brand, back to Web, and scroll through again — this is the path where a stale `measure()` would show up.
2. **The map.** `js/map.js` binds to a deck slide index. Scroll to the map slide and confirm it draws and responds to hover.
3. **The gradient.** It should track scroll on the web tab and be invisible behind the brand and case panels (it is inside the web panel, so `display: none` takes it with them). Confirm with `javascript_tool: document.querySelector('.gradient-field').getBoundingClientRect().height` — `0` while another tab is showing.
4. **The intro cover.** Reload `/project_identity/` from the homepage thumbnail. The `#0C021A` screen still lifts, and the bar is not underneath it — check the bar is visible from the first frame, or deliberately covered and then revealed. If the cover paints over the bar, that is a finding: raise it rather than fixing it silently, since the cover's colour is per-project and Amanda picked it.
5. **The case study link.** "Read the case study" on the Case study tab still opens `/project_identity/casestudy/`.
6. **The generator.** Run it and confirm it makes no changes it should not:
   ```bash
   python3 scripts/gen-master-suggestion.py && git diff --stat
   ```
   Expected: the suggestion block is rewritten identically, or not at all. If it errors or rewrites the wrong region, its `BEGIN`/`END` markers did not survive Task 2 — fix the markup, not the script.
7. **The other three pages are untouched.** Load `/project_aspire/`, `/project_kayn/` and `/project_nobi/`. Each still has its floating hamburger in the corner, its bridge band at the end, and its sliding process sheet. `git status` shows no files changed under those directories.

- [ ] **Step 3: Confirm the requirement list, one by one**

Read Amanda's ten points against the running page and write down which line of evidence satisfies each. Any that cannot be evidenced is unfinished — say so plainly rather than reporting the task complete.

- [ ] **Step 4: Commit whatever the pass fixed, and stop**

```bash
git add -A
git commit -m "$(cat <<'MSG'
fix(project-nav): full-pass corrections on Identity

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

**Do not push.** Tell Amanda the Identity page is ready at `http://localhost:8000/project_identity/`, hand her the three tab URLs, and name the two things to look at with fresh eyes:

- the 1400px image column against her sketches' narrower one (see the departure note at the top of this plan);
- the two hamburgers now stacked on mobile — the project navbar's, and Identity's own site burger in the preview below it.

---

## Phase two, after sign-off

Aspire, Kayn and NOBI are a separate plan, written once Amanda has approved Identity — her instruction: "finalize that first before adapting to the other 3. So there won't be double work when there is a revision."

What that plan will have to establish per page, and which this plan deliberately does not guess at:

| | Brand ground | Brand content | Scroll engine |
|---|---|---|---|
| Aspire | unset | `images/project_aspire_ds/` | hand-rolled, `project_aspire/scroll.js` |
| Kayn | unset | `images/project_kayn/kayn_showcase_*.webp` | Lenis |
| NOBI | `#291217`, sampled from `New project nav - Brand NOBI.png` | `images/project_nobi/nobi_showcase_*.webp` | Lenis |

Each page needs its own version of Task 1 Step 3 — its fixed header and its viewport-height maths taught `--pf-nav-h` — and each has a different answer. `css/pf-projectnav.css`, `js/pf-projectnav.js` and `css/pf-brand.css` should need no changes at all; if one of them does, that is a sign this plan hard-coded something about Identity that belonged on the page.
