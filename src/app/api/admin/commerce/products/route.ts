import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { isAllowedAdminUser } from '@/server/admin/authorization';
import { assertSameOrigin } from '@/server/auth/http';
import { createCommerceProduct } from '@/server/commerce/admin';
const schema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(100),
  name: z.string().min(2).max(180),
  description: z.string().max(2000).default(''),
  category: z.string().min(2).max(80),
  basePriceCents: z.number().int().min(0),
  sku: z.string().min(2).max(100),
  size: z.string().max(40).optional(),
  imageUrl: z.string().startsWith('/images/').optional(),
  inventoryOnHand: z.number().int().min(0).max(100000),
});
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!isAllowedAdminUser(user?.id, process.env.ADMIN_USER_IDS ?? ''))
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      product: await createCommerceProduct(user!.id, schema.parse(await request.json())),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create product.' },
      { status: 400 },
    );
  }
}
