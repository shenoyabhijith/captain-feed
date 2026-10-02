import { useNavigate, useLocation } from "react-router-dom";
import {
  VIEW_ICONS,
  VIEW_LABELS,
  FINANCES_ICON,
  METRICS_ICON,
  ICON_STROKE,
} from "../icons.js";

/**
 * Shared 5-tab dock: All / Unread / Saved / Finances / Metrics.
 * Short text labels under icons; ≥44px tap targets.
 * On Finances/Metrics routes, that tab is selected; feed tabs navigate home.
 */
export default function FeedDock({
  feedView = "all",
  onFeedView,
  ariaLabel = "Feed views",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname || "/";
  const onFinances = path.startsWith("/finances");
  const onMetrics = path.startsWith("/metrics");
  const onSpecial = onFinances || onMetrics;

  function goFeed(id) {
    if (onSpecial) {
      navigate("/");
      try {
        sessionStorage.setItem("captain-feed-dock-view", id);
      } catch {
        /* ignore */
      }
      onFeedView?.(id);
    } else {
      onFeedView?.(id);
    }
  }

  return (
    <nav className="dock dock--five" aria-label={ariaLabel}>
      {["all", "unread", "saved"].map((id) => {
        const Icon = VIEW_ICONS[id];
        const label = VIEW_LABELS[id];
        const pressed = !onSpecial && feedView === id;
        return (
          <button
            key={id}
            type="button"
            data-view={id}
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            aria-current={pressed ? "page" : undefined}
            onClick={() => goFeed(id)}
          >
            <Icon
              size={20}
              strokeWidth={pressed ? ICON_STROKE + 0.4 : ICON_STROKE}
              aria-hidden="true"
            />
            <span className="dock-label">{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        data-view="finances"
        aria-label="Finances"
        title="Finances"
        aria-pressed={onFinances}
        aria-current={onFinances ? "page" : undefined}
        onClick={() => navigate("/finances")}
      >
        <FINANCES_ICON
          size={20}
          strokeWidth={onFinances ? ICON_STROKE + 0.4 : ICON_STROKE}
          aria-hidden="true"
        />
        <span className="dock-label">Finances</span>
      </button>
      <button
        type="button"
        data-view="metrics"
        aria-label="Metrics"
        title="Metrics"
        aria-pressed={onMetrics}
        aria-current={onMetrics ? "page" : undefined}
        onClick={() => navigate("/metrics")}
      >
        <METRICS_ICON
          size={20}
          strokeWidth={onMetrics ? ICON_STROKE + 0.4 : ICON_STROKE}
          aria-hidden="true"
        />
        <span className="dock-label">Metrics</span>
      </button>
    </nav>
  );
}
