// src/hyphenation/liang.ts
var DOT = 46;
function createHyphenator(data) {
  const leftmin = data.leftmin ?? 2;
  const rightmin = data.rightmin ?? 3;
  let root = null;
  let exceptionMap = null;
  function add(pattern) {
    const codes = [];
    const points2 = [0];
    for (const ch of pattern) {
      if (ch >= "0" && ch <= "9") points2[points2.length - 1] = ch.charCodeAt(0) - 48;else {
        codes.push(ch.codePointAt(0));
        points2.push(0);
      }
    }
    let node = root;
    for (const code of codes) {
      node.children ?? (node.children = /* @__PURE__ */new Map());
      let next = node.children.get(code);
      if (next === void 0) {
        next = {
          children: null,
          points: null
        };
        node.children.set(code, next);
      }
      node = next;
    }
    node.points = Uint8Array.from(points2);
  }
  function compile() {
    root = {
      children: /* @__PURE__ */new Map(),
      points: null
    };
    if (data.packed !== void 0) {
      let previous = "";
      for (const token of data.packed.split(" ")) {
        if (token.length === 0) continue;
        previous = previous.slice(0, token.charCodeAt(0) - 48) + token.slice(1);
        add(previous);
      }
    } else if (data.patterns !== void 0) {
      for (const pattern of data.patterns.split(/\s+/)) {
        if (pattern.length !== 0) add(pattern);
      }
    }
    exceptionMap = /* @__PURE__ */new Map();
    if (data.exceptions !== void 0) {
      for (const exception of data.exceptions.split(/\s+/)) {
        if (exception.length === 0) continue;
        exceptionMap.set(exception.replace(/-/g, ""), exception.split("-"));
      }
    }
  }
  let points = new Uint8Array(64);
  return function hyphenate(word) {
    if (word.length < leftmin + rightmin) return [word];
    if (root === null) compile();
    const exception = exceptionMap.get(word);
    if (exception !== void 0) return exception.slice();
    const n = word.length + 2;
    if (points.length < n + 1) points = new Uint8Array(2 * (n + 1));else points.fill(0, 0, n + 1);
    for (let i = 0; i < n; i++) {
      let node = root;
      for (let j = i; j < n; j++) {
        const code = j === 0 || j === n - 1 ? DOT : word.charCodeAt(j - 1);
        node = node.children?.get(code);
        if (node === void 0) break;
        const pts = node.points;
        if (pts !== null) {
          for (let k = 0; k < pts.length; k++) {
            if (pts[k] > points[i + k]) points[i + k] = pts[k];
          }
        }
      }
    }
    const pieces = [];
    let startC = 0;
    for (let c = leftmin; c <= word.length - rightmin; c++) {
      if (points[c + 1] % 2 === 1) {
        pieces.push(word.slice(startC, c));
        startC = c;
      }
    }
    pieces.push(word.slice(startC));
    return pieces;
  };
}
export { createHyphenator };