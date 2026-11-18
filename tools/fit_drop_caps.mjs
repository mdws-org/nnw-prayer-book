// Writes src/justify/drop-caps.js: for each capital, where the two lines
// beside the drop cap start, at the theme's two leadings (a phone's and the
// Mac's), and the space above the capital that stands its foot on the
// second line's baseline.
//
// The method and the distances are orthodoxprayers.net's
// (scripts/fit_drop_caps.mjs there). The printed prayer books fit the two
// lines differently: line 1 is the rest of the opening word and runs in to
// the capital at the height of its own letters; line 2 stands off the
// capital's rightmost ink below line 1's baseline. CLEAR holds the two
// distances for each capital, in em of the body text, from the capital's
// ink to the edge of the text's box, set against the St. Tikhon's Monastery
// Press prayer book.
//
// Run after changing the font, the cap's size or weight, or a leading:
//   ./build.sh && node tools/fit_drop_caps.mjs && ./build.sh
// Needs playwright-core and its WebKit build (PLAYWRIGHT_CORE and
// WEBKIT_PATH point at an existing install).
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// [line 1, line 2]: capital's ink to the text's box, in em of the body text.
const CLEAR = {
    A: [0.189, 0.396], B: [0.278, 0.197], C: [0.203, 0.112], D: [0.291, 0.192],
    E: [0.263, 0.197], F: [0.033, 0.140], G: [0.208, 0.123], H: [0.221, 0.105],
    I: [0.188, 0.132], J: [0.205, 0.136], K: [0.113, 0.136], L: [0.267, 0.312],
    M: [0.225, 0.072], N: [0.145, 0.088], O: [0.233, 0.200], P: [0.220, -0.146],
    Q: [0.133, 0.232], R: [0.188, 0.131], S: [0.133, 0.194], T: [0.109, 0.438],
    U: [0.201, 0.105], V: [0.098, 0.346], W: [0.111, 0.319], X: [0.126, 0.124],
    Y: [0.110, 0.371], Z: [0.198, 0.168],
};
// The space above the capital, in its own em, that stands its foot on the
// second line's baseline at each leading. Set by measuring screenshots: the
// arithmetic in the page is a pixel out either way.
const TOP = { NARROW: 0.0215, WIDE: 0.0585 };
// The two geometries NetNewsWire gives the theme. A phone: the reader's
// Dynamic Type size on the root, the text at 1.08rem, leading 1.55 under
// 600px. The Mac: medium text, leading 1.65.
const GEOMETRIES = [
    { name: "NARROW", width: 390, css: "html{font-size:17px}body{padding:0 20px}.articleBody{font-size:1.08rem}" },
    { name: "WIDE", width: 900, css: "body{padding:0 48px}.articleBody{font-size:19px}" },
];

const css = readFileSync(join(ROOT, "Prayer Book.nnwtheme", "stylesheet.css"), "utf8").replace("[[font-size]]", "17");
const html = (geometry) => `<!doctype html><meta charset="utf-8"><style>${css}</style><style>${geometry.css}#bodyContainer p{--cap-top:${TOP[geometry.name]}em}</style><article lang="en"><div id="bodyContainer" class="articleBody mediumText"><p>Lord grant</p><p>next</p></div></article>`;
const server = createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(html(GEOMETRIES[+new URL(req.url, "http://x").searchParams.get("g")])); });
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const base = `http://127.0.0.1:${server.address().port}`;

const { webkit } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const browser = await webkit.launch({ headless: true, ...(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) });

