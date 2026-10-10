import { Glass } from "@samasante/liquid-glass";
import { VIEW_ICONS, VIEW_LABELS, ICON_STROKE } from "../icons.js";

const VIEWS = ["all", "unread", "saved"];

/**
 * Feed dock: All / Unread / Saved. Compact liquid-glass pill, pastel active tab,
 * Lucide icons with short labels; ≥44px tap targets.
 */
export default function FeedDock({ feedView = "all", onFeedView, ariaLabel = "Feed views" }) {
  return (
    <nav className="dock dock--three" aria-label={ariaLabel}>
      {/* LIQUID-GLASS: refracting lens plate (bends the page in Chromium; frost + rim in Safari) */}
      <Glass
        className="dock__glass"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "auto", borderRadius: 999 }}
        optics={{ frost: 14, saturate: 1.8, bend: 0.35, curvature: 0.12, dispersion: 0.25, brightness: 0.06 }}
      >
        {/* a child switches the lib into "material" mode (refracts what is behind) */}
        <span className="dock__glass-body" />
      </Glass>
      {VIEWS.map((id) => {
        const Icon = VIEW_ICONS[id];
        const label = VIEW_LABELS[id];
        const pressed = feedView === id;
        return (
          <button
            key={id}
            type="button"
            data-view={id}
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            aria-current={pressed ? "page" : undefined}
            onClick={() => onFeedView?.(id)}
          >
            <Icon size={20} strokeWidth={pressed ? ICON_STROKE + 0.4 : ICON_STROKE} aria-hidden="true" />
            <span className="dock-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
