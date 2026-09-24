import { NextRequest, NextResponse } from 'next/server';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { saveCrewMedia } from '@/server/crew/repository';
import { validateCrewImage } from '@/features/crew/validation';
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    if (Number(request.headers.get('content-length')) > 2.2 * 1024 * 1024)
      return authError('Photo must be under 2 MB.', 413);
    const form = await request.formData();
    const file = form.get('photo');
    if (!(file instanceof File)) return authError('Choose a photo.');
    if (file.size > 2 * 1024 * 1024) return authError('Photo must be under 2 MB.', 413);
    const bytes = Buffer.from(await file.arrayBuffer());
    validateCrewImage(bytes, file.type);
    return NextResponse.json(await saveCrewMedia(user.id, file.type, bytes));
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to upload photo.');
  }
}
