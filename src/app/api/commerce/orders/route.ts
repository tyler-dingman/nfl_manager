import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { authError } from '@/server/auth/http';
import { customerOrders } from '@/server/commerce/orders';
export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Sign in to view orders.', 401);
  return NextResponse.json({ orders: await customerOrders(user.id) });
}
