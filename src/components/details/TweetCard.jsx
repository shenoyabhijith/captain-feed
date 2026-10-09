import { useState } from "react";

/**
 * X-app-style post card rendered from data (no screenshots, no embeds).
 * Shape: see docs-internal/builders-post-format.md -> `tweets[]`.
 * Falls back to a simple link card when only `url` (and maybe author) exist.
 */

const X_BLUE = "xcard-link";
/** Past this, clamp like X's timeline and show "Show more". */
const LONG_CHARS = 280;

/** Cut at a word boundary near LONG_CHARS, like X's timeline "Show more". */
function truncateText(text) {
  const t = String(text || "");
  let cut = t.slice(0, LONG_CHARS);
  const sp = cut.search(/\s\S*$/);
  if (sp > LONG_CHARS * 0.6) cut = cut.slice(0, sp);
  return cut.replace(/[\s.,;:]+$/, "") + "…";
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function compactCount(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  if (v < 1000) return String(v);
  if (v < 10000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (v < 1e6) return `${Math.round(v / 1000)}K`;
  return `${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** X-style time: "5m" / "3h" under a day, else "Oct 8" (same year) or "Oct 8, 2025". */
export function xTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { short: "", full: "" };
  const d = new Date(t);
  const full = d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " CT";
  const diff = Math.max(0, now - t) / 1000;
  let short;
  if (diff < 60) short = `${Math.floor(diff)}s`;
  else if (diff < 3600) short = `${Math.floor(diff / 60)}m`;
  else if (diff < 86400) short = `${Math.floor(diff / 3600)}h`;
  else {
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    short = `${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? "" : `, ${d.getFullYear()}`}`;
  }
  return { short, full };
}

/** Tokenize post text: t.co links (via entities.urls), URLs, @mentions, #tags, $cashtags. */
function renderPostText(text, urls = [], mediaUrls = new Set()) {
  const map = new Map((urls || []).map((u) => [u.url, u]));
  const re = /(https?:\/\/[^\s]+)|(^|[^\w])@([A-Za-z0-9_]{1,15})\b|(^|[^\w&])#([\p{L}\p{N}_]+)|(^|[^\w])\$([A-Za-z]{1,6})\b/gu;
  const out = [];
  let last = 0;
  let m;
  let k = 0;
  const src = decodeEntities(text);
  while ((m = re.exec(src))) {
    let start = m.index;
    let lead = "";
    if (m[1]) {
      // link
    } else {
      lead = m[2] ?? m[4] ?? m[6] ?? "";
      start += lead.length;
    }
    if (start > last) out.push(src.slice(last, start));
    if (m[1]) {
      let raw = m[1];
      let trail = "";
      const tm = raw.match(/[.,!?)\]]+$/);
      if (tm && !map.has(raw)) {
        trail = tm[0];
        raw = raw.slice(0, -trail.length);
      }
      if (mediaUrls.has(raw)) {
        // X hides the trailing media t.co link
      } else {
        const ent = map.get(raw);
        const href = ent?.expanded_url || raw;
        const label = ent?.display_url || raw.replace(/^https?:\/\/(www\.)?/, "").replace(/(.{26}).+/, "$1…");
        out.push(
          <a key={k++} className={X_BLUE} href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        );
      }
      if (trail) out.push(trail);
    } else if (m[3]) {
      out.push(
        <a key={k++} className={X_BLUE} href={`https://x.com/${m[3]}`} target="_blank" rel="noopener noreferrer">
          @{m[3]}
        </a>
      );
    } else if (m[5]) {
      out.push(
        <a key={k++} className={X_BLUE} href={`https://x.com/hashtag/${encodeURIComponent(m[5])}`} target="_blank" rel="noopener noreferrer">
          #{m[5]}
        </a>
      );
    } else if (m[7]) {
      out.push(
        <a key={k++} className={X_BLUE} href={`https://x.com/search?q=%24${m[7]}`} target="_blank" rel="noopener noreferrer">
          ${m[7]}
        </a>
      );
    }
    last = re.lastIndex;
  }
  if (last < src.length) out.push(src.slice(last));
  // trim a dangling trailing space left by a hidden media link
  if (typeof out[out.length - 1] === "string") out[out.length - 1] = out[out.length - 1].replace(/\s+$/, "");
  return out;
}

const AVATAR_HUES = ["blue", "violet", "emerald", "pink", "cyan", "gold"];

