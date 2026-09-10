import ContentGraphicCard from './content-graphic-card';

export default function RookieBlueprintGraphicCard({
  teamAbbr,
  eyebrow = 'DRAFT',
  primaryText = 'ROOKIE',
  accentText = 'BLUEPRINT',
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
      template="rookie-blueprint"
      teamAbbr={teamAbbr}
      eyebrow={eyebrow}
      primaryText={primaryText}
      accentText={accentText}
      className={className}
    />
  );
}
