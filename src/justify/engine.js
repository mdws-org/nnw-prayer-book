// From orthodoxprayers.net (mdws-org/orthodoxprayers, justify-engine.js), with two
// additions for feed articles: the dropCap option; pictures and controls
// inside a paragraph taken as boxes; no hyphen where an element forbids it
// or in a word with letters beyond A to Z; drop(p) on the controller.
//
// Sets justified prose a paragraph at a time.
//
// A browser justifies one line at a time and can only widen word spaces. On
// a phone's forty-character line that leaves one line in five with a gap
// over twice the font's space. Here the breaks are chosen for the whole
// paragraph (Knuth and Plass, total fit), a word space may close as well as
// open, and what is left is spread over the letters of the line.
//
// justify(paragraphs, { hyphenate, onSkip, dropCap }) returns { managed,
// ready, destroy }. dropCap(p) says whether a paragraph opens on a floated
// initial; without it the paragraph's ::first-letter is asked. Each line becomes one or more inline spans that do not wrap,
// carrying that line's word and letter spacing; the space between two lines
// stays in the text and is the only place the browser may break. No
// character is added to or taken from the text: a line-end hyphen is
// generated content, and the break after it is an empty <wbr>.
//
// What it does not set, and leaves to the browser's own justification
// through onSkip: a paragraph with a word wider than its line, and one with
// an inline box that stands alone between two spaces. Text is taken as
// left-to-right, and only the ASCII space separates words.

const SPACE = { stretch: 0.5, shrink: 0.2 };   // of the font's own space
const TRACK = 0.03;                            // of the line width, either way
const HYPHEN_COST = 60;
const DOUBLE_HYPHEN = 4000;                    // two hyphenated lines in a row
const MAX_HYPHEN_RUN = 2;
const LOOSEST = 12;                            // ratio past which a line is refused
const CLASS = "justified";
// The class of a set line's spans, for the caller to find them by.
export const LINE = CLASS;
// How much of a character at the end of a line stands outside the column,
// as a share of its width: a stop or a quotation mark hangs whole, the rest
// in part. And how much of an opening quotation mark at the start of one.
const HANG_END = { ".": 1, ",": 1, "'": 1, '"': 1, "\u2018": 1, "\u2019": 1, "\u201c": 1, "\u201d": 1, ":": 0.5, ";": 0.3, "!": 0.1, "?": 0.1, "-": 0.5, "\u2010": 0.5, "\u2013": 0.2, "\u2014": 0.15 };
const HANG_START = { "\u2018": 0.3, "\u2019": 0.3, "\u201c": 0.3, "\u201d": 0.3 };

let sheet = null;
function styles() {
    if (sheet) return;
    sheet = document.createElement("style");
    sheet.textContent = `
.prayer p.${CLASS}-p { text-align: left; hyphens: manual; }
.${CLASS} { white-space: nowrap; }
.${CLASS}-hy::after { content: "-"; content: "-" / ""; }
`;
    document.head.append(sheet);
}

const isSpace = (c) => c === " " || c === "\n" || c === "\t" || c === "\r";

// ---- reading a paragraph ------------------------------------------------

// The paragraph as a flat run of pieces in document order: text nodes, the
// elements that are single boxes (anything not display:inline), and forced
// breaks.
const REPLACED = /^(img|svg|picture|video|audio|canvas|iframe|object|embed|math|input|button|select|textarea)$/i;

