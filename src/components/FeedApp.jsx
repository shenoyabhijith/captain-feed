import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  isStandaloneDisplayMode,
  isInstallChromeSuppressed,
  shouldShowInstallHint,
  writeInstallDismissed,
  markPwaInstalled,
  syncStandaloneDomFlag,
  subscribeDisplayMode,
} from "../installGate.js";
import { Routes, Route, useParams, useLocation } from "react-router-dom";
import { loadTheme, saveTheme } from "../storage";
import { useFeed } from "../hooks/useFeed";
import {
  checkAndApplyAppUpdate,
  consumeUpdatedFlag,
  hasServiceWorkerRegistration,
  isUpdateInFlight,
} from "../lib/updateApp.js";
import CardList from "./CardList.jsx";
import CardDetail from "./CardDetail.jsx";
import WelcomeHero from "./WelcomeHero.jsx";
import DallasWeather from "./DallasWeather.jsx";
import TopicsSheet from "./TopicsSheet.jsx";
import FinancesApp from "./finances/FinancesApp.jsx";
import FinancesAdmin from "./finances/FinancesAdmin.jsx";
import MetricsApp from "./finances/MetricsApp.jsx";
import FeedDock from "./finances/FeedDock.jsx";

/** Persist feed window scroll across Home ↔ Detail (HashRouter remounts Home). */
let savedFeedScrollY = 0;

const MANUAL_INSTALL_HINT =
  "Chrome menu → Install app / Add to Home screen";

export default function FeedApp() {
  const feed = useFeed();
  const [theme, setTheme] = useState(loadTheme);
  const [installEvt, setInstallEvt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => isInstallChromeSuppressed());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }, [theme]);

  const refreshInstalled = useCallback(async () => {
    let next = isInstallChromeSuppressed();
    if (!next && typeof navigator !== "undefined" && navigator.getInstalledRelatedApps) {
      try {
        const apps = await navigator.getInstalledRelatedApps();
        if (Array.isArray(apps) && apps.length > 0) {
          next = true;
          markPwaInstalled();
        }
      } catch {
        /* API may reject; ignore */
      }
    }
    if (!next) {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      next = isInstallChromeSuppressed();
    }
    if (next && isStandaloneDisplayMode()) markPwaInstalled();
    setIsInstalled(next);
    syncStandaloneDomFlag(document.documentElement, next);
    if (next) setInstallEvt(null);
  }, []);

  useEffect(() => {
    refreshInstalled();
    const unsub = subscribeDisplayMode(() => {
      refreshInstalled();
    });
    const onInstalled = () => {
      markPwaInstalled();
      setInstallEvt(null);
      setIsInstalled(true);
      syncStandaloneDomFlag(document.documentElement, true);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      unsub();
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [refreshInstalled]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      if (isInstallChromeSuppressed()) return;
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!installEvt) return false;
    installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
    refreshInstalled();
    return true;
  }

  function dismissInstall() {
    writeInstallDismissed();
    setInstallEvt(null);
    setIsInstalled(true);
  }

  // Soft hint when BIP missing; Install chrome only in overflow (never primary row)
  const showInstallChrome = !isInstalled;
  const showInstallHint = shouldShowInstallHint({
    bipAvailable: Boolean(installEvt),
    isInstalled,
  });

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="shell">
            <Home
              feed={feed}
              theme={theme}
              setTheme={setTheme}
              showInstallChrome={showInstallChrome}
              showInstallHint={showInstallHint}
              hasBip={Boolean(installEvt)}
              onInstall={install}
              onDismissInstall={dismissInstall}
            />
          </div>
        }
      />
      <Route
        path="/card/:id"
        element={
          <div className="shell">
            <DetailRoute feed={feed} />
          </div>
        }
      />
      <Route path="/finances" element={<FinancesApp />} />
      <Route path="/finances/admin" element={<FinancesAdmin />} />
      <Route path="/metrics" element={<MetricsApp />} />
    </Routes>
  );
}

