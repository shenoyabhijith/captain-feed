import BriefCardDetail from "./BriefCardDetail.jsx";

export default function TaxCardDetail({ card, ...rest }) {
  return <BriefCardDetail card={card} {...rest} eyebrow="Tax brief" />;
}
