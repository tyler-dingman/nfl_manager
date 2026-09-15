import { notFound } from 'next/navigation';
import { DraftSectionPage } from '@/components/front-office/draft-central/DraftSectionPage';
const sections = new Set(['team-needs', 'mock-drafts', 'history', 'scouting']);
export default function DraftSectionRoute({ params }: { params: { section: string } }) {
  if (!sections.has(params.section)) notFound();
  return <DraftSectionPage section={params.section} />;
}
