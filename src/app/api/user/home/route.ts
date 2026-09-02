import { NextRequest, NextResponse } from 'next/server';
import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { listSavedContent } from '@/server/user/content-repository';
import { getPreferences, listTeamFollows } from '@/server/user/repository';
export async function GET(r: NextRequest) {
  const u = await currentUser(r);
  if (!u) return authError('Unauthorized.', 401);
  const [preferences, teams, saved] = await Promise.all([
    getPreferences(u.id),
    listTeamFollows(u.id),
    listSavedContent(u.id),
  ]);
  return NextResponse.json({
    ok: true,
    personalization: {
      primaryTeam: teams.find((t) => t.isPrimary) ?? null,
      teamFollows: teams,
      savedContent: saved,
      preferences,
      sections: [
        'PRIMARY_TEAM',
        'THREE_AND_OUT',
        'SINCE_YOU_WERE_HERE',
        'SAVED',
        'AROUND_THE_LEAGUE',
      ],
    },
  });
}
