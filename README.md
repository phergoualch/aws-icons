# AWS Icons Catalog

A static catalog of the official [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/),
deployed on GitHub Pages. Browse by category, service, and resource, search
everything, and download or copy any icon as SVG or PNG in the size you need.

## How it works

- **One SVG per icon in the repo.** `scripts/refresh.mjs` downloads the latest
  official AWS icon package, keeps the largest SVG per icon, and writes
  `public/icons/**` plus `public/catalog.json` (hierarchy, search metadata,
  release and refresh dates). PNGs and other sizes are never stored.
- **All conversion is client-side.** The web app resizes SVGs and rasterizes
  PNGs in the browser (canvas), so every size is available without bloating
  the repository.
- **Weekly auto-refresh.** `.github/workflows/pages.yml` runs every Monday,
  executes the refresh script, commits real changes back to `main`, and
  deploys the same commit to GitHub Pages. The catalog records the AWS release
  date and the refresh timestamp, both shown in the app.

## Toolchain

Node.js 24 only. No Python.

```bash
npm ci          # install
npm run dev     # local dev server
npm run lint    # eslint
npm run test    # vitest
npm run build   # type-check + production build into dist/
npm run refresh # pull the latest icon package from AWS and regenerate assets
```

`make ci` runs install, lint, test, and build; `make refresh` wraps the
refresh script. The refresh script also accepts a local archive for offline
runs: `node scripts/refresh.mjs --archive /path/to/icon-package.zip`.

## Repository layout

- `scripts/refresh.mjs` – icon pipeline (discover, download, extract, catalog)
- `public/icons/` – canonical SVGs: `categories/`, `services/<category>/`,
  `resources/<category>/`, `groups/`
- `public/catalog.json` – generated metadata consumed by the app
- `src/` – React app (Vite, TypeScript)
- `.github/workflows/ci.yml` – lint, test, build on PRs and pushes
- `.github/workflows/pages.yml` – weekly refresh + Pages deployment

## GitHub Pages

Set the repository's Pages source to **GitHub Actions**. Deploys run on every
push to `main`, on manual dispatch (optionally with a catalog refresh), and on
the weekly schedule. Vite builds with a relative base path, so the site works
on any `https://<user>.github.io/<repo>/` URL without configuration.

## Licensing note

The AWS Architecture Icons are provided by AWS under their own
[terms](https://aws.amazon.com/architecture/icons/); this repository only
mirrors them for convenience.
