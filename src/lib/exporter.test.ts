import { describe, expect, it } from "vitest";
import { exportFilename, resizeSvg } from "./exporter";

const SAMPLE = '<svg xmlns="http://www.w3.org/2000/svg" width="48px" height="48px" viewBox="0 0 48 48"><rect width="48" height="48"/></svg>';

describe("resizeSvg", () => {
  it("rewrites width and height to the requested size", () => {
    const resized = resizeSvg(SAMPLE, 128);
    expect(resized).toContain('width="128"');
    expect(resized).toContain('height="128"');
    expect(resized).toContain('viewBox="0 0 48 48"');
  });

  it("derives a viewBox when one is missing", () => {
    const noViewBox = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect/></svg>';
    expect(resizeSvg(noViewBox, 32)).toContain('viewBox="0 0 64 64"');
  });

  it("returns the input unchanged when it is not an SVG", () => {
    expect(resizeSvg("<div>nope</div>", 32)).toBe("<div>nope</div>");
  });
});

describe("exportFilename", () => {
  it("includes the size when given", () => {
    expect(exportFilename("amazon-ec2", 64, "png")).toBe("amazon-ec2_64.png");
  });

  it("omits the size for canonical SVG downloads", () => {
    expect(exportFilename("amazon-ec2", null, "svg")).toBe("amazon-ec2.svg");
  });
});
