# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Marketing site for **Mechbridge International** (mechbridgegroup.com): MEP, fire and life safety consultancy plus engineer-led training run by Mechbridge MEP Consultants. Training is the primary conversion goal. Product truth, positioning and brand constraints live in `PRODUCT.md`. Read it before changing copy.

## Commands

```bash
npm run dev       # Astro dev server on http://localhost:4321 (also .claude/launch.json "mechbridge-site")
npm run build     # static build to dist/ (12 pages + sitemap)
npm run preview   # serve dist/
npm run deploy:pages  # build with base /website and force-push dist/ to gh-pages → https://mechbridge.github.io/website/
git clone --recurse-submodules https://github.com/Mechbridge/website.git   # brand-theme/ is a submodule (Mechbridge/colorscheme)
```

Repo: `Mechbridge/website` (public). GitHub Pages serves the `gh-pages` branch, which only `deploy:pages` writes; never edit it by hand. Production is meant for `mechbridgegroup.com` at the root. `astro.config.mjs` reads `SITE_URL` and `BASE_PATH` only for the preview build. Every root-relative link must go through `u()` from `src/lib/url.ts` so it picks up the base. Use `stripBase()` when comparing against `Astro.url.pathname`. In Git Bash, set `MSYS_NO_PATHCONV=1` when passing `BASE_PATH`, or MSYS rewrites `/website` into a Windows path.

There are no tests or linters. `npm run build` is the check: it fails on TypeScript/Astro errors in components and page scripts.

## Architecture

- **Astro 5, static output.** Pages are in `src/pages/` (`index`, `services`, `about`, `contact`, `404`, `training/index`, `training/[slug]`). Track pages are generated from `src/data/tracks.ts` through `getStaticPaths`. Shared content lives in `src/data/` (`site.ts` holds names, emails and offices; `training.ts` holds the comparison table and cohort steps used on both home and /training).
- **Layout** (`src/layouts/Base.astro`): self-hosted fonts via `@fontsource-variable` (Bricolage Grotesque standard axes, Geist, Geist Mono, Doto), `global.css`, the fixed `Nav`, a `<div id="smooth-wrapper"><div id="smooth-content">` around `main` + `Footer`, and a named slot `outside` for fixed layers that must sit outside the smooth wrapper.
- **Styling:** `src/styles/global.css` imports `brand-theme/tokens.css` (the brand source of truth) and adds the site layer. Sections take a ground class (`g-navy`, `g-deep`, `g-cream`, `g-paper`, `g-red`) plus a brand theme class (`theme-cream`, `theme-paper`, `theme-red`), which switches the semantic `--color-*` tokens. Component CSS should use the semantic tokens.
- **Motion** (`src/scripts/motion.ts`): GSAP ScrollTrigger + ScrollSmoother + SplitText. The smoother runs only on fine pointers ≥1024px and never under reduced motion; phones scroll natively. Attribute hooks: `[data-enter]` (hero entrance; `[data-enter-item]` children animate in), `[data-split]` (heading line reveal), `[data-reveal-img]` (clip-path reveal, set by `ImageSlot`), `[data-count]`. An inline head script adds `.js` and hides `[data-enter] > *` until `.motion-ready` (2.5s failsafe), so keep those two in sync.
- **Image slots** (`src/components/ImageSlot.astro`): at build time it checks `public/images/<id>.(webp|jpg|png|avif)`. If the file exists it renders an `<img>`, otherwise a labelled blueprint placeholder. Every id and its brief are listed in `IMAGES.md`, so update that file when you add or rename a slot.
- **Forms** (`src/components/EnquiryForm.astro`): post to Web3Forms when `PUBLIC_WEB3FORMS_KEY` is set (`.env`, see `.env.example`). Otherwise they fall back to a prefilled `mailto:` (support topic goes to support@, everything else to connect@).

### Home page clay background (the tricky part)

`src/pages/index.astro` has a hero, then `#clay` containing exactly **10** `.cs` sections. Behind them, the three.js scene from `background-design/` builds one clay piece per section and shifts the ground colour per section (navy, navy, cream, deep navy, navy-900, light cream, near-black, navy, cream, navy). Section `i`'s text colours must match ground `i` (cream sections use `theme-cream`).

- The runtime copy is `public/bg/mb-clay-background.js` (+ `public/bg/three.min.js`), loaded as plain `is:inline defer` scripts. It's a modified copy of `background-design/mb-clay-background.js` with extra props: `paintTarget` (element that receives `--ground`), `layout` (desktop x/y per piece), `mobileLayout` (`x` + `ypx` per piece below 768px), and `bands` (11 section boundaries as fractions, so sections can have different heights). Edit the public copy; `background-design/` stays the design source.
- `src/scripts/home-bg.ts` measures the `.cs` offsets into `bands` (ResizeObserver) and mounts the scene with a props object it keeps mutating. The script re-lays pieces when `bands` changes.
- ScrollSmoother transforms the content, which breaks `position: sticky`. So the canvas (`#clay-stage`) and colour layer (`#clay-ground`) are `position: fixed` in the `outside` slot, and `#smooth-wrapper` gets `z-index: 2` on this page. The hero and footer are opaque and cover the scene.
- Piece positions are in the `clayDesktop` / `clayMobile` arrays in `index.astro`. Content in each section sits on the side away from its piece (`cs--L` = content left, `cs--R` = content right). On phones every piece sits in a 236px top band and content goes on a frosted card below it.

## Brand and content rules

- Colours: Midnight Navy `#1A2841`, Old Cream `#F0E1CE`, Vintage Red `#B11722` (scales in `brand-theme/tokens.css`). **Never red text on navy** (use `red-300`), never navy on red. Glass (`.glass`, `backdrop-filter`) and the fluted Nothing-style art (`FlutedGlass.astro`) appear only over the hero photo or the clay scene. Everything else stays flat brand colour.
- The logo is inlined from `src/data/logo-path.txt` by `Logo.astro` with `fill: currentColor`: cream on navy or photo, red on cream. Static recoloured files are in `public/logo/`, and the favicon is the bridge mark only.
- Don't invent figures, clients, trainer names, fees or durations. Only "15+ years" is confirmed. Unconfirmed items are tracked in `CONTENT-TODO.md`.
- Don't put eyebrow/kicker labels above headings. Write copy in plain, specific sentences with no em dashes.
- Design context for the impeccable skill: `PRODUCT.md`, plus the direction contract in `.impeccable/surfaces/`.
