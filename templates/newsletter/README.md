# The Wealth Compass — the monthly newsletter template

**Audience:** whoever produces the monthly newsletter, which is normally the
monthly routine, or a person.

`monthly-newsletter.html` is an eight-page A4 newsletter in the website's
Navigator design: navy ink and warm paper, Newsreader for headlines and
long-form text, Inter for labels and figures, violet as an accent only. It
renders to the PDF that the admin **Newsletters** module sends (see
[`docs/runbooks/newsletter-intake.md`](../../docs/runbooks/newsletter-intake.md)).

The fonts and logos are not copied in. The template loads them from
`src/site/fonts/` and `public/brand-assets/`, so it always matches the site.

## How an issue gets made

A Claude routine runs on the **27th of every month**. It follows the
[`newsletter-monthly-generate`](../../.claude/skills/newsletter-monthly-generate/SKILL.md)
skill as the issue's editor:

1. It reads the month's published articles and the South African and global
   economic news, from primary sources.
2. It chooses the issue's thesis and cover story.
3. It writes every slot into a content file.
4. It renders and proofs the PDF.
5. It hands the PDF to the Newsletters module as a **draft awaiting approval**.

The admin is emailed, reviews the draft and sends it. Nothing reaches
subscribers without that approval.

If an issue for the month already exists, the routine stops rather than make a
second one.

### Steering an issue

The routine reads its editorial brief from one database row,
`editorial_brief:newsletter`. Its `standing_brief` is the publication's
stance. `next_issue` lets you set a particular month's cover topic and angle;
the routine follows it for that month and then clears it. The easiest way to
set it is to ask Claude: "set the newsletter angle for January 2027 to …".
In SQL:

```sql
update public.kv_store_91ed8379
set value = jsonb_set(value, '{next_issue}', '{
  "issue_month": "2027-01",
  "cover_topic": "Starting the year with a cash-flow plan",
  "angle": "Treat January as the month to fix the budget, not the portfolio",
  "must_include": ["the February tax year-end"],
  "avoid": ["market predictions"],
  "notes": null
}'::jsonb)
where key = 'editorial_brief:newsletter';
```

The other settings in the row:

- `enabled`: set it to `false` to pause the routine.
- `letter_mode` and `letter_signoff`: who signs the founder's letter. `founder`
  writes it in the founder's voice; `editorial` signs it "The Navigate Wealth team".
- `practice_notes`: verified practice news for page 2, such as festive office
  hours. The routine never invents practice news.
- `history`: past issues, so cover topics are not repeated.

## The issue, page by page

| Page | Section           | Slots                                                               |
| ---- | ----------------- | ------------------------------------------------------------------- |
| 1    | Cover             | `issue.*`, `cover.*`, `toc.1`–`toc.4`                               |
| 2    | From the founder  | `letter.*`, `contents`, `numbers`, `num.source`, `practice`         |
| 3    | Markets in review | `markets.*`, the `chart` data, `chart.title`, `chart.sub`           |
| 4–5  | Cover story       | `feature.*`: the feature, pull quote, checklist and explainer panel |
| 6    | The planning desk | `desk.*`, `stats`, `diary`, `desk.note`                             |
| 7    | You asked         | `qa.*`, `word`, `reading`                                           |
| 8    | Talk to us        | `back.*`. The contact details and disclosure are fixed, not slots   |

## The content file

An issue is a JSON file, not a copy of the template.
[`issue.sample.json`](issue.sample.json) is the December 2026 sample. Every
figure in it is illustrative. It shows the markup each slot expects.

- `fields` maps each slot to its HTML. Every `data-field` element takes the
  HTML as its contents (`issue.month` appears on every page). `null` removes
  the element, for slots that can go, such as `feature.figure`.
- `chart` is the markets chart as data. `labels` gives up to 24 x-axis
  points. `series` gives up to three named series of numbers. The optional
  fields are `yMin`, `yMax` and `yStep`, a `baseline` (100 for rebased series),
  a `unit` such as `%`, and an `annotation` (`{ index, series, text }`).
  `scripts/newsletter/newsletter-chart.mjs` draws it in the template's style.
  `"chart": null` removes the chart card.
- `meta` holds `issue_month`, `title`, `description`, the editorial notes and
  the sources. It is not printed. While `sample` is `true`, a final render is refused.

## Rendering and handing over

```bash
npm run newsletter:render -- --content tmp/newsletter/2027-01.json --final \
  --out tmp/newsletter/the-wealth-compass-2027-01.pdf --preview tmp/newsletter/preview-2027-01
```

Write issues under `tmp/`, which is git-ignored.

`--final` hides the template's yellow "illustrative" flags, and requires every
slot to be present. The render refuses, and writes no PDF, when:

- a slot is misspelt or missing;
- the file is still the sample;
- text runs off a page, below it or to the right;
- the PDF is over the 5 MB newsletter limit.

`--preview` saves each page as a PNG for proofreading. Where Playwright's
Chromium is not installed but another is, set `CHROMIUM_PATH` to that browser.

To hand a PDF over, upload it in the admin Newsletters module, or:

```bash
NEWSLETTER_INTAKE_TOKEN=… npm run newsletter:submit -- --pdf <file> --issue 2027-01 \
  --title "Navigate Wealth | January 2027 | The Wealth Compass: …" --description "…"
```

That posts to the HTTPS intake endpoint after a dry run. Add `--dry-run` to
validate without creating anything. The token lives in Vault as
`navigatewealth_newsletter_intake_token`.

Run `npm run newsletter:test` to test the chart builder.

## Rules that keep it looking right

- **Each `<section class="page">` is exactly one A4 sheet**, and clips what
  does not fit. When copy runs long, cut it; do not shrink the type.
- **Violet is an accent, not a colour scheme**: page numbers, kickers, one word
  of a headline, the call to action. Market moves use green and red.
- **One italic word per headline**, in `<em class="acc">`, as on the website.
- **Keep the disclosure on the back page** in full. It carries the FSP number
  and the general-information notice the newsletter needs.
- **No invented people.** Reader questions are framed as questions the
  practice hears, never as a described client.
