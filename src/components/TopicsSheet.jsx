import { useEffect, useState } from "react";
import { CATEGORY_LABELS } from "./icons.js";

/** Topic chips shown in the overflow sheet (not a top pill parade). */
export const TOPIC_OPTIONS = [
  { id: "ai", name: "AI", hint: "Builders & agents" },
  { id: "trend", name: "Markets", hint: "ETFs, oil, flows" },
  { id: "tax", name: "Macros", hint: "Tax, rates, policy" },
  { id: "deal", name: "Deals", hint: "Gear & value picks" },
  { id: "gym", name: "Fit", hint: "Training & recovery" },
  { id: "book", name: CATEGORY_LABELS.book, hint: "Reading & notes" },
  { id: "aws", name: CATEGORY_LABELS.aws, hint: "Cloud tips" },
];

/**
 * Bottom sheet for multi-select category filters.
 * Draft state until Apply; Clear empties draft.
 */
export default function TopicsSheet({
  open,
  selected = [],
  onClose,
  onApply,
}) {
  const [draft, setDraft] = useState(() => new Set(selected));

  useEffect(() => {
    if (open) setDraft(new Set(selected));
  }, [open, selected]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function toggle(id) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!open) return null;

  return (
    <div className="sheet-root" data-open="true">
      <button
        type="button"
        className="sheet-backdrop"
        aria-label="Dismiss topics"
        onClick={onClose}
      />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="topics-title"
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <div>
            <div className="sheet-title" id="topics-title">
              Topics
            </div>
            <div className="sheet-sub">Optional filters · pick a tighter lane</div>
          </div>
          <button
            type="button"
            className="sheet-close"
            aria-label="Dismiss"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="sheet-body">
          <div className="topic-list">
            {TOPIC_OPTIONS.map((tp) => {
              const pressed = draft.has(tp.id);
              return (
                <button
                  key={tp.id}
                  type="button"
                  className="topic-item"
                  aria-pressed={pressed}
                  onClick={() => toggle(tp.id)}
                >
                  <span>
                    <div className="t-name">{tp.name}</div>
                    <div className="t-hint">{tp.hint}</div>
                  </span>
                  <span className="topic-check" aria-hidden="true">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="topic-actions">
            <button type="button" onClick={() => setDraft(new Set())}>
              Clear
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => onApply?.([...draft])}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
