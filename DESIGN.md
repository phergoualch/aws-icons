# Design

## Design Read

A dark-first developer reference tool: engineers grabbing diagram assets, often
in dim rooms next to an IDE; the saturated AWS icon gradients read best on a
near-black neutral ground. Light theme is fully supported and follows the
system preference.

Dials: variance 4 / motion 3 / density 6.

## Color

OKLCH tokens, restrained strategy: tinted dark neutrals + one accent (AWS
amber, desaturated) used only for interactive emphasis (focus, active filter,
links, primary buttons). AWS's own per-category gradient colors appear inside
the icons and as subtle category tint on chips; the chrome never competes.

- `--bg`: oklch(0.17 0.012 260) dark / oklch(0.985 0.002 260) light
- `--surface`: oklch(0.21 0.014 260) dark / white light
- `--ink`: oklch(0.93 0.005 260) dark / oklch(0.21 0.02 260) light
- `--muted`: AA-passing secondary text in both themes
- `--accent`: oklch(0.74 0.15 65) dark / oklch(0.55 0.14 60) light

No pure black or white. One corner radius system (--r-sm 6px, --r-md 10px,
--r-lg 14px). Borders are 1px hairlines from the neutral ramp.

## Typography

One variable family: Outfit (self-hosted via @fontsource-variable), weights
400-700 for hierarchy; ui-monospace stack for slugs, sizes, and file names.
Body 14-15px (it is a dense tool), headings step ×1.25+, `text-wrap: balance`
on headings. No serif, no Inter.

## Layout

App shell: slim sticky header (logo, search, theme toggle, last-updated) over
a single scrolling content area. Browse = responsive auto-fit icon grid with
section headers per category; drill-down via breadcrumb (All -> Category ->
Service). Icon detail = side panel (desktop) / bottom sheet (mobile), never a
route change. Footer carries source attribution and refresh date.

## Motion

Subtle and functional only: 120-180ms ease-out fades/translates on panel open,
hover lift on grid tiles (transform/opacity only), instant under
prefers-reduced-motion. No scroll-driven effects.

## Components

- IconTile: SVG preview on checkered-neutral well, name, hover quick actions
  (copy SVG, download).
- DetailPanel: large preview with light/dark ground toggle, size picker
  (16-512), format buttons (SVG / PNG), copy + download, asset path.
- SearchBar: "/" shortcut, clears with Esc, result count, fuzzy substring
  match across name, service, category.
- CategoryCard: official AWS category icon + name + service/resource counts.
