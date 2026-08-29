/* ============================================================================
   PORTFOLIO CHROME — behavior
   ----------------------------------------------------------------------------
   ES5 on purpose. These five pages are served as plain files with no build
   step, and two of them already ship ES5-only scripts; a single arrow function
   here would be the only thing on the page that needs a transpiler.
   ========================================================================== */
(function (window, document) {
  "use strict";

  var PF = (window.PFChrome = window.PFChrome || {});

  /* ---- the floating nav dock ---------------------------------------------- */
  var dock = document.querySelector("[data-pf-dock]");
  if (dock) {
    var btn = dock.querySelector(".pf-dock__btn");
    var menu = dock.querySelector(".pf-dock__menu");
    var open = false;
    var hideTimer = null;

    function setOpen(next) {
      if (next === open) return;
      open = next;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close site menu" : "Open site menu");

      if (open) {
        clearTimeout(hideTimer);
        menu.hidden = false;
        /* Force a reflow so the opacity/transform transition has a start frame
           to run from — without this the menu appears fully open. */
        void menu.offsetHeight;
        dock.classList.add("is-open");
      } else {
        dock.classList.remove("is-open");
        hideTimer = setTimeout(function () {
          if (!open) menu.hidden = true;
        }, 400);
      }
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!open);
    });

    /* Following a link closes the dock, so returning via the back button does
       not land on a page with the menu still hanging open. */
    menu.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".pf-dock__link")) setOpen(false);
    });

    document.addEventListener("click", function (e) {
      if (!open) return;
      if (e.target.closest && e.target.closest("[data-pf-dock]")) return;
      setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (!open) return;
      if (e.key === "Escape" || e.key === "Esc") {
        setOpen(false);
        btn.focus();
      }
    });

    PF.dock = {
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      get isOpen() { return open; }
    };
  }

  /* ---- footer: click-to-copy email + toast --------------------------------
     Two paths because navigator.clipboard needs a secure context, and these
     pages are also opened straight off the filesystem while being worked on.
     Both paths resolve to a real boolean all the way through -- the click
     handler below tells the truth about whether the copy actually worked,
     rather than announcing success unconditionally. A mailto: link sits
     beside the button in the markup as a fallback route to the same address,
     for the case where neither path succeeds. */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.parentNode.removeChild(ta);
    return ok;
  }

  PF.copy = copyText;

  var emailBtn = document.querySelector(".pf-foot__email");
  var toast = document.querySelector(".pf-foot__toast");
  if (emailBtn && toast) {
    var toastTimer = null;
    /* The toast ships empty in the markup; role="status" aria-live="polite"
       only announces on a content change, so writing the text here (rather
       than just toggling a class on text that was already sitting in the
       DOM) is what makes it actually speak. Cleared again once the fade-out
       finishes, so nothing lingers in the accessibility tree between uses. */
    toast.addEventListener("transitionend", function (e) {
      if (e.propertyName === "opacity" && !toast.classList.contains("is-shown")) {
        toast.textContent = "";
      }
    });
    emailBtn.addEventListener("click", function () {
      var text = emailBtn.getAttribute("data-pf-copy") || emailBtn.textContent.trim();
      copyText(text).then(function (ok) {
        toast.textContent = ok ? "Copied to clipboard" : "Couldn’t copy — copy it manually";
        toast.classList.add("is-shown");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove("is-shown"); }, 1900);
      });
    });
  }
})(window, document);
