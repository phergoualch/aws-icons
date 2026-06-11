import { useEffect, useState } from "react";
import { Check, Copy, Download, Link2, X } from "lucide-react";
import type { CatalogIcon, CatalogIndex } from "../lib/catalog";
import {
  PNG_SIZES,
  copyPng,
  copyText,
  downloadBlob,
  exportFilename,
  fetchSvgText,
  resizeSvg,
  svgToPngBlob,
} from "../lib/exporter";
import { useTheme } from "../lib/theme";

interface DetailPanelProps {
  icon: CatalogIcon;
  index: CatalogIndex;
  baseUrl: string;
  onClose: () => void;
}

type Feedback = { action: string; state: "done" | "error" } | null;

export function DetailPanel({ icon, index, baseUrl, onClose }: DetailPanelProps) {
  const theme = useTheme();
  const [size, setSize] = useState<number>(64);
  const [variant, setVariant] = useState<"light" | "dark">(theme);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const asset = variant === "dark" && icon.assetDark ? icon.assetDark : icon.asset;
  const assetUrl = `${baseUrl}${asset}`;

  useEffect(() => {
    setVariant(theme);
    setFeedback(null);
  }, [icon.id, theme]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Lock scroll on the root element: its scrollbar-gutter stays reserved,
    // so opening the panel causes no layout shift.
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [onClose]);

  const categoryLabel = icon.category ? (index.categoryName.get(icon.category) ?? icon.category) : null;
  const serviceLabel = icon.service ? (index.serviceBySlug.get(icon.service)?.name ?? icon.service) : null;

  const flash = (action: string, state: "done" | "error") => {
    setFeedback({ action, state });
    setTimeout(() => setFeedback(null), 1600);
  };

  const run = async (action: string, task: () => Promise<void>) => {
    try {
      await task();
      flash(action, "done");
    } catch {
      flash(action, "error");
    }
  };

  const actions = {
      downloadSvg: () =>
        run("download-svg", async () => {
          const text = resizeSvg(await fetchSvgText(assetUrl), size);
          downloadBlob(new Blob([text], { type: "image/svg+xml" }), exportFilename(icon.slug, size, "svg"));
        }),
      copySvg: () =>
        run("copy-svg", async () => {
          await copyText(resizeSvg(await fetchSvgText(assetUrl), size));
        }),
      downloadPng: () =>
        run("download-png", async () => {
          const blob = await svgToPngBlob(await fetchSvgText(assetUrl), size);
          downloadBlob(blob, exportFilename(icon.slug, size, "png"));
        }),
      copyPng: () =>
        run("copy-png", async () => {
          await copyPng(await svgToPngBlob(await fetchSvgText(assetUrl), size));
        }),
  };

  const buttonLabel = (action: string, label: string) => {
    if (feedback?.action !== action) return label;
    return feedback.state === "done" ? "Done" : "Failed";
  };

  return (
    <div
      className="overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
    <div className="panel" role="dialog" aria-modal="true" aria-label={`${icon.name} export options`}>
      <header className="panel-head">
        <div>
          <h2 className="panel-title">{icon.name}</h2>
          <p className="panel-crumbs">
            <span className={`kind kind--${icon.kind}`}>{icon.kind}</span>
            {categoryLabel ? <span>{categoryLabel}</span> : null}
            {serviceLabel && serviceLabel !== icon.name ? <span>{serviceLabel}</span> : null}
          </p>
        </div>
        <div className="panel-head-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Copy link to this icon"
            title="Copy link to this icon"
            onClick={async () => {
              try {
                await copyText(window.location.href);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 1600);
              } catch {
                /* clipboard unavailable; the address bar has the same link */
              }
            }}
          >
            {linkCopied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
          </button>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close panel">
            <X size={16} aria-hidden />
          </button>
        </div>
      </header>

      <div className={`panel-preview panel-preview--${theme}`}>
        <img
          key={assetUrl}
          src={assetUrl}
          alt={`${icon.name} icon preview`}
          style={{ width: 200, height: 200 }}
          ref={(el) => {
            if (el?.complete) el.classList.add("is-loaded");
          }}
          onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
        />
      </div>

      {icon.assetDark ? (
        <div className="panel-row">
          <span className="panel-label">Icon variant</span>
          <div className="seg" role="group" aria-label="Icon theme variant">
            {(["light", "dark"] as const).map((v) => (
              <button key={v} type="button" className={`seg-item${variant === v ? " seg-item--on" : ""}`} onClick={() => setVariant(v)}>
                {v === "light" ? "for light UIs" : "for dark UIs"}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="panel-row panel-row--wrap">
        <span className="panel-label" id="size-label">
          Size
        </span>
        <div className="sizes" role="group" aria-labelledby="size-label">
          {PNG_SIZES.map((s) => (
            <button key={s} type="button" className={`size-chip${size === s ? " size-chip--on" : ""}`} onClick={() => setSize(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-grid">
        <button type="button" className="button button--primary" onClick={actions.downloadPng}>
          <Download size={15} aria-hidden /> {buttonLabel("download-png", `PNG ${size}px`)}
        </button>
        <button type="button" className="button button--primary" onClick={actions.downloadSvg}>
          <Download size={15} aria-hidden /> {buttonLabel("download-svg", `SVG ${size}px`)}
        </button>
        <button type="button" className="button" onClick={actions.copyPng}>
          {feedback?.action === "copy-png" && feedback.state === "done" ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}{" "}
          {buttonLabel("copy-png", "Copy PNG")}
        </button>
        <button type="button" className="button" onClick={actions.copySvg}>
          {feedback?.action === "copy-svg" && feedback.state === "done" ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}{" "}
          {buttonLabel("copy-svg", "Copy SVG")}
        </button>
      </div>
    </div>
    </div>
  );
}
