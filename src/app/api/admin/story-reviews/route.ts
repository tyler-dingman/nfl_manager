import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { isAllowedAdminUser } from '@/server/admin/authorization';
import { reviewRequiredStories } from '@/server/story-engine/repository';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!isAllowedAdminUser(user?.id, process.env.ADMIN_USER_IDS ?? ''))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ stories: await reviewRequiredStories() });
}
