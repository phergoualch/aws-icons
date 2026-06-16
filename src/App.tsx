import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Group, Shapes } from "lucide-react";
import { Header } from "./components/Header";
import { GrabIcon } from "./components/GrabIcon";
import { IconTile } from "./components/IconTile";
import { DetailPanel } from "./components/DetailPanel";
import { BulkDownload } from "./components/BulkDownload";
import {
  buildIndex,
  formatDate,
  iconUrlId,
  loadCatalog,
  searchIcons,
  type Catalog,
  type CatalogIcon,
  type CatalogIndex,
} from "./lib/catalog";
import { ThemeContext } from "./lib/theme";

const BASE = import.meta.env.BASE_URL;
const THEME_KEY = "aws-icons-theme";

type Route = (
  | { view: "home" }
  | { view: "groups" }
  | { view: "category"; category: string }
  | { view: "service"; category: string; service: string }
) & {
  /** Icon id whose export panel is open, kept in the URL so icons are shareable. */
  icon?: string;
};

function parseHash(): Route {
  const [path, params] = window.location.hash.split("?");
  const icon = new URLSearchParams(params).get("icon") ?? undefined;
  let parts = path.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "c") parts = parts.slice(1); // legacy #/c/<category> links
  if (parts[0] === "groups") return { view: "groups", icon };
  if (parts.length >= 2) return { view: "service", category: parts[0], service: parts[1], icon };
  if (parts.length === 1) return { view: "category", category: parts[0], icon };
  return { view: "home", icon };
}

function routePath(route: Route): string {
  if (route.view === "groups") return "#/groups";
  if (route.view === "category") return `#/${route.category}`;
  if (route.view === "service") return `#/${route.category}/${route.service}`;
  return "#/";
}

function routeHash(route: Route): string {
  return route.icon ? `${routePath(route)}?icon=${encodeURIComponent(route.icon)}` : routePath(route);
}

/* Archive layouts mirror the browsing hierarchy at each scope. */

// Within one service: service icon at the root, resources in resources/.
function zipPathInService(icon: CatalogIcon): string {
  return icon.kind === "service" ? icon.slug : `resources/${icon.slug}`;
}

// Within one category: category icon at the root, a folder per service.
function zipPathInCategory(icon: CatalogIcon): string {
  if (icon.kind === "category") return icon.slug;
  if (icon.kind === "resource" && icon.service) return `${icon.service}/${zipPathInService(icon)}`;
  if (icon.kind === "resource") return `resources/${icon.slug}`;
  return `${icon.slug}/${zipPathInService(icon)}`;
}

// Whole catalog: a folder per category, plus groups/.
function zipPathInAll(icon: CatalogIcon): string {
  if (icon.kind === "group") return `groups/${icon.slug}`;
  return `${icon.category ?? "misc"}/${zipPathInCategory(icon)}`;
}

