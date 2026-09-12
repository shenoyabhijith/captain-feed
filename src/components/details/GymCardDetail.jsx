import DetailShell, { Section, BulletList, StepList, LinkList } from "./DetailShell.jsx";

export default function GymCardDetail({ card }) {
  const d = card.detail || {};
  const sections = d.sections || [];
  return (
    <DetailShell
      eyebrow="Gym brief"
      title={card.title}
      summary={d.summary || card.body}
      tags={card.tags}
    >
      {card.image ? <img className="detail-media" alt="" src={card.image} /> : null}
      {sections.map((s) => (
        <Section key={s.heading || s.body} heading={s.heading} body={s.body} />
      ))}
      <BulletList items={d.bullets} />
      <StepList items={d.steps} />
      <LinkList items={d.actions} title="Actions" />
      <LinkList items={d.sources} title="Sources" />
      {!sections.length && !d.bullets && !d.steps ? (
        <Section heading="Notes" body={card.body} />
      ) : null}
    </DetailShell>
  );
}
