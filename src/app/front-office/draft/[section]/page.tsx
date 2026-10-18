import { notFound } from 'next/navigation';
import { DraftSectionPage } from '@/components/front-office/draft-central/DraftSectionPage';
const sections = new Set(['team-needs', 'history', 'scouting']);
export default async function DraftSectionRoute({ params: asyncparams }: { params: Promise<{ section: string }> }) {
const params = await asyncparams;

  if (!sections.has(params.section)) notFound();
  return <DraftSectionPage section={params.section} />;
}
