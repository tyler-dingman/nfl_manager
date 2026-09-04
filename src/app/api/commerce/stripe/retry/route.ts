import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { prepareStripePaymentRetry } from '@/server/commerce/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  orderId: z.string().uuid(),
  paymentIntentId: z.string().startsWith('pi_'),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    return NextResponse.json({
      checkout: await prepareStripePaymentRetry(input.orderId, input.paymentIntentId),
    });
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to retry payment.');
  }
}
