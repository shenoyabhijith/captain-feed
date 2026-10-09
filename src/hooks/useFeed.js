import { useCallback, useEffect, useMemo, useState } from "react";
import { loadPrefs, savePrefs } from "../storage";

function normalizeCards(list) {
  return (Array.isArray(list) ? list : []).map((c) => ({
    ...c,
    category:
      c.category === "trending"
        ? "trend"
        : c.category === "deals"
          ? "deal"
          : c.category,
  }));
}

function cardMatchesQuery(card, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [
    card.title,
    card.body,
    card.source,
    card.category,
    ...(Array.isArray(card.tags) ? card.tags : []),
    card.detail?.summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function useFeed() {
  const [meta, setMeta] = useState({ title: "Captain Feed", subtitle: "" });
  const [cards, setCards] = useState([]);
  const [status, setStatus] = useState("loading");
  const [prefs, setPrefs] = useState(loadPrefs);
  /** @deprecated single-category; prefer `topics` multi-select */
  const [filter, setFilter] = useState("all");
  /** Multi-select category topics (empty = all). */
  const [topics, setTopics] = useState([]);
  // SLIM-HEADER: default to Unread (dock), which is what the swipe deck shows.
  const [view, setView] = useState("unread");
  const [query, setQuery] = useState("");

  const loadFeed = useCallback(async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/feed.json`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("feed missing");
    const data = await res.json();
    setCards(normalizeCards(data.cards));
    setMeta({
      title: data.title || "Captain Feed",
      subtitle: data.subtitle || "Daily doses",
    });
    setStatus("ready");
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadFeed();
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFeed]);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const refreshFeed = useCallback(async () => {
    try {
      await loadFeed();
      return { ok: true };
    } catch (e) {
      console.error(e);
      setStatus("error");
      return { ok: false, error: e };
    }
  }, [loadFeed]);

  const visible = useMemo(() => {
    const topicSet = new Set(topics);
    return cards.filter((c) => {
      if (topicSet.size > 0 && !topicSet.has(c.category)) return false;
      else if (topicSet.size === 0 && filter !== "all" && c.category !== filter) {
        return false;
      }
      // "foryou" is the chrome label for unread
      if ((view === "unread" || view === "foryou") && prefs.read[c.id]) return false;
      if (view === "saved" && !prefs.saved[c.id]) return false;
      if (!cardMatchesQuery(c, query)) return false;
      return true;
    });
  }, [cards, filter, topics, view, prefs, query]);

  function markSeen(id) {
    setPrefs((p) =>
      p.seen[id] ? p : { ...p, seen: { ...p.seen, [id]: Date.now() } }
    );
  }
  function toggleRead(id) {
    setPrefs((p) => {
      const read = { ...p.read };
      if (read[id]) delete read[id];
      else read[id] = Date.now();
      return { ...p, read, seen: { ...p.seen, [id]: p.seen[id] || Date.now() } };
    });
  }
  function toggleSave(id) {
    setPrefs((p) => {
      const saved = { ...p.saved };
      if (saved[id]) delete saved[id];
      else saved[id] = Date.now();
      return { ...p, saved, seen: { ...p.seen, [id]: p.seen[id] || Date.now() } };
    });
  }
  /** Explicit setters (swipe deck + undo need set, not toggle). */
  function setRead(id, on) {
    setPrefs((p) => {
      if (Boolean(p.read[id]) === Boolean(on)) return p;
      const read = { ...p.read };
      if (on) read[id] = Date.now();
      else delete read[id];
      return { ...p, read, seen: { ...p.seen, [id]: p.seen[id] || Date.now() } };
    });
  }
  function setSaved(id, on) {
    setPrefs((p) => {
      if (Boolean(p.saved[id]) === Boolean(on)) return p;
      const saved = { ...p.saved };
      if (on) saved[id] = Date.now();
      else delete saved[id];
      return { ...p, saved, seen: { ...p.seen, [id]: p.seen[id] || Date.now() } };
    });
  }
  function resetPrefs() {
    const cleared = { seen: {}, saved: {}, read: {} };
    setPrefs(cleared);
    savePrefs(cleared);
  }

  return {
    meta,
    cards,
    visible,
    status,
    prefs,
    filter,
    setFilter,
    topics,
    setTopics,
    view,
    setView,
    query,
    setQuery,
    markSeen,
    toggleRead,
    toggleSave,
    setRead,
    setSaved,
    resetPrefs,
    refreshFeed,
  };
}
