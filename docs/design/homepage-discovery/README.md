# Homepage Design Direction — "A Era dos Descobrimentos"

A proposed premium re-skin of the Navigate Wealth homepage: imperial purple, antique
gold and dark grey, drawn with the instruments of the Portuguese Age of Discovery
(wind rose, graticule, cable rule, azulejo, astrolabe ring, cartouche ticks).

**Nothing structural changes.** Navigation layout and order, the Log In and Get
Started actions, the mega menus, the footer columns, the compliance disclaimer and
every section of homepage body copy are reproduced exactly as they ship today. This
is a surface direction — tokens, type and ornament.

### The one copy change, stated plainly

Four sections gain a serif display headline, and their existing heading drops to the
eyebrow above it. That is a copy and heading-hierarchy change, not just a re-skin:

| Section  | Today's `<h2>`       | In the deck                                                      |
| -------- | -------------------- | ---------------------------------------------------------------- |
| Services | Our Services         | eyebrow `I · OUR SERVICES` + **Charted for Every Passage**       |
| Why us   | Why us?              | eyebrow `II · WHY US?` + **The Ship, the Crew, the Instruments** |
| Partners | Trusted Partners     | eyebrow `III · TRUSTED PARTNERS` + **The Fleet We Sail With**    |
| Reviews  | What Our Clients Say | eyebrow `IV · CLIENT LOG`, heading unchanged                     |

Hero, Insights, FAQ, the CTA and the footer keep their headings as they are. The
added lines are optional — plate XIV lists them under open questions, and the
direction holds if you drop all four and promote the original headings back to `h2`.

## Files

| File                                            | What it is                                                 |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `Navigate-Wealth-Homepage-Design-Direction.pdf` | The deliverable — 15 landscape plates at 1600×900          |
| `direction.html`                                | Source template, with `{{TOKEN}}` placeholders for assets  |
| `direction.built.html`                          | Self-contained build; open in any browser                  |
| `build.py`                                      | Inlines assets, then prints the PDF with headless Chromium |

## Rebuilding

```sh
python3 docs/design/homepage-discovery/build.py
```

Pulls photography from `src/assets` (preferring the pre-optimized WebP variants in
`public/img/optimized`), the sail mark from `public/brand-assets`, and the Cormorant
Garamond / Inter latin subsets from Google Fonts, caching them in `.fonts/`. Every
asset is embedded as a data URI so both the built HTML and the PDF are standalone.

`Pillow` is optional — it downscales the provider logos before embedding. Without it
the build still works, just with a heavier PDF.

## The homepage mockup

The redesigned page is authored once, at 1440px, inside `#site` in `direction.html`.
Each deck plate clones the section it documents out of that single master, so the
section plates and the full-page plate can never drift apart. Styles are scoped under
`.site`, which is what lets the clones carry their styling outside the master.
