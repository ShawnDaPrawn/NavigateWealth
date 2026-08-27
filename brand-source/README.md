# Brand source material — deliberately NOT deployed

These directories were under `public/brand-assets/`, which means Vite copied
every byte into `dist/` and Vercel served them on the public web. Nothing in the
app referenced any of them.

That cost about 12 MB on every deploy, and it published the brand kit: 6 MB of
it was `.zip` archives of the logo source, alongside `.tiff` and `.pdf` files no
browser can render. Anyone who guessed the path could download the lot.

They are kept here because they are the source of truth for the brand, and
`public/` is not the place for source of truth — `public/` means "serve this to
the internet". The web-ready PNG and SVG logos the app actually uses stayed
behind in `public/brand-assets/`.

If something here is ever needed by the app, export a web format (SVG, or WebP
via `npm run optimize:images`) into `public/brand-assets/` rather than moving
the source back.
