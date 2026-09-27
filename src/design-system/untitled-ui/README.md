# Untitled UI PRO — in code, not yet in use

This folder is the Untitled UI PRO design system (Figma file
"❖ Untitled UI – PRO VARIABLES (v7.0)", the owner's licensed copy), exported
into code so it is ready **when it is needed**.

**Nothing on the site imports it.** The live site, the `/design-system` page
and the shadcn components in `src/components/ui/` are unchanged. The styles are
plain CSS whose names all start with `uui`, so even once the stylesheet is
imported it cannot restyle anything that has not opted in.

## What is here

| Path                        | What it holds                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `tokens/primitives.css`     | Collection `_Primitives`: 375 colours (every palette, 25–950) and the 32-step spacing scale                            |
| `tokens/semantic.css`       | Collection `1. Color modes`: 303 semantic colours (`text-*`, `bg-*`, `border-*`, `fg-*`, `utility-*`…), light and dark |
| `tokens/scales.css`         | Collections `2. Radius`, `3. Spacing`, `4. Widths`, `5. Containers`, `6. Typography`                                   |
| `tokens/effects.css`        | The 24 effect styles: shadows xs–3xl, skeuomorphic, focus rings, portfolio-mockup shadows, backdrop blurs              |
| `tokens/typography.css`     | The 44 text styles as classes, e.g. `.uui-text-display-md-semibold`, `.uui-text-text-sm-medium`                        |
| `components/components.css` | Styles for the components below                                                                                        |
| `components/*.tsx`          | React components (see the next table)                                                                                  |
| `icons/icons.tsx`           | The icons those components use, with path data from the file's Icons page                                              |
| `untitled-ui.css`           | Imports all of the above — the one stylesheet to import                                                                |
| `index.ts`                  | Exports every component and icon                                                                                       |
| `__tests__/`                | Behaviour tests for each component, and a token-integrity test                                                         |

### Components exported so far

| Component           | Figma component set                        | Covers                                                                                                             |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `Button`            | Buttons/Button, Buttons/Button destructive | Sizes sm–xl; Primary, Secondary, Tertiary, Link color, Link gray; destructive; icons; icon-only; loading; disabled |
| `CloseButton`       | Buttons/Button close X                     | Sizes sm–lg; light and dark background                                                                             |
| `Badge`             | Badge                                      | Pill color, Badge color, Badge modern; sizes sm–lg; 12 colours; dot; leading/trailing icon; X close; icon-only     |
| `Input`             | Input field (Type = Default)               | Sizes sm, md; label, required, hint, help icon, leading icon; error; disabled                                      |
| `Textarea`          | Textarea input field (Type = Default)      | Label, required, hint, help icon; error; disabled                                                                  |
| `Checkbox`, `Radio` | Checkbox, \_Checkbox base                  | Sizes sm, md; checked, indeterminate; label and supporting text; disabled                                          |
| `Toggle`            | Toggle, \_Toggle base                      | Default and Slim; sizes sm, md; label and supporting text; disabled                                                |

Every size was measured in a browser against the Figma frames (button heights
36/40/44/48, badges 22/24/28, inputs 40/44, textarea 128, and so on) and matched.

### Not exported yet

In the order worth doing them:

1. **Icons** — the full set of 1,173 icons. Each is a single 24×24 stroke
   path, so they drop straight into the `createIcon` factory in `icons/icons.tsx`.
2. **Remaining base components** — Button groups, Tags, Dropdowns, Avatars,
   Tooltips, Progress indicators, Sliders, Text editors, Video players, and the
   other Input types (dropdown, leading text, payment, tags, trailing button,
   verification code).
3. **Application components** — Modals, Tabs, Tables, Pagination, Breadcrumbs,
   Alerts and notifications, Date pickers, Calendars, File upload, Empty states,
   Loading indicators, Page/Card/Section headers, Navigation, Metrics, Charts,
   Progress steps, Activity feeds, Messaging, Command menus, Slideout menus,
   Code snippets, Content dividers.
4. **Marketing website components** — Header navigation, Header, Features,
   Pricing, CTA, Metrics, Newsletter, Testimonial, Social proof, Blog, Contact,
   Team, Careers, FAQ sections, Footers, Banners.

The example pages in the file (landing, pricing, dashboards, settings…) are
compositions of the above and are not components in their own right.

## Using it

```tsx
import '@/design-system/untitled-ui/untitled-ui.css';
import { Button, Input, Mail01 } from '@/design-system/untitled-ui';

<Input label="Email" icon={Mail01} placeholder="you@example.com" hint="We never share it." />
<Button hierarchy="primary" size="lg">Get started</Button>
```

- **Dark mode**: put `className="uui-dark"` (or `data-uui-theme="dark"`) on any
  ancestor. Every semantic colour and shadow switches to the Figma dark values.
- **Tokens outside the components**: use the custom properties directly,
  e.g. `background: var(--uui-color-bg-secondary)`, `box-shadow: var(--uui-shadow-lg)`,
  or through Tailwind's arbitrary-value syntax. (No such class is written out
  here on purpose: Tailwind scans every file, this README included, and would
  add it to the site's CSS.)
- **Font**: the file uses Inter. The site does not load Inter today; the token
  stacks fall back to the system sans-serif until it does.

## Things to know before adopting it

- **The brand colour is Untitled UI's purple** (`--uui-color-brand-*`, #7f56d9 at
  600), not Navigate Wealth's navy. Rebranding is a change to the twelve
  `--uui-color-brand-25`…`950` primitives in `tokens/primitives.css`; every
  semantic token, component and focus ring follows from those.
- **One orphaned variable.** The Link color button binds
  `text-brand-secondary_hover`, which is missing from the `1. Color modes`
  collection list in the file. It was resolved on its own (light: Brand 800,
  dark: Gray dark mode 200) and added as `--uui-color-text-brand-secondary-hover`.
- **Names.** Figma's `_` suffixes become `-` (`bg-brand-solid_hover` →
  `--uui-color-bg-brand-solid-hover`), and the `(900)`-style hints in names are
  dropped. Every colour is `--uui-color-*`; other tokens are `--uui-spacing-*`,
  `--uui-radius-*`, `--uui-width-*`, `--uui-font-*`, `--uui-line-height-*`,
  `--uui-shadow-*` and `--uui-focus-ring*`.
- **Figma's "inside" borders** are drawn as inset box-shadows (or, for the
  primary button's 2px gradient border, an inset pseudo-element), so each
  component's box is exactly its Figma size.

## Updating from Figma

The values were read from the Figma file through the Figma connector (plugin
API: local variables, text styles, effect styles, and the component sets'
variant properties, paddings, radii and bound variables). To pick up a newer
version of the file, re-export the same way rather than editing values by hand,
and keep `__tests__/tokens.test.ts` green — it fails if any `var(--uui-*)`
points at a token that does not exist, or if a colour loses its dark value.
