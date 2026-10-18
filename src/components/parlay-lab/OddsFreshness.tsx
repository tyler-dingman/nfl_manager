'use client';
import { useEffect, useState } from 'react';
import { oddsFreshness } from '../../../packages/parlay/freshness';
export function OddsFreshness() {
  const [text, setText] = useState(oddsFreshness(null).text);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/parlay-lab/freshness', { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) {
          const body = await response.json();
          if (typeof body.text === 'string') setText(body.text);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <p role="status" className="px-4 py-3 text-xs text-white/75">
      {text}
    </p>
  );
}
