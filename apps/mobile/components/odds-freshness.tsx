import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { apiFetch } from '../lib/network';
import { oddsFreshness } from '../../../packages/parlay/freshness';
export function OddsFreshness() {
  const [text, setText] = useState(oddsFreshness(null).text);
  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/api/parlay-lab/freshness', { signal: controller.signal })
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
    <Text
      accessibilityLiveRegion="polite"
      style={{
        color: '#d4dee4',
        fontSize: 12,
        lineHeight: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      {text}
    </Text>
  );
}
