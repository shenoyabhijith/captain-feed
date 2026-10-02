/**
 * Morning invitation hero — SVG sun + boat (ink/slate).
 * Entrance + float gated by prefers-reduced-motion via --motion.
 */
export default function WelcomeHero({ unreadCount = 0 }) {
  const caughtUp = unreadCount <= 0;
  return (
    <section className="welcome" aria-label="Morning invitation">
      <div className="welcome-art" aria-hidden="true">
        <svg viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="welcome-sky" x1="44" y1="8" x2="44" y2="70" gradientUnits="userSpaceOnUse">
              <stop stopColor="#c5d4e8" />
              <stop offset="1" stopColor="#e8eef6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="welcome-sun" x1="44" y1="22" x2="44" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f1f5f9" />
              <stop offset="1" stopColor="#94a3b8" />
            </linearGradient>
          </defs>
          <circle cx="44" cy="44" r="40" fill="url(#welcome-sky)" opacity="0.9" />
          <circle cx="44" cy="36" r="14" fill="url(#welcome-sun)" opacity="0.95" />
          <circle cx="44" cy="36" r="14" stroke="#64748b" strokeWidth="1.2" opacity="0.35" />
          <g stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round" opacity="0.45">
            <path d="M44 14v6M44 52v5M26 36h-5M67 36h5M30.5 22.5l-3.5-3.5M61 53l3.5 3.5M61 22.5l3.5-3.5M30.5 53l-3.5 3.5" />
          </g>
          <path d="M12 58c8-4 16-4 24 0s16 4 24 0 12-4 16-2v18H12V58z" fill="#cbd5e1" opacity="0.55" />
          <path d="M14 64c7-3 14-3 21 0s14 3 21 0 10-3 14-1" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
          <path d="M34 58l4-10h8l4 10" stroke="#0f172a" strokeWidth="1.6" strokeLinejoin="round" fill="#1e293b" />
          <path d="M32 58h20l-2 4H34l-2-4z" fill="#0f172a" />
          <path d="M42 48V40" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M42 40l7 5H42V40z" fill="#475569" />
        </svg>
      </div>
      <div className="welcome-copy">
        <div className="welcome-kicker">Today</div>
        <div className="welcome-title">
          {caughtUp ? "You're caught up" : "Clear horizon"}
        </div>
        <div className="welcome-sub">
          {caughtUp
            ? "Quiet seas. Check Finances or Metrics when you're ready."
            : `${unreadCount} brief${unreadCount === 1 ? "" : "s"} waiting. Start with For you — or open Topics when you want a tighter lane.`}
        </div>
      </div>
    </section>
  );
}
