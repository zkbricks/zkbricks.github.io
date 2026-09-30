# zkBricks website

Landing page and blog for [zkBricks](https://zkbricks.github.io). Built with [Jekyll](https://jekyllrb.com); GitHub Pages builds the site automatically when you push.

## Local development

1. **Install dependencies**
   ```bash
   bundle install
   ```

2. **Build the site** (output in `_site/`)
   ```bash
   ruby -e "require 'bundler/setup'; require 'jekyll'; Jekyll::Commands::Build.process({})"
   ```
   To include the **Research** page with publication data, run the DBLP fetch script once before building:
   ```bash
   node scripts/fetch-dblp.js
   ```
   Then build as above. For CI/deployment, run `node scripts/fetch-dblp.js` before `jekyll build` so the research page is populated from `_data/dblp_research.json`.

3. **Preview** – serve `_site/` with any static server, e.g.:
   ```bash
   python3 -m http.server 8000 --directory _site
   ```
   Then open http://localhost:8000

## Editing content

- **Home** – `index.html` (hero, mission, capabilities, track record, selected work, writing, people)
- **Blog list** – `blogs.html`
- **Blog posts** – add a file in `_posts/` with name `YYYY-MM-DD-slug.md` and front matter (`layout: post`, `title`, `date`, `description`, `authors`, `featured_image`). Use `permalink` if you want a custom URL (e.g. `/blogposts/your-post.html`). Prefer `.webp` images around 1400px wide.
- **Team** – `_data/team.yml` (names, `tagline`, bios, photos, `photo_position`, URLs, optional `dblp` person id, e.g. `33/5817` from `https://dblp.org/pid/33/5817`). Photos live in `assets/team/`.
- **Research** – publications are loaded from DBLP at **build time** by `scripts/fetch-dblp.js`, which writes `_data/dblp_research.json`. The Research page is static and does not call DBLP when the site loads.
  - If DBLP fails or rate-limits, the script exits with an error and **keeps the existing data** rather than overwriting it with an empty list.
  - After changing venue names or areas in the script, run `node scripts/fetch-dblp.js --redecorate` to reapply them to the existing JSON without fetching.
- **Layout / nav / footer** – `_layouts/default.html`, `_layouts/post.html`, `_includes/nav.html`, `_includes/footer.html`, `_includes/head.html`

## Design system

- **Styles** – `assets/css/site.css` (no framework). Plain white in light mode, neutral charcoal in dark mode, and one cornflower-blue accent with translucent illustration fills. Colour tokens live on `:root` with a dark set under `[data-theme="dark"]` and `prefers-color-scheme`.
- **Type** – Aileron throughout, self-hosted in `assets/fonts/aileron/`: UltraLight for the expanded menu, Light for display text and desktop navigation, Regular for reading, and SemiBold/Bold for emphasis. Emphasized headline phrases are slightly larger; dark mode steps section, capability, mission, and footer emphasis up to Bold for clearer contrast. Code uses the system monospace font. Aileron comes from [dot colon](https://dotcolon.net/fonts/aileron/); source and redistribution details are in `assets/fonts/aileron/LICENSE.txt`.
- **Scripts** – `assets/js/site.js` (theme, nav, scroll reveals, manifesto, counters, post TOC and progress), `assets/js/hero.js` (threshold scene with a stationary box), `assets/js/hero-stories.js` (three selectable hero stories and motion controls; markup in `_includes/hero-figures.html`), `assets/js/research.js` (publication wall, filters, search).
- Headings and navigation use plain labels without decorative squares or numbering. Typography and the logo-based illustrations establish hierarchy; numbers convey actual counts, dates, or measurements.
- Text remains readable throughout reveals; no character-scrambling effects.
- The publication chart joins one isometric cube per paper into a tower for each year, using soft blue, teal, violet, and amber tints for research areas, with matching legend swatches and shaded faces. Area filters highlight matching papers; narrow screens scroll across the larger towers. Team authors use the blue accent in publication author lists.
- All motion respects `prefers-reduced-motion`.

After editing, run the build command above to regenerate `_site/`. Pushing to the repo triggers a fresh build on GitHub Pages.
