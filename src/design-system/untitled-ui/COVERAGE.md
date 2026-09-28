# Untitled UI PRO v8.0 — export coverage

The complete component inventory of the source file, **"❖ Untitled UI Figma – PRO
STYLES (v8.0)"**, read page by page through the Figma connector on 2026-09-28. Every
component set in the file is listed below, so nothing can go missing: each export
batch ticks its rows off here.

**Who reads this:** whoever exports the next Untitled UI batch (to pick up where
the last one stopped), and any developer checking whether a component exists in
code before building one.

Legend: ✅ in code · 🟡 in code from the v7.0 file, needs the v8.0 update · ⬜ not yet

Figures are the file's own: `sets` is component sets on the page, `variants` the
variants inside them. Sets whose names start with `_` are private building blocks
and are exported as part of the component that uses them.

## Foundations

| Page                    | Status | Notes                                                                                                                                                                                                              |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Colors                  | ✅     | v8.0 keeps colours as 928 paint styles (no variables). The 28 palette families are in `tokens/palette-v8.css`, and light-mode semantic tokens point at them. Dark mode keeps v7.0 values (v8.0 has no dark styles) |
| Typography              | ✅     | 44 text styles; unchanged between v7.0 and v8.0                                                                                                                                                                    |
| Effect styles           | ✅     | 24 effect styles; unchanged between v7.0 and v8.0                                                                                                                                                                  |
| Spacing, radius & grids | ✅     |                                                                                                                                                                                                                    |
| Icons                   | ⬜     | 1,173 icons; 12 exported so far                                                                                                                                                                                    |
| Misc icons              | ⬜     |                                                                                                                                                                                                                    |
| Logos                   | ⬜     |                                                                                                                                                                                                                    |

## Base components

| Page                | Sets | Variants | Component sets                                                                                                                              | Status                                                                                                                                                        |
| ------------------- | ---: | -------: | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avatars             |    7 |       70 | Avatar, Avatar group, Avatar label group, Avatar profile photo, Status icon                                                                 | ✅ Avatar (photo, initials, placeholder, online/offline, border), Avatar group (+N, add), Avatar label group · ⬜ Avatar profile photo, verified/count status |
| Badges              |    3 |      834 | Badge, Badge group                                                                                                                          | ✅ Badge (v8 colours incl. Slate, Sky) · ⬜ Badge group                                                                                                       |
| Button groups       |    2 |       70 | Button group                                                                                                                                | ✅                                                                                                                                                            |
| Buttons             |    8 |      669 | Button, Button destructive, Button close X, Button utility, Button loading icon, Social button, Social button group, Mobile app store badge | ✅ Button (incl. v8 `xs`, v8 disabled style), destructive, close X, loading icon · ⬜ utility, social, app store badges                                       |
| Checkboxes          |    2 |      112 | Checkbox                                                                                                                                    | ✅                                                                                                                                                            |
| Dropdowns           |    7 |       52 | Dropdown menu, Context menu                                                                                                                 | ⬜                                                                                                                                                            |
| Inputs              |    4 |      357 | Input field, Textarea input field, Verification code input field                                                                            | ✅ Input (Default type), Textarea · ⬜ other input types, verification code                                                                                   |
| Progress indicators |    2 |       65 | Progress bar, Progress circle                                                                                                               | ✅ Progress bar (none/right/bottom label), Progress circle (xxs–lg, full/half) · ⬜ floating tooltip labels                                                   |
| Radio groups        |    2 |      168 | Radio group item, Radio group                                                                                                               | ✅ Radio · ⬜ Radio group cards                                                                                                                               |
| Select              |    4 |      192 | Select, Multi-select                                                                                                                        | ⬜ (new in v8.0)                                                                                                                                              |
| Sliders             |    2 |       39 | Slider                                                                                                                                      | ⬜                                                                                                                                                            |
| Tags                |    4 |      105 | Tag                                                                                                                                         | ✅ Tag (sm–lg; dot, avatar, checkbox; X close, count) · ⬜ country flag                                                                                       |
| Text editors        |    5 |       58 | Text editor, Text editor toolbar, Text editor tooltip                                                                                       | ⬜                                                                                                                                                            |
| Toggles             |    2 |       96 | Toggle                                                                                                                                      | ✅                                                                                                                                                            |
| Tooltips            |    2 |       56 | Tooltip, Help icon                                                                                                                          | ✅ Tooltip (dark/light, supporting text, arrow, 4 placements) · ⬜ Help icon                                                                                  |
| Video players       |    7 |       61 | Video player 16:9                                                                                                                           | ⬜                                                                                                                                                            |

## Application components

