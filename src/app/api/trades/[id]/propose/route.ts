import { NextResponse } from 'next/server';

import { proposeTrade } from '@/server/api/trades';

export const POST = async (
  _request: Request,
  { params }: { params: { id: string } },
) => NextResponse.json(proposeTrade(params.id));
