#!/bin/zsh
# Assembles "Prayer Book.nnwtheme" from src/: embeds the two EB Garamond
# woff2 files into stylesheet.css as data URIs (NetNewsWire cannot load a
# font file from inside the bundle). With --install, also copies the bundle
# into NetNewsWire's Themes folder on this Mac.
set -euo pipefail
here=${0:A:h}
out="$here/Prayer Book.nnwtheme"
mkdir -p "$out"
cp "$here/src/Info.plist" "$here/src/template.html" "$here/src/NOTICE.txt" "$here/src/LICENSE" "$out/"

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
plutil -lint "$out/Info.plist" >/dev/null
echo "built: $out ($(du -sh "$out" | cut -f1))"

if [[ ${1:-} == --install ]]; then
	themes="$HOME/Library/Containers/com.ranchero.NetNewsWire-Evergreen/Data/Library/Application Support/NetNewsWire/Themes"
	rm -rf "$themes/Prayer Book.nnwtheme"
	cp -R "$out" "$themes/"
	echo "installed: $themes/Prayer Book.nnwtheme"
fi
