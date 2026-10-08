import { Fragment } from "react";

/**
 * Tiny inline-markdown renderer (no deps, no innerHTML).
 * Supports `code`, [label](url), **bold**, ==stat==, auto stats (%, $),
 * and bare @handles. Unclosed markers render literally.
 */

const TOKEN_RE =
  /(`[^`\n]+`)|(\[([^\]\n]+)\]\(([^)\s]+)\))|(\*\*([^*\n]+?)\*\*)|(==([^=\n]+?)==)/g;

const STAT_RE = /(~?\$\d[\d,.]*(?:[kKmMbB])?(?:\/mo|\/yr)?|~?\d+(?:\.\d+)?%)/g;
const HANDLE_RE = /(^|[\s(])@([A-Za-z0-9_]{2,15})\b/g;

function Handle({ handle, href, noLinks, k }) {
  const label = handle.startsWith("@") ? handle : `@${handle}`;
  if (noLinks || !href) {
    return (
      <span key={k} className="md-handle">
        {label}
      </span>
    );
  }
  return (
    <a
      key={k}
      className="md-handle"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
}

/** Plain text: auto-highlight stats and bare @handles. */
function renderPlain(text, opts, keyBase) {
  const out = [];
  let i = 0;
  const pieces = [];
  // First split out handles, then stats inside the remaining text.
  let last = 0;
  const handleRe = new RegExp(HANDLE_RE.source, "g");
  let m;
  while ((m = handleRe.exec(text))) {
    const start = m.index + m[1].length;
    if (start > last) pieces.push({ t: "txt", v: text.slice(last, start) });
    pieces.push({ t: "handle", v: m[2] });
    last = start + 1 + m[2].length;
    handleRe.lastIndex = last;
  }
  if (last < text.length) pieces.push({ t: "txt", v: text.slice(last) });

  for (const p of pieces) {
    if (p.t === "handle") {
      out.push(
        <Handle
          key={`${keyBase}-h${i++}`}
          handle={p.v}
          href={`https://x.com/${p.v}`}
          noLinks={opts.noLinks}
        />
      );
      continue;
    }
    if (opts.noStats) {
      out.push(<Fragment key={`${keyBase}-t${i++}`}>{p.v}</Fragment>);
      continue;
    }
    let l = 0;
    const statRe = new RegExp(STAT_RE.source, "g");
    let s;
    while ((s = statRe.exec(p.v))) {
      if (s.index > l) {
        out.push(<Fragment key={`${keyBase}-t${i++}`}>{p.v.slice(l, s.index)}</Fragment>);
      }
      out.push(
        <mark key={`${keyBase}-s${i++}`} className="md-stat">
          {s[0]}
        </mark>
      );
      l = s.index + s[0].length;
    }
    if (l < p.v.length) {
      out.push(<Fragment key={`${keyBase}-t${i++}`}>{p.v.slice(l)}</Fragment>);
    }
  }
  return out;
}

export function renderInline(text, opts = {}, keyBase = "md") {
  const src = String(text ?? "");
  if (!src) return [];
  const out = [];
  let last = 0;
  let n = 0;
  // Fresh regex per call: renderInline recurses for link labels / bold.
  const tokenRe = new RegExp(TOKEN_RE.source, "g");
  let m;
  while ((m = tokenRe.exec(src))) {
    if (m.index > last) {
      out.push(...renderPlain(src.slice(last, m.index), opts, `${keyBase}-p${n++}`));
    }
    const k = `${keyBase}-k${n++}`;
    if (m[1]) {
      out.push(
        <code key={k} className="md-code">
          {m[1].slice(1, -1)}
        </code>
      );
    } else if (m[2]) {
      const label = m[3];
      const url = m[4];
      if (label.startsWith("@")) {
        out.push(<Handle key={k} k={k} handle={label} href={url} noLinks={opts.noLinks} />);
      } else if (opts.noLinks) {
        out.push(
          <span key={k} className="md-link md-link--static">
            {renderInline(label, { ...opts, noStats: true }, k)}
          </span>
        );
      } else {
        out.push(
          <a
            key={k}
            className="md-link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {renderInline(label, { ...opts, noStats: true }, k)}
          </a>
        );
      }
    } else if (m[5]) {
      out.push(
        <strong key={k} className="md-strong">
          {renderInline(m[6], opts, k)}
        </strong>
      );
    } else if (m[7]) {
      out.push(
        <mark key={k} className="md-stat">
          {m[8]}
        </mark>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) {
    out.push(...renderPlain(src.slice(last), opts, `${keyBase}-p${n++}`));
  }
  return out;
}

/** Remove inline markdown syntax for plain-text uses (counts, aria). */
export function stripInline(text) {
  return String(text ?? "")
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
    .replace(/==([^=\n]+?)==/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");
}
