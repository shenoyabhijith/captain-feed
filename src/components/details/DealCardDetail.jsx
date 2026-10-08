import BriefCardDetail from "./BriefCardDetail.jsx";

export default function DealCardDetail({ card, ...rest }) {
  return <BriefCardDetail card={card} {...rest} eyebrow="Deal brief" />;
}
