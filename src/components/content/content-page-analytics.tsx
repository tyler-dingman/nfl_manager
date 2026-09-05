'use client';

import { useEffect } from 'react';

export default function ContentPageAnalytics(props: {
  contentId: string;
  team: string;
  contentType: string;
  publishedAt: string;
  sourceCategory: string;
}) {
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('down-distance:pageview', {
        detail: { route: window.location.pathname, ...props },
      }),
    );
  }, [props.contentId, props.contentType, props.publishedAt, props.sourceCategory, props.team]);
  return null;
}
