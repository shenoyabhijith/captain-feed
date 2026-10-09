import { Sparkles } from "lucide-react";
import { Favicon, domainOf } from "./details/SourceShot.jsx";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "./icons.js";

/** Seeded stock placeholders (picsum etc.) say nothing about the post; treat as no image. */
const STOCK_RE = /(^|\/\/)(picsum\.photos|source\.unsplash\.com|loremflickr\.com|placehold\.co|via\.placeholder\.com)\b/i;
export function isStockPlaceholder(src) {
  return STOCK_RE.test(String(src || ""));
}

/** No real image: pastel art with the category icon + source favicon (deck + list). */
export default function CardArt({ card }) {
  const Icon = CATEGORY_ICONS[card.category] || Sparkles;
  const domain = domainOf(card.link);
  const source = String(card.source || "").split(/\s+·\s+/)[0] || domain;
  return (
    <div className="deck-art" aria-hidden="true">
      <Icon className="deck-art__ghost" size={168} strokeWidth={1.1} />
      <span className="deck-art__tile">
        <Icon size={34} strokeWidth={1.9} />
      </span>
      <span className="deck-art__src">
        {domain ? <Favicon domain={domain} size={14} className="deck-art__fav" /> : null}
        <span>{source || CATEGORY_LABELS[card.category] || "Captain Feed"}</span>
      </span>
    </div>
  );
}
