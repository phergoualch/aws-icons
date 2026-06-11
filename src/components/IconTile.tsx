import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import type { CatalogIcon } from "../lib/catalog";
import { copyText, downloadBlob, exportFilename, fetchSvgText } from "../lib/exporter";
import { useTheme } from "../lib/theme";

interface IconTileProps {
  icon: CatalogIcon;
  baseUrl: string;
  subtitle?: string;
  selected: boolean;
  onSelect: (icon: CatalogIcon) => void;
}

export function IconTile({ icon, baseUrl, subtitle, selected, onSelect }: IconTileProps) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  // Icons with theme variants (dark-stroke line art) are invisible on the
  // opposite ground; preview the variant that matches the current theme.
  const asset = theme === "dark" && icon.assetDark ? icon.assetDark : icon.asset;
  const assetUrl = `${baseUrl}${asset}`;

  const handleCopySvg = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await copyText(await fetchSvgText(assetUrl));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable; the detail panel offers download instead */
    }
  };

  const handleDownloadSvg = async (event: React.MouseEvent) => {
    event.stopPropagation();
    const text = await fetchSvgText(assetUrl);
    downloadBlob(new Blob([text], { type: "image/svg+xml" }), exportFilename(icon.slug, null, "svg"));
  };

  return (
    <div
      className={`tile${selected ? " tile--selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(icon)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(icon);
        }
      }}
    >
      <span className="tile-well">
        <img src={assetUrl} alt="" loading="lazy" width={48} height={48} />
      </span>
      <span className="tile-meta">
        <span className="tile-name">{icon.name}</span>
        {subtitle ? <span className="tile-sub">{subtitle}</span> : null}
      </span>
      <span className="tile-actions">
        <button
          type="button"
          className="tile-action"
          title="Copy SVG markup"
          aria-label={`Copy ${icon.name} SVG markup`}
          onClick={handleCopySvg}
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        </button>
        <button
          type="button"
          className="tile-action"
          title="Download SVG"
          aria-label={`Download ${icon.name} SVG`}
          onClick={handleDownloadSvg}
        >
          <Download size={14} aria-hidden />
        </button>
      </span>
    </div>
  );
}
