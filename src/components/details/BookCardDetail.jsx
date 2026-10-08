import BriefCardDetail from "./BriefCardDetail.jsx";

export default function BookCardDetail({ card, ...rest }) {
  return <BriefCardDetail card={card} {...rest} eyebrow="Book brief" />;
}
