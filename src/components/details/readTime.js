import { stripInline } from "./inline.jsx";

const WPM = 230;

function words(s) {
  const t = stripInline(s).trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Rough read time for a card's full brief, in whole minutes (min 1). */
export function estimateReadMinutes(card) {
  const d = card?.detail || {};
  let n = 0;
  n += words(d.tldr);
  for (const b of d.tldrBullets || []) n += words(b);
  n += words(d.summary || card?.body);
  for (const s of d.sections || []) {
    n += words(s?.heading) + words(s?.body);
    if (s?.callout?.text) n += words(s.callout.text);
    if (s?.quote?.text) n += words(s.quote.text);
  }
  for (const b of d.bullets || []) n += words(b);
  for (const b of d.steps || []) n += words(b);
  return Math.max(1, Math.ceil(n / WPM));
}
