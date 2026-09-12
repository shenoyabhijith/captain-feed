import { useEffect, useMemo, useState } from "react";
import { loadPrefs, savePrefs } from "../storage";

export function useFeed() {
  const [meta, setMeta] = useState({ title: "Captain Feed", subtitle: "" });
  const [cards, setCards] = useState([]);
  const [status, setStatus] = useState("loading");
  const [prefs, setPrefs] = useState(loadPrefs);
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/feed.json`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("feed missing");
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data.cards) ? data.cards : [];
        setCards(
          list.map((c) => ({
            ...c,
            category: c.category === "trending" ? "trend" : c.category === "deals" ? "deal" : c.category,
          }))
        );
        setMeta({
          title: data.title || "Captain Feed",
          subtitle: data.subtitle || "Daily doses",
        });
        setStatus("ready");
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const visible = useMemo(() => {
    return cards.filter((c) => {
      if (filter !== "all" && c.category !== filter) return false;
      if (view === "unread" && prefs.read[c.id]) return false;
      if (view === "saved" && !prefs.saved[c.id]) return false;
      return true;
    });
  }, [cards, filter, view, prefs]);

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
  function resetPrefs() {
    setPrefs({ seen: {}, saved: {}, read: {} });
  }

  return {
    meta,
    cards,
    visible,
    status,
    prefs,
    filter,
    setFilter,
    view,
    setView,
    markSeen,
    toggleRead,
    toggleSave,
    resetPrefs,
  };
}
