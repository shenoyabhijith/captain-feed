import { Link } from "react-router-dom";
import { motion } from "motion/react";
import CardChip from "./CardChip.jsx";
import CardImage, { isWeakImage } from "./CardImage.jsx";
import { PRESS_SPRING, motionTransition, useMotionOn } from "../lib/motion.js";

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

export default function FeedCard({
  card,
  index,
  read,
  saved,
  onSeen,
  onToggleSave,
  stagger = false,
}) {
  const variant = resolveVariant(card, index);
  const showImage = variant !== "text-only";
  const meta = metaLine(card);
  const eager = index < 2;
  const motionOn = useMotionOn();

  return (
    <motion.article
      className={`card card--${variant === "text-only" ? "text" : variant}${
        read ? "" : " unread"
      }${stagger ? " stagger" : ""}`}
      whileTap={motionOn ? { scale: 0.985 } : undefined}
      transition={motionTransition(motionOn, PRESS_SPRING)}
    >
      <Link
        to={`/card/${encodeURIComponent(card.id)}`}
        className={`card-link ${read ? "is-read" : "is-unread"}${
          saved ? " is-saved" : ""
        }`}
        onClick={() => onSeen(card.id)}
      >
        {showImage ? (
          <CardImage
            src={card.image}
            alt={card.title || "Feed card"}
            eager={eager}
          />
        ) : null}
        <div className="card-body">
          <div className="meta-row">
            <CardChip category={card.category} accent={card.accent} />
            {meta ? <span className="meta-text">{meta}</span> : null}
          </div>
          <h2 className="card-title">{card.title}</h2>
          {variant !== "compact" ? (
            <p className="card-summary">{card.body}</p>
          ) : null}
          <div className="card-actions">
            {variant !== "compact" ? (
              <span className="tap-hint">Tap for full brief</span>
            ) : (
              <span className="tap-hint" />
            )}
            <button
              type="button"
              className="bookmark"
              aria-label={saved ? "Unsave" : "Save"}
              aria-pressed={saved}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSave?.(card.id);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path
                  className="bm-fill"
                  d="M7 4h10a1 1 0 011 1v15l-6-3.5L6 20V5a1 1 0 011-1z"
                />
              </svg>
            </button>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
