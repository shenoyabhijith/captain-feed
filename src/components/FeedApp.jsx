import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  isStandaloneDisplayMode,
  shouldShowInstallButton,
  shouldShowInstallHint,
  readInstallDismissed,
  writeInstallDismissed,
} from "../installGate.js";
import { Routes, Route, useParams, useLocation } from "react-router-dom";
import { loadTheme, saveTheme } from "../storage";
import { useFeed } from "../hooks/useFeed";
import CategoryFilter from "./CategoryFilter.jsx";
import CardList from "./CardList.jsx";
import CardDetail from "./CardDetail.jsx";
import { VIEW_ICONS, VIEW_LABELS, ICON_STROKE } from "./icons.js";

/** Persist feed window scroll across Home ↔ Detail (HashRouter remounts Home). */
let savedFeedScrollY = 0;

export default function FeedApp() {
  const feed = useFeed();
  const [theme, setTheme] = useState(loadTheme);
  const [installEvt, setInstallEvt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    return isStandaloneDisplayMode() || readInstallDismissed();
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }, [theme]);

  const refreshInstalled = useCallback(async () => {
    let next = isStandaloneDisplayMode() || readInstallDismissed();
    if (!next && typeof navigator !== "undefined" && navigator.getInstalledRelatedApps) {
      try {
        const apps = await navigator.getInstalledRelatedApps();
        if (Array.isArray(apps) && apps.length > 0) next = true;
      } catch {
        /* API may reject; ignore */
      }
    }
    setIsInstalled(next);
    if (next) setInstallEvt(null);
  }, []);

  useEffect(() => {
    refreshInstalled();
    const medias = ["standalone", "fullscreen", "minimal-ui"].map((mode) =>
      window.matchMedia(`(display-mode: ${mode})`),
    );
    const onMode = () => {
      refreshInstalled();
    };
    medias.forEach((m) => m.addEventListener?.("change", onMode));
    const onInstalled = () => {
      setInstallEvt(null);
      setIsInstalled(true);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      medias.forEach((m) => m.removeEventListener?.("change", onMode));
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [refreshInstalled]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      if (isStandaloneDisplayMode() || readInstallDismissed()) return;
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
    refreshInstalled();
  }

  function dismissInstall() {
    writeInstallDismissed();
    setInstallEvt(null);
    setIsInstalled(true);
  }

  const showInstallBtn = shouldShowInstallButton({
    bipAvailable: Boolean(installEvt),
    isInstalled,
  });
  const showInstallHint = shouldShowInstallHint({
    bipAvailable: Boolean(installEvt),
    isInstalled,
  });

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
              showInstallBtn={showInstallBtn}
              showInstallHint={showInstallHint}
              onInstall={install}
              onDismissInstall={dismissInstall}
            />
          }
        />
        <Route path="/card/:id" element={<DetailRoute feed={feed} />} />
      </Routes>
    </div>
  );
}

function Home({ feed, theme, setTheme, showInstallBtn, showInstallHint, onInstall, onDismissInstall }) {
  const readCount = feed.cards.filter((c) => feed.prefs.read[c.id]).length;
  const savedCount = feed.cards.filter((c) => feed.prefs.saved[c.id]).length;
  const [chromeHidden, setChromeHidden] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerH, setHeaderH] = useState(0);
  const lastY = useRef(0);
  const ticking = useRef(false);
  const hiddenRef = useRef(false);
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    // Measure while visible (not translated away)
    const h = Math.ceil(el.offsetHeight);
    if (h > 0) setHeaderH((prev) => (prev === h ? prev : h));
  }, [feed.status, feed.meta.subtitle, feed.meta.title, showInstallBtn, showInstallHint, theme]);

  // Restore feed scroll on Back; save in layout cleanup before Detail scrolls to 0.
  useLayoutEffect(() => {
    const y = savedFeedScrollY || 0;
    window.scrollTo(0, y);
    lastY.current = y;
    const top = y <= 24;
    setAtTop(top);
    hiddenRef.current = false;
    setChromeHidden(false);
    return () => {
      savedFeedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    };
  }, []);

  useEffect(() => {
    lastY.current = window.scrollY || 0;
    const DEAD = 12;
    const HIDE_Y = 80;
    const TOP_Y = 24;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        const delta = y - lastY.current;
        let nextHidden = hiddenRef.current;
        let nextAtTop = y <= TOP_Y;

        if (y <= TOP_Y) {
          nextHidden = false;
        } else if (!hiddenRef.current && delta > DEAD && y >= HIDE_Y) {
          nextHidden = true;
        } else if (hiddenRef.current && delta < -DEAD) {
          // soft reveal on scroll-up
          nextHidden = false;
        }

        if (nextHidden !== hiddenRef.current) {
          hiddenRef.current = nextHidden;
          setChromeHidden(nextHidden);
          if (nextHidden) setMenuOpen(false);
        }
        setAtTop((prev) => (prev === nextAtTop ? prev : nextAtTop));
        lastY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Flow spacer only when chrome is the in-flow top bar (at top + revealed).
  // Mid-feed soft reveal overlays without reserving height.
  const spacerH = !chromeHidden && atTop ? headerH : 0;

  return (
    <>
      <div className="top-spacer" style={{ height: spacerH }} aria-hidden="true" />
      <header
        ref={headerRef}
        className={`top ${chromeHidden ? "is-hidden" : ""} ${!atTop && !chromeHidden ? "is-peek" : ""}`}
      >
        <div className="brand-row">
          <div>
            <h1>{feed.meta.title}</h1>
            <p className="sub">{feed.meta.subtitle}</p>
          </div>
          <div className="top-actions">
            {showInstallBtn ? (
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
              {showInstallBtn || showInstallHint ? (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    onDismissInstall();
                    setMenuOpen(false);
                  }}
                >
                  Hide install tip
                </button>
              ) : null}
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
        {showInstallHint ? (
          <p className="install-hint">
            Android Chrome: menu → Install app or Add to Home screen
          </p>
        ) : null}
      </header>

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
        {["all", "unread", "saved"].map((id) => {
          const Icon = VIEW_ICONS[id];
          const label = VIEW_LABELS[id];
          return (
            <button
              key={id}
              type="button"
              data-view={id}
              aria-label={label}
              title={label}
              aria-pressed={feed.view === id}
              onClick={() => feed.setView(id)}
            >
              <Icon size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

function DetailRoute({ feed }) {
  const { id } = useParams();
  const location = useLocation();
  const card = feed.cards.find((c) => c.id === decodeURIComponent(id || ""));

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, id]);

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
