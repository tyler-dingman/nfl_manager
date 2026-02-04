import { NextResponse } from 'next/server';

import { getSaveHeader } from '@/server/api/save';

const getParam = (request: Request, key: string) =>
  new URL(request.url).searchParams.get(key) ?? undefined;

export const GET = async (request: Request) => {
  const saveId = getParam(request, 'saveId');
  if (!saveId) {
    return NextResponse.json({ error: 'saveId is required' }, { status: 400 });
  }

  return NextResponse.json(getSaveHeader(saveId));
};
