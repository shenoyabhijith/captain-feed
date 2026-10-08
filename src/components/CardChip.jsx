import { CATEGORY_ICONS, CATEGORY_LABELS, ICON_STROKE } from "./icons.js";
import { categoryHue } from "./details/DetailShell.jsx";

/** Category badge: filled tint in the category hue (never orange). */
export default function CardChip({ category }) {
  const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.all;
  const label = CATEGORY_LABELS[category] || category;
  return (
    <span className="chip cat cat-icon" data-hue={categoryHue(category)} title={label}>
      <Icon size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
      <span className="cat-label">{label}</span>
    </span>
  );
}
