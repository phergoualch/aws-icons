import { Download } from "lucide-react";
import type { CatalogIcon } from "../lib/catalog";

interface GrabIconProps {
  icon: CatalogIcon;
  assetUrl: string;
  size?: number;
  onSelect: (icon: CatalogIcon) => void;
}

// The one way to grab an icon, used everywhere an official icon is shown:
// hover reveals a download badge, clicking opens the export panel.
export function GrabIcon({ icon, assetUrl, size = 64, onSelect }: GrabIconProps) {
  return (
    <button
      type="button"
      className="icon-grab"
      title={`Export the ${icon.name} icon`}
      aria-label={`Export the ${icon.name} icon`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(icon);
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <img src={assetUrl} alt="" loading="lazy" width={size} height={size} />
      <span className="icon-grab-badge" aria-hidden>
        <Download size={11} />
      </span>
    </button>
  );
}
