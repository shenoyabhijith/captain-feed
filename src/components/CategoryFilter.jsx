const FILTERS = [
  ["all", "All"],
  ["book", "Book"],
  ["tax", "Tax"],
  ["trend", "Trend"],
  ["aws", "AWS"],
  ["deal", "Deal"],
  ["gym", "Gym"],
];

export default function CategoryFilter({ value, onChange }) {
  return (
    <div className="filters" role="toolbar" aria-label="Categories">
      {FILTERS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className="chip"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
