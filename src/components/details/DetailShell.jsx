import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookmarkCheck,
  Check,
  Clock,
  Footprints,
  ListOrdered,
  Lightbulb,
  Link2,
  ListChecks,
  MousePointerClick,
  Target,
  Zap,
} from "lucide-react";
import { topicIcon } from "../topicIcons.js";
import { CATEGORY_ICONS, CATEGORY_LABELS, ICON_STROKE } from "../icons.js";
import { renderInline } from "./inline.jsx";
import { TweetStack } from "./TweetCard.jsx";

/** Section color rotation (vivid, never orange). */
export const HUES = ["blue", "violet", "emerald", "pink", "cyan", "gold"];

export const CATEGORY_HUES = {
  ai: "emerald",
  aws: "blue",
  deal: "emerald",
  tax: "cyan",
  trend: "pink",
  book: "gold",
  gym: "emerald",
};

export function categoryHue(category) {
  return CATEGORY_HUES[category] || "blue";
}

function slugify(heading) {
  return String(heading || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/** Split long summary into shorter readable paragraphs. */
export function splitSummary(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  // Prefer existing paragraph breaks
  const byBreak = raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (byBreak.length > 1) return byBreak;
  // Single block: split on sentence boundaries into ~2–3 short paras when long
  if (raw.length < 220) return [raw];
  // Mask decimals ($39.99, 2.4) and dotted tokens (Amazon.com) so "." is not a split.
  const kept = [];
  const masked = raw.replace(
    /\[[^\]\n]*\]\([^)\s]*\)|`[^`\n]*`|\*\*[^*\n]+?\*\*|\d+\.\d+|\b[\w-]+\.[A-Za-z]{2,}\b/g,
    (m) => {
      kept.push(m);
      return `\u0000${kept.length - 1}\u0000`;
    }
  );
  const restore = (s) =>
    s.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
  const sentences =
    masked.match(/[^.!?]+[.!?]+(?:["')\]]+)?(?=\s|$)|[^.!?]+$/g) || [masked];
  const paras = [];
  let buf = "";
  for (const s of sentences) {
    const piece = restore(s.trim());
    const next = (buf + " " + piece).trim();
    if (buf && next.length > 180) {
      paras.push(buf);
      buf = piece;
    } else {
      buf = next;
    }
  }
  if (buf) paras.push(buf);
  return paras.length ? paras : [raw];
}

/** Assign unique section-* ids when headings slug the same. */
export function assignUniqueIds(items) {
  const counts = new Map();
  return items.map((item) => {
    const heading = item.heading || item;
    const base = slugify(typeof heading === "string" ? heading : "") || "section";
    const n = (counts.get(base) || 0) + 1;
    counts.set(base, n);
    const id = n === 1 ? `section-${base}` : `section-${base}-${n}`;
    if (typeof item === "string") return { heading: item, id };
    return { ...item, id };
  });
}

/**
 * Collect every real destination in a brief: narrative sections,
 * Key points, Steps, Actions, Sources, Notes.
 */
export function collectBriefBlocks(detail, card) {
  const d = detail || {};
  const blocks = [];
  for (const s of d.sections || []) {
    if (!s?.heading && !s?.body) continue;
    blocks.push({
      type: "section",
      heading: s.heading || "Notes",
      body: s.body,
      callout: s.callout || null,
      quote: s.quote || null,
      tweets: Array.isArray(s.tweets) ? s.tweets : null,
    });
  }
  if (d.bullets?.length) {
    blocks.push({ type: "bullets", heading: "Key points", items: d.bullets });
  }
  if (d.steps?.length) {
    blocks.push({ type: "steps", heading: "Steps", items: d.steps });
  }
  if (d.actions?.length) {
    blocks.push({ type: "links", heading: "Actions", items: d.actions });
  }
  if (d.sources?.length) {
    blocks.push({ type: "links", heading: "Sources", items: d.sources });
  }
  const hasStructured =
    (d.sections || []).length > 0 || d.bullets?.length || d.steps?.length;
  if (!hasStructured && card?.body) {
    blocks.push({ type: "section", heading: "Notes", body: card.body });
  }
  let r = 0;
  return assignUniqueIds(blocks).map((b) => ({
    ...b,
    hue: b.heading === "Sources" && b.type === "links" ? "slate" : HUES[r++ % HUES.length],
  }));
}

/** Turn a body blob into paragraphs, newline lists, and > pull quotes. */
export function formatBodyBlocks(text) {
  const paras = splitSummary(text);
  const out = [];
  for (const p of paras) {
    const lines = p.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const listish =
      lines.length >= 2 &&
      lines.every((l) => /^([-*•]|\d+[.)])\s+\S/.test(l));
    if (listish) {
      out.push({
        type: "ul",
        items: lines.map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, "")),
      });
      continue;
    }
    for (const line of lines.length > 1 ? lines : [p]) {
      if (/^>\s+/.test(line)) {
        const raw = line.replace(/^>\s+/, "");
        const m = raw.match(/^(.*?)\s+--\s+(.+)$/);
        out.push({ type: "quote", text: m ? m[1] : raw, by: m ? m[2] : null });
      } else {
        out.push({ type: "p", text: line });
      }
    }
  }
  return out;
}

/** "Name: rest" -> colored bold lead + rest (short leads only). */
function LeadText({ text, opts }) {
  const raw = String(text || "");
  const m = raw.match(/^([^:*`\[\]=]{2,24}):\s+([\s\S]+)$/);
  if (!m) return <>{renderInline(raw, opts)}</>;
  return (
    <>
      <span className="lead">{m[1]}:</span> {renderInline(m[2], opts)}
    </>
  );
}

