'use client';

import type { ReactNode } from 'react';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
import { FRONT_OFFICE_NAVIGATION } from '@/lib/front-office-navigation';

export type DraftExperienceNavKey = (typeof FRONT_OFFICE_NAVIGATION.draft)[number]['key'];

export function DraftExperienceHero({
  title,
  description,
  active,
  actions,
}: {
  title: string;
  description: string;
  active?: DraftExperienceNavKey;
  actions?: ReactNode;
}) {
  void active;
  return (
    <>
      <FrontOfficeStrategicHero
        section={title}
        title={title}
        description={description}
        actions={actions}
      />
      <FrontOfficeSectionNav section="draft" />
    </>
  );
}
