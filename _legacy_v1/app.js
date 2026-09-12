const STORAGE = "captain-feed-v1";
const THEME_KEY = "captain-feed-theme";

const state = {
  cards: [],
  filter: "all",
  view: "all", // all | unread | saved
  seen: {},
  saved: {},
  read: {},
};

function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) || "{}");
    state.seen = raw.seen && typeof raw.seen === "object" ? raw.seen : {};
    state.saved = raw.saved && typeof raw.saved === "object" ? raw.saved : {};
    state.read = raw.read && typeof raw.read === "object" ? raw.read : {};
  } catch {
    state.seen = {};
    state.saved = {};
    state.read = {};
  }
}

function savePrefs() {
  localStorage.setItem(
    STORAGE,
    JSON.stringify({ seen: state.seen, saved: state.saved, read: state.read })
  );
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = theme === "dark" ? "Light" : "Dark";
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") {
    applyTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function catClass(accent) {
  if (accent === "teal" || accent === "amber" || accent === "ink") return accent;
  return "";
}

function visibleCards() {
  return state.cards.filter((c) => {
    if (state.filter !== "all" && c.category !== state.filter) return false;
    if (state.view === "unread" && state.read[c.id]) return false;
    if (state.view === "saved" && !state.saved[c.id]) return false;
    return true;
  });
}

function renderStats() {
  const total = state.cards.length;
  const read = state.cards.filter((c) => state.read[c.id]).length;
  const saved = state.cards.filter((c) => state.saved[c.id]).length;
  document.getElementById("stats").textContent =
    `${read}/${total} read · ${saved} saved · filter ${state.filter}`;
}

function renderFeed() {
  const root = document.getElementById("feed");
  const list = visibleCards();
  if (!list.length) {
    root.innerHTML = `<div class="empty" role="status">Nothing here yet. Try another filter or clear read marks.</div>`;
    renderStats();
    return;
  }
  root.innerHTML = list
    .map((c) => {
      const saved = Boolean(state.saved[c.id]);
      const read = Boolean(state.read[c.id]);
      const link = c.link
        ? `<a class="linkish" href="${escapeAttr(c.link)}" target="_blank" rel="noopener">Open related</a>`
        : "";
      const img = c.image
        ? `<img class="media" loading="lazy" alt="" src="${escapeAttr(c.image)}" />`
        : "";
      return `<article class="card ${read ? "is-read" : ""} ${saved ? "is-saved" : ""}" data-id="${escapeAttr(c.id)}">
        ${img}
        <div class="body">
          <div class="meta-row">
            <span class="cat ${catClass(c.accent)}">${escapeHtml(c.category)}</span>
            <span class="source">${escapeHtml(c.source || "")}</span>
          </div>
          <h2>${escapeHtml(c.title)}</h2>
          <p class="copy">${escapeHtml(c.body)}</p>
          ${link}
          <div class="actions">
            <button type="button" class="btn ${read ? "on" : "primary"}" data-act="read">${read ? "Read" : "Mark read"}</button>
            <button type="button" class="btn ${saved ? "on" : ""}" data-act="save">${saved ? "Saved" : "Save"}</button>
            <button type="button" class="btn" data-act="seen">Seen</button>
          </div>
        </div>
      </article>`;
    })
    .join("");
  renderStats();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll("'", "&#39;");
}

function markSeen(id) {
  if (!state.seen[id]) {
    state.seen[id] = Date.now();
    savePrefs();
  }
}

function setupObserver() {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.55) {
          markSeen(e.target.getAttribute("data-id"));
        }
      });
    },
    { threshold: [0.55] }
  );
  document.querySelectorAll(".card").forEach((el) => io.observe(el));
}

function bindFeedClicks() {
  document.getElementById("feed").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    const card = btn.closest(".card");
    if (!card) return;
    const id = card.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    if (act === "read") {
      if (state.read[id]) delete state.read[id];
      else state.read[id] = Date.now();
      markSeen(id);
    } else if (act === "save") {
      if (state.saved[id]) delete state.saved[id];
      else state.saved[id] = Date.now();
      markSeen(id);
    } else if (act === "seen") {
      markSeen(id);
    }
    savePrefs();
    renderFeed();
    setupObserver();
  });
}

function bindChrome() {
  document.getElementById("themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(cur === "dark" ? "light" : "dark");
  });

  document.getElementById("filters").addEventListener("click", (ev) => {
    const chip = ev.target.closest(".chip");
    if (!chip) return;
    state.filter = chip.dataset.filter;
    [...document.querySelectorAll("#filters .chip")].forEach((c) =>
      c.setAttribute("aria-pressed", String(c === chip))
    );
    renderFeed();
    setupObserver();
  });

  document.getElementById("dock").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-view]");
    if (!btn) return;
    state.view = btn.dataset.view;
    [...document.querySelectorAll("#dock button")].forEach((b) =>
      b.setAttribute("aria-pressed", String(b === btn))
    );
    renderFeed();
    setupObserver();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("Clear read, saved, and seen marks on this device?")) return;
    state.seen = {};
    state.saved = {};
    state.read = {};
    savePrefs();
    renderFeed();
    setupObserver();
  });
}

async function boot() {
  initTheme();
  loadPrefs();
  bindChrome();
  bindFeedClicks();
  const res = await fetch("./data/feed.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load feed.json");
  const data = await res.json();
  state.cards = Array.isArray(data.cards) ? data.cards : [];
  document.getElementById("title").textContent = data.title || "Captain Feed";
  document.getElementById("subtitle").textContent =
    data.subtitle || "Daily doses";
  renderFeed();
  setupObserver();
}

boot().catch((err) => {
  document.getElementById("feed").innerHTML =
    `<div class="empty" role="alert">Feed failed to load. Check data/feed.json.</div>`;
  console.error(err);
});
