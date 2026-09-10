import ContentGraphicCard from './content-graphic-card';

export default function TradeTalkGraphicCard({
  teamAbbr,
  eyebrow = 'FRONT OFFICE',
  primaryText = 'TRADE',
  accentText = 'TALK',
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
      template="trade-talk"
      teamAbbr={teamAbbr}
      eyebrow={eyebrow}
      primaryText={primaryText}
      accentText={accentText}
      className={className}
    />
  );
}
