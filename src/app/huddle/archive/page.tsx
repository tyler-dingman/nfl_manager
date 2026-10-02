import { Suspense } from 'react';
import Huddle from '@/components/huddle-live/huddle';
import ArchiveList from '@/components/huddle-live/archive-list';
export default function HuddleArchive({
  searchParams,
}: {
  searchParams: { team?: string; date?: string };
}) {
  return (
    <Suspense fallback={<p>Opening previous Huddles…</p>}>
      {searchParams.date ? (
        <Huddle archive />
      ) : (
        <ArchiveList teamAbbr={searchParams.team ?? 'KC'} />
      )}
    </Suspense>
  );
}
