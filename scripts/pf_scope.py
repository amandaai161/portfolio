"""Shared machinery for the scoped chrome stylesheets.

pf-footer.css and pf-header.css both take rules out of v3's own stylesheets and
re-emit them under a scope class, so they can load on pages that cannot take
v3's global reset. Both need the same two things: a CSS walker that survives
comments and nested at-rules, and a collector that finds EVERY rule touching a
set of class names -- wherever it lives in the file.

That last part is the whole reason this module exists. An earlier version pulled
only the one banner-delimited block per component, and quietly missed the mobile
overrides sitting in styles.css's own @media block hundreds of lines further
down: .contact__title { white-space: normal }, .nav { display: none },
.nav-toggle { display: inline-flex }. Without them the footer headline would not
wrap on a phone -- it overflowed the viewport and pushed the host page's own
hamburger off-screen -- and a scoped header would never collapse to its burger.
Collect by selector, not by neighbourhood.
"""
import re


def split_top(css):
    """Yield ('raw', text) | ('rule', selector, body) | ('at', prelude, body)."""
    out, i, n, buf = [], 0, len(css), ""
    while i < n:
        if css.startswith("/*", i):
            j = css.find("*/", i + 2)
            j = n if j < 0 else j + 2
            buf += css[i:j]; i = j; continue
        if css[i] == "{":
            head, buf = buf, ""
            depth, j = 1, i + 1
            while j < n and depth:
                if css.startswith("/*", j):
                    k = css.find("*/", j + 2); j = n if k < 0 else k + 2; continue
                if css[j] == "{": depth += 1
                elif css[j] == "}": depth -= 1
                j += 1
            body = css[i + 1:j - 1]
            # GREEDY to the LAST "*/": a head can hold several comments, and a
            # selector can never contain "*/".
            m = re.search(r"(?s)\A(.*\*/)?(.*)\Z", head)
            lead, sel = (m.group(1) or ""), m.group(2).strip()
            if lead: out.append(("raw", lead))
            out.append(("at" if sel.startswith("@") else "rule", sel, body))
            i = j; continue
        buf += css[i]; i += 1
    if buf: out.append(("raw", buf))
    return out


def _touches(selector, classes):
    names = set(re.findall(r"\.([A-Za-z0-9_-]+)", selector))
    return any(n == c or n.startswith(c + "__") or n.startswith(c + "--") for n in names for c in classes)


def collect(css, classes):
    """Every rule whose selector list mentions one of `classes`, in source order,
    with any @media / @supports wrapper preserved around it."""
    out = []
    for chunk in split_top(css):
        if chunk[0] == "rule":
            sels = [s.strip() for s in chunk[1].split(",") if s.strip()]
            keep = [s for s in sels if _touches(s, classes)]
            if keep:
                out.append(",\n".join(keep) + " {" + chunk[2] + "}\n")
        elif chunk[0] == "at":
            prelude, body = chunk[1], chunk[2]
            if re.match(r"@(media|supports|layer|container)\b", prelude):
                inner = collect(body, classes)
                if inner.strip():
                    out.append("\n" + prelude + " {\n" + inner + "}\n")
    return "".join(out)


def scope(css, scope_class):
    """Prefix every selector with `scope_class`, recursing into at-rules."""
    out = []
    for chunk in split_top(css):
        if chunk[0] == "raw":
            out.append(chunk[1])
        elif chunk[0] == "at":
            prelude, body = chunk[1], chunk[2]
            if re.match(r"@(media|supports|layer|container)\b", prelude):
                out.append("\n" + prelude + " {" + scope(body, scope_class) + "\n}\n")
            else:                       # @font-face, @keyframes: leave alone
                out.append(prelude + " {" + body + "}")
        else:
            parts = []
            for s in chunk[1].split(","):
                s = s.strip()
                if not s: continue
                parts.append(scope_class if s in (":root", "html", "body")
                             else scope_class + " " + s)
            out.append(",\n".join(parts) + " {" + chunk[2] + "}")
    return "".join(out)


def reflow(css):
    css = re.sub(r"\*/(?=\.pf-)", "*/\n", css)
    css = re.sub(r"\}(?=\.pf-)", "}\n", css)
    css = re.sub(r"\}(?=@)", "}\n", css)
    return re.sub(r"\n{4,}", "\n\n\n", css)
