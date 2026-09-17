'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';

export type FrontOfficeTool = {
  label: string;
  href?: string;
  icon: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
};

export function FrontOfficePageHeader({
  title,
  description,
  tools = [],
}: {
  title: string;
  strapline?: string;
  description?: string;
  tools?: FrontOfficeTool[];
}) {
  const actions = tools.length ? (
    <div className="fo-strategic-hero-tools" aria-label={`${title} tools`}>
      {tools.map(({ label, href, icon: Icon, onClick, disabled }) => {
        const content = (
          <>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </>
        );
        return href && !disabled ? (
          <Link key={label} href={href}>
            {content}
          </Link>
        ) : (
          <button key={label} type="button" onClick={onClick} disabled={disabled}>
            {content}
          </button>
        );
      })}
    </div>
  ) : undefined;

  return (
    <FrontOfficeStrategicHero
      section={title}
      title={title}
      description={description ?? ''}
      actions={actions}
    />
  );
}
