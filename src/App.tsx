import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Group, Shapes } from "lucide-react";
import { Header } from "./components/Header";
import { IconTile } from "./components/IconTile";
import { DetailPanel } from "./components/DetailPanel";
import { BulkDownload } from "./components/BulkDownload";
import {
  buildIndex,
  formatDate,
  loadCatalog,
  searchIcons,
  type Catalog,
  type CatalogIcon,
  type CatalogIndex,
} from "./lib/catalog";
import { ThemeContext } from "./lib/theme";

const BASE = import.meta.env.BASE_URL;
const THEME_KEY = "aws-icons-theme";

type Route =
  | { view: "home" }
  | { view: "groups" }
  | { view: "category"; category: string }
  | { view: "service"; category: string; service: string };

function parseHash(): Route {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "groups") return { view: "groups" };
  if (parts[0] === "c" && parts[1] && parts[2]) return { view: "service", category: parts[1], service: parts[2] };
  if (parts[0] === "c" && parts[1]) return { view: "category", category: parts[1] };
  return { view: "home" };
}

function routeHash(route: Route): string {
  if (route.view === "groups") return "#/groups";
  if (route.view === "category") return `#/c/${route.category}`;
  if (route.view === "service") return `#/c/${route.category}/${route.service}`;
  return "#/";
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
  const [selected, setSelected] = useState<CatalogIcon | null>(null);
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

  useEffect(() => {
    const target = pushedNavigation.current ? 0 : (scrollPositions.current.get(routeHash(route)) ?? 0);
    pushedNavigation.current = false;
    requestAnimationFrame(() => window.scrollTo({ top: target }));
  }, [route]);

  const navigate = useCallback((next: Route) => {
    scrollPositions.current.set(window.location.hash || "#/", window.scrollY);
    pushedNavigation.current = true;
    window.location.hash = routeHash(next);
    setQuery("");
  }, []);

  const index = useMemo(() => (catalog ? buildIndex(catalog) : null), [catalog]);
  const results = useMemo(() => (index && query.trim().length >= 2 ? searchIcons(index, query) : null), [index, query]);

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
          <SearchResults index={index} results={results} query={query} selected={selected} onSelect={setSelected} />
        ) : route.view === "home" ? (
          <HomeView index={index} onNavigate={navigate} selected={selected} onSelect={setSelected} />
        ) : route.view === "groups" ? (
          <GroupsView index={index} onNavigate={navigate} selected={selected} onSelect={setSelected} />
        ) : route.view === "category" ? (
          <CategoryView index={index} category={route.category} onNavigate={navigate} selected={selected} onSelect={setSelected} />
        ) : (
          <ServiceView
            index={index}
            category={route.category}
            service={route.service}
            onNavigate={navigate}
            selected={selected}
            onSelect={setSelected}
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

      {selected && index ? <DetailPanel icon={selected} index={index} baseUrl={BASE} onClose={() => setSelected(null)} /> : null}
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

function HomeView({ index, onNavigate }: ViewProps) {
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
          <BulkDownload icons={index.catalog.icons} archiveName="aws-icons-all" baseUrl={BASE} label="Download everything" />
        </div>
        <div className="category-grid">
          {mainCategories.map((category) => {
            const icon = index.categoryIcon.get(category.slug);
            const services = index.servicesByCategory.get(category.slug)?.length ?? 0;
            const resources =
              (index.looseResourcesByCategory.get(category.slug)?.length ?? 0) +
              (index.servicesByCategory.get(category.slug) ?? []).reduce(
                (sum, svc) => sum + (index.resourcesByService.get(svc.slug)?.length ?? 0),
                0
              );
            return (
              <button
                key={category.slug}
                type="button"
                className="category-card"
                onClick={() => onNavigate({ view: "category", category: category.slug })}
              >
                {icon ? <img src={`${BASE}${icon.asset}`} alt="" width={40} height={40} loading="lazy" /> : null}
                <span className="category-name">{category.name}</span>
                <span className="category-count">
                  {services > 0 ? plural(services, "service") : ""}
                  {services > 0 && resources > 0 ? " · " : ""}
                  {resources > 0 ? plural(resources, "resource") : ""}
                  {services === 0 && resources === 0 ? "category icon" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="More icon sets">
        <h2 className="section-title">More icon sets</h2>
        <div className="category-grid">
          {general ? (
            <button type="button" className="category-card" onClick={() => onNavigate({ view: "category", category: "general-icons" })}>
              <span className="category-glyph" aria-hidden>
                <Shapes size={26} />
              </span>
              <span className="category-name">{general.name}</span>
              <span className="category-count">Clients, servers, users, documents</span>
            </button>
          ) : null}
          {index.groups.length > 0 ? (
            <button type="button" className="category-card" onClick={() => onNavigate({ view: "groups" })}>
              <span className="category-glyph" aria-hidden>
                <Group size={26} />
              </span>
              <span className="category-name">Group shapes</span>
              <span className="category-count">VPC, subnet, account, region outlines</span>
            </button>
          ) : null}
        </div>
      </section>
    </>
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
        <div className="view-head-actions">
          <BulkDownload icons={index.groups} archiveName="aws-icons-groups" baseUrl={BASE} />
        </div>
      </section>

      <div className="icon-grid">
        {index.groups.map((icon) => (
          <IconTile key={icon.id} icon={icon} baseUrl={BASE} selected={selected?.id === icon.id} onSelect={onSelect} />
        ))}
      </div>
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
          <button
            type="button"
            className="view-head-icon"
            title="Export the category icon"
            onClick={() => onSelect(categoryIcon)}
          >
            <img src={`${BASE}${categoryIcon.asset}`} alt={`${name} category icon`} width={56} height={56} />
          </button>
        ) : null}
        <div>
          <h1>{name}</h1>
          <p className="section-note">
            {plural(services.length, "service")}
            {resourceCount > 0 ? ` · ${plural(resourceCount, "resource")}` : ""}
          </p>
        </div>
        <div className="view-head-actions">
          <BulkDownload icons={allCategoryIcons} archiveName={`aws-icons-${category}`} baseUrl={BASE} />
        </div>
      </section>

      {services.length > 0 ? (
        <section aria-label="Services">
          <h2 className="section-title">Services</h2>
          <div className="icon-grid icon-grid--services">
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
          <h2 className="section-title">{category === "general-icons" ? "General resources" : "Other resources"}</h2>
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
    <div className="service-cell">
      <IconTile
        icon={icon}
        baseUrl={BASE}
        subtitle={resourceCount > 0 ? plural(resourceCount, "resource") : undefined}
        selected={selected}
        onSelect={onSelect}
      />
      {resourceCount > 0 ? (
        <button
          type="button"
          className="service-more"
          onClick={() => onNavigate({ view: "service", category, service: icon.slug })}
        >
          View resources <ChevronRight size={13} aria-hidden />
        </button>
      ) : null}
    </div>
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
          <button
            type="button"
            className="view-head-icon"
            title="Export the service icon"
            onClick={() => onSelect(serviceIcon)}
          >
            <img src={`${BASE}${serviceIcon.asset}`} alt={`${serviceIcon.name} service icon`} width={56} height={56} />
          </button>
        ) : null}
        <div>
          <h1>{serviceIcon?.name ?? service}</h1>
          <p className="section-note">{plural(resources.length, "resource")}</p>
        </div>
        <div className="view-head-actions">
          <BulkDownload
            icons={[...(serviceIcon ? [serviceIcon] : []), ...resources]}
            archiveName={`aws-icons-${service}`}
            baseUrl={BASE}
          />
        </div>
      </section>

      <section aria-label="Resources">
        <h2 className="section-title">Resources</h2>
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
