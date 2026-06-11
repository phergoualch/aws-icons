#!/usr/bin/env node
/**
 * Refresh the icon catalog from the official AWS Architecture Icons package.
 *
 * Discovers the latest icon ZIP on aws.amazon.com/architecture/icons/,
 * downloads it, and writes:
 *   - public/icons/<kind>/...  one canonical SVG per icon (largest size)
 *   - public/catalog.json      metadata: hierarchy, search text, lastUpdated
 *
 * The repo stores a single SVG per icon; all resizing and PNG conversion
 * happens client-side. If the upstream archive produces an identical catalog,
 * nothing is written so scheduled runs only commit real changes.
 *
 * Usage:
 *   node scripts/refresh.mjs                  # discover + download latest
 *   node scripts/refresh.mjs --archive x.zip  # use a local archive
 *   node scripts/refresh.mjs --url https://…  # use an explicit archive URL
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = join(ROOT, "public");
const ICONS_DIR = join(PUBLIC_DIR, "icons");
const CATALOG_PATH = join(PUBLIC_DIR, "catalog.json");
const PAGE_URL = "https://aws.amazon.com/architecture/icons/";
const SCHEMA_VERSION = 2;

// Official AWS category display names where hyphen-to-space is not enough.
const CATEGORY_NAMES = {
  "application-integration": "Application Integration",
  "artificial-intelligence": "Artificial Intelligence",
  "business-applications": "Business Applications",
  "cloud-financial-management": "Cloud Financial Management",
  "customer-enablement": "Customer Enablement",
  "customer-experience": "Customer Experience",
  "developer-tools": "Developer Tools",
  "end-user-computing": "End User Computing",
  "front-end-web-mobile": "Front-End Web & Mobile",
  "general-icons": "General Icons",
  "internet-of-things": "Internet of Things",
  "management-tools": "Management & Governance",
  "media-services": "Media Services",
  "migration-modernization": "Migration & Modernization",
  "multicloud-and-hybrid": "Multicloud & Hybrid",
  "networking-content-delivery": "Networking & Content Delivery",
  "quantum-technologies": "Quantum Technologies",
  "security-identity": "Security, Identity & Compliance",
};

// Resource-icon folders that use a different category name than the
// service-icon folders. Maps resource folder slug -> canonical category slug.
const CATEGORY_ALIASES = {
  iot: "internet-of-things",
  "management-governance": "management-tools",
};

// Resource file names sometimes use a different form of the service name than
// the service icon files. Maps name-prefix slug -> canonical service slug
// (applied only when the target service exists in the parsed archive).
const SERVICE_ALIASES = {
  "aws-iot": "aws-iot-core",
  "amazon-vpc": "amazon-virtual-private-cloud",
  "aws-identity-access-management": "aws-identity-and-access-management",
  "amazon-elastic-file-system": "amazon-efs",
  "amazon-msk": "amazon-managed-streaming-for-apache-kafka",
  "amazon-s3": "amazon-simple-storage-service",
  "amazon-ec2-instance": "amazon-ec2",
};

function slugify(value) {
  return value
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function displayName(raw) {
  return raw.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

const ACRONYM_STOPWORDS = new Set(["and", "for", "of", "the", "on", "with", "apache"]);

/**
 * Derive the AWS-style acronym for a service name so searches like "s3" or
 * "ec2" find services whose official names spell the words out. First letters
 * of significant words, consecutive repeats collapsed to letter+count:
 * "Simple Storage Service" -> SSS -> S3, "Elastic Compute Cloud" -> ECC -> EC2.
 */
function serviceAcronym(name) {
  const words = name
    .replace(/^(AWS|Amazon)\s+/i, "")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !ACRONYM_STOPWORDS.has(w.toLowerCase()));
  if (words.length < 3) return null;
  const letters = words.map((w) => w[0].toUpperCase());
  let acronym = "";
  for (let i = 0; i < letters.length; ) {
    let runLength = 1;
    while (letters[i + runLength] === letters[i]) runLength++;
    acronym += runLength > 1 ? `${letters[i]}${runLength}` : letters[i];
    i += runLength;
  }
  return acronym.length >= 2 && acronym.length <= 4 ? acronym : null;
}

function categoryFromSlug(slug) {
  return CATEGORY_NAMES[slug] ?? displayName(slug).replace(/\b\w/g, (c) => c.toUpperCase());
}

