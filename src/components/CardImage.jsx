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
 * Pass eager for above-the-fold cards (first ~1–2).
 */
export default function CardImage({
  src,
  alt = "",
  className = "",
  eager = false,
  onFail,
}) {
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

  // Reset load state when src changes
  useEffect(() => {
    setLoaded(false);
    setFailed(isWeakImage(src));
  }, [src]);

  const showFallback = failed || weak;
  const ready = showFallback || loaded;
  const imgAlt = alt?.trim() ? alt : "Card image";

  return (
    <div
      className={[
        "card-media",
        className,
        ready ? "is-ready" : "is-loading",
        showFallback ? "is-fallback" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Skeleton stays until image ready or fallback — never a blank void */}
      {!ready ? <div className="card-media__skeleton" aria-hidden="true" /> : null}
      {!weak ? (
        <img
          className={`card-media__img ${loaded && !failed ? "is-loaded" : ""}`}
          src={src}
          alt={imgAlt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            onFail?.();
          }}
        />
      ) : null}
      {showFallback ? (
        <div className="card-media__fallback" aria-hidden="true">
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
