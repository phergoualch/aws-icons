export type IconKind = "category" | "service" | "resource" | "group";

export interface CatalogIcon {
  id: string;
  kind: IconKind;
  name: string;
  fullName?: string;
  slug: string;
  category: string | null;
  service?: string | null;
  /** AWS-style acronym ("S3", "EC2") when the official name spells it out. */
  aka?: string;
  asset: string;
  assetDark?: string;
}

export interface Catalog {
  schemaVersion: number;
  source: {
    pageUrl: string;
    archiveUrl: string | null;
    archiveSha256: string;
    releaseDate: string | null;
  };
  generatedAt: string;
  counts: { categories: number; services: number; resources: number; groups: number };
  categories: { slug: string; name: string }[];
  icons: CatalogIcon[];
}

export interface CatalogIndex {
  catalog: Catalog;
  iconById: Map<string, CatalogIcon>;
  categoryName: Map<string, string>;
  categoryIcon: Map<string, CatalogIcon>;
  servicesByCategory: Map<string, CatalogIcon[]>;
  resourcesByService: Map<string, CatalogIcon[]>;
  looseResourcesByCategory: Map<string, CatalogIcon[]>;
  serviceBySlug: Map<string, CatalogIcon>;
  groups: CatalogIcon[];
}

export async function loadCatalog(baseUrl: string): Promise<Catalog> {
  const response = await fetch(`${baseUrl}catalog.json`);
  if (!response.ok) {
    throw new Error(`Could not load catalog.json (HTTP ${response.status})`);
  }
  return (await response.json()) as Catalog;
}

export function buildIndex(catalog: Catalog): CatalogIndex {
  const categoryName = new Map(catalog.categories.map((c) => [c.slug, c.name]));
  const categoryIcon = new Map<string, CatalogIcon>();
  const servicesByCategory = new Map<string, CatalogIcon[]>();
  const resourcesByService = new Map<string, CatalogIcon[]>();
  const looseResourcesByCategory = new Map<string, CatalogIcon[]>();
  const serviceBySlug = new Map<string, CatalogIcon>();
  const groups: CatalogIcon[] = [];

  const push = <K,>(map: Map<K, CatalogIcon[]>, key: K, icon: CatalogIcon) => {
    const list = map.get(key);
    if (list) list.push(icon);
    else map.set(key, [icon]);
  };

  for (const icon of catalog.icons) {
    switch (icon.kind) {
      case "category":
        categoryIcon.set(icon.slug, icon);
        break;
      case "service":
        if (icon.category) push(servicesByCategory, icon.category, icon);
        if (!serviceBySlug.has(icon.slug)) serviceBySlug.set(icon.slug, icon);
        break;
      case "resource":
        if (icon.service) push(resourcesByService, icon.service, icon);
        else if (icon.category) push(looseResourcesByCategory, icon.category, icon);
        break;
      case "group":
        groups.push(icon);
        break;
    }
  }

  const byName = (a: CatalogIcon, b: CatalogIcon) => a.name.localeCompare(b.name);
  for (const list of servicesByCategory.values()) list.sort(byName);
  for (const list of resourcesByService.values()) list.sort(byName);
  for (const list of looseResourcesByCategory.values()) list.sort(byName);
  groups.sort(byName);

  return {
    catalog,
    iconById: new Map(catalog.icons.map((icon) => [icon.id, icon])),
    categoryName,
    categoryIcon,
    servicesByCategory,
    resourcesByService,
    looseResourcesByCategory,
    serviceBySlug,
    groups,
  };
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Rank icons against a query. Exact-name and prefix matches first, then
 * word-boundary matches, then substring matches across name, service, and
 * category. Returns an empty list for queries under two characters.
 */
export function searchIcons(index: CatalogIndex, query: string, limit = 200): CatalogIcon[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  const scored: { icon: CatalogIcon; score: number }[] = [];
  for (const icon of index.catalog.icons) {
    const name = normalize(icon.name);
    // "AWS Lambda" should win the query "lambda" over names that merely start with it.
    const bare = name.replace(/^(aws|amazon) /, "");
    const full = icon.fullName ? normalize(icon.fullName) : name;
    const serviceName = icon.service ? normalize(index.serviceBySlug.get(icon.service)?.name ?? icon.service) : "";
    const categoryLabel = icon.category ? normalize(index.categoryName.get(icon.category) ?? icon.category) : "";

    const aka = icon.aka ? normalize(icon.aka) : null;

    let score = -1;
    if (name === q || bare === q || aka === q) score = 100;
    else if (name.startsWith(q) || bare.startsWith(q) || (aka?.startsWith(q) ?? false)) score = 80;
    else if (full.startsWith(q)) score = 70;
    else if (name.includes(` ${q}`)) score = 60;
    else if (full.includes(` ${q}`)) score = 55;
    else if (name.includes(q) || full.includes(q)) score = 40;
    else if (serviceName.includes(q)) score = 25;
    else if (categoryLabel.includes(q)) score = 10;

    if (score >= 0) {
      // Services are the most common target; nudge them above resources.
      if (icon.kind === "service") score += 5;
      scored.push({ icon, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.icon.name.localeCompare(b.icon.name));
  return scored.slice(0, limit).map((s) => s.icon);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
