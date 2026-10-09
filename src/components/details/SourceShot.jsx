import { useState } from "react";
import { Globe, ArrowUpRight } from "lucide-react";

/**
 * Screenshot card for a non-X source (article, blog, repo, filing, chart).
 * Data: section.screenshots[] = { url, image, title, capturedAt }, made by
 * scripts/capture-source.mjs. `image` is relative to the app base (media/sources/…).
 * X posts never come here; they render as TweetCards.
 */
function resolveImage(src) {
  const s = String(src || "");
  if (/^(https?:)?\/\//.test(s) || s.startsWith("data:")) return s;
  return `${import.meta.env.BASE_URL}${s.replace(/^\//, "")}`;
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function Favicon({ domain }) {
  const [failed, setFailed] = useState(!domain);
  if (failed) return <Globe size={14} strokeWidth={2.2} aria-hidden="true" />;
  return (
    <img
      className="srcshot__favicon"
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      width={16}
      height={16}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function SourceShot({ shot }) {
  const domain = domainOf(shot.url);
  return (
    <a className="srcshot" href={shot.url} target="_blank" rel="noopener noreferrer" aria-label={`${shot.title || domain} (opens ${domain})`}>
      <div className="srcshot__frame">
        <img className="srcshot__img" src={resolveImage(shot.image)} alt="" loading="lazy" decoding="async" width={1200} height={800} />
      </div>
      <div className="srcshot__row">
        <span className="srcshot__fav"><Favicon domain={domain} /></span>
        <span className="srcshot__text">
          <span className="srcshot__domain">{domain}</span>
          <span className="srcshot__title">{shot.title || domain}</span>
        </span>
        <ArrowUpRight className="srcshot__go" size={16} strokeWidth={2.2} aria-hidden="true" />
      </div>
    </a>
  );
}

export function SourceShotStack({ shots }) {
  const list = (shots || []).filter((s) => s?.url && s?.image).slice(0, 3);
  if (!list.length) return null;
  return (
    <div className="srcshot-stack">
      {list.map((s) => <SourceShot key={s.url} shot={s} />)}
    </div>
  );
}
