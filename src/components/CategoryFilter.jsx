import { CATEGORY_ICONS, CATEGORY_LABELS, ICON_STROKE } from "./icons.js";

const ORDER = ["all", "book", "tax", "trend", "aws", "deal", "gym"];

export default function CategoryFilter({ value, onChange }) {
  return (
    <div className="filters" role="toolbar" aria-label="Categories">
      {ORDER.map((id) => {
        const Icon = CATEGORY_ICONS[id];
        const label = CATEGORY_LABELS[id];
        const pressed = value === id;
        return (
          <button
            key={id}
            type="button"
            className="rail-chip"
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            onClick={() => onChange(id)}
          >
            <Icon size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span className="rail-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
