
  # Navigate Wealth

  This is a code bundle for Navigate Wealth. The original project is available at https://www.figma.com/design/MjgXeyfZj3PfMPXteh1PiH/Navigate-Wealth.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## SEO build environment variables

  The production build (`npm run build`) generates `sitemap.xml`/`robots.txt`,
  prerenders per-route `<head>` metadata, and writes a static `<noscript>` body
  for crawlers. Two optional environment variables tune this pipeline:

  | Variable | Effect |
  | --- | --- |
  | `GOOGLE_SITE_VERIFICATION` | Google Search Console "HTML tag" token. When set, a `<meta name="google-site-verification">` tag is injected into the `<head>` of every prerendered page (and the SPA fallback shell). No-op when unset. `VITE_GOOGLE_SITE_VERIFICATION` is also accepted. |
  | `SEO_REQUIRE_ARTICLES` | `1`/`true` makes a failed published-article fetch hard-fail the build instead of silently degrading to the cached/empty article set; `0`/`false` forces lenient. When unset it defaults to **strict on CI/Vercel** (`CI` or `VERCEL` present) and lenient for local development. |

  To verify the site in Google Search Console: set `GOOGLE_SITE_VERIFICATION`
  in the Vercel project's environment variables, redeploy, complete verification
  in Search Console, then submit `https://www.navigatewealth.co/sitemap.xml`.
  