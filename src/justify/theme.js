// What the theme does with script: gives an article that opens like prose
// its drop cap, runs the opening word in beside the capital, and has the
// engine set the justified lines. Without Article JavaScript the stylesheet
// alone sets the page: no capital, phones ragged right, the Mac justified
// by the browser.
var body = document.getElementById("bodyContainer");
if (body) {
    var root = document.documentElement;
    var controller = null;

    // The article's first text paragraph, as the stylesheet finds it.
    function opening() {
        var ps = body.getElementsByTagName("p");
        for (var i = 0; i < ps.length; i++) {
            if (getComputedStyle(ps[i]).getPropertyValue("--drop-cap").trim() === "1") return ps[i];
        }
        return null;
    }

    // The lines of text in a paragraph, top and bottom, and whether a
    // capital two lines tall stands at its head. The capital's own box is
    // the tall one; a line of text is one line high.
    function shape(p) {
        var line = parseFloat(getComputedStyle(p).lineHeight);
        var range = document.createRange();
        range.selectNodeContents(p);
        var rects = range.getClientRects();
        var top = Infinity, bottom = -Infinity, capital = false;
        for (var j = 0; j < rects.length; j++) {
            if (rects[j].height > line * 1.5) { capital = capital || rects[j].width > 0; continue; }
            if (rects[j].width === 0) continue;
            top = Math.min(top, rects[j].top);
            bottom = Math.max(bottom, rects[j].bottom);
        }
        return { line: line, lines: top === Infinity || !(line > 0) ? 0 : (bottom - top) / line, capital: capital };
    }

    // The printed books run the rest of the opening word in small caps
    // beside the initial; after a one-letter word ("A", "I") the run-in
    // takes the next word. Done once: the words go into spans, the text
    // itself does not change. Only when the paragraph opens on a plain
    // capital A to Z in its own text, with a word to run in: an opening
    // inside a link, on a quotation mark, a digit or an emoji, or on a
    // letter with a mark touching it ("I'll") gets no spans and so no
    // capital. A word keeps its own apostrophes and hyphens ("Don't",
    // "Well-being").
    var WORD = "\\p{L}[\\p{L}\\p{M}'\\u2019\\u2010-]*";
    var OPENING = new RegExp("^(\\s*)([A-Z])(?:(" + WORD + ")|(\\s+)(" + WORD + "))?(?=$|[^\\p{L}\\p{M}'\\u2019\\u2010-])", "u");
    function markRunIn(p) {
        if (p.querySelector(".pb-runin")) return;
        var node = p.firstChild;
        if (!node || node.nodeType !== 3) return;
        var text = node.nodeValue;
        var m = OPENING.exec(text);
        if (!m || (!m[3] && !m[5])) return;
        var capEnd = m[1].length + m[2].length;
        var oneLetter = !m[3];
        var runStart = oneLetter ? capEnd + m[4].length : capEnd;
        var runEnd = runStart + (oneLetter ? m[5] : m[3]).length;
        var rest = document.createTextNode(text.slice(runEnd));
        var span = document.createElement("span");
        span.className = "pb-runin";
        span.textContent = text.slice(runStart, runEnd);
        node.nodeValue = text.slice(0, capEnd);
        p.insertBefore(span, node.nextSibling);
        p.insertBefore(rest, span.nextSibling);
        if (oneLetter) {
            // The word space stays in the text and is given no width, so
            // line 1 starts where the fit puts it.
            var gap = document.createElement("span");
            gap.className = "pb-runin-gap";
            gap.textContent = m[4];
            p.insertBefore(gap, span);
            p.dataset.oneLetter = "";
        }
        p.dataset.cap = m[2];
    }

    // Where the two lines beside the capital start, for this letter at
    // this leading (drop-caps.js).
    function fit(p) {
        var letter = p.dataset.cap;
        var cs = getComputedStyle(p);
        var narrow = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) < 1.6;
        var row = (narrow ? FIT_NARROW : FIT_WIDE)[letter];
        p.style.setProperty("--cap-top", (narrow ? TOP_NARROW : TOP_WIDE) + "em");
        p.style.setProperty("--cap-fit", row[0] + "em");
        p.style.setProperty("--cap-lead", (row[1] + ("oneLetter" in p.dataset ? ONE_LETTER_LEAD : 0)).toFixed(3) + "em");
    }

    // At least three letters stay on each side of a break.
    function hyphenate(word) {
        var parts = hyphenateEnUS(word).slice();
        while (parts.length > 1 && parts[0].length < 3) parts.splice(0, 2, parts[0] + parts[1]);
        while (parts.length > 1 && parts[parts.length - 1].length < 3) parts.splice(-2, 2, parts[parts.length - 2] + parts[parts.length - 1]);
        return parts;
    }

    // The capital belongs to an article that opens like prose: a paragraph
    // that starts on a word (markRunIn) and runs to two lines or more, the
    // height of the capital. A byline or a one-line link post stays plain
    // text.
    // Counted without the capital, so the answer does not depend on the
    // last one.
    function mark(p) {
        p.classList.remove("pb-opening");
        markRunIn(p);
        if (!p.dataset.cap || shape(p).lines < 1.5) return;
        p.classList.add("pb-opening");
        fit(p);
    }

    function release() {
        if (controller) { controller.destroy(); controller = null; }
        delete root.dataset.justify;
    }

    // What a feed can float: an element with its own style, or a picture or
    // table with the align attribute. The stylesheet floats nothing but the
    // capital.
    function floated() {
        return [].filter.call(body.querySelectorAll('[style*="float"], [align]'), function (el) { return getComputedStyle(el).float !== "none"; })
            .map(function (el) {
                var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
                // The room a float keeps clear includes its margins.
                return { el: el, top: r.top - (parseFloat(cs.marginTop) || 0), bottom: r.bottom + (parseFloat(cs.marginBottom) || 0), height: r.height };
            });
    }

    // Left as the stylesheet sets it: a paragraph with a picture floated
    // beside it (its lines are of several lengths); one that keeps its
    // white space as written (verse, columns of figures); and one in or
    // holding a right-to-left script, or ruby.
    var RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
    var KEPT = /^(pre|pre-wrap|pre-line|break-spaces)$/;
    // White space that would show as written: a line break, a tab, or more
    // than one space together. Inline code that keeps its white space but
    // has only single spaces sets like any other words.
    var WRITTEN = /[\n\r\t]| {2}/;
    function keeps(el) {
        return KEPT.test(getComputedStyle(el).whiteSpace) && WRITTEN.test(el.textContent);
    }
    function plain(p, floats) {
        var cs = getComputedStyle(p);
        if (cs.direction === "rtl" || RTL.test(p.textContent) || p.querySelector("[dir], bdo, bdi, ruby")) return false;
        if (keeps(p)) return false;
        var inside = p.querySelectorAll("[style], pre, code, kbd, samp, tt, textarea");
        for (var k = 0; k < inside.length; k++) if (keeps(inside[k])) return false;
        var box = p.getBoundingClientRect();
        for (var i = 0; i < floats.length; i++) {
            var f = floats[i];
            if (p.contains(f.el) || f.el.contains(p)) return false;
            if (f.bottom > box.top + 1 && f.top < box.bottom - 1) return false;
        }
        return true;
    }

    function set() {
        release();
        try {
            var first = opening();
            var capital = false;
            if (first) {
                mark(first);
                capital = first.classList.contains("pb-opening") && shape(first).capital;
            }
            // On a phone the stylesheet sets paragraphs ragged; "choosing" asks
            // it which of them would be justified were the lines set.
            root.dataset.justify = "choosing";
            var floats = floated();
            var targets = [].filter.call(body.getElementsByTagName("p"), function (p) {
                return getComputedStyle(p).textAlign === "justify" && plain(p, floats);
            });
            root.dataset.justify = "on";
            if (!targets.length) { release(); return; }
            controller = justify(targets, {
                hyphenate: hyphenate,
                dropCap: function (p) { return capital && p === first; },
            });
            // A line well past its column (hanging punctuation is under half
            // an em) was set for other widths than the paragraph has. That
            // paragraph goes back to the stylesheet; the rest stay.
            controller.managed.slice().forEach(function (p) {
                var edge = p.getBoundingClientRect().right + 0.6 * parseFloat(getComputedStyle(p).fontSize);
                var astray = [].some.call(p.querySelectorAll("span." + LINE), function (line) { return line.getBoundingClientRect().right > edge; });
                if (astray) controller.drop(p);
            });
        } catch (e) {
            release();
        }
    }

    // Every later setting goes through one timer, and nothing sets the
    // lines before the first setting has.
    var started = false, pending = 0;
    function again() {
        if (!started) return;
        clearTimeout(pending);
        pending = setTimeout(set, 150);
    }
    function start() {
        if (started) return;
        started = true;
        set();
    }
    // The capital is marked at once; the lines wait for the fonts, whose
    // widths they are set to. From a task of its own: a promise can settle
    // while the browser is delivering resize observations, and changing
    // the layout there is an error. If the fonts are slow the lines are set
    // without them and set again when they come.
    var early = opening();
    if (early) mark(early);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { setTimeout(function () { if (started) again(); else start(); }, 0); });
        setTimeout(start, 1500);
    } else setTimeout(start, 0);

    // The lines are set for one column and one text size. Setting them
    // changes the body's height, so only a change of width starts over. If
    // the width comes back to what it was two changes ago within a moment
    // (a scrollbar that the new height brings and takes away), it is left.
    if (window.ResizeObserver) {
        var widths = [body.getBoundingClientRect().width], since = Date.now();
        new ResizeObserver(function () {
            var now = body.getBoundingClientRect().width;
            if (Math.abs(now - widths[widths.length - 1]) < 0.5) return;
            if (Date.now() - since > 3000) widths = widths.slice(-1);
            since = Date.now();
            var back = widths.length > 1 && Math.abs(now - widths[widths.length - 2]) < 0.5;
            widths.push(now);
            if (back && widths.length > 3) return;
            again();
        }).observe(body);
        var em = document.createElement("span");
        em.setAttribute("aria-hidden", "true");
        em.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:1em;height:0";
        body.appendChild(em);
        var size = em.getBoundingClientRect().width;
        new ResizeObserver(function () {
            var now = em.getBoundingClientRect().width;
            if (Math.abs(now - size) < 0.01) return;
            size = now;
            again();
        }).observe(em);
    }
    // A picture that gets its size late moves the floats and the lines
    // beside them, and so does a section the reader opens. Neither event
    // bubbles; both are caught on the way down.
    body.addEventListener("load", again, true);
    body.addEventListener("toggle", again, true);
    window.addEventListener("beforeprint", function () { clearTimeout(pending); release(); });
    window.addEventListener("afterprint", again);
}
