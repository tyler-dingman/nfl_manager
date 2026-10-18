import { CustomerOrderDetail } from '@/components/merch/customer-orders';
export default async function OrderPage({ params: asyncparams }: { params: Promise<{ orderId: string }> }) {
const params = await asyncparams;

  return <CustomerOrderDetail orderId={params.orderId} />;
}
