import { CustomerOrderDetail } from '@/components/merch/customer-orders';
export default function OrderPage({ params }: { params: { orderId: string } }) {
  return <CustomerOrderDetail orderId={params.orderId} />;
}
