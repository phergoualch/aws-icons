import { describe, expect, it } from "vitest";
import { buildIndex, formatDate, searchIcons, type Catalog } from "./catalog";

const catalog: Catalog = {
  schemaVersion: 2,
  source: { pageUrl: "https://example.com", archiveUrl: null, archiveSha256: "x", releaseDate: "2026-04-30" },
  generatedAt: "2026-06-11T09:00:00.000Z",
  counts: { categories: 1, services: 2, resources: 3, groups: 1 },
  categories: [{ slug: "compute", name: "Compute" }],
  icons: [
    { id: "category:compute", kind: "category", name: "Compute", slug: "compute", category: "compute", asset: "icons/categories/compute.svg" },
    { id: "service:compute:amazon-ec2", kind: "service", name: "Amazon EC2", slug: "amazon-ec2", category: "compute", asset: "icons/services/compute/amazon-ec2.svg" },
    { id: "service:compute:aws-lambda", kind: "service", name: "AWS Lambda", slug: "aws-lambda", category: "compute", asset: "icons/services/compute/aws-lambda.svg" },
    { id: "resource:compute:amazon-ec2-instance", kind: "resource", name: "Instance", fullName: "Amazon EC2 Instance", slug: "amazon-ec2-instance", category: "compute", service: "amazon-ec2", asset: "icons/resources/compute/amazon-ec2-instance.svg" },
    { id: "resource:compute:aws-lambda-function", kind: "resource", name: "Lambda Function", fullName: "AWS Lambda Lambda Function", slug: "aws-lambda-function", category: "compute", service: "aws-lambda", asset: "icons/resources/compute/aws-lambda-function.svg" },
    { id: "resource:compute:standalone", kind: "resource", name: "Standalone Thing", slug: "standalone", category: "compute", service: null, asset: "icons/resources/compute/standalone.svg" },
    { id: "group:region", kind: "group", name: "Region", slug: "region", category: null, asset: "icons/groups/region.svg" },
  ],
};

describe("buildIndex", () => {
  const index = buildIndex(catalog);

  it("groups services by category, sorted by name", () => {
    expect(index.servicesByCategory.get("compute")?.map((s) => s.name)).toEqual(["Amazon EC2", "AWS Lambda"]);
  });

  it("groups resources under their service", () => {
    expect(index.resourcesByService.get("amazon-ec2")?.map((r) => r.name)).toEqual(["Instance"]);
  });

  it("keeps serviceless resources at category level", () => {
    expect(index.looseResourcesByCategory.get("compute")?.map((r) => r.slug)).toEqual(["standalone"]);
  });

  it("collects groups and category icons", () => {
    expect(index.groups).toHaveLength(1);
    expect(index.categoryIcon.get("compute")?.id).toBe("category:compute");
  });
});

describe("searchIcons", () => {
  const index = buildIndex(catalog);

  it("returns nothing for queries under two characters", () => {
    expect(searchIcons(index, "e")).toEqual([]);
  });

  it("ranks name prefix matches above substring matches", () => {
    const results = searchIcons(index, "lambda");
    expect(results[0].id).toBe("service:compute:aws-lambda");
    expect(results.map((r) => r.id)).toContain("resource:compute:aws-lambda-function");
  });

  it("finds resources through their service name", () => {
    const results = searchIcons(index, "ec2");
    expect(results.map((r) => r.id)).toContain("resource:compute:amazon-ec2-instance");
  });

  it("is case- and punctuation-insensitive", () => {
    expect(searchIcons(index, "EC2")[0].id).toBe("service:compute:amazon-ec2");
  });
});

describe("formatDate", () => {
  it("formats ISO dates", () => {
    expect(formatDate("2026-04-30")).toMatch(/Apr 30, 2026/);
  });

  it("handles missing values", () => {
    expect(formatDate(null)).toBe("unknown");
    expect(formatDate("not-a-date")).toBe("unknown");
  });
});
