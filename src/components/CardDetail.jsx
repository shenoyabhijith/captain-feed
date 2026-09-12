import { Link } from "react-router-dom";
import BookCardDetail from "./details/BookCardDetail.jsx";
import TaxCardDetail from "./details/TaxCardDetail.jsx";
import TrendCardDetail from "./details/TrendCardDetail.jsx";
import AwsCardDetail from "./details/AwsCardDetail.jsx";
import DealCardDetail from "./details/DealCardDetail.jsx";
import GymCardDetail from "./details/GymCardDetail.jsx";
import DetailShell, { Section } from "./details/DetailShell.jsx";

const RENDERERS = {
  book: BookCardDetail,
  tax: TaxCardDetail,
  trend: TrendCardDetail,
  aws: AwsCardDetail,
  deal: DealCardDetail,
  gym: GymCardDetail,
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
          <button type="button" className={`btn ${read ? "on" : "primary"}`} onClick={() => onToggleRead(card.id)}>
            {read ? "Read" : "Mark read"}
          </button>
          <button type="button" className={`btn ${saved ? "on" : ""}`} onClick={() => onToggleSave(card.id)}>
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
      <Renderer card={card} />
    </div>
  );
}

function FallbackDetail({ card }) {
  return (
    <DetailShell title={card.title} summary={card.body} tags={card.tags} eyebrow={card.category}>
      <Section heading="Notes" body={card.body} />
    </DetailShell>
  );
}
