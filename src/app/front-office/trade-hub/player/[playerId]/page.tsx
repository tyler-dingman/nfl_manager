import { TradeTargetDetail } from '@/components/front-office/trade-hub/TradeTargetDetail';

export default function TradeTargetPage({ params }: { params: { playerId: string } }) {
  return <TradeTargetDetail playerId={params.playerId} />;
}
