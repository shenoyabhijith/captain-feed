import { Link } from "react-router-dom";
import BookCardDetail from "./details/BookCardDetail.jsx";
import TaxCardDetail from "./details/TaxCardDetail.jsx";
import TrendCardDetail from "./details/TrendCardDetail.jsx";
import AwsCardDetail from "./details/AwsCardDetail.jsx";
import DealCardDetail from "./details/DealCardDetail.jsx";
import GymCardDetail from "./details/GymCardDetail.jsx";
import SpaceCardDetail from "./details/SpaceCardDetail.jsx";
import TechCardDetail from "./details/TechCardDetail.jsx";
import DetailShell, { Section, collectBriefBlocks } from "./details/DetailShell.jsx";

const RENDERERS = {
  book: BookCardDetail,
  tax: TaxCardDetail,
  trend: TrendCardDetail,
  aws: AwsCardDetail,
  deal: DealCardDetail,
  gym: GymCardDetail,
  space: SpaceCardDetail,
  tech: TechCardDetail,
};

export default function CardDetail({
  card,
  prefs,
  onToggleRead,
  onToggleSave,
  onSeen,
}) {
  if (!card) {
    return (
      <div className="detail-page">
        <Link className="back" to="/">
          Back
        </Link>
        <div className="empty">Card not found.</div>
      </div>
    );
  }
  onSeen?.(card.id);
  const Renderer = RENDERERS[card.category] || FallbackDetail;
  const read = Boolean(prefs.read[card.id]);
  const saved = Boolean(prefs.saved[card.id]);

  return (
    <div className="detail-page">
      <div className="detail-top">
        <Link className="back" to="/">
          Back
        </Link>
        <div className="detail-actions">
          <button
            type="button"
            className={`btn ${read ? "on" : "primary"}`}
            onClick={() => onToggleRead(card.id)}
          >
            {read ? "Mark unread" : "Mark read"}
          </button>
          <button
            type="button"
            className={`btn ${saved ? "on" : ""}`}
            onClick={() => onToggleSave(card.id)}
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
      <Renderer card={card} />
    </div>
  );
}

function FallbackDetail({ card }) {
  const blocks = collectBriefBlocks({}, card);
  return (
    <DetailShell
      title={card.title}
      tldr={card.detail?.tldr}
      tldrBullets={card.detail?.tldrBullets}
      summary={card.body}
      tags={card.tags}
      category={card.category}
      eyebrow={card.category}
      index={blocks}
    >
      {blocks.map((b) => (
        <Section key={b.id} id={b.id} heading={b.heading} body={b.body} />
      ))}
    </DetailShell>
  );
}
