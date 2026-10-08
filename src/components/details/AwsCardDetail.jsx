import BriefCardDetail from "./BriefCardDetail.jsx";

export default function AwsCardDetail({ card, ...rest }) {
  return <BriefCardDetail card={card} {...rest} eyebrow="AWS brief" />;
}
