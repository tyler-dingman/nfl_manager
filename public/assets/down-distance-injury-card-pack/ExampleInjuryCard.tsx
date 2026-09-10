import './team-accent-map.css';
import './injury-card.css';

type Props = {
  team: string;
  eyebrow?: string;
  line1?: string;
  line2?: string;
};

export function InjuryCardArt({ team, eyebrow='INJURY REPORT', line1='INJURY', line2='ALERT' }: Props) {
  return (
    <div className="injury-card-art" data-team={team} aria-label={`${eyebrow}: ${line1} ${line2}`}>
      <img className="injury-card-art__playbook" src="/content-card-elements/shared/playbook-overlay.svg" alt="" />
      <img className="injury-card-art__bar" src="/content-card-elements/injury/accent-bar.svg" alt="" />
      <img className="injury-card-art__cross" src="/content-card-elements/injury/medical-cross.svg" alt="" />
      <img className="injury-card-art__heartbeat" src="/content-card-elements/injury/heartbeat.svg" alt="" />
      <img className="injury-card-art__underline" src="/content-card-elements/injury/underline.svg" alt="" />
      <div className="injury-card-art__copy">
        <div className="injury-card-art__eyebrow">{eyebrow}</div>
        <div className="injury-card-art__headline">
          {line1}
          <span className="injury-card-art__headline-accent">{line2}</span>
        </div>
      </div>
    </div>
  );
}
