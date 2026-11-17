/* ============================================================
   THE TOP OF THE PAGE — hero, "What I bring to the team", Works

   Amanda: "Please make the transition from hero -> USP -> work
   section similar to the current live version: Fading in and out
   with slight movement." And of a first cut, which let the USP
   scroll away with the page while the works came up under it:
   "The transition from USPs section to works section is wrong,
   please make it like what you did on Hero -> USPs."

   So both handovers are one gesture, with the live intro's own
   numbers: the section on screen fades out carrying DRIFT px of
   movement upward, then the next fades in from DRIFT px below, in
   the same place, scrubbed by the scroll at 0.6 so scrolling back
   rewinds it.

     WHERE A SECTION FITS ONE SCREEN (1200 x 680 and up, and no wider
     than 9:4; css/home.css says why the shape matters) all three
     take turns on a stage that sticks under the header. The beats
     are in SCREENS of scroll, a screen being the viewport's height
     plus the header's, which is the length the hero's exit was first
     timed on:

       0.00 - 0.08   the hero, as it loaded
       0.08 - 0.30   the hero leaves upward
       0.30 - 0.50   the USP arrives from below
       0.50 - 1.00   the USP holds: time to read it, and to click it
       1.00 - 1.22   the USP leaves upward, as the hero did
       1.22 - 1.42   the works arrive from below, as the USP did
       1.42 - 1.50   a beat, and the stage lets go

     From there the works are ordinary content and scroll on.

     ANYWHERE SMALLER the sections stay in ordinary flow, and each
     piece fades up as it reaches the screen.

   A hold is a span no tween covers, the same shape js/scenes-outro.js
   uses. Start states live in css/home.css under html.motion, so there
   is no frame where something is visible before this file takes it.

   Published for js/home.js: V3.workAt(), the scroll position at which
   the works are on screen, for every link that goes to them; and
   V3.uspAt(), the same for "What I bring to the team" (the hero's
   "6 years" link).
   ============================================================ */
