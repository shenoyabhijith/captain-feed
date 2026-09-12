import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import { loadTheme, saveTheme } from "../storage";
import { useFeed } from "../hooks/useFeed";
import CategoryFilter from "./CategoryFilter.jsx";
import CardList from "./CardList.jsx";
import CardDetail from "./CardDetail.jsx";

export default function FeedApp() {
  const feed = useFeed();
  const [theme, setTheme] = useState(loadTheme);
  const [installEvt, setInstallEvt] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  }

  return (
    <div className="shell">
      <Routes>
        <Route
          path="/"
          element={
            <Home
              feed={feed}
              theme={theme}
              setTheme={setTheme}
              installEvt={installEvt}
              onInstall={install}
            />
          }
        />
        <Route path="/card/:id" element={<DetailRoute feed={feed} />} />
      </Routes>
    </div>
  );
}

function Home({ feed, theme, setTheme, installEvt, onInstall }) {
  const readCount = feed.cards.filter((c) => feed.prefs.read[c.id]).length;
  const savedCount = feed.cards.filter((c) => feed.prefs.saved[c.id]).length;
  const [compact, setCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [slotH, setSlotH] = useState(0);
  const lastY = useRef(0);
  const ticking = useRef(false);
  const compactRef = useRef(false);
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    if (compactRef.current) return;
    const el = headerRef.current;
    if (!el) return;
    const h = Math.ceil(el.getBoundingClientRect().height);
    if (h > 0) setSlotH((prev) => (prev === h ? prev : h));
  }, [compact, feed.status, feed.meta.subtitle, feed.meta.title, installEvt]);

  useEffect(() => {
    lastY.current = window.scrollY || 0;
    const DEAD = 12;
    const COMPACT_Y = 80;
    const EXPAND_Y = 24;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        const delta = y - lastY.current;
        let next = compactRef.current;

        if (y <= EXPAND_Y) {
          next = false;
        } else if (!compactRef.current && delta > DEAD && y >= COMPACT_Y) {
          next = true;
        } else if (compactRef.current && delta < -DEAD) {
          next = false;
        }

        if (next !== compactRef.current) {
          compactRef.current = next;
          setCompact(next);
          if (next) setMenuOpen(false);
        }
        lastY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div
        className="top-slot"
        style={slotH ? { height: slotH } : undefined}
      >
      <header
        ref={headerRef}
        className={`top ${compact ? "is-compact" : ""}`}
      >
        <div className="brand-row">
          <div>
            <h1>{feed.meta.title}</h1>
            <p className="sub">{feed.meta.subtitle}</p>
          </div>
          <div className="top-actions">
            {installEvt ? (
              <button type="button" className="icon-btn accent" onClick={onInstall}>
                Install
              </button>
            ) : null}
            <button
              type="button"
              className="icon-btn more"
              aria-expanded={menuOpen}
              aria-label="More actions"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ···
            </button>
            <div className={`overflow-actions ${menuOpen ? "open" : ""}`}>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? "Light" : "Dark"}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  if (confirm("Clear read, saved, and seen marks on this device?")) {
                    feed.resetPrefs();
                  }
                  setMenuOpen(false);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
        <CategoryFilter value={feed.filter} onChange={feed.setFilter} />
        <div className="stats">
          {feed.status === "loading"
            ? "Loading feed…"
            : feed.status === "error"
              ? "Could not load feed.json"
              : `${readCount}/${feed.cards.length} read · ${savedCount} saved`}
        </div>
        {!installEvt ? (
          <p className="install-hint">
            Android Chrome: menu → Install app or Add to Home screen
          </p>
        ) : null}
      </header>
      </div>

      {feed.status === "ready" ? (
        <CardList cards={feed.visible} prefs={feed.prefs} onSeen={feed.markSeen} />
      ) : feed.status === "error" ? (
        <div className="empty" role="alert">
          Feed failed to load. Check data/feed.json.
        </div>
      ) : (
        <div className="empty">Loading…</div>
      )}

      <nav className="dock" aria-label="Feed views">
        {[
          ["all", "All"],
          ["unread", "Unread"],
          ["saved", "Saved"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-view={id}
            aria-pressed={feed.view === id}
            onClick={() => feed.setView(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}

function DetailRoute({ feed }) {
  const { id } = useParams();
  const card = feed.cards.find((c) => c.id === decodeURIComponent(id || ""));
  return (
    <CardDetail
      card={card}
      prefs={feed.prefs}
      onToggleRead={feed.toggleRead}
      onToggleSave={feed.toggleSave}
      onSeen={feed.markSeen}
    />
  );
}