function flow(p) {
    const out = [];
    const walk = (el, tied) => {
        for (const n of el.childNodes) {
            if (n.nodeType === Node.TEXT_NODE) { if (n.data.length) out.push({ text: n, tied }); continue; }
            if (n.nodeType !== Node.ELEMENT_NODE) continue;
            if (n.tagName === "BR") { out.push({ br: n }); continue; }
            if (n.tagName === "WBR") continue;
            const cs = getComputedStyle(n);
            // Out of the flow, a child takes no room on a line.
            if (cs.display === "none" || cs.position === "absolute" || cs.position === "fixed") continue;
            // A picture or a control is one box whatever its display says.
            if (REPLACED.test(n.tagName) || (cs.display !== "inline" && cs.display !== "contents")) { out.push({ box: n, tied }); continue; }
            // An inline element's own padding, border and margin take room
            // on the line at each end of it (code on a wash of color).
            const start = (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0);
            const end = (parseFloat(cs.marginRight) || 0) + (parseFloat(cs.borderRightWidth) || 0) + (parseFloat(cs.paddingRight) || 0);
            if (start > 0) out.push({ pad: start, before: true });
            walk(n, tied || cs.whiteSpace === "nowrap");
            if (end > 0) out.push({ pad: end, before: false });
        }
    };
    walk(p, false);
    return out;
}

// Where the lines of the paragraph start in the browser's own layout: the
// drop cap and the first-line indent both show here. Left edges are from the
// paragraph's content edge, by line.
// How much of a paragraph's first text node the drop cap takes: any white
// space the source has before it, then what ::first-letter takes, which is
// the letter with the punctuation that touches it on either side ('"I’').
const FIRST_LETTER = /^\s*[\p{Ps}\p{Pe}\p{Pi}\p{Pf}\p{Po}]*[\p{L}\p{N}][\p{Ps}\p{Pe}\p{Pi}\p{Pf}\p{Po}]*/u;
function capLength(text) {
    const m = FIRST_LETTER.exec(text);
    if (m) return m[0].length;
    const lead = text.length - text.trimStart().length;
    return Math.min(text.length, lead + (text.codePointAt(lead) > 0xffff ? 2 : 1));
}

// The text node the paragraph's first letter is in: source white space
// before an opening element is a node of its own.
function opener(pieces) {
    return pieces.find((x) => x.text && /\S/.test(x.text.data)) || pieces.find((x) => x.text);
}

function lineStarts(p, pieces, skipFirst) {
    const first = opener(pieces);
    if (!first) return [];
    const r = document.createRange();
    r.setStart(first.text, skipFirst ? capLength(first.text.data) : 0);
    r.setEndAfter(p.lastChild);
    const cs = getComputedStyle(p), box = p.getBoundingClientRect();
    const left = box.left + parseFloat(cs.paddingLeft), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    const rows = [];
    for (const rc of r.getClientRects()) {
        if (rc.width < 0.5 || rc.height > lh * 1.6) continue;
        const mid = (rc.top + rc.bottom) / 2;
        let row = rows.find((x) => Math.abs(x.mid - mid) < lh * 0.45);
        if (!row) { row = { mid, left: Infinity }; rows.push(row); }
        row.left = Math.min(row.left, rc.left - left);
    }
    rows.sort((a, b) => a.mid - b.mid);
    return rows.map((x) => Math.max(0, x.left));
}

// Where the lines beside a drop cap start, exactly. WebKit rounds the box of
// a text range, and a line half a pixel too wide falls below the capital;
// the box of an element is not rounded. The first inline element after the
// capital starts at the capital's margin edge, and the padding of the
// elements the first word sits in is how much further right line 1 starts.
// Returns null when the paragraph has no such element.
function capEdge(p, pieces, contentLeft) {
    const el = [...p.children].find((x) => x.getClientRects().length && getComputedStyle(x).display === "inline");
    if (!el) return null;
    // Only an element that follows the capital directly starts at its edge.
    const before = el.previousSibling;
    if (!before || before.nodeType !== Node.TEXT_NODE || before !== opener(pieces).text || capLength(before.data) !== before.length) return null;
    const edge = el.getClientRects()[0].left - (parseFloat(getComputedStyle(el).marginLeft) || 0) - contentLeft;
    let lead = 0;
    const word = pieces.find((x, i) => x.text && /\S/.test(i === pieces.findIndex((y) => y.text) ? x.text.data.slice(1) : x.text.data));
    for (let a = word ? word.text.parentElement : null; a && a !== p; a = a.parentElement) {
        const cs = getComputedStyle(a);
        lead += (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0);
    }
    return { edge, lead };
}

