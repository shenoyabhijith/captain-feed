import { CATEGORY_LABELS } from "../icons.js";

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
    /\d+\.\d+|\b[\w-]+\.[A-Za-z]{2,}\b/g,
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
  return assignUniqueIds(blocks);
}

/** Turn a body blob into paragraphs and plain newline lists (no markdown lib). */
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
    } else if (lines.length > 1) {
      for (const line of lines) out.push({ type: "p", text: line });
    } else {
      out.push({ type: "p", text: p });
    }
  }
  return out;
}

function BodyBlocks({ text }) {
  const blocks = formatBodyBlocks(text);
  if (!blocks.length) return null;
  return (
    <div className="detail-body">
      {blocks.map((b, i) =>
        b.type === "ul" ? (
          <ul key={i}>
            {b.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.text}</p>
        )
      )}
    </div>
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

  const tldrSnippet = String(tldr || "").trim();
  const bullets = (tldrBullets || []).map((b) => String(b || "").trim()).filter(Boolean);
  const paras = splitSummary(summary);
  const jumpItems = (index || []).filter((s) => s?.heading && s?.id);

  return (
    <div
      className="detail-shell"
      data-category={catKey || undefined}
    >
      {label ? <p className="detail-eyebrow">{label}</p> : null}
      <h1>{title}</h1>
      {tldrSnippet ? (
        <aside className="detail-tldr" aria-label="TLDR">
          <p className="detail-tldr__label">TLDR</p>
          <div className="detail-tldr__body">
            <p className="detail-tldr__snippet">{tldrSnippet}</p>
            {bullets.length ? (
              <ul className="detail-tldr__bullets">
                {bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </aside>
      ) : null}
      {paras.length ? (
        <div className="detail-summary">
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}
      {tags?.length ? (
        <div className="tag-row">
          {tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {jumpItems.length >= 2 ? (
        <nav className="detail-jump" aria-label="On this brief">
          <p className="detail-jump__label">On this brief</p>
          <ol className="detail-jump__list">
            {jumpItems.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => onJumpClick(e, s.id)}
                >
                  <span className="detail-jump__num">{i + 1}</span>
                  <span className="detail-jump__text">{s.heading}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      {children}
    </div>
  );
}

export function Section({ heading, body, id: idProp }) {
  const id = idProp || (heading ? `section-${slugify(heading)}` : undefined);
  return (
    <section className="detail-section" id={id}>
      {heading ? <h2>{heading}</h2> : null}
      <BodyBlocks text={body} />
    </section>
  );
}

export function BulletList({ items, title = "Key points", id: idProp }) {
  if (!items?.length) return null;
  const id = idProp || `section-${slugify(title)}`;
  return (
    <section className="detail-section" id={id}>
      <h2>{title}</h2>
      <ul>
        {items.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </section>
  );
}

export function StepList({ items, id: idProp }) {
  if (!items?.length) return null;
  const id = idProp || "section-steps";
  return (
    <section className="detail-section" id={id}>
      <h2>Steps</h2>
      <ol>
        {items.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ol>
    </section>
  );
}

export function LinkList({ items, title, id: idProp }) {
  if (!items?.length) return null;
  const id = idProp || `section-${slugify(title)}`;
  return (
    <section className="detail-section" id={id}>
      <h2>{title}</h2>
      <div className="link-stack">
        {items.map((a) => (
          <a key={a.url + a.label} href={a.url} target="_blank" rel="noopener noreferrer">
            {a.label}
          </a>
        ))}
      </div>
    </section>
  );
}

/** Render brief blocks (section / bullets / steps / links) with stable ids. */
export function BriefBlocks({ blocks }) {
  return (
    <>
      {blocks.map((b) => {
        if (b.type === "bullets") {
          return <BulletList key={b.id} id={b.id} items={b.items} title={b.heading} />;
        }
        if (b.type === "steps") {
          return <StepList key={b.id} id={b.id} items={b.items} />;
        }
        if (b.type === "links") {
          return <LinkList key={b.id} id={b.id} items={b.items} title={b.heading} />;
        }
        return (
          <Section key={b.id} id={b.id} heading={b.heading} body={b.body} />
        );
      })}
    </>
  );
}
