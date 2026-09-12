export default function CardChip({ category, accent }) {
  const cls = ["chip", "cat", accent === "teal" || accent === "amber" || accent === "ink" ? accent : ""]
    .filter(Boolean)
    .join(" ");
  return <span className={cls}>{category}</span>;
}