async function discoverArchiveUrl() {
  const res = await fetch(PAGE_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to load ${PAGE_URL}: ${res.status}`);
  const html = await res.text();
  const matches = [...html.matchAll(/https?:\/\/[^"'\s)]+?\.zip/gi)].map((m) => m[0]);
  const packages = [...new Set(matches.filter((u) => /icon-package/i.test(u)))];
  if (packages.length === 0) throw new Error("No icon-package ZIP link found on the AWS icons page.");
  return packages.sort().at(-1);
}

async function loadArchive() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const localPath = flag("--archive");
  if (localPath) {
    return { bytes: readFileSync(localPath), archiveUrl: flag("--url") ?? null };
  }
  const archiveUrl = flag("--url") ?? (await discoverArchiveUrl());
  console.log(`Downloading ${archiveUrl}`);
  const res = await fetch(archiveUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to download archive: ${res.status}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), archiveUrl };
}

/** Parse "Icon-package_04302026" style stamps into an ISO date. */
function releaseDateFromUrl(archiveUrl) {
  const m = archiveUrl?.match(/icon-package_(\d{2})(\d{2})(\d{4})/i);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

function parseArchive(bytes) {
  const files = unzipSync(new Uint8Array(bytes), {
    filter: (file) =>
      !file.name.startsWith("__MACOSX") &&
      !file.name.split("/").at(-1).startsWith(".") &&
      file.name.toLowerCase().endsWith(".svg"),
  });

  const categories = new Map(); // slug -> { slug, name, icon }
  const services = []; // { id, name, slug, category, asset }
  const resources = []; // { id, name, slug, category, serviceSlug, asset }
  const darkResources = new Map(); // slug -> dark-theme SVG content
  const groups = [];

  // Prefer the largest available size per icon; entries are keyed per icon.
  const serviceBest = new Map();

  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/");
    const file = parts.at(-1).replace(/\.svg$/i, "");

    if (parts[0].startsWith("Category-Icons")) {
      const m = file.match(/^Arch-Category_(.+)_(\d+)$/);
      if (!m || Number(m[2]) !== 64) continue;
      const slug = slugify(m[1]);
      categories.set(slug, { slug, name: categoryFromSlug(slug), content });
    } else if (parts[0].startsWith("Architecture-Service-Icons")) {
      const m = file.match(/^Arch_(.+)_(\d+)$/);
      if (!m) continue;
      const size = Number(m[2]);
      const categorySlug = slugify(parts[1].replace(/^Arch_/, ""));
      const slug = slugify(m[1]);
      const key = `${categorySlug}/${slug}`;
      const prev = serviceBest.get(key);
      if (!prev || size > prev.size) {
        serviceBest.set(key, { slug, name: displayName(m[1]), category: categorySlug, size, content });
      }
    } else if (parts[0].startsWith("Resource-Icons")) {
      const m = file.match(/^Res_(.+?)_(\d+)(?:_(Dark|Light))?$/i);
      if (!m) continue;
      const theme = m[3]?.toLowerCase() ?? "light";
      if (theme === "dark") {
        darkResources.set(slugify(m[1]), content);
        continue;
      }
      const rawCat = slugify(parts[1].replace(/^Res_/, ""));
      const categorySlug = CATEGORY_ALIASES[rawCat] ?? rawCat;
      resources.push({ raw: m[1], slug: slugify(m[1]), category: categorySlug, content });
    } else if (parts[0].startsWith("Architecture-Group-Icons")) {
      const m = file.match(/^(.+)_(\d+)(_Dark)?$/i);
      if (!m || m[3]) continue;
      groups.push({ slug: slugify(m[1]), name: displayName(m[1]), content });
    }
  }

  for (const svc of serviceBest.values()) services.push(svc);
  return { categories, services, resources, darkResources, groups };
}

function buildCatalog({ categories, services, resources, darkResources, groups }, meta) {
  const assets = new Map(); // public path -> content
  const icons = [];

  const serviceBySlug = new Map();
  for (const svc of services) serviceBySlug.set(svc.slug, svc);
  // Lookup index for matching resources to services, including alias forms.
  const serviceMatch = new Map([...serviceBySlug.keys()].map((slug) => [slug, slug]));
  for (const [alias, target] of Object.entries(SERVICE_ALIASES)) {
    if (serviceBySlug.has(target) && !serviceMatch.has(alias)) serviceMatch.set(alias, target);
  }

  for (const cat of [...categories.values()].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const path = `icons/categories/${cat.slug}.svg`;
    assets.set(path, cat.content);
    icons.push({ id: `category:${cat.slug}`, kind: "category", name: cat.name, slug: cat.slug, category: cat.slug, asset: path });
  }

  for (const svc of [...services].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const path = `icons/services/${svc.category}/${svc.slug}.svg`;
    assets.set(path, svc.content);
    const icon = { id: `service:${svc.category}:${svc.slug}`, kind: "service", name: svc.name, slug: svc.slug, category: svc.category, asset: path };
    const aka = serviceAcronym(svc.name);
    if (aka && !svc.name.toLowerCase().includes(aka.toLowerCase())) icon.aka = aka;
    icons.push(icon);
  }

  for (const res of [...resources].sort((a, b) => a.slug.localeCompare(b.slug))) {
    // "AWS-IoT-Greengrass_Component" -> service "AWS-IoT-Greengrass", resource "Component".
    // Match the longest underscore-prefix that is a known service slug.
    const segments = res.raw.split("_");
    let serviceSlug = null;
    let resourceName = displayName(res.raw);
    for (let i = segments.length - 1; i >= 1; i--) {
      const candidate = slugify(segments.slice(0, i).join("-"));
      if (serviceMatch.has(candidate)) {
        serviceSlug = serviceMatch.get(candidate);
        const rest = segments.slice(i).join(" ");
        if (rest) resourceName = displayName(rest);
        break;
      }
    }
    if (!serviceSlug) {
      // Hyphen-only names like "Amazon-Aurora-Instance": longest service slug
      // that prefixes the resource slug wins.
      let best = null;
      for (const [alias, target] of serviceMatch) {
        if ((res.slug === alias || res.slug.startsWith(alias + "-")) && (!best || alias.length > best.length)) {
          best = alias;
          serviceSlug = target;
        }
      }
    }
    const path = `icons/resources/${res.category}/${res.slug}.svg`;
    assets.set(path, res.content);
    const icon = {
      id: `resource:${res.category}:${res.slug}`,
      kind: "resource",
      name: resourceName,
      fullName: displayName(res.raw),
      slug: res.slug,
      category: res.category,
      service: serviceSlug,
      asset: path,
    };
    const darkContent = darkResources.get(res.slug);
    if (darkContent) {
      const darkPath = `icons/resources/${res.category}/${res.slug}_dark.svg`;
      assets.set(darkPath, darkContent);
      icon.assetDark = darkPath;
    }
    icons.push(icon);
  }

  for (const grp of [...groups].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const path = `icons/groups/${grp.slug}.svg`;
    assets.set(path, grp.content);
    icons.push({ id: `group:${grp.slug}`, kind: "group", name: grp.name, slug: grp.slug, category: null, asset: path });
  }

  const catalog = {
    schemaVersion: SCHEMA_VERSION,
    source: {
      pageUrl: PAGE_URL,
      archiveUrl: meta.archiveUrl,
      archiveSha256: meta.archiveSha256,
      releaseDate: releaseDateFromUrl(meta.archiveUrl),
    },
    counts: {
      categories: categories.size,
      services: services.length,
      resources: resources.length,
      groups: groups.length,
    },
    categories: [...categories.values()]
      .map(({ slug, name }) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    icons,
  };

  return { catalog, assets };
}

/** Stable projection used to detect "nothing actually changed" across runs. */
function fingerprint(catalog, assets) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ ...catalog, source: undefined }));
  for (const [path, content] of [...assets.entries()].sort()) {
    hash.update(path);
    hash.update(content);
  }
  return hash.digest("hex");
}

async function main() {
  const { bytes, archiveUrl } = await loadArchive();
  const archiveSha256 = createHash("sha256").update(bytes).digest("hex");
  console.log(`Archive: ${(bytes.length / 1024 / 1024).toFixed(1)} MiB, sha256 ${archiveSha256.slice(0, 12)}…`);

  const parsed = parseArchive(bytes);
  const { catalog, assets } = buildCatalog(parsed, { archiveUrl, archiveSha256 });
  const { categories, services, resources, groups } = catalog.counts;
  console.log(`Parsed ${categories} categories, ${services} services, ${resources} resources, ${groups} groups.`);

  if (existsSync(CATALOG_PATH)) {
    const previous = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
    if (previous.contentHash === fingerprint(catalog, assets)) {
      console.log("Catalog is already up to date; nothing written.");
      return;
    }
  }

  catalog.contentHash = fingerprint(catalog, assets);
  catalog.generatedAt = new Date().toISOString();

  rmSync(ICONS_DIR, { recursive: true, force: true });
  for (const [path, content] of assets) {
    const target = join(PUBLIC_DIR, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 1) + "\n");
  console.log(`Wrote ${assets.size} SVGs and public/catalog.json.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
