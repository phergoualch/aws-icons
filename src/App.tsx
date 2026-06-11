import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Header } from "./components/Header";
import { IconTile } from "./components/IconTile";
import { DetailPanel } from "./components/DetailPanel";
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
  | { view: "category"; category: string }
  | { view: "service"; category: string; service: string };

function parseHash(): Route {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "c" && parts[1] && parts[2]) return { view: "service", category: parts[1], service: parts[2] };
  if (parts[0] === "c" && parts[1]) return { view: "category", category: parts[1] };
  return { view: "home" };
}

function routeHash(route: Route): string {
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

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    window.location.hash = routeHash(next);
    setQuery("");
    window.scrollTo({ top: 0 });
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
        generatedAt={catalog?.generatedAt}
        onHome={() => navigate({ view: "home" })}
      />

      <main className="content">
        {!index ? (
          <SkeletonGrid />
        ) : results ? (
          <SearchResults index={index} results={results} query={query} selected={selected} onSelect={setSelected} />
        ) : route.view === "home" ? (
          <HomeView index={index} onNavigate={navigate} selected={selected} onSelect={setSelected} />
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

        {index ? (
          <footer className="footer">
            <p>
              Official AWS Architecture Icons, release {formatDate(index.catalog.source.releaseDate)}; catalog refreshed{" "}
              {formatDate(index.catalog.generatedAt)} from{" "}
              <a href={index.catalog.source.pageUrl} target="_blank" rel="noreferrer">
                aws.amazon.com/architecture/icons
              </a>
              . Icons are AWS trademarks; follow the AWS usage guidelines.
            </p>
          </footer>
        ) : null}
      </main>

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

function HomeView({ index, onNavigate, selected, onSelect }: ViewProps) {
  const { counts } = index.catalog;
  return (
    <>
      <section className="intro">
        <h1>Every AWS architecture icon, current and one click away</h1>
        <p>
          {counts.services} services, {counts.resources} resources, and {counts.groups} group shapes across {counts.categories}{" "}
          categories, refreshed weekly from the official AWS icon package. Download or copy any icon as SVG or PNG in the size you
          need; conversion happens in your browser.
        </p>
      </section>

      <section aria-label="Categories">
        <h2 className="section-title">Browse by category</h2>
        <div className="category-grid">
          {index.catalog.categories.map((category) => {
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

      {index.groups.length > 0 ? (
        <section aria-label="Group shapes">
          <h2 className="section-title">Group shapes</h2>
          <p className="section-note">Container outlines for VPCs, subnets, accounts, and regions.</p>
          <div className="icon-grid">
            {index.groups.map((icon) => (
              <IconTile key={icon.id} icon={icon} baseUrl={BASE} selected={selected?.id === icon.id} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function CategoryView({ index, category, onNavigate, selected, onSelect }: ViewProps & { category: string }) {
  const name = index.categoryName.get(category) ?? category;
  const categoryIcon = index.categoryIcon.get(category);
  const services = index.servicesByCategory.get(category) ?? [];
  const loose = index.looseResourcesByCategory.get(category) ?? [];

  return (
    <>
      <Breadcrumb onNavigate={onNavigate} trail={[{ label: name }]} />
      <section className="view-head">
        {categoryIcon ? <img src={`${BASE}${categoryIcon.asset}`} alt="" width={44} height={44} /> : null}
        <div>
          <h1>{name}</h1>
          <p className="section-note">
            {plural(services.length, "service")}
            {loose.length > 0 ? `, ${plural(loose.length, "category-level resource")}` : ""}. Select a service to see its
            resource icons.
          </p>
        </div>
      </section>

      {categoryIcon ? (
        <div className="icon-grid icon-grid--single">
          <IconTile
            icon={categoryIcon}
            baseUrl={BASE}
            subtitle="category icon"
            selected={selected?.id === categoryIcon.id}
            onSelect={onSelect}
          />
        </div>
      ) : null}

      {services.length > 0 ? (
        <section aria-label="Services">
          <h2 className="section-title">Services</h2>
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
          <h2 className="section-title">{category === "general-icons" ? "General resources" : "Other resources"}</h2>
          <div className="icon-grid">
            {loose.map((icon) => (
              <IconTile key={icon.id} icon={icon} baseUrl={BASE} selected={selected?.id === icon.id} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ) : null}

      {services.length === 0 && loose.length === 0 ? (
        <p className="empty">This category only has its category icon; select it above to export.</p>
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
        {serviceIcon ? <img src={`${BASE}${serviceIcon.asset}`} alt="" width={44} height={44} /> : null}
        <div>
          <h1>{serviceIcon?.name ?? service}</h1>
          <p className="section-note">Service icon plus {plural(resources.length, "resource icon")}.</p>
        </div>
      </section>

      <div className="icon-grid">
        {serviceIcon ? (
          <IconTile
            icon={serviceIcon}
            baseUrl={BASE}
            subtitle="service icon"
            selected={selected?.id === serviceIcon.id}
            onSelect={onSelect}
          />
        ) : null}
        {resources.map((icon) => (
          <IconTile key={icon.id} icon={icon} baseUrl={BASE} selected={selected?.id === icon.id} onSelect={onSelect} />
        ))}
      </div>
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
        <p>
          No icons match “{query.trim()}”. Try a shorter term; search covers service names, resource names, and categories.
        </p>
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
