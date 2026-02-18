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

- **Home** – `index.html` (hero and value props)
- **Blog list** – `blogs.html`
- **Blog posts** – add a file in `_posts/` with name `YYYY-MM-DD-slug.md` and front matter (`layout: post`, `title`, `date`, etc.). Use `permalink` if you want a custom URL (e.g. `/blogposts/your-post.html`).
- **Team** – `_data/team.yml` (names, bios, photos, URLs, optional `dblp` author token for the Research page). Photos live in `assets/team/`.
- **Research** – publications are loaded from DBLP at **build time** by `scripts/fetch-dblp.js`, which writes `_data/dblp_research.json`. The Research page is static and does not call DBLP when the site loads.
- **Layout / nav / footer** – `_layouts/default.html`, `_includes/nav.html`, `_includes/footer.html`, `_includes/head.html`

After editing, run the build command above to regenerate `_site/`. Pushing to the repo triggers a fresh build on GitHub Pages.
