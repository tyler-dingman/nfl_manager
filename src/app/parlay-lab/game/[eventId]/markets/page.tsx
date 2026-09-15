import { ParlayLabPage } from '@/components/parlay-lab/ParlayLabPage';

export default function GameMarketsPage({ params }: { params: { eventId: string } }) {
  return <ParlayLabPage initialEventId={params.eventId} />;
}