function Home({
  feed,
  theme,
  setTheme,
  showInstallChrome,
  showInstallHint,
  hasBip,
  onInstall,
  onDismissInstall,
}) {
  const readCount = feed.cards.filter((c) => feed.prefs.read[c.id]).length;
  const savedCount = feed.cards.filter((c) => feed.prefs.saved[c.id]).length;
  const unreadCount = feed.cards.filter((c) => !feed.prefs.read[c.id]).length;
  const [chromeHidden, setChromeHidden] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [staggerOn, setStaggerOn] = useState(true);
  const [headerH, setHeaderH] = useState(0);
  const [swAvailable, setSwAvailable] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const segmentView =
    feed.view === "unread" || feed.view === "foryou"
      ? "foryou"
      : feed.view === "saved"
        ? "saved"
        : "all";

  function setSegmentView(id) {
    // For you ≡ unread in live prefs
    feed.setView(id === "foryou" ? "unread" : id);
  }

  function showToast(msg) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Apply dock view requested from Finances navigation
  useEffect(() => {
    try {
      const v = sessionStorage.getItem("captain-feed-dock-view");
      if (v && ["all", "unread", "saved"].includes(v)) {
        feed.setView(v);
        sessionStorage.removeItem("captain-feed-dock-view");
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply once on Home mount
  }, []);

  useEffect(() => {
    let cancelled = false;
    hasServiceWorkerRegistration().then((ok) => {
      if (!cancelled) setSwAvailable(ok);
    });
    if (consumeUpdatedFlag()) {
      setUpdateStatus("Updated");
      setMenuOpen(true);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  async function onUpdateApp() {
    if (updateBusy || isUpdateInFlight()) return;
    setUpdateBusy(true);
    try {
      await checkAndApplyAppUpdate((msg) => setUpdateStatus(msg));
    } finally {
      setUpdateBusy(false);
    }
  }

  async function onOverflowInstall() {
    if (hasBip) {
      const ok = await onInstall();
      if (ok) showToast("Install prompted");
      setMenuOpen(false);
      return;
    }
    showToast(MANUAL_INSTALL_HINT);
    setMenuOpen(false);
  }

  async function onRefreshFeed() {
    setMenuOpen(false);
    const result = await feed.refreshFeed();
    if (result.ok) showToast("Feed refreshed.");
    else showToast("Could not refresh feed.");
  }

  function onResetPrefs() {
    if (confirm("Clear read, saved, and seen marks on this device?")) {
      feed.resetPrefs();
      feed.setTopics([]);
      feed.setView("all");
      feed.setQuery("");
      setStaggerOn(true);
      showToast("Cleared read and saved marks.");
    }
    setMenuOpen(false);
  }

  function onApplyTopics(next) {
    feed.setTopics(next);
    feed.setFilter("all");
    setTopicsOpen(false);
    showToast(next.length ? "Topics applied" : "Showing all topics");
  }

  useEffect(() => {
    if (!staggerOn) return undefined;
    const t = window.setTimeout(() => setStaggerOn(false), 1200);
    return () => window.clearTimeout(t);
  }, [staggerOn]);

  const lastY = useRef(0);
  const ticking = useRef(false);
  const hiddenRef = useRef(false);
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const h = Math.ceil(el.offsetHeight);
    if (h > 0) setHeaderH((prev) => (prev === h ? prev : h));
  }, [
    feed.status,
    feed.meta.subtitle,
    feed.meta.title,
    showInstallChrome,
    showInstallHint,
    theme,
    feed.query,
  ]);

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

  useEffect(() => {
    const dock = document.querySelector("nav.dock");
    if (!dock) return undefined;

    const clearDockBand = () => {
      const bandTop = dock.getBoundingClientRect().top - 12;
      for (const el of document.body.querySelectorAll("*")) {
        if (el === dock || dock.contains(el)) continue;
        const st = window.getComputedStyle(el);
        if (st.position !== "fixed") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const inBand = r.bottom > bandTop && r.top < window.innerHeight;
        const looksLikeCue = r.width <= 72 && r.height <= 72;
        if (inBand && looksLikeCue) {
          el.style.setProperty("display", "none", "important");
          el.setAttribute("data-dock-band-cleared", "1");
        }
      }
    };

    clearDockBand();
    const onScroll = () => clearDockBand();
    window.addEventListener("scroll", onScroll, { passive: true });
    const id = window.setInterval(clearDockBand, 1500);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearInterval(id);
    };
  }, []);

  const spacerH = !chromeHidden && atTop ? headerH : 0;
  const shortSub =
    feed.meta.subtitle && String(feed.meta.subtitle).length > 48
      ? `${String(feed.meta.subtitle).slice(0, 45).trim()}…`
      : feed.meta.subtitle;

  return (
    <>
      <div className="top-spacer" style={{ height: spacerH }} aria-hidden="true" />
      <header
        ref={headerRef}
        className={`top ${chromeHidden ? "is-hidden" : ""} ${!atTop && !chromeHidden ? "is-peek" : ""}`}
      >
        <div className="brand-row">
          <div className="brand-lockup">
            <img
              className="brand-mark"
              src={`${import.meta.env.BASE_URL}icons/${theme === "dark" ? "mark-28-dark.png" : "mark-28-light.png"}`}
              width={28}
              height={28}
              alt=""
            />
            <div className="brand-text">
              <h1>{feed.meta.title}</h1>
              {shortSub ? <p className="sub">{shortSub}</p> : null}
            </div>
          </div>
          <div className="top-actions">
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
              <button type="button" className="icon-btn" onClick={onRefreshFeed}>
                Refresh
              </button>
              <button type="button" className="icon-btn" onClick={onResetPrefs}>
                Reset
              </button>
              {showInstallChrome ? (
                <button
                  type="button"
                  className="icon-btn install-btn"
                  onClick={onOverflowInstall}
                >
                  Install
                </button>
              ) : null}
              {showInstallChrome ? (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    onDismissInstall();
                    setMenuOpen(false);
                    showToast("Install tip hidden.");
                  }}
                >
                  Hide install tip
                </button>
              ) : null}
              <div className="overflow-update" data-slot="field">
                <p className="overflow-update__label">App updates</p>
                <p className="overflow-update__hint" data-slot="field-description">
                  {swAvailable
                    ? "Check for a new version and reload this installed app."
                    : "Updates apply when the app is installed"}
                </p>
                <button
                  type="button"
                  className="overflow-update__btn"
                  data-slot="button"
                  data-variant="outline"
                  disabled={!swAvailable || updateBusy}
                  onClick={onUpdateApp}
                >
                  Update app
                </button>
                <p className="overflow-update__status" role="status" aria-live="polite">
                  {updateStatus}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="segment" role="tablist" aria-label="Feed view">
          {[
            { id: "all", label: "All" },
            { id: "foryou", label: "For you" },
            { id: "saved", label: "Saved" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-pressed={segmentView === tab.id}
              onClick={() => setSegmentView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="chrome-row">
          <div className="search">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <label className="sr-only" htmlFor="feed-search">
              Search briefs
            </label>
            <input
              id="feed-search"
              type="search"
              placeholder="Search feed"
              value={feed.query}
              onChange={(e) => feed.setQuery(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
          <button
            type="button"
            className="topics-btn"
            data-active={feed.topics.length > 0 ? "true" : "false"}
            aria-haspopup="dialog"
            aria-expanded={topicsOpen}
            onClick={() => setTopicsOpen(true)}
          >
            Topics
            {feed.topics.length > 0 ? (
              <span className="topics-count">{feed.topics.length}</span>
            ) : null}
          </button>
        </div>
        <div className="stats feed-meta">
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
        <>
          <WelcomeHero unreadCount={unreadCount} />
          <DallasWeather />
          <CardList
            cards={feed.visible}
            prefs={feed.prefs}
            onSeen={feed.markSeen}
            onToggleSave={feed.toggleSave}
            view={feed.view}
            filter={feed.filter}
            topics={feed.topics}
            query={feed.query}
            stagger={staggerOn}
          />
        </>
      ) : feed.status === "error" ? (
        <div className="empty" role="alert">
          Feed failed to load. Check data/feed.json.
        </div>
      ) : (
        <div className="empty">Loading…</div>
      )}

      <TopicsSheet
        open={topicsOpen}
        selected={feed.topics}
        onClose={() => setTopicsOpen(false)}
        onApply={onApplyTopics}
      />

      {toast ? (
        <div className="app-toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      <FeedDock feedView={feed.view} onFeedView={feed.setView} />
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