function BodyBlocks({ text }) {
  const blocks = formatBodyBlocks(text);
  if (!blocks.length) return null;
  return (
    <div className="detail-body">
      {blocks.map((b, i) => {
        if (b.type === "ul") {
          return (
            <ul key={i} className="md-list">
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "quote") {
          return <PullQuote key={i} text={b.text} by={b.by} />;
        }
        return (
          <p key={i}>
            <LeadText text={b.text} />
          </p>
        );
      })}
    </div>
  );
}

export function PullQuote({ text, by }) {
  if (!text) return null;
  return (
    <figure className="pull-quote">
      <span className="pull-quote__mark" aria-hidden="true">
        “
      </span>
      <blockquote>
        <p>{renderInline(text, { noStats: true })}</p>
      </blockquote>
      {by ? <figcaption>{by}</figcaption> : null}
    </figure>
  );
}

const CALLOUTS = {
  why: { label: "Why it matters", Icon: Target },
  try: { label: "Try this", Icon: Lightbulb },
};

export function Callout({ kind = "why", text }) {
  if (!text) return null;
  const c = CALLOUTS[kind] || CALLOUTS.why;
  const { Icon } = c;
  return (
    <aside className="callout" data-kind={kind}>
      <p className="callout__label">
        <span className="callout__icon" aria-hidden="true">
          <Icon size={15} strokeWidth={2.2} />
        </span>
        {c.label}
      </p>
      <p className="callout__text">{renderInline(text)}</p>
    </aside>
  );
}

/** Nearest ancestor that actually scrolls, else the document scroller. */
function getScrollParent(el) {
  let node = el?.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const oy = style.overflowY;
    const canScroll =
      (oy === "auto" || oy === "scroll" || oy === "overlay") &&
      node.scrollHeight > node.clientHeight + 1;
    if (canScroll) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

let jumpHighlightTimer = 0;

/** HashRouter-safe jump: no location.hash, scroll the real scroller. */
function scrollToBriefId(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior = reduce ? "auto" : "smooth";
  const scroller = getScrollParent(el);
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const isDoc =
    scroller === document.scrollingElement ||
    scroller === document.documentElement ||
    scroller === document.body;

  // Explicit math — scrollIntoView is unreliable when a route motion.div
  // keeps a transform (containing block / fragment scroll breaks).
  if (isDoc) {
    const doc = document.scrollingElement || document.documentElement;
    const top = el.getBoundingClientRect().top + window.scrollY - margin;
    doc.scrollTo({ top: Math.max(0, top), behavior });
  } else {
    const top =
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      margin;
    scroller.scrollTo({ top: Math.max(0, top), behavior });
  }

  document
    .querySelectorAll(".detail-section.is-jump-target")
    .forEach((n) => n.classList.remove("is-jump-target"));
  el.classList.add("is-jump-target");
  window.clearTimeout(jumpHighlightTimer);
  jumpHighlightTimer = window.setTimeout(() => {
    el.classList.remove("is-jump-target");
  }, 1000);
}

function onJumpClick(event, id) {
  event.preventDefault();
  scrollToBriefId(id);
}

/** Thin top bar: scroll progress, tinted with the section in view. */
function ReadingProgress() {
  const barRef = useRef(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.scrollingElement || document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const bar = barRef.current;
      if (!bar) return;
      bar.style.transform = `scaleX(${p})`;
      let hue = null;
      const secs = document.querySelectorAll(".detail-shell [data-hue].detail-section");
      for (const sec of secs) {
        if (sec.getBoundingClientRect().top < window.innerHeight * 0.35) {
          hue = sec.getAttribute("data-hue");
        }
      }
      if (hue) bar.setAttribute("data-hue", hue);
      else bar.removeAttribute("data-hue");
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="reading-progress" aria-hidden="true">
      <div className="reading-progress__bar" ref={barRef} />
    </div>,
    document.body
  );
}

function CaughtUp({ sectionCount, readMinutes, isRead, onMarkRead, nextCard }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const NextIcon = nextCard ? CATEGORY_ICONS[nextCard.category] || CATEGORY_ICONS.all : null;
  return (
    <section ref={ref} className={`caught-up${inView ? " is-in" : ""}`} aria-label="End of brief">
      <span className="caught-up__check" aria-hidden="true">
        <Check size={28} strokeWidth={3} />
      </span>
      <h2 className="caught-up__title">You’re caught up</h2>
      <p className="caught-up__line">
        <Clock size={13} strokeWidth={2.2} aria-hidden="true" /> {readMinutes} min
        {sectionCount > 1 ? (
          <>
            {" · "}
            <ListOrdered size={13} strokeWidth={2.2} aria-hidden="true" /> {sectionCount} sections
          </>
        ) : null}
      </p>
      {onMarkRead ? (
        isRead ? (
          <p className="caught-up__done">
            <Check size={16} strokeWidth={2.6} aria-hidden="true" /> Marked as read
          </p>
        ) : (
          <button type="button" className="caught-up__mark" onClick={onMarkRead}>
            <BookmarkCheck size={16} strokeWidth={2.2} aria-hidden="true" /> Mark as read
          </button>
        )
      ) : null}
      {nextCard ? (
        <Link
          className="up-next"
          to={`/card/${encodeURIComponent(nextCard.id)}`}
          data-cat={nextCard.category}
        >
          <span className="up-next__meta">
            <span className="up-next__chip">
              {NextIcon ? <NextIcon size={13} strokeWidth={ICON_STROKE} aria-hidden="true" /> : null}
              {CATEGORY_LABELS[nextCard.category] || "Next"}
            </span>
            <span className="up-next__kicker">Up next</span>
          </span>
          <span className="up-next__title">{nextCard.title}</span>
          <span className="up-next__arrow" aria-hidden="true">
            <ArrowRight size={18} strokeWidth={2.4} />
          </span>
        </Link>
      ) : null}
    </section>
  );
}

export default function DetailShell({
  eyebrow,
  category,
  title,
  summary,
  tldr,
  tldrBullets,
  children,
  tags,
  index,
  readMinutes,
  sectionCount,
  nextCard,
  isRead,
  onMarkRead,
}) {
  const catKey =
    category && CATEGORY_LABELS[category]
      ? category
      : eyebrow && CATEGORY_LABELS[eyebrow]
        ? eyebrow
        : null;
  const label =
    eyebrow && CATEGORY_LABELS[eyebrow]
      ? CATEGORY_LABELS[eyebrow]
      : eyebrow
        ? String(eyebrow).replace(/^./, (c) => c.toUpperCase())
        : catKey
          ? CATEGORY_LABELS[catKey]
          : null;
  const CatIcon = CATEGORY_ICONS[catKey] || CATEGORY_ICONS.all;

  const tldrLines = String(tldr || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets = (tldrBullets || []).map((b) => String(b || "").trim()).filter(Boolean);
  const paras = splitSummary(summary);
  const jumpItems = (index || []).filter((s) => s?.heading && s?.id);
  const count = sectionCount ?? jumpItems.length;

  return (
    <div
      className="detail-shell"
      data-category={catKey || undefined}
      data-cat={catKey || "all"}
    >
      <ReadingProgress />
      <div className="detail-meta">
        {label ? (
          <span className="detail-cat">
            <CatIcon size={14} strokeWidth={2} aria-hidden="true" />
            {label}
          </span>
        ) : null}
        {readMinutes ? (
          <span className="detail-pill" title="Read time">
            <Clock size={13} strokeWidth={2.2} aria-hidden="true" />
            {readMinutes} min
          </span>
        ) : null}
        {count > 1 ? (
          <span className="detail-pill" title="Sections">
            <ListOrdered size={13} strokeWidth={2.2} aria-hidden="true" />
            {count}
          </span>
        ) : null}
      </div>
      <h1>{title}</h1>
      {tldrLines.length || bullets.length ? (
        <aside className="detail-tldr" aria-label="TLDR">
          <p className="detail-tldr__label">
            <span className="detail-tldr__pill">
              <Zap size={13} strokeWidth={2.4} aria-hidden="true" />
              TLDR
            </span>
          </p>
          <div className="detail-tldr__body">
            {tldrLines.map((line, i) => (
              <p key={i} className="detail-tldr__snippet">
                {renderInline(line)}
              </p>
            ))}
            {bullets.length ? (
              <ul className="detail-tldr__bullets">
                {bullets.map((b, i) => {
                  const BIcon = topicIcon(b);
                  return (
                    <li key={i} data-hue={HUES[i % HUES.length]} className={BIcon ? "has-icon" : undefined}>
                      {BIcon ? (
                        <span className="tldr-ico" aria-hidden="true">
                          <BIcon size={14} strokeWidth={2.2} />
                        </span>
                      ) : null}
                      <span className="tldr-txt"><LeadText text={b} /></span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </aside>
      ) : null}
      {paras.length ? (
        <div className="detail-summary">
          {paras.map((p, i) => (
            <p key={i}>{renderInline(p)}</p>
          ))}
        </div>
      ) : null}
      {jumpItems.length >= 2 ? (
        <nav className="detail-jump" aria-label="Jump to a section">
          <p className="detail-jump__label" title="Jump to a section">
            <ListOrdered size={14} strokeWidth={2.2} aria-hidden="true" />
            <span className="sr-only">Jump to</span>
          </p>
          <ol className="detail-jump__list">
            {jumpItems.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  data-hue={s.hue || HUES[i % HUES.length]}
                  onClick={(e) => onJumpClick(e, s.id)}
                >
                  <span className="detail-jump__num">
                    {(() => {
                      const JIcon = topicIcon(s.heading);
                      return JIcon ? <JIcon size={13} strokeWidth={2.4} aria-hidden="true" /> : i + 1;
                    })()}
                  </span>
                  <span className="detail-jump__text">{s.heading}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      {children}
      {tags?.length ? (
        <div className="tag-row" aria-label="Tags">
          {tags.map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      ) : null}
      <CaughtUp
        sectionCount={count}
        readMinutes={readMinutes || 1}
        isRead={isRead}
        onMarkRead={onMarkRead}
        nextCard={nextCard}
      />
    </div>
  );
}

const BLOCK_ICONS = {
  bullets: ListChecks,
  steps: Footprints,
  actions: MousePointerClick,
  sources: Link2,
};

function SectionHead({ heading, hue, index, total, iconKey }) {
  const Icon = iconKey ? BLOCK_ICONS[iconKey] : topicIcon(heading);
  return (
    <>
      <header className="sec-head">
        <span className="sec-icon" aria-hidden="true">
          {Icon ? <Icon size={18} strokeWidth={2.2} /> : index || "•"}
        </span>
        {index && total ? (
          <span className="sec-count tabular-nums">
            {index}/{total}
          </span>
        ) : null}
      </header>
      {heading ? <h2 className="sec-title">{heading}</h2> : null}
    </>
  );
}

export function Section({ heading, body, id: idProp, hue = "blue", index, total, callout, quote, tweets }) {
  const id = idProp || (heading ? `section-${slugify(heading)}` : undefined);
  return (
    <section className="detail-section" id={id} data-hue={hue}>
      <SectionHead heading={heading} hue={hue} index={index} total={total} />
      {/* Visual first: the posts lead, the prose follows lighter */}
      <TweetStack tweets={tweets} />
      {callout?.text ? <Callout kind={callout.kind} text={callout.text} /> : null}
      <div className={tweets?.length ? "sec-prose sec-prose--after-media" : "sec-prose"}>
        <BodyBlocks text={body} />
      </div>
      {quote?.text ? <PullQuote text={quote.text} by={quote.by} /> : null}
    </section>
  );
}

export function BulletList({ items, title = "Key points", id: idProp, hue = "blue", index, total }) {
  if (!items?.length) return null;
  const id = idProp || `section-${slugify(title)}`;
  return (
    <section className="detail-section" id={id} data-hue={hue}>
      <SectionHead heading={title} index={index} total={total} iconKey="bullets" />
      <ul className="md-list keypoints">
        {items.map((b, i) => (
          <li key={i}>
            <LeadText text={b} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StepList({ items, id: idProp, hue = "blue", index, total }) {
  if (!items?.length) return null;
  const id = idProp || "section-steps";
  return (
    <section className="detail-section" id={id} data-hue={hue}>
      <SectionHead heading="Steps" index={index} total={total} iconKey="steps" />
      <ol className="steps">
        {items.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ol>
    </section>
  );
}

/** "Name - desc" / "Name — desc" / "Name @handle" -> bold name + rest. */
function LinkLabel({ label }) {
  const raw = String(label || "");
  const m = raw.match(/^(.{2,60}?)\s+(?:[-—–]\s+|(?=@))([\s\S]+)$/);
  if (!m) return <span className="link-row__name">{renderInline(raw, { noLinks: true })}</span>;
  return (
    <>
      <span className="link-row__name">{m[1]}</span>
      <span className="link-row__desc">{renderInline(m[2], { noLinks: true, noStats: true })}</span>
    </>
  );
}

export function LinkList({ items, title, id: idProp, hue = "blue", index, total }) {
  if (!items?.length) return null;
  const id = idProp || `section-${slugify(title)}`;
  const iconKey = title === "Sources" ? "sources" : "actions";
  return (
    <section className="detail-section" id={id} data-hue={hue}>
      <SectionHead heading={title} index={index} total={total} iconKey={iconKey} />
      <div className="link-stack">
        {items.map((a, i) => (
          <a
            key={a.url + a.label}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-row"
            data-hue={hue === "slate" ? "slate" : HUES[i % HUES.length]}
          >
            <span className="link-row__icon" aria-hidden="true">
              <ArrowUpRight size={16} strokeWidth={2.4} />
            </span>
            <span className="link-row__text">
              <LinkLabel label={a.label} />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/** Render brief blocks (section / bullets / steps / links) with stable ids. */
export function BriefBlocks({ blocks }) {
  const total = blocks.length;
  return (
    <>
      {blocks.map((b, i) => {
        const common = { id: b.id, hue: b.hue, index: i + 1, total };
        if (b.type === "bullets") {
          return <BulletList {...common} key={b.id} items={b.items} title={b.heading} />;
        }
        if (b.type === "steps") {
          return <StepList {...common} key={b.id} items={b.items} />;
        }
        if (b.type === "links") {
          return <LinkList {...common} key={b.id} items={b.items} title={b.heading} />;
        }
        return (
          <Section
            {...common}
            key={b.id}
            heading={b.heading}
            body={b.body}
            callout={b.callout}
            quote={b.quote}
            tweets={b.tweets}
          />
        );
      })}
    </>
  );
}
