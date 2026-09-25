'use client';
import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParlayTeamContext } from '@/components/parlay-lab/use-parlay-team';
function TeamsRedirect() {
  const { team, ready } = useParlayTeamContext();
  const router = useRouter();
  useEffect(() => {
    if (ready && team) router.replace(`/parlay-lab/games?team=${team.abbr}`);
  }, [ready, team, router]);
  return null;
}
export default function Page() {
  return (
    <Suspense>
      <TeamsRedirect />
    </Suspense>
  );
}
