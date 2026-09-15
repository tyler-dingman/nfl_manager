import { notFound } from 'next/navigation';
import { TradeHubToolPage } from '@/components/front-office/trade-hub/TradeHubToolPage';

const tools = new Set(['partners', 'finder', 'offers', 'block', 'recent', 'activity']);
export default function TradeHubToolRoute({ params }: { params: { tool: string } }) {
  if (!tools.has(params.tool)) notFound();
  return <TradeHubToolPage tool={params.tool} />;
}
