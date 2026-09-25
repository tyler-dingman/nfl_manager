import { Suspense } from 'react';
import { ParlayLabHome } from '@/components/parlay-lab/ParlayLabHome';
export default function GameMarketsPage({params}: {params:{eventId:string}}) { return <Suspense><ParlayLabHome mode="games" initialEventId={params.eventId}/></Suspense>; }
