import ContentGraphicCard from './content-graphic-card';

export default function InjuryGraphicCard({
  teamAbbr,
  eyebrow = 'INJURY REPORT',
  primaryText = 'INJURY',
  accentText = 'ALERT',
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
      template="injury"
      teamAbbr={teamAbbr}
      eyebrow={eyebrow}
      primaryText={primaryText}
      accentText={accentText}
      className={className}
    />
  );
}
