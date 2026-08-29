/* ============================================================
   Shared project-card interaction (home + case-study "Other projects").
     · A cursor-following label for ANY [data-cursor] element
       (project cards + the home hero intro link).
     · For .pj cards: dim/blur the page and focus the hovered card,
       driven by a NON-INTERRUPTIBLE queue — every intro/outro runs to
       completion before the next starts, so moving straight from one
       card to another plays the first card's full outro, then the next
       card's intro (no abrupt mid-animation cuts).
       Asymmetric timing matched to the CSS: intro ~220ms, outro ~140ms.
   ============================================================ */
(function () {
  "use strict";

  var finePointer = window.matchMedia("(hover: hover)").matches;
  var targets = document.querySelectorAll("[data-cursor]");
  if (!targets.length || !finePointer) return;

  /* ---------- cursor-following label ---------- */
  var label = document.createElement("div");
  label.className = "cursor-label";
  document.body.appendChild(label);
  var moveLabel = function (e) {
    label.style.transform =
      "translate3d(" + (e.clientX + 16) + "px," + (e.clientY + 18) + "px, 0)";
  };

  /* ---------- dim + focus queue (.pj cards only) ---------- */
  var INTRO = 220, OUTRO = 140;
  var focused = null;   // currently-focused card (or null)
  var busy = false;     // an intro/outro is playing
  var pending;          // next target (card | null); undefined = nothing queued

  function apply(target) {
    busy = true;
    var dur;
    if (target) {
      focused = target;
      document.body.classList.add("is-dimming");
      target.classList.add("is-focused");
      dur = INTRO;
    } else {
      if (focused) focused.classList.remove("is-focused");
      document.body.classList.remove("is-dimming");
      focused = null;
      dur = OUTRO;
    }
    setTimeout(function () {
      busy = false;
      if (typeof pending !== "undefined") {
        var next = pending;
        pending = undefined;
        request(next);
      }
    }, dur);
  }

  function request(target) {
    if (busy) { pending = target; return; }         // let the running animation finish
    if (target === focused) return;
    if (target && focused) {                         // A -> B: outro A first, then intro B
      pending = target;
      apply(null);
      return;
    }
    apply(target);                                   // plain intro (null->card) or outro (card->null)
  }

  targets.forEach(function (el) {
    var isCard = el.classList.contains("pj");
    el.addEventListener("pointerenter", function () {
      label.textContent = el.getAttribute("data-cursor") || "View project";
      label.classList.add("is-visible");
      if (isCard) request(el);
    });
    el.addEventListener("pointermove", moveLabel);
    el.addEventListener("pointerleave", function () {
      label.classList.remove("is-visible");
      if (isCard) request(null);
    });
  });
})();