// ---- measuring text -------------------------------------------------------

// Widths come from a canvas, which measures to a fraction of a pixel and
// does not lay anything out. (A text range's box is rounded to whole pixels
// in WebKit, and is slow inside a long paragraph.) A font the canvas
// measures differently from the page, and text in small caps or under a
// text-transform, is measured in the page instead, in a hidden span.
function measurer() {
    const ctx = document.createElement("canvas").getContext("2d");
    const byElement = new Map(), byFont = new Map();
    const inPage = (el, text) => {
        const probe = document.createElement("span");
        probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;word-spacing:0;text-indent:0";
        probe.textContent = text;
        el.append(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
    };
    const context = (el) => {
        let c = byElement.get(el);
        if (c) return c;
        const cs = getComputedStyle(el), size = parseFloat(cs.fontSize) || 0;
        const font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
        const ls = parseFloat(cs.letterSpacing) || 0;
        const plain = (cs.fontVariantCaps || "normal") === "normal" && cs.textTransform === "none";
        const key = `${font}|${ls}|` + (plain ? "" : `${cs.fontVariantCaps}/${cs.textTransform}`);
        let f = byFont.get(key);
        if (!f) {
            f = { font, canvas: plain && size >= 1, cache: new Map() };
            if (f.canvas) {
                // Does the canvas agree with the page for this font?
                const sample = "Lord, have mercy upon us; the fig-tree of affliction.";
                ctx.font = font;
                const here = inPage(el, sample) - ls * sample.length, there = ctx.measureText(sample).width;
                if (!(Math.abs(here - there) <= 0.004 * here)) f.canvas = false;
            }
            byFont.set(key, f);
        }
        c = { f, el, ls, size, whole: /none|manual/.test(cs.webkitHyphens || cs.hyphens || "") };
        byElement.set(el, c);
        return c;
    };
    const width = (c, text) => {
        if (!text || c.size < 0.5) return 0;
        let w = c.f.cache.get(text);
        if (w === undefined) {
            if (c.f.canvas) { ctx.font = c.f.font; w = ctx.measureText(text).width + c.ls * text.length; }
            else w = inPage(c.el, text);
            c.f.cache.set(text, w);
        }
        return w;
    };
    return { context, width };
}

// Words, spaces and forced breaks, with measured widths.
function tokens(p, pieces, skipFirst, hyphenate, measure) {
    const chunks = [new Array()];
    let word = null, lead = 0;
    const capNode = skipFirst ? opener(pieces) : null;
    // Beside a drop cap the room before the first word is where line 1
    // starts (capEdge), not part of the word.
    let afterCap = !!capNode;
    const open = (tied) => { word = { kind: "word", parts: [], boxes: [], extra: afterCap ? 0 : lead, tied }; lead = 0; afterCap = false; };
    const close = () => { if (word) { chunks[chunks.length - 1].push(word); word = null; } };
    for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        if (piece.br) { close(); chunks.push([]); continue; }
        if (piece.pad) {
            // Room at the start of an element goes with the word that follows
            // it, room at the end with the word before.
            if (piece.before) { lead += piece.pad; continue; }
            const chunk = chunks[chunks.length - 1];
            const last = word || [...chunk].reverse().find((x) => x.kind === "word");
            if (last) last.extra += piece.pad;
            continue;
        }
        if (piece.box) {
            const cs = getComputedStyle(piece.box);
            const w = piece.box.getBoundingClientRect().width + (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0);
            if (!word) open(true);
            word.extra += w;
            word.boxes.push(piece.box);
            word.tied = true;
            continue;
        }
        const t = piece.text, s = t.data;
        let k = 0;
        if (piece === capNode) k = capLength(s);
        while (k < s.length) {
            if (isSpace(s[k])) {
                close();
                let e = k;
                while (e < s.length && isSpace(s[e])) e++;
                const chunk = chunks[chunks.length - 1], last = chunk[chunk.length - 1];
                // Runs of white space collapse, across nodes too.
                if (last && last.kind === "space") last.end = { i, off: e };
                else chunk.push({ kind: "space", start: { i, off: k }, end: { i, off: e }, tied: piece.tied });
                k = e;
            } else {
                let e = k;
                while (e < s.length && !isSpace(s[e])) e++;
                if (!word) open(false);
                word.parts.push({ i, from: k, to: e });
                if (piece.tied) word.tied = true;
                k = e;
            }
        }
    }
    close();
    // Measure.
    const node = (i) => pieces[i].text;
    for (const piece of pieces) if (piece.text) { piece.ctx = measure.context(piece.text.parentElement); piece.ls = piece.ctx.ls; }
    for (const chunk of chunks) {
        for (const tok of chunk) {
            if (tok.kind === "space") {
                tok.w = measure.width(pieces[tok.start.i].ctx, " ");
                continue;
            }
            tok.w = tok.extra;
            for (const part of tok.parts) tok.w += measure.width(pieces[part.i].ctx, node(part.i).data.slice(part.from, part.to));
            tok.breaks = [];
            // What would hang if a line began or ended with this word.
            tok.lp = tok.rp = 0;
            if (tok.parts.length && !tok.extra) {
                const head = tok.parts[0], tail = tok.parts[tok.parts.length - 1];
                const first = node(head.i).data[head.from], last = node(tail.i).data[tail.to - 1];
                if (HANG_START[first]) tok.lp = HANG_START[first] * (measure.width(pieces[head.i].ctx, first) - pieces[head.i].ls);
                if (HANG_END[last]) tok.rp = HANG_END[last] * (measure.width(pieces[tail.i].ctx, last) - pieces[tail.i].ls);
            }
            // A word in one text node may divide: after a dash it holds, and
            // where the hyphenator allows.
            if (tok.tied || tok.parts.length !== 1) continue;
            const a = tok.parts[0];
            const text = node(a.i).data.slice(a.from, a.to);
            const at = (off, hyphen) => tok.breaks.push({ off: a.from + off, hyphen, w: measure.width(pieces[a.i].ctx, text.slice(0, off)), rp: hyphen ? 0 : (HANG_END[text[off - 1]] || 0) * (measure.width(pieces[a.i].ctx, text[off - 1]) - pieces[a.i].ls) });
            const run = /[A-Za-z]+|[\u2014\u2013-]/g;
            let m;
            while ((m = run.exec(text))) {
                const end = m.index + m[0].length;
                if (/^[\u2014\u2013-]$/.test(m[0])) { if (m.index > 0 && end < text.length) at(end, false); continue; }
                // Not where the element forbids hyphens (code), and not in a
                // word with letters beyond A to Z: the patterns are American
                // English, and the rest of such a word is not a word.
                if (m[0].length < 6 || pieces[a.i].ctx.whole || /[^\x00-\x7f]/.test(text)) continue;
                let off = m.index;
                const syllables = hyphenate(m[0].toLowerCase());
                for (let j = 0; j < syllables.length - 1; j++) { off += syllables[j].length; at(off, true); }
            }
            tok.breaks.sort((x, y) => x.off - y.off);
        }
    }
    return chunks;
}

