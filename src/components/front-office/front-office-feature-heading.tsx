import { frontOfficeFont } from './front-office-font';
import type { ReactNode } from 'react';

/** Opt-in editorial typography; ordinary page titles retain the UI font. */
export function FrontOfficeFeatureHeading({ children }: { children: ReactNode }) {
  return <h1 className={`${frontOfficeFont.variable} front-office-feature-heading`}>{children}</h1>;
}
