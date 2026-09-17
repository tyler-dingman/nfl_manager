import type { ReactNode } from 'react';

import styles from './front-office-strategic-hero.module.css';

export type FrontOfficeStrategicHeroProps = {
  section: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function FrontOfficeStrategicHero({
  section,
  title,
  description,
  actions,
}: FrontOfficeStrategicHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.copy}>
        <p>Front Office · {section}</p>
        <h1 className="dd-home-hero-display">{title}</h1>
        <span>{description}</span>
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );
}
