import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { isAllowedAdminUser } from '@/server/admin/authorization';
import { assertSameOrigin } from '@/server/auth/http';
import { adjustInventory } from '@/server/commerce/admin';
const schema = z.object({
  delta: z
    .number()
    .int()
    .min(-10000)
    .max(10000)
    .refine((x) => x !== 0),
  reason: z.enum(['New stock', 'Damaged', 'Manual correction', 'Return', 'Sample']),
});
export async function PATCH(request: NextRequest, { params }: { params: { variantId: string } }) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!isAllowedAdminUser(user?.id, process.env.ADMIN_USER_IDS ?? ''))
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const input = schema.parse(await request.json());
    return NextResponse.json({
      variant: await adjustInventory(
        user!.id,
        decodeURIComponent(params.variantId),
        input.delta,
        input.reason,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to adjust inventory.' },
      { status: 400 },
    );
  }
}
