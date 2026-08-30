Navigate Wealth approved logo assets

Corporate Identity now uses the corrected approved pack as the built-in source for the main logo set.

Built-in production assets:

- Light theme full logo: `navigate-wealth-primary.svg`
- Dark theme full logo: `navigate-wealth-reversed.svg`
- Brand-background variant: `navigate-wealth-brand.svg`
- Light logo only: `navigate-wealth-logo-only-light.svg`
- Dark logo only: `navigate-wealth-logo-only-dark.svg`
- Brand logo only: `navigate-wealth-logo-only-brand.svg`
- Light icon only: `navigate-wealth-icon-only-light.svg`
- Dark icon only: `navigate-wealth-icon-only-dark.svg`
- Brand icon only: `navigate-wealth-icon-only-brand.svg`
- Icon only: `navigate-wealth-icon-padded.svg`
- Social media square: `navigate-wealth-social.svg`
- Monochrome: `navigate-wealth-monochrome.svg`

Approved source files kept for download/reference:

- `../../brand-source/approved-source/Navigate_Wealth_Logo_With_Icon@2x.png`
- `../../brand-source/approved-source/Navigate_Wealth_Logo_With_Icon.svg`
- `../../brand-source/approved-source/Navigate_Wealth_Logo_With_Icon.pdf`
- `../../brand-source/approved-source/Navigate_Wealth_Icon_Only@2x.png`
- `../../brand-source/approved-source/Navigate_Wealth_Icon_Only.svg`
- `../../brand-source/approved-source/Navigate_Wealth_Logo_Only@2x.png`

Notes:

- All built-in assets use transparent backgrounds.
- The active built-ins are path-based SVG traces of the approved supplied artwork, created to preserve the original logo look while improving sharpness and scalability.
- The dark and brand variants keep the same traced artwork and dimensions, with only the `Navigate Wealth` wordmark changed to white for clearer contrast on darker surfaces.
- High-resolution transparent PNG fallbacks are regenerated from the SVG masters for apps and downloads that prefer raster files.
- Rollback copies of the previous built-ins are stored in `../../brand-source/rollback-2026-03-24/`.

## Where the source files went (2026-08-27)

`approved-source/`, `extracted-source/` and `rollback-2026-03-24/` moved to
`brand-source/` at the repository root. They are still in git; they are no
longer deployed.

They were here, and `public/` means "serve this to the internet" — so Vite
copied all 12 MB into `dist/` on every build and Vercel published it. Nothing in
the app referenced any of it. Six MB of that was `.zip` archives of the logo
source, next to `.tiff` and `.pdf` files no browser can render, all publicly
downloadable by anyone who guessed the path.

The web-ready PNG and SVG logos the app actually uses stayed here. If something
from `brand-source/` is ever needed at runtime, export a web format into this
directory rather than moving the source back.
