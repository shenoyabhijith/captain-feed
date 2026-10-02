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
  const sentences = raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [raw];
  const paras = [];
  let buf = "";
  for (const s of sentences) {
    const next = (buf + " " + s.trim()).trim();
    if (buf && next.length > 180) {
      paras.push(buf);
      buf = s.trim();
    } else {
      buf = next;
    }
  }
  if (buf) paras.push(buf);
  return paras.length ? paras : [raw];
}

export default function DetailShell({
  eyebrow,
  title,
  summary,
  children,
  tags,
  sections,
}) {
  const label =
    eyebrow && CATEGORY_LABELS[eyebrow]
      ? CATEGORY_LABELS[eyebrow]
      : eyebrow
        ? String(eyebrow).replace(/^./, (c) => c.toUpperCase())
        : null;

  const paras = splitSummary(summary);
  const jumpSections = (sections || []).filter((s) => s?.heading);

  return (
    <div className="detail-shell">
      {label ? <p className="detail-eyebrow">{label}</p> : null}
      <h1>{title}</h1>
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
      {jumpSections.length >= 2 ? (
        <nav className="detail-jump" aria-label="On this brief">
          <p className="detail-jump__label">On this brief</p>
          <ul className="detail-jump__list">
            {jumpSections.map((s) => {
              const id = `section-${slugify(s.heading)}`;
              return (
                <li key={id}>
                  <a href={`#${id}`}>{s.heading}</a>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
      {children}
    </div>
  );
}

export function Section({ heading, body }) {
  const id = heading ? `section-${slugify(heading)}` : undefined;
  return (
    <section className="detail-section" id={id}>
      {heading ? <h2>{heading}</h2> : null}
      <p>{body}</p>
    </section>
  );
}

export function BulletList({ items, title = "Key points" }) {
  if (!items?.length) return null;
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      <ul>
        {items.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </section>
  );
}

export function StepList({ items }) {
  if (!items?.length) return null;
  return (
    <section className="detail-section">
      <h2>Steps</h2>
      <ol>
        {items.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ol>
    </section>
  );
}

export function LinkList({ items, title }) {
  if (!items?.length) return null;
  return (
    <section className="detail-section">
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
