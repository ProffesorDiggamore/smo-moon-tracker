#!/usr/bin/env python3
"""Rebuild data/moons.js from the Super Mario Wiki and IGN.

Moon names, numbers, "how to get it" text and unlock conditions come from the
Super Mario Wiki's Power Moon data (Module:SMO Power Moons/data.json), which is
licensed CC BY-SA 4.0. Only IGN page *links* are collected from IGN; none of
IGN's text is copied.

Usage:  python3 scripts/build_data.py
"""

import difflib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "moons.js"
UA = "smo-moon-tracker/1.0 (fan-made Power Moon checklist)"

WIKI = "https://www.mariowiki.com"
WIKI_DATA = "Module:SMO Power Moons/data.json"
IGN = "https://www.ign.com"
IGN_WIKI = IGN + "/wikis/super-mario-odyssey/"

# Kingdoms in the order you visit them in the game.
KINGDOMS = [
    ("cap", "Cap Kingdom", "List of Power Moons in the Cap Kingdom"),
    ("cascade", "Cascade Kingdom", "List of Power Moons in the Cascade Kingdom"),
    ("sand", "Sand Kingdom", "List of Power Moons in the Sand Kingdom"),
    ("lake", "Lake Kingdom", "List of Power Moons in the Lake Kingdom"),
    ("wooded", "Wooded Kingdom", "List of Power Moons in the Wooded Kingdom"),
    ("cloud", "Cloud Kingdom", "List of Power Moons in the Cloud Kingdom"),
    ("lost", "Lost Kingdom", "List of Power Moons in the Lost Kingdom"),
    ("metro", "Metro Kingdom", "List of Power Moons in the Metro Kingdom"),
    ("snow", "Snow Kingdom", "List of Power Moons in the Snow Kingdom"),
    ("seaside", "Seaside Kingdom", "List of Power Moons in the Seaside Kingdom"),
    ("luncheon", "Luncheon Kingdom", "List of Power Moons in the Luncheon Kingdom"),
    ("ruined", "Ruined Kingdom", "List of Power Moons in the Ruined Kingdom"),
    ("bowsers", "Bowser's Kingdom", "List of Power Moons in Bowser's Kingdom"),
    ("moon", "Moon Kingdom", "List of Power Moons in the Moon Kingdom"),
    ("mushroom", "Mushroom Kingdom", "List of Power Moons in the Mushroom Kingdom"),
    ("darkside", "Dark Side", "List of Power Moons in the Dark Side"),
    ("darkerside", "Darker Side", "Darker Side"),
]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read().decode("utf-8")
        except Exception as exc:  # network hiccup: back off and retry
            if attempt == 3:
                raise
            print(f"  retrying {url}: {exc}", file=sys.stderr)
            time.sleep(2 ** (attempt + 1))


def wiki_url(title, anchor=None):
    url = WIKI + "/" + urllib.parse.quote(title.replace(" ", "_"), safe="/:'(),!")
    if anchor:
        url += "#" + urllib.parse.quote(anchor.replace(" ", "_"), safe="/:'(),!")
    return url


def strip_quote_markup(text):
    """Drop ''italic'' / '''bold''' quotes but keep real apostrophes.

    ''Super Mario 64'''s closes the italics and leaves "'s", as MediaWiki does.
    """
    italic = False

    def repl(match):
        nonlocal italic
        run = len(match.group(0))
        if run == 4:  # an apostrophe followed by bold markup
            return "'"
        if run == 3 and italic:  # closing italics, then an apostrophe
            italic = False
            return "'"
        if run in (2, 5):
            italic = not italic
        return ""

    return re.sub(r"'{2,5}", repl, text)


