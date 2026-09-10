import "./rookie-blueprint-card.css";

type RookieBlueprintGraphicCardProps = {
  teamAbbr: string;
  eyebrow?: string;
  primaryText?: string;
  accentText?: string;
  className?: string;
};

export function RookieBlueprintGraphicCard({
  teamAbbr,
  eyebrow = "DRAFT",
  primaryText = "ROOKIE",
  accentText = "BLUEPRINT",
  className = "",
}: RookieBlueprintGraphicCardProps) {
  const root = "/assets/down-distance-rookie-blueprint-card-pack";

  return (
    <div
      className={`dd-rookie-card-art ${className}`}
      data-team={teamAbbr}
      aria-label={`${eyebrow}: ${primaryText} ${accentText}`}
    >
      <img className="dd-rookie-card-art__playbook" src={`${root}/shared/playbook-overlay.svg`} alt="" aria-hidden="true" />
      <img className="dd-rookie-card-art__halftone" src={`${root}/shared/halftone-dots.svg`} alt="" aria-hidden="true" />

      <div className="dd-rookie-card-art__copy">
        <div className="dd-rookie-card-art__eyebrow">{eyebrow}</div>
        <div className="dd-rookie-card-art__headline">
          <span className="dd-rookie-card-art__headline-primary">{primaryText}</span>
          <span className="dd-rookie-card-art__headline-accent">{accentText}</span>
        </div>
      </div>

      {/* Import currentColor SVGs inline/as React components using the same approach
          as Injury / Contract / Developing / Trade Talk. */}
      <div className="dd-rookie-card-art__badge" aria-hidden="true">
        {/* inline rookie/draft-badge.svg */}
      </div>
      <div className="dd-rookie-card-art__underline" aria-hidden="true">
        {/* inline rookie/underline-swoosh.svg */}
      </div>

      <img className="dd-rookie-card-art__ruler" src={`${root}/rookie/ruler-overlay.svg`} alt="" aria-hidden="true" />
    </div>
  );
}
