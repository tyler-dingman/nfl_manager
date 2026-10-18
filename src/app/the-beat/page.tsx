import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import TeamContentHub from '@/components/team-content-hub';

export default async function TheBeatPage({
  searchParams: pendingSearchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await pendingSearchParams;
  const story = typeof searchParams?.story === 'string' ? searchParams.story : null;
  if (story) {
    const passthrough = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (key === 'story' || key === 'team' || typeof value !== 'string') continue;
      passthrough.set(key, value);
    }
    redirect(`/content/${encodeURIComponent(story)}${passthrough.size ? `?${passthrough}` : ''}`);
  }
  return (
    <Suspense>
      <TeamContentHub kind="huddle" />
    </Suspense>
  );
}