// In the page: the capital's rightmost ink beside line 1 and below line 1's
// baseline, in em of the body text from the capital's left edge; its
// advance width.
const measure = () => {
    const p = document.querySelector("#bodyContainer p");
    p.style.setProperty("--cap-fit", "0em");
    const body = getComputedStyle(p), em = parseFloat(body.fontSize), out = {};
    const canvas = document.createElement("canvas"), scale = 8;
    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        p.textContent = letter + "ord grant me to greet the coming day in peace help me in all things to rely upon your holy will in every hour of the day";
        const text = p.firstChild;
        const rect = (a, b) => { const r = document.createRange(); r.setStart(text, a); r.setEnd(text, b); return r.getClientRects()[0]; };
        const cap = rect(0, 1), first = rect(1, 2);
        let second = null;
        for (let i = 2; i < text.data.length && !second; i++) { const r = rect(i, i + 1); if (r && r.top > first.top + em * 0.8) second = r; }
        const style = getComputedStyle(p, "::first-letter"), size = parseFloat(style.fontSize), padTop = parseFloat(style.paddingTop);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.font = `${body.fontWeight} ${em}px ${body.fontFamily}`;
        const bm = ctx.measureText("x"), bodyBox = bm.fontBoundingBoxAscent + bm.fontBoundingBoxDescent;
        const baseline = (r) => r.bottom - (r.height - bodyBox) / 2 - bm.fontBoundingBoxDescent;
        ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
        const cm = ctx.measureText(letter), up = cm.fontBoundingBoxAscent, down = cm.fontBoundingBoxDescent;
        const capBaseline = cap.top + padTop + (cap.height - padTop - (up + down)) / 2 + up;
        const inset = size * 0.1;
        canvas.width = Math.ceil((cm.width + size * 0.4) * scale); canvas.height = Math.ceil((up + down) * scale);
        const draw = canvas.getContext("2d", { willReadFrequently: true });
        draw.scale(scale, scale); draw.font = `${style.fontWeight} ${size}px ${style.fontFamily}`; draw.fillText(letter, inset, up);
        const pixels = draw.getImageData(0, 0, canvas.width, canvas.height).data;
        const reach = (top, bottom) => {
            let best = -1;
            const from = Math.max(0, Math.round((top - capBaseline + up) * scale)), to = Math.min(canvas.height - 1, Math.round((bottom - capBaseline + up) * scale));
            for (let y = from; y <= to; y++) for (let x = canvas.width - 1; x > best; x--) if (pixels[(y * canvas.width + x) * 4 + 3] > 60) { best = x; break; }
            return best < 0 ? 0 : (best / scale - inset) / em;
        };
        const b1 = baseline(first), b2 = baseline(second);
        out[letter] = { advance: cm.width / em, line1: reach(b1 - 0.42 * em, b1 + 0.02 * em), low: reach(b1 + 0.08 * em, b2 + 0.02 * em), capEm: size / em };
    }
    return out;
};

const tables = {};
for (const [g, geometry] of GEOMETRIES.entries()) {
    const page = await (await browser.newContext({ viewport: { width: geometry.width, height: 844 } })).newPage();
    await page.goto(`${base}/?g=${g}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const measured = await page.evaluate(measure);
    const rows = [];
    for (const [letter, m] of Object.entries(measured)) {
        const [clear1, clear2] = CLEAR[letter];
        const edge = m.low + clear2;
        const fit = edge - m.advance, lead = m.line1 + clear1 - edge;
        // fit is a margin on the capital itself, so it is written in the capital's own em.
        rows.push(`    ${letter}: [${(fit / m.capEm).toFixed(4)}, ${lead.toFixed(3)}],`);
    }
    tables[geometry.name] = { rows, top: TOP[geometry.name] };
    await page.close();
}
await browser.close();
server.close();

writeFileSync(join(ROOT, "src", "justify", "drop-caps.js"), `// Written by tools/fit_drop_caps.mjs; do not edit by hand.
//
// For each capital: [fit, lead]. fit is the right margin of the drop cap in
// its own em, which is where line 2 starts. lead is where line 1 starts from
// there, in em of the body text: negative where the opening word runs in over
// the capital's leg or foot. NARROW is for a phone's leading, WIDE for the
// Mac's; TOP is the space above the capital, in its own em, that stands its
// foot on line 2's baseline. The distances behind them are in the script.
var FIT_NARROW = {
${tables.NARROW.rows.join("\n")}
};
var FIT_WIDE = {
${tables.WIDE.rows.join("\n")}
};
var TOP_NARROW = ${tables.NARROW.top.toFixed(4)};
var TOP_WIDE = ${tables.WIDE.top.toFixed(4)};

// After a one-letter word ("A voice") line 1 keeps a thin space in place of
// the word space, as the 2019 St. Tikhon's prayer book sets it.
var ONE_LETTER_LEAD = 0.16;
`);
console.log(`fit_drop_caps: wrote src/justify/drop-caps.js; space above the capital ${tables.NARROW.top.toFixed(4)} (narrow), ${tables.WIDE.top.toFixed(4)} (wide)`);