function initialTheme(): "light" | "dark" {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(parseHash);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);

  useEffect(() => {
    loadCatalog(BASE)
      .then(setCatalog)
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Scroll is restored when navigating with browser back/forward: positions
  // are remembered per hash, and programmatic navigation starts at the top.
  const scrollPositions = useRef(new Map<string, number>());
  const pushedNavigation = useRef(false);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Scroll is keyed on the page path only: opening or closing the export
  // panel changes the hash but must not move the page.
  const pathOnly = routePath(route);
  useEffect(() => {
    const target = pushedNavigation.current ? 0 : (scrollPositions.current.get(pathOnly) ?? 0);
    pushedNavigation.current = false;
    requestAnimationFrame(() => window.scrollTo({ top: target }));
  }, [pathOnly]);

  const navigate = useCallback((next: Route) => {
    scrollPositions.current.set((window.location.hash || "#/").split("?")[0], window.scrollY);
    pushedNavigation.current = true;
    window.location.hash = routeHash(next);
    setQuery("");
  }, []);

  // Open/close the export panel by rewriting only the ?icon part of the hash,
  // keeping the page, search query, and scroll position intact. This replaces
  // the history entry rather than pushing one, so Back never lands on an open
  // panel — it steps straight between category/service/resource pages.
  const selectIcon = useCallback((icon: CatalogIcon | null) => {
    const base = (window.location.hash || "#/").split("?")[0];
    const hash = icon ? `${base}?icon=${iconUrlId(icon)}` : base;
    history.replaceState(null, "", hash);
    setRoute(parseHash()); // replaceState skips the hashchange event
  }, []);

  const index = useMemo(() => (catalog ? buildIndex(catalog) : null), [catalog]);
  const results = useMemo(() => (index && query.trim().length >= 2 ? searchIcons(index, query) : null), [index, query]);
  // Accept both the dash form and raw ids (legacy links with %3A separators).
  const selected = route.icon && index ? (index.iconByUrlId.get(route.icon) ?? index.iconById.get(route.icon) ?? null) : null;

  if (loadError) {
    return (
      <div className="boot boot--error" role="alert">
        <p>The icon catalog could not be loaded ({loadError}).</p>
        <p>
          Try reloading the page. If this keeps happening, the deployment is missing <code>catalog.json</code>.
        </p>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
    <div className="app">
      <Header
        query={query}
        onQueryChange={setQuery}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        onHome={() => navigate({ view: "home" })}
      />

      <main className="content">
        {!index ? (
          <SkeletonGrid />
        ) : results ? (
          <SearchResults index={index} results={results} query={query} selected={selected} onSelect={selectIcon} />
        ) : route.view === "home" ? (
          <HomeView index={index} onNavigate={navigate} selected={selected} onSelect={selectIcon} />
        ) : route.view === "groups" ? (
          <GroupsView index={index} onNavigate={navigate} selected={selected} onSelect={selectIcon} />
        ) : route.view === "category" ? (
          <CategoryView index={index} category={route.category} onNavigate={navigate} selected={selected} onSelect={selectIcon} />
        ) : (
          <ServiceView
            index={index}
            category={route.category}
            service={route.service}
            onNavigate={navigate}
            selected={selected}
            onSelect={selectIcon}
          />
        )}

      </main>

      {index ? (
        <footer className="footer">
          <p>
            Built by and for the community, not affiliated with or maintained by AWS. Icons come from the{" "}
            <a href={index.catalog.source.pageUrl} target="_blank" rel="noreferrer">
              official AWS Architecture Icons
            </a>{" "}
            released {formatDate(index.catalog.source.releaseDate)}, refreshed {formatDate(index.catalog.generatedAt)}.
          </p>
        </footer>
      ) : null}

      {selected && index ? <DetailPanel icon={selected} index={index} baseUrl={BASE} onClose={() => selectIcon(null)} /> : null}
    </div>
    </ThemeContext.Provider>
  );
}

interface ViewProps {
  index: CatalogIndex;
  onNavigate: (route: Route) => void;
  selected: CatalogIcon | null;
  onSelect: (icon: CatalogIcon) => void;
}

function HomeView({ index, onNavigate, onSelect }: ViewProps) {
  const { counts } = index.catalog;
  const mainCategories = index.catalog.categories.filter((c) => c.slug !== "general-icons");
  const general = index.catalog.categories.find((c) => c.slug === "general-icons");
  return (
    <>
      <section className="intro">
        <h1>Every AWS architecture icon, current and one click away</h1>
        <p>
          {counts.services} services, {counts.resources} resources, and {counts.groups} group shapes, refreshed weekly from the
          official AWS icon package. Download or copy any icon as SVG or PNG, in any size.
        </p>
      </section>

      <section aria-label="Categories">
        <div className="section-head">
          <h2 className="section-title">Browse by category</h2>
          <BulkDownload icons={index.catalog.icons} archiveName="aws-icons-all" baseUrl={BASE} pathFor={zipPathInAll} />
        </div>
        <div className="icon-grid">
          {mainCategories.map((category) => {
            const icon = index.categoryIcon.get(category.slug);
            const services = index.servicesByCategory.get(category.slug)?.length ?? 0;
            const resources =
              (index.looseResourcesByCategory.get(category.slug)?.length ?? 0) +
              (index.servicesByCategory.get(category.slug) ?? []).reduce(
                (sum, svc) => sum + (index.resourcesByService.get(svc.slug)?.length ?? 0),
                0
              );
            // Without services or resources there is no downstream page; the
            // card is just the category icon, clicking it opens the exporter.
            if (services === 0 && resources === 0 && icon) {
              return <IconTile key={category.slug} icon={icon} baseUrl={BASE} selected={false} onSelect={onSelect} />;
            }
            const subs = [
              services > 0 ? plural(services, "service") : "",
              resources > 0 ? plural(resources, "resource") : "",
            ].filter(Boolean);
            return (
              <NavCard
                key={category.slug}
                name={category.name}
                subs={subs}
                onOpen={() => onNavigate({ view: "category", category: category.slug })}
              >
                {icon ? <GrabIcon icon={icon} assetUrl={`${BASE}${icon.asset}`} size={64} onSelect={onSelect} /> : null}
              </NavCard>
            );
          })}
        </div>
      </section>

      <section aria-label="More icon sets">
        <h2 className="section-title">More icon sets</h2>
        <div className="icon-grid">
          {general ? (
            <NavCard
              name={general.name}
              subs={["Clients, servers, users, documents"]}
              onOpen={() => onNavigate({ view: "category", category: "general-icons" })}
            >
              <span className="category-glyph" aria-hidden>
                <Shapes size={28} />
              </span>
            </NavCard>
          ) : null}
          {index.groups.length > 0 ? (
            <NavCard name="Group shapes" subs={["VPC, subnet, account, region outlines"]} onOpen={() => onNavigate({ view: "groups" })}>
              <span className="category-glyph" aria-hidden>
                <Group size={28} />
              </span>
            </NavCard>
          ) : null}
        </div>
      </section>
    </>
  );
}

// Navigation card with the same anatomy as IconTile, so every page shares one card style.
function NavCard({ name, subs, onOpen, children }: { name: string; subs: string[]; onOpen: () => void; children: React.ReactNode }) {
  return (
    <div
      className="tile"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <span className="tile-well">{children}</span>
      <span className="tile-meta">
        <span className="tile-name">{name}</span>
        {subs.map((sub) => (
          <span key={sub} className="tile-sub">
            {sub}
          </span>
        ))}
      </span>
      <ChevronRight size={16} className="tile-chevron" aria-hidden />
    </div>
  );
}

function GroupsView({ index, onNavigate, selected, onSelect }: ViewProps) {
  return (
    <>
      <Breadcrumb onNavigate={onNavigate} trail={[{ label: "Group shapes" }]} />
      <section className="view-head">
        <div>
          <h1>Group shapes</h1>
          <p className="section-note">{plural(index.groups.length, "container outline")} for VPCs, subnets, accounts, and regions</p>
        </div>
      </section>

      <section aria-label="Group shapes">
        <div className="section-head">
          <h2 className="section-title">Shapes</h2>
          <BulkDownload icons={index.groups} archiveName="aws-icons-groups" baseUrl={BASE} pathFor={(icon) => icon.slug} />
        </div>
        <div className="icon-grid">
          {index.groups.map((icon) => (
            <IconTile key={icon.id} icon={icon} baseUrl={BASE} selected={selected?.id === icon.id} onSelect={onSelect} />
          ))}
        </div>
      </section>
    </>
  );
}

function CategoryView({ index, category, onNavigate, selected, onSelect }: ViewProps & { category: string }) {
  const name = index.categoryName.get(category) ?? category;
  const categoryIcon = index.categoryIcon.get(category);
  const services = index.servicesByCategory.get(category) ?? [];
  const loose = index.looseResourcesByCategory.get(category) ?? [];
  const allCategoryIcons = useMemo(
    () => [
      ...(categoryIcon ? [categoryIcon] : []),
      ...services,
      ...services.flatMap((svc) => index.resourcesByService.get(svc.slug) ?? []),
      ...loose,
    ],
    [categoryIcon, services, loose, index]
  );

  const resourceCount = allCategoryIcons.filter((i) => i.kind === "resource").length;

  return (
    <>
      <Breadcrumb onNavigate={onNavigate} trail={[{ label: name }]} />
      <section className="view-head">
        {categoryIcon ? (
          <GrabIcon icon={categoryIcon} assetUrl={`${BASE}${categoryIcon.asset}`} size={56} onSelect={onSelect} />
        ) : null}
        <div>
          <h1>{name}</h1>
          <p className="section-note">
            {plural(services.length, "service")}
            {resourceCount > 0 ? ` · ${plural(resourceCount, "resource")}` : ""}
          </p>
        </div>
      </section>

      {services.length > 0 ? (
        <section aria-label="Services">
          <div className="section-head">
            <h2 className="section-title">Services</h2>
            <BulkDownload icons={allCategoryIcons} archiveName={`aws-icons-${category}`} baseUrl={BASE} pathFor={zipPathInCategory} />
          </div>
          <div className="icon-grid">
            {services.map((icon) => {
              const resourceCount = index.resourcesByService.get(icon.slug)?.length ?? 0;
              return (
                <ServiceTile
                  key={icon.id}
                  icon={icon}
                  resourceCount={resourceCount}
                  category={category}
                  onNavigate={onNavigate}
                  selected={selected?.id === icon.id}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {loose.length > 0 ? (
        <section aria-label="Category resources">
          <div className="section-head">
            <h2 className="section-title">{category === "general-icons" ? "General resources" : "Other resources"}</h2>
            {services.length === 0 ? (
              <BulkDownload icons={allCategoryIcons} archiveName={`aws-icons-${category}`} baseUrl={BASE} pathFor={zipPathInCategory} />
            ) : null}
          </div>
          <div className="icon-grid">
            {loose.map((icon) => (
              <IconTile key={icon.id} icon={icon} baseUrl={BASE} selected={selected?.id === icon.id} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ) : null}

      {services.length === 0 && loose.length === 0 ? (
        <p className="empty">Only the category icon; click it above to export.</p>
      ) : null}
    </>
  );
}

function ServiceTile({
  icon,
  resourceCount,
  category,
  onNavigate,
  selected,
  onSelect,
}: {
  icon: CatalogIcon;
  resourceCount: number;
  category: string;
  onNavigate: (route: Route) => void;
  selected: boolean;
  onSelect: (icon: CatalogIcon) => void;
}) {
  return (
    <IconTile
      icon={icon}
      baseUrl={BASE}
      subtitle={resourceCount > 0 ? plural(resourceCount, "resource") : undefined}
      selected={selected}
      onSelect={onSelect}
      onOpen={resourceCount > 0 ? () => onNavigate({ view: "service", category, service: icon.slug }) : undefined}
    />
  );
}

function ServiceView({
  index,
  category,
  service,
  onNavigate,
  selected,
  onSelect,
}: ViewProps & { category: string; service: string }) {
  const categoryLabel = index.categoryName.get(category) ?? category;
  const serviceIcon = index.serviceBySlug.get(service);
  const resources = index.resourcesByService.get(service) ?? [];

  return (
    <>
      <Breadcrumb
        onNavigate={onNavigate}
        trail={[
          { label: categoryLabel, route: { view: "category", category } },
          { label: serviceIcon?.name ?? service },
        ]}
      />
      <section className="view-head">
        {serviceIcon ? (
          <GrabIcon icon={serviceIcon} assetUrl={`${BASE}${serviceIcon.asset}`} size={56} onSelect={onSelect} />
        ) : null}
        <div>
          <h1>{serviceIcon?.name ?? service}</h1>
          <p className="section-note">{plural(resources.length, "resource")}</p>
        </div>
      </section>

      <section aria-label="Resources">
        <div className="section-head">
          <h2 className="section-title">Resources</h2>
          <BulkDownload
            icons={[...(serviceIcon ? [serviceIcon] : []), ...resources]}
            archiveName={`aws-icons-${service}`}
            baseUrl={BASE}
            pathFor={zipPathInService}
          />
        </div>
        <div className="icon-grid">
          {resources.map((icon) => (
            <IconTile key={icon.id} icon={icon} baseUrl={BASE} selected={selected?.id === icon.id} onSelect={onSelect} />
          ))}
        </div>
      </section>
    </>
  );
}

function SearchResults({
  index,
  results,
  query,
  selected,
  onSelect,
}: {
  index: CatalogIndex;
  results: CatalogIcon[];
  query: string;
  selected: CatalogIcon | null;
  onSelect: (icon: CatalogIcon) => void;
}) {
  if (results.length === 0) {
    return (
      <div className="empty">
        <p>No icons match “{query.trim()}”.</p>
      </div>
    );
  }
  return (
    <section aria-label="Search results">
      <h2 className="section-title">
        {results.length === 200 ? "200+" : results.length} {results.length === 1 ? "result" : "results"} for “{query.trim()}”
      </h2>
      <div className="icon-grid">
        {results.map((icon) => (
          <IconTile
            key={icon.id}
            icon={icon}
            baseUrl={BASE}
            subtitle={subtitleFor(icon, index)}
            selected={selected?.id === icon.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function subtitleFor(icon: CatalogIcon, index: CatalogIndex): string {
  if (icon.kind === "resource" && icon.service) return index.serviceBySlug.get(icon.service)?.name ?? icon.kind;
  if (icon.kind === "service" && icon.category) return index.categoryName.get(icon.category) ?? icon.kind;
  return icon.kind;
}

function Breadcrumb({
  trail,
  onNavigate,
}: {
  trail: { label: string; route?: Route }[];
  onNavigate: (route: Route) => void;
}) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <button type="button" onClick={() => onNavigate({ view: "home" })}>
        All categories
      </button>
      {trail.map((item) => (
        <span key={item.label} className="crumb">
          <ChevronRight size={13} aria-hidden />
          {item.route ? (
            <button type="button" onClick={() => onNavigate(item.route!)}>
              {item.label}
            </button>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function SkeletonGrid() {
  return (
    <div className="icon-grid" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <div key={i} className="tile tile--skeleton">
          <span className="tile-well" />
          <span className="tile-meta">
            <span className="skeleton-line" />
            <span className="skeleton-line skeleton-line--short" />
          </span>
        </div>
      ))}
    </div>
  );
}
