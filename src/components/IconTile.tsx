import { ChevronRight } from "lucide-react";
import type { CatalogIcon } from "../lib/catalog";
import { useTheme } from "../lib/theme";
import { GrabIcon } from "./GrabIcon";

interface IconTileProps {
  icon: CatalogIcon;
  baseUrl: string;
  subtitle?: string;
  selected: boolean;
  onSelect: (icon: CatalogIcon) => void;
  /** Downstream navigation; without it the card opens the export panel and shows no chevron. */
  onOpen?: () => void;
}

export function IconTile({ icon, baseUrl, subtitle, selected, onSelect, onOpen }: IconTileProps) {
  const theme = useTheme();
  // Icons with theme variants (dark-stroke line art) are invisible on the
  // opposite ground; preview the variant that matches the current theme.
  const asset = theme === "dark" && icon.assetDark ? icon.assetDark : icon.asset;
  const assetUrl = `${baseUrl}${asset}`;
  const open = onOpen ?? (() => onSelect(icon));

  return (
    <div
      className={`tile${selected ? " tile--selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={open}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
          event.preventDefault();
          open();
        }
      }}
    >
      <span className="tile-well">
        <GrabIcon icon={icon} assetUrl={assetUrl} size={64} onSelect={onSelect} />
      </span>
      <span className="tile-meta">
        <span className="tile-name">{icon.name}</span>
        {subtitle ? <span className="tile-sub">{subtitle}</span> : null}
      </span>
      {onOpen ? <ChevronRight size={16} className="tile-chevron" aria-hidden /> : null}
    </div>
  );
}