| Page                   | Sets | Variants | Component sets                                                                                        | Status           |
| ---------------------- | ---: | -------: | ----------------------------------------------------------------------------------------------------- | ---------------- |
| Activity feeds         |    2 |       22 | Activity feed                                                                                         | ⬜               |
| Alerts & notifications |    2 |       42 | Alert, Notification                                                                                   | ⬜               |
| Application navigation |   11 |      182 | Sidebar navigation, Header navigation                                                                 | ⬜               |
| Breadcrumbs            |    2 |       40 | Breadcrumbs                                                                                           | ⬜               |
| Calendars              |   10 |       82 | Calendar                                                                                              | ⬜               |
| Card headers           |    1 |        4 | Card header                                                                                           | ⬜               |
| Charts                 |   12 |       90 | Line and bar chart, Activity gauge, Pie chart, Radar chart, Chart marker                              | ⬜               |
| Code snippets          |    2 |       18 | Code snippet                                                                                          | ⬜               |
| Color pickers          |    6 |       40 | Color picker, Color picker dropdown, Color picker modal                                               | ⬜ (new in v8.0) |
| Command menus          |    6 |       43 | Command bar                                                                                           | ⬜               |
| Content dividers       |    1 |       18 | Content divider                                                                                       | ⬜               |
| Date pickers           |    5 |       54 | Date picker dropdown, Date picker modal                                                               | ⬜               |
| Empty states           |    2 |       36 | Empty state, Illustration                                                                             | ⬜               |
| File upload            |    3 |       23 | File upload                                                                                           | ⬜               |
| Filters                |    3 |       38 | Filters dropdown menu, Filters bar, Slide out menu                                                    | ⬜ (new in v8.0) |
| Inline CTAs            |    1 |       14 | Inline CTA                                                                                            | ⬜               |
| Loading indicators     |    1 |       12 | Loading indicator                                                                                     | ⬜               |
| Messaging              |    5 |       46 | Message, Message action                                                                               | ⬜               |
| Metrics                |    3 |       66 | Metric item                                                                                           | ⬜               |
| Modals                 |    3 |      126 | Modal                                                                                                 | ⬜               |
| Page headers           |    1 |       12 | Page header                                                                                           | ⬜               |
| Pagination             |    7 |       66 | Pagination, Pagination dot group, Carousel image                                                      | ⬜               |
| Progress steps         |    7 |       92 | Five progress-step layouts (minimal icons, connected, text with line, icons centred, icons with text) | ⬜               |
| Section footers        |    1 |        8 | Section footer                                                                                        | ⬜               |
| Section headers        |    2 |       16 | Section header, Section label                                                                         | ⬜               |
| Slideout menus         |    2 |       50 | Slide out menu                                                                                        | ⬜               |
| Tables                 |    5 |      101 | Table, Table header cell, Table cell, Table cell lead action                                          | ⬜               |
| Tabs                   |    3 |      132 | Horizontal tabs, Vertical tabs                                                                        | ⬜               |
| Tree views             |    3 |       26 | Tree view                                                                                             | ⬜ (new in v8.0) |

## Marketing website components

| Page                    | Sets | Variants | Component sets                                                      | Status |
| ----------------------- | ---: | -------: | ------------------------------------------------------------------- | ------ |
| Header navigation       |    9 |      198 | Full-width header navigation, Dropdown header navigation            | ⬜     |
| Header sections         |    2 |      186 | Hero header section, Header section                                 | ⬜     |
| Features sections       |    3 |      142 | Features section                                                    | ⬜     |
| Pricing sections        |    5 |       88 | Pricing section, Pricing page header                                | ⬜     |
| CTA sections            |    1 |       78 | CTA section                                                         | ⬜     |
| Newsletter CTA sections |    1 |       42 | Newsletter CTA section                                              | ⬜     |
| Metrics sections        |    2 |       56 | Metrics section                                                     | ⬜     |
| Testimonial sections    |    3 |      110 | Testimonial section                                                 | ⬜     |
| Social proof sections   |    2 |       36 | Social proof section, Press mentions section                        | ⬜     |
| Blog sections           |    4 |       84 | Blog section, Blog post card, Blog subscribe card, Blog page header | ⬜     |
| Content                 |    3 |      102 | Content section, Content item, Blog post page header                | ⬜     |
| Contact sections        |    4 |      104 | Contact sections, Contact page header                               | ⬜     |
| Team sections           |    2 |       42 | Team section                                                        | ⬜     |
| Careers sections        |    2 |       38 | Careers section                                                     | ⬜     |
| FAQ sections            |    2 |       64 | FAQ section                                                         | ⬜     |
| Footers                 |    4 |      142 | Footer                                                              | ⬜     |

## Shared assets

| Page                     | Sets | Variants | Component sets                                                                   | Status                              |
| ------------------------ | ---: | -------: | -------------------------------------------------------------------------------- | ----------------------------------- |
| Banners                  |    1 |       40 | Banner                                                                           | ⬜                                  |
| Background elements      |    4 |       46 | Background pattern, Background pattern decorative, Background overlay            | ⬜                                  |
| Log in and sign up pages |    4 |       92 | Log in, Sign up, Forgot password, Email verification                             | ⬜                                  |
| 404 pages                |    1 |       28 | 404 section                                                                      | ⬜                                  |
| Email templates          |    3 |       22 | Email template                                                                   | ⬜ (HTML email, not React)          |
| Miscellaneous assets     |   14 |      151 | Device and screen mockups, hand-drawn accents, line patterns, credit card mockup | ⬜ (images and SVG, not components) |
| Portfolio mockups        |    1 |        6 | Browser toolbar                                                                  | ⬜                                  |

## Example pages

The file's example pages — application (dashboards, settings, informational pages)
and marketing (landing, pricing, about, blog, contact, FAQ, legal, team, log in,
sign up, 404) — are compositions of the components above. They are rebuilt as
pages once their components exist, not exported as components.
