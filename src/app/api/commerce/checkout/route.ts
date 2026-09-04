import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { createCommerceOrder } from '@/server/commerce/orders';
const schema = z.object({
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  address1: z.string().min(3).max(150),
  address2: z.string().max(150).optional(),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(40),
  postalCode: z.string().min(5).max(12),
  shippingMethod: z.enum(['STANDARD', 'EXPRESS']),
  paymentMethod: z.enum(['APPLE_PAY', 'GOOGLE_PAY', 'PAYPAL', 'CARD']),
  paymentFixture: z.enum(['SUCCESS', 'DECLINED']).optional(),
  promoCode: z.string().max(40).optional(),
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
    const user = await currentUser(request);
    return NextResponse.json({
      order: await createCommerceOrder(user?.id ?? null, schema.parse(await request.json())),
    });
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to place order.');
  }
}
