import { Link } from "react-router-dom";
import CardChip from "./CardChip.jsx";
import CardImage, { isWeakImage } from "./CardImage.jsx";

/**
 * Deterministic variant mapping (Align Q3):
 * - hero = newest in active filter (index 0) with usable image
 * - compact = index >= 3 with usable image
 * - text-only = no/weak image
 * - else standard
 */
export function resolveVariant(card, index) {
  if (isWeakImage(card?.image)) return "text-only";
  if (index === 0) return "hero";
  if (index >= 3) return "compact";
  return "standard";
}

function metaLine(card) {
  const parts = [];
  if (card.source) parts.push(card.source);
  if (card.date && !String(card.source || "").includes(String(card.date))) {
    parts.push(card.date);
  }
  return parts.join(" · ");
}

export default function FeedCard({ card, index, read, saved, onSeen }) {
  const variant = resolveVariant(card, index);
  const showImage = variant !== "text-only";
  const meta = metaLine(card);

  return (
    <Link
      to={`/card/${encodeURIComponent(card.id)}`}
      className={`card-link ${read ? "is-read" : ""} ${saved ? "is-saved" : ""}`}
      onClick={() => onSeen(card.id)}
    >
      <article className={`card card--${variant === "text-only" ? "text" : variant}`}>
        {showImage ? <CardImage src={card.image} /> : null}
        <div className="card-body">
          <div className="meta-row">
            <CardChip category={card.category} accent={card.accent} />
            {meta ? <span className="meta-text">{meta}</span> : null}
          </div>
          <h2 className="card-title">{card.title}</h2>
          {variant !== "compact" ? (
            <>
              <p className="card-summary">{card.body}</p>
              <div className="tap-hint">Tap for full brief</div>
            </>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
