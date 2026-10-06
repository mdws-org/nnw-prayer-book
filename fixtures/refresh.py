#!/opt/homebrew/bin/python3
import re, html, sys, pathlib, urllib.request, xml.etree.ElementTree as ET
FEEDS = {
  "verge": ("https://www.theverge.com/rss/index.xml", "The Verge"),
  "ars": ("https://feeds.arstechnica.com/arstechnica/index", "Ars Technica"),
  "df": ("https://daringfireball.net/feeds/main", "Daring Fireball"),
  "substack": ("https://www.platformer.news/rss/", "Platformer"),
  "reddit": ("https://www.reddit.com/r/programming/.rss", "r/programming"),
  "mastodon": ("https://mastodon.social/@Gargron.rss", "Eugen Rochko"),
  "youtube": ("https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ", "MKBHD"),
  "simonw": ("https://simonwillison.net/atom/everything/", "Simon Willison"),
  "rust": ("https://blog.rust-lang.org/feed.xml", "Rust Blog"),
}
NS = {"a": "http://www.w3.org/2005/Atom", "c": "http://purl.org/rss/1.0/modules/content/", "m": "http://search.yahoo.com/mrss/", "dc": "http://purl.org/dc/elements/1.1/"}
out = pathlib.Path(sys.argv[1])
def fetch(u):
    r = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (Macintosh) NetNewsWire-fixtures/1"})
    return urllib.request.urlopen(r, timeout=30).read()
def text(e): return (e.text or "") if e is not None else ""
for key, (url, name) in FEEDS.items():
    try: raw = fetch(url)
    except Exception as ex: print(key, "FETCH FAIL", ex); continue
    root = ET.fromstring(raw)
    entries = root.findall(".//a:entry", NS) or root.findall(".//item")
    picked = None
    for e in entries[:12]:
        atom = e.tag.endswith("entry")
        if atom:
            title = text(e.find("a:title", NS)); link = next((l.get("href") for l in e.findall("a:link", NS) if l.get("rel") in (None, "alternate")), "")
            body = text(e.find("a:content", NS)) or text(e.find("a:summary", NS))
            author = text(e.find("a:author/a:name", NS)); date = text(e.find("a:published", NS)) or text(e.find("a:updated", NS))
            if not body:
                mg = e.find("m:group", NS)
                if mg is not None:
                    vid = e.find("{http://www.youtube.com/xml/schemas/2015}videoId")
                    desc = text(mg.find("m:description", NS))
                    body = f'<iframe width="560" height="315" src="https://www.youtube.com/embed/{text(vid)}" frameborder="0" allowfullscreen></iframe>' + "".join(f"<p>{html.escape(p)}</p>" for p in desc.split("\n\n") if p.strip())
        else:
            title = text(e.find("title")); link = text(e.find("link"))
            body = text(e.find("c:encoded", NS)) or text(e.find("description"))
            author = text(e.find("dc:creator", NS)) or text(e.find("author")); date = text(e.find("pubDate"))
        if len(body) > 800 or key in ("youtube", "mastodon"):
            picked = (title, link, body, author, date); break
    if not picked: print(key, "no entry"); continue
    title, link, body, author, date = picked
    body = body.replace("'''", "''\\'")
    stripped = re.sub(r"^https?://", "", link)
    toml = f'''title = {title!r}
preferred_link = {link!r}
external_link_label = ""
external_link = ""
external_link_stripped = ""
feed_link_title = {name!r}
feed_link = {url!r}
byline = {author!r}
avatar_src = ""
dateline_style = "articleDatelineTitle"
datetime_medium = {date[:25]!r}
date_medium = {date[:16]!r}
body = \'\'\'{body}\'\'\'
'''
    (out / f"{key}.toml").write_text(toml)
    print(key, "ok", len(body), "chars:", title[:60])
