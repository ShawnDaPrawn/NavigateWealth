# Design system: the official Untitled UI React kit

**Audience:** anyone changing the site's design system or preparing to move
the site onto Untitled UI.

`untitled-ui-react/` is the official
[Untitled UI Vite starter kit](https://github.com/untitleduico/untitledui-vite-starter-kit),
copied in whole. It holds about 230 free Untitled UI React components under the
MIT licence: base components, application components (tables, date pickers,
charts, modals, navigation) and the theme. The paid PRO tier is not included.
The MIT licence and Untitled UI's copyright notice are in
`untitled-ui-react/LICENSE`, taken from Untitled UI's
[React repository](https://github.com/untitleduico/react/blob/main/LICENSE)
because the starter kit itself ships without one. Keep it with the code.

**The site does not use it yet, and it cannot change the site's styling.** It
is a separate app:

- **Own dependencies.** It has its own `package.json` and lockfile. It runs on
  React 19; the site stays on React 18.
- **Own theme.** Its `src/styles/theme.css` redefines Tailwind's text sizes,
  greys, shadows and radii. It is loaded only by this app, never by the site.
- **Fenced off from the site's tooling:**
  - The site's Tailwind skips the folder (`@source not` in
    `src/styles/globals.css`).
  - ESLint and Prettier ignore it (`eslint.config.mjs`, `.prettierignore`); it
    keeps its own Prettier rules.
  - TypeScript, Vitest and dependency-cruiser only look at `src/`.

The site's built CSS was checked to be byte-for-byte identical with and
without this folder present.

## The Navigate Wealth theme

`untitled-ui-react/src/styles/navigate-wealth.css` re-points Untitled UI's
tokens at the Navigate Wealth brand: violet `#6d28d9` for every brand colour
(at Untitled UI's `brand-600` step), Tailwind gray neutrals, the site's
system font stack, and the navy `#313653` as `bg-navy`. It is imported after
Untitled UI's own theme, so it wins. **Change the brand there, in one place,
and every component follows.**

## The component library page

Every component is shown, with its variants and the line to import it, on the
**Components** tab of `/design-system`. The other tabs, including Colours and
Typography, are the site's own and are unchanged.

- The page is `untitled-ui-react/showcase.html`, with the demos in
  `untitled-ui-react/src/showcase/` (one file per group: foundations, base,
  forms, application). Add a demo there when a component is added.
- It is built to `dist/design-system-library/` and deployed with the site:
  Vercel runs `npm run build:deploy` (see `vercel.json`), which is the site's
  `npm run build` followed by `npm run design-system:build`.
- The site's Components tab (`src/components/pages/design-system/DesignSystemLibrary.tsx`)
  shows it in a same-origin iframe. The iframe reports its height to the page
  and asks the page to scroll for index links, so it reads as one page. The
  components the site uses today are one click away on the same tab.
- If the library is not built (local `npm run dev`), the tab says so instead
  of embedding the site inside itself.

## Using it

```bash
npm run uui-react:install    # once: install the kit's own dependencies
npm run design-system:dev    # the component library page on its own dev server
npm run design-system:build  # build the page into dist/design-system-library
npm run uui-react:dev        # the kit's own starter app
npm run uui-react:build      # type-check and build the starter app
```

`untitled-ui-react/CLAUDE.md` is Untitled UI's own guide to the components,
read automatically by Claude Code when working in that folder. Components
live in `untitled-ui-react/src/components/` (`base/`, `application/`,
`foundations/`, `marketing/`, `shared-assets/`) and import each other with the
`@/` alias.

## Moving the site onto it (not done yet)

This is the central design system the site will be wired up against, so that
the look of the whole app is changed in one place. The site cannot import the
components yet. That needs three steps, each its own change:

1. Upgrade the site to React 19. Some of the kit's components use React 19
   features.
2. Merge the kit's theme (with `navigate-wealth.css`) into the site's
   Tailwind setup. This is the step that changes how the site looks.
3. Replace the site's components with these ones page by page.
