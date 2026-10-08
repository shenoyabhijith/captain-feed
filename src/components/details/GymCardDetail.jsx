import BriefCardDetail from "./BriefCardDetail.jsx";

export default function GymCardDetail({ card, ...rest }) {
  return <BriefCardDetail card={card} {...rest} eyebrow="Gym brief" />;
}
