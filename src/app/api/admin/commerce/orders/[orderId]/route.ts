import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { isAllowedAdminUser } from '@/server/admin/authorization';
import { adminOrder, transitionOrder } from '@/server/commerce/orders';
import { assertSameOrigin } from '@/server/auth/http';
const schema = z.object({
  action: z.enum(['START_PICKING', 'MARK_PACKED', 'MARK_SHIPPED', 'MARK_DELIVERED', 'CANCEL']),
  carrier: z.enum(['USPS', 'UPS', 'FEDEX', 'OTHER']).optional(),
  trackingNumber: z.string().max(100).optional(),
  internalNote: z.string().max(500).optional(),
});
async function admin(request: NextRequest) {
  const user = await currentUser(request);
  return isAllowedAdminUser(user?.id, process.env.ADMIN_USER_IDS ?? '') ? user : null;
}
export async function GET(request: NextRequest, { params }: { params: { orderId: string } }) {
  if (!(await admin(request))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const order = await adminOrder(params.orderId);
  return order
    ? NextResponse.json({ order })
    : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
export async function PATCH(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    assertSameOrigin(request);
    const user = await admin(request);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      order: await transitionOrder(user.id, params.orderId, schema.parse(await request.json())),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update order.' },
      { status: 400 },
    );
  }
}
