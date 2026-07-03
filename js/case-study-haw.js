/* ============================================================
   Case Study: "How Aspire Works" — page-specific interactions.
   Only the Discovery Q&A needs custom JS; everything else
   (TOC scroll-spy, reading progress, sidebar toggle, mobile TOC,
   one-shot reveals) is handled by the shared case-study.js.

   Desktop: 2-column tabs — questions left, active answer panel right.
   Mobile (<=900px): accordion — each panel is moved to sit directly
   under its question, and the active one expands beneath it.
   ============================================================ */
(function () {
  "use strict";

  function initQA() {
    var qa = document.querySelector(".cs-qa");
    if (!qa) return;

    var panelsWrap = qa.querySelector(".cs-qa__panels");
    var questions = Array.prototype.slice.call(qa.querySelectorAll(".cs-qa__q"));
    var panels = Array.prototype.slice.call(qa.querySelectorAll(".cs-qa__panel"));
    if (!questions.length || !panels.length || !panelsWrap) return;

    function panelFor(key) {
      for (var i = 0; i < panels.length; i++) {
        if (panels[i].getAttribute("data-qa") === key) return panels[i];
      }
      return null;
    }

    function activate(key) {
      questions.forEach(function (q) {
        var on = q.getAttribute("data-qa") === key;
        q.classList.toggle("is-active", on);
        q.setAttribute("aria-selected", on ? "true" : "false");
      });
      panels.forEach(function (p) {
        p.classList.toggle("is-active", p.getAttribute("data-qa") === key);
      });
    }

    function collapseAll() {
      questions.forEach(function (q) {
        q.classList.remove("is-active");
        q.setAttribute("aria-selected", "false");
      });
      panels.forEach(function (p) {
        p.classList.remove("is-active");
      });
    }

    var mq = window.matchMedia("(max-width: 900px)");

    function layout() {
      if (mq.matches) {
        // accordion: place each panel right after its own question
        questions.forEach(function (q) {
          var p = panelFor(q.getAttribute("data-qa"));
          if (p) q.insertAdjacentElement("afterend", p);
        });
      } else {
        // desktop: return all panels to the right column, in order
        questions.forEach(function (q) {
          var p = panelFor(q.getAttribute("data-qa"));
          if (p) panelsWrap.appendChild(p);
        });
        // desktop is a tab layout — never leave the right column empty
        if (!qa.querySelector(".cs-qa__q.is-active")) {
          activate(questions[0].getAttribute("data-qa"));
        }
      }
    }

    questions.forEach(function (q) {
      q.addEventListener("click", function () {
        // mobile accordion: re-clicking the open question collapses it
        if (mq.matches && q.classList.contains("is-active")) {
          collapseAll();
        } else {
          activate(q.getAttribute("data-qa"));
        }
      });
    });

    layout();
    if (mq.addEventListener) {
      mq.addEventListener("change", layout);
    } else if (mq.addListener) {
      mq.addListener(layout); // Safari < 14
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initQA);
  } else {
    initQA();
  }
})();
