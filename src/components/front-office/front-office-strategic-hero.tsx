import type { ReactNode } from 'react';

import { FrontOfficeFeatureHeading } from './front-office-feature-heading';

import styles from './front-office-strategic-hero.module.css';

export type FrontOfficeStrategicHeroProps = {
  section: string;
  title: string;
  description: string;
  actions?: ReactNode;
  compact?: boolean;
  feature?: boolean;
};

export function FrontOfficeStrategicHero({
  section,
  title,
  description,
  actions,
  compact = false,
  feature = false,
}: FrontOfficeStrategicHeroProps) {
  return (
    <section className={`${styles.hero} ${compact ? styles.compact : ''}`}>
      <div className={styles.copy}>
        <p>Front Office · {section}</p>
        {feature ? (
          <FrontOfficeFeatureHeading>{title}</FrontOfficeFeatureHeading>
        ) : (
          <h1 className="dd-home-hero-display">{title}</h1>
        )}
        <span>{description}</span>
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );
}
