import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import CardChip from "./CardChip.jsx";
import CardImage, { isWeakImage } from "./CardImage.jsx";
import CardArt, { isStockPlaceholder } from "./CardArt.jsx";
import { PRESS_SPRING, motionTransition, useMotionOn } from "../lib/motion.js";
import { renderInline } from "./details/inline.jsx";
import { estimateReadMinutes } from "./details/readTime.js";
import { categoryHue } from "./details/DetailShell.jsx";

/**
 * Deterministic variant mapping:
 * - hero = newest in active filter (index 0) with usable image
 * - text-only = no/weak image
 * - else standard (full-width image + two-line gist)
 */
export function resolveVariant(card, index) {
  const cover = cardCover(card);
  if (cover.kind === "image" && isWeakImage(cover.src)) return "text-only";
  if (index === 0) return "hero";
  return "standard";
}

const DATE_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? (\d{1,2})(?:, (\d{4}))?\b/;
const THIS_YEAR = String(new Date().getFullYear());

/** "Oct 9, 2026 CT" -> "Oct 9" (year kept only when it isn't this year). */
function shortDate(seg) {
  const m = String(seg || "").match(DATE_RE);
  if (!m) return null;
  return m[3] && m[3] !== THIS_YEAR ? `${m[1]} ${m[2]}, ${m[3]}` : `${m[1]} ${m[2]}`;
}

function sectionTweets(card) {
  return (card?.detail?.sections || []).flatMap((s) => (Array.isArray(s?.tweets) ? s.tweets : []));
}

/** X-sourced (Builders) card: has tweet cards or an "X …" source line. */
function isXCard(card) {
  return sectionTweets(card).length > 0 || /^X\b/.test(String(card?.source || ""));
}

/**
 * Short meta line instead of the long run-on source list.
 * X:     "X · 8 builders · Oct 9"
 * Other: "<outlet> · <price if any> · <date>"
 */
export function metaLine(card) {
  const segs = String(card.source || "").split(/\s+·\s+/).map((x) => x.trim()).filter(Boolean);
  const dateIdx = segs.findIndex((x) => DATE_RE.test(x));
  const date = shortDate(segs[dateIdx]) || shortDate(card.date);
  if (isXCard(card)) {
    // Curated names in the source line win (tweet display names can differ, e.g. "geoff");
    // else count unique tweet authors by handle.
    const listed = new Set(segs.slice(dateIdx >= 0 ? dateIdx + 1 : 1).map((n) => n.toLowerCase()));
    const handles = new Set(sectionTweets(card).map((t) => t?.author?.username).filter(Boolean));
    const n = listed.size || handles.size;
    return ["X", n ? `${n} builders` : null, date].filter(Boolean).join(" · ");
  }
  const price = segs.find((x) => /^\$\d/.test(x));
  const parts = [segs[0], price, date].filter(Boolean);
  if (parts.length === 1 && segs[1]) parts.push(segs[1]); // e.g. "IRS · Pub. 550"
  return parts.join(" · ");
}

/** pbs.twimg.com _normal is 48px; _bigger (73px) stays sharp in the stack. */
const crisp = (u) => String(u || "").replace(/_normal(\.[a-z]+)$/i, "_bigger$1");

/**
 * Cover art. X posts never get stock photos:
 * first tweet image -> else a pastel tile with the lead authors' avatars.
 * Others: source/og image when the data has one, else the existing image.
 */
export function cardCover(card) {
  if (isXCard(card)) {
    const tweets = sectionTweets(card);
    for (const t of tweets) {
      const m = (t?.media || []).find((x) => x?.url || x?.preview_image_url);
      if (m) return { kind: "image", src: m.url || m.preview_image_url };
    }
    const seen = new Set();
    const authors = [];
    for (const t of tweets) {
      const a = t?.author;
      if (!a?.username || seen.has(a.username)) continue;
      seen.add(a.username);
      authors.push({ name: a.name || a.username, avatar: crisp(a.avatar) });
    }
    return { kind: "avatars", authors, posts: tweets.length };
  }
  const src = card?.og_image || card?.ogImage || card?.source_image || card?.sourceImage || card?.image;
  return { kind: "image", src };
}

export function AvatarTile({ authors, posts }) {
  const shown = authors.slice(0, 5);
  const extra = authors.length - shown.length;
  return (
    <div className="card-media card-media--avatars is-ready" aria-hidden="true">
      <div className="avatar-stack">
        {shown.map((a) => (
          <span key={a.name} className="avatar-stack__item">
            {a.avatar ? <img src={a.avatar} alt="" loading="lazy" /> : <span>{a.name[0]}</span>}
          </span>
        ))}
        {extra > 0 ? <span className="avatar-stack__item avatar-stack__more">+{extra}</span> : null}
      </div>
      <span className="avatar-stack__caption">
        <XGlyph /> {posts} posts
      </span>
    </div>
  );
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
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
  const cover = cardCover(card);
  const meta = metaLine(card);
  const eager = index < 2;
  const motionOn = useMotionOn();
  const gist = String(card.detail?.tldr || card.body || "").split(/\n+/)[0];
  const minutes = card.detail ? estimateReadMinutes(card) : null;
  // Same rule as the deck: stock placeholders (picsum etc.) or a failed image -> pastel art band.
  const [imgFailed, setImgFailed] = useState(false);
  const art = cover.kind === "image" && (isStockPlaceholder(cover.src) || imgFailed);

  return (
    <motion.article
      data-hue={categoryHue(card.category)}
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
        {showImage && cover.kind === "avatars" ? (
          <AvatarTile authors={cover.authors} posts={cover.posts} />
        ) : showImage && art ? (
          <div className="card-media card-media--art is-ready">
            <CardArt card={card} />
          </div>
        ) : showImage ? (
          <CardImage
            src={cover.src}
            alt={card.title || "Feed card"}
            eager={eager}
            onFail={() => setImgFailed(true)}
          />
        ) : null}
        <div className="card-body">
          <div className="meta-row">
            <CardChip category={card.category} accent={card.accent} />
            {meta ? <span className="meta-text">{meta}</span> : null}
          </div>
          <h2 className="card-title">{card.title}</h2>
          <p className="card-summary card-summary--tldr">
            {renderInline(gist, { noLinks: true })}
          </p>
          <div className="card-actions">
            <span className="read-pill">
              {minutes ? (
                <>
                  <Clock size={13} strokeWidth={2.2} aria-hidden="true" />
                  {minutes} min
                </>
              ) : (
                <>
                  Open <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
                </>
              )}
            </span>
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
