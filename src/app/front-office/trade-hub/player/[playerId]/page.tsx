import { TradeTargetDetail } from '@/components/front-office/trade-hub/TradeTargetDetail';

export default async function TradeTargetPage({ params: asyncparams }: { params: Promise<{ playerId: string }> }) {
const params = await asyncparams;

  return <TradeTargetDetail playerId={params.playerId} />;
}
