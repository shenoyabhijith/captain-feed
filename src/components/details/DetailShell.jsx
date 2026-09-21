import { CATEGORY_LABELS } from "../icons.js";

export default function DetailShell({
  eyebrow,
  title,
  summary,
  children,
  tags,
}) {
  const label =
    eyebrow && CATEGORY_LABELS[eyebrow]
      ? CATEGORY_LABELS[eyebrow]
      : eyebrow
        ? String(eyebrow).replace(/^./, (c) => c.toUpperCase())
        : null;

  return (
    <div className="detail-shell">
      {label ? <p className="detail-eyebrow">{label}</p> : null}
      <h1>{title}</h1>
      {summary ? <p className="detail-summary">{summary}</p> : null}
      {tags?.length ? (
        <div className="tag-row">
          {tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Section({ heading, body }) {
  return (
    <section className="detail-section">
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
