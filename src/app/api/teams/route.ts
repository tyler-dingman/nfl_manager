import { NextResponse } from 'next/server';

import { listTeams } from '@/server/api/team';

export const GET = async () => NextResponse.json(listTeams());
