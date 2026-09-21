import { useEffect, useState } from "react";

function markUrl() {
  const theme = document.documentElement.getAttribute("data-theme");
  const name = theme === "dark" ? "mark-28-dark.png" : "mark-28-light.png";
  return `${import.meta.env.BASE_URL}icons/${name}`;
}

function isWeakImage(src) {
  if (!src || typeof src !== "string") return true;
  const s = src.trim();
  if (!s) return true;
  if (s === "about:blank" || s === "#") return true;
  return false;
}

/**
 * Aspect-locked media with skeleton, fade-in, and branded fallback.
 * Parent sets aspect-ratio via .card--* variant classes.
 */
export default function CardImage({ src, alt = "", className = "" }) {
  const weak = isWeakImage(src);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(weak);
  const [fallbackMark, setFallbackMark] = useState(markUrl);

  useEffect(() => {
    const sync = () => setFallbackMark(markUrl());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  const showFallback = failed || weak;
  const ready = showFallback || loaded;

  return (
    <div
      className={[
        "card-media",
        className,
        ready ? "is-ready" : "",
        showFallback ? "is-fallback" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={alt ? undefined : true}
    >
      {!showFallback ? <div className="card-media__skeleton" /> : null}
      {!weak ? (
        <img
          className={`card-media__img ${loaded && !failed ? "is-loaded" : ""}`}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
      {showFallback ? (
        <div className="card-media__fallback">
          <img
            className="card-media__fallback-mark"
            src={fallbackMark}
            width={36}
            height={36}
            alt=""
          />
        </div>
      ) : null}
    </div>
  );
}

export { isWeakImage };
