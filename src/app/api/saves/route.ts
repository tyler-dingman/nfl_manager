import { NextResponse } from 'next/server';

import { createSave } from '@/server/api/save';

export const POST = async (request: Request) => {
  const body = (await request.json()) as { teamAbbr?: string };
  if (!body.teamAbbr) {
    return NextResponse.json({ error: 'teamAbbr is required' }, { status: 400 });
  }

  return NextResponse.json(createSave(body.teamAbbr));
};
