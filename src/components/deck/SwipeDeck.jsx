import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCheck,
  Clock,
  List,
  RotateCcw,
  Sparkles,
  SquareArrowOutUpRight,
} from "lucide-react";
import { ICON_STROKE } from "../icons.js";
import CardChip from "../CardChip.jsx";
import CardImage, { isWeakImage } from "../CardImage.jsx";
import { Favicon, domainOf } from "../details/SourceShot.jsx";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "../icons.js";
import { AvatarTile, cardCover, metaLine } from "../FeedCard.jsx";
import { renderInline } from "../details/inline.jsx";
import { estimateReadMinutes } from "../details/readTime.js";
import { categoryHue } from "../details/DetailShell.jsx";
import { useMotionOn } from "../../lib/motion.js";

/**
 * SWIPE-DECK: Tinder-style stack for All / For you.
 * Built on motion (framer-motion) drag, already in the bundle:
 *   left / right  -> mark read, next card
 *   up            -> save (bookmark), leaves the deck
 *   tap           -> open the full post
 * Read + saved state is the same feed.prefs the list / Unread / Saved tabs use.
 */

const SWIPE_X = 110; // px past which a horizontal release commits
const SWIPE_Y = 120; // px upward past which a release saves
const FLICK_V = 650; // px/s flick velocity that commits regardless of distance
const DEPTH = 3; // cards rendered (top + 2 fanned behind)

/** Fan like the chat image stack: top card square, two behind tilted & peeking. */
const FAN = [
  { rotate: 0, x: 0, y: 0, scale: 1 },
  { rotate: -4, x: -10, y: 14, scale: 0.955 },
  { rotate: 5, x: 12, y: 26, scale: 0.915 },
];

const FLY = {
  left: { x: -620, y: 40, rotate: -22 },
  right: { x: 620, y: 40, rotate: 22 },
  up: { x: 0, y: -980, rotate: 0 },
};

const SPRING = { type: "spring", stiffness: 420, damping: 34 };
const FLY_T = { duration: 0.32, ease: [0.32, 0.72, 0, 1] };

/** Survives Home remounts (detail round-trip) so undo + caught-up counts persist. */
let deckHistory = [];

