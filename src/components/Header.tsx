import { useEffect, useRef } from "react";
import { Moon, Search, Sun, X } from "lucide-react";
import { formatDate } from "../lib/catalog";

interface HeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  generatedAt?: string;
  onHome: () => void;
}

export function Header({ query, onQueryChange, theme, onToggleTheme, generatedAt, onHome }: HeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !isTyping(event)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="header">
      <button type="button" className="brand" onClick={onHome}>
        <span className="brand-mark" aria-hidden>
          <svg viewBox="0 0 24 24" width="30" height="30">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--accent)" />
            <rect x="6.5" y="6.5" width="4.6" height="4.6" rx="1.4" fill="var(--accent-ink)" />
            <rect x="12.9" y="6.5" width="4.6" height="4.6" rx="1.4" fill="var(--accent-ink)" opacity="0.65" />
            <rect x="6.5" y="12.9" width="4.6" height="4.6" rx="1.4" fill="var(--accent-ink)" opacity="0.65" />
            <rect x="12.9" y="12.9" width="4.6" height="4.6" rx="1.4" fill="var(--accent-ink)" />
          </svg>
        </span>
        <span className="brand-name">
          AWS Icons<span className="brand-dot"> Catalog</span>
        </span>
      </button>

      <div className="search">
        <Search size={15} className="search-glyph" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search services, resources, categories"
          aria-label="Search icons"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onQueryChange("");
              inputRef.current?.blur();
            }
          }}
        />
        {query ? (
          <button type="button" className="search-clear" aria-label="Clear search" onClick={() => onQueryChange("")}>
            <X size={14} aria-hidden />
          </button>
        ) : (
          <kbd className="search-kbd" aria-hidden>
            /
          </kbd>
        )}
      </div>

      <div className="header-end">
        {generatedAt ? (
          <span className="updated" title={`Catalog refreshed ${formatDate(generatedAt)}`}>
            Updated {formatDate(generatedAt)}
          </span>
        ) : null}
        <button
          type="button"
          className="icon-button"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
        </button>
      </div>
    </header>
  );
}

function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
}