// ---- choosing the breaks ------------------------------------------------

// items: box { w }, glue { w, y, z }, penalty { w, cost, flagged }.
function items(chunk, space, hyphenW) {
    const out = [];
    for (const tok of chunk) {
        if (tok.kind === "space") {
            if (!out.length) continue;                       // leading space collapses
            const stretchy = tok.w > 0.01 ? space : 0;
            out.push({ t: "glue", w: tok.w, y: stretchy * SPACE.stretch, z: stretchy * SPACE.shrink, tok, tied: tok.tied });
            continue;
        }
        let done = 0, from = tok.parts.length ? tok.parts[0].from : 0, lead = true;
        for (const b of tok.breaks) {
            out.push({ t: "box", w: b.w - done, tok, from, to: b.off, lp: lead ? tok.lp : 0, rp: 0 });
            out.push({ t: "pen", w: b.hyphen ? hyphenW : 0, cost: b.hyphen ? HYPHEN_COST : 0, flagged: b.hyphen, tok, off: b.off, rp: b.hyphen ? HANG_END["-"] * hyphenW : b.rp });
            done = b.w; from = b.off; lead = false;
        }
        out.push({ t: "box", w: tok.w - done, tok, from, to: tok.parts.length ? tok.parts[tok.parts.length - 1].to : 0, last: true, lp: lead ? tok.lp || 0 : 0, rp: tok.rp || 0 });
    }
    while (out.length && out[out.length - 1].t === "glue") out.pop();   // trailing space
    return out;
}