function hueFor(s) {
  let h = 0;
  for (const c of String(s || "x")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

/** pbs.twimg.com serves _normal (48px); _bigger is 73px and crisp at 40px@2x. */
function crispAvatar(url) {
  return String(url || "").replace(/_normal(\.[a-z]+)$/i, "_bigger$1");
}

function Avatar({ src, name, username }) {
  const [failed, setFailed] = useState(!src);
  const initial = (String(name || username || "?").trim()[0] || "?").toUpperCase();
  if (failed) {
    return (
      <span className="xcard__avatar xcard__avatar--initial" data-hue={hueFor(username || name)} aria-hidden="true">
        {initial}
      </span>
    );
  }
  return (
    <img
      className="xcard__avatar"
      src={crispAvatar(src)}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function VerifiedBadge({ type }) {
  const kind = type === "business" ? "gold" : type === "government" ? "gray" : "blue";
  return (
    <svg className="xcard__verified" data-kind={kind} viewBox="0 0 22 22" aria-label="Verified account" role="img">
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  );
}

function XLogo() {
  return (
    <svg className="xcard__logo" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const ICONS = {
  reply: "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z",
  repost: "M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z",
  like: "M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z",
  views: "M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z",
};

function Metric({ kind, value, label }) {
  const text = compactCount(value);
  return (
    <span className="xcard__metric" data-kind={kind} aria-label={`${value || 0} ${label}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={ICONS[kind]} />
      </svg>
      {text ? <span>{text}</span> : null}
    </span>
  );
}

function Media({ media }) {
  const items = (media || []).filter((m) => m && (m.url || m.preview_image_url)).slice(0, 4);
  if (!items.length) return null;
  return (
    <div className="xcard__media" data-count={items.length}>
      {items.map((m, i) => {
        const src = m.url || m.preview_image_url;
        const single = items.length === 1 && m.width && m.height;
        return (
          <span
            key={i}
            className="xcard__media-cell"
            style={single ? { aspectRatio: String(Math.min(2.4, Math.max(1.2, m.width / m.height))) } : undefined}
          >
            <img src={src} alt={m.alt_text || ""} loading="lazy" referrerPolicy="no-referrer" />
            {m.type === "video" || m.type === "animated_gif" ? (
              <span className="xcard__play" aria-hidden="true">
                {m.type === "animated_gif" ? "GIF" : "▶"}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function handleFromUrl(url) {
  const m = String(url || "").match(/x\.com\/([A-Za-z0-9_]{1,15})\/status/);
  return m ? m[1] : "";
}

/** Minimal card when only a URL (and maybe author) is known. */
export function TweetLinkCard({ tweet }) {
  const username = tweet?.author?.username || handleFromUrl(tweet?.url);
  const name = tweet?.author?.name || (username ? `@${username}` : "Post on X");
  return (
    <article className="xcard xcard--link">
      <a className="xcard__hit" href={tweet.url} target="_blank" rel="noopener noreferrer" aria-label={`Open post by ${name} on X`} />
      <header className="xcard__head">
        <Avatar src={tweet?.author?.avatar} name={name} username={username} />
        <div className="xcard__who">
          <span className="xcard__name">{name}</span>
          <span className="xcard__sub">{username ? `@${username} · ` : ""}View post on X</span>
        </div>
        <XLogo />
      </header>
    </article>
  );
}

export default function TweetCard({ tweet }) {
  if (!tweet?.url) return null;
  if (!tweet.text) return <TweetLinkCard tweet={tweet} />;
  const a = tweet.author || {};
  const username = a.username || handleFromUrl(tweet.url);
  const name = a.name || username;
  const t = xTime(tweet.created_at);
  const pm = tweet.public_metrics || {};
  const mediaLinks = new Set(tweet.media_tco ? [tweet.media_tco] : []);
  const long = String(tweet.text).length > LONG_CHARS;
  const shown = long ? truncateText(tweet.text) : tweet.text;
  const replyTo = (tweet.reply_to || []).filter(Boolean);
  return (
    <article className="xcard">
      <a className="xcard__hit" href={tweet.url} target="_blank" rel="noopener noreferrer" aria-label={`Open post by ${name} on X`} />
      <header className="xcard__head">
        <a className="xcard__avatar-link" href={`https://x.com/${username}`} target="_blank" rel="noopener noreferrer" tabIndex={-1}>
          <Avatar src={a.avatar} name={name} username={username} />
        </a>
        <div className="xcard__who">
          <span className="xcard__name-row">
            <a className="xcard__name" href={`https://x.com/${username}`} target="_blank" rel="noopener noreferrer">
              {name}
            </a>
            {a.verified || (a.verified_type && a.verified_type !== "none") ? <VerifiedBadge type={a.verified_type} /> : null}
          </span>
          <span className="xcard__sub">
            @{username}
            {t.short ? (
              <>
                {" · "}
                <time dateTime={tweet.created_at} title={t.full}>
                  {t.short}
                </time>
              </>
            ) : null}
          </span>
        </div>
        <XLogo />
      </header>
      {replyTo.length ? (
        <p className="xcard__reply">
          Replying to{" "}
          {replyTo.map((h, i) => (
            <span key={h}>
              {i ? " " : ""}
              <a className="xcard-link" href={`https://x.com/${h}`} target="_blank" rel="noopener noreferrer">
                @{h}
              </a>
            </span>
          ))}
        </p>
      ) : null}
      <p className="xcard__text" data-long={long || undefined}>
        {renderPostText(shown, tweet.urls, mediaLinks)}
      </p>
      {long ? (
        <a className="xcard-link xcard__more" href={tweet.url} target="_blank" rel="noopener noreferrer">
          Show more
        </a>
      ) : null}
      <Media media={tweet.media} />
      <footer className="xcard__metrics">
        <Metric kind="reply" value={pm.reply_count} label="replies" />
        <Metric kind="repost" value={(pm.repost_count ?? pm.retweet_count ?? 0) + (pm.quote_count || 0)} label="reposts" />
        <Metric kind="like" value={pm.like_count} label="likes" />
        <Metric kind="views" value={pm.impression_count} label="views" />
      </footer>
    </article>
  );
}

export function TweetStack({ tweets }) {
  const list = (tweets || []).filter((t) => t?.url).slice(0, 3);
  if (!list.length) return null;
  return (
    <div className="xcard-stack">
      {list.map((t) => (
        <TweetCard key={t.id || t.url} tweet={t} />
      ))}
    </div>
  );
}
