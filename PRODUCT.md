# Product

## Register

product

## Users

Cloud engineers, solution architects, and technical writers who are mid-diagram
(draw.io, Figma, Excalidraw, slides) or mid-document and need a specific AWS
architecture icon right now. They arrive with a service name in their head,
search or drill down, grab the asset in the size and format their tool wants,
and leave. Sessions are short and task-driven; many arrive from a bookmark or
search engine.

## Product Purpose

A always-up-to-date catalog of official AWS Architecture Icons, deployed as a
static site on GitHub Pages. A weekly GitHub Action pulls the latest official
icon package from AWS and commits one canonical SVG per icon; the client does
all resizing and PNG rasterization, so the repo stays small and every size is
available on demand. Success: a user finds and downloads the right icon in
under ten seconds, and the set is never more than a week behind AWS.

## Brand Personality

Precise, fast, quietly confident. A reference tool, not a marketing page. The
AWS icons themselves are the color and the content; the chrome around them
stays out of the way.

## Anti-references

- aws-icons.com: dated visual language, ad-cluttered, stale icon set.
- Generic SaaS landing-page chrome (hero metrics, gradient text, eyebrow
  labels) has no place in a utility catalog.
- Icon sites that bury the download behind detail pages and modals with five
  clicks.

## Design Principles

- Search is the front door: focused by default reachable from anywhere, instant results.
- Zero-click depth: copy or download directly from the grid; the detail view is
  for options (sizes, formats), not a gate.
- The icons are the interface: neutral ground, AWS's own category colors carry
  the wayfinding.
- Freshness is a feature: the last-updated state is visible, honest, and
  automated.

## Accessibility & Inclusion

WCAG AA contrast in both themes, full keyboard operability (search shortcut,
arrow-key grid navigation not required but tab order sane), visible focus
rings, `prefers-reduced-motion` honored, `prefers-color-scheme` respected by
default.