// Total fit. width(n) is the measure of line n (0-based) of this paragraph;
// lines from `plain` on all have the same measure. Returns the breaks as
// item indexes with each line's ratio, or null.
function breaks(list, width, firstLine, plain, loosest, capLines) {
    const n = list.length;
    const W = new Float64Array(n + 1), Y = new Float64Array(n + 1), Z = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
        const it = list[i];
        W[i + 1] = W[i] + (it.t === "pen" ? 0 : it.w);
        Y[i + 1] = Y[i] + (it.t === "glue" ? it.y : 0);
        Z[i + 1] = Z[i] + (it.t === "glue" ? it.z : 0);
    }
    // A line that starts after break b starts at the first box after it.
    const startAfter = (b) => { let k = b; while (k < n && list[k].t !== "box") k++; return k; };
    let active = [{ at: 0, start: 0, line: firstLine, run: 0, d: 0, prev: null, r: 0 }];
    const legal = (i) => i === n || (list[i].t === "glue" && !list[i].tied && i > 0 && list[i - 1].t === "box") || list[i].t === "pen";
    for (let b = 1; b <= n; b++) {
        if (!legal(b)) continue;
        const last = b === n, pen = !last && list[b].t === "pen" ? list[b] : null;
        const best = new Map();
        const keep = [];
        const hang = pen ? pen.rp : list[b - 1].rp || 0;
        for (const a of active) {
            // A line beside the drop cap cannot stand past the column: the
            // browser would move it below the capital.
            const rp = a.line < capLines ? 0 : hang;
            const lp = a.line >= plain && a.start < n ? list[a.start].lp || 0 : 0;
            const L = W[b] - W[a.start] + (pen ? pen.w : 0) - rp - lp;
            const avail = width(a.line), track = TRACK * avail;
            const y = Y[b] - Y[a.start] + track, z = Z[b] - Z[a.start] + track;
            let r;
            if (last) r = L <= avail ? 0 : (avail - L) / z;
            else r = L < avail ? (avail - L) / y : (avail - L) / z;
            if (r < -1) continue;                 // too long from here on: drop a
            keep.push(a);
            if (r > loosest) continue;
            const flagged = !!(pen && pen.flagged), run = flagged ? a.run + 1 : 0;
            if (run > MAX_HYPHEN_RUN) continue;
            const bad = 100 * Math.abs(r) ** 3, cost = pen ? pen.cost : 0;
            let d = (1 + bad + cost) ** 2;
            if (flagged && a.run > 0) d += DOUBLE_HYPHEN;
            d += a.d;
            const line = a.line + 1, key = Math.min(line, plain) * 4 + run;
            const cur = best.get(key);
            if (!cur || d < cur.d) best.set(key, { at: b, start: last ? n : startAfter(b), line, run, d, prev: a, r });
        }
        active = last ? [...best.values()] : keep.concat([...best.values()]);
        if (!active.length) return null;
    }
    let end = null;
    for (const a of active) if (a.at === n && (!end || a.d < end.d)) end = a;
    if (!end) return null;
    const out = [];
    for (let a = end; a.prev; a = a.prev) out.unshift({ from: a.prev.start, to: a.at, r: a.r, line: a.prev.line, last: a.at === n });
    return out;
}

