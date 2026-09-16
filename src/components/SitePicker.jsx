/** Short display names for site chips/cards (no IPs, no long suffixes). */
export function siteDisplayName(site) {
  const raw = site?.label || site?.name || "";
  return String(raw).replace(/\s*\([^)]*\)\s*$/, "").trim() || raw;
}

export default function SitePicker({ sites, selectedName, onSelect }) {
  return (
    <div className="site-grid" role="listbox" aria-label="Sites">
      {sites.map((site) => {
        const active = selectedName === site.name;
        const name = siteDisplayName(site);
        return (
          <button
            key={site.name}
            type="button"
            role="option"
            aria-selected={active}
            className={`site-tile ${active ? "active" : ""}`}
            onClick={() => onSelect(site)}
          >
            <span className="site-tile-name">{name}</span>
            {active ? <span className="site-tile-check" aria-hidden>✓</span> : null}
          </button>
        );
      })}
    </div>
  );
}
