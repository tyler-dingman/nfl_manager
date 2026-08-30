'use client';

import { useEffect } from 'react';

import { getTeamBrandTheme } from '@/lib/team-brand-themes';

function svgToDataUrl(svg: string) {
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

function buildTeamFaviconSvg(teamAbbr: string) {
  const { primary, secondary, dark, light } = getTeamBrandTheme(teamAbbr);
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="3" y="3" width="58" height="58" rx="12" fill="${dark}" stroke="${primary}" stroke-width="6"/>
  <path d="M14 16h14c11 0 18 6 18 16s-7 16-18 16H14V16zm10 9v14h4c5 0 8-2 8-7s-3-7-8-7h-4z" fill="${light}"/>
  <rect x="39" y="37" width="17" height="17" rx="4" fill="${secondary}"/>
  <text x="47.5" y="50" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="900" fill="${dark}">&amp;</text>
</svg>`.trim();
}

export function TeamFavicon({ teamAbbr }: { teamAbbr?: string | null }) {
  useEffect(() => {
    if (!teamAbbr) return;

    const svg = buildTeamFaviconSvg(teamAbbr);
    const href = svgToDataUrl(svg);

    let link = document.querySelector<HTMLLinkElement>('link#team-favicon');
    if (!link) {
      link = document.createElement('link');
      link.id = 'team-favicon';
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }

    link.href = href;
  }, [teamAbbr]);

  return null;
}
