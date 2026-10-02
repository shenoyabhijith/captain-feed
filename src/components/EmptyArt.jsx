/** Quiet character for empty saved / For you states. */
export default function EmptyArt() {
  return (
    <div className="empty-art" aria-hidden="true">
      <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="48" cy="48" r="40" fill="#eef2f7" />
        <circle cx="48" cy="40" r="12" fill="#cbd5e1" />
        <path
          d="M22 68c6-10 16-15 26-15s20 5 26 15"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M36 72h24"
          stroke="#64748b"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx="42" cy="38" r="1.5" fill="#0f172a" />
        <circle cx="54" cy="38" r="1.5" fill="#0f172a" />
        <path
          d="M44 44c1.5 2 6.5 2 8 0"
          stroke="#475569"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
