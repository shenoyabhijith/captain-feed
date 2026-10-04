import DetailShell, { BriefBlocks, collectBriefBlocks } from "./DetailShell.jsx";

/** Shared brief layout for every category renderer. */
export default function BriefCardDetail({ card, eyebrow }) {
  const d = card.detail || {};
  const blocks = collectBriefBlocks(d, card);
  return (
    <DetailShell
      index={blocks}
      category={card.category}
      eyebrow={eyebrow}
      title={card.title}
      tldr={d.tldr}
      tldrBullets={d.tldrBullets}
      summary={d.summary || card.body}
      tags={card.tags}
    >
      {card.image ? <img className="detail-media" alt="" src={card.image} /> : null}
      <BriefBlocks blocks={blocks} />
    </DetailShell>
  );
}
