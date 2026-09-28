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

**The site does not use it, and it cannot change the site's styling.** It is a
separate app:

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
- **Not deployed.** Vercel builds the site from the repository root only.

The site's built CSS was checked to be byte-for-byte identical with and
without this folder present.

## Using it

```bash
npm run uui-react:install   # once: install the kit's own dependencies
npm run uui-react:dev       # run it on its own dev server
npm run uui-react:build     # type-check and build it
```

`untitled-ui-react/CLAUDE.md` is Untitled UI's own guide to the components,
read automatically by Claude Code when working in that folder. Components
live in `untitled-ui-react/src/components/` (`base/`, `application/`,
`foundations/`) and import each other with the `@/` alias.

## Moving the site onto it (not done yet)

The components are ready to use, but the site cannot import them yet. That
needs three steps, each its own change:

1. Upgrade the site to React 19. Some of the kit's components use React 19
   features.
2. Merge the kit's theme into the site's Tailwind setup. This is the step
   that changes how the site looks.
3. Replace the site's components with these ones page by page.

## The earlier hand-built export

`src/design-system/untitled-ui/` is an earlier, hand-built export of the same
Figma file into plain CSS classes. The official components supersede it. It is
kept only until the owner decides to remove it; nothing imports it.
