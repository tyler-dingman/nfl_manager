import ContentGraphicCard from './content-graphic-card';

export default function ContractGraphicCard({
  teamAbbr,
  eyebrow = 'FRONT OFFICE',
  primaryText = 'CONTRACT',
  accentText = 'UPDATE',
  className,
}: {
  teamAbbr: string;
  eyebrow?: string;
  primaryText?: string;
  accentText?: string;
  className?: string;
}) {
  return (
    <ContentGraphicCard
      template="contract"
      teamAbbr={teamAbbr}
      eyebrow={eyebrow}
      primaryText={primaryText}
      accentText={accentText}
      className={className}
    />
  );
}
