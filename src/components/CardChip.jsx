import { CATEGORY_ICONS, CATEGORY_LABELS, ICON_STROKE } from "./icons.js";

export default function CardChip({ category, accent }) {
  const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.all;
  const label = CATEGORY_LABELS[category] || category;
  const cls = [
    "chip",
    "cat",
    "cat-icon",
    accent === "teal" || accent === "amber" || accent === "ink" ? accent : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} title={label}>
      <Icon size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
      <span className="cat-label">{label}</span>
    </span>
  );
}
