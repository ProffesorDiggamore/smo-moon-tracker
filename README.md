# smo-moon-tracker

A **Super Mario Odyssey Power Moon checklist**. It lists all 836 Power Moons across all 17 kingdoms (880 in total, since each Multi Moon counts as 3), with each moon's number, name, how to get it, and when it unlocks.

## Features

- **Kingdom tabs** in the order you visit them, plus an **All** tab. Each tab shows how many moons you've collected there, and a ★ marks a finished kingdom.
- **A saved checkbox for every moon.** Your progress is stored in your browser (`localStorage`), so it's still there after you close the page or refresh it.
- **Search** by name, hint text, or number. Type `#12` for moon 12 only. Press <kbd>/</kbd> to jump to the search box and <kbd>Esc</kbd> to clear it. If you search inside one kingdom, the app tells you when other kingdoms have matches too.
- **Hide collected** switch, so you only see the moons you still need.
- **Moon counts** for each kingdom and for the whole game (moons and Power Moon total).
- Every moon has buttons for its **IGN guide** page, a **YouTube** search for that moon, and its **Super Mario Wiki** entry.
- Light and dark mode, and it works on phones too.

## Using it

It's a plain static website, so you don't need to install anything.

- **On your computer:** open `index.html` in any browser (double-click it).
- **Online:** in the GitHub repo, go to **Settings → Pages**, pick the branch, choose the `/ (root)` folder, and save. GitHub will give you a link to the live site.

Your progress is saved separately in each browser and on each device.

## Project layout

```
index.html            page structure
css/style.css         styles (light + dark)
js/app.js             tabs, search, checkboxes, saving
data/moons.js         generated moon data (do not edit by hand)
scripts/build_data.py rebuilds data/moons.js from the sources below
```

To refresh the moon data, run `python3 scripts/build_data.py` (Python 3, no extra packages needed).

## Credits and licenses

**Moon text: Super Mario Wiki.** Moon names, numbers, the "how to get it" descriptions and the "when" (availability) notes come from the [Super Mario Wiki](https://www.mariowiki.com/)'s Power Moon data ([Module:SMO Power Moons/data.json](https://www.mariowiki.com/Module:SMO_Power_Moons/data.json)), the same data behind its [Lists of Power Moons](https://www.mariowiki.com/Lists_of_Power_Moons) pages. That text was written by Super Mario Wiki contributors and is licensed under [Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/). The only change was converting wiki markup (links, italics, templates, one citation footnote) into plain text. Because of the ShareAlike terms, `data/moons.js` is also shared under CC BY-SA 4.0. Every moon in the app links back to its wiki entry.

**IGN:** the IGN buttons link to pages in [IGN's Super Mario Odyssey guide](https://www.ign.com/wikis/super-mario-odyssey/Power_Moon_Locations). Only the link addresses were collected; none of IGN's text is copied here. If IGN doesn't have a page for a moon, the button opens that kingdom's IGN page instead.

**YouTube:** the YouTube buttons open a YouTube search for the moon's kingdom, number and name.

This is a fan project. It isn't affiliated with Nintendo, the Super Mario Wiki, IGN or YouTube. *Super Mario Odyssey* and its characters are © Nintendo.
