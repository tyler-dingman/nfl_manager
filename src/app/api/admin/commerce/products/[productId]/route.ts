import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { isAllowedAdminUser } from '@/server/admin/authorization';
import { assertSameOrigin } from '@/server/auth/http';
import { updateCommerceProduct } from '@/server/commerce/admin';
const schema = z.object({
  active: z.boolean().optional(),
  name: z.string().min(2).max(180).optional(),
  description: z.string().max(2000).optional(),
  basePriceCents: z.number().int().min(0).optional(),
});
export async function PATCH(request: NextRequest, { params }: { params: { productId: string } }) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!isAllowedAdminUser(user?.id, process.env.ADMIN_USER_IDS ?? ''))
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      product: await updateCommerceProduct(params.productId, schema.parse(await request.json())),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update product.' },
      { status: 400 },
    );
  }
}
