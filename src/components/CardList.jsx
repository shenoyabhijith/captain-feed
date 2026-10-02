import FeedCard from "./FeedCard.jsx";
import { CATEGORY_LABELS } from "./icons.js";

/**
 * Context-aware empty copy for list filters / dock views.
 */
export function emptyMessage({ view = "all", filter = "all", query = "" } = {}) {
  const q = String(query || "").trim();
  if (q) {
    return `No cards match “${q}”.`;
  }
  if (view === "saved") {
    return "Nothing saved. Bookmark a brief to see it here.";
  }
  if (view === "unread") {
    return "You’re caught up.";
  }
  if (filter && filter !== "all") {
    const label = CATEGORY_LABELS[filter] || filter;
    return `No ${label} cards yet.`;
  }
  return "Nothing here yet. Try another filter.";
}

export default function CardList({
  cards,
  prefs,
  onSeen,
  view = "all",
  filter = "all",
  query = "",
}) {
  if (!cards.length) {
    return (
      <div className="empty" role="status">
        {emptyMessage({ view, filter, query })}
      </div>
    );
  }
  return (
    <div className="feed">
      {cards.map((c, index) => {
        const read = Boolean(prefs.read[c.id]);
        const saved = Boolean(prefs.saved[c.id]);
        return (
          <FeedCard
            key={c.id}
            card={c}
            index={index}
            read={read}
            saved={saved}
            onSeen={onSeen}
          />
        );
      })}
    </div>
  );
}
