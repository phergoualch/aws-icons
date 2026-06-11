import { useEffect, useState } from "react";
import { FolderDown, X } from "lucide-react";
import type { CatalogIcon } from "../lib/catalog";
import { PNG_SIZES, buildZip, downloadBlob, type BulkItem } from "../lib/exporter";

interface BulkDownloadProps {
  /** Icons included in the archive. */
  icons: CatalogIcon[];
  /** Base name of the resulting ZIP, e.g. "aws-icons-compute". */
  archiveName: string;
  baseUrl: string;
  label?: string;
  /** Archive path (without extension) for each icon, mirroring the browsing hierarchy. */
  pathFor: (icon: CatalogIcon) => string;
}

type Phase = { state: "idle" } | { state: "working"; done: number } | { state: "error" };

export function BulkDownload({ icons, archiveName, baseUrl, label = "Download all", pathFor }: BulkDownloadProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"svg" | "png">("svg");
  const [size, setSize] = useState<number>(64);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const start = async () => {
    setPhase({ state: "working", done: 0 });
    try {
      const items: BulkItem[] = icons.map((icon) => ({
        zipPath: pathFor(icon),
        url: `${baseUrl}${icon.asset}`,
      }));
      const blob = await buildZip(items, format, size, (done) => setPhase({ state: "working", done }));
      downloadBlob(blob, `${archiveName}_${format}_${size}.zip`);
      setPhase({ state: "idle" });
      setOpen(false);
    } catch {
      setPhase({ state: "error" });
    }
  };

  const working = phase.state === "working";

  return (
    <>
      <button type="button" className="button" onClick={() => setOpen(true)}>
        <FolderDown size={15} aria-hidden /> {label} ({icons.length})
      </button>

      {open ? (
        <div
          className="overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget && !working) setOpen(false);
          }}
        >
          <div className="panel" role="dialog" aria-modal="true" aria-label={`Download ${icons.length} icons`}>
            <header className="panel-head">
              <div>
                <h2 className="panel-title">{label}</h2>
                <p className="panel-crumbs">
                  <span>{icons.length} icons as a ZIP archive</span>
                </p>
              </div>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close dialog" disabled={working}>
                <X size={16} aria-hidden />
              </button>
            </header>

            <div className="panel-row">
              <span className="panel-label">Format</span>
              <div className="seg" role="group" aria-label="File format">
                {(["svg", "png"] as const).map((f) => (
                  <button key={f} type="button" className={`seg-item${format === f ? " seg-item--on" : ""}`} onClick={() => setFormat(f)} disabled={working}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-row panel-row--wrap">
              <span className="panel-label">Size</span>
              <div className="sizes" role="group" aria-label="Icon size">
                {PNG_SIZES.map((s) => (
                  <button key={s} type="button" className={`size-chip${size === s ? " size-chip--on" : ""}`} onClick={() => setSize(s)} disabled={working}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {working ? (
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={icons.length} aria-valuenow={phase.done}>
                <div className="progress-fill" style={{ width: `${(phase.done / icons.length) * 100}%` }} />
                <span className="progress-text">
                  {phase.done} / {icons.length}
                </span>
              </div>
            ) : (
              <button type="button" className="button button--primary" onClick={start}>
                <FolderDown size={15} aria-hidden /> Download {icons.length} icons as {format.toUpperCase()} {size}px
              </button>
            )}

            {phase.state === "error" ? <p className="panel-path">Something failed while building the archive; try again.</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
