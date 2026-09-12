import { Link } from "react-router-dom";
import CardChip from "./CardChip.jsx";

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
      {cards.map((c) => {
        const read = Boolean(prefs.read[c.id]);
        const saved = Boolean(prefs.saved[c.id]);
        return (
          <Link
            key={c.id}
            to={`/card/${encodeURIComponent(c.id)}`}
            className={`card-link ${read ? "is-read" : ""} ${saved ? "is-saved" : ""}`}
            onClick={() => onSeen(c.id)}
          >
            <article className="card">
              {c.image ? (
                <img className="media" loading="lazy" alt="" src={c.image} />
              ) : null}
              <div className="body">
                <div className="meta-row">
                  <CardChip category={c.category} accent={c.accent} />
                  <span className="source">{c.source || ""}</span>
                </div>
                <h2>{c.title}</h2>
                <p className="copy">{c.body}</p>
                <div className="tap-hint">Tap for full brief</div>
              </div>
            </article>
          </Link>
        );
      })}
    </div>
  );
}
