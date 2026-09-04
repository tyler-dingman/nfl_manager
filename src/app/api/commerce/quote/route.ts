import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { quoteCommerceOrder } from '@/server/commerce/orders';

const schema = z.object({
  promoCode: z.string().max(40).optional(),
  shippingMethod: z.enum(['STANDARD', 'EXPRESS']).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(120),
        size: z.string().min(1).max(40),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    return NextResponse.json({
      quote: await quoteCommerceOrder(input.items, input.promoCode, input.shippingMethod),
    });
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to calculate totals.');
  }
}
