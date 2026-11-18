#!/bin/zsh
# Assembles "Prayer Book.nnwtheme" from src/: embeds the two EB Garamond
# woff2 files into stylesheet.css as data URIs (NetNewsWire cannot load a
# font file from inside the bundle). With --install, also copies the bundle
# into NetNewsWire's Themes folder on this Mac.
set -euo pipefail
here=${0:A:h}
out="$here/Prayer Book.nnwtheme"
mkdir -p "$out"
cp "$here/src/Info.plist" "$here/src/template.html" "$here/src/template7.3.html" "$here/src/NOTICE.txt" "$here/src/LICENSE" "$out/"

face() { # style file
	print -r -- "@font-face {
	font-family: 'EB Garamond';
	font-style: $1;
	font-weight: 400 800;
	font-display: block;
	src: url(data:font/woff2;base64,$(base64 -i "$here/src/$2" | tr -d '\n')) format('woff2');
}"
}
fonts="$(face normal ebgaramond-var.woff2)
$(face italic ebgaramond-italic-var.woff2)"

/opt/homebrew/bin/python3 - "$here/src/stylesheet.css" "$out/stylesheet.css" "$fonts" <<'PY'
import sys
src, dst, fonts = sys.argv[1:]
css = open(src, encoding="utf-8").read()
assert "/*@FONTS@*/" in css
open(dst, "w", encoding="utf-8").write(css.replace("/*@FONTS@*/", fonts))
PY
# The script: hyphenation, the engine, the drop-cap table and the theme's
# own part, as one classic script inside each template. NetNewsWire's page
# allows inline script only, and its base address is the feed's site, so
# nothing can be loaded from a file beside the template.
/opt/homebrew/bin/python3 - "$here/src/justify" "$out" <<'PY'
import sys
from pathlib import Path
src, out = Path(sys.argv[1]), Path(sys.argv[2])
read = lambda name: (src / name).read_text(encoding="utf-8")
def strip(name, *cuts):
    text = read(name)
    for old, new in cuts:
        assert text.count(old) == 1, f"{name}: expected one {old!r}"
        text = text.replace(old, new)
    return text
parts = [
    strip("hyphenator.js", ("export { createHyphenator };", "")),
    strip("hyphenate-en-us.js", ("import { createHyphenator } from '../chunk-ZW2EUTPS.js';", ""), ("export { hyphenateEnUS };", "")),
    # The engine's class names take the theme's prefix: a feed's own
    # class="justified" must not be taken for a line the script wrote.
    strip("engine.js", ("export const LINE = CLASS;", "const LINE = CLASS;"), ("export function justify(", "function justify("), ('const CLASS = "justified";', 'const CLASS = "pb-line";')),
    read("drop-caps.js"),
    read("theme.js"),
]
script = '(function () {\n"use strict";\n' + "\n".join(parts) + "\n})();"
import re, shutil, subprocess, tempfile
assert not re.search(r"^\s*(?:import|export)\b", script, re.M), "a module statement is left in the script"
# NetNewsWire fills [[name]] in a template; a closing tag would end the
# script, and <!-- would put the HTML parser into its escaped state.
for bad in ("</script", "<!--", "[["):
    assert bad not in script.lower(), f"the script holds {bad}"
# The joined script must parse as a classic script.
node = shutil.which("node")
if node:
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(script)
    subprocess.run([node, "--check", f.name], check=True)
for name in ("template.html", "template7.3.html"):
    page = (out / name).read_text(encoding="utf-8")
    assert page.count("/*@SCRIPT@*/") == 1, name
    (out / name).write_text(page.replace("/*@SCRIPT@*/", script), encoding="utf-8")
PY
plutil -lint "$out/Info.plist" >/dev/null
echo "built: $out ($(du -sh "$out" | cut -f1))"

if [[ ${1:-} == --install ]]; then
	themes="$HOME/Library/Containers/com.ranchero.NetNewsWire-Evergreen/Data/Library/Application Support/NetNewsWire/Themes"
	rm -rf "$themes/Prayer Book.nnwtheme"
	cp -R "$out" "$themes/"
	echo "installed: $themes/Prayer Book.nnwtheme"
fi
