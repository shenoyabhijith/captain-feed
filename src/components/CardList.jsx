import FeedCard from "./FeedCard.jsx";
import EmptyArt from "./EmptyArt.jsx";
import { CATEGORY_LABELS } from "./icons.js";

/**
 * Context-aware empty copy for list filters / dock views.
 */
export function emptyMessage({ view = "all", filter = "all", topics = [], query = "" } = {}) {
  const q = String(query || "").trim();
  if (q) {
    return {
      title: "No matches",
      body: `No cards match “${q}”.`,
      art: false,
    };
  }
  if (view === "saved") {
    return {
      title: "Nothing saved yet",
      body: "Tap the bookmark on a card.",
      art: true,
    };
  }
  if (view === "unread" || view === "foryou") {
    return {
      title: "For you is quiet",
      body: "Try All, or clear Topics.",
      art: true,
    };
  }
  if (Array.isArray(topics) && topics.length > 0) {
    return {
      title: "No matches",
      body: "Try another search or clear Topics.",
      art: false,
    };
  }
  if (filter && filter !== "all") {
    const label = CATEGORY_LABELS[filter] || filter;
    return {
      title: `No ${label} cards yet`,
      body: "Try another filter.",
      art: false,
    };
  }
  return {
    title: "Nothing here yet",
    body: "Try another filter.",
    art: false,
  };
}

export default function CardList({
  cards,
  prefs,
  onSeen,
  onToggleSave,
  view = "all",
  filter = "all",
  topics = [],
  query = "",
  stagger = false,
}) {
  if (!cards.length) {
    const msg = emptyMessage({ view, filter, topics, query });
    return (
      <div className="empty-state" role="status">
        {msg.art ? (
          msg.check ? (
            <div className="empty-check" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <EmptyArt />
          )
        ) : null}
        <h3>{msg.title}</h3>
        <p>{msg.body}</p>
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
            onToggleSave={onToggleSave}
            stagger={stagger && index < 3}
          />
        );
      })}
    </div>
  );
}