const outerVariants = {
  exit: ({ dir, motionOn }) =>
    motionOn && FLY[dir]
      ? { ...FLY[dir], opacity: 0, transition: FLY_T }
      : { opacity: 0, transition: { duration: 0 } },
};

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export default function SwipeDeck({
  cards,
  totalSaved = 0,
  filtered = false,
  onRead,
  onSave,
  onUndo,
  onSeen,
  onShowSaved,
  onShowList,
}) {
  const navigate = useNavigate();
  const motionOn = useMotionOn();
  const [history, setHistoryState] = useState(() => deckHistory); // [{ id, kind, dir }]
  const setHistory = useCallback((next) => {
    setHistoryState((h) => {
      const v = typeof next === "function" ? next(h) : next;
      deckHistory = v;
      return v;
    });
  }, []);
  const [exitDir, setExitDir] = useState("right");
  const [returning, setReturning] = useState(null); // { id, dir } for undo re-entry
  const [announce, setAnnounce] = useState("");

  const top = cards[0] || null;
  const stack = cards.slice(0, DEPTH);
  const readCount = history.filter((h) => h.kind === "read").length;
  const savedCount = history.filter((h) => h.kind === "save").length;

  const commit = useCallback(
    (dir) => {
      if (!top) return;
      const kind = dir === "up" ? "save" : "read";
      setExitDir(dir);
      setReturning(null);
      setHistory((h) => [...h, { id: top.id, kind, dir }]);
      if (kind === "save") onSave(top.id);
      else onRead(top.id);
      setAnnounce(kind === "save" ? `Saved: ${top.title}` : `Marked read: ${top.title}`);
    },
    [top, onRead, onSave, setHistory]
  );

  const undo = useCallback(() => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setReturning({ id: last.id, dir: last.dir });
    onUndo(last);
    setAnnounce("Undid last swipe");
  }, [history, onUndo, setHistory]);

  const open = useCallback(() => {
    if (!top) return;
    onSeen?.(top.id);
    navigate(`/card/${encodeURIComponent(top.id)}`);
  }, [top, onSeen, navigate]);

  // Desktop: arrows swipe, Enter opens, Backspace / Cmd-Z undoes.
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || isTypingTarget(e.target)) return;
      const k = e.key;
      if ((k === "z" || k === "Z") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (k === "Backspace" || k === "u" || k === "U") {
        e.preventDefault();
        undo();
      } else if (!top) {
        return;
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        commit("left");
      } else if (k === "ArrowRight") {
        e.preventDefault();
        commit("right");
      } else if (k === "ArrowUp") {
        e.preventDefault();
        commit("up");
      } else if (k === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, commit, undo, open]);

  return (
    <section className="deck" aria-label="Swipe deck" aria-roledescription="card stack">
      <div className="deck-stage">
        <AnimatePresence custom={{ dir: exitDir, motionOn }} initial={false}>
          {stack
            .map((card, depth) => (
              <DeckSlot
                key={card.id}
                card={card}
                depth={depth}
                motionOn={motionOn}
                returningDir={returning?.id === card.id ? returning.dir : null}
                onCommit={commit}
                onOpen={open}
              />
            ))
            .reverse()}
        </AnimatePresence>
        {!top ? (
          <CaughtUp
            read={readCount}
            saved={savedCount}
            totalSaved={totalSaved}
            filtered={filtered}
            canUndo={history.length > 0}
            onUndo={undo}
            onShowSaved={onShowSaved}
            onShowList={onShowList}
          />
        ) : null}
      </div>

      <div className="deck-controls" role="toolbar" aria-label="Card actions">
        <button
          type="button"
          className="deck-btn deck-btn--quiet"
          onClick={undo}
          disabled={!history.length}
          aria-label="Undo last swipe"
          title="Undo (Backspace)"
        >
          <RotateCcw size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="deck-btn deck-btn--read"
          onClick={() => commit("right")}
          disabled={!top}
          aria-label="Mark read, next card"
          title="Mark read (← / →)"
        >
          <Check size={20} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="deck-btn deck-btn--save"
          onClick={() => commit("up")}
          disabled={!top}
          aria-label="Save card"
          title="Save (↑)"
        >
          <Bookmark size={19} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="deck-btn deck-btn--open"
          onClick={open}
          disabled={!top}
          aria-label="Open full post"
          title="Open (Enter)"
        >
          <SquareArrowOutUpRight size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
        </button>
        <span className="deck-left tabular-nums" aria-label={`${cards.length} cards left`}>
          {cards.length}
        </span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}

/** Outer layer: stack position + exit fling. Inner layer: drag. */
function DeckSlot({ card, depth, motionOn, returningDir, onCommit, onOpen }) {
  const fan = FAN[depth] || FAN[FAN.length - 1];
  const isTop = depth === 0;
  const initial =
    returningDir && FLY[returningDir] && motionOn
      ? { ...FLY[returningDir], opacity: 0, scale: 1 }
      : { ...FAN[Math.min(depth + 1, FAN.length - 1)], opacity: 0 };

  return (
    <motion.div
      className={`deck-slot${isTop ? " is-top" : ""}`}
      style={{ zIndex: DEPTH - depth }}
      variants={outerVariants}
      initial={motionOn ? initial : false}
      animate={{ ...fan, opacity: 1 }}
      exit="exit"
      transition={motionOn ? SPRING : { duration: 0 }}
      aria-hidden={isTop ? undefined : true}
    >
      <DragCard card={card} isTop={isTop} motionOn={motionOn} onCommit={onCommit} onOpen={onOpen} />
    </motion.div>
  );
}

