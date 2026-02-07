'use client';

import { useEffect } from 'react';

function svgToDataUrl(svg: string) {
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

function buildTeamFaviconSvg(primaryColor: string) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="${primaryColor}"/>
  <path d="M22 18h22v8H30v6h12v8H30v14h-8V18z" fill="#ffffff"/>
</svg>`.trim();
}

export function TeamFavicon({ primaryColor }: { primaryColor?: string | null }) {
  useEffect(() => {
    if (!primaryColor) return;

    const svg = buildTeamFaviconSvg(primaryColor);
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
  }, [primaryColor]);

  return null;
}
