import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { isAllowedAdminUser } from '@/server/admin/authorization';
import { commerceAdminData } from '@/server/commerce/admin';
export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!isAllowedAdminUser(user?.id, process.env.ADMIN_USER_IDS ?? ''))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const q = request.nextUrl.searchParams;
  return NextResponse.json(
    await commerceAdminData(
      q.get('section') ?? 'dashboard',
      q.get('search') ?? '',
      q.get('status') ?? 'ALL',
    ),
  );
}