function DragCard({ card, isTop, motionOn, onCommit, onOpen }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragged = useRef(false);
  const rotate = useTransform(x, [-240, 0, 240], motionOn ? [-14, 0, 14] : [0, 0, 0]);
  // Stamps fade in with drag distance; the dominant axis wins.
  const readLeft = useTransform([x, y], ([vx, vy]) =>
    vx < 0 && Math.abs(vx) > -vy ? Math.min(1, Math.abs(vx) / SWIPE_X) : 0
  );
  const readRight = useTransform([x, y], ([vx, vy]) =>
    vx > 0 && vx > -vy ? Math.min(1, vx / SWIPE_X) : 0
  );
  const saveOp = useTransform([x, y], ([vx, vy]) =>
    vy < 0 && -vy > Math.abs(vx) ? Math.min(1, -vy / SWIPE_Y) : 0
  );
  const readScale = useTransform(readRight, [0, 1], [0.8, 1]);
  const readLScale = useTransform(readLeft, [0, 1], [0.8, 1]);
  const saveScale = useTransform(saveOp, [0, 1], [0.8, 1]);

  function onDragEnd(_e, info) {
    const { offset, velocity } = info;
    const up =
      -offset.y > Math.abs(offset.x) &&
      (-offset.y > SWIPE_Y || -velocity.y > FLICK_V);
    const side =
      Math.abs(offset.x) >= -offset.y &&
      (Math.abs(offset.x) > SWIPE_X || Math.abs(velocity.x) > FLICK_V) &&
      Math.sign(offset.x) === Math.sign(velocity.x || offset.x);
    if (up) return onCommit("up");
    if (side) return onCommit(offset.x < 0 ? "left" : "right");
    const back = motionOn ? { type: "spring", stiffness: 500, damping: 30 } : { duration: 0 };
    animate(x, 0, back);
    animate(y, 0, back);
  }

  return (
    <motion.article
      className="deck-card"
      data-hue={categoryHue(card.category)}
      data-card-id={card.id}
      style={isTop ? { x, y, rotate } : undefined}
      drag={isTop}
      dragMomentum={false}
      dragElastic={0.9}
      onPointerDown={() => {
        dragged.current = false;
      }}
      onDragStart={() => {
        dragged.current = true;
      }}
      onDragEnd={isTop ? onDragEnd : undefined}
      onTap={() => {
        if (isTop && !dragged.current) onOpen();
      }}
      whileTap={isTop && motionOn ? { scale: 0.985 } : undefined}
      tabIndex={isTop ? 0 : -1}
      role={isTop ? "button" : undefined}
      aria-label={isTop ? `${card.title}. Swipe left or right to mark read, up to save, tap to open.` : undefined}
    >
      <CardFace card={card} />
      {isTop ? (
        <>
          <motion.div className="deck-stamp deck-stamp--read deck-stamp--left" style={{ opacity: readRight, scale: readScale }} aria-hidden="true">
            <CheckCheck size={20} strokeWidth={2.4} /> Read
          </motion.div>
          <motion.div className="deck-stamp deck-stamp--read deck-stamp--right" style={{ opacity: readLeft, scale: readLScale }} aria-hidden="true">
            <CheckCheck size={20} strokeWidth={2.4} /> Read
          </motion.div>
          <motion.div className="deck-stamp deck-stamp--save" style={{ opacity: saveOp, scale: saveScale }} aria-hidden="true">
            <BookmarkCheck size={22} strokeWidth={2.3} /> Save
          </motion.div>
        </>
      ) : null}
    </motion.article>
  );
}

/** Seeded stock placeholders (picsum etc.) say nothing about the post; treat as no image. */
const STOCK_RE = /(^|\/\/)(picsum\.photos|source\.unsplash\.com|loremflickr\.com|placehold\.co|via\.placeholder\.com)\b/i;
export function isStockPlaceholder(src) {
  return STOCK_RE.test(String(src || ""));
}

