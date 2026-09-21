import FeedCard from "./FeedCard.jsx";

export default function CardList({ cards, prefs, onSeen }) {
  if (!cards.length) {
    return (
      <div className="empty" role="status">
        Nothing here yet. Try another filter or clear read marks.
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
