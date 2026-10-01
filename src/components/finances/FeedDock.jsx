import { useNavigate, useLocation } from "react-router-dom";
import { VIEW_ICONS, VIEW_LABELS, FINANCES_ICON, ICON_STROKE } from "../icons.js";

/**
 * Shared 4-tab dock: All / Unread / Saved / Finances.
 * FEED-DOCK-UPDATE-1: icon-only (aria-label + title); aria-current on active.
 * On Finances routes, Finances is selected; feed tabs navigate home with that view.
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

  function goFeed(id) {
    if (onFinances) {
      navigate("/");
      // Defer view set so Home mounts with preference via session hint
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

  function goFinances() {
    navigate("/finances");
  }

  return (
    <nav className="dock dock--four" aria-label={ariaLabel}>
      {["all", "unread", "saved"].map((id) => {
        const Icon = VIEW_ICONS[id];
        const label = VIEW_LABELS[id];
        const pressed = !onFinances && feedView === id;
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
        onClick={goFinances}
      >
        <FINANCES_ICON
          size={20}
          strokeWidth={onFinances ? ICON_STROKE + 0.4 : ICON_STROKE}
          aria-hidden="true"
        />
      </button>
    </nav>
  );
}
