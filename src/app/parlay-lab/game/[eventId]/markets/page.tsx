import { Suspense } from 'react';
import { ParlayLabHome } from '@/components/parlay-lab/ParlayLabHome';
export default async function GameMarketsPage({params: asyncparams}: {params:Promise<{eventId:string}>}) {
const params = await asyncparams;
 return <Suspense><ParlayLabHome mode="games" initialEventId={params.eventId}/></Suspense>; }
