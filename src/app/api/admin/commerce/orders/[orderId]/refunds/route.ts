import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { assertSameOrigin } from '@/server/auth/http';
import { isAllowedAdminUser } from '@/server/admin/authorization';
import { adminOrder } from '@/server/commerce/orders';
import { createStripeRefund } from '@/server/commerce/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  requestId: z.string().uuid(),
  type: z.enum(['FULL', 'PARTIAL']),
  amountCents: z.number().int().positive().optional(),
  reason: z.enum(['CUSTOMER_REQUEST', 'DAMAGED_ITEM', 'ORDER_CORRECTION', 'OTHER']).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!isAllowedAdminUser(user?.id, process.env.ADMIN_USER_IDS ?? ''))
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const input = schema.parse(await request.json());
    if (input.type === 'PARTIAL' && !input.amountCents)
      return NextResponse.json({ error: 'A partial refund amount is required.' }, { status: 400 });
    const refund = await createStripeRefund({
      orderId: params.orderId,
      adminUserId: user!.id,
      requestId: input.requestId,
      amountCents: input.type === 'PARTIAL' ? input.amountCents : undefined,
      reason: input.reason,
    });
    return NextResponse.json({ refund, order: await adminOrder(params.orderId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to refund order.' },
      { status: 400 },
    );
  }
}
