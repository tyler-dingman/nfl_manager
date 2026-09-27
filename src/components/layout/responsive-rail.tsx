import type { ComponentPropsWithoutRef } from 'react';
import styles from './responsive-rail.module.css';

/** Match stackAt to the parent layout's breakpoint. Desktop sizing stays with the parent. */
export function ResponsiveRail({
  stackAt = 1023,
  className = '',
  ...props
}: ComponentPropsWithoutRef<'aside'> & {
  stackAt?: 780 | 800 | 850 | 900 | 1000 | 1023 | 1100 | 1150 | 1199 | 1200 | 1250 | 'profile';
}) {
  return (
    <aside {...props} className={`${className} ${styles.rail} ${styles[`stack${stackAt}`]}`} />
  );
}
