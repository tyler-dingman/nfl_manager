import { Suspense } from 'react';
import Huddle from '@/components/huddle-live/huddle';
import ArchiveList from '@/components/huddle-live/archive-list';
export default async function HuddleArchive({
  searchParams: asyncsearchParams,
}: {
  searchParams: Promise<{ team?: string; date?: string }>;
}) {
const searchParams = await asyncsearchParams;

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
