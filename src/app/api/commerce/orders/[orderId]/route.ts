import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { authError } from '@/server/auth/http';
import { customerOrder } from '@/server/commerce/orders';
export async function GET(request: NextRequest, { params }: { params: { orderId: string } }) {
  const user = await currentUser(request);
  if (!user) return authError('Sign in to view orders.', 401);
  const order = await customerOrder(user.id, params.orderId);
  return order ? NextResponse.json({ order }) : authError('Order not found.', 404);
}