// ---- writing the lines ---------------------------------------------------

function setParagraph(p, plan) {
    const { pieces, lines } = plan;
    // Pieces of text nodes to wrap, by text node.
    const perNode = new Map();
    const add = (i, from, to, line, tail) => {
        if (to <= from) return;
        if (!perNode.has(i)) perNode.set(i, []);
        perNode.get(i).push({ from, to, line, tail });
    };
    for (const line of lines) {
        const a = line.start, z = line.end;
        for (let i = a.i; i <= z.i; i++) {
            if (!pieces[i].text) continue;
            const from = i === a.i ? a.off : 0, to = i === z.i ? z.off : pieces[i].text.length;
            add(i, from, to, line, i === z.i);
        }
    }
    for (const [i, segs] of perNode) {
        const node = pieces[i].text, data = node.data, base = pieces[i].ls || 0;
        segs.sort((x, y) => x.from - y.from);
        const frag = document.createDocumentFragment();
        let at = 0;
        for (const s of segs) {
            if (s.from > at) frag.append(data.slice(at, s.from));
            const span = document.createElement("span");
            span.className = CLASS + (s.tail && s.line.hyphen ? ` ${CLASS}-hy` : "");
            if (s.line.word) span.style.wordSpacing = s.line.word.toFixed(3) + "px";
            if (s.line.letter || base) span.style.letterSpacing = (base + s.line.letter).toFixed(3) + "px";
            span.textContent = data.slice(s.from, s.to);
            if (s.line.pull && !s.line.spans.length && !s.line.pulled) { span.style.marginLeft = (-s.line.pull).toFixed(3) + "px"; s.line.pulled = true; }
            frag.append(span);
            s.line.spans.push(span);
            if (s.tail && !s.line.last) { const w = document.createElement("wbr"); w.className = CLASS + "-br"; frag.append(w); }
            at = s.to;
        }
        if (at < data.length) frag.append(data.slice(at));
        node.replaceWith(frag);
    }
    p.classList.add(CLASS + "-p");
}

function unset(p) {
    for (const w of p.querySelectorAll(`wbr.${CLASS}-br`)) w.remove();
    for (const s of p.querySelectorAll(`span.${CLASS}`)) s.replaceWith(...s.childNodes);
    p.classList.remove(CLASS + "-p");
    p.normalize();
}

// ---- the whole page ------------------------------------------------------

