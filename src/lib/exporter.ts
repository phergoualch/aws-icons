/** Client-side SVG sizing and PNG rasterization. The repo stores one SVG per
 * icon; every size and format users download is produced here. */

export const PNG_SIZES = [16, 32, 48, 64, 128, 256, 512] as const;

export async function fetchSvgText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status})`);
  return response.text();
}

/** Rewrite the root element's width/height so the SVG opens at the chosen size. */
export function resizeSvg(svgText: string, size: number): string {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== "svg") return svgText;
  if (!root.getAttribute("viewBox")) {
    const w = parseFloat(root.getAttribute("width") ?? "");
    const h = parseFloat(root.getAttribute("height") ?? "");
    if (w > 0 && h > 0) root.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  root.setAttribute("width", String(size));
  root.setAttribute("height", String(size));
  return new XMLSerializer().serializeToString(root);
}

export async function svgToPngBlob(svgText: string, size: number): Promise<Blob> {
  const sized = resizeSvg(svgText, size);
  const svgUrl = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");
    context.drawImage(image, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("SVG could not be rendered"));
    image.src = url;
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export async function copyPng(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export function exportFilename(slug: string, size: number | null, extension: "svg" | "png"): string {
  return size ? `${slug}_${size}.${extension}` : `${slug}.${extension}`;
}