(function () {
  "use strict";
  if (!window.V3 || !window.V3.ready) return;

  var DRIFT = 28;                       // px carried by each fade; the live intro's own
  var STAGED = "(min-width: 1200px) and (min-height: 680px) and (max-aspect-ratio: 9/4)";
  var FLOWING = "not all and " + STAGED;      // exactly everywhere else

  /* The beats, in screens (above). RUN is in css/home.css as well, as the
     height of .lead::after, the runway the stage sticks for. */
  var RUN = 1.5;
  var LEAVE = 0.22, ARRIVE = 0.20;      // how long a section takes to go, and to come
  var HERO_OUT = 0.08, USP_IN = 0.30, USP_OUT = 1.00, WORK_IN = 1.22;

  var lead = document.getElementById("lead");
  var stage = lead && lead.querySelector(".lead__stage");
  var hero = document.getElementById("hero");
  var usp = document.getElementById("offer");
  var work = document.getElementById("work");
  var mm = gsap.matchMedia();

  function headerHeight() {
    var header = document.querySelector(".header");
    return header ? Math.round(header.getBoundingClientRect().height) : 88;
  }

  /* One element fading up as it scrolls into view. Its own trigger, keyed
     to its own top, so it animates when IT arrives rather than when its
     section does. */
  function arrive(el) {
    return gsap.fromTo(el,
      { opacity: 0, y: DRIFT },
      { opacity: 1, y: 0, ease: "none",
        scrollTrigger: { trigger: el, start: "top 96%", end: "top 68%", scrub: 0.6 } });
  }

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  function jump(y) {
    var lenis = window.V3.lenis;
    if (lenis && lenis.scrollTo) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }

  if (!lead || !stage || !hero || !usp || !work) return;

  /* ---------- the three, taking turns ---------- */
  mm.add(STAGED, function () {
    /* The scroll position a point on the runway is at, measured fresh from
       the page rather than read from the trigger, so it is right even
       before the trigger's first refresh. #lead's top meets the header's
       bottom at the start; the runway is what #lead holds beyond the stage. */
    function at(screens) {
      var start = lead.getBoundingClientRect().top + window.pageYOffset - headerHeight();
      return start + (lead.offsetHeight - stage.offsetHeight) * screens / RUN;
    }

    /* Which section takes the pointer: the one on screen, handing over in
       the middle of each fade. All three are stacked in one place, and an
       invisible layer on top would swallow every click meant for the one
       that is showing. */
    function live(now) {
      hero.classList.toggle("is-live", now < HERO_OUT + LEAVE / 2);
      usp.classList.toggle("is-live", now > USP_IN + ARRIVE / 2 && now < USP_OUT + LEAVE / 2);
      work.classList.toggle("is-live", now > WORK_IN + ARRIVE / 2);
    }

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: lead,
        start: function () { return "top " + headerHeight() + "px"; },
        /* Exactly as long as the stage sticks, which is the runway's height. */
        end: function () { return "+=" + (lead.offsetHeight - stage.offsetHeight); },
        scrub: 0.6,
        onUpdate: function (self) { live(self.progress * RUN); },
        onRefresh: function (self) { live(self.progress * RUN); }
      }
    });

    tl.to(hero, { opacity: 0, y: -DRIFT, ease: "none", duration: LEAVE }, HERO_OUT)
      .fromTo(usp, { opacity: 0, y: DRIFT }, { opacity: 1, y: 0, ease: "none", duration: ARRIVE }, USP_IN)
      /* immediateRender off: the tween above owns the USP's start state, and
         this one must not overwrite it the moment it is created. */
      .fromTo(usp, { opacity: 1, y: 0 },
        { opacity: 0, y: -DRIFT, ease: "none", duration: LEAVE, immediateRender: false }, USP_OUT)
      .fromTo(work, { opacity: 0, y: DRIFT }, { opacity: 1, y: 0, ease: "none", duration: ARRIVE }, WORK_IN);

    /* Force the timeline's length to exactly RUN, so every position above is
       in screens and the last beat runs to where the stage lets go. */
    tl.to({ _pad: 0 }, { _pad: 1, ease: "none", duration: RUN }, 0);

    /* The end of the runway: the works are in, under the header, and the
       next scroll moves them. */
    window.V3.workAt = function () { return Math.round(at(RUN)); };
    /* The middle of the USP's hold, for the hero's "6 years" link (Amanda,
       17 Nov 2026): the same point the keyboard is brought to below. */
    window.V3.uspAt = function () { return Math.round(at((USP_IN + ARRIVE + USP_OUT) / 2)); };

    /* A keyboard visitor can Tab into a section that is not on screen, and
       would then be moving through links nobody can see. Bring the section
       they are in onto the stage instead. Focus on the works' own section is
       js/home.js marking the arrival of a scroll it is already making. */
    function onFocus(e) {
      var t = e.target;
      var now = tl.scrollTrigger.progress * RUN;
      var to = -1;
      if (t === work || t === usp) return;
      if (hero.contains(t) && now > HERO_OUT + LEAVE / 2) to = 0;
      else if (usp.contains(t) && (now < USP_IN + ARRIVE / 2 || now > USP_OUT + LEAVE / 2)) to = (USP_IN + ARRIVE + USP_OUT) / 2;
      else if (work.contains(t) && now < WORK_IN + ARRIVE / 2) to = RUN;
      if (to >= 0) jump(Math.round(at(to)));
    }
    lead.addEventListener("focusin", onFocus);

    return function () {
      lead.removeEventListener("focusin", onFocus);
      window.V3.workAt = null;
      window.V3.uspAt = null;
      hero.classList.add("is-live");
      usp.classList.remove("is-live");
      work.classList.remove("is-live");
    };
  });

  /* ---------- in ordinary flow ----------
     The works only as far as what the section opens on. The rest of the
     design work has its own arrival when "See more" is pressed, and the AI
     tab's when it is switched to (css/home.css); a scroll trigger on things
     that are not in the page yet would have nothing to measure. */
  mm.add({ flowing: FLOWING, phone: "(max-width: 760px)" }, function (context) {
    if (!context.conditions.flowing) return;
    each(".usp__title, .usp__item, .pj__head, #pjPanelDesign > .pj__grid > li", arrive);
    /* On a phone the visual sits under the selected item and moves when
       another is picked (css/home.css), so it is left out: a trigger keyed
       to where it was would leave it half faded where it is. */
    if (!context.conditions.phone) each(".usp__visual", arrive);
  });
})();