export function justify(paragraphs, options = {}) {
    styles();
    const hyphenate = options.hyphenate || ((w) => [w]);
    const root = document.documentElement;
    const skipped = (p, why) => { if (options.onSkip) options.onSkip(p, why); };

    // 1. Read the browser's own layout.
    const jobs = [];
    for (const p of paragraphs) {
        const cs = getComputedStyle(p), box = p.getBoundingClientRect();
        const cap = options.dropCap ? options.dropCap(p) : getComputedStyle(p, "::first-letter").float === "left";
        const pieces = flow(p);
        if (!pieces.some((x) => x.text)) { skipped(p, "no text"); continue; }
        const edges = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const job = { p, cap, pieces, measure: box.width - edges, starts: lineStarts(p, pieces, cap), fontSize: parseFloat(cs.fontSize) };
        if (cap) job.capEdge = capEdge(p, pieces, box.left + (parseFloat(cs.borderLeftWidth) || 0) + parseFloat(cs.paddingLeft));
        jobs.push(job);
    }
    // 2. Measure the words.
    const measure = measurer();
    for (const j of jobs) {
        const own = measure.context(j.p);
        j.space = measure.width(own, " ") - own.ls;
        j.hyphen = measure.width(own, "-");
        j.chunks = tokens(j.p, j.pieces, j.cap, hyphenate, measure);
    }
    // 3. Choose the breaks and write the lines. If anything below throws,
    // every paragraph written so far is put back before the error goes on:
    // the caller has no controller yet to undo them with.
    const managed = [];
    try {
    for (const j of jobs) {
        // A drop cap stands two lines deep; a paragraph the browser set in
        // one line still has its second line beside the capital.
        const starts = j.starts.slice();
        if (j.cap && starts.length === 1) starts.push(starts[0]);
        let plain = starts.length;
        while (plain > 0 && starts[plain - 1] < 0.5) plain--;
        // Positions are good to a pixel, and a line a hair too wide beside
        // the drop cap falls below it: lines are planned a little short and
        // step 4 takes up the difference.
        // WebKit reports where a line beside the capital starts to within a
        // few pixels only, so those lines get more room still.
        if (j.cap && j.capEdge) for (let n = 0; n < plain; n++) starts[n] = j.capEdge.edge + (n === 0 ? j.capEdge.lead : 0);
        // A planned width can be a couple of pixels out (two rounded
        // positions), and a line too wide for the space beside the capital
        // falls below it for good, so those lines are planned shorter still.
        const loose = j.cap ? (j.capEdge ? 2.5 : 6) : 0;
        const width = (n) => j.measure - (n < plain ? starts[n] + loose : 0) - 1.5;
        const lines = [];
        let lineNo = 0, ok = true;
        for (let c = 0; c < j.chunks.length && ok; c++) {
            const list = items(j.chunks[c], j.space, j.hyphen);
            if (!list.length) { if (c < j.chunks.length - 1) lineNo++; continue; }
            const capLines = j.cap ? plain : 0;
            const found = breaks(list, width, lineNo, plain, 2.5, capLines) || breaks(list, width, lineNo, plain, LOOSEST, capLines);
            if (!found) { ok = false; break; }
            for (const ln of found) {
                const slice = list.slice(ln.from, ln.to);
                while (slice.length && slice[slice.length - 1].t === "glue") slice.pop();
                const boxes = slice.filter((x) => x.t === "box");
                if (!boxes.length) continue;
                const first = boxes[0], lastBox = boxes[boxes.length - 1];
                const brk = ln.to < list.length && list[ln.to].t === "pen" ? list[ln.to] : null;
                const startPart = first.tok.parts[0], endPart = lastBox.tok.parts[lastBox.tok.parts.length - 1];
                const line = {
                    start: { i: startPart ? startPart.i : 0, off: first.tok.breaks.length ? first.from : (startPart ? startPart.from : 0) },
                    end: { i: endPart ? endPart.i : 0, off: lastBox.tok.breaks.length ? lastBox.to : (endPart ? endPart.to : 0) },
                    hyphen: !!(brk && brk.flagged), last: ln.last, word: 0, letter: 0, spans: [], glue: 0, fit: false,
                    // For a line beside the drop cap: where it should start, and its measure.
                    beside: ln.line < capLines ? { start: starts[ln.line], room: j.measure - starts[ln.line] } : null, margin: 0.3,
                };
                // A box that is a later part of a divided word starts in the
                // word's own text node.
                if (first.tok.parts.length === 1) line.start = { i: first.tok.parts[0].i, off: first.from };
                if (lastBox.tok.parts.length === 1) line.end = { i: lastBox.tok.parts[0].i, off: lastBox.to };
                // Spread what is left over the spaces and the letters.
                line.hang = ln.line < capLines ? 0 : brk ? brk.rp : lastBox.rp || 0;
                line.pull = ln.line >= plain ? first.lp || 0 : 0;
                const natural = slice.reduce((s, x) => s + (x.t === "pen" ? 0 : x.w), 0) + (brk ? brk.w : 0) - line.hang - line.pull;
                const avail = width(ln.line), diff = avail - natural;
                const glue = slice.filter((x) => x.t === "glue" && x.y > 0).length;
                // A word in several text nodes has no one pair of offsets.
                const letters = (x) => x.tok.breaks.length ? x.to - x.from : x.tok.parts.reduce((n, part) => n + part.to - part.from, 0);
                const chars = slice.reduce((s, x) => s + (x.t === "box" ? letters(x) : x.t === "glue" ? 1 : 0), 0) || 1;
                const justifyIt = !ln.last || diff < 0;
                if (justifyIt && Math.abs(diff) > 0.01) {
                    const track = TRACK * avail;
                    const room = diff > 0 ? glue * j.space * SPACE.stretch + track : glue * j.space * SPACE.shrink + track;
                    const share = room > 0 ? Math.min(1, Math.abs(diff) / room) : 0;
                    let letters = Math.sign(diff) * share * track;
                    if (!glue) letters = diff;
                    line.letter = letters / chars;
                    line.word = glue ? (diff - letters) / glue : 0;
                }
                // Step 4 brings every line but a last one to the edge, also
                // one that needed nothing here.
                line.glue = glue;
                line.fit = !ln.last;
                lines.push(line);
            }
            lineNo += found.length;
        }
        if (!ok || !lines.length) { skipped(j.p, "no way to set the lines"); continue; }
        // An inline box with a space on each side has no place in the text
        // to tie a line to, and the browser may put it on either line.
        if (j.chunks.some((chunk) => chunk.some((tok) => tok.kind === "word" && !tok.parts.length))) { skipped(j.p, "an inline box stands alone between spaces"); continue; }
        setParagraph(j.p, { pieces: j.pieces, lines });
        j.lines = lines;
        managed.push(j.p);
    }
    // 4. The positions above are good to a pixel. Read where each justified
    // line really ends and take up the difference in its word spaces.
    // Twice: the first pass can be a little out where a line holds spans
    // with their own letter spacing.
    for (let pass = 0; pass < 3; pass++) {
        const fixes = [];
        for (const j of jobs) {
            if (!j.lines) continue;
            const cs = getComputedStyle(j.p), box = j.p.getBoundingClientRect();
            const right = box.right - parseFloat(cs.paddingRight) - (parseFloat(cs.borderRightWidth) || 0), left = box.left + parseFloat(cs.paddingLeft) + (parseFloat(cs.borderLeftWidth) || 0);
            for (const line of j.lines) {
                if (!line.fit || !line.glue || !line.spans.length) continue;
                const rects = line.spans.map((x) => x.getBoundingClientRect());
                // A line whose spans are not on one row has wrapped; leave it.
                if (rects.some((r) => Math.abs(r.top - rects[0].top) > r.height / 2)) continue;
                const end = Math.max(...rects.map((r) => r.right)), start = Math.min(...rects.map((r) => r.left));
                // A line planned beside the capital that came out a hair too
                // wide stands below it, at the margin. Make it narrower than
                // its room by a clear margin, and keep that margin after.
                if (line.beside && start < left + line.beside.start - 2) {
                    line.margin = 3;
                    fixes.push({ line, word: line.word + (line.beside.room - line.margin - (end - start)) / line.glue });
                    continue;
                }
                const off = right - line.margin + line.hang - end;
                if (Math.abs(off) > 0.05 && Math.abs(off) < 20) fixes.push({ line, word: line.word + off / line.glue });
            }
        }
        if (!fixes.length) break;
        for (const f of fixes) { f.line.word = f.word; for (const span of f.line.spans) span.style.wordSpacing = f.word.toFixed(3) + "px"; }
    }
    } catch (e) {
        for (const j of jobs) if (j.p.classList.contains(CLASS + "-p") || j.p.querySelector("span." + CLASS)) unset(j.p);
        throw e;
    }
    return {
        managed,
        ready: Promise.resolve(),
        destroy() { for (const p of managed) unset(p); },
        // Puts one paragraph back as it was and leaves the rest set.
        drop(p) {
            const i = managed.indexOf(p);
            if (i < 0) return;
            managed.splice(i, 1);
            unset(p);
        },
    };
}
