# Bearings — the monthly newsletter template

**Audience:** whoever produces the monthly newsletter PDF, a person or the
monthly routine.

`monthly-newsletter.html` is an eight-page A4 newsletter in the website's
Navigator design: navy ink and warm paper, Newsreader for headlines and
long-form text, Inter for labels and figures, violet as an accent only. It
renders to the PDF that the admin **Newsletters** module sends (see
[`docs/runbooks/newsletter-intake.md`](../../docs/runbooks/newsletter-intake.md)).

The fonts and logos are not copied in. The template loads them from
`src/site/fonts/` and `public/brand-assets/`, so it always matches the site.

## The issue, page by page

| Page | Section           | What changes each month                                                     |
| ---- | ----------------- | --------------------------------------------------------------------------- |
| 1    | Cover             | Issue number and month, the cover story's kicker, headline and summary      |
| 2    | From the founder  | The letter, the month in numbers (six market figures), practice notes       |
| 3    | Markets in review | Headline, the 12-month chart, the returns table, local and global comments  |
| 4–5  | Cover story       | The feature, its timeline figure, pull quote, checklist and explainer panel |
| 6    | The planning desk | Three adviser briefs, three key numbers, four diary dates, adviser's note   |
| 7    | You asked         | Three or four reader questions, the word of the month, three reading links  |
| 8    | Talk to us        | The call to action. Contact details and disclosures rarely change           |

## Making a new issue

1. Copy the template to `tmp/newsletter/`, e.g. as
   `tmp/newsletter/bearings-2027-01.html`. `tmp/` is git-ignored, so an issue
   in progress is never committed, and it sits two folders deep like this one,
   so the template's relative paths to the fonts and logos still resolve.
2. Change the copy. Every piece that changes per issue carries a `data-field`
   attribute; change the text and keep the markup. The running head's month
   appears on every page as `data-field="issue.month"`.
3. Replace every figure marked **Illustrative** with sourced month-end data, and
   confirm the diary dates and office hours. The sample figures are placeholders,
   not market data.
4. Render the final PDF:

   ```bash
   npm run newsletter:render -- tmp/newsletter/bearings-2027-01.html \
     --final --out tmp/newsletter/bearings-2027-01.pdf
   ```

   `--final` hides the yellow template flags. Leave it off to proof with them
   on. The script fails if any page's content runs off its sheet, or if the PDF
   is over the 5 MB newsletter limit. Where Playwright's Chromium is not
   installed but another is, set `CHROMIUM_PATH` to that browser.

5. Hand the PDF over as the runbook describes: upload it in the admin
   Newsletters module, or queue it through the intake routine.

## Rules that keep it looking right

- **Each `<section class="page">` is exactly one A4 sheet** and clips what does
  not fit. When copy runs long, cut it; do not shrink the type.
- **Violet is an accent, not a colour scheme**: page numbers, kickers, one word
  of a headline, the call to action. Market moves use green and red.
- **One italic word per headline**, in `<em class="acc">`, as on the website.
- **Keep the disclosure on the back page** in full. It carries the FSP number
  and the general-information notice the newsletter needs.
- Market charts are inline SVG. To redraw the 12-month chart, rebase each
  series to 100 and map values onto the plot area: x from 34 to 586 across 13
  month-ends, y = 12 + (118 − value) × 8.