/** No real image: pastel art with the category icon + source favicon, in a shorter band. */
function DeckArt({ card }) {
  const Icon = CATEGORY_ICONS[card.category] || Sparkles;
  const domain = domainOf(card.link);
  const source = String(card.source || "").split(/\s+·\s+/)[0] || domain;
  return (
    <div className="deck-art" aria-hidden="true">
      <Icon className="deck-art__ghost" size={168} strokeWidth={1.1} />
      <span className="deck-art__tile">
        <Icon size={34} strokeWidth={1.9} />
      </span>
      <span className="deck-art__src">
        {domain ? <Favicon domain={domain} size={14} className="deck-art__fav" /> : null}
        <span>{source || CATEGORY_LABELS[card.category] || "Captain Feed"}</span>
      </span>
    </div>
  );
}

function CardFace({ card }) {
  const cover = cardCover(card);
  const meta = metaLine(card);
  const gist = String(card.detail?.tldr || card.body || "").split(/\n+/)[0];
  const minutes = card.detail ? estimateReadMinutes(card) : null;
  const noRealImage =
    cover.kind === "image" && (isWeakImage(cover.src) || isStockPlaceholder(cover.src));
  const [imgFailed, setImgFailed] = useState(false);
  const art = noRealImage || imgFailed;
  return (
    <>
      <div className={`deck-card__media${art ? " is-art" : ""}`}>
        {cover.kind === "avatars" ? (
          <AvatarTile authors={cover.authors} posts={cover.posts} />
        ) : art ? (
          <DeckArt card={card} />
        ) : (
          <CardImage
            src={cover.src}
            alt={card.title || "Feed card"}
            eager
            onFail={() => setImgFailed(true)}
          />
        )}
      </div>
      <div className="deck-card__body">
        <div className="meta-row">
          <CardChip category={card.category} accent={card.accent} />
          {meta ? <span className="meta-text">{meta}</span> : null}
        </div>
        <h2 className="deck-card__title">{card.title}</h2>
        {gist ? (
          <p className="deck-card__gist">{renderInline(gist, { noLinks: true })}</p>
        ) : null}
        <div className="deck-card__foot">
          {minutes ? (
            <span className="read-pill">
              <Clock size={13} strokeWidth={2.2} aria-hidden="true" />
              {minutes} min
            </span>
          ) : (
            <span />
          )}
          <span className="deck-card__hint">Tap to open</span>
        </div>
      </div>
    </>
  );
}

function CaughtUp({ read, saved, totalSaved, filtered, canUndo, onUndo, onShowSaved, onShowList }) {
  return (
    <div className="deck-done" role="status">
      <div className="deck-done__icon" aria-hidden="true">
        <CheckCheck size={30} strokeWidth={2.2} />
      </div>
      <h2>You&rsquo;re caught up</h2>
      <p>{filtered ? "Nothing left that matches your search or topics." : "Nothing new in the deck. Saved cards stay in Saved."}</p>
      <div className="deck-done__stats">
        <span className="deck-stat deck-stat--read">
          <Check size={15} strokeWidth={2.4} aria-hidden="true" />
          <b className="tabular-nums">{read}</b> read
        </span>
        <span className="deck-stat deck-stat--save">
          <Bookmark size={15} strokeWidth={2.2} aria-hidden="true" />
          <b className="tabular-nums">{saved}</b> saved
        </span>
      </div>
      <div className="deck-done__actions">
        <button type="button" className="deck-pill deck-pill--brand" onClick={onShowSaved}>
          <Bookmark size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
          Saved{totalSaved ? ` (${totalSaved})` : ""}
        </button>
        <button type="button" className="deck-pill" onClick={onShowList}>
          <List size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
          List view
        </button>
        {canUndo ? (
          <button type="button" className="deck-pill" onClick={onUndo}>
            <RotateCcw size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
            Undo
          </button>
        ) : null}
      </div>
    </div>
  );
}
