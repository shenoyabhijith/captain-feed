import BriefCardDetail from "./BriefCardDetail.jsx";

export default function TrendCardDetail({ card, ...rest }) {
  return <BriefCardDetail card={card} {...rest} eyebrow="Trend brief" />;
}