def clean_wikitext(text):
    """Turn the wiki's markup into plain text (paragraph breaks kept as \\n\\n)."""
    text = re.sub(r"<ref[^>]*/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = text.replace("{{'}}", "'")
    # {{wp|Page}} / {{wp|Page|Label}} -> label
    text = re.sub(r"\{\{wp\|([^}|]*)(?:\|([^}]*))?\}\}", lambda m: m.group(2) or m.group(1), text)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)  # anything else is non-prose
    text = re.sub(r"\[\[(?:File|Image):[^\]]*\]\]", "", text)
    text = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"\[\[([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"\[https?://\S+ ([^\]]*)\]", r"\1", text)
    text = strip_quote_markup(text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n\n", text)
    return text.strip()


def norm(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


def ign_links(display):
    """Map moon number -> (IGN moon name, URL) for one kingdom."""
    page = display.replace(" ", "_") + "_Power_Moons"
    html = fetch(IGN_WIKI + urllib.parse.quote(page, safe="'_"))
    decoder = json.JSONDecoder()
    links = {}
    for match in re.finditer(r'"name":("(?:[^"\\]|\\.)*"),"guidePages":', html):
        task = json.loads(match.group(1))
        num_match = re.search(r"Power Moon (\d+)\s*-?\s*(.*)", task)
        if not num_match:
            continue
        num, name = int(num_match.group(1)), num_match.group(2).strip()
        if num in links:
            continue
        pages, _ = decoder.raw_decode(html, match.end())
        if not pages:
            continue
        # Prefer IGN's dedicated page for this moon when it has one.
        page_hit = next((p for p in pages if f"Power Moon {num:02d}" in p.get("title", "")), pages[0])
        url = page_hit["wikiUrl"]
        path, _, anchor = url.partition("#")
        # Links into IGN's giant all-kingdoms page are better served by the
        # kingdom page, which carries the same checklist anchors.
        if path.endswith("/Power_Moon_Locations"):
            url = "/wikis/super-mario-odyssey/" + urllib.parse.quote(page, safe="_") + (
                "#" + anchor if anchor else ""
            )
        links[num] = (name, IGN + url)
    return page, links


def main():
    print("Fetching Super Mario Wiki data...")
    raw = fetch(WIKI + "/index.php?" + urllib.parse.urlencode({"title": WIKI_DATA, "action": "raw"}))
    data = json.loads(raw)

    kingdoms = []
    total = 0
    for kid, display, list_page in KINGDOMS:
        rows = sorted(
            ((name, m) for name, m in data.items() if m["kingdom"] == display),
            key=lambda item: item[1]["number"],
        )
        print(f"{display}: {len(rows)} moons; fetching IGN links...")
        ign_page, ign = ign_links(display)
        time.sleep(1)

        moons = []
        for name, m in rows:
            num = m["number"]
            ign_url = IGN_WIKI + urllib.parse.quote(ign_page, safe="_")
            if num in ign:
                # IGN numbers moons the same way the game does, so the number
                # is the match key. IGN names some Mushroom Kingdom moons by
                # their goal instead ("Collect 100 Power Moons"), so a name
                # mismatch is only reported, not rejected.
                ign_name, ign_url = ign[num]
                ratio = difflib.SequenceMatcher(None, norm(name), norm(ign_name)).ratio()
                if ratio < 0.6:
                    print(f"  ~ #{num} {name!r} is {ign_name!r} on IGN")
            else:
                print(f"  ! #{num} {name!r} has no IGN entry: using kingdom page")
            moons.append({
                "n": num,
                "name": name,
                "multi": bool(m.get("multi")),
                "how": clean_wikitext(m["location"]),
                "when": clean_wikitext(m.get("availability") or ""),
                "ign": ign_url,
                "wiki": wiki_url(list_page, name if list_page.startswith("List") else None),
            })
        total += len(moons)
        kingdoms.append({
            "id": kid,
            "name": display,
            "wiki": wiki_url(list_page),
            "ign": IGN_WIKI + urllib.parse.quote(ign_page, safe="_"),
            "moons": moons,
        })

    if total != len(data):
        sys.exit(f"Kingdom mapping missed moons: {total} of {len(data)}")

    payload = {
        "source": {
            "name": "Super Mario Wiki",
            "url": wiki_url("Lists of Power Moons"),
            "data": wiki_url(WIKI_DATA),
            "license": "CC BY-SA 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
            "retrieved": time.strftime("%Y-%m-%d"),
        },
        "kingdoms": kingdoms,
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(
        "// Generated by scripts/build_data.py - do not edit by hand.\n"
        "// Moon text from the Super Mario Wiki (https://www.mariowiki.com),\n"
        "// licensed CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/\n"
        "window.SMO_DATA = "
        + json.dumps(payload, ensure_ascii=False, indent=1)
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {total} moons to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
